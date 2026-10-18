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

// "Copy from last week" adds to this week rather than replacing it, skipping
// anything already there. Matching ignores case and extra whitespace.
const normText = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

// Prior-week list items whose text isn't already in this week's list.
export function missingItems<T extends { item: string }>(prior: T[], current: { item: string }[]): T[] {
  const seen = new Set(current.map(i => normText(i.item)));
  return prior.filter(i => {
    const key = normText(i.item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Appends the lines of `prior` that aren't already lines of `current`.
export function mergeLines(current: string, prior: string): string {
  if (!current.trim()) return prior;
  const seen = new Set(current.split('\n').map(normText).filter(Boolean));
  const toAdd = prior.split('\n').filter(l => {
    const key = normText(l);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return toAdd.length ? `${current.replace(/\s+$/, '')}\n${toAdd.join('\n')}` : current;
}
