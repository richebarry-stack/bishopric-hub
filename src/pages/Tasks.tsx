import { useState, useMemo } from 'react';
import { useTable } from '../lib/useTable';
import { useAuth } from '../lib/auth';
import type { Task } from '../lib/api';
import Modal from '../components/Modal';
import { Input, Textarea } from '../components/FormFields';
import { SHARE_WITH_OPTIONS } from '../lib/constants';
import { useConfirm } from '../components/ConfirmDialog';
import LastEdited from '../components/LastEdited';

const EMPTY: Partial<Task> = { task: '', assigned_to: '', done: 0, share_with: '', due_date: '' };

const TODAY = new Date().toISOString().slice(0, 10);
const IN_3_DAYS = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

function dueSoonClass(due: string | undefined): string {
  if (!due) return '';
  if (due < TODAY) return 'text-red-600 font-semibold';
  if (due <= IN_3_DAYS) return 'text-amber-600 font-semibold';
  return 'text-gray-400';
}

function parseShareWith(s: string | undefined): string[] {
  if (!s) return [];
  return s.split(',').map(v => v.trim()).filter(Boolean);
}

function ShareWithCheckboxes({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[];
}) {
  const selected = new Set(parseShareWith(value));
  const toggle = (opt: string) => {
    const next = new Set(selected);
    if (next.has(opt)) next.delete(opt); else next.add(opt);
    onChange([...next].join(','));
  };
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Share With</label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <label key={opt} className={`flex items-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-md border text-sm select-none ${selected.has(opt) ? 'bg-blue-50 border-blue-400 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            <input type="checkbox" checked={selected.has(opt)} onChange={() => toggle(opt)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function Tasks() {
  const { user, selectedHub } = useAuth();
  const isWc = user?.hub === 'wc' || (user?.hub === 'both' && selectedHub === 'wc');
  const shareWithOptions = isWc ? ['Ward Council'] : SHARE_WITH_OPTIONS;

  const { rows, isLoading, create, update, remove } = useTable<Task>('tasks');
  const [editing, setEditing] = useState<Partial<Task> | null>(null);
  const [showDone, setShowDone] = useState(false);
  const confirm = useConfirm();
  const [filter, setFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');

  const assigneeOptions = useMemo(() => [...new Set(rows.map(r => r.assigned_to).filter(Boolean))].sort(), [rows]);

  const openNew = () => setEditing({ ...EMPTY, share_with: isWc ? 'Ward Council' : '' });

  // hub='both' users in WC context only see WC-tagged tasks (hub='wc' is already filtered by backend)
  const visibleRows = (isWc && user?.hub === 'both')
    ? rows.filter(r => parseShareWith(r.share_with).includes('Ward Council'))
    : rows;

  const filtered = visibleRows.filter(r => {
    if (!showDone && r.done) return false;
    if (assigneeFilter && r.assigned_to !== assigneeFilter) return false;
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
        <h1 className="text-2xl font-bold text-gray-900">Action Items</h1>
        <button onClick={openNew} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
          + New Item
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">Action items assigned to individuals, with due dates.</p>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search action items..."
          className="rounded-md border border-gray-300 px-3 py-2 text-sm flex-1" />
        <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All assignees</option>
          {assigneeOptions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
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
                <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5 flex-wrap">
                  {t.assigned_to && <span>{t.assigned_to}</span>}
                  {t.due_date && (
                    <span className={dueSoonClass(t.due_date)}>
                      Due {t.due_date < TODAY ? 'overdue' : t.due_date}
                    </span>
                  )}
                  {parseShareWith(t.share_with).map(v => (
                    <span key={v} className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{v}</span>
                  ))}
                </div>
              </div>
              <button onClick={async () => { if (await confirm({ message: `Delete "${t.task}"?` })) remove(t.id); }} className="text-red-400 hover:text-red-600 text-xs">Del</button>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No action items found</p>}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Action Item' : 'New Action Item'}>
        {editing && (
          <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-3">
            <Textarea label="Task" value={editing.task || ''} onChange={v => setEditing({ ...editing, task: v })} />
            <Input label="Assigned To" value={editing.assigned_to || ''} onChange={v => setEditing({ ...editing, assigned_to: v })} />
            <Input label="Due Date" value={(editing.due_date || '').slice(0, 10)} onChange={v => setEditing({ ...editing, due_date: v })} type="date" />
            <ShareWithCheckboxes
              value={editing.share_with || ''}
              onChange={v => setEditing({ ...editing, share_with: v })}
              options={shareWithOptions}
            />
            <LastEdited updatedBy={editing.updated_by} updatedAt={editing.updated_at} />
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
