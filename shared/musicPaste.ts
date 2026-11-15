// Paste support for the Sacrament Music page: turns text copied from the ward's
// music spreadsheet (Google Sheets / Excel copy tab-separated text) into
// per-Sunday music fields.

export const MUSIC_FIELDS = ['organist', 'chorister', 'opening_hymn', 'sacrament_hymn', 'rest_special', 'closing_hymn'] as const;
export type MusicField = typeof MUSIC_FIELDS[number];
export type MusicPatch = Partial<Record<MusicField, string>>;

/** Parses tab-separated clipboard text. Handles quoted cells (which may hold tabs,
 *  newlines and doubled quotes), as Google Sheets and Excel write them. */
export function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let i = 0;
  let atCellStart = true;
  const src = text.replace(/\r\n?/g, '\n');
  while (i < src.length) {
    const ch = src[i];
    if (atCellStart && ch === '"') {
      // Quoted cell: read to the closing quote; "" is a literal quote.
      i++;
      while (i < src.length) {
        if (src[i] === '"') {
          if (src[i + 1] === '"') { cell += '"'; i += 2; continue; }
          i++;
          break;
        }
        cell += src[i++];
      }
      atCellStart = false;
      continue;
    }
    if (ch === '\t') { row.push(cell); cell = ''; atCellStart = true; i++; continue; }
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; atCellStart = true; i++; continue; }
    cell += ch;
    atCellStart = false;
    i++;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const ORGANIST_WORDS = /^(organist|pianist|organ|piano)$/i;
const KEY_RE = /\b(organist|pianist|chorister|conductor|director|organ|piano)\b/gi;

function tidyName(raw: string): string {
  let name = raw.replace(/^[\s,.;:/()-]+|[\s,.;:/()-]+$/g, '').replace(/\s+/g, ' ');
  // "DianeKrueger" (a missing space in the sheet) -> "Diane Krueger"
  if (name && !name.includes(' ')) name = name.replace(/([a-z])([A-Z])/g, '$1 $2');
  return name;
}

/** Splits a combined Organist/Chorister cell like "Diane Krueger, organist Anna
 *  Grandil, chorister" (or "Organist: Diane Krueger / Chorister: Anna Grandil").
 *  Without those words, the first name is the organist and the second the chorister. */
export function splitPeople(text: string): { organist: string; chorister: string } {
  const src = text.trim();
  const matches = [...src.matchAll(KEY_RE)];
  if (!matches.length) {
    const parts = src.split(/\n|,|;|\s\/\s|\s&\s/).map(tidyName).filter(Boolean);
    return { organist: parts[0] || '', chorister: parts[1] || '' };
  }
  const out = { organist: '', chorister: '' };
  const set = (word: string, name: string) => {
    const key = ORGANIST_WORDS.test(word) ? 'organist' : 'chorister';
    if (name && !out[key]) out[key] = name;
  };
  // Role word before the name ("Organist: Diane") when the text starts with one.
  const roleFirst = (matches[0].index ?? 0) === 0 || !tidyName(src.slice(0, matches[0].index));
  matches.forEach((m, k) => {
    const start = m.index ?? 0;
    if (roleFirst) {
      const end = k + 1 < matches.length ? matches[k + 1].index ?? src.length : src.length;
      set(m[0], tidyName(src.slice(start + m[0].length, end)));
    } else {
      const prevEnd = k ? (matches[k - 1].index ?? 0) + matches[k - 1][0].length : 0;
      set(m[0], tidyName(src.slice(prevEnd, start)));
    }
  });
  return out;
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

function monthOf(label: string): number | null {
  const m = label.trim().toLowerCase().match(/^([a-z]+)/);
  if (!m) return null;
  const i = MONTHS.findIndex(name => name === m[1] || (m[1].length >= 3 && name.startsWith(m[1])));
  return i >= 0 && label.trim().replace(/\d{4}/, '').replace(/[a-z]+/i, '').trim() === '' ? i : null;
}

function headerField(cell: string): MusicField | 'people' | null {
  const c = cell.toLowerCase();
  if (/organist|chorister/.test(c)) return 'people';
  if (/opening/.test(c)) return 'opening_hymn';
  if (/sacrament/.test(c)) return 'sacrament_hymn';
  if (/rest|special/.test(c)) return 'rest_special';
  if (/closing/.test(c)) return 'closing_hymn';
  return null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** True when a pasted block includes the spreadsheet's date column (month rows
 *  like "January", or dates like "1/22/23"), so rows can be lined up by date. */
export function hasDateColumn(grid: string[][]): boolean {
  if (grid.some(r => monthOf(r[0] || '') !== null || /^\s*\d{1,2}\/\d{1,2}/.test(r[0] || ''))) return true;
  // Week rows only ("Fast Sunday 4", "11", "Stake Conference 18"): every first cell
  // holds one day number, and the block is as wide as the spreadsheet.
  const rows = grid.filter(r => r.some(c => c.trim()));
  return rows.length > 0 && Math.max(...grid.map(r => r.length)) >= 5
    && rows.every(r => /^\D*([1-9]|[12]\d|3[01])\D*$/.test((r[0] || '').trim()));
}

export interface DateBlockResult { patches: Record<string, MusicPatch>; skipped: string[] }

/** Reads a block copied with the spreadsheet's date column: month rows set the month,
 *  each week's row gives the day ("Fast Sunday 4", "Stake Conference 18", "1/22/23").
 *  A header row ("Opening", "Sacrament"...) sets the columns; otherwise the 2026 layout
 *  (date, Organist/Chorister, Opening, Sacrament, Rest/Special, Closing) is assumed, or
 *  the older one without Organist/Chorister when there are only 5 columns.
 *  Empty cells are left out, so pasting never erases music already in the hub. */
export function parseDateBlock(grid: string[][], year: number, startMonth?: number): DateBlockResult {
  const patches: Record<string, MusicPatch> = {};
  const skipped: string[] = [];
  const width = Math.max(...grid.map(r => r.length));
  let cols: (MusicField | 'people' | null)[] = width >= 6
    ? [null, 'people', 'opening_hymn', 'sacrament_hymn', 'rest_special', 'closing_hymn']
    : [null, 'opening_hymn', 'sacrament_hymn', 'rest_special', 'closing_hymn'];
  let month: number | null = startMonth ?? null;
  let lastDay = 0;
  for (const row of grid) {
    const label = (row[0] || '').trim();
    if (row.slice(1).some(c => /^\s*opening\b/i.test(c))) {
      cols = row.map((c, i) => (i === 0 ? null : headerField(c)));
    }
    const m = monthOf(label);
    if (m !== null) { month = m; lastDay = 0; continue; }
    const cells = row.slice(1);
    if (!label || !cells.some(c => c.trim())) continue;
    if (cells.some(c => /^\s*opening\b/i.test(c))) continue;
    let y = year, mo = month, day: number | null = null;
    const slash = label.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (slash) {
      mo = Number(slash[1]) - 1; day = Number(slash[2]);
      if (slash[3]) y = slash[3].length === 2 ? 2000 + Number(slash[3]) : Number(slash[3]);
    } else {
      const d = label.match(/\b(\d{1,2})\b/);
      if (d) day = Number(d[1]);
      // No month row in the block: a smaller day number means the next month.
      if (day !== null && mo !== null && startMonth !== undefined && lastDay && day < lastDay && !grid.some(r => monthOf(r[0] || '') !== null)) mo++;
    }
    if (mo === null || day === null || mo > 11 || day < 1 || day > 31) { skipped.push(label); continue; }
    const dt = new Date(Date.UTC(y, mo, day));
    if (dt.getUTCMonth() !== mo || dt.getUTCDay() !== 0) { skipped.push(label); continue; }
    lastDay = day;
    const key = `${y}-${pad(mo + 1)}-${pad(day)}`;
    const patch: MusicPatch = patches[key] || {};
    cols.forEach((field, i) => {
      const value = (row[i] || '').trim();
      if (!field || !value) return;
      if (field === 'people') {
        const p = splitPeople(value);
        if (p.organist) patch.organist = p.organist;
        if (p.chorister) patch.chorister = p.chorister;
      } else patch[field] = value;
    });
    if (Object.keys(patch).length) patches[key] = patch;
  }
  return { patches, skipped };
}

/** A block without the date column, pasted starting at one cell of the page: rows go to
 *  consecutive Sundays and columns run right from the starting column. Pasting into the
 *  Organist or Chorister column treats the first pasted column as the spreadsheet's
 *  combined Organist/Chorister cell. */
export function parseCellBlock(grid: string[][], startCol: number): MusicPatch[] {
  return grid.map(row => {
    const patch: MusicPatch = {};
    let col = startCol;
    row.forEach((raw, i) => {
      const value = raw.trim();
      if (i === 0 && col <= 1) {
        const p = splitPeople(value);
        if (/\b(organist|pianist|chorister|conductor|director)\b/i.test(value)) {
          patch.organist = p.organist; patch.chorister = p.chorister;
        } else patch[MUSIC_FIELDS[col]] = value;
        col = 2;
        return;
      }
      if (col < MUSIC_FIELDS.length) patch[MUSIC_FIELDS[col]] = value;
      col++;
    });
    return patch;
  });
}
