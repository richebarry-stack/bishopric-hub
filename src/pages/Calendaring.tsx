import { useState, useMemo } from 'react';
import { useTable } from '../lib/useTable';
import type { CalendarEvent } from '../lib/api';
import Modal from '../components/Modal';
import { Input, Select, Textarea, Checkbox } from '../components/FormFields';
import { SHARE_WITH_OPTIONS } from '../lib/constants';

const TODAY_PREFIX = new Date().toISOString().slice(0, 10);

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Parse date parts directly from the string — avoids UTC timezone shift from new Date('YYYY-MM-DD')
function formatDate(dates: string): string {
  if (!dates) return '';
  const m = dates.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return dates;
  return `${MONTHS[parseInt(m[2], 10) - 1]} ${parseInt(m[3], 10)}, ${m[1]}`;
}

// Extract YYYY-MM-DD for a date input — slicing avoids any timezone conversion
function toDateInput(dates: string): string {
  return dates ? dates.slice(0, 10) : '';
}

function isUpcoming(dates: string): boolean {
  if (!dates) return true;
  return dates.slice(0, 10) >= TODAY_PREFIX;
}

type SortKey = 'name' | 'dates' | 'notes' | 'announce_in_sacrament';

const EMPTY: Partial<CalendarEvent> = { name: '', dates: '', notes: '', announce_in_sacrament: 0, share_with: '' };

function EventTable({ rows, onEdit, onDelete, defaultSortKey, defaultAsc }: {
  rows: CalendarEvent[];
  onEdit: (r: CalendarEvent) => void;
  onDelete: (id: number) => void;
  defaultSortKey?: SortKey;
  defaultAsc?: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>(defaultSortKey ?? 'dates');
  const [sortAsc, setSortAsc] = useState(defaultAsc ?? true);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  };

  const sorted = useMemo(() => [...rows].sort((a, b) => {
    let av: string, bv: string;
    if (sortKey === 'announce_in_sacrament') {
      av = String(a.announce_in_sacrament ?? 0);
      bv = String(b.announce_in_sacrament ?? 0);
    } else {
      av = (a[sortKey] ?? '') as string;
      bv = (b[sortKey] ?? '') as string;
    }
    return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
  }), [rows, sortKey, sortAsc]);

  const Th = ({ col, label, className }: { col: SortKey; label: string; className?: string }) => (
    <th
      className={`text-left px-3 py-2 font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900 whitespace-nowrap ${className ?? ''}`}
      onClick={() => handleSort(col)}
    >
      {label}
      <span className="ml-1 text-gray-400 text-xs">{sortKey === col ? (sortAsc ? '↑' : '↓') : '↕'}</span>
    </th>
  );

  if (sorted.length === 0) {
    return <p className="text-gray-400 text-sm italic py-2">None</p>;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <Th col="name" label="Event" />
            <Th col="dates" label="Date" />
            <Th col="notes" label="Notes" />
            <Th col="announce_in_sacrament" label="Announce" className="text-center" />
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => (
            <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => onEdit(r)}>
              <td className="px-3 py-2 font-medium text-gray-900">{r.name}</td>
              <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{formatDate(r.dates)}</td>
              <td className="px-3 py-2 text-gray-600">{r.notes}</td>
              <td className="px-3 py-2 text-center">{r.announce_in_sacrament ? '✓' : ''}</td>
              <td className="px-3 py-2">
                <button onClick={e => { e.stopPropagation(); onDelete(r.id); }} className="text-red-400 hover:text-red-600 text-xs">Del</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Calendaring() {
  const { rows, isLoading, create, update, remove } = useTable<CalendarEvent>('calendaring');
  const [editing, setEditing] = useState<Partial<CalendarEvent> | null>(null);

  const upcoming = useMemo(() => rows.filter(r => isUpcoming(r.dates)), [rows]);
  const past = useMemo(() => rows.filter(r => !isUpcoming(r.dates)), [rows]);

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Calendar Events</h1>
        <button onClick={() => setEditing({ ...EMPTY })} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">+ Add</button>
      </div>

      {isLoading ? <p className="text-gray-400 text-sm">Loading...</p> : (
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
              Upcoming
              <span className="text-gray-400 font-normal normal-case tracking-normal">({upcoming.length})</span>
            </h2>
            <EventTable rows={upcoming} onEdit={setEditing} onDelete={remove} defaultSortKey="dates" defaultAsc={true} />
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
              Past
              <span className="text-gray-400 font-normal normal-case tracking-normal">({past.length})</span>
            </h2>
            <EventTable rows={past} onEdit={setEditing} onDelete={remove} defaultSortKey="dates" defaultAsc={false} />
          </section>
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Event' : 'New Event'}>
        {editing && (
          <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-3">
            <Input label="Event Name" value={editing.name || ''} onChange={v => setEditing({ ...editing, name: v })} required />
            <Input label="Date" value={toDateInput(editing.dates || '')} onChange={v => setEditing({ ...editing, dates: v })} type="date" />
            <Textarea label="Notes" value={editing.notes || ''} onChange={v => setEditing({ ...editing, notes: v })} />
            <Select label="Share With" value={editing.share_with || ''} onChange={v => setEditing({ ...editing, share_with: v })} options={SHARE_WITH_OPTIONS} />
            <Checkbox label="Announce in sacrament meeting" checked={!!editing.announce_in_sacrament} onChange={v => setEditing({ ...editing, announce_in_sacrament: v ? 1 : 0 })} />
            <div className="flex justify-between pt-2">
              <div>
                {editing.id && (
                  <button type="button" onClick={() => { remove(editing.id!); setEditing(null); }} className="px-4 py-2 text-sm text-red-600 hover:text-red-800">Delete</button>
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
