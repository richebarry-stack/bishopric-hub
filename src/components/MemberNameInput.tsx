import { useMemo, useState, useId, type Ref } from 'react';
import { useTable } from '../lib/useTable';
import type { WardMember } from '../lib/api';
import { displayName, legalName, displayFirstLast } from '../lib/displayName';
import { buildNameIndex, matchMember, normalizeNameKey } from '../lib/nameMatch';

/** How a picked member's name is written into the field — matches what each page
 * already stores, so picked names line up with older records. */
export type MemberNameFormat = 'display' | 'legal' | 'firstLast';

const MAX_SUGGESTIONS = 8;

function formatName(m: WardMember, format: MemberNameFormat): string {
  if (format === 'legal') return legalName(m);
  if (format === 'firstLast') return displayFirstLast(m);
  return displayName(m);
}

function nameParts(m: WardMember): string[] {
  return [m.first_name, m.last_name, m.preferred_first_name, m.preferred_last_name]
    .filter((p): p is string => !!p && !!p.trim())
    .flatMap(p => p.toLowerCase().split(/[\s-]+/));
}

function queryTokens(raw: string): string[] {
  return normalizeNameKey(raw).replace(/,/g, ' ').split(' ').filter(Boolean);
}

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Closest active member to a name that didn't match anyone exactly — catches
 * typos like "Diane Krueger" for "Dianne Krueger". */
function closestMember(raw: string, members: WardMember[]): WardMember | undefined {
  const tokens = queryTokens(raw);
  if (tokens.length < 2) return undefined;
  const typed = [...tokens].sort().join(' ');
  let best: WardMember | undefined;
  let bestScore = Infinity;
  for (const m of members) {
    const variants = [
      [m.first_name, m.last_name],
      [m.preferred_first_name?.trim() || m.first_name, m.preferred_last_name?.trim() || m.last_name],
    ];
    for (const [f, l] of variants) {
      const candidate = queryTokens(`${f} ${l}`).sort().join(' ');
      const d = editDistance(typed, candidate);
      if (d < bestScore) { bestScore = d; best = m; }
    }
  }
  // Allow roughly one typo per five letters, and never more than 3.
  const limit = Math.min(3, Math.max(1, Math.floor(typed.length / 5)));
  return bestScore > 0 && bestScore <= limit ? best : undefined;
}

/**
 * A name field that suggests ward members as you type. Picking a suggestion fills in
 * the name exactly as it appears on the ward roster, so the person is recognized on
 * every other page. Anyone not on the roster (visitors, other wards) can still be typed
 * freely; a small note says the name isn't linked and offers a likely match if it's
 * probably a typo.
 */
export default function MemberNameInput({
  value, onChange, format = 'display', placeholder, className, required, inputRef, label, showNote = true,
}: {
  value: string;
  onChange: (v: string) => void;
  format?: MemberNameFormat;
  placeholder?: string;
  className?: string;
  required?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  /** When set, renders the standard form label above the field (like FormFields' Input). */
  label?: string;
  showNote?: boolean;
}) {
  const { rows } = useTable<WardMember>('ward-members');
  const members = useMemo(() => rows.filter(m => m.active), [rows]);
  const index = useMemo(() => buildNameIndex(members), [members]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const listId = useId();

  // Names can carry **bold** markup (Calling Pipeline); match on the plain text.
  const plain = value.replace(/\*\*/g, '');
  const exact = matchMember(index, plain);

  const suggestions = useMemo(() => {
    const tokens = queryTokens(plain);
    if (tokens.length === 0) return [];
    return members
      .filter(m => {
        const parts = nameParts(m);
        return tokens.every(t => parts.some(p => p.startsWith(t)));
      })
      .sort((a, b) => displayName(a).localeCompare(displayName(b)))
      .slice(0, MAX_SUGGESTIONS);
  }, [plain, members]);

  const showList = open && suggestions.length > 0 && !(exact && suggestions.length === 1 && suggestions[0].id === exact.id);
  const guess = !exact && plain.trim() && members.length > 0 ? closestMember(plain, members) : undefined;

  const pick = (m: WardMember) => {
    onChange(formatName(m, format));
    setOpen(false);
  };

  const input = (
    <div className="relative">
      <input
        ref={inputRef}
        value={value}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        className={className ?? 'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}
        onChange={e => { onChange(e.target.value); setOpen(true); setHighlight(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={e => {
          if (!showList) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => (h + 1) % suggestions.length); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => (h - 1 + suggestions.length) % suggestions.length); }
          else if (e.key === 'Enter') {
            const m = suggestions[Math.min(highlight, suggestions.length - 1)];
            if (m) { e.preventDefault(); pick(m); }
          } else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {showList && (
        <ul id={listId} role="listbox"
          className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg text-sm">
          {suggestions.map((m, i) => {
            const shown = displayName(m);
            const legal = legalName(m);
            return (
              <li key={m.id} role="option" aria-selected={i === highlight}
                // onMouseDown (not onClick) so the pick lands before the input's blur closes the list.
                onMouseDown={e => { e.preventDefault(); pick(m); }}
                onMouseEnter={() => setHighlight(i)}
                className={`px-3 py-1.5 cursor-pointer ${i === highlight ? 'bg-blue-50 text-blue-800' : 'text-gray-800'}`}>
                {shown}
                {shown !== legal && <span className="text-xs text-gray-400 ml-2">({legal})</span>}
              </li>
            );
          })}
        </ul>
      )}
      {showNote && !open && plain.trim() && !exact && members.length > 0 && (
        <p className="text-xs text-gray-400 mt-1">
          Not on the ward roster.
          {guess ? (
            <> Did you mean{' '}
              <button type="button" onClick={() => pick(guess)} className="text-blue-600 hover:text-blue-800 hover:underline">
                {formatName(guess, format)}
              </button>?
            </>
          ) : ' Pick a suggestion while typing to link it.'}
        </p>
      )}
    </div>
  );

  if (!label) return input;
  return (
    <div className="block">
      <span className="text-sm font-medium text-gray-700">{label}{required && ' *'}</span>
      {input}
    </div>
  );
}
