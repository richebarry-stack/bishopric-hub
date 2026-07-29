import { useState, useMemo, useCallback } from 'react';
import { useTable } from '../lib/useTable';
import { legalName } from '../lib/displayName';
import type { WardMember, CallingPipeline, MemberCalling, UnfilledCalling } from '../lib/api';

function normCalling(s: string): string {
  return s.trim().toLowerCase();
}

function currentAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const bd = new Date(birthDate + 'T12:00:00');
  let age = today.getFullYear() - bd.getFullYear();
  const m = today.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
  return age;
}

function timeInCalling(sustainedDate: string | null): string | null {
  if (!sustainedDate) return null;
  const start = new Date(sustainedDate.slice(0, 10) + 'T12:00:00');
  if (isNaN(start.getTime())) return null;
  const today = new Date();
  let months = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
  if (today.getDate() < start.getDate()) months--;
  if (months < 0) return null;
  if (months < 1) return '<1 mo';
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (years === 0) return `${months} mo${months === 1 ? '' : 's'}`;
  if (remMonths === 0) return `${years} yr${years === 1 ? '' : 's'}`;
  return `${years} yr${years === 1 ? '' : 's'} ${remMonths} mo${remMonths === 1 ? '' : 's'}`;
}

function isChild(birthDate: string | null): boolean {
  if (!birthDate) return false;
  const ageThisYear = new Date().getFullYear() - parseInt(birthDate.slice(0, 4));
  return ageThisYear < 12;
}

function SortHeader<K extends string>({ label, sortKey, current, asc, onSort, align = 'left', className }: {
  label: string; sortKey: K; current: K; asc: boolean;
  onSort: (k: K) => void; align?: 'left' | 'center'; className?: string;
}) {
  const active = current === sortKey;
  return (
    <th className={`${align === 'center' ? 'text-center' : 'text-left'} px-4 py-2 font-medium text-gray-600 ${className || ''}`}>
      <button type="button" onClick={() => onSort(sortKey)} className="hover:text-gray-900 inline-flex items-center gap-1">
        {label}
        <span className="text-gray-400">{active ? (asc ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
}

type Tab = 'lcr' | 'mwc' | 'unfilled';
type CallingSortKey = 'calling' | 'sustained_date' | 'member' | 'time_in_calling';
type MwcSortKey = 'name' | 'age' | 'pipeline';
type UnfilledSortKey = 'calling' | 'organization';

interface CallingRow extends MemberCalling {
  memberName: string;
}

export default function AllCallings() {
  const { rows: members } = useTable<WardMember>('ward-members');
  const { rows: lcrCallings } = useTable<MemberCalling>('member-callings');
  const { rows: callings, create: createCalling } = useTable<CallingPipeline>('calling-pipeline');
  const { rows: unfilledCallings } = useTable<UnfilledCalling>('unfilled-callings');

  const [tab, setTab] = useState<Tab>('lcr');

  const memberById = useMemo(() => {
    const m = new Map<number, WardMember>();
    for (const w of members) m.set(w.id, w);
    return m;
  }, [members]);

  // Active (not released/declined) Calling rows already tracked in the pipeline.
  const trackedPairs = useMemo(() => {
    const s = new Set<string>();
    for (const c of callings) {
      if (c.type !== 'Calling' || c.ward_member_id === null || c.status === '9. Released' || c.status === '10. Declined') continue;
      s.add(`${c.ward_member_id}|${normCalling(c.calling)}`);
    }
    return s;
  }, [callings]);

  // Members actively being considered for a NEW calling — excludes '7. Need to
  // release', since that's tracking a release from an existing calling, not a
  // pending new one, and shouldn't block "Add for calling consideration".
  const consideredMemberIds = useMemo(() => {
    const s = new Set<number>();
    for (const c of callings) {
      if (c.type !== 'Calling' || c.ward_member_id === null) continue;
      if (['7. Need to release', '9. Released', '10. Declined'].includes(c.status)) continue;
      s.add(c.ward_member_id);
    }
    return s;
  }, [callings]);

  // Vacant callings already added to the pipeline (unassigned, still active).
  const addedUnfilledKeys = useMemo(() => {
    const s = new Set<string>();
    for (const c of callings) {
      if (c.type !== 'Calling' || c.ward_member_id !== null) continue;
      if (['9. Released', '10. Declined'].includes(c.status)) continue;
      s.add(`${normCalling(c.calling)}|${c.organization || ''}`);
    }
    return s;
  }, [callings]);

  const membersWithCallingIds = useMemo(() => new Set(lcrCallings.map(c => c.ward_member_id)), [lcrCallings]);

  const considerForRelease = useCallback((c: MemberCalling, memberName: string) => {
    createCalling({
      member: memberName,
      calling: c.calling,
      organization: c.organization,
      status: '7. Need to release',
      assigned_to: '',
      sustain_recorded: 1,
      set_apart_recorded: c.set_apart ? 1 : 0,
      release_recorded: 0,
      type: 'Calling',
      ward_member_id: c.ward_member_id,
      sustained_date: c.sustained_date,
    } as unknown as Record<string, unknown>);
    // Also start a placeholder entry for finding this person's replacement.
    createCalling({
      member: `Replacement for ${memberName}`,
      calling: c.calling,
      organization: c.organization,
      status: '1. Discussion',
      assigned_to: '',
      sustain_recorded: 0,
      set_apart_recorded: 0,
      release_recorded: 0,
      type: 'Calling',
      ward_member_id: null,
    } as unknown as Record<string, unknown>);
  }, [createCalling]);

  const addForConsideration = useCallback((m: WardMember) => {
    createCalling({
      member: legalName(m),
      calling: '',
      organization: '',
      status: '1. Discussion',
      assigned_to: '',
      sustain_recorded: 0,
      set_apart_recorded: 0,
      release_recorded: 0,
      type: 'Calling',
      ward_member_id: m.id,
    } as unknown as Record<string, unknown>);
  }, [createCalling]);

  const addUnfilledToPipeline = useCallback((c: UnfilledCalling) => {
    createCalling({
      member: '',
      calling: c.calling,
      organization: c.organization,
      status: '1. Discussion',
      assigned_to: '',
      sustain_recorded: 0,
      set_apart_recorded: 0,
      release_recorded: 0,
      type: 'Calling',
      ward_member_id: null,
    } as unknown as Record<string, unknown>);
  }, [createCalling]);

  const [callingSortKey, setCallingSortKey] = useState<CallingSortKey>('member');
  const [callingSortAsc, setCallingSortAsc] = useState(true);
  const handleCallingSort = useCallback((key: CallingSortKey) => {
    if (callingSortKey === key) setCallingSortAsc(a => !a);
    else { setCallingSortKey(key); setCallingSortAsc(true); }
  }, [callingSortKey]);

  const callingRows = useMemo<CallingRow[]>(() => {
    return lcrCallings.map(c => {
      const member = memberById.get(c.ward_member_id);
      return { ...c, memberName: member ? legalName(member) : 'Unknown' };
    });
  }, [lcrCallings, memberById]);

  const sortedCallingRows = useMemo(() => {
    return [...callingRows].sort((a, b) => {
      let va: string | null, vb: string | null;
      if (callingSortKey === 'calling') { va = a.calling; vb = b.calling; }
      else if (callingSortKey === 'sustained_date' || callingSortKey === 'time_in_calling') { va = a.sustained_date; vb = b.sustained_date; }
      else { va = a.memberName; vb = b.memberName; }
      if (va !== vb) {
        if (!va) return 1;
        if (!vb) return -1;
        const cmp = va.localeCompare(vb);
        if (cmp !== 0) return callingSortAsc ? cmp : -cmp;
      }
      return a.memberName.localeCompare(b.memberName);
    });
  }, [callingRows, callingSortKey, callingSortAsc]);

  const [mwcSortKey, setMwcSortKey] = useState<MwcSortKey>('name');
  const [mwcSortAsc, setMwcSortAsc] = useState(true);
  const handleMwcSort = useCallback((key: MwcSortKey) => {
    if (mwcSortKey === key) setMwcSortAsc(a => !a);
    else { setMwcSortKey(key); setMwcSortAsc(true); }
  }, [mwcSortKey]);

  const membersWithoutCalling = useMemo(() => {
    return members.filter(m => m.active && !isChild(m.birth_date) && !membersWithCallingIds.has(m.id));
  }, [members, membersWithCallingIds]);

  const sortedMwc = useMemo(() => {
    return [...membersWithoutCalling].sort((a, b) => {
      if (mwcSortKey === 'name') {
        const cmp = legalName(a).localeCompare(legalName(b));
        return mwcSortAsc ? cmp : -cmp;
      }
      if (mwcSortKey === 'age') {
        const aa = currentAge(a.birth_date);
        const ab = currentAge(b.birth_date);
        if (aa === null && ab === null) return legalName(a).localeCompare(legalName(b));
        if (aa === null) return 1;
        if (ab === null) return -1;
        if (aa !== ab) return mwcSortAsc ? aa - ab : ab - aa;
        return legalName(a).localeCompare(legalName(b));
      }
      // pipeline
      const pa = consideredMemberIds.has(a.id) ? 1 : 0;
      const pb = consideredMemberIds.has(b.id) ? 1 : 0;
      if (pa !== pb) return mwcSortAsc ? pa - pb : pb - pa;
      return legalName(a).localeCompare(legalName(b));
    });
  }, [membersWithoutCalling, mwcSortKey, mwcSortAsc, consideredMemberIds]);

  const [unfilledSortKey, setUnfilledSortKey] = useState<UnfilledSortKey>('organization');
  const [unfilledSortAsc, setUnfilledSortAsc] = useState(true);
  const handleUnfilledSort = useCallback((key: UnfilledSortKey) => {
    if (unfilledSortKey === key) setUnfilledSortAsc(a => !a);
    else { setUnfilledSortKey(key); setUnfilledSortAsc(true); }
  }, [unfilledSortKey]);

  const sortedUnfilled = useMemo(() => {
    return [...unfilledCallings].sort((a, b) => {
      const va = a[unfilledSortKey], vb = b[unfilledSortKey];
      const cmp = va.localeCompare(vb);
      if (cmp !== 0) return unfilledSortAsc ? cmp : -cmp;
      return a.calling.localeCompare(b.calling);
    });
  }, [unfilledCallings, unfilledSortKey, unfilledSortAsc]);

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'lcr', label: 'LCR Callings', count: sortedCallingRows.length },
    { key: 'mwc', label: 'Members Without a Calling', count: sortedMwc.length },
    { key: 'unfilled', label: 'Unfilled Callings', count: sortedUnfilled.length },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">All Callings</h1>
      <p className="text-sm text-gray-500 mb-4">Every calling LCR reports for the ward, members with no calling on record, and vacant callings needing to be filled.</p>

      <div className="flex items-center gap-1 border-b border-gray-200 mb-4">
        {TABS.map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label} <span className="text-gray-400">({t.count})</span>
          </button>
        ))}
      </div>

      {tab === 'lcr' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <SortHeader label="Calling" sortKey="calling" current={callingSortKey} asc={callingSortAsc} onSort={handleCallingSort} />
                <SortHeader label="Sustain Date" sortKey="sustained_date" current={callingSortKey} asc={callingSortAsc} onSort={handleCallingSort} className="w-32" />
                <SortHeader label="Time in Calling" sortKey="time_in_calling" current={callingSortKey} asc={callingSortAsc} onSort={handleCallingSort} className="w-36" />
                <SortHeader label="Member Name" sortKey="member" current={callingSortKey} asc={callingSortAsc} onSort={handleCallingSort} className="w-56" />
                <th className="text-right px-4 py-2 font-medium text-gray-600 w-40">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedCallingRows.map(c => {
                const tracked = trackedPairs.has(`${c.ward_member_id}|${normCalling(c.calling)}`);
                return (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-900">{c.calling}{!!c.set_apart && <span className="ml-1.5 text-xs text-gray-400">Set apart</span>}</td>
                    <td className="px-4 py-2 text-gray-600">{c.sustained_date || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-2 text-gray-600">{timeInCalling(c.sustained_date) || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-2 text-gray-700">{c.memberName}</td>
                    <td className="px-4 py-2 text-right">
                      {tracked ? (
                        <span className="text-xs text-gray-400">Tracked</span>
                      ) : (
                        <button type="button" onClick={() => considerForRelease(c, c.memberName)}
                          title="Start tracking this calling in the Calling Pipeline, flagged as needing release"
                          className="text-xs px-2 py-1 rounded text-orange-600 hover:bg-orange-50">
                          Consider for release
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sortedCallingRows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-sm">No callings yet — run the LCR sync to populate this list.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'mwc' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <SortHeader label="Name" sortKey="name" current={mwcSortKey} asc={mwcSortAsc} onSort={handleMwcSort} />
                <SortHeader label="Age" sortKey="age" current={mwcSortKey} asc={mwcSortAsc} onSort={handleMwcSort} align="center" className="w-20" />
                <SortHeader label="In Calling Pipeline?" sortKey="pipeline" current={mwcSortKey} asc={mwcSortAsc} onSort={handleMwcSort} align="center" className="w-40" />
                <th className="text-right px-4 py-2 font-medium text-gray-600 w-52">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedMwc.map(m => {
                const inPipeline = consideredMemberIds.has(m.id);
                const age = currentAge(m.birth_date);
                return (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">{legalName(m)}</td>
                    <td className="px-4 py-2 text-center text-gray-600">{age === null ? <span className="text-gray-300">—</span> : age}</td>
                    <td className="px-4 py-2 text-center">
                      {inPipeline
                        ? <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">Yes</span>
                        : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button type="button" onClick={() => addForConsideration(m)} disabled={inPipeline}
                        title={inPipeline ? 'Already being considered for a calling' : 'Add to the Calling Pipeline, in Discussion'}
                        className="text-xs px-2 py-1 rounded text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:hover:bg-transparent">
                        Add for calling consideration
                      </button>
                    </td>
                  </tr>
                );
              })}
              {sortedMwc.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400 text-sm">Everyone active (excluding children) has a calling on record.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'unfilled' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <SortHeader label="Calling" sortKey="calling" current={unfilledSortKey} asc={unfilledSortAsc} onSort={handleUnfilledSort} />
                <SortHeader label="Organization" sortKey="organization" current={unfilledSortKey} asc={unfilledSortAsc} onSort={handleUnfilledSort} className="w-56" />
                <th className="text-right px-4 py-2 font-medium text-gray-600 w-52">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedUnfilled.map(c => {
                const added = addedUnfilledKeys.has(`${normCalling(c.calling)}|${c.organization}`);
                return (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-900">{c.calling}</td>
                    <td className="px-4 py-2 text-gray-600">{c.organization}</td>
                    <td className="px-4 py-2 text-right">
                      {added ? (
                        <span className="text-xs text-gray-400">Added</span>
                      ) : (
                        <button type="button" onClick={() => addUnfilledToPipeline(c)}
                          title="Add to the Calling Pipeline, in Discussion"
                          className="text-xs px-2 py-1 rounded text-blue-600 hover:bg-blue-50">
                          Add to Calling Pipeline
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sortedUnfilled.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400 text-sm">No unfilled callings — run the LCR sync to populate this list.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
