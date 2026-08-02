const TODAY_PREFIX = new Date().toISOString().slice(0, 10);

export function isUpcoming(dates: string): boolean {
  if (!dates) return true;
  return dates.slice(0, 10) >= TODAY_PREFIX;
}
