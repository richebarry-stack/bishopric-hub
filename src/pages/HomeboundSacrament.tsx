import { useMemo, useState } from 'react';
import { useTable } from '../lib/useTable';
import type { HomeboundSacrament as HomeboundRow } from '../lib/api';
import Modal from '../components/Modal';
import MemberNameInput from '../components/MemberNameInput';
import { Input, Select, Textarea } from '../components/FormFields';
import { useConfirm } from '../components/ConfirmDialog';

const FREQUENCIES = ['Weekly', 'Every other week', 'Monthly', 'As needed'];
const EMPTY: Partial<HomeboundRow> = { member_name: '', location: '', frequency: 'Weekly', assigned_to: '', last_administered: '', notes: '', active: 1 };

function todayKey(): string {
  return new Date().toLocaleDateString('en-CA');
}

export default function HomeboundSacrament() {
  const { rows, isLoading, create, update, remove } = useTable<HomeboundRow>('homebound-sacrament');
  const [editing, setEditing] = useState<Partial<HomeboundRow> | null>(null);
  const confirm = useConfirm();

  const active = useMemo(() => rows.filter(r => r.active), [rows]);
  const inactive = useMemo(() => rows.filter(r => !r.active), [rows]);

  const handleSave = async () => {
    if (!editing || !editing.member_name?.trim()) return;
    const data = {
      member_name: editing.member_name.trim(), location: editing.location || '', frequency: editing.frequency || 'Weekly',
      assigned_to: editing.assigned_to || '', last_administered: editing.last_administered || '', notes: editing.notes || '',
      active: editing.active ? 1 : 0,
    };
    if (editing.id) await update(editing.id, data);
    else await create(data);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!editing?.id) return;
    if (!await confirm({ message: `Remove ${editing.member_name} from the list?` })) return;
    await remove(editing.id);
    setEditing(null);
  };

  const table = (list: HomeboundRow[]) => (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Member</th>
            <th className="text-left px-3 py-2 font-medium">Where</th>
            <th className="text-left px-3 py-2 font-medium">How often</th>
            <th className="text-left px-3 py-2 font-medium">Assigned priesthood holders</th>
            <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Last administered</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {list.map(r => (
            <tr key={r.id} onClick={() => setEditing(r)} className="border-t border-gray-100 cursor-pointer hover:bg-gray-50 align-top">
              <td className="px-3 py-2 font-medium text-gray-900">
                {r.member_name}
                {r.notes && <p className="text-xs font-normal text-gray-500 line-clamp-2">{r.notes}</p>}
              </td>
              <td className="px-3 py-2 text-gray-600">{r.location || '—'}</td>
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.frequency || '—'}</td>
              <td className="px-3 py-2 text-gray-600">{r.assigned_to || <span className="text-amber-600">Not assigned</span>}</td>
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.last_administered ? r.last_administered.slice(0, 10) : '—'}</td>
              <td className="px-3 py-2 text-right">
                {!!r.active && (
                  <button type="button" onClick={e => { e.stopPropagation(); update(r.id, { last_administered: todayKey() }, { silent: true }); }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap">Mark today</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Sacrament for Homebound Members</h1>
        <button onClick={() => setEditing({ ...EMPTY })} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">+ Add</button>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Members who receive the sacrament at home, in a care facility or in the hospital, and the priesthood holders the bishop has assigned
        to administer it (General Handbook 29.2.1.5).
      </p>

      {isLoading ? <p className="text-gray-400 text-sm">Loading...</p> : active.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No one on the list yet.</p>
      ) : table(active)}

      {inactive.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-600 mb-2">No longer receiving it at home ({inactive.length})</h2>
          {table(inactive)}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit' : 'Add Member'}>
        {editing && (
          <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-3">
            <MemberNameInput label="Member" format="firstLast" value={editing.member_name || ''} onChange={v => setEditing({ ...editing, member_name: v })} required />
            <Input label="Where" value={editing.location || ''} onChange={v => setEditing({ ...editing, location: v })} placeholder="Home, care facility, hospital…" />
            <Select label="How often" value={editing.frequency || 'Weekly'} onChange={v => setEditing({ ...editing, frequency: v })} options={FREQUENCIES} />
            <Input label="Assigned priesthood holders" value={editing.assigned_to || ''} onChange={v => setEditing({ ...editing, assigned_to: v })} placeholder="e.g. Bro. Lee and his son Sam" />
            <Input label="Last administered" type="date" value={(editing.last_administered || '').slice(0, 10)} onChange={v => setEditing({ ...editing, last_administered: v })} />
            <Textarea label="Notes" value={editing.notes || ''} onChange={v => setEditing({ ...editing, notes: v })} />
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input type="checkbox" checked={!!editing.active} onChange={e => setEditing({ ...editing, active: e.target.checked ? 1 : 0 })} className="rounded border-gray-300" />
              Currently receiving the sacrament at home
            </label>
            <div className="flex justify-between pt-2">
              <div>
                {editing.id && <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm text-red-600 hover:text-red-800">Delete</button>}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Save</button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
