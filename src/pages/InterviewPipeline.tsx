import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTable } from '../lib/useTable';
import type { InterviewPipeline as InterviewType, WardMember, User } from '../lib/api';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { Input, Select, Textarea } from '../components/FormFields'; // Select still used for Status
import { INTERVIEW_TYPES, INTERVIEW_STATUSES, INTERVIEW_STATUS_COLORS } from '../lib/constants';
import { displayName } from '../lib/displayName';
import { toast } from '../lib/toast';

const ASSIGNED_DATALIST = 'interview-assigned-to-options';

function AssignedToField({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">Assigned To</span>
      <input
        list={ASSIGNED_DATALIST}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Select or type name…"
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
      <datalist id={ASSIGNED_DATALIST}>
        {options.map(o => <option key={o} value={o} />)}
      </datalist>
    </label>
  );
}

function shortYouthType(type: string): string {
  return type.replace(/ Youth$/, '');
}

const EMPTY: Partial<InterviewType> = {
  member: '', date_recommend_expires: '', type_of_interview: '', status: 'Unassigned',
  assigned_to: '', last_interview_datetime: '', next_interview_date: '', comments: '', notes: '',
};

const TODAY = new Date().toISOString().slice(0, 10);

function isPast(d: string): boolean {
  const s = d ? d.slice(0, 10) : '';
  return !!s && s < TODAY;
}

function recommendRowClass(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month] = dateStr.slice(0, 7).split('-').map(Number);
  if (!year || !month) return '';
  const expiry = new Date(year, month, 0); // last day of that month
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = (expiry.getTime() - today.getTime()) / 86400000;
  if (days < -30) return 'bg-red-100';      // expired > 1 month ago
  if (days < 0)   return 'bg-orange-100';   // expired within 1 month
  if (days <= 30) return 'bg-amber-100';    // expires within 1 month
  if (days <= 62) return 'bg-yellow-50';    // expires within 2 months
  return '';
}

function formatRecommendDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month] = dateStr.slice(0, 7).split('-').map(Number);
  if (!year || !month) return dateStr.slice(0, 10);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

const YOUTH_TYPES = new Set(['Annual Youth', 'Semi-Annual Youth']);

type YouthState = 'Due' | 'Scheduled' | 'Up to date';
const YOUTH_STATE_RANK: Record<YouthState, number> = { Due: 0, Scheduled: 1, 'Up to date': 2 };
const YOUTH_STATE_COLORS: Record<string, { bg: string; text: string }> = {
  Due: { bg: 'bg-rose-100', text: 'text-rose-800' },
  Scheduled: { bg: 'bg-blue-100', text: 'text-blue-800' },
  'Up to date': { bg: 'bg-green-100', text: 'text-green-800' },
};

// Computed from dates instead of a manually-set status: a future next_interview_date
// means it's Scheduled; otherwise a last_interview_datetime within the age-based
// cadence means Up to date; otherwise it's Due (never interviewed, or lapsed).
function computeYouthState(row: { next_interview_date?: string; last_interview_datetime?: string }, age: number): YouthState {
  const cadenceMonths = age >= 16 ? 6 : 12;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (row.next_interview_date) {
    const nid = new Date(row.next_interview_date.slice(0, 10) + 'T12:00:00');
    if (nid >= today) return 'Scheduled';
  }
  if (row.last_interview_datetime) {
    const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - cadenceMonths);
    const lid = new Date(row.last_interview_datetime.slice(0, 10) + 'T12:00:00');
    if (lid >= cutoff) return 'Up to date';
  }
  return 'Due';
}

function computeAge(birthDate: string, asOf?: Date): number {
  const bd = new Date(birthDate.slice(0, 10) + 'T12:00:00');
  const ref = asOf ?? new Date();
  let age = ref.getFullYear() - bd.getFullYear();
  const m = ref.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < bd.getDate())) age--;
  return age;
}

// Returns current age if the member is still youth-eligible, otherwise null.
// Youth eligibility ends September 1 of the year they turn 18, so members
// who turn 18 any time during the year remain youth through August.
function computeYouthAge(birthDate: string): number | null {
  const bd = new Date(birthDate.slice(0, 10) + 'T12:00:00');
  const ageOutDate = new Date(bd.getFullYear() + 18, 8, 1); // Sep 1 of 18th year
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (today >= ageOutDate) return null;
  return computeAge(birthDate);
}

interface RowMeta { age?: number; displayName: string; youthState?: YouthState; }

type SortKey = 'member' | 'age' | 'status' | 'assigned_to' | 'date_recommend_expires' | 'next_interview_date' | 'last_interview_datetime' | 'comments';

function InterviewTable({ rows, onEdit, onDelete, showAge, rowMetaById, selected, onToggleSelect }: {
  rows: InterviewType[];
  onEdit: (r: InterviewType) => void;
  onDelete: (id: number) => void;
  showAge?: boolean;
  rowMetaById: Map<number, RowMeta>;
  selected: Set<number>;
  onToggleSelect: (id: number) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('member');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  };

  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const metaA = rowMetaById.get(a.id);
    const metaB = rowMetaById.get(b.id);
    if (sortKey === 'age') {
      const av = metaA?.age ?? 999;
      const bv = metaB?.age ?? 999;
      return sortAsc ? av - bv : bv - av;
    }
    if (sortKey === 'member') {
      const av = metaA?.displayName ?? a.member;
      const bv = metaB?.displayName ?? b.member;
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    if (sortKey === 'status' && (metaA?.youthState || metaB?.youthState)) {
      const av = metaA?.youthState ? YOUTH_STATE_RANK[metaA.youthState] : 99;
      const bv = metaB?.youthState ? YOUTH_STATE_RANK[metaB.youthState] : 99;
      return sortAsc ? av - bv : bv - av;
    }
    const sk = sortKey as keyof InterviewType;
    const av = ((a[sk] ?? '') as string).slice(0, 10);
    const bv = ((b[sk] ?? '') as string).slice(0, 10);
    return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
  }), [rows, sortKey, sortAsc, rowMetaById]);

  const Th = ({ col, label }: { col: SortKey; label: string }) => (
    <th className="text-left px-3 py-2 font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900 whitespace-nowrap"
      onClick={() => handleSort(col)}>
      {label}
      <span className="ml-1 text-gray-400">{sortKey === col ? (sortAsc ? '↑' : '↓') : '↕'}</span>
    </th>
  );

  const rowTint = (r: InterviewType): { overdueInterview: boolean; rowColor: string } => {
    const meta = rowMetaById.get(r.id);
    const rowColor = recommendRowClass(r.date_recommend_expires);
    const overdueInterview = !rowColor && (meta?.youthState ? meta.youthState === 'Due' : isPast(r.next_interview_date));
    return { overdueInterview, rowColor };
  };

  return (
    <>
      <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-3 py-2 w-8"></th>
              <Th col="member" label="Member" />
              {showAge && <Th col="age" label="Age" />}
              <Th col="status" label="Status" />
              <Th col="assigned_to" label="Assigned To" />
              <Th col="date_recommend_expires" label="Rec. Expires" />
              <Th col="next_interview_date" label="Next Interview" />
              <Th col="last_interview_datetime" label="Last Interview" />
              <Th col="comments" label="Comments" />
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => {
              const { overdueInterview, rowColor } = rowTint(r);
              const meta = rowMetaById.get(r.id);
              return (
              <tr key={r.id} className={`border-b border-gray-50 cursor-pointer hover:brightness-95 ${overdueInterview ? 'bg-rose-50' : rowColor || 'hover:bg-gray-50'}`} onClick={() => onEdit(r)}>
                <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => onToggleSelect(r.id)}
                    className="rounded border-gray-300 text-blue-600" />
                </td>
                <td className="px-3 py-2 font-medium text-gray-900">{meta?.displayName ?? r.member}</td>
                {showAge && <td className="px-3 py-2 text-gray-600 text-center">{meta?.age ?? '—'}</td>}
                <td className="px-3 py-2">
                  {meta?.youthState
                    ? <StatusBadge status={meta.youthState} colors={YOUTH_STATE_COLORS} />
                    : <StatusBadge status={r.status} colors={INTERVIEW_STATUS_COLORS} />}
                </td>
                <td className="px-3 py-2 text-gray-600">{r.assigned_to}</td>
                <td className="px-3 py-2 text-sm font-medium text-gray-700">
                  {formatRecommendDate(r.date_recommend_expires)}
                </td>
                <td className="px-3 py-2">
                  {meta?.youthState && <div className="text-[10px] text-gray-400 uppercase tracking-wide">{shortYouthType(r.type_of_interview)}</div>}
                  <span className={`font-mono text-sm ${isPast(r.next_interview_date) ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                    {(r.next_interview_date || '').slice(0, 10) || (meta?.youthState ? '—' : '')}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {meta?.youthState && <div className="text-[10px] text-gray-400 uppercase tracking-wide">{shortYouthType(r.type_of_interview)}</div>}
                  <span className="font-mono text-sm text-gray-600">
                    {(r.last_interview_datetime || '').slice(0, 10) || (meta?.youthState ? '—' : '')}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-700">{r.comments}</td>
                <td className="px-3 py-2">
                  <button onClick={e => { e.stopPropagation(); onDelete(r.id); }} className="text-red-400 hover:text-red-600 text-xs">Del</button>
                </td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-2">
        {sorted.map(r => {
          const { overdueInterview, rowColor } = rowTint(r);
          const meta = rowMetaById.get(r.id);
          return (
            <div key={r.id} onClick={() => onEdit(r)}
              className={`rounded-lg border border-gray-200 p-3 cursor-pointer ${overdueInterview ? 'bg-rose-50' : rowColor || 'bg-white'}`}>
              <div className="flex items-start gap-2">
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => onToggleSelect(r.id)}
                  onClick={e => e.stopPropagation()}
                  className="mt-1 rounded border-gray-300 text-blue-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-900 truncate">
                      {meta?.displayName ?? r.member}{showAge && meta?.age !== undefined && <span className="text-gray-500 font-normal"> (age {meta.age})</span>}
                    </p>
                    <button onClick={e => { e.stopPropagation(); onDelete(r.id); }}
                      className="text-red-400 hover:text-red-600 text-xs shrink-0">Del</button>
                  </div>
                  <div className="mt-1">
                    {meta?.youthState
                      ? <StatusBadge status={meta.youthState} colors={YOUTH_STATE_COLORS} />
                      : <StatusBadge status={r.status} colors={INTERVIEW_STATUS_COLORS} />}
                  </div>
                  {r.assigned_to && <p className="text-xs text-gray-500 mt-1">Assigned: {r.assigned_to}</p>}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs">
                    {r.date_recommend_expires && <span className="text-gray-600">Rec. expires: {formatRecommendDate(r.date_recommend_expires)}</span>}
                    {r.next_interview_date && (
                      <span className={isPast(r.next_interview_date) ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                        Next{meta?.youthState ? ` (${shortYouthType(r.type_of_interview)})` : ''}: {r.next_interview_date.slice(0, 10)}
                      </span>
                    )}
                    {r.last_interview_datetime && (
                      <span className="text-gray-600">
                        Last{meta?.youthState ? ` (${shortYouthType(r.type_of_interview)})` : ''}: {r.last_interview_datetime.slice(0, 10)}
                      </span>
                    )}
                  </div>
                  {r.comments && <p className="text-xs text-gray-700 mt-1 truncate">{r.comments}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function InterviewPipeline() {
  const { rows, isLoading, create, update, remove } = useTable<InterviewType>('interview-pipeline');
  const { rows: wardMembers, isLoading: wardMembersLoading, update: updateWardMember } = useTable<WardMember>('ward-members');
  const { data: allUsers = [] } = useQuery<User[]>({ queryKey: ['users'], queryFn: () => fetch('/api/users').then(r => r.json()) });
  const [editing, setEditing] = useState<Partial<InterviewType> | null>(null);
  const [preferredNameDraft, setPreferredNameDraft] = useState('');
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkAssignedTo, setBulkAssignedTo] = useState('');
  const [showAgedOutYouth, setShowAgedOutYouth] = useState(false);

  const bishopricOptions = useMemo(() =>
    allUsers.filter(u => u.church_role && /bishop|counselor/i.test(u.church_role)).map(u => u.name),
    [allUsers]);

  const assignedOptions = useMemo(() => {
    const names = [...new Set(rows.map(r => r.assigned_to).filter(Boolean))].sort();
    return names;
  }, [rows]);

  const wardMembersById = useMemo(() => {
    const m = new Map<number, WardMember>();
    for (const wm of wardMembers) m.set(wm.id, wm);
    return m;
  }, [wardMembers]);

  const ageByName = useMemo(() => {
    const m = new Map<string, number>();
    for (const wm of wardMembers) {
      if (wm.birth_date) {
        const age = computeYouthAge(wm.birth_date);
        if (age !== null) m.set(wm.name.trim().toLowerCase(), age);
      }
    }
    return m;
  }, [wardMembers]);

  const activeYouthWardMemberIds = useMemo(() => {
    const s = new Set<number>();
    for (const wm of wardMembers) {
      if (wm.active && wm.birth_date && computeYouthAge(wm.birth_date) !== null) s.add(wm.id);
    }
    return s;
  }, [wardMembers]);

  const rowMetaById = useMemo(() => {
    const m = new Map<number, RowMeta>();
    for (const r of rows) {
      let age: number | undefined;
      let name = r.member;
      const linked = r.ward_member_id ? wardMembersById.get(r.ward_member_id) : undefined;
      if (linked) {
        name = displayName(linked);
        if (linked.active && linked.birth_date) {
          const a = computeYouthAge(linked.birth_date);
          if (a !== null) age = a;
        }
      } else if (YOUTH_TYPES.has(r.type_of_interview)) {
        age = ageByName.get(r.member?.trim().toLowerCase() ?? '');
      }
      const youthState = age !== undefined && YOUTH_TYPES.has(r.type_of_interview) ? computeYouthState(r, age) : undefined;
      m.set(r.id, { age, displayName: name, youthState });
    }
    return m;
  }, [rows, wardMembersById, ageByName]);

  const filtered = rows.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (assignedFilter && r.assigned_to !== assignedFilter) return false;
    if (typeFilter && r.type_of_interview !== typeFilter) return false;
    if (filter) {
      const q = filter.toLowerCase();
      const name = rowMetaById.get(r.id)?.displayName ?? r.member;
      return name?.toLowerCase().includes(q) || r.member?.toLowerCase().includes(q) || r.type_of_interview?.toLowerCase().includes(q);
    }
    return true;
  });

  const handleBulkStatus = async () => {
    if (!bulkStatus || selected.size === 0) return;
    await Promise.all([...selected].map(id => update(id, { status: bulkStatus }, { silent: true })));
    toast.success(`Updated ${selected.size} interview${selected.size === 1 ? '' : 's'}`);
    setSelected(new Set());
    setBulkStatus('');
  };

  const handleBulkAssign = async () => {
    const name = bulkAssignedTo.trim();
    if (!name || selected.size === 0) return;
    await Promise.all([...selected].map(id => update(id, { assigned_to: name }, { silent: true })));
    toast.success(`Assigned ${selected.size} interview${selected.size === 1 ? '' : 's'} to ${name}`);
    setSelected(new Set());
    setBulkAssignedTo('');
  };

  const toggleSelect = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleSave = async () => {
    if (!editing) return;
    const data = { ...editing } as Record<string, unknown>;
    delete data.id;
    const wardMemberId = data.ward_member_id as number | undefined | null;
    const newName = ((data.member as string) || '').trim();
    if (wardMemberId) {
      const linked = wardMembersById.get(wardMemberId);
      if (linked) {
        const wardMemberUpdate: Record<string, unknown> = {};
        if (newName && newName !== linked.name) wardMemberUpdate.name = newName;
        const newPreferredName = preferredNameDraft.trim();
        if (newPreferredName !== (linked.preferred_name || '')) wardMemberUpdate.preferred_name = newPreferredName;
        if (Object.keys(wardMemberUpdate).length > 0) await updateWardMember(wardMemberId, wardMemberUpdate);
      }
    }
    if (editing.id) await update(editing.id, data);
    else await create(data);
    setEditing(null);
  };

  const agedOutYouthCount = useMemo(() =>
    wardMembersLoading ? 0 : rows.filter(r => YOUTH_TYPES.has(r.type_of_interview) && r.ward_member_id && !activeYouthWardMemberIds.has(r.ward_member_id)).length,
    [rows, activeYouthWardMemberIds, wardMembersLoading]);

  const grouped = useMemo(() => {
    const youthRows: InterviewType[] = [];
    const otherMap = new Map<string, InterviewType[]>();
    for (const type of INTERVIEW_TYPES) {
      if (!YOUTH_TYPES.has(type)) otherMap.set(type, []);
    }
    for (const r of filtered) {
      if (YOUTH_TYPES.has(r.type_of_interview)) {
        // While ward-members is still loading, don't hide anyone — activeYouthWardMemberIds
        // would otherwise be empty and every linked row would flash as "aged-out".
        const isCurrentYouth = wardMembersLoading || !r.ward_member_id || activeYouthWardMemberIds.has(r.ward_member_id);
        if (isCurrentYouth || showAgedOutYouth) youthRows.push(r);
        continue;
      }
      const t = r.type_of_interview || 'Other';
      if (!otherMap.has(t)) otherMap.set(t, []);
      otherMap.get(t)!.push(r);
    }
    const entries: [string, InterviewType[]][] = [];
    if (youthRows.length > 0) entries.push(['Youth Interviews', youthRows]);
    entries.push(...[...otherMap.entries()].filter(([, r]) => r.length > 0));
    return entries;
  }, [filtered, activeYouthWardMemberIds, showAgedOutYouth, wardMembersLoading]);

  const editingLinkedMember = editing?.ward_member_id ? wardMembersById.get(editing.ward_member_id) : undefined;
  const editingAge = editingLinkedMember?.birth_date
    ? computeYouthAge(editingLinkedMember.birth_date)
    : (editing?.member ? ageByName.get(editing.member.trim().toLowerCase()) ?? null : null);
  const editingIsManagedYouth = !!editing && !!editing.ward_member_id && YOUTH_TYPES.has(editing.type_of_interview || '')
    && editingAge !== null && activeYouthWardMemberIds.has(editing.ward_member_id);
  const editingYouthState = editingIsManagedYouth && editing && editingAge !== null ? computeYouthState(editing, editingAge) : null;
  const showLinkPicker = !!editing && !editing.ward_member_id && YOUTH_TYPES.has(editing.type_of_interview || '');

  // Reset the preferred-name draft whenever a different row (or a newly-linked
  // member) opens in the modal, so it doesn't carry over from the previous edit.
  useEffect(() => {
    setPreferredNameDraft(editingLinkedMember?.preferred_name || '');
  }, [editing?.id, editing?.ward_member_id, editingLinkedMember?.preferred_name]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Interview Pipeline</h1>
        <button onClick={() => setEditing({ ...EMPTY })} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
          + New Interview
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Bishop and counselor interviews — temple recommends, annual interviews, mission prep, and more.
        Youth interviews are kept in sync with the ward roster automatically; their status is computed from the interview dates rather than set by hand.
      </p>

      <div className="flex flex-col sm:flex-row gap-2 mb-2">
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search member..."
          className="rounded-md border border-gray-300 px-3 py-2 text-sm flex-1" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All types</option>
          {INTERVIEW_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {INTERVIEW_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={assignedFilter} onChange={e => setAssignedFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All assigned</option>
          {assignedOptions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-2 bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-sm">
          <span className="text-blue-700 font-medium">{selected.size} selected</span>
          <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
            className="rounded border border-blue-300 px-2 py-1 text-sm bg-white">
            <option value="">Set status…</option>
            {INTERVIEW_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={handleBulkStatus} disabled={!bulkStatus}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-40 hover:bg-blue-700">Apply</button>
          <span className="text-blue-300">|</span>
          <input list="interview-bulk-assign-options" value={bulkAssignedTo} onChange={e => setBulkAssignedTo(e.target.value)} placeholder="Assign to…"
            className="rounded border border-blue-300 px-2 py-1 text-sm bg-white w-36" />
          <datalist id="interview-bulk-assign-options">
            {bishopricOptions.map(o => <option key={o} value={o} />)}
          </datalist>
          <button onClick={handleBulkAssign} disabled={!bulkAssignedTo.trim()}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-40 hover:bg-blue-700">Assign</button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-blue-500 hover:text-blue-700">Clear</button>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300 inline-block" />Expires within 1 month</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-50 border border-yellow-300 inline-block" />Expires within 2 months</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-100 border border-orange-300 inline-block" />Expired within 1 month</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-100 border border-red-300 inline-block" />Expired over 1 month ago</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-rose-50 border border-rose-300 inline-block" />Interview overdue/due</span>
      </div>

      {isLoading ? <p className="text-gray-400 text-sm">Loading...</p> : (
        <div className="space-y-8">
          {grouped.map(([type, typeRows]) => (
            <div key={type}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                {type}
                <span className="text-gray-400 font-normal normal-case tracking-normal">({typeRows.length})</span>
                {type === 'Youth Interviews' && agedOutYouthCount > 0 && (
                  <button onClick={() => setShowAgedOutYouth(s => !s)}
                    className="ml-auto text-xs text-gray-400 hover:text-gray-600 normal-case tracking-normal font-normal">
                    {showAgedOutYouth ? 'Hide' : 'Show'} aged-out/inactive ({agedOutYouthCount})
                  </button>
                )}
              </h2>
              <InterviewTable rows={typeRows} onEdit={setEditing} onDelete={remove}
                showAge={type === 'Youth Interviews'}
                rowMetaById={rowMetaById}
                selected={selected} onToggleSelect={toggleSelect} />
            </div>
          ))}
          {grouped.length === 0 && <p className="text-gray-400 text-sm text-center py-8">No interviews found</p>}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Interview' : 'New Interview'}>
        {editing && (
          <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Member</label>
              <input
                value={editing.member || ''}
                onChange={e => setEditing({ ...editing, member: e.target.value })}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              {editingLinkedMember && (
                <p className="text-xs text-gray-400 mt-1">Linked to Ward Members — saving here updates their name on the ward roster.</p>
              )}
            </div>

            {editingLinkedMember && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Name</label>
                <input
                  value={preferredNameDraft}
                  onChange={e => setPreferredNameDraft(e.target.value)}
                  placeholder="e.g. Bud"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Shown instead of the name above wherever this person appears. Leave blank to use the legal name.</p>
              </div>
            )}

            {showLinkPicker && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link to Ward Member (optional)</label>
                <input
                  list="ward-member-link-options"
                  placeholder="Start typing a name…"
                  onChange={e => {
                    const match = wardMembers.find(wm => wm.name === e.target.value);
                    if (match) setEditing({ ...editing, ward_member_id: match.id, member: match.name });
                  }}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <datalist id="ward-member-link-options">
                  {wardMembers.map(wm => <option key={wm.id} value={wm.name} />)}
                </datalist>
              </div>
            )}

            {editingIsManagedYouth ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type of Interview</label>
                <p className="text-sm text-gray-600">{editing.type_of_interview} <span className="text-xs text-gray-400">(auto-managed by age)</span></p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type of Interview</label>
                <input
                  list="interview-type-options"
                  value={editing.type_of_interview || ''}
                  onChange={e => setEditing({ ...editing, type_of_interview: e.target.value })}
                  placeholder="Select or type a new type…"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <datalist id="interview-type-options">
                  {(editing.id ? INTERVIEW_TYPES : INTERVIEW_TYPES.filter(t => !YOUTH_TYPES.has(t))).map(t => <option key={t} value={t} />)}
                </datalist>
              </div>
            )}

            {editingIsManagedYouth ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <div className="mt-1"><StatusBadge status={editingYouthState!} colors={YOUTH_STATE_COLORS} /></div>
                <p className="text-xs text-gray-400 mt-1">Computed automatically from Next/Last Interview Date below.</p>
              </div>
            ) : (
              <Select label="Status" value={editing.status || ''} onChange={v => setEditing({ ...editing, status: v })} options={INTERVIEW_STATUSES} />
            )}
            <AssignedToField value={editing.assigned_to || ''} onChange={v => setEditing({ ...editing, assigned_to: v })} options={bishopricOptions} />
            <Input label="Date Recommend Expires" value={(editing.date_recommend_expires || '').slice(0, 10)} onChange={v => setEditing({ ...editing, date_recommend_expires: v })} type="date" />
            <Input label="Next Interview Date" value={(editing.next_interview_date || '').slice(0, 10)} onChange={v => setEditing({ ...editing, next_interview_date: v })} type="date" />
            <Input label="Last Interview Date" value={(editing.last_interview_datetime || '').slice(0, 10)} onChange={v => setEditing({ ...editing, last_interview_datetime: v })} type="date" />
            <Input label="Comments" value={editing.comments || ''} onChange={v => setEditing({ ...editing, comments: v })} />
            <Textarea label="Notes" value={editing.notes || ''} onChange={v => setEditing({ ...editing, notes: v })} />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Save</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
