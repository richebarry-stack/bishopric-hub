import { useMemo } from 'react';
import { useAuth } from './auth';
import { useTable } from './useTable';
import { computeActionItems, buildNameIndex, type ActionItem } from '../../shared/actionItems';
import type {
  Task, CallingPipeline, InterviewPipeline, WardMember,
  SacramentSpeaker, Prayer, SacramentMusic, RotatingAssignment, Baby,
} from './api';

export type { ActionItem };

const today = () => new Date().toISOString().slice(0, 10);

/** Aggregates everything currently assigned to the logged-in user across the app.
 * The matching rules live in shared/actionItems.ts (computeActionItems) so the mailer
 * Worker can compute the same items for the same purpose — sending mail — from one
 * implementation. This hook is just the browser-specific wiring: fetching via
 * useTable and hub-gating via useAuth, mirroring the server-side gating in
 * functions/api/[[route]].ts. */
export function useMyActionItems(): { items: ActionItem[]; count: number; isLoading: boolean } {
  const { user, isGuest, selectedHub } = useAuth();
  const hub = user?.hub;
  // A dual-access ('both') account only sees bishopric/WC action items while actually
  // viewing that hub — switching to the WC (or YC) view hides bishopric-only items like
  // calling pipeline follow-ups and clerk tasks, even though the account has access to them.
  const effectiveHub = hub === 'both' ? selectedHub : hub;
  const canBishopric = !isGuest && effectiveHub === 'bh';
  const canWc = !isGuest && (effectiveHub === 'bh' || effectiveHub === 'wc');
  const canYc = !isGuest && effectiveHub === 'yc';
  const enabled = canBishopric || canWc || canYc;
  const isClerk = canBishopric && /clerk/i.test(user?.church_role || '');

  const { rows: tasks, isLoading: l1 } = useTable<Task>('tasks', { enabled: canWc || canYc });
  const { rows: callings, isLoading: l2 } = useTable<CallingPipeline>('calling-pipeline', { enabled: canBishopric });
  const { rows: interviews, isLoading: l3 } = useTable<InterviewPipeline>('interview-pipeline', { enabled: canBishopric });
  const { rows: speakers, isLoading: l6 } = useTable<SacramentSpeaker>('sacrament-speakers', { enabled: canWc });
  const { rows: prayers, isLoading: l7 } = useTable<Prayer>('prayers', { enabled: canWc });
  const { rows: music, isLoading: l8 } = useTable<SacramentMusic>('sacrament-music', { enabled: canWc });
  const { rows: rotating, isLoading: l9 } = useTable<RotatingAssignment>('rotating-assignments', { enabled: canBishopric });
  const { rows: babies, isLoading: l10 } = useTable<Baby>('babies', { enabled: isClerk });
  // Only the bishopric hub can read the roster (see WC_READABLE in the API); without it
  // name matching falls back to plain string/order matching, which is what it did before.
  const { rows: wardMembers, isLoading: l11 } = useTable<WardMember>('ward-members', { enabled: canBishopric });

  const nameIndex = useMemo(() => buildNameIndex(wardMembers), [wardMembers]);

  const items = useMemo<ActionItem[]>(() => {
    if (!enabled || !user) return [];
    // Guard each source by its permission flag rather than trusting the `enabled` fetch
    // option alone — react-query keeps a query's last-fetched data cached even after
    // `enabled` flips to false (e.g. switching hub view), so without this a dual-access
    // account could still see stale bishopric-only items after leaving the Bishopric hub.
    const currentMonthAbbr = new Date().toLocaleDateString('en-US', { month: 'short' }).toLowerCase();
    return computeActionItems(
      user.name,
      { canBishopric, canWc, canYc, isClerk },
      { tasks, callings, interviews, speakers, prayers, music, rotating, babies },
      nameIndex,
      today(),
      currentMonthAbbr,
    );
  }, [enabled, user, isClerk, canBishopric, canWc, canYc, tasks, callings, interviews, speakers, prayers, music, rotating, babies, nameIndex]);

  const isLoading = enabled && (l1 || l2 || l3 || l6 || l7 || l8 || l9 || (isClerk && l10) || (canBishopric && l11));

  return { items, count: items.length, isLoading };
}
