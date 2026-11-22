// Minimal iCalendar (RFC 5545) writer for the private calendar subscription feeds.
// Times are written as local wall-clock times with a TZID of the ward's IANA time
// zone, which Google Calendar, Apple Calendar and Outlook all resolve without an
// embedded VTIMEZONE block.

export interface IcsEvent {
  uid: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM (24h); omit both times for an all-day event. */
  start?: string;
  end?: string;
  summary: string;
  description?: string;
  location?: string;
}

/** Escapes TEXT values (RFC 5545 3.3.11). */
export function escapeIcsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Folds a content line to 75 octets, continuation lines starting with a space. */
export function foldIcsLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let currentLen = 0;
  for (const ch of line) {
    const len = new TextEncoder().encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines lose one octet to the leading space
    if (currentLen + len > limit) {
      parts.push(current);
      current = '';
      currentLen = 0;
    }
    current += ch;
    currentLen += len;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function compactDate(date: string): string {
  return date.slice(0, 10).replace(/-/g, '');
}

function compactTime(t: string): string {
  const [h, m] = t.split(':');
  return `${(h || '00').padStart(2, '0')}${(m || '00').padStart(2, '0')}00`;
}

function nextDay(date: string): string {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}

function utcStamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function buildIcs(opts: { name: string; timeZone: string; events: IcsEvent[]; now?: Date }): string {
  const stamp = utcStamp(opts.now ?? new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bishopric Hub//Calendar Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(opts.name)}`,
    `X-WR-TIMEZONE:${opts.timeZone}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];
  for (const e of opts.events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stamp}`);
    if (e.start && e.end) {
      lines.push(`DTSTART;TZID=${opts.timeZone}:${compactDate(e.date)}T${compactTime(e.start)}`);
      lines.push(`DTEND;TZID=${opts.timeZone}:${compactDate(e.date)}T${compactTime(e.end)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compactDate(e.date)}`);
      lines.push(`DTEND;VALUE=DATE:${compactDate(nextDay(e.date))}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(e.summary)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeIcsText(e.description)}`);
    if (e.location) lines.push(`LOCATION:${escapeIcsText(e.location)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}
