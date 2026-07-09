import { useState, useMemo, useRef } from 'react';
import { useTable } from '../lib/useTable';
import type { BishopScheduleEntry } from '../lib/api';
import Modal from '../components/Modal';
import { Input, Textarea, Select, Checkbox } from '../components/FormFields';
import { toast } from '../lib/toast';
import { useConfirm } from '../components/ConfirmDialog';
import {
  type RecurrenceFrequency,
  describeRecurrence,
  getNthWeekdayInfo,
  generateRecurrenceDates,
} from '../lib/recurrence';

const MAX_RECURRENCE_OCCURRENCES = 200;

const FREQUENCY_OPTIONS: { label: string; value: RecurrenceFrequency }[] = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly on the same weekday', value: 'monthly_nth_weekday' },
];

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ORDINAL_NAMES = ['1st', '2nd', '3rd', '4th', '5th'];

function buildSlots(): string[] {
  const slots: string[] = [];
  for (let h = 7; h <= 21; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 21 && m > 45) break;
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
}

const TIME_SLOTS = buildSlots();

function formatTime12(t: string): string {
  const [hh, mm] = t.split(':').map(Number);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 || 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

function slotIndex(t: string): number {
  return TIME_SLOTS.indexOf(t);
}

function addWeeks(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n * 7);
  return r;
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface FormState {
  id?: number;
  date: string;
  start_time: string;
  end_time: string;
  title: string;
  notes: string;
  recurrence_id?: string | null;
  recurrence_frequency?: RecurrenceFrequency | null;
  recurrence_interval?: number | null;
  recurrence_end_date?: string | null;
}

interface DragState {
  entryId: number;
  type: 'move' | 'resize';
  offsetSlots: number;
  previewDate: string;
  previewStartIdx: number;
  previewEndIdx: number;
}

interface ActiveDrag {
  entryId: number;
  type: 'move' | 'resize';
  offsetSlots: number;
  startX: number;
  startY: number;
  didMove: boolean;
  entry: BishopScheduleEntry;
  previewDate: string;
  previewStartIdx: number;
  previewEndIdx: number;
}

export default function BishopSchedule() {
  const { rows, isLoading, create, update, remove } = useTable<BishopScheduleEntry>('bishop-schedule');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [editing, setEditing] = useState<FormState | null>(null);
  const confirm = useConfirm();
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatFrequency, setRepeatFrequency] = useState<RecurrenceFrequency>('weekly');
  const [repeatInterval, setRepeatInterval] = useState(1);
  const [repeatEndDate, setRepeatEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [monthPicker, setMonthPicker] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragRef = useRef<ActiveDrag | null>(null);

  const todayKey = toKey(new Date());
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  const { entriesByDate, conflictedIds } = useMemo(() => {
    const map = new Map<string, BishopScheduleEntry[]>();
    for (const e of rows) {
      const key = e.date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    const conflicts = new Set<number>();
    for (const dayEntries of map.values()) {
      for (let i = 0; i < dayEntries.length; i++) {
        for (let j = i + 1; j < dayEntries.length; j++) {
          const a = dayEntries[i], b = dayEntries[j];
          const aStart = slotIndex(a.start_time), aEnd = slotIndex(a.end_time);
          const bStart = slotIndex(b.start_time), bEnd = slotIndex(b.end_time);
          if (aStart < bEnd && aEnd > bStart) {
            conflicts.add(a.id);
            conflicts.add(b.id);
          }
        }
      }
    }
    return { entriesByDate: map, conflictedIds: conflicts };
  }, [rows]);

  const beginDrag = (
    _captureEl: HTMLElement,
    pointerId: number,
    entry: BishopScheduleEntry,
    type: 'move' | 'resize',
    offsetSlots: number,
    startX: number,
    startY: number,
  ) => {
    // NOTE: deliberately NOT using setPointerCapture. The captured element gets
    // pointer-events:none on the next render (so elementFromPoint can hit the TD cells),
    // and the spec releases pointer capture + fires pointercancel when that happens,
    // which would instantly abort the drag. Window capture-phase listeners work regardless.
    const startIdx = slotIndex(entry.start_time);
    const drag: ActiveDrag = {
      entryId: entry.id, type, offsetSlots, startX, startY,
      didMove: false, entry,
      previewDate: entry.date.slice(0, 10),
      previewStartIdx: startIdx,
      previewEndIdx: slotIndex(entry.end_time),
    };
    dragRef.current = drag;
    setDragState({ entryId: drag.entryId, type, offsetSlots, previewDate: drag.previewDate, previewStartIdx: drag.previewStartIdx, previewEndIdx: drag.previewEndIdx });

    // Window-level capture listeners — fire before any element handler, bypass pointer-events:none
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const d = dragRef.current;
      if (!d) return;
      if (Math.abs(e.clientX - startX) < 6 && Math.abs(e.clientY - startY) < 6) return;
      d.didMove = true;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el) return;
      const td = (el as HTMLElement).closest('[data-bs-si]') as HTMLElement | null;
      if (!td) return;
      const si = Number(td.dataset.bsSi);
      const date = td.dataset.bsDate;
      if (!date) return;
      if (d.type === 'move') {
        const duration = slotIndex(d.entry.end_time) - startIdx;
        const newStart = Math.max(0, si - d.offsetSlots);
        const newEnd = Math.min(TIME_SLOTS.length - 1, newStart + duration);
        d.previewDate = date; d.previewStartIdx = newStart; d.previewEndIdx = newEnd;
      } else {
        d.previewEndIdx = Math.min(Math.max(startIdx + 1, si + 1), TIME_SLOTS.length - 1);
      }
      setDragState({ entryId: d.entryId, type: d.type, offsetSlots: d.offsetSlots, previewDate: d.previewDate, previewStartIdx: d.previewStartIdx, previewEndIdx: d.previewEndIdx });
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);
    };

    const onUp = async (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      cleanup();
      const d = dragRef.current;
      dragRef.current = null;
      setDragState(null);
      if (!d) return;
      if (!d.didMove) {
        setEditing({
          id: entry.id, date: entry.date.slice(0, 10), start_time: entry.start_time, end_time: entry.end_time,
          title: entry.title, notes: entry.notes || '',
          recurrence_id: entry.recurrence_id, recurrence_frequency: entry.recurrence_frequency,
          recurrence_interval: entry.recurrence_interval, recurrence_end_date: entry.recurrence_end_date,
        });
      } else {
        const newStart = TIME_SLOTS[d.previewStartIdx];
        const newEnd = TIME_SLOTS[Math.min(d.previewEndIdx, TIME_SLOTS.length - 1)];
        const newDate = d.previewDate;
        if (newStart !== entry.start_time || newEnd !== entry.end_time || newDate !== entry.date.slice(0, 10)) {
          await update(entry.id, { date: newDate, start_time: newStart, end_time: newEnd, title: entry.title, notes: entry.notes || '' });
        }
      }
    };

    const onCancel = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      cleanup();
      dragRef.current = null;
      setDragState(null);
    };

    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onCancel, true);
  };

  const resetRepeatState = () => {
    setRepeatEnabled(false);
    setRepeatFrequency('weekly');
    setRepeatInterval(1);
    setRepeatEndDate('');
  };

  const handleSlotClick = (date: string, time: string) => {
    if (dragState) return;
    const si = slotIndex(time);
    const endIdx = Math.min(si + 2, TIME_SLOTS.length - 1);
    resetRepeatState();
    setEditing({ date, start_time: time, end_time: TIME_SLOTS[endIdx], title: '', notes: '' });
  };

  const handleSave = async () => {
    if (!editing || !editing.title.trim()) return;
    const data: Record<string, unknown> = {
      date: editing.date, start_time: editing.start_time, end_time: editing.end_time,
      title: editing.title, notes: editing.notes,
    };
    setSaving(true);
    try {
      if (editing.id) {
        await update(editing.id, data);
      } else if (repeatEnabled && repeatEndDate) {
        const futureDates = generateRecurrenceDates(editing.date, repeatEndDate, repeatFrequency, repeatInterval, MAX_RECURRENCE_OCCURRENCES);
        if (futureDates.length === MAX_RECURRENCE_OCCURRENCES && futureDates[futureDates.length - 1] < repeatEndDate) {
          toast.error(`That would create more than ${MAX_RECURRENCE_OCCURRENCES} appointments — shorten the date range or pick a coarser frequency.`);
          return;
        }
        const recurrenceId = crypto.randomUUID();
        const recurrenceFields = {
          recurrence_id: recurrenceId, recurrence_frequency: repeatFrequency,
          recurrence_interval: repeatInterval, recurrence_end_date: repeatEndDate,
        };
        await create({ ...data, ...recurrenceFields }, { silent: true });
        for (const date of futureDates) {
          await create({ ...data, date, ...recurrenceFields }, { silent: true });
        }
        toast.success(`Saved ${futureDates.length + 1} appointments`);
      } else {
        await create(data);
      }
      setEditing(null);
      resetRepeatState();
    } finally {
      setSaving(false);
    }
  };

  // Saves this occurrence normally, then copies its title/notes/times (not date or
  // recurrence metadata) to every sibling occurrence dated on or after it.
  const handleSaveToFutureSeries = async () => {
    if (!editing?.id || !editing.recurrence_id) return;
    setSaving(true);
    try {
      const data: Record<string, unknown> = {
        date: editing.date, start_time: editing.start_time, end_time: editing.end_time,
        title: editing.title, notes: editing.notes,
      };
      await update(editing.id, data, { silent: true });

      const contentData = { start_time: editing.start_time, end_time: editing.end_time, title: editing.title, notes: editing.notes };
      const futureSiblings = rows.filter(r =>
        r.recurrence_id === editing.recurrence_id && r.id !== editing.id && r.date.slice(0, 10) >= editing.date
      );
      for (const sibling of futureSiblings) {
        await update(sibling.id, contentData, { silent: true });
      }
      toast.success(`Saved ${futureSiblings.length + 1} appointments`);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing?.id) return;
    if (!await confirm({ message: `Delete "${editing.title}"?` })) return;
    await remove(editing.id);
    setEditing(null);
  };

  // Deletes this occurrence and every sibling dated on or after it, leaving past occurrences intact.
  const handleDeleteFuture = async () => {
    if (!editing?.id || !editing.recurrence_id) return;
    const toDelete = rows.filter(r => r.recurrence_id === editing.recurrence_id && r.date.slice(0, 10) >= editing.date);
    if (!await confirm({ message: `Delete "${editing.title}" and ${toDelete.length - 1} future occurrence(s)? Past occurrences are kept.` })) return;
    for (const r of toDelete) {
      await remove(r.id);
    }
    setEditing(null);
  };

  const goToday = () => setWeekStart(startOfWeek(new Date()));
  const goPrev = () => setWeekStart(w => startOfWeek(addWeeks(w, -1)));
  const goNext = () => setWeekStart(w => startOfWeek(addWeeks(w, 1)));

  const jumpToMonth = (year: number, month: number) => {
    const d = new Date(year, month, 1);
    setWeekStart(startOfWeek(d));
    setMonthPicker(false);
  };

  const pickerYear = weekStart.getFullYear();
  const [pickerYearView, setPickerYearView] = useState(pickerYear);

  const weekLabel = (() => {
    const first = weekDays[0];
    const last = weekDays[6];
    if (first.getMonth() === last.getMonth())
      return `${MONTH_NAMES[first.getMonth()]} ${first.getDate()}–${last.getDate()}, ${first.getFullYear()}`;
    if (first.getFullYear() === last.getFullYear())
      return `${MONTH_NAMES[first.getMonth()]} ${first.getDate()} – ${MONTH_NAMES[last.getMonth()]} ${last.getDate()}, ${first.getFullYear()}`;
    return `${MONTH_NAMES[first.getMonth()]} ${first.getDate()}, ${first.getFullYear()} – ${MONTH_NAMES[last.getMonth()]} ${last.getDate()}, ${last.getFullYear()}`;
  })();

  const timeOptions = TIME_SLOTS.map(t => ({ value: t, label: formatTime12(t) }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Bishop Schedule</h1>
        <div className="flex items-center gap-2">
          <button onClick={goToday} className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md text-sm hover:bg-gray-50">Today</button>
          <button onClick={goPrev} className="border border-gray-300 text-gray-700 px-2 py-1.5 rounded-md text-sm hover:bg-gray-50">‹</button>
          <button onClick={goNext} className="border border-gray-300 text-gray-700 px-2 py-1.5 rounded-md text-sm hover:bg-gray-50">›</button>
          <div className="relative">
            <button onClick={() => { setPickerYearView(weekStart.getFullYear()); setMonthPicker(!monthPicker); }}
              className="font-semibold text-gray-800 text-sm px-2 py-1.5 hover:bg-gray-100 rounded-md min-w-[220px] text-center">
              {weekLabel}
            </button>
            {monthPicker && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-3 w-64">
                <div className="flex items-center justify-between mb-2">
                  <button onClick={() => setPickerYearView(y => y - 1)} className="text-gray-500 hover:text-gray-800 px-1">‹</button>
                  <span className="font-semibold text-gray-800">{pickerYearView}</span>
                  <button onClick={() => setPickerYearView(y => y + 1)} className="text-gray-500 hover:text-gray-800 px-1">›</button>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {MONTH_NAMES.map((m, i) => (
                    <button key={m} onClick={() => jumpToMonth(pickerYearView, i)}
                      className={`px-2 py-1.5 rounded text-sm hover:bg-blue-50 hover:text-blue-700 ${
                        pickerYearView === new Date().getFullYear() && i === new Date().getMonth()
                          ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'
                      }`}>{m}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isLoading ? <p className="text-gray-400 text-sm">Loading...</p> : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-auto max-h-[calc(100vh-10rem)]"
          style={{ cursor: dragState?.type === 'move' ? 'grabbing' : dragState?.type === 'resize' ? 's-resize' : 'default' }}>
          <table className="w-full border-collapse text-xs" style={{ minWidth: 800 }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50">
                <th className="w-16 px-2 py-2 text-right text-gray-500 font-medium border-b border-r border-gray-200 sticky left-0 bg-gray-50 z-20"></th>
                {weekDays.map(d => {
                  const key = toKey(d);
                  const isToday = key === todayKey;
                  return (
                    <th key={key} className={`px-2 py-2 text-center font-medium border-b border-r border-gray-200 ${isToday ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}>
                      <div>{DAY_NAMES[d.getDay()]}</div>
                      <div className={`text-lg ${isToday ? 'bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto' : ''}`}>
                        {d.getDate()}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {TIME_SLOTS.map((slot, si) => {
                const isHour = slot.endsWith(':00');
                return (
                  <tr key={slot} className={isHour ? 'border-t border-gray-200' : ''}>
                    <td className={`px-2 py-0 text-right text-gray-400 font-mono border-r border-gray-200 sticky left-0 bg-white z-10 ${isHour ? 'align-top pt-0.5' : ''}`}
                      style={{ height: 20 }}>
                      {isHour ? formatTime12(slot) : ''}
                    </td>
                    {weekDays.map(d => {
                      const dayKey = toKey(d);
                      const dayEntries = entriesByDate.get(dayKey) || [];
                      const startingHere = dayEntries.filter(e => e.start_time === slot);
                      const occupiedBy = dayEntries.find(e => {
                        const eStart = slotIndex(e.start_time);
                        const eEnd = slotIndex(e.end_time);
                        return si > eStart && si < eEnd;
                      });

                      const isPreviewHere = dragState?.type === 'move'
                        && dragState.previewDate === dayKey
                        && dragState.previewStartIdx === si;

                      return (
                        <td
                          key={dayKey}
                          data-bs-date={dayKey}
                          data-bs-si={String(si)}
                          className={`border-r border-gray-100 relative
                            ${isHour ? 'border-t border-gray-200' : 'border-t border-gray-50'}
                            ${dayKey === todayKey ? 'bg-blue-50/30' : ''}
                            ${!dragState && !occupiedBy ? 'cursor-pointer hover:bg-blue-50/50' : ''}`}
                          style={{ height: 20, padding: 0 }}
                          onClick={() => !dragState && !occupiedBy && handleSlotClick(dayKey, slot)}
                        >
                          {startingHere.map(entry => {
                            const isBeingMoved = dragState?.type === 'move' && dragState.entryId === entry.id;
                            const isBeingResized = dragState?.type === 'resize' && dragState.entryId === entry.id;
                            const startIdx = slotIndex(entry.start_time);
                            const endIdx = isBeingResized ? (dragRef.current?.previewEndIdx ?? slotIndex(entry.end_time)) : slotIndex(entry.end_time);
                            const span = Math.max(1, endIdx - startIdx);
                            const conflict = conflictedIds.has(entry.id);

                            return (
                              <div
                                key={entry.id}
                                className={`absolute left-0.5 right-0.5 text-white rounded px-1 py-0.5 overflow-hidden shadow-sm select-none
                                  ${conflict ? 'bg-red-500' : 'bg-blue-500'}`}
                                style={{
                                  top: 0,
                                  height: span * 20 - 1,
                                  lineHeight: '1.2',
                                  touchAction: 'none',
                                  opacity: isBeingMoved ? 0.25 : 1,
                                  // All entries get pointer-events:none during any drag so elementFromPoint hits the TD cells
                                  pointerEvents: dragState ? 'none' : 'auto',
                                  cursor: dragState ? 'grabbing' : 'grab',
                                  zIndex: isBeingMoved ? 1 : 5,
                                }}
                                onPointerDown={e => {
                                  if (dragRef.current) return;
                                  e.preventDefault();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const offsetSlots = Math.floor((e.clientY - rect.top) / 20);
                                  beginDrag(e.currentTarget, e.pointerId, entry, 'move', offsetSlots, e.clientX, e.clientY);
                                }}
                              >
                                <div className="font-medium truncate">{entry.title}</div>
                                {span > 2 && (
                                  <div className={`truncate text-xs ${conflict ? 'text-red-100' : 'text-blue-100'}`}>
                                    {formatTime12(entry.start_time)}–{formatTime12(entry.end_time)}
                                  </div>
                                )}
                                {/* Resize handle */}
                                <div
                                  className="absolute bottom-0 left-0 right-0 h-2 flex items-center justify-center"
                                  style={{ cursor: 'ns-resize', touchAction: 'none' }}
                                  onPointerDown={e => {
                                    if (dragRef.current) return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const entryEl = e.currentTarget.parentElement as HTMLElement;
                                    beginDrag(entryEl, e.pointerId, entry, 'resize', 0, e.clientX, e.clientY);
                                  }}
                                >
                                  <div className="w-8 h-0.5 rounded bg-white/40" />
                                </div>
                              </div>
                            );
                          })}

                          {/* Move preview ghost */}
                          {isPreviewHere && (() => {
                            const span = dragState!.previewEndIdx - dragState!.previewStartIdx;
                            const origEntry = rows.find(r => r.id === dragState!.entryId);
                            return (
                              <div
                                className="absolute left-0.5 right-0.5 bg-blue-400 border-2 border-blue-600 text-white rounded px-1 py-0.5 pointer-events-none select-none"
                                style={{ top: 0, height: Math.max(1, span) * 20 - 1, lineHeight: '1.2', opacity: 0.8, zIndex: 20 }}
                              >
                                <div className="font-medium truncate">{origEntry?.title}</div>
                              </div>
                            );
                          })()}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Appointment' : 'New Appointment'}>
        {editing && (
          <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-3">
            <Input label="Title" value={editing.title} onChange={v => setEditing({ ...editing, title: v })} required />
            <Input label="Date" value={editing.date} onChange={v => setEditing({ ...editing, date: v })} type="date" />

            {!editing.id && (
              <div className="border border-gray-200 rounded-md p-3 space-y-2">
                <Checkbox label="Repeat this appointment" checked={repeatEnabled} onChange={setRepeatEnabled} />
                {repeatEnabled && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <Select label="Frequency" value={FREQUENCY_OPTIONS.find(o => o.value === repeatFrequency)?.label || ''}
                        onChange={v => setRepeatFrequency(FREQUENCY_OPTIONS.find(o => o.label === v)?.value || 'weekly')}
                        options={FREQUENCY_OPTIONS.map(o => o.label)} />
                      {repeatFrequency !== 'monthly_nth_weekday' && (
                        <Input label={`Every N ${repeatFrequency === 'daily' ? 'day(s)' : 'week(s)'}`} type="number"
                          value={String(repeatInterval)} onChange={v => setRepeatInterval(Math.max(1, parseInt(v, 10) || 1))} />
                      )}
                      {repeatFrequency === 'monthly_nth_weekday' && (
                        <Input label="Every N month(s)" type="number"
                          value={String(repeatInterval)} onChange={v => setRepeatInterval(Math.max(1, parseInt(v, 10) || 1))} />
                      )}
                    </div>
                    {repeatFrequency === 'monthly_nth_weekday' && editing.date && (() => {
                      const { weekday, nth } = getNthWeekdayInfo(editing.date);
                      const ordinal = ORDINAL_NAMES[nth - 1] || `${nth}th`;
                      return (
                        <p className="text-xs text-gray-500">
                          Repeats on the {ordinal} {WEEKDAY_NAMES[weekday]} of the month.
                        </p>
                      );
                    })()}
                    <Input label="Stop date" type="date" value={repeatEndDate} onChange={setRepeatEndDate} required />
                  </div>
                )}
              </div>
            )}

            {editing.id && editing.recurrence_id && editing.recurrence_frequency && editing.recurrence_end_date && (
              <p className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                Part of a recurring series — {describeRecurrence(editing.recurrence_frequency, editing.recurrence_interval || 1, editing.recurrence_end_date, editing.date).toLowerCase()}. Saving below only changes this appointment.
              </p>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <select value={editing.start_time} onChange={e => {
                const newStart = e.target.value;
                const newStartIdx = slotIndex(newStart);
                const oldDuration = slotIndex(editing.end_time) - slotIndex(editing.start_time);
                const newEndIdx = Math.min(newStartIdx + Math.max(oldDuration, 1), TIME_SLOTS.length - 1);
                setEditing({ ...editing, start_time: newStart, end_time: TIME_SLOTS[newEndIdx] });
              }} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                {timeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <select value={editing.end_time} onChange={e => setEditing({ ...editing, end_time: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                {timeOptions.filter(o => slotIndex(o.value) > slotIndex(editing.start_time)).map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <Textarea label="Notes" value={editing.notes} onChange={v => setEditing({ ...editing, notes: v })} />
            <div className="flex justify-between pt-2">
              <div className="flex gap-3">
                {editing.id && (
                  <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm text-red-600 hover:text-red-800">Delete</button>
                )}
                {editing.id && editing.recurrence_id && (
                  <button type="button" onClick={handleDeleteFuture} className="px-4 py-2 text-sm text-red-600 hover:text-red-800">
                    Delete this and future
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
                {editing.id && editing.recurrence_id && (
                  <button type="button" disabled={saving} onClick={handleSaveToFutureSeries}
                    className="px-4 py-2 border border-blue-600 text-blue-600 rounded-md text-sm hover:bg-blue-50 disabled:opacity-50">
                    Save + apply to future
                  </button>
                )}
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
