export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly_nth_weekday';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORDINAL_NAMES = ['1st', '2nd', '3rd', '4th', '5th'];

function toDate(dateStr: string): Date {
  return new Date(dateStr.slice(0, 10) + 'T12:00:00');
}

function toStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysStr(dateStr: string, days: number): string {
  const d = toDate(dateStr);
  d.setDate(d.getDate() + days);
  return toStr(d);
}

export function addWeeksStr(dateStr: string, weeks: number): string {
  return addDaysStr(dateStr, weeks * 7);
}

export function getNthWeekdayInfo(dateStr: string): { weekday: number; nth: number } {
  const d = toDate(dateStr);
  return { weekday: d.getDay(), nth: Math.floor((d.getDate() - 1) / 7) + 1 };
}

export function nthWeekdayOfMonth(year: number, month: number, weekday: number, nth: number): string | null {
  const firstWeekday = new Date(year, month, 1, 12).getDay();
  const day = 1 + ((weekday - firstWeekday + 7) % 7) + (nth - 1) * 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  if (day > daysInMonth) return null;
  return toStr(new Date(year, month, day, 12));
}

export function describeRecurrence(
  frequency: RecurrenceFrequency,
  interval: number,
  endDate: string,
  startDate: string,
): string {
  const endLabel = toDate(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (frequency === 'daily') return `Every ${interval} day${interval === 1 ? '' : 's'} until ${endLabel}`;
  if (frequency === 'weekly') return `Every ${interval} week${interval === 1 ? '' : 's'} until ${endLabel}`;
  const { weekday, nth } = getNthWeekdayInfo(startDate);
  const ordinal = ORDINAL_NAMES[nth - 1] || `${nth}th`;
  const every = interval === 1 ? 'month' : `${interval} months`;
  return `Every ${every} on the ${ordinal} ${WEEKDAY_NAMES[weekday]} until ${endLabel}`;
}

// Generates occurrence dates strictly after startDate, up to and including endDate,
// capped at maxOccurrences. For monthly_nth_weekday, months where the nth weekday
// doesn't exist (e.g. a 5th Friday) are skipped rather than substituted.
export function generateRecurrenceDates(
  startDate: string,
  endDate: string,
  frequency: RecurrenceFrequency,
  interval: number,
  maxOccurrences: number,
): string[] {
  const dates: string[] = [];

  if (frequency === 'monthly_nth_weekday') {
    const { weekday, nth } = getNthWeekdayInfo(startDate);
    const start = toDate(startDate);
    let year = start.getFullYear();
    let month = start.getMonth();
    const yearLimit = year + 50;
    while (dates.length < maxOccurrences && year <= yearLimit) {
      month += interval;
      year += Math.floor(month / 12);
      month = ((month % 12) + 12) % 12;
      const next = nthWeekdayOfMonth(year, month, weekday, nth);
      if (next) {
        if (next > endDate) break;
        dates.push(next);
      }
    }
    return dates;
  }

  let current = startDate;
  while (dates.length < maxOccurrences) {
    current = frequency === 'daily' ? addDaysStr(current, interval) : addWeeksStr(current, interval);
    if (current > endDate) break;
    dates.push(current);
  }
  return dates;
}
