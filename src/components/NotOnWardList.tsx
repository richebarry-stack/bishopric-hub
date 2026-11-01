import { useState, type ReactNode } from 'react';
import type { WardMember } from '../lib/api';
import { displayName } from '../lib/displayName';
import { matchMember } from '../lib/nameMatch';
import MemberNameInput from './MemberNameInput';

/**
 * "Not on ward list" section: names typed somewhere that matched no active ward
 * member, usually a spelling slip. Each item offers the closest ward member and a
 * search box to pick someone else; the page decides what matching rewrites.
 */
export function NotOnWardListSection({ count, intro, children }: { count: number; intro: string; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1 mb-1">Not on ward list <span className="font-normal normal-case text-gray-400">({count})</span></h2>
      <p className="text-xs text-gray-500 px-1 mb-2">{intro}</p>
      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
        {children}
      </div>
    </div>
  );
}

export function NotOnWardListItem({ label, suggestion, nameIndex, minAge, onMatch, children }: {
  label: string;
  suggestion: WardMember | null;
  nameIndex: Map<string, WardMember>;
  /** Passed to the search box so it skips members younger than this. */
  minAge?: number;
  onMatch: (member: WardMember) => Promise<void>;
  /** Right-hand detail, e.g. the dates or entries that use this name. */
  children: ReactNode;
}) {
  const [choosing, setChoosing] = useState(false);
  const [picked, setPicked] = useState('');
  const [busy, setBusy] = useState(false);
  const pickedMember = matchMember(nameIndex, picked);

  const run = async (m: WardMember) => {
    setBusy(true);
    try { await onMatch(m); } finally { setBusy(false); }
  };

  return (
    <div className="px-3 py-2 text-sm flex flex-col md:flex-row md:items-start gap-1 md:gap-4">
      <div className="md:w-72 shrink-0 space-y-1">
        <p className="font-medium text-gray-900">{label}</p>
        {!choosing ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {suggestion ? (
              <button type="button" disabled={busy} onClick={() => run(suggestion)}
                className="rounded bg-blue-600 text-white px-2 py-0.5 hover:bg-blue-700 disabled:opacity-50">
                Match to {displayName(suggestion)}
              </button>
            ) : <span className="text-gray-500">No close match</span>}
            <button type="button" disabled={busy} onClick={() => setChoosing(true)}
              className="text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50">
              {suggestion ? 'Someone else…' : 'Choose…'}
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <MemberNameInput value={picked} onChange={setPicked} showNote={false} minAge={minAge} placeholder="Search the ward list…"
              className="block w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
            <div className="flex items-center gap-2 text-xs">
              <button type="button" disabled={!pickedMember || busy} onClick={() => pickedMember && run(pickedMember)}
                className="rounded bg-blue-600 text-white px-2 py-0.5 hover:bg-blue-700 disabled:opacity-40">
                {pickedMember ? `Match to ${displayName(pickedMember)}` : 'Match'}
              </button>
              <button type="button" onClick={() => { setChoosing(false); setPicked(''); }}
                className="text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
          </div>
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
