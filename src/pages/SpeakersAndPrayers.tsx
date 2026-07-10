import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTable } from '../lib/useTable';
import { api } from '../lib/api';
import type { SacramentSpeaker, Prayer, WardMember, SacramentMusic, SacramentTheme, SacramentAnnouncement, SacramentAgendaNote, SacramentWardBusiness } from '../lib/api';
import { AgendaEditor, type AgendaCalling } from './CurrentSacrament';

function currentAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const bd = new Date(birthDate + 'T12:00:00');
  let age = today.getFullYear() - bd.getFullYear();
  const m = today.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
  return age;
}

function ageGroup(birthDate: string | null | undefined): 'adult' | 'youth' | 'child' {
  if (!birthDate) return 'adult'; // unknown = treat as adult
  const birthYear = parseInt(birthDate.slice(0, 4));
  const ageThisYear = new Date().getFullYear() - birthYear;
  if (ageThisYear < 12) return 'child';
  if (ageThisYear < 18) return 'youth';
  return 'adult';
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function AgendaLink({ date, children, className, onOpen }: { date: string; children: React.ReactNode; className?: string; onOpen: (date: string) => void }) {
  return (
    <button type="button" className={className} onClick={e => { e.stopPropagation(); onOpen(date); }}>
      {children}
    </button>
  );
}

function AgendaOverlayModal({ date, onClose }: { date: string; onClose: () => void }) {
  const speakers      = useTable<SacramentSpeaker>('sacrament-speakers');
  const prayers       = useTable<Prayer>('prayers');
  const music         = useTable<SacramentMusic>('sacrament-music');
  const themes        = useTable<SacramentTheme>('sacrament-themes');
  const announcements = useTable<SacramentAnnouncement>('sacrament-announcements');
  const notes         = useTable<SacramentAgendaNote>('sacrament-agenda-notes');
  const wardBusiness  = useTable<SacramentWardBusiness>('sacrament-ward-business');

  const wbRow = wardBusiness.rows.find(r => r.meeting_date?.slice(0, 10) === date);

  const parseSnapshot = (json: string): AgendaCalling[] => {
    try { return JSON.parse(json); } catch { return []; }
  };
  const sustainings:   AgendaCalling[] = parseSnapshot(wbRow?.sustainings_snapshot  ?? '[]');
  const thanksgivings: AgendaCalling[] = parseSnapshot(wbRow?.thanksgivings_snapshot ?? '[]');

  const onSaveSnapshot = async (s: AgendaCalling[], t: AgendaCalling[]) => {
    const data = { meeting_date: date, sustainings_snapshot: JSON.stringify(s), thanksgivings_snapshot: JSON.stringify(t) };
    if (wbRow) await wardBusiness.update(wbRow.id, data);
    else await wardBusiness.create(data);
  };

  const isLoading = speakers.isLoading || prayers.isLoading || music.isLoading || themes.isLoading || announcements.isLoading || notes.isLoading;
  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-4 px-4 pb-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[94vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
          <h2 className="font-semibold text-gray-900">Sacrament Meeting — {dateLabel}</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {isLoading ? (
            <p className="text-gray-400 text-sm">Loading…</p>
          ) : (
            <AgendaEditor
              date={date}
              speakers={speakers}
              prayers={prayers}
              music={music}
              themes={themes}
              announcements={announcements}
              notes={notes}
              sustainings={sustainings}
              thanksgivings={thanksgivings}
              onSaveSnapshot={onSaveSnapshot}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function NoteField({ name, category, notes, onSave }: { name: string; category: string; notes: Map<string, string>; onSave: (name: string, category: string, text: string) => void }) {
  const key = `${category}:${name}`;
  const current = notes.get(key) ?? '';
  const [text, setText] = useState(current);
  const saved = useRef(current);

  useEffect(() => {
    const v = notes.get(key) ?? '';
    if (v !== saved.current) { setText(v); saved.current = v; }
  }, [notes, key]);

  const handleBlur = () => {
    if (text !== saved.current) { saved.current = text; onSave(name, category, text); }
  };

  return (
    <div onClick={e => e.stopPropagation()}>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={handleBlur}
        rows={1}
        placeholder="Notes…"
        className="w-full text-xs rounded border border-gray-200 px-2 py-1 text-gray-700 placeholder-gray-300 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white focus:rows-3"
      />
    </div>
  );
}

type SortDir = 'asc' | 'desc';

function SortHeader({ label, active, dir, onClick, className }: {
  label: string; active: boolean; dir: SortDir; onClick: () => void; className?: string;
}) {
  return (
    <th className={`text-left px-3 py-2 font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900 whitespace-nowrap ${className ?? ''}`}
      onClick={onClick}>
      {label}
      <span className="ml-1 text-gray-400 text-xs">{active ? (dir === 'asc' ? '↑' : '↓') : '↕'}</span>
    </th>
  );
}

// ─── Speakers tab ─────────────────────────────────────────────────────────────

interface SpeakerRow {
  name: string;
  dates: string[];   // sorted desc
  count: number;
  lastDate: string;
}

interface SpeakerRowEx extends SpeakerRow { age: number | null; }

function SpeakerDatesChips({ r, onDateClick }: { r: SpeakerRowEx; onDateClick: (date: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {r.dates.map(d => (
        <AgendaLink key={d} date={d} onOpen={onDateClick} className="text-xs bg-blue-50 text-blue-700 rounded px-2 py-0.5 hover:bg-blue-100 transition-colors">{formatDate(d)}</AgendaLink>
      ))}
    </div>
  );
}

function SpeakerTable({ rows, notes, onSaveNote, expanded, setExpanded, sortKey, sortDir, toggle, memberMap, onUpdateMember, onDateClick }: {
  rows: SpeakerRowEx[];
  notes: Map<string, string>;
  onSaveNote: (name: string, category: string, text: string) => void;
  expanded: string | null;
  setExpanded: (n: string | null) => void;
  sortKey: 'name' | 'count' | 'lastDate';
  sortDir: SortDir;
  toggle: (k: 'name' | 'count' | 'lastDate') => void;
  memberMap: Map<string, WardMember>;
  onUpdateMember: (id: number, data: Record<string, unknown>) => void;
  onDateClick: (date: string) => void;
}) {
  return (
    <>
      <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <SortHeader label="Name" active={sortKey === 'name'} dir={sortDir} onClick={() => toggle('name')} />
              <SortHeader label="Times" active={sortKey === 'count'} dir={sortDir} onClick={() => toggle('count')} className="w-20 text-center" />
              <SortHeader label="Most Recent" active={sortKey === 'lastDate'} dir={sortDir} onClick={() => toggle('lastDate')} />
              <th className="px-3 py-2 text-left font-medium text-gray-600 w-56">Notes</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600 w-28">Include</th>
              <th className="px-3 py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-4 text-center text-sm text-gray-400">No results</td></tr>
            )}
            {rows.map(r => {
              const wm = memberMap.get(r.name);
              const excluded = wm?.exclude_speakers ?? false;
              return (
                <>
                  <tr key={r.name} className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${excluded ? 'opacity-50' : ''}`}
                    onClick={() => setExpanded(expanded === r.name ? null : r.name)}>
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {r.name}
                      {r.age !== null && <span className="text-xs text-gray-400 font-normal ml-1.5">age {r.age}</span>}
                    </td>
                    <td className="px-3 py-2 text-center text-gray-600">{r.count}</td>
                    <td className="px-3 py-2 text-gray-600">{formatDate(r.lastDate)}</td>
                    <td className="px-3 py-1.5"><NoteField name={r.name} category="speaker" notes={notes} onSave={onSaveNote} /></td>
                    <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                      {wm && (
                        <button onClick={() => onUpdateMember(wm.id, { exclude_speakers: excluded ? 0 : 1 })}
                          className={`text-xs px-2 py-0.5 rounded-full ${excluded ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                          {excluded ? 'Excluded' : 'Included'}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-400 text-xs">{expanded === r.name ? '▲' : '▼'}</td>
                  </tr>
                  {expanded === r.name && (
                    <tr key={`${r.name}-exp`} className="bg-gray-50 border-b border-gray-100">
                      <td colSpan={6} className="px-6 py-2">
                        <SpeakerDatesChips r={r} onDateClick={onDateClick} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-2">
        {rows.length === 0 && <p className="text-center text-sm text-gray-400 py-4">No results</p>}
        {rows.map(r => {
          const wm = memberMap.get(r.name);
          const excluded = wm?.exclude_speakers ?? false;
          const isOpen = expanded === r.name;
          return (
            <div key={r.name} className={`rounded-lg border border-gray-200 p-3 ${excluded ? 'opacity-50' : 'bg-white'}`}>
              <div className="flex items-start justify-between gap-2 cursor-pointer" onClick={() => setExpanded(isOpen ? null : r.name)}>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {r.name}
                    {r.age !== null && <span className="text-xs text-gray-400 font-normal ml-1.5">age {r.age}</span>}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{r.count} time{r.count === 1 ? '' : 's'} · Most recent {formatDate(r.lastDate) || '—'}</p>
                </div>
                <span className="text-gray-400 text-xs shrink-0">{isOpen ? '▲' : '▼'}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1"><NoteField name={r.name} category="speaker" notes={notes} onSave={onSaveNote} /></div>
                {wm && (
                  <button onClick={() => onUpdateMember(wm.id, { exclude_speakers: excluded ? 0 : 1 })}
                    className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${excluded ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                    {excluded ? 'Excluded' : 'Included'}
                  </button>
                )}
              </div>
              {isOpen && <div className="mt-2 pt-2 border-t border-gray-100"><SpeakerDatesChips r={r} onDateClick={onDateClick} /></div>}
            </div>
          );
        })}
      </div>
    </>
  );
}

function SpeakersTab({ speakers, notes, onSaveNote, activeMembers, wardMembers, onUpdateMember, onDateClick }: {
  speakers: SacramentSpeaker[];
  notes: Map<string, string>;
  onSaveNote: (name: string, category: string, text: string) => void;
  activeMembers: Set<string>;
  wardMembers: WardMember[];
  onUpdateMember: (id: number, data: Record<string, unknown>) => void;
  onDateClick: (date: string) => void;
}) {
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<'name' | 'count' | 'lastDate'>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expanded, setExpanded] = useState<string | null>(null);

  const memberMap = useMemo(() => {
    const m = new Map<string, WardMember>();
    for (const wm of wardMembers) m.set(wm.name, wm);
    return m;
  }, [wardMembers]);

  const birthDateMap = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const wm of wardMembers) m.set(wm.name, wm.birth_date);
    return m;
  }, [wardMembers]);

  const rows = useMemo<SpeakerRowEx[]>(() => {
    const map = new Map<string, string[]>();
    for (const s of speakers) {
      if (!s.speaker?.trim()) continue;
      const name = s.speaker.trim();
      if (activeMembers.size > 0 && !activeMembers.has(name)) continue;
      const existing = map.get(name) ?? [];
      existing.push(s.meeting_date?.slice(0, 10) ?? '');
      map.set(name, existing);
    }
    if (activeMembers.size > 0) {
      for (const name of activeMembers) {
        if (!map.has(name)) map.set(name, []);
      }
    }
    return Array.from(map.entries()).map(([name, dates]) => {
      const sorted = [...new Set(dates)].filter(Boolean).sort((a, b) => b.localeCompare(a));
      return { name, dates: sorted, count: sorted.length, lastDate: sorted[0] ?? '', age: currentAge(birthDateMap.get(name)) };
    });
  }, [speakers, activeMembers, birthDateMap]);

  const [onlyWithHistory, setOnlyWithHistory] = useState(false);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    return rows.filter(r => (!q || r.name.toLowerCase().includes(q)) && (!onlyWithHistory || r.count > 0));
  }, [rows, filter, onlyWithHistory]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'count') cmp = a.count - b.count;
      else cmp = a.lastDate.localeCompare(b.lastDate);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const toggle = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const adults   = sorted.filter(r => ageGroup(birthDateMap.get(r.name)) === 'adult');
  const youth    = sorted.filter(r => ageGroup(birthDateMap.get(r.name)) === 'youth');
  const children = sorted.filter(r => ageGroup(birthDateMap.get(r.name)) === 'child');

  const tableProps = { notes, onSaveNote, expanded, setExpanded, sortKey, sortDir, toggle, memberMap, onUpdateMember, onDateClick };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Search by name…"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm w-full max-w-sm" />
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none whitespace-nowrap">
          <input type="checkbox" checked={onlyWithHistory} onChange={e => setOnlyWithHistory(e.target.checked)}
            className="rounded border-gray-300" />
          Has spoken
        </label>
      </div>

      {adults.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1 mb-2">Adults <span className="font-normal normal-case text-gray-400">({adults.length})</span></h2>
          <SpeakerTable rows={adults} {...tableProps} />
        </div>
      )}
      {youth.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1 mb-2">Youth <span className="font-normal normal-case text-gray-400">({youth.length})</span></h2>
          <SpeakerTable rows={youth} {...tableProps} />
        </div>
      )}
      {children.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1 mb-2">Children <span className="font-normal normal-case text-gray-400">({children.length})</span></h2>
          <SpeakerTable rows={children} {...tableProps} />
        </div>
      )}
      <p className="text-xs text-gray-400">{sorted.length} {sorted.length === 1 ? 'person' : 'people'}</p>
    </div>
  );
}

// ─── Prayers tab ──────────────────────────────────────────────────────────────

interface PrayerRow {
  name: string;
  openingDates: string[];
  closingDates: string[];
  count: number;
  lastDate: string;
}

interface PrayerRowEx extends PrayerRow { age: number | null; }

function PrayerDatesChips({ r, onDateClick }: { r: PrayerRowEx; onDateClick: (date: string) => void }) {
  return (
    <div className="space-y-2">
      {r.openingDates.length > 0 && (
        <div>
          <span className="text-xs font-semibold text-gray-500 mr-2">Opening:</span>
          <span className="flex flex-wrap gap-1.5 mt-1">
            {r.openingDates.map(d => (
              <AgendaLink key={d} date={d} onOpen={onDateClick} className="text-xs bg-green-50 text-green-700 rounded px-2 py-0.5 hover:bg-green-100 transition-colors">{formatDate(d)}</AgendaLink>
            ))}
          </span>
        </div>
      )}
      {r.closingDates.length > 0 && (
        <div>
          <span className="text-xs font-semibold text-gray-500 mr-2">Closing:</span>
          <span className="flex flex-wrap gap-1.5 mt-1">
            {r.closingDates.map(d => (
              <AgendaLink key={d} date={d} onOpen={onDateClick} className="text-xs bg-purple-50 text-purple-700 rounded px-2 py-0.5 hover:bg-purple-100 transition-colors">{formatDate(d)}</AgendaLink>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}

function PrayerTable({ rows, notes, onSaveNote, expanded, setExpanded, sortKey, sortDir, toggle, memberMap, onUpdateMember, onDateClick }: {
  rows: PrayerRowEx[];
  notes: Map<string, string>;
  onSaveNote: (name: string, category: string, text: string) => void;
  expanded: string | null;
  setExpanded: (n: string | null) => void;
  sortKey: 'name' | 'count' | 'lastDate';
  sortDir: SortDir;
  toggle: (k: 'name' | 'count' | 'lastDate') => void;
  memberMap: Map<string, WardMember>;
  onUpdateMember: (id: number, data: Record<string, unknown>) => void;
  onDateClick: (date: string) => void;
}) {
  return (
    <>
      <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <SortHeader label="Name" active={sortKey === 'name'} dir={sortDir} onClick={() => toggle('name')} />
              <SortHeader label="Total" active={sortKey === 'count'} dir={sortDir} onClick={() => toggle('count')} className="w-20 text-center" />
              <SortHeader label="Most Recent" active={sortKey === 'lastDate'} dir={sortDir} onClick={() => toggle('lastDate')} />
              <th className="px-3 py-2 text-left font-medium text-gray-600 w-56">Notes</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600 w-28">Include</th>
              <th className="px-3 py-2 w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-4 text-center text-sm text-gray-400">No results</td></tr>
            )}
            {rows.map(r => {
              const wm = memberMap.get(r.name);
              const excluded = wm?.exclude_prayers ?? false;
              return (
                <>
                  <tr key={r.name} className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${excluded ? 'opacity-50' : ''}`}
                    onClick={() => setExpanded(expanded === r.name ? null : r.name)}>
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {r.name}
                      {r.age !== null && <span className="text-xs text-gray-400 font-normal ml-1.5">age {r.age}</span>}
                    </td>
                    <td className="px-3 py-2 text-center text-gray-600">{r.count}</td>
                    <td className="px-3 py-2 text-gray-600">{formatDate(r.lastDate)}</td>
                    <td className="px-3 py-1.5"><NoteField name={r.name} category="prayer" notes={notes} onSave={onSaveNote} /></td>
                    <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                      {wm && (
                        <button onClick={() => onUpdateMember(wm.id, { exclude_prayers: excluded ? 0 : 1 })}
                          className={`text-xs px-2 py-0.5 rounded-full ${excluded ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                          {excluded ? 'Excluded' : 'Included'}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-400 text-xs">{expanded === r.name ? '▲' : '▼'}</td>
                  </tr>
                  {expanded === r.name && (
                    <tr key={`${r.name}-exp`} className="bg-gray-50 border-b border-gray-100">
                      <td colSpan={6} className="px-6 py-2">
                        <PrayerDatesChips r={r} onDateClick={onDateClick} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-2">
        {rows.length === 0 && <p className="text-center text-sm text-gray-400 py-4">No results</p>}
        {rows.map(r => {
          const wm = memberMap.get(r.name);
          const excluded = wm?.exclude_prayers ?? false;
          const isOpen = expanded === r.name;
          return (
            <div key={r.name} className={`rounded-lg border border-gray-200 p-3 ${excluded ? 'opacity-50' : 'bg-white'}`}>
              <div className="flex items-start justify-between gap-2 cursor-pointer" onClick={() => setExpanded(isOpen ? null : r.name)}>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {r.name}
                    {r.age !== null && <span className="text-xs text-gray-400 font-normal ml-1.5">age {r.age}</span>}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{r.count} total · Most recent {formatDate(r.lastDate) || '—'}</p>
                </div>
                <span className="text-gray-400 text-xs shrink-0">{isOpen ? '▲' : '▼'}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1"><NoteField name={r.name} category="prayer" notes={notes} onSave={onSaveNote} /></div>
                {wm && (
                  <button onClick={() => onUpdateMember(wm.id, { exclude_prayers: excluded ? 0 : 1 })}
                    className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${excluded ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                    {excluded ? 'Excluded' : 'Included'}
                  </button>
                )}
              </div>
              {isOpen && <div className="mt-2 pt-2 border-t border-gray-100"><PrayerDatesChips r={r} onDateClick={onDateClick} /></div>}
            </div>
          );
        })}
      </div>
    </>
  );
}

function PrayersTab({ prayers, notes, onSaveNote, activeMembers, wardMembers, onUpdateMember, onDateClick }: {
  prayers: Prayer[];
  notes: Map<string, string>;
  onSaveNote: (name: string, category: string, text: string) => void;
  activeMembers: Set<string>;
  wardMembers: WardMember[];
  onUpdateMember: (id: number, data: Record<string, unknown>) => void;
  onDateClick: (date: string) => void;
}) {
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<'name' | 'count' | 'lastDate'>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expanded, setExpanded] = useState<string | null>(null);

  const memberMap = useMemo(() => {
    const m = new Map<string, WardMember>();
    for (const wm of wardMembers) m.set(wm.name, wm);
    return m;
  }, [wardMembers]);

  const birthDateMap = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const wm of wardMembers) m.set(wm.name, wm.birth_date);
    return m;
  }, [wardMembers]);

  const rows = useMemo<PrayerRowEx[]>(() => {
    const map = new Map<string, { opening: string[]; closing: string[] }>();
    for (const p of prayers) {
      if (!p.name?.trim()) continue;
      const name = p.name.trim();
      if (activeMembers.size > 0 && !activeMembers.has(name)) continue;
      const entry = map.get(name) ?? { opening: [], closing: [] };
      const date = p.meeting_date?.slice(0, 10) ?? '';
      if (date) {
        if (p.opening_closing?.toLowerCase().includes('open')) entry.opening.push(date);
        else entry.closing.push(date);
      }
      map.set(name, entry);
    }
    if (activeMembers.size > 0) {
      for (const name of activeMembers) {
        if (!map.has(name)) map.set(name, { opening: [], closing: [] });
      }
    }
    return Array.from(map.entries()).map(([name, { opening, closing }]) => {
      const allDates = [...new Set([...opening, ...closing])].filter(Boolean).sort((a, b) => b.localeCompare(a));
      return {
        name,
        openingDates: [...new Set(opening)].sort((a, b) => b.localeCompare(a)),
        closingDates: [...new Set(closing)].sort((a, b) => b.localeCompare(a)),
        count: allDates.length,
        lastDate: allDates[0] ?? '',
        age: currentAge(birthDateMap.get(name)),
      };
    });
  }, [prayers, activeMembers, birthDateMap]);

  const [onlyWithHistory, setOnlyWithHistory] = useState(false);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    return rows.filter(r => (!q || r.name.toLowerCase().includes(q)) && (!onlyWithHistory || r.count > 0));
  }, [rows, filter, onlyWithHistory]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'count') cmp = a.count - b.count;
      else cmp = a.lastDate.localeCompare(b.lastDate);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const toggle = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const adults   = sorted.filter(r => ageGroup(birthDateMap.get(r.name)) === 'adult');
  const youth    = sorted.filter(r => ageGroup(birthDateMap.get(r.name)) === 'youth');
  const children = sorted.filter(r => ageGroup(birthDateMap.get(r.name)) === 'child');

  const tableProps = { notes, onSaveNote, expanded, setExpanded, sortKey, sortDir, toggle, memberMap, onUpdateMember, onDateClick };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Search by name…"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm w-full max-w-sm" />
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none whitespace-nowrap">
          <input type="checkbox" checked={onlyWithHistory} onChange={e => setOnlyWithHistory(e.target.checked)}
            className="rounded border-gray-300" />
          Has prayed
        </label>
      </div>

      {adults.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1 mb-2">Adults <span className="font-normal normal-case text-gray-400">({adults.length})</span></h2>
          <PrayerTable rows={adults} {...tableProps} />
        </div>
      )}
      {youth.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1 mb-2">Youth <span className="font-normal normal-case text-gray-400">({youth.length})</span></h2>
          <PrayerTable rows={youth} {...tableProps} />
        </div>
      )}
      {children.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1 mb-2">Children <span className="font-normal normal-case text-gray-400">({children.length})</span></h2>
          <PrayerTable rows={children} {...tableProps} />
        </div>
      )}
      <p className="text-xs text-gray-400">{sorted.length} {sorted.length === 1 ? 'person' : 'people'}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const HORIZONS: { label: string; months: number | null }[] = [
  { label: '6 months', months: 6 },
  { label: '1 year',   months: 12 },
  { label: '2 years',  months: 24 },
  { label: '3 years',  months: 36 },
  { label: 'All time', months: null },
];

function cutoffDate(months: number | null): string {
  if (months === null) return '';
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

export default function SpeakersAndPrayers() {
  const [tab, setTab] = useState<'speakers' | 'prayers'>('speakers');
  const [horizonMonths, setHorizonMonths] = useState<number | null>(24);
  const [previewDate, setPreviewDate] = useState<string | null>(null);
  const { rows: speakers, isLoading: loadingSpeakers } = useTable<SacramentSpeaker>('sacrament-speakers');
  const { rows: prayers, isLoading: loadingPrayers } = useTable<Prayer>('prayers');
  const { rows: wardMembers, isLoading: loadingMembers, update: updateMember } = useTable<WardMember>('ward-members');
  const [notes, setNotes] = useState<Map<string, string>>(new Map());

  // All active members appear in both lists; excluded ones are dimmed with a toggle to re-include
  const speakerMembers = useMemo(
    () => new Set(wardMembers.filter(m => m.active).map(m => m.name)),
    [wardMembers]
  );

  const prayerMembers = useMemo(
    () => new Set(wardMembers.filter(m => m.active).map(m => m.name)),
    [wardMembers]
  );

  const handleUpdateMember = useCallback((id: number, data: Record<string, unknown>) => {
    updateMember(id, data);
  }, [updateMember]);

  useEffect(() => {
    api.speakerNotes.getAll().then(rows => {
      setNotes(new Map(rows.map(r => [`${r.category}:${r.person_name}`, r.notes])));
    }).catch(() => {});
  }, []);

  const handleSaveNote = useCallback((name: string, category: string, text: string) => {
    api.speakerNotes.save(name, category, text).catch(() => {});
    setNotes(prev => new Map(prev).set(`${category}:${name}`, text));
  }, []);

  const isLoading = loadingSpeakers || loadingPrayers || loadingMembers;

  const cutoff = cutoffDate(horizonMonths);
  const filteredSpeakers = useMemo(
    () => cutoff ? speakers.filter(s => (s.meeting_date ?? '').slice(0, 10) >= cutoff) : speakers,
    [speakers, cutoff]
  );
  const filteredPrayers = useMemo(
    () => cutoff ? prayers.filter(p => (p.meeting_date ?? '').slice(0, 10) >= cutoff) : prayers,
    [prayers, cutoff]
  );

  return (
    <div>
      {previewDate && <AgendaOverlayModal date={previewDate} onClose={() => setPreviewDate(null)} />}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Speakers &amp; Prayers</h1>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 hidden sm:inline">Show:</span>
          <div className="flex rounded-md border border-gray-300 overflow-hidden">
            {HORIZONS.map(h => (
              <button key={String(h.months)} onClick={() => setHorizonMonths(h.months)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors border-r last:border-r-0 border-gray-300 ${
                  horizonMonths === h.months ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}>
                {h.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-4 border-b border-gray-200">
        <button
          onClick={() => setTab('speakers')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'speakers' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}>
          Speakers
        </button>
        <button
          onClick={() => setTab('prayers')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'prayers' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}>
          Prayers
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : tab === 'speakers' ? (
        <SpeakersTab speakers={filteredSpeakers} notes={notes} onSaveNote={handleSaveNote} activeMembers={speakerMembers} wardMembers={wardMembers} onUpdateMember={handleUpdateMember} onDateClick={setPreviewDate} />
      ) : (
        <PrayersTab prayers={filteredPrayers} notes={notes} onSaveNote={handleSaveNote} activeMembers={prayerMembers} wardMembers={wardMembers} onUpdateMember={handleUpdateMember} onDateClick={setPreviewDate} />
      )}
    </div>
  );
}
