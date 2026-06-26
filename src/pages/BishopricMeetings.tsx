import { useState } from 'react';
import { useTable } from '../lib/useTable';
import type { BishopricMeeting } from '../lib/api';
import Modal from '../components/Modal';
import { Input, Textarea, Checkbox } from '../components/FormFields';

const EMPTY: Partial<BishopricMeeting> = {
  date: '', spiritual_thought: '', opening_prayer: '', closing_prayer: '',
  handbook_training: '', handbook_section: '', minutes: '', no_meeting: 0, reason_not_meeting: '',
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function formatDate(d: string): string {
  return new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

export default function BishopricMeetings() {
  const { rows, isLoading, create, update, remove } = useTable<BishopricMeeting>('bishopric-meetings');
  const [editing, setEditing] = useState<Partial<BishopricMeeting> | null>(null);
  const [viewDate, setViewDate] = useState(() => new Date());

  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();
  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;

  const monthMeetings = rows
    .filter(m => m.date.slice(0, 7) === monthPrefix)
    .sort((a, b) => a.date.localeCompare(b.date));

  const goPrev = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const goNext = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () => setViewDate(new Date());

  const handleSave = async () => {
    if (!editing) return;
    const data = { ...editing };
    delete (data as Record<string, unknown>).id;
    if (editing.id) await update(editing.id, data as Record<string, unknown>);
    else await create(data as Record<string, unknown>);
    setEditing(null);
  };

  const openNew = () => {
    const today = new Date().toISOString().slice(0, 10);
    setEditing({ ...EMPTY, date: today });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Bishopric Meetings</h1>
        <button onClick={openNew} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
          + New Meeting
        </button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={goToday} className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md text-sm hover:bg-gray-50">Today</button>
        <button onClick={goPrev} className="border border-gray-300 text-gray-700 px-2 py-1.5 rounded-md text-sm hover:bg-gray-50">‹</button>
        <button onClick={goNext} className="border border-gray-300 text-gray-700 px-2 py-1.5 rounded-md text-sm hover:bg-gray-50">›</button>
        <span className="font-semibold text-gray-800 text-sm">{MONTH_NAMES[viewMonth]} {viewYear}</span>
      </div>

      {isLoading ? <p className="text-gray-400 text-sm">Loading...</p> : (
        <div className="space-y-3">
          {monthMeetings.length === 0 && (
            <div className="bg-white rounded-lg border border-gray-200 border-dashed p-8 text-center text-gray-400 text-sm">
              No meetings in {MONTH_NAMES[viewMonth]} {viewYear}
            </div>
          )}
          {monthMeetings.map(m => (
            <div key={m.id}
              className={`bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:shadow-sm transition-shadow ${m.no_meeting ? 'opacity-70' : ''}`}
              onClick={() => setEditing({ ...m, date: m.date.slice(0, 10) })}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 mb-1">{formatDate(m.date)}</h3>
                  {m.no_meeting ? (
                    <p className="text-sm text-red-500 italic">No meeting{m.reason_not_meeting ? ` — ${m.reason_not_meeting}` : ''}</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5 text-sm text-gray-600 mt-2">
                      {m.spiritual_thought && <p><span className="font-medium text-gray-500">Thought:</span> {m.spiritual_thought}</p>}
                      {m.opening_prayer && <p><span className="font-medium text-gray-500">Opening:</span> {m.opening_prayer}</p>}
                      {m.closing_prayer && <p><span className="font-medium text-gray-500">Closing:</span> {m.closing_prayer}</p>}
                      {m.handbook_training && <p><span className="font-medium text-gray-500">Handbook:</span> {m.handbook_training}{m.handbook_section ? ` §${m.handbook_section}` : ''}</p>}
                      {m.minutes && (
                        <p className="sm:col-span-2 mt-1 text-gray-500 italic truncate">
                          <span className="font-medium not-italic text-gray-500">Minutes:</span> {m.minutes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); remove(m.id); }}
                  className="text-red-400 hover:text-red-600 text-xs shrink-0">Del</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Meeting' : 'New Meeting'}>
        {editing && (
          <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-3">
            <Input label="Date" value={(editing.date || '').slice(0, 10)} onChange={v => setEditing({ ...editing, date: v })} type="date" required />
            <Checkbox label="No bishopric meeting" checked={!!editing.no_meeting} onChange={v => setEditing({ ...editing, no_meeting: v ? 1 : 0 })} />
            {editing.no_meeting ? (
              <Input label="Reason" value={editing.reason_not_meeting || ''} onChange={v => setEditing({ ...editing, reason_not_meeting: v })} />
            ) : (
              <>
                <Input label="Spiritual Thought" value={editing.spiritual_thought || ''} onChange={v => setEditing({ ...editing, spiritual_thought: v })} />
                <Input label="Opening Prayer" value={editing.opening_prayer || ''} onChange={v => setEditing({ ...editing, opening_prayer: v })} />
                <Input label="Closing Prayer" value={editing.closing_prayer || ''} onChange={v => setEditing({ ...editing, closing_prayer: v })} />
                <Input label="Handbook Training" value={editing.handbook_training || ''} onChange={v => setEditing({ ...editing, handbook_training: v })} />
                <Input label="Handbook Section" value={editing.handbook_section || ''} onChange={v => setEditing({ ...editing, handbook_section: v })} />
                <Textarea label="Minutes" value={editing.minutes || ''} onChange={v => setEditing({ ...editing, minutes: v })} rows={6} />
              </>
            )}
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
