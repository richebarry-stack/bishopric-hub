// Feature helpers used by several routes: interview slot overlap rules, schedule clashes,
// member-care sync, calling pipeline history and the covenant path agenda.
import { COUNCIL_TOPICS, type CovenantAgendaEntry, type CovenantMember, type CovenantSettings, DEFAULT_COVENANT_SETTINGS, buildCovenantPath } from '../../../shared/covenantPath';
import { type RosterMemberNames, matchRosterMemberExact } from '../nameMatch';
import { json } from './core';

// Calendars members can book interviews on (/book-interview).
export const INTERVIEW_CALENDARS = ['Bishop', 'First Counselor', 'Second Counselor'];

// An interview slot is unavailable while its calendar has another appointment then,
// another booked interview slot on the same calendar overlaps it, or (for the Bishop)
// a reserved tithing declaration overlaps it. Times are zero-padded "HH:MM" text.
export const INTERVIEW_SLOT_BUSY = (s: string) => `(EXISTS (
    SELECT 1 FROM schedule_entries e
    WHERE substr(e.date, 1, 10) = substr(${s}.date, 1, 10)
      AND e.calendars LIKE '%"' || ${s}.calendar || '"%'
      AND e.start_time < ${s}.end_time AND e.end_time > ${s}.start_time
      AND (${s}.schedule_entry_id IS NULL OR e.id != ${s}.schedule_entry_id))
  OR EXISTS (
    SELECT 1 FROM interview_slots o
    WHERE o.id != ${s}.id AND o.calendar = ${s}.calendar AND o.reserved_by IS NOT NULL
      AND substr(o.date, 1, 10) = substr(${s}.date, 1, 10)
      AND o.start_time < ${s}.end_time AND o.end_time > ${s}.start_time)
  OR (${s}.calendar = 'Bishop' AND EXISTS (
    SELECT 1 FROM tithing_declaration_slots t
    WHERE t.reserved_by IS NOT NULL AND substr(t.date, 1, 10) = substr(${s}.date, 1, 10)
      AND t.start_time < ${s}.end_time AND t.end_time > ${s}.start_time)))`;

/** Today's date and the current HH:MM in the ward's time zone. */

// New & returning member care: move-ins typed on Current Bishopric Meeting (from this
// date on) are added automatically. An item edited in the last few minutes is left
// alone so a half-typed name doesn't get copied.
export const MEMBER_CARE_SYNC_FROM = '2026-10-01';

export async function syncMemberCareFromMoveIns(db: D1Database): Promise<void> {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { results } = await db.prepare(
    `SELECT id, meeting_date, item FROM bishopric_move_items
     WHERE kind = 'move_in' AND trim(item) <> '' AND substr(meeting_date, 1, 10) >= ?
       AND (updated_at IS NULL OR replace(updated_at, ' ', 'T') <= ?)
       AND id NOT IN (SELECT move_item_id FROM member_care WHERE move_item_id IS NOT NULL)`
  ).bind(MEMBER_CARE_SYNC_FROM, cutoff).all<{ id: number; meeting_date: string; item: string }>();
  if (results.length === 0) return;
  const now = new Date().toISOString();
  await db.batch(results.map(r => db.prepare(
    `INSERT OR IGNORE INTO member_care (member_name, kind, added_date, move_item_id, checklist, notes, archived, created_by, updated_at, updated_by)
     VALUES (?, 'Move-in', ?, ?, '{}', '', 0, 'Current Bishopric Meeting', ?, 'Current Bishopric Meeting')`
  ).bind(r.item.trim(), r.meeting_date.slice(0, 10), r.id, now)));
}

// Tithing declarations are held with the Bishop, so his calendar and the tithing
// slots must never double-book each other (hub suggestion #32). Times are
// zero-padded "HH:MM" text, so string comparison orders them correctly.
export const BISHOP_ENTRY_OVERLAPS_SLOT = (slot: string) => `EXISTS (
  SELECT 1 FROM schedule_entries e
  WHERE substr(e.date, 1, 10) = substr(${slot}.date, 1, 10) AND e.calendars LIKE '%"Bishop"%'
    AND e.start_time < ${slot}.end_time AND e.end_time > ${slot}.start_time)`;

export const RESERVED_SLOT_OVERLAPS_SLOT = (slot: string) => `EXISTS (
  SELECT 1 FROM tithing_declaration_slots o
  WHERE o.id != ${slot}.id AND o.reserved_by IS NOT NULL
    AND substr(o.date, 1, 10) = substr(${slot}.date, 1, 10)
    AND o.start_time < ${slot}.end_time AND o.end_time > ${slot}.start_time)`;

export function fmtTime12(t: string): string {
  const [hh, mm] = t.split(':').map(Number);
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`;
}

// Returns a 409 when saving this Bishop appointment / tithing slot would double-book.
// Bishop appointments may cover OPEN slots (they just drop off the public page) but
// not reserved ones; slots may not overlap other slots or Bishop appointments.
export async function scheduleClash(
  db: D1Database, tableName: string, body: Record<string, unknown>, recordId?: string,
): Promise<Response | null> {
  if (tableName !== 'schedule-entries' && tableName !== 'tithing-declarations') return null;
  const table = tableName === 'schedule-entries' ? 'schedule_entries' : 'tithing_declaration_slots';
  const existing = recordId
    ? await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(recordId).first<Record<string, unknown>>()
    : null;
  const merged = { ...(existing ?? {}), ...body };
  const date = String(merged.date ?? '').slice(0, 10);
  const start = String(merged.start_time ?? '');
  const end = String(merged.end_time ?? '');
  if (!date || !start || !end) return null;
  const id = recordId ? Number(recordId) : -1;
  // Compare values, not which keys were sent — editors resend the full row, and only
  // a real move should re-check, so editing a title or location doesn't trip over an
  // overlap that predates this rule.
  const timeChanged = !existing || date !== String(existing.date ?? '').slice(0, 10)
    || start !== existing.start_time || end !== existing.end_time;

  if (tableName === 'schedule-entries') {
    if (!timeChanged && merged.calendars === existing?.calendars) return null;
    if (!String(merged.calendars ?? '').includes('"Bishop"')) return null;
    const slot = await db.prepare(
      `SELECT reserved_by, start_time FROM tithing_declaration_slots
       WHERE substr(date, 1, 10) = ? AND reserved_by IS NOT NULL AND start_time < ? AND end_time > ? LIMIT 1`
    ).bind(date, end, start).first<{ reserved_by: string; start_time: string }>();
    if (slot) return json({ error: `That time overlaps ${slot.reserved_by}'s tithing declaration at ${fmtTime12(slot.start_time)}. Pick another time, or move or unreserve that slot first.` }, 409);
    return null;
  }

  const newlyReserved = !!merged.reserved_by && !existing?.reserved_by;
  if (timeChanged || newlyReserved) {
    const other = await db.prepare(
      `SELECT reserved_by, start_time FROM tithing_declaration_slots
       WHERE id != ? AND substr(date, 1, 10) = ? AND start_time < ? AND end_time > ?
         ${timeChanged ? '' : 'AND reserved_by IS NOT NULL'} LIMIT 1`
    ).bind(id, date, end, start).first<{ reserved_by: string | null; start_time: string }>();
    if (other) return json({ error: `This slot overlaps ${other.reserved_by ? `${other.reserved_by}'s tithing declaration` : 'another tithing slot'} at ${fmtTime12(other.start_time)}. Pick a different time.` }, 409);
    const entry = await db.prepare(
      `SELECT title, start_time FROM schedule_entries
       WHERE substr(date, 1, 10) = ? AND calendars LIKE '%"Bishop"%' AND start_time < ? AND end_time > ? LIMIT 1`
    ).bind(date, end, start).first<{ title: string; start_time: string }>();
    if (entry) return json({ error: `This slot overlaps the Bishop's "${entry.title}" appointment at ${fmtTime12(entry.start_time)}. Pick a different time, or move that appointment first.` }, 409);
  }
  return null;
}

// The Calling Pipeline's Member field is free text, so entries get typed as
// "Richard Talbot" as often as "Talbot, Richard" — and an entry that isn't linked to
// a ward_member_id is invisible to everything that matches by member (All Callings'
// release tracking, the callings sync, My Actions). Resolve the typed name against the
// roster on save, accepting either name order and preferred names. Exact variants only:
// placeholder rows like "Replacement for Richard Talbot" must stay unlinked.
//
// A resolvable name wins over whatever ward_member_id came in, so retyping the Member
// field to a different person re-points the row instead of leaving it linked to the
// previous one. An unresolvable name leaves the incoming id untouched.
export async function linkCallingMember(db: D1Database, body: Record<string, unknown>): Promise<void> {
  const member = typeof body.member === 'string' ? body.member : '';
  if (!member.trim()) return;
  const roster = (await db.prepare(
    'SELECT id, first_name, last_name, preferred_first_name, preferred_last_name FROM ward_members WHERE active = 1'
  ).all<RosterMemberNames>()).results;
  const match = matchRosterMemberExact(member, roster);
  if (match) body.ward_member_id = match.id;
}

export const CALLING_PIPELINE_HISTORY_LABELS: Record<string, string> = {
  member: 'Member', calling: 'Calling', status: 'Status', assigned_to: 'Assigned To',
  organization: 'Organization', type: 'Type', sustain_recorded: 'Sustain recorded in LCR',
  set_apart_recorded: 'Setting apart recorded in LCR', release_recorded: 'Release recorded in LCR',
  notes: 'Notes',
};

export const CALLING_PIPELINE_HISTORY_FIELDS = Object.keys(CALLING_PIPELINE_HISTORY_LABELS);

export const CALLING_PIPELINE_BOOLEAN_FIELDS = new Set(['sustain_recorded', 'set_apart_recorded', 'release_recorded']);

export function formatCallingPipelineHistoryValue(field: string, value: unknown): string {
  if (CALLING_PIPELINE_BOOLEAN_FIELDS.has(field)) return value ? 'Yes' : 'No';
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

// Logs one row per changed field so the edit modal can show "what changed, by whom,
// and when" rather than just the most recent editor. Only tracks the small set of
// user-editable fields above — internal bookkeeping columns (ward_member_id,
// updated_at/by, sustained_date) are deliberately excluded as noise.
export async function logCallingPipelineHistory(
  db: D1Database, callingId: number, before: Record<string, unknown> | null,
  after: Record<string, unknown>, changedBy: string, now: string,
): Promise<void> {
  const stmts = [];
  for (const field of CALLING_PIPELINE_HISTORY_FIELDS) {
    if (!(field in after)) continue;
    const oldValue = before ? before[field] : undefined;
    const newValue = after[field];
    if (before && (oldValue ?? '') === (newValue ?? '')) continue;
    stmts.push(db.prepare(
      'INSERT INTO calling_pipeline_history (calling_id, changed_at, changed_by, field, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      callingId, now, changedBy, CALLING_PIPELINE_HISTORY_LABELS[field],
      before ? formatCallingPipelineHistoryValue(field, oldValue) : null,
      formatCallingPipelineHistoryValue(field, newValue),
    ));
  }
  if (stmts.length > 0) await db.batch(stmts);
}

export async function activeCovenantAgenda(db: D1Database): Promise<CovenantAgendaEntry[]> {
  const [agenda, members, households, pipeline, exclusions, settingsRow, tzRow] = await Promise.all([
    db.prepare('SELECT * FROM covenant_path_agenda ORDER BY id').all<{ id: number; category: string; subject_key: string; subject_name: string; note: string; for_bishopric: number; for_ward_council: number }>(),
    db.prepare(`SELECT id, first_name, last_name, preferred_first_name, preferred_last_name, active, out_of_ward, birth_date, gender,
      baptized, priesthood_office, endowed, recommend_type, recommend_expires, spouse_name, sealed_to_current_spouse,
      head_of_house, returned_missionary, pb_status FROM ward_members WHERE active = 1`).all<CovenantMember>(),
    db.prepare('SELECT household, relationships FROM part_member_households').all<{ household: string; relationships: string }>(),
    db.prepare('SELECT ward_member_id FROM missionary_pipeline WHERE ward_member_id IS NOT NULL').all<{ ward_member_id: number }>(),
    db.prepare('SELECT category, subject_key FROM covenant_path_exclusions').all<{ category: string; subject_key: string }>(),
    db.prepare("SELECT value FROM ui_settings WHERE key = 'covenant_path_settings'").first<{ value: string }>(),
    db.prepare("SELECT value FROM ui_settings WHERE key = 'app_timezone'").first<{ value: string }>(),
  ]);
  if (agenda.results.length === 0) return [];
  let settings: CovenantSettings = DEFAULT_COVENANT_SETTINGS;
  try { if (settingsRow?.value) settings = { ...DEFAULT_COVENANT_SETTINGS, ...JSON.parse(settingsRow.value) }; } catch { /* keep defaults */ }
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tzRow?.value || 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const categories = buildCovenantPath(members.results, households.results, new Set(pipeline.results.map(p => p.ward_member_id)), settings, today);
  const hidden = new Set(exclusions.results.map(e => `${e.category}|${e.subject_key}`));
  const out: CovenantAgendaEntry[] = [];
  const stale: number[] = [];
  for (const a of agenda.results) {
    const cat = categories.find(c => c.id === a.category);
    const item = cat?.items.find(i => i.key === a.subject_key);
    if (!cat || !item || hidden.has(`${a.category}|${a.subject_key}`) || (!a.for_bishopric && !a.for_ward_council)) { stale.push(a.id); continue; }
    out.push({
      id: a.id, category: a.category, categoryTitle: cat.title, subject_key: a.subject_key,
      subject_name: item.name, detail: item.detail, topic: COUNCIL_TOPICS[a.category] || 'Ward council discussion',
      note: a.note || '', for_bishopric: a.for_bishopric, for_ward_council: a.for_ward_council,
    });
  }
  if (stale.length > 0) await db.batch(stale.map(id => db.prepare('DELETE FROM covenant_path_agenda WHERE id = ?').bind(id)));
  return out;
}
