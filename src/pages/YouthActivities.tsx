import { useState } from 'react';
import { useTable } from '../lib/useTable';
import type { YouthActivity } from '../lib/api';
import { useAuth } from '../lib/auth';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function formatDate(s: string) {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s || '';
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return `${DAYS[d.getDay()]} ${MONTHS[+m[2] - 1]} ${+m[3]}, ${m[1]}`;
}

function nextWednesday() {
  const d = new Date();
  const diff = (3 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const GROUPS: { key: keyof Omit<YouthActivity, 'id' | 'date' | 'notes' | 'updated_at'>; label: string; short: string }[] = [
  { key: 'builders_of_faith',  label: 'Builders of Faith',  short: 'Builders'   },
  { key: 'messengers_of_hope', label: 'Messengers of Hope', short: 'Messengers' },
  { key: 'gatherers_of_light', label: 'Gatherers of Light', short: 'Gatherers'  },
  { key: 'deacons',            label: 'Deacons',            short: 'Deacons'    },
  { key: 'teachers',           label: 'Teachers',           short: 'Teachers'   },
  { key: 'priests',            label: 'Priests',            short: 'Priests'    },
];

type FormData = {
  date: string;
  builders_of_faith: string;
  messengers_of_hope: string;
  gatherers_of_light: string;
  deacons: string;
  teachers: string;
  priests: string;
  notes: string;
};

const emptyForm = (date = nextWednesday()): FormData => ({
  date,
  builders_of_faith: '', messengers_of_hope: '', gatherers_of_light: '',
  deacons: '', teachers: '', priests: '', notes: '',
});

function toForm(row: YouthActivity): FormData {
  return {
    date:               row.date?.slice(0, 10) ?? '',
    builders_of_faith:  row.builders_of_faith  ?? '',
    messengers_of_hope: row.messengers_of_hope ?? '',
    gatherers_of_light: row.gatherers_of_light ?? '',
    deacons:  row.deacons  ?? '',
    teachers: row.teachers ?? '',
    priests:  row.priests  ?? '',
    notes:    row.notes    ?? '',
  };
}

function EventModal({ initial, onSave, onClose }: {
  initial: FormData;
  onSave: (data: FormData) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormData>(initial);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof FormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); onClose(); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <h2 className="font-semibold text-gray-900">Youth Activity</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={submit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 space-y-3 overflow-y-auto">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Date</span>
              <input type="date" required value={form.date} onChange={e => set('date', e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <div className="bg-gray-50 px-3 py-2">
                <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Activities by Group</span>
              </div>
              <div className="divide-y divide-gray-100">
                {GROUPS.map(g => (
                  <label key={g.key} className="flex items-center gap-3 px-3 py-2">
                    <span className="w-36 shrink-0 text-sm font-medium text-gray-700">{g.label}</span>
                    <input value={form[g.key]} onChange={e => set(g.key, e.target.value)}
                      placeholder="Activity…"
                      className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </label>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Notes</span>
              <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)}
                placeholder="Location, supplies, other details…"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </label>
          </div>
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ActivityTable({ rows, isPast, readOnly, onEdit, onDelete, confirmDelete, onConfirmDelete, onCancelDelete }: {
  rows: YouthActivity[];
  isPast: boolean;
  readOnly?: boolean;
  onEdit: (row: YouthActivity) => void;
  onDelete: (id: number) => void;
  confirmDelete: number | null;
  onConfirmDelete: (id: number) => void;
  onCancelDelete: () => void;
}) {
  if (rows.length === 0) return (
    <p className="text-sm text-gray-400 italic py-2">None</p>
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full bg-white text-sm">
        <thead className={isPast ? 'bg-gray-100' : 'bg-blue-50'}>
          <tr>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-gray-500 whitespace-nowrap">Date</th>
            {GROUPS.map(g => (
              <th key={g.key} className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-gray-500 whitespace-nowrap">
                {g.label}
              </th>
            ))}
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Notes</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const hasContent = GROUPS.some(g => row[g.key]?.trim()) || row.notes?.trim();
            return (
              <tr key={row.id}
                className={`border-t border-gray-100 hover:bg-gray-50 ${isPast && !hasContent ? 'opacity-40' : isPast ? 'opacity-70' : ''}`}>
                <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                  {formatDate(row.date)}
                </td>
                {GROUPS.map(g => (
                  <td key={g.key} className="px-3 py-2 text-gray-700 min-w-[120px] max-w-[180px]">
                    {row[g.key]
                      ? <span className="line-clamp-2">{row[g.key]}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                ))}
                <td className="px-3 py-2 text-gray-500 max-w-[160px]">
                  {row.notes
                    ? <span className="line-clamp-2">{row.notes}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {!readOnly && <button onClick={() => onEdit(row)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>}
                    {!readOnly && (confirmDelete === row.id ? (
                      <>
                        <button onClick={() => onDelete(row.id)} className="text-xs text-red-600 hover:text-red-800">Confirm</button>
                        <button onClick={onCancelDelete} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                      </>
                    ) : (
                      <button onClick={() => onConfirmDelete(row.id)} className="text-xs text-gray-400 hover:text-red-500">Delete</button>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function YouthActivities() {
  const { isWcReadOnly } = useAuth();
  const { rows, isLoading, create, update, remove } = useTable<YouthActivity>('youth-activities');
  const [modal, setModal] = useState<{ form: FormData; id?: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [showPast, setShowPast] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = sorted.filter(r => r.date >= today);
  const past     = sorted.filter(r => r.date <  today).reverse();

  const handleSave = async (form: FormData) => {
    if (modal?.id) await update(modal.id, form);
    else           await create(form);
  };

  if (isLoading) return <p className="text-gray-400 text-sm">Loading…</p>;

  return (
    <div className="space-y-8">
      {modal && (
        <EventModal
          initial={modal.form}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Youth Activities</h1>
        {!isWcReadOnly && (
          <button onClick={() => setModal({ form: emptyForm() })}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 shrink-0">
            + Add Event
          </button>
        )}
      </div>

      {/* Upcoming */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          Upcoming
          <span className="text-sm font-normal text-gray-400">({upcoming.length})</span>
        </h2>
        <ActivityTable
          rows={upcoming}
          isPast={false}
          readOnly={isWcReadOnly}
          onEdit={row => setModal({ id: row.id, form: toForm(row) })}
          onDelete={id => { remove(id); setConfirmDelete(null); }}
          confirmDelete={confirmDelete}
          onConfirmDelete={setConfirmDelete}
          onCancelDelete={() => setConfirmDelete(null)}
        />
      </section>

      {/* Past */}
      <section>
        <button
          onClick={() => setShowPast(p => !p)}
          className="flex items-center gap-2 text-lg font-semibold text-gray-500 hover:text-gray-700 mb-3">
          Past
          <span className="text-sm font-normal text-gray-400">({past.length})</span>
          <span className="text-xs">{showPast ? '▲' : '▼'}</span>
        </button>
        {showPast && (
          <ActivityTable
            rows={past}
            isPast={true}
            readOnly={isWcReadOnly}
            onEdit={row => setModal({ id: row.id, form: toForm(row) })}
            onDelete={id => { remove(id); setConfirmDelete(null); }}
            confirmDelete={confirmDelete}
            onConfirmDelete={setConfirmDelete}
            onCancelDelete={() => setConfirmDelete(null)}
          />
        )}
      </section>
    </div>
  );
}
