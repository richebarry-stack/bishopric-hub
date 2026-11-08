import type { ScheduleEntry, TithingDeclarationSlot } from './api';
import { parseCalendars } from './scheduleCalendars';

// Tithing declarations are held with the Bishop, so his calendar and the tithing
// slots must never double-book each other (hub suggestion #32). The server enforces
// the same rules; these client checks give a clear message before saving.
// Times are zero-padded "HH:MM", so string comparison orders them correctly.

export function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function formatTime12(t: string): string {
  const [hh, mm] = t.split(':').map(Number);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

function sameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

function formatDay(d: string): string {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** "Talbots' tithing declaration at 7:30 PM on Thu, Nov 12" — for overlap messages. */
export function describeSlot(s: TithingDeclarationSlot): string {
  const who = s.reserved_by ? `${s.reserved_by}'s tithing declaration` : 'an open tithing slot';
  return `${who} at ${formatTime12(s.start_time)} on ${formatDay(s.date)}`;
}

/** "the Bishop's "Mutual" appointment at 6:30 PM on Wed, Nov 11" — for overlap messages. */
export function describeEntry(e: ScheduleEntry): string {
  return `the Bishop's "${e.title}" appointment at ${formatTime12(e.start_time)} on ${formatDay(e.date)}`;
}

/** A reserved tithing slot overlapping this time, if any. */
export function findReservedSlotOverlap(
  slots: TithingDeclarationSlot[], date: string, start: string, end: string, excludeId?: number,
): TithingDeclarationSlot | undefined {
  return slots.find(s => s.id !== excludeId && !!s.reserved_by && sameDay(s.date, date)
    && timesOverlap(s.start_time, s.end_time, start, end));
}

/** Any other tithing slot (open or reserved) overlapping this time, if any. */
export function findSlotOverlap(
  slots: TithingDeclarationSlot[], date: string, start: string, end: string, excludeId?: number,
): TithingDeclarationSlot | undefined {
  return slots.find(s => s.id !== excludeId && sameDay(s.date, date)
    && timesOverlap(s.start_time, s.end_time, start, end));
}

/** A Bishop's-calendar appointment overlapping this time, if any. */
export function findBishopEntryOverlap(
  entries: ScheduleEntry[], date: string, start: string, end: string, excludeId?: number,
): ScheduleEntry | undefined {
  return entries.find(e => e.id !== excludeId && sameDay(e.date, date)
    && parseCalendars(e.calendars).includes('Bishop')
    && timesOverlap(e.start_time, e.end_time, start, end));
}

/**
 * An open slot is hidden from the public reservation page while a Bishop
 * appointment or another reserved slot covers any part of it.
 */
export function isSlotHiddenFromPublic(
  slot: TithingDeclarationSlot, slots: TithingDeclarationSlot[], entries: ScheduleEntry[],
): boolean {
  if (slot.reserved_by) return false;
  const d = slot.date;
  return !!findBishopEntryOverlap(entries, d, slot.start_time, slot.end_time)
    || !!findReservedSlotOverlap(slots, d, slot.start_time, slot.end_time, slot.id);
}
