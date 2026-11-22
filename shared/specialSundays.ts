// Sundays the Handbook treats specially (General Handbook 29.2.8, 29.2.9, 12.1.6),
// computed from the date alone so Sacrament Planning can flag them automatically.

/** Western (Gregorian) Easter Sunday for `year`, as YYYY-MM-DD (anonymous Gregorian algorithm). */
export function easterDate(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export interface SpecialSundayFlag { key: 'easter' | 'christmas' | 'fifth'; label: string; note: string }

/** Automatic flags for a Sunday (YYYY-MM-DD). Non-Sundays get none. */
export function specialSundayFlags(dateIso: string): SpecialSundayFlag[] {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateIso || '');
  if (!m) return [];
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCDay() !== 0) return [];
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  const out: SpecialSundayFlag[] = [];
  if (iso === easterDate(year)) {
    out.push({ key: 'easter', label: 'Easter', note: 'Sacrament meeting is the only meeting held on Easter Sunday.' });
  }
  if (month === 12 && day === 25) {
    out.push({ key: 'christmas', label: 'Christmas', note: 'Christmas falls on Sunday: sacrament meeting is the only meeting held.' });
  }
  if (day > 28) {
    out.push({ key: 'fifth', label: '5th Sunday', note: 'Fifth Sunday: the bishopric decides the second-hour meeting.' });
  }
  return out;
}
