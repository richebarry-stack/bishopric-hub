import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTable } from '../lib/useTable';
import { api } from '../lib/api';
import type { AnnualDuty } from '../lib/api';
import Modal from '../components/Modal';
import { Input, Textarea } from '../components/FormFields';
import { useConfirm } from '../components/ConfirmDialog';
import { MONTH_NAMES, windowLabel, inDutyWindow, useTimeZoneNow } from '../lib/annualDuties';

const EMPTY: Partial<AnnualDuty> = { title: '', month_start: 1, month_end: 1, notes: '' };

export default function AnnualDuties() {
  const { rows, isLoading, create, update, remove } = useTable<AnnualDuty>('annual-duties');
  const { data: tzData } = useQuery({ queryKey: ['app-timezone'], queryFn: () => api.appTimezone.get() });
  const { month: currentMonth, year: currentYear } = useTimeZoneNow(tzData?.timeZone || 'America/Denver');
  const [editing, setEditing] = useState<Partial<AnnualDuty> | null>(null);
  const confirm = useConfirm();

  const { inWindowNow, upcoming, doneThisYear } = useMemo(() => {
    const inWindowNow: AnnualDuty[] = [];
    const upcoming: AnnualDuty[] = [];
    const doneThisYear: AnnualDuty[] = [];
    for (const d of rows) {
      if (d.last_completed_year === currentYear) { doneThisYear.push(d); continue; }
      if (inDutyWindow(currentMonth, d.month_start, d.month_end)) inWindowNow.push(d);
      else upcoming.push(d);
    }
    return { inWindowNow, upcoming, doneThisYear };
  }, [rows, currentMonth, currentYear]);

  const handleSave = async () => {
    if (!editing) return;
    const data = { ...editing };
    delete (data as Record<string, unknown>).id;
    data.month_start = Number(data.month_start) || 1;
    data.month_end = Number(data.month_end) || 1;
    if (editing.id) await update(editing.id, data as Record<string, unknown>);
    else await create(data as Record<string, unknown>);
    setEditing(null);
  };

  const markDone = (d: AnnualDuty) => update(d.id, { last_completed_year: currentYear });
  const markNotDone = (d: AnnualDuty) => update(d.id, { last_completed_year: null });

  const DutyRow = ({ d, showMarkDone, showUndo }: { d: AnnualDuty; showMarkDone?: boolean; showUndo?: boolean }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-start justify-between gap-3">
      <div className="min-w-0 cursor-pointer" onClick={() => setEditing(d)}>
        <p className="font-medium text-gray-900">{d.title}</p>
        <p className="text-xs text-gray-400">{windowLabel(d.month_start, d.month_end)}</p>
        {d.notes && <p className="text-sm text-gray-600 mt-1">{d.notes}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {showMarkDone && (
          <button onClick={() => markDone(d)} className="text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700">
            Mark done for {currentYear}
          </button>
        )}
        {showUndo && (
          <button onClick={() => markNotDone(d)} className="text-xs px-2 py-1 rounded text-gray-500 hover:bg-gray-100">Undo</button>
        )}
        <button onClick={async () => { if (await confirm(`Delete "${d.title}"?`)) remove(d.id); }} className="text-red-400 hover:text-red-600 text-xs">Del</button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Annual Duties</h1>
        <button onClick={() => setEditing({ ...EMPTY })} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">+ Add</button>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Recurring seasonal duties — tithing declaration, ward conference, annual budget, and similar. Each has a month window; mark it done once completed for the year.
      </p>

      {isLoading ? <p className="text-gray-400 text-sm">Loading...</p> : rows.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No annual duties tracked yet — use "+ Add" above.</p>
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">In Window Now ({inWindowNow.length})</h2>
            {inWindowNow.length === 0
              ? <p className="text-sm text-gray-400">None</p>
              : <div className="space-y-2">{inWindowNow.map(d => <DutyRow key={d.id} d={d} showMarkDone />)}</div>}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Upcoming ({upcoming.length})</h2>
            {upcoming.length === 0
              ? <p className="text-sm text-gray-400">None</p>
              : <div className="space-y-2">{upcoming.map(d => <DutyRow key={d.id} d={d} showMarkDone />)}</div>}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Done This Year ({doneThisYear.length})</h2>
            {doneThisYear.length === 0
              ? <p className="text-sm text-gray-400">None</p>
              : <div className="space-y-2">{doneThisYear.map(d => <DutyRow key={d.id} d={d} showUndo />)}</div>}
          </div>
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Duty' : 'New Duty'}>
        {editing && (
          <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-3">
            <Input label="Title" value={editing.title || ''} onChange={v => setEditing({ ...editing, title: v })} required />
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Window Start Month</span>
                <select value={editing.month_start ?? 1} onChange={e => setEditing({ ...editing, month_start: Number(e.target.value) })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Window End Month</span>
                <select value={editing.month_end ?? 1} onChange={e => setEditing({ ...editing, month_end: Number(e.target.value) })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </label>
            </div>
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
