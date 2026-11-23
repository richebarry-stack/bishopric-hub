// Which tables exist and which hub/calling can reach them.
import { json } from './core';

export const TABLES: Record<string, { name: string; orderBy?: string }> = {
  'calling-pipeline': { name: 'calling_pipeline', orderBy: 'id DESC' },
  'member-callings': { name: 'member_callings', orderBy: 'ward_member_id ASC' },
  'unfilled-callings': { name: 'unfilled_callings', orderBy: 'organization ASC, calling ASC' },
  'roster-review-flags': { name: 'roster_review_flags', orderBy: 'flagged_at ASC' },
  'interview-pipeline': { name: 'interview_pipeline', orderBy: 'id DESC' },
  'tasks': { name: 'tasks', orderBy: 'done ASC, created_date DESC' },
  'rotating-assignments': { name: 'rotating_assignments', orderBy: 'id ASC' },
  'bishopric-meetings': { name: 'bishopric_meetings', orderBy: 'date DESC' },
  'bishopric-agenda-items': { name: 'bishopric_agenda_items', orderBy: 'meeting_date ASC, position ASC, id ASC' },
  'bishopric-move-items': { name: 'bishopric_move_items', orderBy: 'meeting_date ASC, kind ASC, position ASC, id ASC' },
  'out-of-town': { name: 'out_of_town', orderBy: 'start_date ASC' },
  'sacrament-speakers': { name: 'sacrament_speakers', orderBy: 'meeting_date DESC, speaking_order ASC' },
  'prayers': { name: 'prayers', orderBy: 'meeting_date DESC' },
  'sacrament-music': { name: 'sacrament_music', orderBy: 'meeting_date DESC' },
  'sacrament-themes': { name: 'sacrament_themes', orderBy: 'meeting_date DESC' },
  'member-needs': { name: 'member_needs', orderBy: 'resolved ASC, id DESC' },
  'calendaring': { name: 'calendaring', orderBy: 'dates DESC' },
  'missionary-pipeline': { name: 'missionary_pipeline', orderBy: 'id DESC' },
  'babies': { name: 'babies', orderBy: 'due_birth_date ASC' },
  'schedule-entries': { name: 'schedule_entries', orderBy: 'date ASC, start_time ASC' },
  'sacrament-announcements': { name: 'sacrament_announcements', orderBy: 'meeting_date DESC' },
  'prayer-others': { name: 'prayer_others', orderBy: 'id ASC' },
  'sacrament-agenda-notes': { name: 'sacrament_agenda_notes', orderBy: 'position ASC' },
  'sacrament-ward-business': { name: 'sacrament_ward_business', orderBy: 'meeting_date DESC' },
  'sacrament-agenda-exclusions': { name: 'sacrament_agenda_exclusions', orderBy: 'id ASC' },
  'important-links': { name: 'important_links', orderBy: 'id ASC' },
  'ward-members': { name: 'ward_members', orderBy: 'last_name ASC, first_name ASC' },
  'covenant-path-exclusions': { name: 'covenant_path_exclusions', orderBy: 'id ASC' },
  'covenant-path-agenda': { name: 'covenant_path_agenda', orderBy: 'id ASC' },
  'part-member-households': { name: 'part_member_households', orderBy: 'household ASC' },
  'lcr-sync-runs': { name: 'lcr_sync_runs', orderBy: 'id DESC' },
  'mailer-runs': { name: 'mailer_runs', orderBy: 'id DESC' },
  'youth-activities': { name: 'youth_activities', orderBy: 'date ASC' },
  'wc-meetings': { name: 'wc_meetings', orderBy: 'date ASC' },
  'wc-wins': { name: 'wc_wins', orderBy: 'date DESC' },
  'wc-family-needs': { name: 'wc_family_needs', orderBy: 'id ASC' },
  'wc-discussion-topics': { name: 'wc_discussion_topics', orderBy: 'meeting_date DESC, organization ASC' },
  'hub-suggestions': { name: 'hub_suggestions', orderBy: 'id DESC' },
  'ordinances': { name: 'ordinances', orderBy: 'status ASC, target_date ASC' },
  'ordinance-suggestion-dismissals': { name: 'ordinance_suggestion_dismissals', orderBy: 'id ASC' },
  'annual-duties': { name: 'annual_duties', orderBy: 'sort_order ASC, id ASC' },
  'yc-meetings': { name: 'yc_meetings', orderBy: 'date ASC' },
  'yc-discussion-topics': { name: 'yc_discussion_topics', orderBy: 'meeting_date DESC, organization ASC' },
  'tithing-declarations': { name: 'tithing_declaration_slots', orderBy: 'date ASC, start_time ASC' },
  // Bishopric hub only: the WC, YC and Calendar hub checks below refuse any table they don't list.
  'speaking-topics': { name: 'speaking_topics', orderBy: 'topic COLLATE NOCASE ASC' },
  'homebound-sacrament': { name: 'homebound_sacrament', orderBy: 'active DESC, member_name COLLATE NOCASE ASC' },
  'interview-slots': { name: 'interview_slots', orderBy: 'date ASC, start_time ASC' },
  // Bishopric hub only: the WC, YC and Calendar hub checks refuse any table they don't list.
  'welfare-cases': { name: 'welfare_cases', orderBy: "CASE status WHEN 'Closed' THEN 1 ELSE 0 END, next_follow_up ASC, id DESC" },
  // Shared with the Ward Council hub (WC_FULL_CRUD).
  'member-care': { name: 'member_care', orderBy: 'archived ASC, added_date DESC, id DESC' },
  'funerals': { name: 'funerals', orderBy: 'archived ASC, funeral_date DESC, id DESC' },
};

export const WC_FULL_CRUD = new Set([
  'wc-wins', 'wc-family-needs', 'wc-discussion-topics',
  'tasks', 'calendaring', 'youth-activities', 'babies', 'hub-suggestions',
  'member-care', 'funerals',
]);

export const WC_READABLE = new Set([
  'wc-meetings',
  'sacrament-speakers', 'prayers', 'sacrament-music', 'sacrament-themes',
  'sacrament-agenda-notes', 'sacrament-announcements', 'sacrament-ward-business',
  'missionary-pipeline', 'yc-meetings', 'yc-discussion-topics',
]);

// Church role → hub mapping (duplicated from frontend constants for backend use)
export const BISHOPRIC_CALLINGS = new Set([
  'Bishop', 'First Counselor', 'Second Counselor', 'Clerk',
  'Executive Secretary', 'Assistant Executive Secretary', 'Assistant Clerk', 'High Councilor',
]);

export const YC_CALLINGS = new Set([
  // Advisers
  'Builders of Faith Adviser', 'Builders of Faith Second Adviser',
  'Messengers of Hope Adviser', 'Messengers of Hope Second Adviser',
  'Gatherers of Light Adviser', 'Gatherers of Light Second Adviser',
  'Priests Quorum Adviser', 'Priests Quorum Second Adviser',
  'Teachers Quorum Adviser', 'Teachers Quorum Second Adviser',
  'Deacons Quorum Adviser', 'Deacons Quorum Second Adviser',
  'Young Women Secretary',
  // Young Women class presidencies
  'Builders of Faith President', 'Builders of Faith First Counselor', 'Builders of Faith Second Counselor', 'Builders of Faith Secretary',
  'Messengers of Hope President', 'Messengers of Hope First Counselor', 'Messengers of Hope Second Counselor', 'Messengers of Hope Secretary',
  'Gatherers of Light President', 'Gatherers of Light First Counselor', 'Gatherers of Light Second Counselor', 'Gatherers of Light Secretary',
  // Priests Quorum presidency
  'Priests Quorum First Assistant', 'Priests Quorum Second Assistant', 'Priests Quorum Secretary',
  // Teachers Quorum presidency
  'Teachers Quorum President', 'Teachers Quorum First Counselor', 'Teachers Quorum Second Counselor', 'Teachers Quorum Secretary',
  // Deacons Quorum presidency
  'Deacons Quorum President', 'Deacons Quorum First Counselor', 'Deacons Quorum Second Counselor', 'Deacons Quorum Secretary',
]);

export const CAL_CALLINGS = new Set(['Music Coordinator', 'Ward Bulletin Specialist']);

export const WC_CALLINGS = new Set([
  'Elders Quorum President', 'Elders Quorum First Counselor', 'Elders Quorum Second Counselor',
  'Relief Society President', 'Relief Society First Counselor', 'Relief Society Second Counselor',
  'Young Women President', 'Young Women First Counselor', 'Young Women Second Counselor',
  'Primary President', 'Primary First Counselor', 'Primary Second Counselor',
  'Sunday School President', 'Sunday School First Counselor', 'Sunday School Second Counselor',
  'Ward Mission Leader', 'Ward Temple and Family History Leader',
]);

export const KNOWN_CALLINGS = new Set([...BISHOPRIC_CALLINGS, ...WC_CALLINGS, ...YC_CALLINGS, ...CAL_CALLINGS]);

export const VALID_HUBS = new Set(['both', 'wc', 'yc', 'cal']);

export function hubForChurchRole(role: string): string {
  if (BISHOPRIC_CALLINGS.has(role)) return 'both';
  if (YC_CALLINGS.has(role)) return 'yc';
  if (CAL_CALLINGS.has(role)) return 'cal';
  return 'wc';
}

// Only one user account may hold each of these callings at a time.
export const SINGLETON_CALLINGS = new Set(['Bishop', 'First Counselor', 'Second Counselor']);

/** Returns an error Response if another user already holds this singleton calling, else null. */

export async function checkSingletonCalling(db: D1Database, churchRole: string, excludeUserId: number | null): Promise<Response | null> {
  if (!SINGLETON_CALLINGS.has(churchRole)) return null;
  const existing = excludeUserId
    ? await db.prepare('SELECT id FROM users WHERE church_role = ? AND id != ?').bind(churchRole, excludeUserId).first()
    : await db.prepare('SELECT id FROM users WHERE church_role = ?').bind(churchRole).first();
  if (existing) return json({ error: `There is already a ${churchRole} — change their calling first before assigning a new one.` }, 400);
  return null;
}

/** Sets the Presiding field on every future sacrament meeting to "Bishop <lastname>",
 * overwriting whatever was there before — used whenever a new Bishop is assigned. */

export async function resetFuturePresidingToBishop(db: D1Database, bishopName: string): Promise<void> {
  const lastName = bishopName.trim().split(/\s+/).pop() || bishopName;
  const todayStr = new Date().toISOString().slice(0, 10);
  await db.prepare(
    "UPDATE sacrament_themes SET presiding = ?, updated_at = ? WHERE meeting_date >= ?"
  ).bind(`Bishop ${lastName}`, new Date().toISOString(), todayStr).run();
}
