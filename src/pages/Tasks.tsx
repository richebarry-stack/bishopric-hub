import { useState } from 'react';
import { useTable } from '../lib/useTable';
import type { Task } from '../lib/api';
import Modal from '../components/Modal';
import { Input, Select, Textarea } from '../components/FormFields';
import { SHARE_WITH_OPTIONS } from '../lib/constants';

const EMPTY: Partial<Task> = { task: '', assigned_to: '', done: 0, share_with: '' };

export default function Tasks() {
  const { rows, isLoading, create, update, remove } = useTable<Task>('tasks');
  const [editing, setEditing] = useState<Partial<Task> | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [filter, setFilter] = useState('');

  const filtered = rows.filter(r => {
    if (!showDone && r.done) return false;
    if (filter) {
      const q = filter.toLowerCase();
      return r.task?.toLowerCase().includes(q) || r.assigned_to?.toLowerCase().includes(q);
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

  const toggleDone = async (t: Task) => {
    await update(t.id, { done: t.done ? 0 : 1 });
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
        <button onClick={() => setEditing({ ...EMPTY })} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
          + New Task
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search tasks..."
          className="rounded-md border border-gray-300 px-3 py-2 text-sm flex-1" />
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} className="rounded" />
          Show completed
        </label>
      </div>

      {isLoading ? <p className="text-gray-400 text-sm">Loading...</p> : (
        <div className="space-y-1">
          {filtered.map(t => (
            <div key={t.id} className={`flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2 ${t.done ? 'opacity-50' : ''}`}>
              <input type="checkbox" checked={!!t.done} onChange={() => toggleDone(t)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setEditing(t)}>
                <p className={`text-sm ${t.done ? 'line-through text-gray-400' : 'text-gray-900'}`}>{t.task}</p>
                <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                  {t.assigned_to && <span>{t.assigned_to}</span>}
                  {t.created_date && <span>{t.created_date}</span>}
                  {t.share_with && <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{t.share_with}</span>}
                </div>
              </div>
              <button onClick={() => remove(t.id)} className="text-red-400 hover:text-red-600 text-xs">Del</button>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No tasks found</p>}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Task' : 'New Task'}>
        {editing && (
          <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-3">
            <Textarea label="Task" value={editing.task || ''} onChange={v => setEditing({ ...editing, task: v })} />
            <Input label="Assigned To" value={editing.assigned_to || ''} onChange={v => setEditing({ ...editing, assigned_to: v })} />
            <Select label="Share With" value={editing.share_with || ''} onChange={v => setEditing({ ...editing, share_with: v })} options={SHARE_WITH_OPTIONS} />
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
