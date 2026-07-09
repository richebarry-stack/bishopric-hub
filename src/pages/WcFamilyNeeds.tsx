import { useState } from 'react';
import { useTable } from '../lib/useTable';
import type { WcFamilyNeed } from '../lib/api';
import Modal from '../components/Modal';
import { Input, Textarea } from '../components/FormFields';
import { useConfirm } from '../components/ConfirmDialog';

const EMPTY = { family_name: '', details: '', status: '', assignments: '' };

export default function WcFamilyNeeds() {
  const { rows, isLoading, create, update, remove } = useTable<WcFamilyNeed>('wc-family-needs');
  const [editing, setEditing] = useState<Partial<WcFamilyNeed> | null>(null);
  const confirm = useConfirm();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const { id, ...data } = editing as WcFamilyNeed;
    if (id) await update(id, data);
    else await create(data);
    setEditing(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Member Needs</h1>
        <button onClick={() => setEditing({ ...EMPTY })}
          className="bg-emerald-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-emerald-700">
          + Add Person
        </button>
      </div>

      {isLoading ? <p className="text-gray-400 text-sm">Loading…</p> : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-2 font-medium text-gray-600">Person</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Details</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Assignments</th>
                <th className="px-4 py-2 w-20" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No people listed</td></tr>
              )}
              {rows.map(n => (
                <tr key={n.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">{n.family_name}</td>
                  <td className="px-4 py-2 text-gray-700 max-w-xs">{n.details}</td>
                  <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{n.status}</td>
                  <td className="px-4 py-2 text-gray-600">{n.assignments}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <button onClick={() => setEditing(n)} className="text-blue-500 hover:text-blue-700 text-xs font-medium">Edit</button>
                      <button onClick={async () => { if (await confirm({ message: `Remove ${n.family_name}?` })) remove(n.id); }}
                        className="text-red-400 hover:text-red-600 text-xs">Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing && 'id' in editing && editing.id ? 'Edit Person Need' : 'Add Person Need'}>
        {editing && (
          <form onSubmit={handleSave} className="space-y-3">
            <Input label="Person Name" value={editing.family_name ?? ''} onChange={v => setEditing(e => e ? { ...e, family_name: v } : e)} required />
            <Textarea label="Details" value={editing.details ?? ''} onChange={v => setEditing(e => e ? { ...e, details: v } : e)} />
            <Input label="Status" value={editing.status ?? ''} onChange={v => setEditing(e => e ? { ...e, status: v } : e)} />
            <Textarea label="Assignments" value={editing.assignments ?? ''} onChange={v => setEditing(e => e ? { ...e, assignments: v } : e)} />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm hover:bg-emerald-700">Save</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
