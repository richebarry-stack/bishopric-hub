import { useState, useEffect } from 'react';
import { useTable } from '../lib/useTable';
import type { HubSuggestion } from '../lib/api';
import { useAuth } from '../lib/auth';

const TYPES = [
  { value: 'feature', label: 'New Feature' },
  { value: 'bug',     label: 'Bug Fix'     },
  { value: 'other',   label: 'Other'       },
];

const STATUSES = [
  { value: 'open',        label: 'Open',        cls: 'bg-blue-100 text-blue-700'    },
  { value: 'planned',     label: 'Planned',     cls: 'bg-violet-100 text-violet-700' },
  { value: 'implemented', label: 'Implemented', cls: 'bg-emerald-100 text-emerald-700' },
  { value: 'done',        label: 'Done',        cls: 'bg-green-100 text-green-700'  },
  { value: 'declined',    label: 'Declined',    cls: 'bg-gray-100 text-gray-500'    },
];

function typeBadge(type: string) {
  if (type === 'feature') return 'bg-amber-100 text-amber-700';
  if (type === 'bug')     return 'bg-red-100 text-red-700';
  return 'bg-gray-100 text-gray-600';
}

function typeLabel(type: string) {
  return TYPES.find(t => t.value === type)?.label ?? type;
}

function statusInfo(status: string) {
  return STATUSES.find(s => s.value === status) ?? { label: status, cls: 'bg-gray-100 text-gray-500' };
}

type FormData = { type: string; title: string; description: string; status: string; admin_notes: string };

function SuggestionModal({ initial, isAdmin, onSave, onClose }: {
  initial: FormData;
  isAdmin: boolean;
  onSave: (data: FormData) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormData>(initial);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof FormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); onClose(); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <h2 className="font-semibold text-gray-900">
            {initial.title ? 'Edit Suggestion' : 'Submit Suggestion'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={submit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 space-y-4 overflow-y-auto">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Type</span>
              <select value={form.type} onChange={e => set('type', e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Title</span>
              <input type="text" required value={form.title} onChange={e => set('title', e.target.value)}
                placeholder="Brief summary…"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Description</span>
              <textarea rows={4} required value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Describe the feature or issue in detail…"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </label>
            {isAdmin && (
              <>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Status</span>
                  <select value={form.status} onChange={e => set('status', e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Admin Notes</span>
                  <textarea rows={2} value={form.admin_notes} onChange={e => set('admin_notes', e.target.value)}
                    placeholder="Response or notes…"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </label>
              </>
            )}
          </div>
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SuggestionCard({ row, isAdmin, onEdit, onDelete }: {
  row: HubSuggestion;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const si = statusInfo(row.status);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeBadge(row.type)}`}>
            {typeLabel(row.type)}
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${si.cls}`}>
            {si.label}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && (
            <button onClick={onEdit} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
          )}
          {isAdmin && (
            confirmDel ? (
              <>
                <button onClick={onDelete} className="text-xs text-red-600 hover:text-red-800">Confirm</button>
                <button onClick={() => setConfirmDel(false)} className="text-xs text-gray-400">Cancel</button>
              </>
            ) : (
              <button onClick={() => setConfirmDel(true)} className="text-xs text-gray-400 hover:text-red-500">Delete</button>
            )
          )}
        </div>
      </div>
      <p className="font-semibold text-gray-900">{row.title}</p>
      <p className="text-sm text-gray-600 whitespace-pre-wrap">{row.description}</p>
      {row.admin_notes && (
        <div className="mt-2 bg-blue-50 border border-blue-100 rounded p-2 text-sm text-blue-800">
          <span className="font-medium">Response: </span>{row.admin_notes}
        </div>
      )}
      <p className="text-xs text-gray-400">Submitted by {row.submitted_by}</p>
    </div>
  );
}

function Section({ title, rows, isAdmin, onEdit, onDelete, defaultOpen = true }: {
  title: string;
  rows: HubSuggestion[];
  isAdmin: boolean;
  onEdit: (row: HubSuggestion) => void;
  onDelete: (id: number) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (rows.length === 0) return null;
  return (
    <section>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-base font-semibold text-gray-700 hover:text-gray-900 mb-3">
        {title}
        <span className="text-sm font-normal text-gray-400">({rows.length})</span>
        <span className="text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="space-y-3">
          {rows.map(row => (
            <SuggestionCard key={row.id} row={row} isAdmin={isAdmin}
              onEdit={() => onEdit(row)}
              onDelete={() => onDelete(row.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function HubSuggestions() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { rows, isLoading, create, update, remove } = useTable<HubSuggestion>('hub-suggestions');
  const [modal, setModal] = useState<{ row?: HubSuggestion } | null>(null);

  const emptyForm = (): FormData => ({ type: 'feature', title: '', description: '', status: 'open', admin_notes: '' });
  const toForm = (row: HubSuggestion): FormData => ({
    type: row.type, title: row.title, description: row.description,
    status: row.status, admin_notes: row.admin_notes,
  });

  const handleSave = async (form: FormData) => {
    if (modal?.row) {
      await update(modal.row.id, { ...form, updated_at: new Date().toISOString() });
    } else {
      await create({ ...form, submitted_by: user?.name ?? 'Unknown', updated_at: new Date().toISOString() });
    }
  };

  const open        = rows.filter(r => r.status === 'open');
  const planned     = rows.filter(r => r.status === 'planned');
  const implemented = rows.filter(r => r.status === 'implemented');
  const done        = rows.filter(r => r.status === 'done');
  const declined    = rows.filter(r => r.status === 'declined');

  if (isLoading) return <p className="text-gray-400 text-sm">Loading…</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      {modal && (
        <SuggestionModal
          initial={modal.row ? toForm(modal.row) : emptyForm()}
          isAdmin={isAdmin}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hub Suggestions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Submit ideas for new features or report bugs</p>
        </div>
        <button onClick={() => setModal({})}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 shrink-0">
          + New Suggestion
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">No suggestions yet</p>
          <p className="text-sm mt-1">Be the first to submit one!</p>
        </div>
      ) : (
        <div className="space-y-8">
          <Section title="Open" rows={open} isAdmin={isAdmin}
            onEdit={row => setModal({ row })} onDelete={id => remove(id)} />
          <Section title="Planned" rows={planned} isAdmin={isAdmin}
            onEdit={row => setModal({ row })} onDelete={id => remove(id)} />
          <Section title="Implemented" rows={implemented} isAdmin={isAdmin} defaultOpen={false}
            onEdit={row => setModal({ row })} onDelete={id => remove(id)} />
          <Section title="Done" rows={done} isAdmin={isAdmin} defaultOpen={false}
            onEdit={row => setModal({ row })} onDelete={id => remove(id)} />
          <Section title="Declined" rows={declined} isAdmin={isAdmin} defaultOpen={false}
            onEdit={row => setModal({ row })} onDelete={id => remove(id)} />
        </div>
      )}
    </div>
  );
}
