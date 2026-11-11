import { useMemo, useState, useId } from 'react';
import { useTable } from '../lib/useTable';
import type { MemberCalling, UnfilledCalling } from '../lib/api';

const MAX_SUGGESTIONS = 10;

interface KnownCalling { calling: string; organization: string }

/**
 * A calling field that suggests the ward's callings from LCR (filled and unfilled)
 * as you type (hub suggestion #40). Picking one fills in its organization too.
 * Any other text can still be typed — it doesn't have to be a church-defined calling.
 */
export default function CallingNameInput({ label, value, onChange, onPick }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Called with the calling's LCR organization when a known calling is picked or typed exactly. */
  onPick: (organization: string) => void;
}) {
  const { rows: filled } = useTable<MemberCalling>('member-callings');
  const { rows: unfilled } = useTable<UnfilledCalling>('unfilled-callings');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const listId = useId();

  // One entry per distinct calling + organization.
  const known = useMemo(() => {
    const seen = new Map<string, KnownCalling>();
    for (const c of [...filled, ...unfilled]) {
      const calling = (c.calling || '').trim();
      if (!calling) continue;
      const organization = (c.organization || '').trim();
      const key = `${calling.toLowerCase()}|${organization.toLowerCase()}`;
      if (!seen.has(key)) seen.set(key, { calling, organization });
    }
    return [...seen.values()].sort((a, b) => a.calling.localeCompare(b.calling) || a.organization.localeCompare(b.organization));
  }, [filled, unfilled]);

  const query = value.replace(/\*\*/g, '').trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!query) return [];
    const words = query.split(/\s+/);
    return known
      .filter(k => {
        const hay = `${k.calling} ${k.organization}`.toLowerCase();
        return words.every(w => hay.includes(w));
      })
      // Callings that start with what's typed come first.
      .sort((a, b) => Number(!a.calling.toLowerCase().startsWith(query)) - Number(!b.calling.toLowerCase().startsWith(query)))
      .slice(0, MAX_SUGGESTIONS);
  }, [query, known]);

  const exactOnly = suggestions.length === 1 && suggestions[0].calling.toLowerCase() === query;
  const showList = open && suggestions.length > 0 && !exactOnly;

  const pick = (k: KnownCalling) => {
    onChange(k.calling);
    if (k.organization) onPick(k.organization);
    setOpen(false);
  };

  const handleChange = (v: string) => {
    onChange(v);
    setOpen(true);
    setHighlight(0);
    // Typing a known calling in full fills its organization when there's only one.
    const matches = known.filter(k => k.calling.toLowerCase() === v.trim().toLowerCase());
    if (matches.length === 1 && matches[0].organization) onPick(matches[0].organization);
  };

  return (
    <div className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="relative">
        <input
          value={value}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          placeholder="Type to search LCR callings…"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          onChange={e => handleChange(e.target.value)}
          onFocus={() => setOpen(true)}
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
