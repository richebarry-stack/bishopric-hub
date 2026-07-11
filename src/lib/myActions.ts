import { useMemo } from 'react';
import { useAuth } from './auth';
import { useTable } from './useTable';
import { stripBold } from './richText';
import { pageForInterviewType } from '../components/interviews/shared';
import type {
  Task, CallingPipeline, InterviewPipeline,
  SacramentSpeaker, Prayer, SacramentMusic, RotatingAssignment, Baby,
} from './api';

export interface ActionItem {
  id: string;
  label: string;
  detail?: string;
  date?: string;
  link: string;
  source: string;
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

const today = () => new Date().toISOString().slice(0, 10);

/** Aggregates everything currently assigned to the logged-in user across the app,
 * matched by name against the free-text assignment fields each table already has.
 * Hub-aware: only queries tables the user's account hub can actually read, mirroring
 * the server-side gating in functions/api/[[route]].ts. */
export function useMyActionItems(): { items: ActionItem[]; count: number; isLoading: boolean } {
  const { user, isGuest } = useAuth();
  const hub = user?.hub;
  const canBishopric = !isGuest && hub === 'both';
  const canWc = !isGuest && (hub === 'both' || hub === 'wc');
  const enabled = canBishopric || canWc;
  const isClerk = canBishopric && /clerk/i.test(user?.church_role || '');

  const { rows: tasks, isLoading: l1 } = useTable<Task>('tasks', { enabled: canWc });
  const { rows: callings, isLoading: l2 } = useTable<CallingPipeline>('calling-pipeline', { enabled: canBishopric });
  const { rows: interviews, isLoading: l3 } = useTable<InterviewPipeline>('interview-pipeline', { enabled: canBishopric });
  const { rows: speakers, isLoading: l6 } = useTable<SacramentSpeaker>('sacrament-speakers', { enabled: canWc });
  const { rows: prayers, isLoading: l7 } = useTable<Prayer>('prayers', { enabled: canWc });
  const { rows: music, isLoading: l8 } = useTable<SacramentMusic>('sacrament-music', { enabled: canWc });
  const { rows: rotating, isLoading: l9 } = useTable<RotatingAssignment>('rotating-assignments', { enabled: canBishopric });
  const { rows: babies, isLoading: l10 } = useTable<Baby>('babies', { enabled: isClerk });

  const items = useMemo<ActionItem[]>(() => {
    if (!enabled || !user) return [];
    const name = user.name;
    const todayStr = today();
    const out: ActionItem[] = [];

    for (const t of tasks) {
      if (!t.done && namesMatch(t.assigned_to, name)) {
        out.push({
          id: `task-${t.id}`, label: t.task,
          detail: t.due_date ? `Due ${t.due_date.slice(0, 10)}` : undefined,
          date: t.due_date, link: '/tasks', source: 'Action Item',
        });
      }
    }

    for (const c of callings) {
      if (namesMatch(c.assigned_to, name) && c.status !== '9. Released' && c.status !== '10. Declined') {
        out.push({
          id: `calling-${c.id}`, label: `${c.calling} — ${stripBold(c.member)}`,
          detail: c.status, link: '/calling-pipeline', source: 'Calling Pipeline',
        });
      }
    }

    for (const i of interviews) {
      if (namesMatch(i.setup_assigned_to, name) && i.setup_status !== 'Done') {
        out.push({
          id: `interview-setup-${i.id}`, label: `Set up interview: ${i.member}`,
          detail: `${i.type_of_interview} — setup ${i.setup_status || 'Not started'}`,
          link: pageForInterviewType(i.type_of_interview), source: 'Interview Setup',
        });
      }
    }

    if (isClerk) {
      for (const c of callings) {
        if (c.type !== 'Calling') continue;
        if (!c.sustain_recorded && ['5. Sustained', '6. Set apart', '7. Need to release', '8. Need to thank at pulpit'].includes(c.status)) {
          out.push({
            id: `clerk-sustain-${c.id}`, label: `Record sustaining in LCR: ${stripBold(c.member)}`,
            detail: c.calling, link: '/calling-pipeline', source: 'Clerk',
          });
        }
        if (!c.set_apart_recorded && ['6. Set apart', '7. Need to release', '8. Need to thank at pulpit'].includes(c.status)) {
          out.push({
            id: `clerk-setapart-${c.id}`, label: `Record setting apart in LCR: ${stripBold(c.member)}`,
            detail: c.calling, link: '/calling-pipeline', source: 'Clerk',
          });
        }
        if (!c.release_recorded && c.status === '9. Released') {
          out.push({
            id: `clerk-release-${c.id}`, label: `Record release in LCR: ${stripBold(c.member)}`,
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

    for (const s of speakers) {
      if (s.meeting_date.slice(0, 10) >= todayStr && namesMatch(s.speaker, name)) {
        out.push({
          id: `speaker-${s.id}`, label: `Speaking assignment${s.topic ? `: ${s.topic}` : ''}`,
          date: s.meeting_date, link: '/current-sacrament', source: 'Sacrament',
        });
      }
    }

    for (const p of prayers) {
      if (p.meeting_date.slice(0, 10) >= todayStr && namesMatch(p.name, name)) {
        out.push({
          id: `prayer-${p.id}`, label: `${p.opening_closing || 'Prayer'} — Sacrament Meeting`,
          date: p.meeting_date, link: '/current-sacrament', source: 'Sacrament',
        });
      }
    }

    for (const mu of music) {
      if (mu.meeting_date.slice(0, 10) < todayStr) continue;
      if (namesMatch(mu.chorister, name)) out.push({ id: `music-cho-${mu.id}`, label: 'Chorister — Sacrament Meeting', date: mu.meeting_date, link: '/current-sacrament', source: 'Sacrament' });
      if (namesMatch(mu.organist, name)) out.push({ id: `music-org-${mu.id}`, label: 'Organist — Sacrament Meeting', date: mu.meeting_date, link: '/current-sacrament', source: 'Sacrament' });
    }

    const currentMonthAbbr = new Date().toLocaleDateString('en-US', { month: 'short' }).toLowerCase();
    for (const r of rotating) {
      const abbr = (r.month || '').trim().slice(0, 3).toLowerCase();
      if (abbr !== currentMonthAbbr) continue;
      if (namesMatch(r.plan_conduct, name)) out.push({ id: `rotate-conduct-${r.id}`, label: `Plan & conduct sacrament meeting — ${r.month}`, link: '/assignments', source: 'Bishopric Assignment' });
      if (namesMatch(r.primary_message, name)) out.push({ id: `rotate-primary-${r.id}`, label: `Primary message — ${r.month}`, link: '/assignments', source: 'Bishopric Assignment' });
    }

    return out.sort((a, b) => (a.date || '9999-99-99').localeCompare(b.date || '9999-99-99'));
  }, [enabled, user, isClerk, tasks, callings, interviews, speakers, prayers, music, rotating, babies]);

  const isLoading = enabled && (l1 || l2 || l3 || l6 || l7 || l8 || l9 || (isClerk && l10));

  return { items, count: items.length, isLoading };
}
