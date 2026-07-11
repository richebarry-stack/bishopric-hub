import { useState, useMemo, useCallback } from 'react';
import { useTable } from '../lib/useTable';
import type { BishopricMeeting, BishopricAgendaItem } from '../lib/api';
import { Input, Textarea } from '../components/FormFields';
import { useConfirm } from '../components/ConfirmDialog';

function formatDate(d: string): string {
  return new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

const todayStr = () => new Date().toISOString().slice(0, 10);

function AgendaItemText({ item, onSave }: { item: BishopricAgendaItem; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <input autoFocus defaultValue={item.item}
        onBlur={e => { setEditing(false); if (e.target.value.trim() && e.target.value !== item.item) onSave(e.target.value); }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false); }}
        className="flex-1 text-sm rounded border border-gray-300 px-2 py-1" />
    );
  }
  return (
    <button type="button" onClick={() => setEditing(true)}
      className={`flex-1 text-left text-sm ${item.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
      {item.item}
    </button>
  );
}

export default function CurrentBishopricMeeting() {
  const { rows: meetings, isLoading: meetingsLoading, update: updateMeeting } = useTable<BishopricMeeting>('bishopric-meetings');
  const { rows: items, isLoading: itemsLoading, create: createItem, update: updateItem, remove: removeItem } = useTable<BishopricAgendaItem>('bishopric-agenda-items');
  const confirm = useConfirm();

  const sortedMeetingDates = useMemo(
    () => Array.from(new Set(meetings.map(m => m.date.slice(0, 10)))).sort(),
    [meetings]
  );

  const defaultDate = useMemo(() => {
    const today = todayStr();
    const upcoming = meetings
      .filter(m => !m.no_meeting && m.date.slice(0, 10) >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    return upcoming ? upcoming.date.slice(0, 10) : today;
  }, [meetings]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const date = selectedDate ?? defaultDate;

  const meeting = meetings.find(m => m.date.slice(0, 10) === date);

  const goToOffset = (dir: 1 | -1) => {
    const idx = sortedMeetingDates.indexOf(date);
    if (idx === -1) {
      const d = new Date(date + 'T12:00:00');
      d.setDate(d.getDate() + dir * 7);
      setSelectedDate(d.toISOString().slice(0, 10));
      return;
    }
    const nextIdx = idx + dir;
    if (nextIdx >= 0 && nextIdx < sortedMeetingDates.length) setSelectedDate(sortedMeetingDates[nextIdx]);
  };

  const dateItems = useMemo(
    () => items.filter(i => i.meeting_date === date).sort((a, b) => a.position - b.position || a.id - b.id),
    [items, date]
  );

  const [newItem, setNewItem] = useState('');
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());

  const handleAddItem = useCallback(async () => {
    const text = newItem.trim();
    if (!text) return;
    const maxPos = dateItems.length ? Math.max(...dateItems.map(i => i.position)) : 0;
    await createItem({ meeting_date: date, item: text, position: maxPos + 1 }, { silent: true });
    setNewItem('');
  }, [newItem, dateItems, date, createItem]);

  const toggleDone = (i: BishopricAgendaItem) => updateItem(i.id, { done: i.done ? 0 : 1 }, { silent: true });
  const saveItemText = (i: BishopricAgendaItem, v: string) => updateItem(i.id, { item: v }, { silent: true });
  const saveItemNotes = (i: BishopricAgendaItem, v: string) => updateItem(i.id, { notes: v }, { silent: true });
  const moveItem = (i: BishopricAgendaItem, dir: 1 | -1) => {
    const idx = dateItems.findIndex(x => x.id === i.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= dateItems.length) return;
    const other = dateItems[swapIdx];
    updateItem(i.id, { position: other.position }, { silent: true });
    updateItem(other.id, { position: i.position }, { silent: true });
  };
  const deleteItem = async (i: BishopricAgendaItem) => {
    if (await confirm({ message: 'Delete this agenda item?' })) removeItem(i.id);
  };

  const toggleNotes = (id: number) => setExpandedNotes(s => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const saveMeetingField = (field: string, v: string) => {
    if (!meeting) return;
    updateMeeting(meeting.id, { [field]: v }, { silent: true });
  };

  const isLoading = meetingsLoading || itemsLoading;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Current Bishopric Meeting</h1>
      </div>
      <p className="text-sm text-gray-500 -mt-4">
        Prep and run the next bishopric meeting — agenda items, notes, and the meeting's own fields, all in one place.
      </p>

      <div className="flex items-center gap-2">
        <button onClick={() => goToOffset(-1)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">‹ Prev</button>
        <div className="flex-1 text-center font-semibold text-gray-800">{formatDate(date)}</div>
        <button onClick={() => goToOffset(1)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Next ›</button>
      </div>
      <div className="flex items-center gap-2 -mt-3">
        <label className="text-xs text-gray-400">Jump to date:</label>
        <input type="date" value={date} onChange={e => setSelectedDate(e.target.value)}
          className="text-xs rounded border border-gray-300 px-2 py-1" />
      </div>

      {isLoading ? <p className="text-gray-400 text-sm">Loading…</p> : (
        <>
          {!meeting ? (
            <div className="bg-white rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-400">
              No meeting scheduled for this date yet — add it on Bishopric Meeting Planning. You can still add agenda items below to prep ahead.
            </div>
          ) : meeting.no_meeting ? (
            <div className="bg-white rounded-lg border border-gray-200 p-4 text-sm text-red-500 italic">
              No meeting{meeting.reason_not_meeting ? ` — ${meeting.reason_not_meeting}` : ''}
            </div>
          ) : (
            <section className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
              <Input label="Spiritual Thought" value={meeting.spiritual_thought || ''} onChange={v => saveMeetingField('spiritual_thought', v)} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Opening Prayer" value={meeting.opening_prayer || ''} onChange={v => saveMeetingField('opening_prayer', v)} />
                <Input label="Closing Prayer" value={meeting.closing_prayer || ''} onChange={v => saveMeetingField('closing_prayer', v)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Handbook Training" value={meeting.handbook_training || ''} onChange={v => saveMeetingField('handbook_training', v)} />
                <Input label="Handbook Section" value={meeting.handbook_section || ''} onChange={v => saveMeetingField('handbook_section', v)} />
              </div>
              <Textarea label="Minutes" value={meeting.minutes || ''} onChange={v => saveMeetingField('minutes', v)} rows={4} />
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Agenda</h2>
            <div className="flex items-center gap-2 mb-3">
              <input value={newItem} onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                placeholder="Add an agenda item..."
                className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
              <button onClick={handleAddItem} disabled={!newItem.trim()}
                className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                Add
              </button>
            </div>

            {dateItems.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4 bg-white rounded-lg border border-gray-200 border-dashed">
                No agenda items yet
              </p>
            ) : (
              <div className="space-y-2">
                {dateItems.map((item, idx) => (
                  <div key={item.id} className="bg-white rounded-lg border border-gray-200 p-3">
                    <div className="flex items-start gap-2">
                      <input type="checkbox" checked={!!item.done} onChange={() => toggleDone(item)}
                        className="mt-1 rounded border-gray-300" />
                      <AgendaItemText item={item} onSave={v => saveItemText(item, v)} />
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => moveItem(item, -1)} disabled={idx === 0}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs px-1">▲</button>
                        <button onClick={() => moveItem(item, 1)} disabled={idx === dateItems.length - 1}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs px-1">▼</button>
                        <button onClick={() => toggleNotes(item.id)}
                          className="text-gray-400 hover:text-gray-600 text-xs px-1">{expandedNotes.has(item.id) ? 'Hide notes' : 'Notes'}</button>
                        <button onClick={() => deleteItem(item)}
                          className="text-red-400 hover:text-red-600 text-xs px-1">Del</button>
                      </div>
                    </div>
                    {expandedNotes.has(item.id) && (
                      <div className="mt-2 pl-6">
                        <textarea defaultValue={item.notes || ''} placeholder="Notes / decisions..."
                          onBlur={e => saveItemNotes(item, e.target.value)}
                          rows={2}
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
