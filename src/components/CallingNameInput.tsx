import { useMemo, useRef, useState, useId } from 'react';
import { useTable } from '../lib/useTable';
import type { MemberCalling, UnfilledCalling } from '../lib/api';
import { CALLING_GROUPS, callingGroups, isStakeLeadership, type CallingGroup } from '../lib/callingGroups';

const MAX_SUGGESTIONS = 10;
/** With a filter on, show more so a whole organization can be browsed. */
const MAX_FILTERED = 150;

interface KnownCalling { calling: string; organization: string; groups: CallingGroup[]; unfilled: boolean }

const pillClass = (on: boolean) =>
  `text-xs px-2 py-0.5 rounded-full border transition-colors ${on
    ? 'bg-blue-600 border-blue-600 text-white'
    : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-700'}`;

/**
 * A calling field that suggests the ward's callings from LCR (filled and unfilled)
 * as you type (hub suggestion #40). Picking one fills in its handbook organization too.
 * Pills under the field (shown while it's in use) filter the suggestions by organization (grouped the way the
 * General Handbook organizes a ward) and to unfilled callings; with a filter on,
 * clicking into the empty field lists every matching calling.
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
  const { rows: unfilledRows } = useTable<UnfilledCalling>('unfilled-callings');
  const [open, setOpen] = useState(false);
  // Filter pills only show while the field is in use, to keep the modal compact.
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [orgFilter, setOrgFilter] = useState<CallingGroup[]>([]);
  const [unfilledOnly, setUnfilledOnly] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // One entry per distinct calling + organization; marked unfilled when LCR lists it as vacant.
  const known = useMemo(() => {
    const seen = new Map<string, KnownCalling>();
    const add = (rawCalling: string | null, rawOrg: string | null, unfilled: boolean) => {
      const calling = (rawCalling || '').trim();
      if (!calling) return;
      const organization = (rawOrg || '').trim();
      if (isStakeLeadership(calling, organization)) return;
      const key = `${calling.toLowerCase()}|${organization.toLowerCase()}`;
      const prev = seen.get(key);
      if (prev) { if (unfilled) prev.unfilled = true; return; }
      seen.set(key, { calling, organization, groups: callingGroups(calling, organization), unfilled });
    };
    for (const c of filled) add(c.calling, c.organization, false);
    for (const c of unfilledRows) add(c.calling, c.organization, true);
    return [...seen.values()].sort((a, b) => a.calling.localeCompare(b.calling) || a.organization.localeCompare(b.organization));
  }, [filled, unfilledRows]);

  const orgs = useMemo(() => {
    const present = new Set(known.flatMap(k => k.groups));
    return CALLING_GROUPS.filter(g => present.has(g));
  }, [known]);
  const unfilledCount = useMemo(() => known.filter(k => k.unfilled).length, [known]);

  const filtering = orgFilter.length > 0 || unfilledOnly;
  const query = value.replace(/\*\*/g, '').trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!query && !filtering) return [];
    const words = query ? query.split(/\s+/) : [];
    return known
      .filter(k => orgFilter.length === 0 || k.groups.some(g => orgFilter.includes(g)))
      .filter(k => !unfilledOnly || k.unfilled)
      .filter(k => {
        const hay = `${k.calling} ${k.organization} ${k.groups.join(' ')}`.toLowerCase();
        return words.every(w => hay.includes(w));
      })
      // Callings that start with what's typed come first.
      .sort((a, b) => query
        ? Number(!a.calling.toLowerCase().startsWith(query)) - Number(!b.calling.toLowerCase().startsWith(query))
        : 0)
      .slice(0, filtering ? MAX_FILTERED : MAX_SUGGESTIONS);
  }, [query, known, filtering, orgFilter, unfilledOnly]);

  const exactOnly = suggestions.length === 1 && suggestions[0].calling.toLowerCase() === query;
  const showList = open && suggestions.length > 0 && !exactOnly;

  const pick = (k: KnownCalling) => {
    onChange(k.calling);
    onPick(k.groups[0]);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleChange = (v: string) => {
    onChange(v);
    setOpen(true);
    setHighlight(0);
    // Typing a known calling in full fills its organization when there's only one.
    const matches = known.filter(k => k.calling.toLowerCase() === v.trim().toLowerCase());
    if (matches.length === 1) onPick(matches[0].groups[0]);
  };

  // After a pill changes the filter, show the updated list right away.
  const refocus = () => { setHighlight(0); inputRef.current?.focus(); setOpen(true); };
  const toggleOrg = (o: CallingGroup) => {
    setOrgFilter(f => f.includes(o) ? f.filter(x => x !== o) : [...f, o]);
    refocus();
  };

  return (
    <div className="block relative">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div>
        <input
          ref={inputRef}
          value={value}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          placeholder={filtering ? 'Click to see matching callings, or type…' : 'Type to search, or pick filters below…'}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          onChange={e => handleChange(e.target.value)}
          onFocus={() => { setFocused(true); setOpen(true); }}
          onClick={() => setOpen(true)}
          onBlur={() => { setFocused(false); setOpen(false); }}
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
      </div>
      {!focused && filtering && (
        <p className="mt-1 text-xs text-blue-700">Filtered: {[...(unfilledOnly ? ['Unfilled only'] : []), ...orgFilter].join(', ')}</p>
      )}
      {focused && known.length > 0 && (
        // onMouseDown preventDefault keeps focus in the field so the list stays open while filtering.
        <div className="mt-1.5 flex flex-wrap items-center gap-1" onMouseDown={e => e.preventDefault()}>
          <span className="text-xs text-gray-500 mr-0.5">Filter:</span>
          <button type="button" className={pillClass(unfilledOnly)} aria-pressed={unfilledOnly}
            onClick={() => { setUnfilledOnly(u => !u); refocus(); }}>
            Unfilled only ({unfilledCount})
          </button>
          <span className="text-gray-300 mx-0.5">|</span>
          {orgs.map(o => (
            <button key={o} type="button" className={pillClass(orgFilter.includes(o))} aria-pressed={orgFilter.includes(o)}
              onClick={() => toggleOrg(o)}>
              {o}
            </button>
          ))}
          {filtering && (
            <button type="button" className="text-xs text-blue-600 hover:underline ml-1"
              onClick={() => { setOrgFilter([]); setUnfilledOnly(false); refocus(); }}>
              Clear
            </button>
          )}
        </div>
      )}
      {showList && (
        <ul id={listId} role="listbox"
          className="absolute z-50 left-0 right-0 top-full mt-1 max-h-64 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg text-sm">
          {suggestions.map((k, i) => (
            <li key={`${k.calling}|${k.organization}`} role="option" aria-selected={i === highlight}
              // onMouseDown (not onClick) so the pick lands before the input's blur closes the list.
              onMouseDown={e => { e.preventDefault(); pick(k); }}
              onMouseEnter={() => setHighlight(i)}
              className={`px-3 py-1.5 cursor-pointer flex items-baseline gap-2 ${i === highlight ? 'bg-blue-50 text-blue-800' : 'text-gray-800'}`}>
              <span>{k.calling}</span>
              <span className="text-xs text-gray-400">{k.groups.join(' · ')}</span>
              {k.unfilled && <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-amber-700 bg-amber-50 rounded px-1">Unfilled</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
