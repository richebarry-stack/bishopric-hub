import { useState, useEffect } from 'react';
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

function formatTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h)) return t;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function nextWednesday() {
  const d = new Date();
  const diff = (3 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type GroupKey = 'builders_of_faith' | 'messengers_of_hope' | 'gatherers_of_light' | 'deacons' | 'teachers' | 'priests';
type GroupTimeKey = `${GroupKey}_time`;
type GroupLocationKey = `${GroupKey}_location`;

const GROUPS: { key: GroupKey; label: string; short: string }[] = [
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
  builders_of_faith_time: string;
  builders_of_faith_location: string;
  messengers_of_hope: string;
  messengers_of_hope_time: string;
  messengers_of_hope_location: string;
  gatherers_of_light: string;
  gatherers_of_light_time: string;
  gatherers_of_light_location: string;
  deacons: string;
  deacons_time: string;
  deacons_location: string;
  teachers: string;
  teachers_time: string;
  teachers_location: string;
  priests: string;
  priests_time: string;
  priests_location: string;
  notes: string;
};

const emptyForm = (date = nextWednesday()): FormData => ({
  date,
  builders_of_faith: '', builders_of_faith_time: '', builders_of_faith_location: '',
  messengers_of_hope: '', messengers_of_hope_time: '', messengers_of_hope_location: '',
  gatherers_of_light: '', gatherers_of_light_time: '', gatherers_of_light_location: '',
  deacons: '', deacons_time: '', deacons_location: '',
  teachers: '', teachers_time: '', teachers_location: '',
  priests: '', priests_time: '', priests_location: '',
  notes: '',
});

function toForm(row: YouthActivity): FormData {
  return {
    date:                       row.date?.slice(0, 10) ?? '',
    builders_of_faith:          row.builders_of_faith          ?? '',
    builders_of_faith_time:     row.builders_of_faith_time     ?? '',
    builders_of_faith_location: row.builders_of_faith_location ?? '',
    messengers_of_hope:          row.messengers_of_hope          ?? '',
    messengers_of_hope_time:     row.messengers_of_hope_time     ?? '',
    messengers_of_hope_location: row.messengers_of_hope_location ?? '',
    gatherers_of_light:          row.gatherers_of_light          ?? '',
    gatherers_of_light_time:     row.gatherers_of_light_time     ?? '',
    gatherers_of_light_location: row.gatherers_of_light_location ?? '',
    deacons:          row.deacons          ?? '',
    deacons_time:     row.deacons_time     ?? '',
    deacons_location: row.deacons_location ?? '',
    teachers:          row.teachers          ?? '',
    teachers_time:     row.teachers_time     ?? '',
    teachers_location: row.teachers_location ?? '',
    priests:          row.priests          ?? '',
    priests_time:     row.priests_time     ?? '',
    priests_location: row.priests_location ?? '',
    notes: row.notes ?? '',
  };
}

function AddDateModal({ onSave, onClose }: {
  onSave: (date: string) => Promise<void>;
  onClose: () => void;
}) {
  const [date, setDate] = useState(nextWednesday());
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(date); onClose(); } finally { setSaving(false); }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xs flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <h2 className="font-semibold text-gray-900">Add Activity Date</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-4">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Date</span>
            <input type="date" required value={date} onChange={e => setDate(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Add Date'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <h2 className="font-semibold text-gray-900">Youth Activity</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={submit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 space-y-4 overflow-y-auto">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Date</span>
              <input type="date" required value={form.date} onChange={e => set('date', e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </label>

            {GROUPS.map(g => (
              <div key={g.key} className="border border-gray-200 rounded-md overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-500">{g.label}</span>
                </div>
                <div className="p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-xs text-gray-500">Time</span>
                      <input type="time"
                        value={form[`${g.key}_time` as GroupTimeKey]}
                        onChange={e => set(`${g.key}_time` as keyof FormData, e.target.value)}
                        className="mt-0.5 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-gray-500">Location</span>
                      <input type="text"
                        value={form[`${g.key}_location` as GroupLocationKey]}
                        onChange={e => set(`${g.key}_location` as keyof FormData, e.target.value)}
                        placeholder="Building, room…"
                        className="mt-0.5 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-xs text-gray-500">Activity</span>
                    <input type="text"
                      value={form[g.key]}
                      onChange={e => set(g.key, e.target.value)}
                      placeholder="Activity description…"
                      className="mt-0.5 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
                  </label>
                </div>
              </div>
            ))}

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Notes</span>
              <textarea rows={2} value={form.notes} onChange={e => set('notes', e.target.value)}
                placeholder="Supplies, other details…"
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

function GroupCellModal({ row, groupKey, groupLabel, onSave, onClose }: {
  row: YouthActivity;
  groupKey: GroupKey;
  groupLabel: string;
  onSave: (time: string, location: string, activity: string, copyTo: GroupKey[]) => Promise<void>;
  onClose: () => void;
}) {
  const [time, setTime]     = useState(row[`${groupKey}_time` as GroupTimeKey] || '19:00');
  const [loc,  setLoc]      = useState(row[`${groupKey}_location` as GroupLocationKey] ?? '');
  const [act,  setAct]      = useState(row[groupKey] ?? '');
  const [copyTo, setCopyTo] = useState<Set<GroupKey>>(new Set());
  const [saving, setSaving] = useState(false);

  const otherGroups = GROUPS.filter(g => g.key !== groupKey);

  const toggleCopy = (key: GroupKey) =>
    setCopyTo(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(time, loc, act, [...copyTo]); onClose(); } finally { setSaving(false); }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">{groupLabel}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{formatDate(row.date)}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-500">Time</span>
              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-500">Location</span>
              <input type="text" value={loc} onChange={e => setLoc(e.target.value)}
                placeholder="Building, room…"
                className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">Activity</span>
            <input type="text" value={act} onChange={e => setAct(e.target.value)}
              placeholder="Activity description…"
              className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
          </label>
          <div>
            <span className="text-xs font-medium text-gray-500 block mb-1.5">Also apply to</span>
            <div className="flex flex-wrap gap-1.5">
              {otherGroups.map(g => (
                <button key={g.key} type="button" onClick={() => toggleCopy(g.key)}
                  className={`px-2.5 py-0.5 text-xs rounded-full font-medium transition-colors ${
                    copyTo.has(g.key)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {g.short}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
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

function AllGroupsTable({ rows, isPast, readOnly, onEdit, onEditCell, onDelete, confirmDelete, onConfirmDelete, onCancelDelete }: {
  rows: YouthActivity[];
  isPast: boolean;
  readOnly?: boolean;
  onEdit: (row: YouthActivity) => void;
  onEditCell: (row: YouthActivity, groupKey: GroupKey) => void;
  onDelete: (id: number) => void;
  confirmDelete: number | null;
  onConfirmDelete: (id: number) => void;
  onCancelDelete: () => void;
}) {
  if (rows.length === 0) return <p className="text-sm text-gray-400 italic py-2">None</p>;

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
            {!readOnly && <th className="px-3 py-2"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const hasContent = GROUPS.some(g => row[g.key]?.trim() || (row[`${g.key}_time` as GroupTimeKey])?.trim() || (row[`${g.key}_location` as GroupLocationKey])?.trim()) || row.notes?.trim();
            return (
              <tr key={row.id}
                className={`border-t border-gray-100 hover:bg-gray-50 ${isPast && !hasContent ? 'opacity-40' : isPast ? 'opacity-70' : ''}`}>
                <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap align-top">
                  {formatDate(row.date)}
                </td>
                {GROUPS.map(g => {
                  const time = row[`${g.key}_time` as GroupTimeKey] ?? '';
                  const loc  = row[`${g.key}_location` as GroupLocationKey] ?? '';
                  const act  = row[g.key] ?? '';
                  const meta = [formatTime(time), loc].filter(Boolean).join(' · ');
                  return (
                    <td key={g.key}
                      onClick={readOnly ? undefined : () => onEditCell(row, g.key)}
                      className={`px-3 py-2 min-w-[140px] max-w-[200px] align-top ${!readOnly ? 'cursor-pointer hover:bg-blue-50 group' : ''}`}>
                      {(meta || act) ? (
                        <div className="space-y-0.5">
                          {meta && <div className="text-xs text-gray-500">{meta}</div>}
                          {act  && <div className="text-gray-800 line-clamp-3">{act}</div>}
                        </div>
                      ) : (
                        <span className={`${!readOnly ? 'text-gray-200 group-hover:text-blue-300' : 'text-gray-300'}`}>—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-gray-500 max-w-[160px] align-top">
                  {row.notes ? <span className="line-clamp-2">{row.notes}</span> : <span className="text-gray-300">—</span>}
                </td>
                {!readOnly && (
                  <td className="px-3 py-2 whitespace-nowrap align-top">
                    <div className="flex items-center gap-2">
                      <button onClick={() => onEdit(row)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                      {confirmDelete === row.id ? (
                        <>
                          <button onClick={() => onDelete(row.id)} className="text-xs text-red-600 hover:text-red-800">Confirm</button>
                          <button onClick={onCancelDelete} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                        </>
                      ) : (
                        <button onClick={() => onConfirmDelete(row.id)} className="text-xs text-gray-400 hover:text-red-500">Delete</button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GroupTable({ rows, groupKey, isPast, readOnly, onEdit, onDelete, confirmDelete, onConfirmDelete, onCancelDelete }: {
  rows: YouthActivity[];
  groupKey: GroupKey;
  isPast: boolean;
  readOnly?: boolean;
  onEdit: (row: YouthActivity) => void;
  onDelete: (id: number) => void;
  confirmDelete: number | null;
  onConfirmDelete: (id: number) => void;
  onCancelDelete: () => void;
}) {
  if (rows.length === 0) return <p className="text-sm text-gray-400 italic py-2">None</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full bg-white text-sm">
        <thead className={isPast ? 'bg-gray-100' : 'bg-blue-50'}>
          <tr>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-gray-500 whitespace-nowrap">Date</th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-gray-500 whitespace-nowrap">Time</th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Location</th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Activity</th>
            <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-gray-500">Notes</th>
            {!readOnly && <th className="px-3 py-2"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const time = row[`${groupKey}_time` as GroupTimeKey] ?? '';
            const loc  = row[`${groupKey}_location` as GroupLocationKey] ?? '';
            const act  = row[groupKey] ?? '';
            const hasContent = !!(act?.trim() || time?.trim() || loc?.trim() || row.notes?.trim());
            return (
              <tr key={row.id}
                className={`border-t border-gray-100 hover:bg-gray-50 ${isPast && !hasContent ? 'opacity-40' : isPast ? 'opacity-70' : ''}`}>
                <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{formatDate(row.date)}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{formatTime(time) || <span className="text-gray-300">—</span>}</td>
                <td className="px-3 py-2 text-gray-600">{loc || <span className="text-gray-300">—</span>}</td>
                <td className="px-3 py-2 text-gray-700 max-w-[240px]">
                  {act ? <span className="line-clamp-3">{act}</span> : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2 text-gray-500 max-w-[180px]">
                  {row.notes ? <span className="line-clamp-2">{row.notes}</span> : <span className="text-gray-300">—</span>}
                </td>
                {!readOnly && (
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button onClick={() => onEdit(row)} className="text-xs text-blue-600 hover:text-blue-800">Edit</button>
                      {confirmDelete === row.id ? (
                        <>
                          <button onClick={() => onDelete(row.id)} className="text-xs text-red-600 hover:text-red-800">Confirm</button>
                          <button onClick={onCancelDelete} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                        </>
                      ) : (
                        <button onClick={() => onConfirmDelete(row.id)} className="text-xs text-gray-400 hover:text-red-500">Delete</button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type ViewTab = 'all' | GroupKey;

const VIEW_TABS: { key: ViewTab; label: string }[] = [
  { key: 'all', label: 'All Groups' },
  ...GROUPS.map(g => ({ key: g.key as ViewTab, label: g.short })),
];

export default function YouthActivities() {
  const { isGuest } = useAuth();
  const readOnly = isGuest;
  const { rows, isLoading, create, update, remove } = useTable<YouthActivity>('youth-activities');
  const [modal, setModal] = useState<{ form: FormData; id?: number } | null>(null);
  const [addDateOpen, setAddDateOpen] = useState(false);
  const [cellModal, setCellModal] = useState<{ row: YouthActivity; groupKey: GroupKey } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [viewTab, setViewTab] = useState<ViewTab>('all');

  // Use a 24-hour grace period (rather than local midnight) before moving an
  // activity to the past list, so viewers in any time zone still see today's
  // activity as upcoming.
  const pastCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = sorted.filter(r => r.date >= pastCutoff);
  const past     = sorted.filter(r => r.date <  pastCutoff).reverse();

  const handleSave = async (form: FormData) => {
    if (modal?.id) await update(modal.id, form);
    else           await create(form);
  };

  const handleCellSave = async (time: string, location: string, activity: string, copyTo: GroupKey[]) => {
    if (!cellModal) return;
    const { row, groupKey } = cellModal;
    const patch: Record<string, string> = {
      [groupKey]: activity,
      [`${groupKey}_time`]: time,
      [`${groupKey}_location`]: location,
      updated_at: new Date().toISOString(),
    };
    for (const gk of copyTo) {
      patch[gk] = activity;
      patch[`${gk}_time`] = time;
      patch[`${gk}_location`] = location;
    }
    await update(row.id, patch);
  };

  const tableProps = {
    readOnly,
    onEdit: (row: YouthActivity) => setModal({ id: row.id, form: toForm(row) }),
    onEditCell: (row: YouthActivity, groupKey: GroupKey) => setCellModal({ row, groupKey }),
    onDelete: (id: number) => { remove(id); setConfirmDelete(null); },
    confirmDelete,
    onConfirmDelete: setConfirmDelete,
    onCancelDelete: () => setConfirmDelete(null),
  };

  if (isLoading) return <p className="text-gray-400 text-sm">Loading…</p>;

  return (
    <div className="space-y-6">
      {addDateOpen && (
        <AddDateModal
          onSave={async (date) => { await create(emptyForm(date)); }}
          onClose={() => setAddDateOpen(false)}
        />
      )}
      {modal && (
        <EventModal
          initial={modal.form}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
      {cellModal && (
        <GroupCellModal
          row={cellModal.row}
          groupKey={cellModal.groupKey}
          groupLabel={GROUPS.find(g => g.key === cellModal.groupKey)?.label ?? cellModal.groupKey}
          onSave={handleCellSave}
          onClose={() => setCellModal(null)}
        />
      )}

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Youth Activities</h1>
        {!readOnly && (
          <button onClick={() => setAddDateOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 shrink-0">
            + Add Date
          </button>
        )}
      </div>

      <div className="flex gap-1 flex-wrap border-b border-gray-200 pb-px">
        {VIEW_TABS.map(t => (
          <button key={t.key} onClick={() => setViewTab(t.key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-t border-b-2 transition-colors whitespace-nowrap ${
              viewTab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          Upcoming
          <span className="text-sm font-normal text-gray-400">({upcoming.length})</span>
        </h2>
        {viewTab === 'all' ? (
          <AllGroupsTable rows={upcoming} isPast={false} {...tableProps} />
        ) : (
          <GroupTable rows={upcoming} groupKey={viewTab} isPast={false} {...tableProps} />
        )}
      </section>

      <section>
        <button
          onClick={() => setShowPast(p => !p)}
          className="flex items-center gap-2 text-lg font-semibold text-gray-500 hover:text-gray-700 mb-3">
          Past
          <span className="text-sm font-normal text-gray-400">({past.length})</span>
          <span className="text-xs">{showPast ? '▲' : '▼'}</span>
        </button>
        {showPast && (
          viewTab === 'all' ? (
            <AllGroupsTable rows={past} isPast={true} {...tableProps} />
          ) : (
            <GroupTable rows={past} groupKey={viewTab} isPast={true} {...tableProps} />
          )
        )}
      </section>
    </div>
  );
}
