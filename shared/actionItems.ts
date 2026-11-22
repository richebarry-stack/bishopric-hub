import { stripBold } from './text';
import { buildNameIndex, matchMember, type NameIndexMember } from './nameMatch';

export interface ActionItem {
  id: string;
  label: string;
  detail?: string;
  date?: string;
  link: string;
  source: string;
}

// Twin of pageForInterviewType in src/components/interviews/shared.ts — duplicated
// rather than imported so this module stays free of src/ paths (it's shared with
// workers/mailer, which doesn't build the rest of src/).
const YOUTH_INTERVIEW_TYPES = new Set(['Youth 12-15', 'Youth 16-17']);
const TEMPLE_INTERVIEW_TYPES = new Set(['Endowed Temple Rec', 'Limited']);
function pageForInterviewType(type: string): string {
  if (YOUTH_INTERVIEW_TYPES.has(type)) return '/youth-interviews';
  if (TEMPLE_INTERVIEW_TYPES.has(type)) return '/temple-interviews';
  return '/other-interviews';
}

function normalizeName(raw: string | null | undefined): string {
  return stripBold(raw || '').trim().toLowerCase();
}

// "Last, First" and "First Last" both resolve to the same canonical name across
// the tables this hook reads, so accept either order.
function flipName(s: string): string {
  if (s.includes(',')) {
    const [last, first] = s.split(',').map(p => p.trim());
    return first ? `${first} ${last}` : s;
  }
  const parts = s.split(/\s+/);
  if (parts.length < 2) return s;
  const first = parts.slice(0, -1).join(' ');
  const last = parts[parts.length - 1];
  return `${last}, ${first}`;
}

function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  return na === nb || flipName(na) === nb || na === flipName(nb);
}

// An interview's setup job is finished once the interview itself is on the books —
// until then the person assigned to set it up still owes an action, whatever the
// Setup column says. 'On Hold' and 'Need to see Bishop' deliberately keep the item.
const INTERVIEW_SCHEDULED_STATUSES = new Set([
  'Scheduled for Interview', 'Interviewed', 'Delivered/Complete', 'Needs to be sustained',
]);

const CALLING_ACTION_STATUSES = new Set(['3. Approved and assigned', '8. Need to release']);

export interface TaskRow { id: number; task: string; assigned_to: string; due_date: string; done: number; share_with?: string | null }
export interface CallingRow {
  id: number; calling: string; member: string; status: string; assigned_to: string; type: string;
  release_recorded: number; sustain_recorded: number; set_apart_recorded: number;
}
export interface InterviewRow {
  id: number; member: string; setup_assigned_to: string; setup_status: string; status: string; type_of_interview: string;
  ward_member_id?: number | null;
}
export interface RotatingRow { id: number; month: string; plan_conduct: string; primary_message: string }
export interface BabyRow { id: number; name: string; status: string; church_record_created: number }
export interface WcMeetingRow { id: number; date: string; opening_prayer: string | null; spiritual_thought: string | null; closing_prayer: string | null }
export interface OrdinanceRow { id: number; member_name: string; ordinance_type: string; status: string }
export interface WelfareRow { id: number; member_name: string; status: string; next_follow_up: string | null }
export interface InterviewBookingRow {
  id: number; calendar: string; date: string; start_time: string;
  reserved_by: string | null; reserved_purpose: string | null; reserved_at: string | null;
}

export interface ActionItemSources {
  tasks: TaskRow[];
  callings: CallingRow[];
  interviews: InterviewRow[];
  rotating: RotatingRow[];
  babies: BabyRow[];
  /** Ward Council meetings; upcoming opening prayer / spiritual thought / closing prayer
   * assignments are action items for Ward Council members. Omitted = none. */
  wcMeetings?: WcMeetingRow[];
  /** Today's date (YYYY-MM-DD, ward time zone); meetings before it are skipped. */
  todayIso?: string;
  /** Roster ids that are no longer current youth (see agedOutMemberIds); youth interviews
   * linked to them are skipped. Omitted when the roster isn't available. */
  agedOutMemberIds?: Set<number>;
  /** Ordinances tracker; completed ones are the clerk's to record in LCR. Omitted = none. */
  ordinances?: OrdinanceRow[];
  /** Welfare follow-ups (Bishop only). Omitted = none. */
  welfare?: WelfareRow[];
  /** Interview slots members booked online. Omitted = none. */
  interviewBookings?: InterviewBookingRow[];
}

const INTERVIEW_CALENDARS = new Set(['Bishop', 'First Counselor', 'Second Counselor']);

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function fmtBookingWhen(date: string, time: string): string {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  const [hh, mm] = time.split(':').map(Number);
  return `${day}, ${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`;
}

export interface ActionItemPermissions {
  canBishopric: boolean;
  canWc: boolean;
  canYc: boolean;
  isClerk: boolean;
  /** The recipient's calling (users.church_role): routes Bishop-only and per-calendar items. */
  churchRole?: string;
}

/** Computes everything currently assigned to `recipientName`, matched by name against
 * the free-text assignment fields each table already has (order-flip and roster-aware
 * via `nameIndex` — see buildNameIndex). Pure and framework-free so it can run both in
 * the browser (src/lib/myActions.ts) and in the mailer Worker (workers/mailer) from one
 * implementation. `currentMonthAbbr` is passed in rather than computed from `new Date()`
 * so callers can test with a fixed clock.
 *
 * Sacrament meeting agenda assignments (speaking, prayers, chorister, organist) are
 * deliberately not action items — they're already on the agenda, not a separate to-do. */
export function computeActionItems(
  recipientName: string,
  permissions: ActionItemPermissions,
  sources: ActionItemSources,
  nameIndex: Map<string, NameIndexMember>,
  currentMonthAbbr: string,
): ActionItem[] {
  const { canBishopric, canWc, canYc, isClerk } = permissions;
  const { tasks, callings, interviews, rotating, babies } = sources;
  const out: ActionItem[] = [];

  // Free-text assignment fields get typed however the person felt like typing them —
  // "First Last", "Last, First", legal name or preferred name. Resolve both sides
  // against the roster so any of those forms find the same person, falling back to
  // the plain string comparison for names that aren't on the roster at all.
  const sameName = (a: string | null | undefined): boolean => {
    if (namesMatch(a, recipientName)) return true;
    const ma = matchMember(nameIndex, a);
    if (!ma) return false;
    const mb = matchMember(nameIndex, recipientName);
    return !!mb && ma === mb;
  };

  if (canWc || canYc) {
    for (const t of tasks) {
      if (!t.done && sameName(t.assigned_to)) {
        out.push({
          id: `task-${t.id}`, label: t.task,
          detail: t.due_date ? `Due ${t.due_date.slice(0, 10)}` : undefined,
          date: t.due_date, link: '/tasks', source: 'Action Item',
        });
      }
    }
  }

  if (canWc) {
    const WC_MEETING_PARTS = [
      ['opening_prayer', 'Opening prayer'],
      ['spiritual_thought', 'Spiritual thought'],
      ['closing_prayer', 'Closing prayer'],
    ] as const;
    for (const m of sources.wcMeetings || []) {
      const date = (m.date || '').slice(0, 10);
      if (!date || (sources.todayIso && date < sources.todayIso)) continue;
      for (const [field, label] of WC_MEETING_PARTS) {
        if (sameName(m[field])) {
          out.push({
            id: `wcmeeting-${m.id}-${field}`, label: `${label} — Ward Council meeting`,
            date, link: '/wc-meetings', source: 'Ward Council Meeting',
          });
        }
      }
    }
  }

  if (canBishopric) {
    for (const c of callings) {
      if (sameName(c.assigned_to) && CALLING_ACTION_STATUSES.has(c.status)) {
        out.push({
          id: `calling-${c.id}`, label: stripBold(c.member || '').trim() ? `${c.calling} — ${stripBold(c.member)}` : (c.calling || ''),
          detail: c.status, link: '/calling-pipeline', source: 'Calling Pipeline',
        });
      }
    }

    for (const i of interviews) {
      if (YOUTH_INTERVIEW_TYPES.has(i.type_of_interview) && i.ward_member_id && sources.agedOutMemberIds?.has(i.ward_member_id)) continue;
      if (sameName(i.setup_assigned_to) && i.setup_status !== 'Done' && !INTERVIEW_SCHEDULED_STATUSES.has(i.status)) {
        out.push({
          id: `interview-setup-${i.id}`, label: `Set up interview: ${i.member}`,
          detail: `${i.type_of_interview} — ${i.status || 'Unassigned'}, setup ${i.setup_status || 'Not started'}`,
          link: pageForInterviewType(i.type_of_interview), source: 'Interview Setup',
        });
      }
    }

    if (isClerk) {
      for (const c of callings) {
        // Calling Pipeline tracks a new calling and a release as separate pipeline
        // entries (type 'Calling' vs 'Release') — sustain/set-apart only apply to a
        // calling, while release-recording only applies to a release entry.
        if (c.type === 'Release') {
          if (!c.release_recorded && c.status === '10. Released') {
            out.push({
              id: `clerk-release-${c.id}`, label: `Record release in LCR: ${stripBold(c.member)}`,
              detail: c.calling, link: '/calling-pipeline', source: 'Clerk',
            });
          }
          continue;
        }
        if (!c.sustain_recorded && ['5. Sustained', '6. Set apart', '7. In release discussion', '8. Need to release', '9. Need to thank at pulpit'].includes(c.status)) {
          out.push({
            id: `clerk-sustain-${c.id}`, label: `Record sustaining in LCR: ${stripBold(c.member)}`,
            detail: c.calling, link: '/calling-pipeline', source: 'Clerk',
          });
        }
        if (!c.set_apart_recorded && c.status === '6. Set apart') {
          out.push({
            id: `clerk-setapart-${c.id}`, label: `Record setting apart in LCR: ${stripBold(c.member)}`,
            detail: c.calling, link: '/calling-pipeline', source: 'Clerk',
          });
        }
      }
      for (const b of babies) {
        if (b.status === 'Blessed' && !b.church_record_created) {
          out.push({
            id: `clerk-baby-${b.id}`, label: `Create church record: ${b.name}`,
            link: '/babies', source: 'Clerk',
          });
        }
      }
      for (const o of sources.ordinances || []) {
        if (o.status === 'Completed') {
          out.push({
            id: `clerk-ordinance-${o.id}`, label: `Record in LCR: ${o.member_name} — ${o.ordinance_type}`,
            link: '/ordinances', source: 'Clerk',
          });
        }
      }
    }

    const role = permissions.churchRole || '';
    const today = sources.todayIso || new Date().toISOString().slice(0, 10);
    if (role === 'Bishop') {
      // Follow-ups due within the next week (or overdue). The label stays minimal on
      // purpose: it is also emailed, so no help type or notes.
      const horizon = addDaysIso(today, 7);
      for (const w of sources.welfare || []) {
        const due = (w.next_follow_up || '').slice(0, 10);
        if (w.status === 'Closed' || !due || due > horizon) continue;
        out.push({
          id: `welfare-${w.id}-${due}`, label: `Welfare follow-up: ${w.member_name}`,
          detail: due < today ? `Overdue since ${due}` : `Due ${due}`,
          date: due, link: '/welfare', source: 'Welfare',
        });
      }
    }

    // Online interview bookings go to the person whose calendar was booked and to the
    // executive secretaries, until the interview date has passed.
    const isExecSec = /executive secretary/i.test(role);
    if (INTERVIEW_CALENDARS.has(role) || isExecSec) {
      for (const b of sources.interviewBookings || []) {
        const date = (b.date || '').slice(0, 10);
        if (!b.reserved_by || !date || date < today) continue;
        if (!isExecSec && b.calendar !== role) continue;
        out.push({
          id: `booking-${b.id}-${b.reserved_at || ''}`,
          label: `Interview booked: ${b.reserved_by}${b.reserved_purpose ? ` (${b.reserved_purpose})` : ''}`,
          detail: `${isExecSec ? `${b.calendar} — ` : ''}${fmtBookingWhen(date, b.start_time)}`,
          date, link: '/interview-booking', source: 'Interview Booking',
        });
      }
    }
  }

  if (canBishopric) {
    for (const r of rotating) {
      const abbr = (r.month || '').trim().slice(0, 3).toLowerCase();
      if (abbr !== currentMonthAbbr) continue;
      if (sameName(r.plan_conduct)) out.push({ id: `rotate-conduct-${r.id}`, label: `Plan & conduct sacrament meeting — ${r.month}`, link: '/assignments', source: 'Bishopric Assignment' });
      if (sameName(r.primary_message)) out.push({ id: `rotate-primary-${r.id}`, label: `Primary message — ${r.month}`, link: '/assignments', source: 'Bishopric Assignment' });
    }
  }

  return out.sort((a, b) => (a.date || '9999-99-99').localeCompare(b.date || '9999-99-99'));
}

export { buildNameIndex };
export type { NameIndexMember };
