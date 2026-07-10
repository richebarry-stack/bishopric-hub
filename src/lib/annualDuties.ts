import { useMemo } from 'react';

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function monthLabel(n: number): string {
  return MONTH_NAMES[n - 1] || String(n);
}

export function windowLabel(startMonth: number, endMonth: number): string {
  if (startMonth === endMonth) return monthLabel(startMonth);
  return `${monthLabel(startMonth)}–${monthLabel(endMonth)}`;
}

export function inDutyWindow(month: number, startMonth: number, endMonth: number): boolean {
  if (startMonth <= endMonth) return month >= startMonth && month <= endMonth;
  return month >= startMonth || month <= endMonth; // wraps across year-end (e.g. Nov–Jan)
}

export function useTimeZoneNow(timeZone: string): { month: number; year: number } {
  return useMemo(() => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, month: 'numeric', year: 'numeric' }).formatToParts(now);
    const month = parseInt(parts.find(p => p.type === 'month')?.value || '', 10) || now.getMonth() + 1;
    const year = parseInt(parts.find(p => p.type === 'year')?.value || '', 10) || now.getFullYear();
    return { month, year };
  }, [timeZone]);
}
