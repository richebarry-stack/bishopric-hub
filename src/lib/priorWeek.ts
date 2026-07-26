// Resolves which bishopric meeting date "last week" refers to, for "copy from
// last week" actions. Prefers exactly 7 days before `date`; falls back to the
// most recent meeting strictly before `date` if there's a gap (e.g. a skipped week).
export function priorMeetingDate(date: string, meetings: { date: string }[]): string | null {
  const dates = Array.from(new Set(meetings.map(m => m.date.slice(0, 10)))).sort();
  const sevenDaysBefore = new Date(date + 'T12:00:00');
  sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 7);
  const exact = sevenDaysBefore.toISOString().slice(0, 10);
  if (dates.includes(exact)) return exact;

  const before = dates.filter(d => d < date);
  return before.length ? before[before.length - 1] : null;
}
