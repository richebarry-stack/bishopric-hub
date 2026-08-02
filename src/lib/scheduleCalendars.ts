import type { ScheduleCalendar } from './api';

export function parseCalendars(raw: string): ScheduleCalendar[] {
  try { return JSON.parse(raw); } catch { return []; }
}

export function stringifyCalendars(calendars: ScheduleCalendar[]): string {
  return JSON.stringify(calendars);
}
