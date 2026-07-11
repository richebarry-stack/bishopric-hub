import { useState } from 'react';
import { useTable } from '../lib/useTable';
import type { MissionaryPipeline as MissionaryType } from '../lib/api';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { Input, Select, Textarea } from '../components/FormFields';
import { MISSIONARY_STATUSES, MISSIONARY_TEMPLE_STATUSES } from '../lib/constants';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  '0-Not at this time': { bg: 'bg-red-100', text: 'text-red-700' },
  '1-Considering': { bg: 'bg-blue-100', text: 'text-blue-700' },
  '2-Papers Started': { bg: 'bg-green-100', text: 'text-green-700' },
  '3-Papers with Stake': { bg: 'bg-teal-100', text: 'text-teal-700' },
  '4-Papers Submitted': { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  '5-Call Accepted': { bg: 'bg-pink-100', text: 'text-pink-700' },
  '6-Serving': { bg: 'bg-orange-100', text: 'text-orange-700' },
  '7-Released': { bg: 'bg-purple-100', text: 'text-purple-700' },
};

const EMPTY: Partial<MissionaryType> = {
  who: '', notes: '', mission_call: '', temple_status: '', next_steps: '',
  report_date: '', release_date: '', status: '1-Considering',
};

function toDateOnly(v: string): string {
  if (!v) return '';
  return v.slice(0, 10);
}

type SortKey = 'who' | 'mission_call' | 'temple_status' | 'report_date' | 'release_date';
type SortDir = 'asc' | 'desc';

function SortHeader({ label, sortKey, current, dir, onSort }: {
  label: string; sortKey: SortKey;
  current: SortKey | null; dir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th className="text-left px-3 py-2 font-medium text-gray-600 cursor-pointer select-none whitespace-nowrap hover:text-gray-900"
      onClick={() => onSort(sortKey)}>
      {label}{active ? (dir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
    </th>
  );
}

export default function MissionaryPipeline() {
  const { rows, isLoading, create, update, remove } = useTable<MissionaryType>('missionary-pipeline');
  const [editing, setEditing] = useState<Partial<MissionaryType> | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const openEdit = (m: MissionaryType) => {
    setEditing(m);
  };

  const openNew = () => {
    setEditing({ ...EMPTY });
  };

  const handleSave = async () => {
    if (!editing) return;
    const data = { ...editing };
    delete (data as Record<string, unknown>).id;
    if (editing.id) {
      await update(editing.id, data as Record<string, unknown>);
    } else {
      await create(data as Record<string, unknown>);
    }
    setEditing(null);
  };

  const handleStatusChange = async (missionary: MissionaryType, newStatus: string) => {
    await update(missionary.id, { status: newStatus } as Record<string, unknown>);
  };

  const handleDelete = async (missionaryId: number) => {
    await remove(missionaryId);
  };

  const grouped = new Map<string, MissionaryType[]>();
  for (const status of MISSIONARY_STATUSES) {
    grouped.set(status, []);
  }
  for (const r of rows) {
    const status = r.status || 'Unknown';
    if (!grouped.has(status)) grouped.set(status, []);
    grouped.get(status)!.push(r);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Missionary Pipeline</h1>
        <button onClick={openNew} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">+ Add</button>
      </div>
      <p className="text-sm text-gray-500 mb-4">Prospective, currently serving, and recently returned missionaries.</p>

      {isLoading ? <p className="text-gray-400 text-sm">Loading...</p> : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([status, missionaries]) => {
            const sorted = sortKey ? [...missionaries].sort((a, b) => {
              let av = '', bv = '';
              if (sortKey === 'who')          { av = a.who || '';           bv = b.who || ''; }
              else if (sortKey === 'mission_call')  { av = a.mission_call || '';  bv = b.mission_call || ''; }
              else if (sortKey === 'temple_status') { av = a.temple_status || ''; bv = b.temple_status || ''; }
              else if (sortKey === 'report_date')   { av = a.report_date || '';   bv = b.report_date || ''; }
              else if (sortKey === 'release_date')  { av = a.release_date || '';  bv = b.release_date || ''; }
              return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
            }) : missionaries;

            return (
            <div key={status}>
              <h2 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-2">
                <StatusBadge status={status} colors={STATUS_COLORS} />
                <span>({missionaries.length})</span>
              </h2>
              {missionaries.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 border-dashed p-3 text-center text-gray-400 text-sm">No missionaries</div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <SortHeader label="Who"           sortKey="who"           current={sortKey} dir={sortDir} onSort={handleSort} />
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Status</th>
                        <SortHeader label="Mission Call"  sortKey="mission_call"  current={sortKey} dir={sortDir} onSort={handleSort} />
                        <SortHeader label="Temple"        sortKey="temple_status" current={sortKey} dir={sortDir} onSort={handleSort} />
                        <SortHeader label="Report"        sortKey="report_date"   current={sortKey} dir={sortDir} onSort={handleSort} />
                        <SortHeader label="Release"       sortKey="release_date"  current={sortKey} dir={sortDir} onSort={handleSort} />
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map(r => (
                        <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => openEdit(r)}>
                          <td className="px-3 py-2 font-medium text-gray-900">{r.who}</td>
                          <td className="px-3 py-2">
                            <select value={r.status} onClick={e => e.stopPropagation()} onChange={e => handleStatusChange(r, e.target.value)}
                              className="rounded border border-gray-300 px-2 py-1 text-xs">
                              {MISSIONARY_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-gray-700">{r.mission_call}</td>
                          <td className="px-3 py-2 text-gray-600 text-xs">{r.temple_status}</td>
                          <td className="px-3 py-2 text-gray-600">{toDateOnly(r.report_date)}</td>
                          <td className="px-3 py-2 text-gray-600">{toDateOnly(r.release_date)}</td>
                          <td className="px-3 py-2">
                            <button onClick={e => { e.stopPropagation(); handleDelete(r.id); }} className="text-red-400 hover:text-red-600 text-xs">Del</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Missionary' : 'New Missionary'}>
        {editing && (
          <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-3">
            <Input label="Who" value={editing.who || ''} onChange={v => setEditing({ ...editing, who: v })} required />
            <Select label="Status" value={editing.status || ''} onChange={v => setEditing({ ...editing, status: v })} options={MISSIONARY_STATUSES} />
            <Input label="Mission Call" value={editing.mission_call || ''} onChange={v => setEditing({ ...editing, mission_call: v })} />
            <Select label="Temple Status" value={editing.temple_status || ''} onChange={v => setEditing({ ...editing, temple_status: v })} options={MISSIONARY_TEMPLE_STATUSES} />
            <Input label="Next Steps" value={editing.next_steps || ''} onChange={v => setEditing({ ...editing, next_steps: v })} />
            <Input label="Report Date" value={toDateOnly(editing.report_date || '')} onChange={v => setEditing({ ...editing, report_date: v })} type="date" />
            <Input label="Release Date" value={toDateOnly(editing.release_date || '')} onChange={v => setEditing({ ...editing, release_date: v })} type="date" />
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
