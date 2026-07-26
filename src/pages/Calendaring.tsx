import { useState, useMemo } from 'react';
import { useTable } from '../lib/useTable';
import type { CalendarEvent } from '../lib/api';
import CalendarEventModal from '../components/CalendarEventModal';
import { useAuth } from '../lib/auth';
import { isUpcoming } from '../lib/calendaring';

// Use local noon to avoid UTC timezone shift from new Date('YYYY-MM-DD')
function formatDate(dates: string): string {
  if (!dates) return '';
  const d = new Date(dates.slice(0, 10) + 'T12:00:00');
  if (isNaN(d.getTime())) return dates;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

type SortKey = 'name' | 'dates' | 'notes' | 'announce_in_sacrament';

const EMPTY: Partial<CalendarEvent> = { name: '', dates: '', notes: '', announce_in_sacrament: 0, share_with: '' };

function Th({ col, label, className, sortKey, sortAsc, onSort }: {
  col: SortKey; label: string; className?: string; sortKey: SortKey; sortAsc: boolean; onSort: (col: SortKey) => void;
}) {
  return (
    <th
      className={`text-left px-3 py-2 font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900 whitespace-nowrap ${className ?? ''}`}
      onClick={() => onSort(col)}
    >
      {label}
      <span className="ml-1 text-gray-400 text-xs">{sortKey === col ? (sortAsc ? '↑' : '↓') : '↕'}</span>
    </th>
  );
}

function EventTable({ rows, onEdit, onDelete, defaultSortKey, defaultAsc, readOnly }: {
  rows: CalendarEvent[];
  onEdit: (r: CalendarEvent) => void;
  onDelete: (id: number) => void;
  defaultSortKey?: SortKey;
  defaultAsc?: boolean;
  readOnly?: boolean;
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

  if (sorted.length === 0) {
    return <p className="text-gray-400 text-sm italic py-2">None</p>;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <Th col="name" label="Event" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
            <Th col="dates" label="Date" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
            <Th col="notes" label="Notes" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
            <Th col="announce_in_sacrament" label="Announce" className="text-center" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => (
            <tr key={r.id} className={`border-b border-gray-50 hover:bg-gray-50 ${!readOnly ? 'cursor-pointer' : ''}`}
              onClick={!readOnly ? () => onEdit(r) : undefined}>
              <td className="px-3 py-2 font-medium text-gray-900">{r.name}</td>
              <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{formatDate(r.dates)}</td>
              <td className="px-3 py-2 text-gray-600">{r.notes}</td>
              <td className="px-3 py-2 text-center">{r.announce_in_sacrament ? '✓' : ''}</td>
              {!readOnly && (
                <td className="px-3 py-2">
                  <button onClick={e => { e.stopPropagation(); onDelete(r.id); }} className="text-red-400 hover:text-red-600 text-xs">Del</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Calendaring() {
  const { isWcReadOnly } = useAuth();
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
        {!isWcReadOnly && <button onClick={() => setEditing({ ...EMPTY })} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">+ Add</button>}
      </div>
      <p className="text-sm text-gray-500 mb-4">Ward events — flag "Announce in sacrament" for items that need a pulpit mention.</p>

      {isLoading ? <p className="text-gray-400 text-sm">Loading...</p> : (
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
              Upcoming
              <span className="text-gray-400 font-normal normal-case tracking-normal">({upcoming.length})</span>
            </h2>
            <EventTable rows={upcoming} onEdit={setEditing} onDelete={remove} defaultSortKey="dates" defaultAsc={true} readOnly={isWcReadOnly} />
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
              Past
              <span className="text-gray-400 font-normal normal-case tracking-normal">({past.length})</span>
            </h2>
            <EventTable rows={past} onEdit={setEditing} onDelete={remove} defaultSortKey="dates" defaultAsc={false} readOnly={isWcReadOnly} />
          </section>
        </div>
      )}

      <CalendarEventModal
        editing={editing}
        onClose={() => setEditing(null)}
        onChange={next => setEditing(prev => (prev ? { ...prev, ...next } : prev))}
        onSave={handleSave}
        onDelete={remove}
      />
    </div>
  );
}
