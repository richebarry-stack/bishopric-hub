import { useState, useMemo } from 'react';
import { useTable } from '../lib/useTable';
import type { WcWin } from '../lib/api';
import Modal from '../components/Modal';
import { Input, Textarea } from '../components/FormFields';

const TODAY = new Date().toISOString().slice(0, 10);

function startOfWeek(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay()); // back up to Sunday
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const WEEK_START = startOfWeek();

function formatDate(iso: string): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m[2],10)-1]} ${parseInt(m[3],10)}, ${m[1]}`;
}

export default function WcWins() {
  const { rows, isLoading, create, update, remove } = useTable<WcWin>('wc-wins');
  const [editing, setEditing] = useState<WcWin | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ date: TODAY, description: '' });
  const [showOld, setShowOld] = useState(false);

  const current = useMemo(() =>
    rows.filter(w => !w.date || w.date >= WEEK_START)
      .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [rows]);

  const older = useMemo(() =>
    rows.filter(w => w.date && w.date < WEEK_START)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [rows]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await create(form);
    setForm({ date: TODAY, description: '' });
    setAdding(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    await update(editing.id, { date: editing.date, description: editing.description });
    setEditing(null);
  };

  const WinsTable = ({ items }: { items: WcWin[] }) => (
    <table className="w-full border-collapse bg-white rounded-lg border border-gray-200 overflow-hidden">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-200">
          <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2 w-32">Date</th>
          <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2">Description</th>
          <th className="w-20"></th>
        </tr>
      </thead>
      <tbody>
        {items.map(w => (
          <tr key={w.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
            <td className="px-4 py-2 text-xs text-gray-400 whitespace-nowrap align-top">{formatDate(w.date)}</td>
            <td className="px-4 py-2 text-sm text-gray-800">{w.description}</td>
            <td className="px-4 py-2 text-right whitespace-nowrap align-top">
              <button onClick={() => setEditing(w)} className="text-blue-500 hover:text-blue-700 text-xs mr-2">Edit</button>
              <button onClick={() => { if (confirm('Delete this win?')) remove(w.id); }}
                className="text-red-400 hover:text-red-600 text-xs">Del</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Wins for the Ward</h1>
        <button onClick={() => { setForm({ date: TODAY, description: '' }); setAdding(true); }}
          className="bg-emerald-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-emerald-700">
          + Add Win
        </button>
      </div>

      {isLoading ? <p className="text-gray-400 text-sm">Loading…</p> : (
        <>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">This week</p>
            {current.length === 0
              ? <p className="text-sm text-gray-400 text-center py-6">No wins yet this week. Add one!</p>
              : <WinsTable items={current} />}
          </div>

          {older.length > 0 && (
            <div>
              <button onClick={() => setShowOld(s => !s)}
                className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-2">
                {showOld ? '▼' : '▶'} Older wins ({older.length})
              </button>
              {showOld && <WinsTable items={older} />}
            </div>
          )}
        </>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add Win">
        <form onSubmit={handleAdd} className="space-y-3">
          <Input label="Date" value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} type="date" />
          <Textarea label="Description" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setAdding(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm hover:bg-emerald-700">Add</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Win">
        {editing && (
          <form onSubmit={handleSave} className="space-y-3">
            <Input label="Date" value={editing.date || ''} onChange={v => setEditing(e => e ? { ...e, date: v } : e)} type="date" />
            <Textarea label="Description" value={editing.description || ''} onChange={v => setEditing(e => e ? { ...e, description: v } : e)} />
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
