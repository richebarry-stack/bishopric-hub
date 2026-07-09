import { useState } from 'react';
import { useTable } from '../lib/useTable';
import type { OutOfTown as OutOfTownType } from '../lib/api';
import Modal from '../components/Modal';
import { Input, Textarea } from '../components/FormFields';
import { useConfirm } from '../components/ConfirmDialog';

const EMPTY: Partial<OutOfTownType> = { who: '', start_date: '', end_date: '', notes: '' };

export default function OutOfTown() {
  const { rows, isLoading, create, update, remove } = useTable<OutOfTownType>('out-of-town');
  const [editing, setEditing] = useState<Partial<OutOfTownType> | null>(null);
  const confirm = useConfirm();

  const handleSave = async () => {
    if (!editing) return;
    const data = { ...editing };
    delete (data as Record<string, unknown>).id;
    if (editing.id) await update(editing.id, data as Record<string, unknown>);
    else await create(data as Record<string, unknown>);
    setEditing(null);
  };

  const today = new Date().toISOString().split('T')[0];
  const current = rows.filter(r => !r.end_date || r.end_date >= today);
  const past = rows.filter(r => r.end_date && r.end_date < today);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Out of Town</h1>
        <button onClick={() => setEditing({ ...EMPTY })} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">+ Add</button>
      </div>

      {isLoading ? <p className="text-gray-400 text-sm">Loading...</p> : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-3 py-2 font-medium text-gray-600">Who</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Start</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">End</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Notes</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {[...current, ...past].map(r => (
                <tr key={r.id} className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${r.end_date && r.end_date < today ? 'opacity-50' : ''}`} onClick={() => setEditing(r)}>
                  <td className="px-3 py-2 font-medium text-gray-900">{r.who}</td>
                  <td className="px-3 py-2 text-gray-700 font-mono">{(r.start_date || '').slice(0, 10)}</td>
                  <td className="px-3 py-2 text-gray-700 font-mono">{(r.end_date || '').slice(0, 10)}</td>
                  <td className="px-3 py-2 text-gray-600">{r.notes}</td>
                  <td className="px-3 py-2">
                    <button onClick={async e => { e.stopPropagation(); if (await confirm(`Delete this entry for ${r.who}?`)) remove(r.id); }} className="text-red-400 hover:text-red-600 text-xs">Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit' : 'New Out of Town'}>
        {editing && (
          <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-3">
            <Input label="Who" value={editing.who || ''} onChange={v => setEditing({ ...editing, who: v })} required />
            <Input label="Start Date" value={editing.start_date || ''} onChange={v => setEditing({ ...editing, start_date: v })} type="date" required />
            <Input label="End Date" value={editing.end_date || ''} onChange={v => setEditing({ ...editing, end_date: v })} type="date" />
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
