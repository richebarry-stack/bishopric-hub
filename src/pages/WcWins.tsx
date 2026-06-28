import { useState, useMemo } from 'react';
import { useTable } from '../lib/useTable';
import type { WcWin } from '../lib/api';
import Modal from '../components/Modal';
import { Input, Textarea } from '../components/FormFields';

const TODAY = new Date().toISOString().slice(0, 10);
const NINETY_DAYS_AGO = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

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
    rows.filter(w => !w.date || w.date >= NINETY_DAYS_AGO)
      .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [rows]);

  const older = useMemo(() =>
    rows.filter(w => w.date && w.date < NINETY_DAYS_AGO)
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

  const WinCard = ({ w }: { w: WcWin }) => (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-start justify-between gap-3 hover:bg-gray-50">
      <div className="flex-1 min-w-0">
        {w.date && <p className="text-xs text-gray-400 mb-0.5">{formatDate(w.date)}</p>}
        <p className="text-sm text-gray-800">{w.description}</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button onClick={() => setEditing(w)} className="text-blue-500 hover:text-blue-700 text-xs">Edit</button>
        <button onClick={() => { if (confirm('Delete this win?')) remove(w.id); }}
          className="text-red-400 hover:text-red-600 text-xs">Del</button>
      </div>
    </div>
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
          <div className="space-y-2">
            {current.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No recent wins yet. Add one!</p>}
            {current.map(w => <WinCard key={w.id} w={w} />)}
          </div>

          {older.length > 0 && (
            <div>
              <button onClick={() => setShowOld(s => !s)}
                className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-2">
                {showOld ? '▼' : '▶'} Older wins ({older.length})
              </button>
              {showOld && (
                <div className="space-y-2">
                  {older.map(w => <WinCard key={w.id} w={w} />)}
                </div>
              )}
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
