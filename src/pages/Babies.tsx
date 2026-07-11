import { useState } from 'react';
import { useTable } from '../lib/useTable';
import type { Baby } from '../lib/api';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { Input, Select, Textarea, Checkbox } from '../components/FormFields';
import { BABY_STATUSES } from '../lib/constants';
import { useAuth } from '../lib/auth';
import { useConfirm } from '../components/ConfirmDialog';

const COLORS: Record<string, { bg: string; text: string }> = {
  Expecting: { bg: 'bg-blue-100', text: 'text-blue-700' },
  Born: { bg: 'bg-green-100', text: 'text-green-700' },
  Blessed: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  'Recorded ': { bg: 'bg-pink-100', text: 'text-pink-700' },
  Recorded: { bg: 'bg-pink-100', text: 'text-pink-700' },
};

const EMPTY: Partial<Baby> = { name: '', due_birth_date: '', status: 'Expecting', blessing_date: '', church_record_created: 0, notes: '', actions: '' };

function toDateOnly(v: string): string {
  if (!v) return '';
  return v.slice(0, 10);
}

export default function Babies() {
  const { isGuest } = useAuth();
  const { rows, isLoading, create, update, remove } = useTable<Baby>('babies');
  const [editing, setEditing] = useState<Partial<Baby> | null>(null);
  const confirm = useConfirm();

  const handleSave = async () => {
    if (!editing) return;
    const data = { ...editing };
    delete (data as Record<string, unknown>).id;
    if (editing.id) await update(editing.id, data as Record<string, unknown>);
    else await create(data as Record<string, unknown>);
    setEditing(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Babies</h1>
        {!isGuest && <button onClick={() => setEditing({ ...EMPTY })} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">+ Add</button>}
      </div>
      <p className="text-sm text-gray-500 mb-4">New babies, from expecting through blessed and recorded.</p>

      {isLoading ? <p className="text-gray-400 text-sm">Loading...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map(b => (
            <div key={b.id} className={`bg-white rounded-lg border border-gray-200 p-4 ${!isGuest ? 'cursor-pointer hover:shadow-sm' : ''}`}
              onClick={!isGuest ? () => setEditing(b) : undefined}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900">{b.name}</h3>
                <div className="flex items-center gap-2">
                  <StatusBadge status={b.status} colors={COLORS} />
                  {!isGuest && <button onClick={async e => { e.stopPropagation(); if (await confirm(`Delete ${b.name}?`)) remove(b.id); }} className="text-red-400 hover:text-red-600 text-xs">Del</button>}
                </div>
              </div>
              <div className="text-sm text-gray-500 space-y-0.5">
                {b.due_birth_date && <p>Due/Born: {toDateOnly(b.due_birth_date)}</p>}
                {b.blessing_date && <p>Blessing: {toDateOnly(b.blessing_date)}</p>}
                {b.actions && <p>Actions: {b.actions}</p>}
                {!!b.church_record_created && <p className="inline-block bg-green-100 text-green-700 rounded-full px-2 py-0.5 text-xs">Record created</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Baby' : 'New Baby'}>
        {editing && (
          <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-3">
            <Input label="Name" value={editing.name || ''} onChange={v => setEditing({ ...editing, name: v })} required />
            <Input label="Due/Birth Date" value={toDateOnly(editing.due_birth_date || '')} onChange={v => setEditing({ ...editing, due_birth_date: v })} type="date" />
            <Select label="Status" value={editing.status || ''} onChange={v => setEditing({ ...editing, status: v })} options={BABY_STATUSES} />
            <Input label="Blessing Date" value={toDateOnly(editing.blessing_date || '')} onChange={v => setEditing({ ...editing, blessing_date: v })} type="date" />
            <Checkbox label="Church record created (LCR)" checked={!!editing.church_record_created}
              onChange={v => setEditing({
                ...editing,
                church_record_created: v ? 1 : 0,
                status: v && editing.status === 'Blessed' ? 'Recorded' : editing.status,
              })} />
            <Input label="Actions" value={editing.actions || ''} onChange={v => setEditing({ ...editing, actions: v })} />
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
