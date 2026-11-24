import { handbookOrganization } from '../../../shared/callingGroups';
import { normCallingKey } from '../../../shared/callingNames';
import { type RosterMember, type RosterMemberNames, matchRosterMember, matchRosterMemberExact, splitLastFirstCased, stripBold, toLastFirst } from '../nameMatch';
import { type Ctx, type Session, json } from './core';

// Roster imports and the LCR sync endpoints (/api/ward-members/...).
export async function handleLcrSync(ctx: Ctx, session: Session): Promise<Response | null> {
  const { request, db, routeParts, method } = ctx;
  // Bulk ward-roster import from a CSV upload (admin only). Must be matched before the
  // generic TABLES dispatch below, or "import" would be parsed as a record id.
  if (routeParts[0] === 'ward-members' && routeParts[1] === 'import' && method === 'POST') {
    if (session.role !== 'admin') return json({ error: 'Admin only' }, 403);
    const body = await request.json() as {
      updates?: { id: number; birth_date: string }[];
      creates?: { last_name: string; first_name: string; birth_date: string | null }[];
      deactivate?: number[];
    };
    const updates = (body.updates || []).slice(0, 1000);
    const creates = (body.creates || []).slice(0, 1000);
    const deactivate = (body.deactivate || []).slice(0, 1000);
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    for (const u of updates) {
      if (!u.birth_date || !dateRe.test(u.birth_date)) return json({ error: `Invalid birth_date for id ${u.id}` }, 400);
    }
    for (const c of creates) {
      if (c.birth_date && !dateRe.test(c.birth_date)) return json({ error: `Invalid birth_date for "${c.last_name}"` }, 400);
      if (!c.last_name || !c.last_name.trim()) return json({ error: 'Last name required for new member' }, 400);
    }

    const now = new Date().toISOString();
    const stmts = [
      ...updates.map(u => db.prepare('UPDATE ward_members SET birth_date = ?, updated_at = ? WHERE id = ?').bind(u.birth_date, now, u.id)),
      ...creates.map(c => db.prepare('INSERT INTO ward_members (last_name, first_name, active, birth_date, updated_at) VALUES (?, ?, 1, ?, ?)').bind(c.last_name.trim(), (c.first_name || '').trim(), c.birth_date || null, now)),
      ...deactivate.map(id => db.prepare('UPDATE ward_members SET active = 0, updated_at = ? WHERE id = ?').bind(now, id)),
    ];
    if (stmts.length > 0) await db.batch(stmts);
    return json({ ok: true, updated: updates.length, created: creates.length, deactivated: deactivate.length });
  }

  // Bulk roster reconciliation against a full LCR member-directory export: creates
  // ward_members rows for people not yet tracked, fills in birth_date/gender for
  // existing members whose record is incomplete (never overwrites a value that's
  // already set), and reports active members absent from the export so the clerk
  // can investigate (move-outs, name mismatches, etc.) rather than auto-deactivating.
  if (routeParts[0] === 'ward-members' && routeParts[1] === 'full-sync' && method === 'POST') {
    const body = await request.json() as {
      rows?: { name: string; gender: string | null; birth_date: string | null }[];
    };
    const rows = (body.rows || []).slice(0, 2000);
    const genderRe = /^[MF]$/;
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    for (const r of rows) {
      if (!r.name || !r.name.trim()) return json({ error: 'Row missing name' }, 400);
      if (r.gender && !genderRe.test(r.gender)) return json({ error: `Invalid gender "${r.gender}" for "${r.name}"` }, 400);
      if (r.birth_date && !dateRe.test(r.birth_date)) return json({ error: `Invalid birth_date "${r.birth_date}" for "${r.name}"` }, 400);
    }

    const roster = (await db.prepare(
      'SELECT id, first_name, last_name, preferred_first_name, preferred_last_name, birth_date, gender, active, out_of_ward FROM ward_members'
    ).all<RosterMemberNames & { birth_date: string | null; gender: string | null; active: number; out_of_ward: number }>()).results;

    const now = new Date().toISOString();
    const stmts = [];
    const matchedIds = new Set<number>();
    let created = 0;
    let filledDetails = 0;
    const createdNames: string[] = [];
    const filledNames: string[] = [];

    for (const row of rows) {
      const member = matchRosterMember(row.name, roster);
      if (member) {
        matchedIds.add(member.id);
        const fillBirthDate = !member.birth_date && row.birth_date;
        const fillGender = !member.gender && row.gender;
        if (fillBirthDate || fillGender) {
          // ward_members stores "missing" as '' rather than NULL for these columns,
          // so SQL COALESCE (which only treats NULL as empty) can't be used here —
          // compute the final value in JS instead.
          stmts.push(
            db.prepare('UPDATE ward_members SET birth_date = ?, gender = ?, updated_at = ?, updated_by = ? WHERE id = ?')
              .bind(
                fillBirthDate ? row.birth_date : member.birth_date,
                fillGender ? row.gender : member.gender,
                now, session.name, member.id
              )
          );
          const filled = [fillBirthDate && 'birth date', fillGender && 'gender'].filter(Boolean).join(', ');
          filledNames.push(`${member.last_name}, ${member.first_name} (${filled})`);
          filledDetails++;
        }
        continue;
      }

      const { last, first } = splitLastFirstCased(toLastFirst(row.name));
      if (!last) continue;
      stmts.push(
        db.prepare('INSERT INTO ward_members (last_name, first_name, active, birth_date, gender, updated_at, updated_by) VALUES (?, ?, 1, ?, ?, ?, ?)')
          .bind(last, first, row.birth_date || null, row.gender || null, now, session.name)
      );
      createdNames.push(first ? `${last}, ${first}` : last);
      created++;
    }
    if (stmts.length > 0) await db.batch(stmts);

    // Members flagged "records elsewhere" (out_of_ward) legitimately won't
    // appear in this ward's LCR Member Directory — their membership record
    // lives in another unit, so absence here isn't a real discrepancy.
    const missing = roster.filter(m => m.active && !m.out_of_ward && !matchedIds.has(m.id));
    const missingFromRoster = missing.map(m => `${m.last_name}, ${m.first_name}`);

    // Surface newly-missing members for the user to review on Ward Members
    // (flag "records elsewhere", remove from ward, or dismiss) rather than
    // silently reporting it in the sync log only. Anyone who reappeared in
    // this run's LCR dump is cleared automatically.
    const flagStmts = [
      ...missing.map(m => db.prepare(
        'INSERT OR IGNORE INTO roster_review_flags (ward_member_id, flagged_at) VALUES (?, ?)'
      ).bind(m.id, now)),
      ...[...matchedIds].map(id => db.prepare('DELETE FROM roster_review_flags WHERE ward_member_id = ?').bind(id)),
    ];
    if (flagStmts.length > 0) await db.batch(flagStmts);

    // Everything that routes work to a person — interview setup, calling assignments,
    // My Actions — matches a hub account's name against free-text names that ultimately
    // come from LCR. An account name that doesn't correspond to anyone in the LCR export
    // (a typo, a maiden name, a move-out) silently matches nothing, so report it rather
    // than restricting anything. High councilors are stake, not ward, so they're never
    // expected in this ward's roster.
    const hubUsers = (await db.prepare(
      "SELECT name, church_role FROM users WHERE hub IN ('bh', 'both') AND role <> 'guest' AND COALESCE(church_role, '') <> 'High Councilor'"
    ).all<{ name: string; church_role: string | null }>()).results;
    const lcrRoster: RosterMember[] = rows.map((r, i) => {
      const { last, first } = splitLastFirstCased(toLastFirst(r.name));
      return { id: i + 1, last_name: last, first_name: first };
    });
    // Two independent checks, either of which clears a hub account: the loose
    // first-token/prefix match against this run's raw LCR text (handles middle
    // names and unrecorded nicknames), or resolving through the ward roster's
    // preferred_first_name/preferred_last_name (handles e.g. a hub account named
    // "Jake Jones" for a legal "Jacob Jones") and confirming that member showed
    // up in this sync.
    const activeRoster = roster.filter(m => m.active);
    const unmatchedHubUsers = hubUsers
      .filter(u => {
        if (!u.name) return false;
        if (matchRosterMember(u.name, lcrRoster)) return false;
        const member = matchRosterMemberExact(u.name, activeRoster);
        return !member || !matchedIds.has(member.id);
      })
      .map(u => `${u.name}${u.church_role ? ` (${u.church_role})` : ''}`);

    return json({ ok: true, created, filledDetails, createdNames, filledNames, missingFromRoster, unmatchedHubUsers });
  }

  // Syncs the "with the stake" flag on temple-recommend interviews from LCR's
  // Recommend Activations > Awaiting Stake Activation list: flags matching
  // interviews (creating one with sensible defaults if none exists yet), and
  // clears the flag on any temple-recommend interview previously flagged whose
  // member is no longer on the list (i.e. their recommend was activated).
  if (routeParts[0] === 'ward-members' && routeParts[1] === 'sync-stake-activations' && method === 'POST') {
    const body = await request.json() as { names?: string[] };
    const names = (body.names || []).slice(0, 500);
    const RECOMMEND_TYPE_TO_INTERVIEW_TYPE: Record<string, string> = { Endowed: 'Endowed Temple Rec', Limited: 'Limited' };

    const roster = (await db.prepare(
      'SELECT id, first_name, last_name, recommend_type, recommend_expires FROM ward_members WHERE active = 1'
    ).all<RosterMember & { recommend_type: string | null; recommend_expires: string | null }>()).results;

    const now = new Date().toISOString();
    const stmts = [];
    const matchedMemberIds = new Set<number>();
    const unmatched: string[] = [];
    const flaggedNames: string[] = [];
    const clearedNames: string[] = [];
    let flagged = 0;

    for (const name of names) {
      const member = matchRosterMember(name, roster);
      const interviewType = member?.recommend_type ? RECOMMEND_TYPE_TO_INTERVIEW_TYPE[member.recommend_type] : undefined;
      if (!member || !interviewType) { unmatched.push(name); continue; }
      matchedMemberIds.add(member.id);

      const existing = await db.prepare(
        'SELECT id, with_stake FROM interview_pipeline WHERE ward_member_id = ? AND type_of_interview = ?'
      ).bind(member.id, interviewType).first<{ id: number; with_stake: number }>();

      if (existing) {
        if (!existing.with_stake) {
          stmts.push(db.prepare('UPDATE interview_pipeline SET with_stake = 1, updated_at = ? WHERE id = ?').bind(now, existing.id));
          flaggedNames.push(`${member.last_name}, ${member.first_name}`);
          flagged++;
        }
      } else {
        const legalName = member.first_name ? `${member.last_name}, ${member.first_name}` : member.last_name;
        stmts.push(db.prepare(
          'INSERT INTO interview_pipeline (member, type_of_interview, status, assigned_to, date_recommend_expires, ward_member_id, with_stake, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)'
        ).bind(legalName, interviewType, 'Unassigned', '', member.recommend_expires || '', member.id, now, now));
        flaggedNames.push(`${legalName} (new interview)`);
        flagged++;
      }
    }

    // Only reconcile rows we could plausibly have set ourselves (linked to a
    // ward member) — a with_stake flag on an unlinked row was set some other
    // way and isn't ours to touch.
    const currentlyFlagged = (await db.prepare(
      "SELECT id, ward_member_id, member FROM interview_pipeline WHERE with_stake = 1 AND type_of_interview IN ('Endowed Temple Rec', 'Limited') AND ward_member_id IS NOT NULL"
    ).all<{ id: number; ward_member_id: number; member: string }>()).results;
    let cleared = 0;
    for (const row of currentlyFlagged) {
      if (!matchedMemberIds.has(row.ward_member_id)) {
        stmts.push(db.prepare('UPDATE interview_pipeline SET with_stake = 0, updated_at = ? WHERE id = ?').bind(now, row.id));
        clearedNames.push(row.member);
        cleared++;
      }
    }

    if (stmts.length > 0) await db.batch(stmts);
    return json({ ok: true, flagged, cleared, flaggedNames, clearedNames, unmatched });
  }

  // Bulk callings sync from LCR's Organizations page. Matches by ward_member_id
  // (backfilling it from calling_pipeline's free-text member name where missing)
  // rather than raw name strings, since LCR names and locally-typed names can
  // differ slightly. Creates/advances Calling rows for what LCR shows active,
  // and auto-records a release (via a companion Release row) for anything this
  // sync previously linked that's no longer on LCR's list.
  if (routeParts[0] === 'ward-members' && routeParts[1] === 'sync-callings' && method === 'POST') {
    const body = await request.json() as {
      rows?: { organization: string | null; calling: string; person: string; sustained_date: string | null; set_apart: boolean }[];
      unfilled?: { organization: string | null; calling: string }[];
    };
    // LCR sometimes abbreviates Young Women as "YW"; keep it one organization.
    const normOrg = (o: string | null) => (o && o.trim().toUpperCase() === 'YW' ? 'Young Women' : o);
    const rows = (body.rows || []).slice(0, 2000).map(r => ({ ...r, organization: normOrg(r.organization) }));
    const unfilledRows = (body.unfilled || []).slice(0, 2000).filter(r => r.calling && r.calling.trim()).map(r => ({ ...r, organization: normOrg(r.organization) }));
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    for (const r of rows) {
      if (!r.person || !r.person.trim()) return json({ error: 'Row missing person' }, 400);
      if (!r.calling || !r.calling.trim()) return json({ error: `Row missing calling for "${r.person}"` }, 400);
      if (r.sustained_date && !dateRe.test(r.sustained_date)) return json({ error: `Invalid sustained_date "${r.sustained_date}" for "${r.person}"` }, 400);
    }

    const CALLING_STATUS_ORDER = [
      '1. Discussion', '1.5 On hold', '2. Pray about', '3. Approved and assigned', '3.5 With stake', '4. Called & accepted',
      '4.5 Call & accepted, handle in class/quorum', '5. Sustained', '6. Set apart',
      '7. In release discussion', '8. Need to release', '9. Need to thank at pulpit', '10. Released', '11. Declined',
    ];
    const statusIdx = (s: string) => { const i = CALLING_STATUS_ORDER.indexOf(s); return i === -1 ? 0 : i; };
    const normCalling = normCallingKey;

    const roster = (await db.prepare('SELECT id, first_name, last_name FROM ward_members WHERE active = 1').all<RosterMember>()).results;

    interface CallingRow {
      id: number; member: string; calling: string; organization: string | null; status: string;
      ward_member_id: number | null; sustain_recorded: number; set_apart_recorded: number;
      sustained_date: string | null; type: string; lcr_calling_confirmed: number;
    }
    const allCallings = (await db.prepare(
      'SELECT id, member, calling, organization, status, ward_member_id, sustain_recorded, set_apart_recorded, sustained_date, type, lcr_calling_confirmed FROM calling_pipeline'
    ).all<CallingRow>()).results;

    const now = new Date().toISOString();
    const backfillStmts = [];
    for (const c of allCallings) {
      // Release rows are backfilled too — they're matched by (member, calling) the same
      // way Calling rows are, so an unlinked one is invisible to the release tracking.
      if (c.ward_member_id === null) {
        const m = matchRosterMember(stripBold(c.member), roster);
        if (m) {
          backfillStmts.push(db.prepare('UPDATE calling_pipeline SET ward_member_id = ? WHERE id = ?').bind(m.id, c.id));
          c.ward_member_id = m.id;
        }
      }
    }
    if (backfillStmts.length > 0) await db.batch(backfillStmts);

    // A Calling row counts as "superseded" once a Release row for the same
    // (member, calling) at status='10. Released' was created after it — id order
    // is used as a chronology proxy since rows aren't otherwise linked.
    const isSuperseded = (c: { id: number; ward_member_id: number | null; calling: string }) =>
      allCallings.some(r => r.type === 'Release' && r.ward_member_id === c.ward_member_id &&
        normCalling(r.calling) === normCalling(c.calling) && r.status === '10. Released' && r.id > c.id);

    const stmts = [];
    const changed: { name: string; calling: string; action: string }[] = [];
    const unmatched: string[] = [];
    // Deliberately never creates new calling_pipeline rows — see comment
    // below — kept in the response shape for schema/UI consistency.
    const created = 0;
    let updated = 0, released = 0;
    const seenPairs = new Set<string>();

    for (const row of rows) {
      const member = matchRosterMember(row.person, roster);
      if (!member) { unmatched.push(row.person); continue; }
      seenPairs.add(`${member.id}|${normCalling(row.calling)}`);
      const legalName = `${member.last_name}, ${member.first_name}`;
      const targetStatus = row.set_apart ? '6. Set apart' : '5. Sustained';

      const existing = allCallings
        .filter(c => c.type === 'Calling' && c.ward_member_id === member.id && normCalling(c.calling) === normCalling(row.calling) && !isSuperseded(c))
        .sort((a, b) => b.id - a.id)[0];

      if (existing) {
        const updates: Record<string, unknown> = {};
        if (statusIdx(targetStatus) > statusIdx(existing.status)) updates.status = targetStatus;
        if (!existing.sustain_recorded) updates.sustain_recorded = 1;
        if (row.set_apart && !existing.set_apart_recorded) updates.set_apart_recorded = 1;
        if (row.sustained_date && row.sustained_date !== existing.sustained_date) updates.sustained_date = row.sustained_date;
        // Pipeline entries carry the handbook organization, not LCR's section name.
        const org = handbookOrganization(row.calling, row.organization);
        if (org !== (existing.organization || '')) updates.organization = org;
        const reportableChange = Object.keys(updates).length > 0;
        // This row's free-text calling wording just matched LCR's own text for
        // this org — safe to trust an absence next time as a real release.
        // Not counted as a reportable "updated" change on its own — it's
        // internal bookkeeping, not something the user asked to sync.
        if (!existing.lcr_calling_confirmed) updates.lcr_calling_confirmed = 1;
        if (Object.keys(updates).length > 0) {
          const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
          stmts.push(db.prepare(`UPDATE calling_pipeline SET ${setClause}, updated_at = ? WHERE id = ?`)
            .bind(...Object.values(updates), now, existing.id));
          if (reportableChange) {
            updated++;
            changed.push({ name: legalName, calling: row.calling, action: updates.status === '6. Set apart' ? 'set apart' : updates.status === '5. Sustained' ? 'sustained' : 'updated' });
          }
        }
      }
      // No `else` — deliberately never creates a new calling_pipeline row.
      // Only callings the bishopric already tracks get synced; LCR has ~150+
      // filled callings ward-wide and most (Sunday School teachers, Primary
      // workers, etc.) aren't meant to be tracked here.
    }

    // Release reconciliation: any active Calling row whose text has been
    // confirmed against LCR's own wording at least once (lcr_calling_confirmed
    // — see above) and isn't seen in this week's LCR dump means the person was
    // released from it. Never-confirmed rows are excluded permanently, not just
    // for the run right after backfill — a legacy wording mismatch (e.g.
    // "Nursery" vs LCR's "Nursery Worker") persists across every future sync,
    // so an unconfirmed row's absence never means "released," only "unknown."
    const activeCallings = allCallings.filter(c =>
      c.type === 'Calling' && c.ward_member_id !== null && !!c.lcr_calling_confirmed &&
      !['10. Released', '11. Declined'].includes(c.status) && !isSuperseded(c));
    for (const c of activeCallings) {
      if (seenPairs.has(`${c.ward_member_id}|${normCalling(c.calling)}`)) continue;

      const inProgressRelease = allCallings.find(r =>
        r.type === 'Release' && r.ward_member_id === c.ward_member_id &&
        normCalling(r.calling) === normCalling(c.calling) && r.status !== '10. Released' && r.id > c.id);

      if (inProgressRelease) {
        stmts.push(db.prepare('UPDATE calling_pipeline SET status = ?, release_recorded = 1, updated_at = ? WHERE id = ?').bind('10. Released', now, inProgressRelease.id));
      } else {
        stmts.push(db.prepare(
          'INSERT INTO calling_pipeline (member, calling, organization, status, release_recorded, type, ward_member_id, assigned_to, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)'
        ).bind(c.member, c.calling, c.organization || '', '10. Released', 'Release', c.ward_member_id, '', now, now));
      }
      released++;
      changed.push({ name: c.member, calling: c.calling, action: 'released' });
    }

    if (stmts.length > 0) await db.batch(stmts);

    // Every change in LCR's full calling list since the last sync, tracked in the
    // pipeline or not (the pipeline report above only covers tracked callings).
    // Diffed against the previous member_callings mirror before it's replaced.
    // Skipped when there's no previous mirror, so a first sync doesn't list everyone.
    const lcrChanged: { name: string; calling: string; action: string }[] = [];
    const prevMirror = (await db.prepare('SELECT ward_member_id, calling, set_apart FROM member_callings').all<{ ward_member_id: number; calling: string; set_apart: number }>()).results;
    if (prevMirror.length > 0) {
      const people = (await db.prepare('SELECT id, first_name, last_name FROM ward_members').all<{ id: number; first_name: string; last_name: string }>()).results;
      const nameOf = new Map(people.map(p => [p.id, p.first_name ? `${p.last_name}, ${p.first_name}` : p.last_name]));
      const prev = new Map(prevMirror.map(r => [`${r.ward_member_id}|${normCalling(r.calling)}`, r]));
      const nowKeys = new Set<string>();
      for (const row of rows) {
        const member = matchRosterMember(row.person, roster);
        if (!member) continue;
        const key = `${member.id}|${normCalling(row.calling)}`;
        if (nowKeys.has(key)) continue;
        nowKeys.add(key);
        const before = prev.get(key);
        const name = nameOf.get(member.id) || row.person;
        if (!before) lcrChanged.push({ name, calling: row.calling, action: row.set_apart ? 'sustained, set apart' : 'sustained' });
        else if (row.set_apart && !before.set_apart) lcrChanged.push({ name, calling: row.calling, action: 'set apart' });
      }
      for (const [key, r] of prev) {
        if (!nowKeys.has(key)) lcrChanged.push({ name: nameOf.get(r.ward_member_id) || 'Unknown member', calling: r.calling, action: 'released' });
      }
    }

    // Full read-only mirror of every filled calling LCR reports (not just
    // tracked ones) for the Ward Members "all callings" display — wholesale
    // replace each run since LCR's dump is always the full current picture.
    const memberCallingStmts = [db.prepare('DELETE FROM member_callings')];
    for (const row of rows) {
      const member = matchRosterMember(row.person, roster);
      if (!member) continue;
      memberCallingStmts.push(db.prepare(
        'INSERT INTO member_callings (ward_member_id, calling, organization, sustained_date, set_apart, synced_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(member.id, row.calling, row.organization || '', row.sustained_date, row.set_apart ? 1 : 0, now));
    }
    await db.batch(memberCallingStmts);

    // Full read-only mirror of every vacant, non-custom calling — same
    // wholesale-replace pattern as member_callings above.
    const unfilledStmts = [db.prepare('DELETE FROM unfilled_callings')];
    for (const row of unfilledRows) {
      unfilledStmts.push(db.prepare(
        'INSERT INTO unfilled_callings (calling, organization, synced_at) VALUES (?, ?, ?)'
      ).bind(row.calling, row.organization || '', now));
    }
    await db.batch(unfilledStmts);

    return json({ ok: true, created, updated, released, changed, unmatched, lcr_changed: lcrChanged });
  }

  // Bulk missionary-status sync from missionaryrecommendations.churchofjesuschrist.org.
  // Section names map 1:1 onto MISSIONARY_STATUSES (src/lib/constants.ts) — status is
  // only ever advanced forward, never regressed, and disappearing from a section
  // doesn't undo anything (unlike callings/stake-activations, there's no "gone means
  // reverted" signal here — a released missionary just stops appearing next week).
  if (routeParts[0] === 'ward-members' && routeParts[1] === 'sync-missionary-status' && method === 'POST') {
    const body = await request.json() as {
      rows?: {
        name: string; section: string; mission: string | null; mission_start: string | null;
        mission_end: string | null; received_date: string | null; assignment_made_date: string | null;
      }[];
    };
    const rows = (body.rows || []).slice(0, 500);

    const SECTION_TO_STATUS: Record<string, string> = {
      'Candidate(s) Completing Forms': 'Candidate Completing Forms',
      "Ready for Bishop's Action": "Ready for Bishop's Action",
      'With the Stake President': 'With the Stake President',
      'With Church Headquarters': 'With Church Headquarters',
      'Assignment Made': 'Assignment Made',
      'Postponed Mission Start Date': 'Postponed Mission Start Date',
      'Entered the MTC': 'Entered the MTC',
      'Entered the Mission Field': 'Entered the Mission Field',
      'On Leave': 'On Leave',
      'Released from Mission Field': 'Released from Mission Field',
      'Canceled': 'Canceled',
    };
    const STATUS_ORDER = [
      '0-Not at this time', '1-Considering', '2-Papers Started', 'Candidate Completing Forms',
      "Ready for Bishop's Action", 'With the Stake President', 'With Church Headquarters',
      'Assignment Made', 'Postponed Mission Start Date', 'Entered the MTC',
      'Entered the Mission Field', 'On Leave', 'Released from Mission Field', 'Canceled',
    ];
    const statusIdx = (s: string) => { const i = STATUS_ORDER.indexOf(s); return i === -1 ? 0 : i; };

    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    for (const r of rows) {
      if (!r.name || !r.name.trim()) return json({ error: 'Row missing name' }, 400);
      if (!SECTION_TO_STATUS[r.section]) return json({ error: `Unknown section "${r.section}" for "${r.name}"` }, 400);
      for (const d of [r.mission_start, r.mission_end, r.received_date, r.assignment_made_date]) {
        if (d && !dateRe.test(d)) return json({ error: `Invalid date "${d}" for "${r.name}"` }, 400);
      }
    }

    const roster = (await db.prepare('SELECT id, first_name, last_name FROM ward_members WHERE active = 1').all<RosterMember>()).results;

    interface MissionaryRow {
      id: number; who: string; status: string; ward_member_id: number | null;
      report_date: string | null; release_date: string | null; mission_call: string | null;
      mission_end_estimated: string | null;
    }
    const allMissionaries = (await db.prepare(
      'SELECT id, who, status, ward_member_id, report_date, release_date, mission_call, mission_end_estimated FROM missionary_pipeline'
    ).all<MissionaryRow>()).results;

    const now = new Date().toISOString();
    const backfillStmts = [];
    for (const m of allMissionaries) {
      if (m.ward_member_id === null) {
        const match = matchRosterMember(m.who, roster);
        if (match) {
          backfillStmts.push(db.prepare('UPDATE missionary_pipeline SET ward_member_id = ? WHERE id = ?').bind(match.id, m.id));
          m.ward_member_id = match.id;
        }
      }
    }
    if (backfillStmts.length > 0) await db.batch(backfillStmts);

    const stmts = [];
    const changed: { name: string; section: string; action: string }[] = [];
    const unmatched: string[] = [];
    let created = 0, updated = 0;

    for (const row of rows) {
      const targetStatus = SECTION_TO_STATUS[row.section];
      // Released/Canceled list every past missionary (years back), so they only
      // close out records already in the pipeline — never create new ones, and
      // their date column (release/cancel date) must not overwrite report_date.
      const isTerminal = targetStatus === 'Released from Mission Field' || targetStatus === 'Canceled';
      const member = matchRosterMember(row.name, roster);
      if (!member) { if (!isTerminal) unmatched.push(row.name); continue; }
      const legalName = `${member.last_name}, ${member.first_name}`;
      const sectionDate = row.mission_start || row.received_date || row.assignment_made_date || null;
      const reportDate = isTerminal ? null : sectionDate;

      const existing = allMissionaries.find(m => m.ward_member_id === member.id && m.status !== 'Released from Mission Field')
        || allMissionaries.filter(m => m.ward_member_id === member.id).sort((a, b) => b.id - a.id)[0];

      if (existing) {
        const updates: Record<string, unknown> = {};
        if (statusIdx(targetStatus) > statusIdx(existing.status)) updates.status = targetStatus;
        if (row.mission && row.mission !== existing.mission_call) updates.mission_call = row.mission;
        if (reportDate && reportDate !== existing.report_date) updates.report_date = reportDate;
        if (row.mission_end && row.mission_end !== existing.mission_end_estimated) updates.mission_end_estimated = row.mission_end;
        if (targetStatus === 'Released from Mission Field' && !existing.release_date) updates.release_date = sectionDate || now.slice(0, 10);
        if (Object.keys(updates).length > 0) {
          const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
          stmts.push(db.prepare(`UPDATE missionary_pipeline SET ${setClause}, updated_at = ? WHERE id = ?`)
            .bind(...Object.values(updates), now, existing.id));
          updated++;
          changed.push({ name: legalName, section: row.section, action: 'updated' });
        }
      } else if (!isTerminal) {
        stmts.push(db.prepare(
          'INSERT INTO missionary_pipeline (who, status, ward_member_id, mission_call, report_date, mission_end_estimated, release_date, notes, next_steps, temple_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(legalName, targetStatus, member.id, row.mission, reportDate, row.mission_end, null, '', '', '', now, now));
        created++;
        changed.push({ name: legalName, section: row.section, action: 'created' });
      }
    }

    if (stmts.length > 0) await db.batch(stmts);
    return json({ ok: true, created, updated, changed, unmatched });
  }

  // Bulk temple-recommend-status sync (e.g. from an automated LCR export). Matches rows
  // to the roster by name using the same logic as the manual CSV import above.
  // Ordinance details from LCR's saved "Bishopric Hub – Ordinances" custom report
  // (baptism, priesthood office, endowment, sealing to spouse). Rows are matched by
  // last name + birth date first — far more reliable than names alone — then by
  // name. Only writes members whose values actually changed.
  // LCR's Patriarchal Blessing Status report, posted by the LCR sync. The report is the
  // only source of the status: "Yes" marks the member Received, "No" clears it.
  if (routeParts[0] === 'ward-members' && routeParts[1] === 'sync-patriarchal-blessings' && method === 'POST') {
    const body = await request.json() as { rows?: { name: string; gender?: string; age?: number | null; received: boolean }[] };
    const rows = (body.rows || []).slice(0, 3000);
    for (const r of rows) {
      if (!r.name || typeof r.name !== 'string' || r.name.length > 160) return json({ error: 'Each row needs a name (160 characters or fewer)' }, 400);
    }
    type PbMember = RosterMember & { preferred_first_name: string | null; preferred_last_name: string | null; birth_date: string | null; pb_status: string | null };
    const roster = (await db.prepare(
      'SELECT id, first_name, last_name, preferred_first_name, preferred_last_name, birth_date, pb_status FROM ward_members WHERE active = 1'
    ).all<PbMember>()).results;
    const todayIso = new Date().toISOString().slice(0, 10);
    const ageOf = (b: string | null) => {
      if (!b || !/^\d{4}-\d{2}-\d{2}/.test(b)) return null;
      const [y, m, d] = b.split('-').map(Number);
      const [ty, tm, td] = todayIso.split('-').map(Number);
      return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
    };
    const preferredKey = (m: PbMember) => `${(m.preferred_last_name || m.last_name).trim()}, ${(m.preferred_first_name || m.first_name).trim()}`.toLowerCase();
    const byPreferred = new Map<string, PbMember[]>();
    for (const m of roster) { const k = preferredKey(m); byPreferred.set(k, [...(byPreferred.get(k) || []), m]); }
    const ageFits = (m: PbMember, age: number | null | undefined) => {
      const a = ageOf(m.birth_date);
      return age == null || a === null || Math.abs(a - age) <= 1;
    };
    const unmatched: string[] = [];
    const updates: { id: number; status: string | null }[] = [];
    let matched = 0;
    for (const r of rows) {
      const exact = (byPreferred.get(r.name.trim().toLowerCase()) || []).filter(m => ageFits(m, r.age));
      const m = exact.length === 1 ? exact[0] : (() => { const f = matchRosterMember(r.name, roster); return f && ageFits(f, r.age) ? f : null; })();
      if (!m) { unmatched.push(r.name); continue; }
      matched++;
      const status = r.received ? 'Received' : null;
      if ((m.pb_status || null) !== status) updates.push({ id: m.id, status });
    }
    const now = new Date().toISOString();
    if (updates.length > 0) {
      await db.batch(updates.map(u => db.prepare('UPDATE ward_members SET pb_status = ?, updated_at = ?, updated_by = ? WHERE id = ?').bind(u.status, now, session.name, u.id)));
    }
    return json({ ok: true, matched, updated: updates.length, unmatched });
  }

  // LCR's Part-Member Households report, posted by the LCR sync; replaces the stored list.
  if (routeParts[0] === 'ward-members' && routeParts[1] === 'sync-part-member-households' && method === 'POST') {
    const body = await request.json() as { rows?: { household: string; relationships: string[] }[] };
    const rows = (body.rows || []).slice(0, 1000);
    for (const r of rows) {
      if (!r.household || typeof r.household !== 'string' || r.household.length > 160) return json({ error: 'Each row needs a household name (160 characters or fewer)' }, 400);
      if (!Array.isArray(r.relationships) || r.relationships.some(x => typeof x !== 'string' || x.length > 80)) return json({ error: `Bad relationships for "${r.household}"` }, 400);
    }
    const now = new Date().toISOString();
    await db.batch([
      db.prepare('DELETE FROM part_member_households'),
      ...rows.map(r => db.prepare('INSERT INTO part_member_households (household, relationships, synced_at) VALUES (?, ?, ?)')
        .bind(r.household.trim(), r.relationships.map(x => x.trim()).filter(Boolean).join('; '), now)),
    ]);
    return json({ ok: true, households: rows.length });
  }

  if (routeParts[0] === 'ward-members' && routeParts[1] === 'sync-ordinances' && method === 'POST') {
    type OrdRow = {
      name: string; full_name: string | null; birth_date: string | null;
      baptized?: boolean; baptism_date: string | null; priesthood_office: string | null; ordination_date: string | null;
      endowed: boolean; endowment_date: string | null; sealed_to_spouse: boolean; sealing_date: string | null;
      spouse_name?: string | null; sealed_to_current_spouse?: boolean; sealed_to_prior_spouse?: boolean;
      head_of_house?: string | null; household_position?: string | null; returned_missionary?: boolean;
    };
    const body = await request.json() as { rows?: OrdRow[] };
    const rows = (body.rows || []).slice(0, 2000);
    // LCR ordinance dates can be partial (month+year or year only).
    const dateRe = /^\d{4}(-\d{2}(-\d{2})?)?$/;
    for (const r of rows) {
      if (!r.name || !r.name.trim()) return json({ error: 'Row missing name' }, 400);
      if (r.birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(r.birth_date)) return json({ error: `Invalid birth date "${r.birth_date}" for "${r.name}"` }, 400);
      for (const d of [r.baptism_date, r.ordination_date, r.endowment_date, r.sealing_date]) {
        if (d && !dateRe.test(d)) return json({ error: `Invalid date "${d}" for "${r.name}"` }, 400);
      }
      if (r.priesthood_office && r.priesthood_office.length > 60) return json({ error: `Priesthood office too long for "${r.name}"` }, 400);
      if (r.spouse_name && r.spouse_name.length > 120) return json({ error: `Spouse name too long for "${r.name}"` }, 400);
      if ((r.head_of_house && r.head_of_house.length > 120) || (r.household_position && r.household_position.length > 60)) return json({ error: `Household details too long for "${r.name}"` }, 400);
    }

    interface OrdMember extends RosterMember {
      birth_date: string | null; baptized: number | null; baptism_date: string | null;
      priesthood_office: string | null; ordination_date: string | null; endowed: number | null;
      endowment_date: string | null; sealed_to_spouse: number | null; sealing_date: string | null;
      spouse_name: string | null; sealed_to_current_spouse: number | null; sealed_to_prior_spouse: number | null;
      head_of_house: string | null; household_position: string | null; returned_missionary: number | null;
      ordinances_synced_at: string | null;
    }
    const roster = (await db.prepare(
      `SELECT id, first_name, last_name, birth_date, baptized, baptism_date, priesthood_office, ordination_date,
              endowed, endowment_date, sealed_to_spouse, sealing_date,
              spouse_name, sealed_to_current_spouse, sealed_to_prior_spouse,
              head_of_house, household_position, returned_missionary, ordinances_synced_at
       FROM ward_members WHERE active = 1`
    ).all<OrdMember>()).results;

    const lastNameOf = (n: string) => (n.split(',')[0] || '').trim().toLowerCase();
    const findMember = (r: OrdRow): OrdMember | null => {
      if (r.birth_date) {
        const lasts = new Set([lastNameOf(r.name), lastNameOf(r.full_name || '')].filter(Boolean));
        const hits = roster.filter(m => m.birth_date === r.birth_date && lasts.has(m.last_name.trim().toLowerCase()));
        if (hits.length === 1) return hits[0];
      }
      for (const n of [r.full_name, r.name]) {
        if (!n) continue;
        const m = matchRosterMember(n, roster) as OrdMember | null;
        // A known birth date that disagrees means a different person with a similar name.
        if (m && !(m.birth_date && r.birth_date && m.birth_date !== r.birth_date)) return m;
      }
      return null;
    };

    const byMember = new Map<number, { member: OrdMember; rows: OrdRow[] }>();
    const unmatched: string[] = [];
    for (const r of rows) {
      const m = findMember(r);
      if (!m) { unmatched.push(r.name); continue; }
      const g = byMember.get(m.id);
      if (g) g.rows.push(r); else byMember.set(m.id, { member: m, rows: [r] });
    }

    const now = new Date().toISOString();
    const stmts = [];
    const changed: string[] = [];
    const ambiguous: string[] = [];
    let updated = 0;
    const describe = (label: string, flag: number | null, date: string | null) =>
      flag === null ? `${label} unknown` : flag ? `${label}${date ? ` ${date}` : ''}` : `not ${label.toLowerCase()}`;

    for (const { member: m, rows: memberRows } of byMember.values()) {
      if (memberRows.length > 1) {
        ambiguous.push(`${memberRows.map(r => r.name).join(' / ')} → ${m.first_name} ${m.last_name}`);
        continue;
      }
      const r = memberRows[0];
      const next = {
        baptized: r.baptized || r.baptism_date ? 1 : 0,
        baptism_date: r.baptism_date || null,
        priesthood_office: (r.priesthood_office || '').trim() || null,
        ordination_date: r.ordination_date || null,
        endowed: r.endowed || r.endowment_date ? 1 : 0,
        endowment_date: r.endowment_date || null,
        sealed_to_spouse: r.sealed_to_spouse || r.sealing_date ? 1 : 0,
        sealing_date: r.sealing_date || null,
        // Older sync scripts don't send these; leave what's stored alone in that case.
        ...(r.spouse_name !== undefined ? {
          spouse_name: (r.spouse_name || '').trim() || null,
          sealed_to_current_spouse: r.sealed_to_current_spouse ? 1 : 0,
          sealed_to_prior_spouse: r.sealed_to_prior_spouse ? 1 : 0,
        } : {}),
        ...(r.head_of_house !== undefined ? {
          head_of_house: (r.head_of_house || '').trim() || null,
          household_position: (r.household_position || '').trim() || null,
          returned_missionary: r.returned_missionary ? 1 : 0,
        } : {}),
      };
      const keys = Object.keys(next) as (keyof typeof next)[];
      const diff = keys.filter(k => (m[k] ?? null) !== next[k]);
      if (diff.length === 0) continue;
      stmts.push(db.prepare(
        `UPDATE ward_members SET ${keys.map(k => `${k} = ?`).join(', ')}, ordinances_synced_at = ?, updated_at = ? WHERE id = ?`
      ).bind(...keys.map(k => next[k]), now, now, m.id));
      updated++;
      // Every member counted as updated is listed, so the count always matches the names.
      const parts: string[] = [];
      if (!m.ordinances_synced_at) {
        parts.push('first ordinance record from LCR');
      } else {
        const has = (...ks: string[]) => ks.some(k => (diff as string[]).includes(k));
        if (has('baptized', 'baptism_date')) parts.push(`${describe('Baptized', m.baptized, m.baptism_date)} → ${describe('Baptized', next.baptized, next.baptism_date)}`);
        if (has('priesthood_office', 'ordination_date')) parts.push(`${m.priesthood_office || 'no office'} → ${next.priesthood_office || 'no office'}`);
        if (has('endowed', 'endowment_date')) parts.push(`${describe('Endowed', m.endowed, m.endowment_date)} → ${describe('Endowed', next.endowed, next.endowment_date)}`);
        if (has('sealed_to_spouse', 'sealing_date')) parts.push(`${describe('Sealed', m.sealed_to_spouse, m.sealing_date)} → ${describe('Sealed', next.sealed_to_spouse, next.sealing_date)}`);
        if (has('spouse_name')) parts.push(`spouse ${m.spouse_name || 'none'} → ${(next as { spouse_name?: string | null }).spouse_name || 'none'}`);
        if (has('sealed_to_current_spouse', 'sealed_to_prior_spouse')) parts.push('spouse sealing details');
        if (has('head_of_house', 'household_position')) parts.push('household details');
        if (has('returned_missionary')) parts.push((next as { returned_missionary?: number }).returned_missionary ? 'now a returned missionary' : 'no longer a returned missionary');
      }
      changed.push(`${m.first_name} ${m.last_name} (${parts.join('; ')})`);
    }
    for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
    return json({ ok: true, matched: byMember.size, updated, changed, unmatched, ambiguous });
  }

  if (routeParts[0] === 'ward-members' && routeParts[1] === 'import-recommends' && method === 'POST') {
    const body = await request.json() as {
      rows?: { name: string; recommend_type: string | null; recommend_expires: string | null }[];
    };
    const rows = (body.rows || []).slice(0, 1000);
    const typeRe = /^(Endowed|Limited)$/;
    const expiresRe = /^\d{4}-\d{2}$/;
    for (const r of rows) {
      if (!r.name || !r.name.trim()) return json({ error: 'Row missing name' }, 400);
      if (r.recommend_type && !typeRe.test(r.recommend_type)) return json({ error: `Invalid recommend_type "${r.recommend_type}" for "${r.name}"` }, 400);
      if (r.recommend_expires && !expiresRe.test(r.recommend_expires)) return json({ error: `Invalid recommend_expires "${r.recommend_expires}" for "${r.name}"` }, 400);
    }

    const roster = (await db.prepare(
      'SELECT id, first_name, last_name, recommend_type, recommend_expires FROM ward_members WHERE active = 1'
    ).all<RosterMember & { recommend_type: string | null; recommend_expires: string | null }>()).results;

    const now = new Date().toISOString();
    const stmts = [];
    const unmatched: string[] = [];
    const ambiguous: string[] = [];
    const changed: { name: string; from: string; to: string }[] = [];
    let matched = 0, updated = 0;

    // Group rows by the member they match first. Two rows hitting one member used
    // to overwrite each other on alternate runs (e.g. LCR listing someone with both
    // an old limited-use and a new endowed recommend), counting as "changed" forever.
    type Row = typeof rows[number];
    const byMember = new Map<number, { member: typeof roster[number]; rows: Row[] }>();
    for (const row of rows) {
      const member = matchRosterMember(row.name, roster);
      if (!member) { unmatched.push(row.name); continue; }
      const group = byMember.get(member.id);
      if (group) group.rows.push(row);
      else byMember.set(member.id, { member: member as typeof roster[number], rows: [row] });
    }

    const rank = (r: Row) => [r.recommend_type === 'Endowed' ? 1 : 0, r.recommend_expires || ''] as const;
    const describe = (type: string | null, expires: string | null) => type ? `${type} ${expires || '(no date)'}` : '(none)';

    for (const { member, rows: memberRows } of byMember.values()) {
      const names = new Set(memberRows.map(r => r.name.trim().toLowerCase()));
      if (names.size > 1) {
        // Different people's names resolving to one member: we can't tell whose
        // status is right, so update nobody and report it.
        ambiguous.push(`${memberRows.map(r => r.name).join(' / ')} → ${member.first_name} ${member.last_name}`);
        continue;
      }
      // Same person listed twice: Endowed beats Limited, then the later expiration.
      const row = memberRows.reduce((best, r) => {
        const [tb, eb] = rank(best);
        const [tr, er] = rank(r);
        return tr > tb || (tr === tb && er > eb) ? r : best;
      });
      matched++;
      // Only write when something actually differs. Older rows can hold '' where
      // the sync writes null, so normalize both sides before comparing — otherwise
      // those members would count as "updated" on every run, forever.
      const type = row.recommend_type || null;
      const expires = row.recommend_expires || null;
      const oldType = member.recommend_type || null;
      const oldExpires = member.recommend_expires || null;
      if (type === oldType && expires === oldExpires) continue;
      // LCR's report sometimes returns only a member's old limited-use recommend
      // instead of their endowed one (Sedona Kirby flipped between the two every few
      // days). Endowed beats Limited, so never let an older/equal Limited row
      // overwrite a stored Endowed recommend.
      if (oldType === 'Endowed' && type === 'Limited' && (expires || '') <= (oldExpires || '')) continue;
      stmts.push(
        db.prepare('UPDATE ward_members SET recommend_type = ?, recommend_expires = ?, updated_at = ?, updated_by = ? WHERE id = ?')
          .bind(type, expires, now, session.name, member.id)
      );
      changed.push({ name: `${member.first_name} ${member.last_name}`, from: describe(oldType, oldExpires), to: describe(type, expires) });
      updated++;
    }
    if (stmts.length > 0) await db.batch(stmts);
    return json({ ok: true, matched, updated, unmatched, ambiguous, changed });
  }
  return null;
}
