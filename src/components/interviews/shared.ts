export const YOUTH_TYPES = new Set(['Youth 12-15', 'Youth 16-17']);

export const TEMPLE_TYPES = new Set(['Endowed Temple Rec', 'Unendowed Temple Rec', 'Limited', 'Annual']);

export const OTHER_TYPES = new Set([
  'Calling', 'Setting Apart', 'Patriarchal Blessing', 'Before Mission', 'Post-Mission', 'Eccl Endorsement', 'Other',
]);

// Types where a temple/limited-use recommend expiration doesn't apply.
export const NO_REC_TYPES = new Set(['Patriarchal Blessing', 'Before Mission', 'Post-Mission', 'Setting Apart', 'Other']);

export function pageForInterviewType(type: string): string {
  if (YOUTH_TYPES.has(type)) return '/youth-interviews';
  if (TEMPLE_TYPES.has(type)) return '/temple-interviews';
  return '/other-interviews';
}

export function shortYouthType(type: string): string {
  return type.replace(/^Youth /, '');
}

export const TODAY = new Date().toISOString().slice(0, 10);

export function isPast(d: string): boolean {
  const s = d ? d.slice(0, 10) : '';
  return !!s && s < TODAY;
}

export function recommendRowClass(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month] = dateStr.slice(0, 7).split('-').map(Number);
  if (!year || !month) return '';
  const expiry = new Date(year, month, 0); // last day of that month
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = (expiry.getTime() - today.getTime()) / 86400000;
  if (days < -30) return 'bg-red-100';      // expired > 1 month ago
  if (days < 0)   return 'bg-orange-100';   // expired within 1 month
  if (days <= 30) return 'bg-amber-100';    // expires within 1 month
  if (days <= 62) return 'bg-yellow-50';    // expires within 2 months
  return '';
}

export function formatRecommendDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month] = dateStr.slice(0, 7).split('-').map(Number);
  if (!year || !month) return dateStr.slice(0, 10);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// Both age brackets get an interview every 6 months per the Handbook — the
// distinction between them is who conducts, not how often.
export const YOUTH_CADENCE_MONTHS = 6;

export type YouthState = 'Due' | 'Scheduled' | 'Up to date';
export const YOUTH_STATE_RANK: Record<YouthState, number> = { Due: 0, Scheduled: 1, 'Up to date': 2 };
export const YOUTH_STATE_COLORS: Record<string, { bg: string; text: string }> = {
  Due: { bg: 'bg-rose-100', text: 'text-rose-800' },
  Scheduled: { bg: 'bg-blue-100', text: 'text-blue-800' },
  'Up to date': { bg: 'bg-green-100', text: 'text-green-800' },
};

// Computed from dates instead of a manually-set status: a future next_interview_date
// means it's Scheduled; otherwise a last_interview_datetime within the 6-month
// cadence means Up to date; otherwise it's Due (never interviewed, or lapsed).
export function computeYouthState(row: { next_interview_date?: string; last_interview_datetime?: string }): YouthState {
  const cadenceMonths = YOUTH_CADENCE_MONTHS;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (row.next_interview_date) {
    const nid = new Date(row.next_interview_date.slice(0, 10) + 'T12:00:00');
    if (nid >= today) return 'Scheduled';
  }
  if (row.last_interview_datetime) {
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - cadenceMonths);
    const lid = new Date(row.last_interview_datetime.slice(0, 10) + 'T12:00:00');
    if (lid >= cutoff) return 'Up to date';
  }
  return 'Due';
}

export function computeAge(birthDate: string, asOf?: Date): number {
  const bd = new Date(birthDate.slice(0, 10) + 'T12:00:00');
  const ref = asOf ?? new Date();
  let age = ref.getFullYear() - bd.getFullYear();
  const m = ref.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < bd.getDate())) age--;
  return age;
}

// Returns current age if the member is still youth-eligible, otherwise null.
// Youth eligibility ends September 1 of the year they turn 18, so members
// who turn 18 any time during the year remain youth through August.
export function computeYouthAge(birthDate: string): number | null {
  const bd = new Date(birthDate.slice(0, 10) + 'T12:00:00');
  const ageOutDate = new Date(bd.getFullYear() + 18, 8, 1); // Sep 1 of 18th year
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (today >= ageOutDate) return null;
  return computeAge(birthDate);
}

export interface RowMeta { age?: number; displayName: string; youthState?: YouthState; }

export type SortKey =
  | 'member' | 'age' | 'status' | 'assigned_to' | 'setup_assigned_to' | 'setup_status'
  | 'date_recommend_expires' | 'next_interview_date' | 'last_interview_datetime' | 'comments';
