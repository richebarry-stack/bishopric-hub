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

export interface TaskRow { id: number; task: string; assigned_to: string; due_date: string; done: number }
export interface CallingRow {
  id: number; calling: string; member: string; status: string; assigned_to: string; type: string;
  release_recorded: number; sustain_recorded: number; set_apart_recorded: number;
}
export interface InterviewRow {
  id: number; member: string; setup_assigned_to: string; setup_status: string; status: string; type_of_interview: string;
}
export interface SpeakerRow { id: number; meeting_date: string; speaker: string; topic: string }
export interface PrayerRow { id: number; meeting_date: string; name: string; opening_closing: string }
export interface MusicRow { id: number; meeting_date: string; chorister: string; organist: string }
export interface RotatingRow { id: number; month: string; plan_conduct: string; primary_message: string }
export interface BabyRow { id: number; name: string; status: string; church_record_created: number }

export interface ActionItemSources {
  tasks: TaskRow[];
  callings: CallingRow[];
  interviews: InterviewRow[];
  speakers: SpeakerRow[];
  prayers: PrayerRow[];
  music: MusicRow[];
  rotating: RotatingRow[];
  babies: BabyRow[];
}

export interface ActionItemPermissions {
  canBishopric: boolean;
  canWc: boolean;
  canYc: boolean;
  isClerk: boolean;
}

/** Computes everything currently assigned to `recipientName`, matched by name against
 * the free-text assignment fields each table already has (order-flip and roster-aware
 * via `nameIndex` — see buildNameIndex). Pure and framework-free so it can run both in
 * the browser (src/lib/myActions.ts) and in the mailer Worker (workers/mailer) from one
 * implementation. `todayStr` and `currentMonthAbbr` are passed in rather than computed
 * from `new Date()` so callers can test with a fixed clock. */
export function computeActionItems(
  recipientName: string,
  permissions: ActionItemPermissions,
  sources: ActionItemSources,
  nameIndex: Map<string, NameIndexMember>,
  todayStr: string,
  currentMonthAbbr: string,
): ActionItem[] {
  const { canBishopric, canWc, canYc, isClerk } = permissions;
  const { tasks, callings, interviews, speakers, prayers, music, rotating, babies } = sources;
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

  if (canBishopric) {
    for (const c of callings) {
      if (sameName(c.assigned_to) && CALLING_ACTION_STATUSES.has(c.status)) {
        out.push({
          id: `calling-${c.id}`, label: `${c.calling} — ${stripBold(c.member)}`,
          detail: c.status, link: '/calling-pipeline', source: 'Calling Pipeline',
        });
      }
    }

    for (const i of interviews) {
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
        if (!c.set_apart_recorded && ['6. Set apart', '7. In release discussion', '8. Need to release', '9. Need to thank at pulpit'].includes(c.status)) {
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
    }
  }

  if (canWc) {
    for (const s of speakers) {
      if (s.meeting_date.slice(0, 10) >= todayStr && sameName(s.speaker)) {
        out.push({
          id: `speaker-${s.id}`, label: `Speaking assignment${s.topic ? `: ${s.topic}` : ''}`,
          date: s.meeting_date, link: '/current-sacrament', source: 'Sacrament',
        });
      }
    }

    for (const p of prayers) {
      if (p.meeting_date.slice(0, 10) >= todayStr && sameName(p.name)) {
        out.push({
          id: `prayer-${p.id}`, label: `${p.opening_closing || 'Prayer'} — Sacrament Meeting`,
          date: p.meeting_date, link: '/current-sacrament', source: 'Sacrament',
        });
      }
    }

    for (const mu of music) {
      if (mu.meeting_date.slice(0, 10) < todayStr) continue;
      if (sameName(mu.chorister)) out.push({ id: `music-cho-${mu.id}`, label: 'Chorister — Sacrament Meeting', date: mu.meeting_date, link: '/current-sacrament', source: 'Sacrament' });
      if (sameName(mu.organist)) out.push({ id: `music-org-${mu.id}`, label: 'Organist — Sacrament Meeting', date: mu.meeting_date, link: '/current-sacrament', source: 'Sacrament' });
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
