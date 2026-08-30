import { useState, useMemo } from 'react';
import { useTable } from '../lib/useTable';
import type { TithingDeclarationSlot, ScheduleEntry } from '../lib/api';
import { parseCalendars } from '../lib/scheduleCalendars';
import Modal from '../components/Modal';
import { Input, Textarea } from '../components/FormFields';
import { useConfirm } from '../components/ConfirmDialog';

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

function parseDateKey(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}

function formatDateShort(d: string): string {
  return parseDateKey(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
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

function defaultWeekStart(): Date {
  const now = new Date();
  return now.getDay() === 6 ? startOfWeek(addWeeks(now, 1)) : startOfWeek(now);
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
  location: string;
  notes: string;
}

export default function TithingDeclarationSchedule() {
  const { rows, isLoading, create, update, remove } = useTable<TithingDeclarationSlot>('tithing-declarations');
  // Bishop's existing calendar, shown as a read-only busy overlay so the bishopric can see
  // conflicts while adding slots — this data is never sent to the public reservation page.
  const { rows: scheduleRows } = useTable<ScheduleEntry>('schedule-entries');
  const [weekStart, setWeekStart] = useState(() => defaultWeekStart());
  const [editing, setEditing] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [monthPicker, setMonthPicker] = useState(false);
  const confirm = useConfirm();

  const todayKey = toKey(new Date());
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, TithingDeclarationSlot[]>();
    for (const e of rows) {
      const key = e.date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [rows]);

  const bishopEntriesByDate = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>();
    for (const e of scheduleRows) {
      if (!parseCalendars(e.calendars).includes('Bishop')) continue;
      const key = e.date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [scheduleRows]);

  const reservations = useMemo(() =>
    rows.filter(r => r.reserved_by)
      .sort((a, b) => a.date === b.date ? a.start_time.localeCompare(b.start_time) : a.date.localeCompare(b.date)),
    [rows]);

  const handleSlotClick = (date: string, time: string) => {
    const si = slotIndex(time);
    const endIdx = Math.min(si + 1, TIME_SLOTS.length - 1);
    setEditing({ date, start_time: time, end_time: TIME_SLOTS[endIdx], location: '', notes: '' });
  };

  const openEditor = (entry: TithingDeclarationSlot) => {
    setEditing({
      id: entry.id, date: entry.date.slice(0, 10), start_time: entry.start_time, end_time: entry.end_time,
      location: entry.location, notes: entry.notes || '',
    });
  };

  const handleSave = async () => {
    if (!editing || !editing.location.trim()) return;
    setSaving(true);
    try {
      const data = { date: editing.date, start_time: editing.start_time, end_time: editing.end_time, location: editing.location, notes: editing.notes };
      if (editing.id) await update(editing.id, data);
      else await create(data);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing?.id) return;
    if (!await confirm({ message: 'Delete this slot?' })) return;
    await remove(editing.id);
    setEditing(null);
  };

  const goToday = () => setWeekStart(defaultWeekStart());
  const goPrev = () => setWeekStart(w => startOfWeek(addWeeks(w, -1)));
  const goNext = () => setWeekStart(w => startOfWeek(addWeeks(w, 1)));

  const jumpToMonth = (year: number, month: number) => {
    setWeekStart(startOfWeek(new Date(year, month, 1)));
    setMonthPicker(false);
  };

  const [pickerYearView, setPickerYearView] = useState(weekStart.getFullYear());

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
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Tithing Declaration Slots</h1>
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
      <p className="text-sm text-gray-500 mb-3">
        Click an open cell to add a slot. Members reserve slots without logging in at <span className="font-mono">/declare-tithing</span> — each slot holds one family. The
        {' '}<span className="inline-block align-middle w-3 h-3 rounded-sm mr-1" style={{ background: 'repeating-linear-gradient(45deg, rgba(107,114,128,0.5), rgba(107,114,128,0.5) 2px, rgba(107,114,128,0.25) 2px, rgba(107,114,128,0.25) 4px)' }} />
        hatched areas show the Bishop's existing calendar for reference — that's for your eyes only, never shown to members reserving a slot.
      </p>

      {!isLoading && (
        <div className="bg-white rounded-lg border border-gray-200 mb-4">
          <div className="bg-gray-50 px-4 py-2 font-medium text-gray-700 text-sm border-b border-gray-200">
            Reservations {reservations.length > 0 && <span className="text-gray-400 font-normal">({reservations.length})</span>}
          </div>
          {reservations.length === 0 ? (
            <p className="text-sm text-gray-400 px-4 py-3">No one has reserved a slot yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {reservations.map(r => (
                <li key={r.id} className="px-4 py-2 flex items-center justify-between gap-2 hover:bg-gray-50 cursor-pointer"
                  onClick={() => { setWeekStart(startOfWeek(parseDateKey(r.date))); openEditor(r); }}>
                  <div>
                    <span className="font-medium text-gray-800">{r.reserved_by}</span>
                    {r.reserved_contact && <span className="text-gray-400 text-sm ml-2">{r.reserved_contact}</span>}
                  </div>
                  <div className="text-sm text-gray-500 whitespace-nowrap">
                    {formatDateShort(r.date)} · {formatTime12(r.start_time)} · {r.location}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isLoading ? <p className="text-gray-400 text-sm">Loading...</p> : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-auto max-h-[calc(100vh-10rem)]">
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
                      const bishopDayEntries = bishopEntriesByDate.get(dayKey) || [];
                      const bishopStartingHere = bishopDayEntries.filter(e => e.start_time === slot);

                      return (
                        <td
                          key={dayKey}
                          className={`border-r border-gray-100 relative
                            ${isHour ? 'border-t border-gray-200' : 'border-t border-gray-50'}
                            ${dayKey === todayKey ? 'bg-blue-50/30' : ''}
                            ${!occupiedBy && startingHere.length === 0 ? 'cursor-pointer hover:bg-blue-50/50' : ''}`}
                          style={{ height: 20, padding: 0 }}
                          onClick={() => {
                            if (occupiedBy) return;
                            if (startingHere.length === 1) openEditor(startingHere[0]);
                            else if (startingHere.length === 0) handleSlotClick(dayKey, slot);
                          }}
                        >
                          {bishopStartingHere.map(entry => {
                            const startIdx = slotIndex(entry.start_time);
                            const endIdx = slotIndex(entry.end_time);
                            const span = Math.max(1, endIdx - startIdx);
                            return (
                              <div
                                key={`bishop-${entry.id}`}
                                className="absolute rounded overflow-hidden select-none pointer-events-none"
                                style={{
                                  top: 0,
                                  height: span * 20,
                                  left: '1px',
                                  width: 'calc(100% - 2px)',
                                  zIndex: 1,
                                  background: 'repeating-linear-gradient(45deg, rgba(107,114,128,0.25), rgba(107,114,128,0.25) 4px, rgba(107,114,128,0.12) 4px, rgba(107,114,128,0.12) 8px)',
                                }}
                                title={`Bishop's calendar: ${entry.title}`}
                              />
                            );
                          })}
                          {startingHere.map((entry, entryIdx) => {
                            const startIdx = slotIndex(entry.start_time);
                            const endIdx = slotIndex(entry.end_time);
                            const span = Math.max(1, endIdx - startIdx);
                            const laneCount = startingHere.length;
                            const laneWidth = 100 / laneCount;
                            const reserved = !!entry.reserved_by;

                            return (
                              <div
                                key={entry.id}
                                className={`absolute text-white rounded px-1 py-0.5 overflow-hidden shadow-sm select-none cursor-pointer
                                  ${reserved ? 'bg-green-600' : 'bg-blue-500'}`}
                                style={{
                                  top: 0,
                                  height: span * 20,
                                  left: laneCount > 1 ? `calc(${entryIdx * laneWidth}% + 1px)` : '1px',
                                  width: laneCount > 1 ? `calc(${laneWidth}% - 2px)` : 'calc(100% - 2px)',
                                  lineHeight: '1.2',
                                  zIndex: 5,
                                }}
                                onClick={e => { e.stopPropagation(); openEditor(entry); }}
                                title={reserved
                                  ? `Reserved by ${entry.reserved_by}${entry.reserved_contact ? ` (${entry.reserved_contact})` : ''} — ${entry.location}`
                                  : `Open — ${entry.location}`}
                              >
                                <div className="font-medium truncate">{reserved ? entry.reserved_by : entry.location}</div>
                                {span > 2 && (
                                  <div className="truncate text-xs text-white/80">
                                    {reserved ? entry.location : 'Open'}
                                  </div>
                                )}
                              </div>
                            );
                          })}
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

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Slot' : 'New Slot'}>
        {editing && (
          <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-3">
            <Input label="Date" type="date" value={editing.date} onChange={v => setEditing({ ...editing, date: v })} required />
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
            <Input label="Location" value={editing.location} onChange={v => setEditing({ ...editing, location: v })} placeholder="e.g. Bishop's Office" required />
            <Textarea label="Notes" value={editing.notes} onChange={v => setEditing({ ...editing, notes: v })} />
            {editing.id && (() => {
              const current = rows.find(r => r.id === editing.id);
              return current?.reserved_by ? (
                <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                  Reserved by {current.reserved_by}{current.reserved_contact ? ` (${current.reserved_contact})` : ''}
                </p>
              ) : null;
            })()}
            <div className="flex justify-between pt-2">
              <div>
                {editing.id && (
                  <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm text-red-600 hover:text-red-800">Delete</button>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
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
