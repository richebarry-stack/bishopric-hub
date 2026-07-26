import { useMemo, useState } from 'react';
import { useTable } from '../../lib/useTable';
import type { CalendarEvent } from '../../lib/api';
import { isUpcoming } from '../../lib/calendaring';
import CalendarEventModal from '../../components/CalendarEventModal';

// Use local noon to avoid UTC timezone shift from new Date('YYYY-MM-DD')
function formatDate(dates: string): string {
  if (!dates) return '';
  const d = new Date(dates.slice(0, 10) + 'T12:00:00');
  if (isNaN(d.getTime())) return dates;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function CalendaringBox() {
  const { rows, update, remove } = useTable<CalendarEvent>('calendaring');
  const [editing, setEditing] = useState<Partial<CalendarEvent> | null>(null);

  const upcoming = useMemo(
    () => rows.filter(r => isUpcoming(r.dates)).sort((a, b) => a.dates.localeCompare(b.dates)),
    [rows]
  );

  const handleSave = async () => {
    if (!editing?.id) return;
    const data = { ...editing };
    delete (data as Record<string, unknown>).id;
    await update(editing.id, data as Record<string, unknown>);
    setEditing(null);
  };

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-700 mb-2">Calendaring Items</h2>
      {upcoming.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-3 bg-white rounded-lg border border-gray-200 border-dashed">
          No upcoming events
        </p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {upcoming.map(r => (
            <button key={r.id} onClick={() => setEditing(r)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-gray-50">
              <span className="text-sm text-gray-800 truncate">{r.name}</span>
              <span className="text-xs text-gray-500 shrink-0">{formatDate(r.dates)}</span>
            </button>
          ))}
        </div>
      )}

      <CalendarEventModal
        editing={editing}
        onClose={() => setEditing(null)}
        onChange={next => setEditing(prev => (prev ? { ...prev, ...next } : prev))}
        onSave={handleSave}
        onDelete={remove}
      />
    </section>
  );
}
