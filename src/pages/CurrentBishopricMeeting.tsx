import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useTable } from '../lib/useTable';
import type { BishopricMeeting, BishopricAgendaItem, SacramentTheme } from '../lib/api';
import { Input, Textarea } from '../components/FormFields';
import { useConfirm } from '../components/ConfirmDialog';
import { priorMeetingDate } from '../lib/priorWeek';
import MoveItemsSection from './bishopricMeeting/MoveItemsSection';
import CalendaringBox from './bishopricMeeting/CalendaringBox';
import InterviewsNeededSection from './bishopricMeeting/InterviewsNeededSection';

function formatDate(d: string): string {
  return new Date(d.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

const todayStr = () => new Date().toISOString().slice(0, 10);

function renderLine(line: string): React.ReactNode {
  if (!line.trim()) return null;
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.length >= 4 && p.startsWith('**') && p.endsWith('**')
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );
}

function renderRichContent(text: string): React.ReactNode {
  if (!text?.trim()) return <span className="text-gray-300">—</span>;
  const lines = text.split('\n');
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flushBullets = (idx: number) => {
    if (!bullets.length) return;
    out.push(
      <ul key={`ul-${idx}`} className="list-disc list-inside space-y-0.5">
        {bullets.map((b, j) => <li key={j} className="text-sm text-gray-700">{renderLine(b)}</li>)}
      </ul>
    );
    bullets = [];
  };
  lines.forEach((line, i) => {
    if (line.startsWith('- ') || line.startsWith('* ')) {
      bullets.push(line.slice(2));
    } else {
      flushBullets(i);
      const rendered = renderLine(line);
      if (rendered) out.push(<p key={`p-${i}`} className="text-sm text-gray-700">{rendered}</p>);
    }
  });
  flushBullets(lines.length);
  return out.length ? <div className="space-y-1 px-2 py-1.5">{out}</div> : <span className="text-gray-300">—</span>;
}

function AutoTextarea({ value, onSave, readOnly, placeholder, minRows = 1 }: {
  value: string; onSave?: (v: string) => void; readOnly?: boolean; placeholder?: string; minRows?: number;
}) {
  const [local, setLocal] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  if (value !== prevValue) {
    setPrevValue(value);
    setLocal(value);
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [local]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return;
    const el = ref.current;
    if (!el) return;
    const pos = el.selectionStart;
    const lineStart = local.lastIndexOf('\n', pos - 1) + 1;
    const line = local.slice(lineStart, pos);
    if (line === '- ' || line === '* ') {
      e.preventDefault();
      const next = local.slice(0, lineStart) + '\n' + local.slice(pos);
      setLocal(next);
      setTimeout(() => { el.selectionStart = el.selectionEnd = lineStart + 1; }, 0);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      e.preventDefault();
      const prefix = line.startsWith('- ') ? '- ' : '* ';
      const insert = '\n' + prefix;
      const next = local.slice(0, pos) + insert + local.slice(pos);
      setLocal(next);
      setTimeout(() => { el.selectionStart = el.selectionEnd = pos + insert.length; }, 0);
    }
  };

  if (readOnly) {
    return <div className="min-h-[2rem]">{renderRichContent(value)}</div>;
  }

  return (
    <textarea
      ref={ref}
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { if (local !== value && onSave) onSave(local); }}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      rows={minRows}
      className="w-full resize-none overflow-hidden bg-transparent border border-transparent hover:border-gray-200 focus:border-emerald-400 focus:bg-white focus:outline-none rounded px-2 py-1.5 text-sm placeholder-gray-300 min-h-[2rem]"
      style={{ overflow: 'hidden' }}
    />
  );
}

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
  const themes = useTable<SacramentTheme>('sacrament-themes');
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

  const priorDate = useMemo(() => priorMeetingDate(date, meetings), [date, meetings]);
  const priorMeeting = priorDate ? meetings.find(m => m.date.slice(0, 10) === priorDate) : undefined;

  const handleCopyUpdatesFromLastWeek = async () => {
    if (!meeting || !priorMeeting) return;
    if (!await confirm({ message: "Replace this week's Updates/Announcements with last week's? This week's current text will be lost." })) return;
    saveMeetingField('updates_announcements', priorMeeting.updates_announcements || '');
  };

  const handleAddToSacramentAgenda = async (text: string) => {
    const existing = themes.rows.find(t => t.meeting_date.slice(0, 10) === date);
    if (existing) {
      const next = (existing.ward_business || '') + (existing.ward_business ? '\n' : '') + text;
      await themes.update(existing.id, { ward_business: next }, { silent: true });
    } else {
      await themes.create({ meeting_date: date, ward_business: text }, { silent: true });
    }
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
              <div>
                <label className="text-sm font-semibold text-gray-600 block mb-1">Notes</label>
                <div className="rounded-md border border-gray-200">
                  <AutoTextarea
                    value={meeting.notes ?? ''}
                    onSave={v => saveMeetingField('notes', v)}
                    placeholder="Anything else to note for this meeting…"
                    minRows={6}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-semibold text-gray-600">Updates / Announcements</label>
                  {priorMeeting?.updates_announcements && (
                    <button onClick={handleCopyUpdatesFromLastWeek} className="text-xs text-gray-400 hover:text-gray-600">
                      Copy from last week
                    </button>
                  )}
                </div>
                <div className="rounded-md border border-gray-200">
                  <AutoTextarea
                    value={meeting.updates_announcements ?? ''}
                    onSave={v => saveMeetingField('updates_announcements', v)}
                    placeholder="Updates or church announcements to cover…"
                    minRows={4}
                  />
                </div>
              </div>
            </section>
          )}

          <CalendaringBox date={date} />

          <MoveItemsSection kind="move_in" date={date} title="Move-ins" meetingDates={meetings}
            onAddToSacramentAgenda={handleAddToSacramentAgenda} />
          <MoveItemsSection kind="move_out" date={date} title="Move-outs" meetingDates={meetings} />
          <MoveItemsSection kind="other" date={date} title="Other Items" meetingDates={meetings} />

          <InterviewsNeededSection />

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
