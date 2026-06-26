import { useState, useMemo } from 'react';
import { useTable } from '../lib/useTable';
import type { InterviewPipeline as InterviewType } from '../lib/api';
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

type SortKey = 'member' | 'status' | 'assigned_to' | 'date_recommend_expires' | 'next_interview_date' | 'last_interview_datetime' | 'comments';

function InterviewTable({ rows, onEdit, onDelete }: {
  rows: InterviewType[];
  onEdit: (r: InterviewType) => void;
  onDelete: (id: number) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('member');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  };

  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const av = ((a[sortKey] ?? '') as string).slice(0, 10);
    const bv = ((b[sortKey] ?? '') as string).slice(0, 10);
    return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
  }), [rows, sortKey, sortAsc]);

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
            <Th col="member" label="Member" />
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
          {sorted.map(r => (
            <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => onEdit(r)}>
              <td className="px-3 py-2 font-medium text-gray-900">{r.member}</td>
              <td className="px-3 py-2"><StatusBadge status={r.status} colors={INTERVIEW_STATUS_COLORS} /></td>
              <td className="px-3 py-2 text-gray-600">{r.assigned_to}</td>
              <td className={`px-3 py-2 font-mono text-sm ${isPast(r.date_recommend_expires) ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                {(r.date_recommend_expires || '').slice(0, 10)}
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
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function InterviewPipeline() {
  const { rows, isLoading, create, update, remove } = useTable<InterviewType>('interview-pipeline');
  const [editing, setEditing] = useState<Partial<InterviewType> | null>(null);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');

  const assignedOptions = useMemo(() => {
    const names = [...new Set(rows.map(r => r.assigned_to).filter(Boolean))].sort();
    return names;
  }, [rows]);

  const filtered = rows.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (assignedFilter && r.assigned_to !== assignedFilter) return false;
    if (filter) {
      const q = filter.toLowerCase();
      return r.member?.toLowerCase().includes(q) || r.type_of_interview?.toLowerCase().includes(q);
    }
    return true;
  });

  const handleSave = async () => {
    if (!editing) return;
    const data = { ...editing };
    delete (data as Record<string, unknown>).id;
    if (editing.id) await update(editing.id, data as Record<string, unknown>);
    else await create(data as Record<string, unknown>);
    setEditing(null);
  };

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

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search member..."
          className="rounded-md border border-gray-300 px-3 py-2 text-sm flex-1" />
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

      {isLoading ? <p className="text-gray-400 text-sm">Loading...</p> : (
        <div className="space-y-8">
          {grouped.map(([type, typeRows]) => (
            <div key={type}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                {type}
                <span className="text-gray-400 font-normal normal-case tracking-normal">({typeRows.length})</span>
              </h2>
              <InterviewTable rows={typeRows} onEdit={setEditing} onDelete={remove} />
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
