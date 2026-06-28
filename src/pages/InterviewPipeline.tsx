import { useState, useMemo } from 'react';
import { useTable } from '../lib/useTable';
import type { InterviewPipeline as InterviewType, WardMember } from '../lib/api';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { Input, Select, Textarea } from '../components/FormFields'; // Select still used for Status
import { INTERVIEW_TYPES, INTERVIEW_STATUSES, INTERVIEW_STATUS_COLORS } from '../lib/constants';

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

type SortKey = 'member' | 'age' | 'status' | 'assigned_to' | 'date_recommend_expires' | 'next_interview_date' | 'last_interview_datetime' | 'comments';

function InterviewTable({ rows, onEdit, onDelete, ageMap, selected, onToggleSelect }: {
  rows: InterviewType[];
  onEdit: (r: InterviewType) => void;
  onDelete: (id: number) => void;
  ageMap?: Map<string, number>;
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
    if (sortKey === 'age' && ageMap) {
      const av = ageMap.get(a.member.toLowerCase()) ?? 999;
      const bv = ageMap.get(b.member.toLowerCase()) ?? 999;
      return sortAsc ? av - bv : bv - av;
    }
    const sk = sortKey as keyof InterviewType;
    const av = ((a[sk] ?? '') as string).slice(0, 10);
    const bv = ((b[sk] ?? '') as string).slice(0, 10);
    return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
  }), [rows, sortKey, sortAsc, ageMap]);

  const Th = ({ col, label }: { col: SortKey; label: string }) => (
    <th className="text-left px-3 py-2 font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900 whitespace-nowrap"
      onClick={() => handleSort(col)}>
      {label}
      <span className="ml-1 text-gray-400">{sortKey === col ? (sortAsc ? '↑' : '↓') : '↕'}</span>
    </th>
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-3 py-2 w-8"></th>
            <Th col="member" label="Member" />
            {ageMap && <Th col="age" label="Age" />}
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
            const rowColor = recommendRowClass(r.date_recommend_expires);
            const overdueInterview = !rowColor && isPast(r.next_interview_date);
            return (
            <tr key={r.id} className={`border-b border-gray-50 cursor-pointer hover:brightness-95 ${overdueInterview ? 'bg-rose-50' : rowColor || 'hover:bg-gray-50'}`} onClick={() => onEdit(r)}>
              <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => onToggleSelect(r.id)}
                  className="rounded border-gray-300 text-blue-600" />
              </td>
              <td className="px-3 py-2 font-medium text-gray-900">{r.member}</td>
              {ageMap && <td className="px-3 py-2 text-gray-600 text-center">{ageMap.get(r.member.toLowerCase()) ?? '—'}</td>}
              <td className="px-3 py-2"><StatusBadge status={r.status} colors={INTERVIEW_STATUS_COLORS} /></td>
              <td className="px-3 py-2 text-gray-600">{r.assigned_to}</td>
              <td className="px-3 py-2 text-sm font-medium text-gray-700">
                {formatRecommendDate(r.date_recommend_expires)}
              </td>
              <td className={`px-3 py-2 font-mono text-sm ${isPast(r.next_interview_date) ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                {(r.next_interview_date || '').slice(0, 10)}
              </td>
              <td className="px-3 py-2 text-gray-600 font-mono text-sm">{(r.last_interview_datetime || '').slice(0, 10)}</td>
              <td className="px-3 py-2 text-gray-700">{r.comments}</td>
              <td className="px-3 py-2">
                <button onClick={e => { e.stopPropagation(); onDelete(r.id); }} className="text-red-400 hover:text-red-600 text-xs">Del</button>
              </td>
            </tr>
          );})}
        </tbody>
      </table>
    </div>
  );
}

const YOUTH_TYPES = new Set(['Annual Youth', 'Semi-Annual Youth']);

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

export default function InterviewPipeline() {
  const { rows, isLoading, create, update, remove } = useTable<InterviewType>('interview-pipeline');
  const { rows: wardMembers } = useTable<WardMember>('ward-members');
  const [editing, setEditing] = useState<Partial<InterviewType> | null>(null);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');

  const assignedOptions = useMemo(() => {
    const names = [...new Set(rows.map(r => r.assigned_to).filter(Boolean))].sort();
    return names;
  }, [rows]);

  const filtered = rows.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (assignedFilter && r.assigned_to !== assignedFilter) return false;
    if (typeFilter && r.type_of_interview !== typeFilter) return false;
    if (filter) {
      const q = filter.toLowerCase();
      return r.member?.toLowerCase().includes(q) || r.type_of_interview?.toLowerCase().includes(q);
    }
    return true;
  });

  const handleBulkStatus = async () => {
    if (!bulkStatus || selected.size === 0) return;
    await Promise.all([...selected].map(id => update(id, { status: bulkStatus })));
    setSelected(new Set());
    setBulkStatus('');
  };

  const toggleSelect = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleSave = async () => {
    if (!editing) return;
    const data = { ...editing };
    delete (data as Record<string, unknown>).id;
    if (editing.id) await update(editing.id, data as Record<string, unknown>);
    else await create(data as Record<string, unknown>);
    setEditing(null);
  };

  const ageMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const wm of wardMembers) {
      if (wm.birth_date) {
        const age = computeYouthAge(wm.birth_date);
        if (age !== null) m.set(wm.name.toLowerCase(), age);
      }
    }
    return m;
  }, [wardMembers]);

  const grouped = useMemo(() => {
    const map = new Map<string, InterviewType[]>();
    for (const type of INTERVIEW_TYPES) map.set(type, []);
    for (const r of filtered) {
      const t = r.type_of_interview || 'Other';
      if (!map.has(t)) map.set(t, []);
      map.get(t)!.push(r);
    }
    return [...map.entries()].filter(([, rows]) => rows.length > 0);
  }, [filtered]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Interview Pipeline</h1>
        <button onClick={() => setEditing({ ...EMPTY })} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
          + New Interview
        </button>
      </div>

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
        <div className="flex items-center gap-2 mb-2 bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-sm">
          <span className="text-blue-700 font-medium">{selected.size} selected</span>
          <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
            className="rounded border border-blue-300 px-2 py-1 text-sm bg-white">
            <option value="">Set status…</option>
            {INTERVIEW_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={handleBulkStatus} disabled={!bulkStatus}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-40 hover:bg-blue-700">Apply</button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-blue-500 hover:text-blue-700">Clear</button>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300 inline-block" />Expires within 1 month</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-50 border border-yellow-300 inline-block" />Expires within 2 months</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-100 border border-orange-300 inline-block" />Expired within 1 month</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-100 border border-red-300 inline-block" />Expired over 1 month ago</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-rose-50 border border-rose-300 inline-block" />Interview overdue</span>
      </div>

      {isLoading ? <p className="text-gray-400 text-sm">Loading...</p> : (
        <div className="space-y-8">
          {grouped.map(([type, typeRows]) => (
            <div key={type}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                {type}
                <span className="text-gray-400 font-normal normal-case tracking-normal">({typeRows.length})</span>
              </h2>
              <InterviewTable rows={typeRows} onEdit={setEditing} onDelete={remove}
                ageMap={YOUTH_TYPES.has(type) ? ageMap : undefined}
                selected={selected} onToggleSelect={toggleSelect} />
            </div>
          ))}
          {grouped.length === 0 && <p className="text-gray-400 text-sm text-center py-8">No interviews found</p>}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Interview' : 'New Interview'}>
        {editing && (
          <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-3">
            <Input label="Member" value={editing.member || ''} onChange={v => setEditing({ ...editing, member: v })} required />
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
                {INTERVIEW_TYPES.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>
            <Select label="Status" value={editing.status || ''} onChange={v => setEditing({ ...editing, status: v })} options={INTERVIEW_STATUSES} />
            <Input label="Assigned To" value={editing.assigned_to || ''} onChange={v => setEditing({ ...editing, assigned_to: v })} />
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
