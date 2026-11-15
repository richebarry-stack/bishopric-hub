import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type SacramentMusic as MusicRow } from '../lib/api';
import { useTable } from '../lib/useTable';
import { toast } from '../lib/toast';
import {
  MUSIC_FIELDS, type MusicField, type MusicPatch,
  parseTsv, splitPeople, hasDateColumn, parseDateBlock, parseCellBlock,
} from '../../shared/musicPaste';

const COLUMNS: { field: MusicField; label: string; width: string }[] = [
  { field: 'organist', label: 'Organist', width: 'w-36' },
  { field: 'chorister', label: 'Chorister', width: 'w-36' },
  { field: 'opening_hymn', label: 'Opening', width: 'w-52' },
  { field: 'sacrament_hymn', label: 'Sacrament', width: 'w-52' },
  { field: 'rest_special', label: 'Rest/Special', width: 'w-48' },
  { field: 'closing_hymn', label: 'Closing', width: 'w-52' },
];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (d: string | null | undefined) => (d ? d.slice(0, 10) : '');

function sundaysOf(year: number): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(year, 0, 1));
  d.setUTCDate(1 + ((7 - d.getUTCDay()) % 7));
  while (d.getUTCFullYear() === year) {
    out.push(`${year}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`);
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

function todayKey(): string {
  const t = new Date();
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

export default function SacramentMusic() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const { rows, create, update, isLoading } = useTable<MusicRow & { updated_at?: string }>('sacrament-music');
  const { data: sundayInfo = [] } = useQuery({
    queryKey: ['music-sundays', year],
    queryFn: () => api.musicSundays(year),
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const sundays = useMemo(() => sundaysOf(year), [year]);
  const byDate = useMemo(() => {
    const m = new Map<string, MusicRow>();
    for (const r of rows) { const k = dateKey(r.meeting_date); if (k && !m.has(k)) m.set(k, r); }
    return m;
  }, [rows]);
  const infoByDate = useMemo(() => new Map(sundayInfo.map(s => [s.date, s])), [sundayInfo]);
  const nextSunday = useMemo(() => { const t = todayKey(); return sundays.find(d => d >= t) ?? ''; }, [sundays]);

  // Bring the coming Sunday into view on first load, like opening the sheet at this week.
  const nextRowRef = useRef<HTMLTableRowElement | null>(null);
  const scrolled = useRef(false);
  useEffect(() => {
    if (scrolled.current || isLoading || !nextRowRef.current) return;
    scrolled.current = true;
    nextRowRef.current.scrollIntoView({ block: 'center' });
  }, [isLoading, year]);

  const saveMany = async (patches: Record<string, MusicPatch>): Promise<number> => {
    let saved = 0;
    for (const [date, patch] of Object.entries(patches)) {
      const existing = byDate.get(date);
      if (existing) {
        const changed = Object.fromEntries(Object.entries(patch).filter(([k, v]) => (existing[k as MusicField] || '') !== v));
        if (!Object.keys(changed).length) continue;
        await update(existing.id, changed, { silent: true });
      } else {
        if (!Object.values(patch).some(v => v)) continue;
        const blank = Object.fromEntries(MUSIC_FIELDS.map(f => [f, '']));
        await create({ meeting_date: date, ...blank, notes: '', ...patch }, { silent: true });
      }
      saved++;
    }
    return saved;
  };

  const cellKey = (date: string, field: MusicField) => `${date}|${field}`;

  const commit = async (date: string, field: MusicField) => {
    const k = cellKey(date, field);
    if (!(k in drafts)) return;
    const value = drafts[k].trim();
    try {
      await saveMany({ [date]: { [field]: value } });
    } finally {
      setDrafts(d => { const n = { ...d }; delete n[k]; return n; });
    }
  };

  const focusCell = (r: number, c: number) => {
    const el = document.querySelector<HTMLInputElement>(`input[data-music-r="${r}"][data-music-c="${c}"]`);
    el?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    if (e.key === 'Enter') { e.preventDefault(); if (r + 1 < sundays.length) focusCell(r + 1, c); else e.currentTarget.blur(); }
    if (e.key === 'Escape') {
      const k = cellKey(sundays[r], COLUMNS[c].field);
      setDrafts(d => { const n = { ...d }; delete n[k]; return n; });
    }
  };

  const onPaste = async (e: ClipboardEvent<HTMLInputElement>, r: number, c: number) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    const grid = parseTsv(text.replace(/\n$/, ''));
    const single = grid.length === 1 && grid[0].length === 1;
    const field = COLUMNS[c].field;
    // One plain cell: let the browser paste it, unless it's a combined organist/chorister cell.
    if (single && !((field === 'organist' || field === 'chorister') && /\b(organist|pianist|chorister|conductor|director)\b/i.test(grid[0][0]))) return;
    e.preventDefault();
    const date = sundays[r];
    setDrafts(d => { const n = { ...d }; delete n[cellKey(date, field)]; return n; });
    let patches: Record<string, MusicPatch> = {};
    let skipped: string[] = [];
    if (single) {
      const p = splitPeople(grid[0][0]);
      patches[date] = { organist: p.organist, chorister: p.chorister };
    } else if (hasDateColumn(grid)) {
      ({ patches, skipped } = parseDateBlock(grid, year, Number(date.slice(5, 7)) - 1));
    } else {
      parseCellBlock(grid, c).forEach((patch, i) => { if (sundays[r + i]) patches[sundays[r + i]] = patch; });
    }
    setBusy(true);
    try {
      const n = await saveMany(patches);
      const weeks = Object.keys(patches).length;
      if (weeks > 1 || n !== 1) toast.success(n ? `Pasted music for ${n} Sunday${n === 1 ? '' : 's'}` : 'Nothing new to paste — it already matches');
      const otherYear = Object.keys(patches).filter(d => !d.startsWith(String(year)));
      if (otherYear.length) toast.success(`Some rows were for ${[...new Set(otherYear.map(d => d.slice(0, 4)))].join(', ')} — switch years to see them`);
      if (skipped.length) toast.error(`Skipped ${skipped.length} row${skipped.length === 1 ? '' : 's'} that aren’t a Sunday: ${skipped.slice(0, 4).join(', ')}${skipped.length > 4 ? '…' : ''}`);
    } finally {
      setBusy(false);
    }
  };

  const label = (date: string) => {
    const info = infoByDate.get(date);
    const day = Number(date.slice(8, 10));
    const fast = info && info.is_fast_sunday != null ? !!info.is_fast_sunday : day <= 7;
    return { day, fast, noMeeting: !!info?.no_meeting, theme: info?.theme?.trim() || '' };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sacrament Music</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl">
            Hymns and musicians for each Sunday. Click a cell to type; Enter moves down. Changes save when you leave the cell
            and show up in Sacrament Planning and the agenda.
          </p>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Year">
          <button type="button" onClick={() => { scrolled.current = true; setYear(y => y - 1); }} className="px-2 py-1 rounded-md border border-gray-300 text-sm hover:bg-gray-50" aria-label="Previous year">‹</button>
          <span className="px-3 py-1 text-sm font-semibold text-gray-800 tabular-nums">{year}</span>
          <button type="button" onClick={() => { scrolled.current = true; setYear(y => y + 1); }} className="px-2 py-1 rounded-md border border-gray-300 text-sm hover:bg-gray-50" aria-label="Next year">›</button>
        </div>
      </div>

      <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 space-y-1">
        <p><b>Pasting from the spreadsheet:</b> copy rows <i>including the date column</i> (with or without the month rows), click any cell here, and paste. Each row lands on its own Sunday by date. Blank cells are skipped, so nothing already here is erased.</p>
        <p>Copied without the date column, the block fills down from the cell you click, one Sunday per row. A combined “Diane Krueger, organist Anna Grandil, chorister” cell is split into Organist and Chorister.</p>
      </div>

      <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
        <table className="min-w-[1080px] w-full text-sm border-collapse" aria-busy={busy}>
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
              <th className="px-2 py-2 w-40 border-b border-gray-200">Sunday</th>
              {COLUMNS.map(col => <th key={col.field} className={`px-2 py-2 border-b border-gray-200 ${col.width}`}>{col.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {sundays.map((date, r) => {
              const month = Number(date.slice(5, 7)) - 1;
              const firstOfMonth = r === 0 || sundays[r - 1].slice(5, 7) !== date.slice(5, 7);
              const row = byDate.get(date);
              const l = label(date);
              const isNext = date === nextSunday;
              return [
                firstOfMonth && (
                  <tr key={`m-${month}`}>
                    <td colSpan={COLUMNS.length + 1} className="px-2 pt-3 pb-1 font-semibold text-gray-900 border-b border-gray-200 bg-gray-50/60">{MONTH_NAMES[month]}</td>
                  </tr>
                ),
                <tr key={date} ref={isNext ? nextRowRef : undefined}
                  className={`border-b border-gray-100 ${isNext ? 'bg-amber-50' : l.noMeeting ? 'bg-gray-50 text-gray-500' : ''}`}>
                  <td className="px-2 py-1 align-top">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="font-medium tabular-nums">{l.day}</span>
                      {l.fast && <span className="text-xs text-indigo-700">Fast Sunday</span>}
                      {l.noMeeting && <span className="text-xs text-gray-500">No meeting</span>}
                      {isNext && <span className="text-xs text-amber-700">This Sunday</span>}
                    </div>
                    {l.theme && <div className="text-xs text-gray-500 truncate max-w-40" title={l.theme}>{l.theme}</div>}
                  </td>
                  {COLUMNS.map((col, c) => {
                    const k = cellKey(date, col.field);
                    const value = k in drafts ? drafts[k] : (row?.[col.field] || '');
                    return (
                      <td key={col.field} className="px-1 py-0.5 align-top">
                        <input value={value} data-music-r={r} data-music-c={c}
                          aria-label={`${col.label}, ${MONTH_NAMES[month]} ${l.day}`}
                          onChange={e => { const v = e.target.value; setDrafts(d => ({ ...d, [k]: v })); }}
                          onBlur={() => commit(date, col.field)}
                          onKeyDown={e => onKeyDown(e, r, c)}
                          onPaste={e => onPaste(e, r, c)}
                          className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 hover:border-gray-200 focus:border-sky-400 focus:bg-white focus:outline-none" />
                      </td>
                    );
                  })}
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
