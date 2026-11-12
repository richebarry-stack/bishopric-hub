import { useEffect, useMemo, useRef, useState, useId } from 'react';
import { useTable } from '../lib/useTable';
import type { MemberCalling, UnfilledCalling } from '../lib/api';
import { CALLING_GROUPS, callingGroups, type CallingGroup } from '../lib/callingGroups';

const MAX_SUGGESTIONS = 10;
/** With an organization filter on, show more so the whole org can be browsed. */
const MAX_FILTERED = 100;

interface KnownCalling { calling: string; organization: string; groups: CallingGroup[] }

/**
 * A calling field that suggests the ward's callings from LCR (filled and unfilled)
 * as you type (hub suggestion #40). Picking one fills in its handbook organization too.
 * The Filter button limits suggestions to chosen organizations (grouped the way the
 * General Handbook organizes a ward, not by LCR's section names); with a filter on,
 * clicking into the empty field lists every calling in those organizations.
 * Any other text can still be typed — it doesn't have to be a church-defined calling.
 */
export default function CallingNameInput({ label, value, onChange, onPick }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Called with the calling's handbook organization when a known calling is picked or typed exactly. */
  onPick: (organization: string) => void;
}) {
  const { rows: filled } = useTable<MemberCalling>('member-callings');
  const { rows: unfilled } = useTable<UnfilledCalling>('unfilled-callings');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [orgFilter, setOrgFilter] = useState<CallingGroup[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // One entry per distinct calling + organization.
  const known = useMemo(() => {
    const seen = new Map<string, KnownCalling>();
    for (const c of [...filled, ...unfilled]) {
      const calling = (c.calling || '').trim();
      if (!calling) continue;
      const organization = (c.organization || '').trim();
      const key = `${calling.toLowerCase()}|${organization.toLowerCase()}`;
      if (!seen.has(key)) seen.set(key, { calling, organization, groups: callingGroups(calling, organization) });
    }
    return [...seen.values()].sort((a, b) => a.calling.localeCompare(b.calling) || a.organization.localeCompare(b.organization));
  }, [filled, unfilled]);

  const orgs = useMemo(() => {
    const present = new Set(known.flatMap(k => k.groups));
    return CALLING_GROUPS.filter(g => present.has(g));
  }, [known]);

  // Close the filter panel on a click outside it.
  useEffect(() => {
    if (!filterOpen) return;
    const onDown = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [filterOpen]);

  const filtering = orgFilter.length > 0;
  const query = value.replace(/\*\*/g, '').trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!query && !filtering) return [];
    const words = query ? query.split(/\s+/) : [];
    return known
      .filter(k => !filtering || k.groups.some(g => orgFilter.includes(g)))
      .filter(k => {
        const hay = `${k.calling} ${k.organization}`.toLowerCase();
        return words.every(w => hay.includes(w));
      })
      // Callings that start with what's typed come first.
      .sort((a, b) => query
        ? Number(!a.calling.toLowerCase().startsWith(query)) - Number(!b.calling.toLowerCase().startsWith(query))
        : 0)
      .slice(0, filtering ? MAX_FILTERED : MAX_SUGGESTIONS);
  }, [query, known, filtering, orgFilter]);

  const exactOnly = suggestions.length === 1 && suggestions[0].calling.toLowerCase() === query;
  const showList = open && suggestions.length > 0 && !exactOnly;

  const pick = (k: KnownCalling) => {
    onChange(k.calling);
    onPick(k.groups[0]);
    setOpen(false);
  };

  const handleChange = (v: string) => {
    onChange(v);
    setOpen(true);
    setHighlight(0);
    // Typing a known calling in full fills its organization when there's only one.
    const matches = known.filter(k => k.calling.toLowerCase() === v.trim().toLowerCase());
    if (matches.length === 1) onPick(matches[0].groups[0]);
  };

  const toggleOrg = (o: CallingGroup) => {
    setOrgFilter(f => f.includes(o) ? f.filter(x => x !== o) : [...f, o]);
    setHighlight(0);
  };

  return (
    <div className="block">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {orgs.length > 1 && (
          <div className="relative" ref={filterRef}>
            <button type="button" onClick={() => setFilterOpen(o => !o)} aria-expanded={filterOpen}
              className={`text-xs px-1.5 py-0.5 rounded border ${filtering ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:text-gray-700'}`}>
              Filter{filtering ? ` (${orgFilter.length})` : ''} ▾
            </button>
            {filterOpen && (
              <div className="absolute z-50 right-0 mt-1 w-60 max-h-72 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg p-2 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-500">Organizations</span>
                  {filtering && (
                    <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => setOrgFilter([])}>Clear</button>
                  )}
                </div>
                {orgs.map(o => (
                  <label key={o} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={orgFilter.includes(o)} onChange={() => toggleOrg(o)} />
                    <span className="text-gray-800">{o}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="relative">
        <input
          value={value}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          placeholder={filtering ? 'Click to browse, or type…' : 'Type to search LCR callings…'}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          onChange={e => handleChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={e => {
            if (!showList) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => (h + 1) % suggestions.length); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => (h - 1 + suggestions.length) % suggestions.length); }
            else if (e.key === 'Enter') {
              const k = suggestions[Math.min(highlight, suggestions.length - 1)];
              if (k) { e.preventDefault(); pick(k); }
            } else if (e.key === 'Escape') setOpen(false);
          }}
        />
        {showList && (
          <ul id={listId} role="listbox"
            className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg text-sm">
            {suggestions.map((k, i) => (
              <li key={`${k.calling}|${k.organization}`} role="option" aria-selected={i === highlight}
                // onMouseDown (not onClick) so the pick lands before the input's blur closes the list.
                onMouseDown={e => { e.preventDefault(); pick(k); }}
                onMouseEnter={() => setHighlight(i)}
                className={`px-3 py-1.5 cursor-pointer ${i === highlight ? 'bg-blue-50 text-blue-800' : 'text-gray-800'}`}>
                {k.calling}
                {k.organization && <span className="text-xs text-gray-400 ml-2">{k.organization}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
