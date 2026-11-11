import { useMemo, useState } from 'react';
import { useTable } from '../lib/useTable';
import type { PersonalItem } from '../lib/api';
import Modal from '../components/Modal';
import { Input, Select, Textarea } from '../components/FormFields';
import { useConfirm } from '../components/ConfirmDialog';

// Private notes & to-dos for the signed-in user (hub suggestion #36). The server
// only ever returns the caller's own rows.

const IMPORTANCE = ['High', 'Medium', 'Low'] as const;
const IMPORTANCE_RANK: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
const IMPORTANCE_STYLE: Record<string, string> = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low: 'bg-gray-100 text-gray-600',
};

type Filter = 'all' | 'todo' | 'note';
type Draft = Pick<PersonalItem, 'kind' | 'title' | 'details' | 'due_date' | 'importance'> & { id?: number };

const EMPTY_DRAFT: Draft = { kind: 'todo', title: '', details: '', due_date: '', importance: 'Medium' };

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDue(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Most important first, then soonest due (undated last), then newest.
function compareItems(a: PersonalItem, b: PersonalItem): number {
  const ir = (IMPORTANCE_RANK[a.importance] ?? 1) - (IMPORTANCE_RANK[b.importance] ?? 1);
  if (ir !== 0) return ir;
  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  }
  return b.id - a.id;
}

function KindToggle({ value, onChange }: { value: 'todo' | 'note'; onChange: (v: 'todo' | 'note') => void }) {
  return (
    <div className="flex rounded-md border border-gray-300 overflow-hidden shrink-0">
      {([['todo', 'To-Do'], ['note', 'Note']] as const).map(([k, label]) => (
        <button key={k} type="button" onClick={() => onChange(k)}
          className={`px-3 py-2 text-xs font-medium border-r last:border-r-0 border-gray-300 ${
            value === k ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function ItemRow({ item, onToggle, onEdit }: { item: PersonalItem; onToggle: () => void; onEdit: () => void }) {
  const overdue = item.kind === 'todo' && !item.done && !!item.due_date && item.due_date < todayIso();
  return (
    <div className="flex items-start gap-3 bg-white rounded-lg border border-gray-200 px-3 py-2.5 hover:border-blue-300">
      {item.kind === 'todo' ? (
        <input type="checkbox" checked={!!item.done} onChange={onToggle} aria-label={item.done ? 'Mark not done' : 'Mark done'}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0" />
      ) : (
        <span className="mt-0.5 w-4 text-center text-gray-400 shrink-0" title="Note">✎</span>
      )}
      <button type="button" onClick={onEdit} className="flex-1 min-w-0 text-left">
        <p className={`text-sm font-medium break-words ${item.done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {item.title || <span className="text-gray-400 italic">Untitled</span>}
        </p>
        {item.details?.trim() && (
          <p className={`text-sm whitespace-pre-wrap break-words mt-0.5 ${item.done ? 'text-gray-300' : 'text-gray-500'}`}>{item.details}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${IMPORTANCE_STYLE[item.importance] ?? IMPORTANCE_STYLE.Medium}`}>{item.importance}</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{item.kind === 'note' ? 'Note' : 'To-Do'}</span>
          {item.due_date && (
            <span className={`text-[11px] ${overdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
              {overdue ? 'Overdue · ' : 'Due '}{formatDue(item.due_date)}
            </span>
          )}
        </div>
      </button>
    </div>
  );
}

export default function MyNotes() {
  const { rows, isLoading, create, update, remove } = useTable<PersonalItem>('personal-items');
  const confirm = useConfirm();
  const [filter, setFilter] = useState<Filter>('all');
  const [quick, setQuick] = useState<Draft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const visible = useMemo(() => rows.filter(r => filter === 'all' || r.kind === filter), [rows, filter]);
  const open = useMemo(() => visible.filter(r => !r.done).sort(compareItems), [visible]);
  const done = useMemo(() => visible.filter(r => r.done).sort((a, b) => (b.done_at || '').localeCompare(a.done_at || '')), [visible]);

  const payload = (d: Draft) => ({
    kind: d.kind,
    title: d.title.trim(),
    details: d.details?.trim() || null,
    due_date: d.due_date || null,
    importance: d.importance,
  });

  const addQuick = async () => {
    if (!quick.title.trim() || saving) return;
    setSaving(true);
    try {
      await create(payload(quick), { silent: true });
      setQuick({ ...EMPTY_DRAFT, kind: quick.kind });
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editing || saving) return;
    setSaving(true);
    try {
      if (editing.id) await update(editing.id, payload(editing));
      else {
        await create(payload(editing));
        setQuick({ ...EMPTY_DRAFT, kind: editing.kind });
      }
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const deleteEditing = async () => {
    if (!editing?.id) return;
    if (!(await confirm({ message: `Delete "${editing.title || 'this item'}"?` }))) return;
    await remove(editing.id);
    setEditing(null);
  };

  const counts = {
    all: rows.filter(r => !r.done).length,
    todo: rows.filter(r => r.kind === 'todo' && !r.done).length,
    note: rows.filter(r => r.kind === 'note' && !r.done).length,
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">My Notes &amp; To-Dos</h1>
      <p className="text-sm text-gray-500 mb-4">Your private scratch pad. Only you can see these — not other users, not admins.</p>

      <form onSubmit={e => { e.preventDefault(); addQuick(); }}
        className="bg-white rounded-lg border border-gray-200 p-3 mb-4 space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <KindToggle value={quick.kind} onChange={k => setQuick(q => ({ ...q, kind: k }))} />
          <input value={quick.title} onChange={e => setQuick(q => ({ ...q, title: e.target.value }))}
            placeholder={quick.kind === 'todo' ? 'Add a to-do…' : 'Add a note…'}
            className="flex-1 min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            Due
            <input type="date" value={quick.due_date || ''} onChange={e => setQuick(q => ({ ...q, due_date: e.target.value }))}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm" />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            Importance
            <select value={quick.importance} onChange={e => setQuick(q => ({ ...q, importance: e.target.value as Draft['importance'] }))}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm bg-white">
              {IMPORTANCE.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setEditing({ ...quick })}
            className="text-xs text-gray-500 hover:text-gray-700 underline">Add details…</button>
          <button type="submit" disabled={!quick.title.trim() || saving}
            className="ml-auto bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            Add
          </button>
        </div>
      </form>

      <div className="flex rounded-md border border-gray-300 overflow-hidden mb-3 w-fit">
        {([['all', 'All'], ['todo', 'To-Dos'], ['note', 'Notes']] as const).map(([f, label]) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium border-r last:border-r-0 border-gray-300 ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            {label} <span className={filter === f ? 'text-blue-100' : 'text-gray-400'}>({counts[f]})</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : (
        <>
          {open.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-sm text-gray-400">
              Nothing here yet. Add a to-do or note above.
            </div>
          ) : (
            <div className="space-y-2">
              {open.map(item => (
                <ItemRow key={item.id} item={item}
                  onToggle={() => update(item.id, { done: 1 }, { silent: true })}
                  onEdit={() => setEditing({ id: item.id, kind: item.kind, title: item.title, details: item.details || '', due_date: item.due_date || '', importance: item.importance })} />
              ))}
            </div>
          )}

          {done.length > 0 && (
            <div className="mt-6">
              <button type="button" onClick={() => setShowDone(s => !s)} className="text-sm font-medium text-gray-500 hover:text-gray-700">
                Done ({done.length}) {showDone ? '▲' : '▼'}
              </button>
              {showDone && (
                <div className="space-y-2 mt-2">
                  {done.map(item => (
                    <ItemRow key={item.id} item={item}
                      onToggle={() => update(item.id, { done: 0 }, { silent: true })}
                      onEdit={() => setEditing({ id: item.id, kind: item.kind, title: item.title, details: item.details || '', due_date: item.due_date || '', importance: item.importance })} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Item' : 'New Item'}>
        {editing && (
          <form onSubmit={e => { e.preventDefault(); saveEdit(); }} className="space-y-3">
            <div>
              <span className="text-sm font-medium text-gray-700">Type</span>
              <div className="mt-1"><KindToggle value={editing.kind} onChange={k => setEditing({ ...editing, kind: k })} /></div>
            </div>
            <Input label="Title" value={editing.title} onChange={v => setEditing({ ...editing, title: v })} required />
            <Textarea label="Details" value={editing.details || ''} onChange={v => setEditing({ ...editing, details: v })} rows={4} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Due date" type="date" value={editing.due_date || ''} onChange={v => setEditing({ ...editing, due_date: v })} />
              <Select label="Importance" value={editing.importance} onChange={v => setEditing({ ...editing, importance: (v || 'Medium') as Draft['importance'] })} options={[...IMPORTANCE]} />
            </div>
            <div className="flex items-center gap-2 pt-2">
              {editing.id && (
                <button type="button" onClick={deleteEditing} className="text-sm text-red-500 hover:text-red-700">Delete</button>
              )}
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                <button type="submit" disabled={saving || !editing.title.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">Save</button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
