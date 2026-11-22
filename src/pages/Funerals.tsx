import { useMemo, useState } from 'react';
import { useTable } from '../lib/useTable';
import type { Funeral } from '../lib/api';
import Modal from '../components/Modal';
import MemberNameInput from '../components/MemberNameInput';
import { Input, Textarea } from '../components/FormFields';
import Checklist, { ProgressPill } from '../components/Checklist';
import { useConfirm } from '../components/ConfirmDialog';
import { useAuth } from '../lib/auth';
import { FUNERAL_ITEMS, parseChecklist, stringifyChecklist, checklistProgress } from '../../shared/checklists';

const EMPTY: Partial<Funeral> = {
  deceased_name: '', funeral_date: '', funeral_time: '', viewing_time: '', location: '', family_contact: '', conducting: '',
  checklist: '{}', notes: '', archived: 0,
};

function formatDate(d: string): string {
  if (!d) return '';
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function isSunday(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}/.test(d || '')) return false;
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, day).getDay() === 0;
}

export default function Funerals() {
  const { rows, isLoading, create, update, remove } = useTable<Funeral>('funerals');
  const [editing, setEditing] = useState<Partial<Funeral> | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const confirm = useConfirm();
  const { user, selectedHub } = useAuth();
  const inWc = user?.hub === 'wc' || selectedHub === 'wc';

  const active = useMemo(() => rows.filter(r => !r.archived), [rows]);
  const archived = useMemo(() => rows.filter(r => r.archived), [rows]);

  const handleSave = async () => {
    if (!editing || !editing.deceased_name?.trim()) return;
    const data = {
      deceased_name: editing.deceased_name.trim(), funeral_date: editing.funeral_date || '', funeral_time: editing.funeral_time || '',
      viewing_time: editing.viewing_time || '', location: editing.location || '', family_contact: editing.family_contact || '',
      conducting: editing.conducting || '', checklist: editing.checklist || '{}', notes: editing.notes || '', archived: editing.archived ? 1 : 0,
    };
    if (editing.id) await update(editing.id, data);
    else await create(data);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!editing?.id) return;
    if (!await confirm({ message: `Delete the funeral plan for ${editing.deceased_name}?` })) return;
    await remove(editing.id);
    setEditing(null);
  };

  const card = (f: Funeral) => {
    const state = parseChecklist(f.checklist);
    const { done, total } = checklistProgress(FUNERAL_ITEMS, state);
    return (
      <div key={f.id} className={`bg-white rounded-lg border border-gray-200 p-4 ${f.archived ? 'opacity-70' : ''}`}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <button type="button" onClick={() => setEditing(f)} className="text-left">
            <h3 className="font-medium text-gray-900 hover:text-blue-700">{f.deceased_name}</h3>
            <p className="text-xs text-gray-500">
              {f.funeral_date ? `${formatDate(f.funeral_date)}${f.funeral_time ? ` · ${f.funeral_time}` : ''}` : 'Date not set'}
              {f.location ? ` · ${f.location}` : ''}
            </p>
            {f.viewing_time && <p className="text-xs text-gray-500">Viewing: {f.viewing_time}</p>}
            {f.family_contact && <p className="text-xs text-gray-500">Family contact: {f.family_contact}</p>}
            {f.conducting && <p className="text-xs text-gray-500">Conducting: {f.conducting}</p>}
          </button>
          <ProgressPill done={done} total={total} />
        </div>
        <Checklist items={FUNERAL_ITEMS} state={state} onChange={next => update(f.id, { checklist: stringifyChecklist(next) }, { silent: true })} />
        {f.notes && <p className="text-xs text-gray-500 mt-2 whitespace-pre-line">{f.notes}</p>}
        {!f.archived && done === total && (
          <button type="button" onClick={() => update(f.id, { archived: 1 }, { silent: true })}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium">All done — archive</button>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Funerals</h1>
        <button onClick={() => setEditing({ ...EMPTY })} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">+ Add</button>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Planning a funeral with the family (General Handbook 29.5). The bishop or a counselor oversees it; the elders quorum and Relief Society
        help the family. Funerals are usually no longer than 1½ hours and aren't normally held on Sunday.
      </p>

      {isLoading ? <p className="text-gray-400 text-sm">Loading...</p> : active.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No funerals being planned.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{active.map(card)}</div>
      )}

      {archived.length > 0 && (
        <div className="mt-6">
          <button type="button" onClick={() => setShowArchived(v => !v)} className="text-sm text-gray-600 hover:text-gray-900 font-medium">
            {showArchived ? '▾' : '▸'} Archived ({archived.length})
          </button>
          {showArchived && <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">{archived.map(card)}</div>}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Funeral' : 'New Funeral'}>
        {editing && (
          <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-3">
            {inWc
              ? <Input label="Name of the deceased" value={editing.deceased_name || ''} onChange={v => setEditing({ ...editing, deceased_name: v })} required />
              : <MemberNameInput label="Name of the deceased" format="firstLast" value={editing.deceased_name || ''} onChange={v => setEditing({ ...editing, deceased_name: v })} required />}
            <div className="grid grid-cols-2 gap-3">
              <Input label="Funeral date" type="date" value={(editing.funeral_date || '').slice(0, 10)} onChange={v => setEditing({ ...editing, funeral_date: v })} />
              <Input label="Funeral time" value={editing.funeral_time || ''} onChange={v => setEditing({ ...editing, funeral_time: v })} placeholder="e.g. 11:00 AM" />
            </div>
            {isSunday(editing.funeral_date || '') && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">Funerals aren't normally held on Sunday (General Handbook 29.5).</p>
            )}
            <Input label="Viewing" value={editing.viewing_time || ''} onChange={v => setEditing({ ...editing, viewing_time: v })} placeholder="e.g. 9:30–10:30 AM, Relief Society room" />
            <Input label="Location" value={editing.location || ''} onChange={v => setEditing({ ...editing, location: v })} />
            <Input label="Family contact" value={editing.family_contact || ''} onChange={v => setEditing({ ...editing, family_contact: v })} placeholder="Name and phone" />
            <Input label="Presiding / conducting" value={editing.conducting || ''} onChange={v => setEditing({ ...editing, conducting: v })} />
            <div>
              <span className="block text-sm font-medium text-gray-700 mb-1">Checklist</span>
              <Checklist items={FUNERAL_ITEMS} state={parseChecklist(editing.checklist)}
                onChange={next => setEditing({ ...editing, checklist: stringifyChecklist(next) })} />
            </div>
            <Textarea label="Notes (program, speakers, music)" value={editing.notes || ''} onChange={v => setEditing({ ...editing, notes: v })} rows={4} />
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input type="checkbox" checked={!!editing.archived} onChange={e => setEditing({ ...editing, archived: e.target.checked ? 1 : 0 })} className="rounded border-gray-300" />
              Archived
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
