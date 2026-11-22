import { useMemo, useState } from 'react';
import { useTable } from '../lib/useTable';
import type { MemberCare as MemberCareRow } from '../lib/api';
import Modal from '../components/Modal';
import MemberNameInput from '../components/MemberNameInput';
import { Input, Select, Textarea } from '../components/FormFields';
import Checklist, { ProgressPill } from '../components/Checklist';
import { useConfirm } from '../components/ConfirmDialog';
import { useAuth } from '../lib/auth';
import {
  MEMBER_CARE_ITEMS, MEMBER_CARE_KINDS, parseChecklist, stringifyChecklist, checklistProgress, type ChecklistState,
} from '../../shared/checklists';

function today(): string {
  return new Date().toLocaleDateString('en-CA');
}

const EMPTY: Partial<MemberCareRow> = { member_name: '', kind: 'New convert', added_date: '', checklist: '{}', notes: '', archived: 0 };

export default function MemberCare() {
  const { rows, isLoading, create, update, remove } = useTable<MemberCareRow>('member-care');
  const [editing, setEditing] = useState<Partial<MemberCareRow> | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const confirm = useConfirm();
  // The ward roster (name suggestions) is bishopric-only, so the WC view uses a plain field.
  const { user, selectedHub } = useAuth();
  const inWc = user?.hub === 'wc' || selectedHub === 'wc';

  const active = useMemo(() => rows.filter(r => !r.archived), [rows]);
  const archived = useMemo(() => rows.filter(r => r.archived), [rows]);

  const toggle = (row: MemberCareRow, next: ChecklistState) => {
    update(row.id, { checklist: stringifyChecklist(next) }, { silent: true });
  };

  const handleSave = async () => {
    if (!editing || !editing.member_name?.trim()) return;
    const data = {
      member_name: editing.member_name.trim(), kind: editing.kind || 'Move-in',
      added_date: editing.added_date || today(), checklist: editing.checklist || '{}',
      notes: editing.notes || '', archived: editing.archived ? 1 : 0,
    };
    if (editing.id) await update(editing.id, data);
    else await create(data);
    setEditing(null);
  };

  // The server keeps a hidden tombstone for move-in rows so they aren't re-added.
  const deleteRow = async (row: Pick<MemberCareRow, 'id' | 'member_name'>): Promise<boolean> => {
    if (!await confirm({ message: `Delete ${row.member_name} from this list? This can't be undone.` })) return false;
    await remove(row.id);
    return true;
  };

  const handleDelete = async () => {
    if (!editing?.id) return;
    if (await deleteRow({ id: editing.id, member_name: editing.member_name || '' })) setEditing(null);
  };

  const card = (r: MemberCareRow) => {
    const state = parseChecklist(r.checklist);
    const { done, total } = checklistProgress(MEMBER_CARE_ITEMS, state);
    return (
      <div key={r.id} className={`bg-white rounded-lg border border-gray-200 p-4 ${r.archived ? 'opacity-70' : ''}`}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <button type="button" onClick={() => setEditing(r)} className="text-left">
            <h3 className="font-medium text-gray-900 hover:text-blue-700">{r.member_name}</h3>
            <p className="text-xs text-gray-500">{r.kind}{r.added_date ? ` · added ${r.added_date.slice(0, 10)}` : ''}</p>
          </button>
          <div className="flex items-center gap-2">
            <ProgressPill done={done} total={total} />
            <button type="button" onClick={() => deleteRow(r)} className="text-red-400 hover:text-red-600 text-xs">Del</button>
          </div>
        </div>
        <Checklist items={MEMBER_CARE_ITEMS} state={state} onChange={next => toggle(r, next)} />
        {r.notes && <p className="text-xs text-gray-500 mt-2 whitespace-pre-line">{r.notes}</p>}
        {!r.archived && done === total && (
          <button type="button" onClick={() => update(r.id, { archived: 1 }, { silent: true })}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium">All done — archive</button>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">New &amp; Returning Members</h1>
        <button onClick={() => setEditing({ ...EMPTY, added_date: today() })} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">+ Add</button>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Helping new, returning and recently baptized members feel welcome (General Handbook 23.5). Move-ins entered on Current Bishopric
        Meeting are added here automatically; add converts and returning members by hand. Review this list in ward council until each
        checklist is done.
      </p>

      {isLoading ? <p className="text-gray-400 text-sm">Loading...</p> : active.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No one to follow up with right now.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{active.map(card)}</div>
      )}

      {archived.length > 0 && (
        <div className="mt-6">
          <button type="button" onClick={() => setShowArchived(v => !v)} className="text-sm text-gray-600 hover:text-gray-900 font-medium">
            {showArchived ? '▾' : '▸'} Archived ({archived.length})
          </button>
          {showArchived && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">{archived.map(card)}</div>}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Member' : 'Add Member'}>
        {editing && (
          <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-3">
            {inWc
              ? <Input label="Member / family" value={editing.member_name || ''} onChange={v => setEditing({ ...editing, member_name: v })} required />
              : <MemberNameInput label="Member / family" format="firstLast" value={editing.member_name || ''} onChange={v => setEditing({ ...editing, member_name: v })} required />}
            <Select label="Type" value={editing.kind || ''} onChange={v => setEditing({ ...editing, kind: v })} options={MEMBER_CARE_KINDS} />
            <Input label="Added" type="date" value={(editing.added_date || '').slice(0, 10)} onChange={v => setEditing({ ...editing, added_date: v })} />
            <div>
              <span className="block text-sm font-medium text-gray-700 mb-1">Checklist</span>
              <Checklist items={MEMBER_CARE_ITEMS} state={parseChecklist(editing.checklist)}
                onChange={next => setEditing({ ...editing, checklist: stringifyChecklist(next) })} />
            </div>
            <Textarea label="Notes" value={editing.notes || ''} onChange={v => setEditing({ ...editing, notes: v })} />
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input type="checkbox" checked={!!editing.archived} onChange={e => setEditing({ ...editing, archived: e.target.checked ? 1 : 0 })} className="rounded border-gray-300" />
              Archived (no longer needs follow-up)
            </label>
            <div className="flex justify-between pt-2">
              <div>
                {editing.id && (
                  <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm text-red-600 hover:text-red-800">
                    Delete
                  </button>
                )}
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
