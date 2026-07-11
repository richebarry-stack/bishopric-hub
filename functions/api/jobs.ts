// Shared daily automation jobs, run via a "lazy cron" (functions/api/[[route]].ts
// triggers this once per 24h on any authenticated request, since Cloudflare Pages
// Functions don't support scheduled/cron triggers directly).

interface JobResult {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

/** Regenerates the `conducting` field on sacrament_themes for the next 12 months from rotating_assignments. */
export async function syncConduct(db: D1Database, todayStr: string): Promise<JobResult> {
  const usersResult = await db.prepare('SELECT name, church_role FROM users').all();
  const roleByLastName = new Map<string, string>();
  for (const u of usersResult.results as { name: string; church_role: string }[]) {
    if (!u.name) continue;
    const lastName = u.name.trim().split(/\s+/).pop();
    if (lastName) roleByLastName.set(lastName, u.church_role || '');
  }
  const formatConductor = (rawName: string): string => {
    const lastName = rawName.trim().split(/\s+/).pop() || rawName;
    const title = roleByLastName.get(lastName) === 'Bishop' ? 'Bishop' : 'Brother';
    return `${title} ${lastName}`;
  };

  const assignmentMap = new Map<string, string>(); // month abbr -> formatted name
  const assignmentsResult = await db.prepare('SELECT month, plan_conduct FROM rotating_assignments').all();
  for (const a of assignmentsResult.results as { month: string; plan_conduct: string }[]) {
    if (a.month && a.plan_conduct) {
      const key = a.month.trim().slice(0, 3);
      assignmentMap.set(key.charAt(0).toUpperCase() + key.slice(1).toLowerCase(), formatConductor(a.plan_conduct.trim()));
    }
  }
  if (assignmentMap.size === 0) return { ok: true, created: 0, updated: 0 };
  const TITLED_RE = /^(Bishop|Brother|Sister)\s/i;

  const themesResult = await db.prepare('SELECT id, meeting_date, conducting FROM sacrament_themes').all();
  const themeMap = new Map<string, { id: number; conducting: string | null }>();
  for (const t of themesResult.results as { id: number; meeting_date: string; conducting: string | null }[]) {
    if (t.meeting_date) themeMap.set(t.meeting_date.slice(0, 10), { id: t.id, conducting: t.conducting });
  }

  const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n: number) => String(n).padStart(2, '0');
  const now = new Date().toISOString();
  const [startYear, startMonthNum] = todayStr.split('-').map(Number);

  const stmts: D1PreparedStatement[] = [];
  let created = 0, updated = 0;

  for (let i = 0; i < 12; i++) {
    const monthIdx = (startMonthNum - 1 + i) % 12; // 0-based
    const year = startYear + Math.floor((startMonthNum - 1 + i) / 12);
    const assignment = assignmentMap.get(MONTH_ABBR[monthIdx]);
    if (!assignment) continue;

    const firstDay = new Date(year, monthIdx, 1);
    const firstSundayDay = 1 + (7 - firstDay.getDay()) % 7;

    for (let day = firstSundayDay; day <= 37; day += 7) {
      const probe = new Date(year, monthIdx, day);
      if (probe.getMonth() !== monthIdx) break;
      const dateStr = `${year}-${pad(monthIdx + 1)}-${pad(day)}`;
      if (dateStr < todayStr) continue;

      const existing = themeMap.get(dateStr);
      if (existing) {
        const cur = (existing.conducting || '').trim();
        if (!cur) {
          stmts.push(db.prepare('UPDATE sacrament_themes SET conducting = ?, updated_at = ? WHERE id = ?').bind(assignment, now, existing.id));
          updated++;
        } else if (!TITLED_RE.test(cur)) {
          stmts.push(db.prepare('UPDATE sacrament_themes SET conducting = ?, updated_at = ? WHERE id = ?').bind(formatConductor(cur), now, existing.id));
          updated++;
        }
      } else {
        stmts.push(db.prepare('INSERT INTO sacrament_themes (meeting_date, conducting, theme, references_text, meeting_link, stake_business, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(dateStr, assignment, '', '', '', '', now));
        created++;
        themeMap.set(dateStr, { id: -1, conducting: assignment });
      }
    }
  }

  if (stmts.length > 0) await db.batch(stmts);
  return { ok: true, created, updated };
}

/** Purges expired login sessions. */
export async function cleanupSessions(db: D1Database): Promise<JobResult> {
  const result = await db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
  return { ok: true, deleted: result.meta.changes ?? 0 };
}

/** Purges login-attempt records older than a day (the rate-limit window is 15 minutes). */
export async function cleanupLoginAttempts(db: D1Database): Promise<JobResult> {
  const result = await db.prepare("DELETE FROM login_attempts WHERE attempted_at < datetime('now', '-1 day')").run();
  return { ok: true, deleted: result.meta.changes ?? 0 };
}

/** Purges stale presence rows. Freshness for display is already enforced at read
 * time (<90s); this is just table hygiene for users who never come back. */
export async function cleanupPresence(db: D1Database): Promise<JobResult> {
  // presence.updated_at is stamped with JS ISO strings (see the /api/presence handler),
  // so the cutoff must be computed the same way rather than with SQLite's datetime().
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const result = await db.prepare('DELETE FROM presence WHERE updated_at < ?').bind(cutoff).run();
  return { ok: true, deleted: result.meta.changes ?? 0 };
}

// Duplicated from the frontend's computeAge/computeYouthAge in
// src/pages/InterviewPipeline.tsx (pure date math, same reasoning as the
// hub/calling constants already duplicated server-side in functions/api/[[route]].ts).
function computeAge(birthDate: string, asOf: Date): number {
  const bd = new Date(birthDate.slice(0, 10) + 'T12:00:00');
  let age = asOf.getFullYear() - bd.getFullYear();
  const m = asOf.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < bd.getDate())) age--;
  return age;
}

// Youth eligibility ends September 1 of the year they turn 18.
function computeYouthAge(birthDate: string, now: Date): number | null {
  const bd = new Date(birthDate.slice(0, 10) + 'T12:00:00');
  const ageOutDate = new Date(bd.getFullYear() + 18, 8, 1);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (today >= ageOutDate) return null;
  return computeAge(birthDate, now);
}

/** Ensures every active youth (ages 12-17) has exactly one linked interview_pipeline
 * row, bucketed into 'Youth 12-15' or 'Youth 16-17', correcting the bucket as they
 * age. Both brackets get an interview every 6 months per the Handbook — 12-15
 * alternates between the bishop and an assigned counselor, 16-17 is the bishop both
 * times — so new rows default assigned_to to the bishop as a starting point; the
 * bishopric reassigns to the counselor for the 12-15 group's alternate interview.
 * Adopts a matching unlinked legacy row by name if one exists, otherwise creates a
 * new one. Never touches status/dates/assigned_to on already-existing rows. */
export async function syncYouthInterviews(db: D1Database): Promise<JobResult> {
  const now = new Date();
  const nowIso = now.toISOString();

  const membersResult = await db.prepare(
    "SELECT id, last_name, first_name, birth_date FROM ward_members WHERE active = 1 AND birth_date IS NOT NULL AND birth_date != ''"
  ).all<{ id: number; last_name: string; first_name: string; birth_date: string }>();

  const existingResult = await db.prepare(
    "SELECT id, ward_member_id, member, type_of_interview FROM interview_pipeline WHERE type_of_interview IN ('Youth 12-15', 'Youth 16-17')"
  ).all<{ id: number; ward_member_id: number | null; member: string; type_of_interview: string }>();

  const bishop = await db.prepare("SELECT name FROM users WHERE church_role = 'Bishop' LIMIT 1").first<{ name: string }>();
  const bishopName = bishop?.name ?? '';

  const linkedByWardMemberId = new Map<number, { id: number; type_of_interview: string; member: string }>();
  const unlinkedByName = new Map<string, { id: number }>();
  for (const row of existingResult.results) {
    if (row.ward_member_id) linkedByWardMemberId.set(row.ward_member_id, { id: row.id, type_of_interview: row.type_of_interview, member: row.member });
    else unlinkedByName.set(row.member.trim().toLowerCase(), { id: row.id });
  }

  const stmts: D1PreparedStatement[] = [];
  let created = 0, updated = 0, linked = 0;

  for (const wm of membersResult.results) {
    const age = computeYouthAge(wm.birth_date, now);
    if (age === null || age < 12) continue;
    const type = age >= 16 ? 'Youth 16-17' : 'Youth 12-15';
    const legalName = wm.first_name ? `${wm.last_name}, ${wm.first_name}` : wm.last_name;

    const linkedRow = linkedByWardMemberId.get(wm.id);
    if (linkedRow) {
      if (linkedRow.type_of_interview !== type || linkedRow.member !== legalName) {
        stmts.push(db.prepare('UPDATE interview_pipeline SET type_of_interview = ?, member = ?, updated_at = ? WHERE id = ?').bind(type, legalName, nowIso, linkedRow.id));
        updated++;
      }
      continue;
    }

    const unlinkedRow = unlinkedByName.get(legalName.trim().toLowerCase());
    if (unlinkedRow) {
      stmts.push(db.prepare('UPDATE interview_pipeline SET ward_member_id = ?, type_of_interview = ?, updated_at = ? WHERE id = ?').bind(wm.id, type, nowIso, unlinkedRow.id));
      linked++;
      continue;
    }

    stmts.push(db.prepare(
      'INSERT INTO interview_pipeline (member, type_of_interview, status, assigned_to, ward_member_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(legalName, type, 'Unassigned', bishopName, wm.id, nowIso, nowIso));
    created++;
  }

  if (stmts.length > 0) await db.batch(stmts);
  return { ok: true, created, updated, linked };
}

/** Keeps a "Setting Apart" interview_pipeline row in sync with every calling_pipeline
 * row that has reached Sustained/Set apart but hasn't had its setting apart recorded
 * in LCR yet. Auto-created rows are Unassigned (the bishopric assigns each one
 * manually, since who performs it varies by calling) and linked via calling_id.
 * Removed once the calling leaves that state (recorded, released, deleted, or moved
 * back before Sustained) or the calling row itself is deleted. Manually-created
 * "Setting Apart" rows (calling_id NULL) are never touched. */
export async function syncSettingApartInterviews(db: D1Database): Promise<JobResult> {
  const nowIso = new Date().toISOString();

  const desiredResult = await db.prepare(
    "SELECT id, member FROM calling_pipeline WHERE type = 'Calling' AND status IN ('5. Sustained', '6. Set apart') AND set_apart_recorded = 0"
  ).all<{ id: number; member: string }>();
  const desired = new Map(desiredResult.results.map(r => [r.id, r.member.replace(/\*\*/g, '').trim()]));

  const existingResult = await db.prepare(
    "SELECT id, calling_id FROM interview_pipeline WHERE type_of_interview = 'Setting Apart' AND calling_id IS NOT NULL"
  ).all<{ id: number; calling_id: number }>();

  const stmts: D1PreparedStatement[] = [];
  let created = 0, removed = 0;

  const existingCallingIds = new Set(existingResult.results.map(r => r.calling_id));
  for (const [callingId, member] of desired) {
    if (existingCallingIds.has(callingId)) continue;
    stmts.push(db.prepare(
      'INSERT INTO interview_pipeline (member, type_of_interview, status, assigned_to, setup_status, calling_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(member, 'Setting Apart', 'Unassigned', '', 'Not started', callingId, nowIso, nowIso));
    created++;
  }

  for (const row of existingResult.results) {
    if (!desired.has(row.calling_id)) {
      stmts.push(db.prepare('DELETE FROM interview_pipeline WHERE id = ?').bind(row.id));
      removed++;
    }
  }

  if (stmts.length > 0) await db.batch(stmts);
  return { ok: true, created, removed };
}

// Aaronic Priesthood advancement age -> ordinance type, per General Handbook guidance.
const ADVANCEMENT_AGES: Record<number, string> = { 12: 'Deacon', 14: 'Teacher', 16: 'Priest' };

/** In December, gets ahead of next year's Aaronic Priesthood advancements (Deacon,
 * Teacher, Priest) by auto-tracking every active young man who will turn 12, 14, or
 * 16 next calendar year — a heads-up a month before the year turns, rather than
 * waiting for the "suggested this year" box on the Ordinances page to pick them up
 * in January. Idempotent (skips already-tracked members); a no-op outside December. */
export async function syncOrdinanceCandidates(db: D1Database): Promise<JobResult> {
  const now = new Date();
  if (now.getMonth() !== 11) return { ok: true, skipped: 'not December' };
  const nextYear = now.getFullYear() + 1;
  const nowIso = now.toISOString();

  const membersResult = await db.prepare(
    "SELECT first_name, last_name, birth_date FROM ward_members WHERE active = 1 AND gender = 'M' AND birth_date IS NOT NULL AND birth_date != ''"
  ).all<{ first_name: string; last_name: string; birth_date: string }>();

  const existingResult = await db.prepare(
    "SELECT member_name, ordinance_type FROM ordinances WHERE ordinance_type IN ('Deacon', 'Teacher', 'Priest')"
  ).all<{ member_name: string; ordinance_type: string }>();
  const tracked = new Set(existingResult.results.map(r => `${r.member_name.trim().toLowerCase()}|${r.ordinance_type}`));

  const stmts: D1PreparedStatement[] = [];
  let created = 0;
  for (const wm of membersResult.results) {
    const birthYear = parseInt(wm.birth_date.slice(0, 4), 10);
    if (!birthYear) continue;
    const ordinanceType = ADVANCEMENT_AGES[nextYear - birthYear];
    if (!ordinanceType) continue;
    const legalName = wm.first_name ? `${wm.last_name}, ${wm.first_name}` : wm.last_name;
    if (tracked.has(`${legalName.trim().toLowerCase()}|${ordinanceType}`)) continue;
    stmts.push(db.prepare(
      'INSERT INTO ordinances (member_name, ordinance_type, status, updated_at) VALUES (?, ?, ?, ?)'
    ).bind(legalName, ordinanceType, 'Upcoming', nowIso));
    created++;
  }
  if (stmts.length > 0) await db.batch(stmts);
  return { ok: true, created };
}

export async function runDailyJobs(db: D1Database): Promise<Record<string, JobResult>> {
  const todayStr = new Date().toISOString().slice(0, 10);
  const results: Record<string, JobResult> = {};

  try { results.syncConduct = await syncConduct(db, todayStr); }
  catch (e) { results.syncConduct = { ok: false, error: e instanceof Error ? e.message : String(e) }; }

  try { results.cleanupSessions = await cleanupSessions(db); }
  catch (e) { results.cleanupSessions = { ok: false, error: e instanceof Error ? e.message : String(e) }; }

  try { results.cleanupLoginAttempts = await cleanupLoginAttempts(db); }
  catch (e) { results.cleanupLoginAttempts = { ok: false, error: e instanceof Error ? e.message : String(e) }; }

  try { results.cleanupPresence = await cleanupPresence(db); }
  catch (e) { results.cleanupPresence = { ok: false, error: e instanceof Error ? e.message : String(e) }; }

  try { results.syncYouthInterviews = await syncYouthInterviews(db); }
  catch (e) { results.syncYouthInterviews = { ok: false, error: e instanceof Error ? e.message : String(e) }; }

  try { results.syncSettingApartInterviews = await syncSettingApartInterviews(db); }
  catch (e) { results.syncSettingApartInterviews = { ok: false, error: e instanceof Error ? e.message : String(e) }; }

  try { results.syncOrdinanceCandidates = await syncOrdinanceCandidates(db); }
  catch (e) { results.syncOrdinanceCandidates = { ok: false, error: e instanceof Error ? e.message : String(e) }; }

  return results;
}
