import { useMemo, useState } from 'react';
import { useTable } from '../lib/useTable';
import type { InterviewSlot, ScheduleEntry, TithingDeclarationSlot } from '../lib/api';
import { parseCalendars } from '../lib/scheduleCalendars';
import { useAuth } from '../lib/auth';
import { useConfirm } from '../components/ConfirmDialog';
import { Input } from '../components/FormFields';
import { toast } from '../lib/toast';

const CALENDARS = ['Bishop', 'First Counselor', 'Second Counselor'] as const;
const LENGTHS = [15, 20, 30, 45, 60];

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function fromMinutes(n: number): string {
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}

function formatTime12(t: string): string {
  const [hh, mm] = t.split(':').map(Number);
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`;
}

function formatDate(d: string): string {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function addDays(d: string, n: number): string {
  const [y, m, day] = d.split('-').map(Number);
  const dt = new Date(y, m - 1, day + n);
  return dt.toLocaleDateString('en-CA');
}

const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) => aStart < bEnd && aEnd > bStart;

export default function InterviewBooking() {
  const { user } = useAuth();
  const { rows: slots, isLoading, create, update, remove } = useTable<InterviewSlot>('interview-slots');
  const { rows: entries } = useTable<ScheduleEntry>('schedule-entries');
  const { rows: tithing } = useTable<TithingDeclarationSlot>('tithing-declarations');
  const confirm = useConfirm();

  const [calendar, setCalendar] = useState<string>(() =>
    (CALENDARS as readonly string[]).includes(user?.church_role || '') ? user!.church_role : 'Bishop');
  const today = new Date().toLocaleDateString('en-CA');
  const [form, setForm] = useState({ date: today, from: '19:00', to: '20:00', length: 20, location: "Bishop's office", repeatWeeks: 0 });
  const [adding, setAdding] = useState(false);

  // Something already on this calendar at that time (an appointment, a booked slot, or
  // for the Bishop a reserved tithing declaration) — same rule the server applies.
  const busyReason = (s: { calendar: string; date: string; start_time: string; end_time: string; id?: number; schedule_entry_id?: number | null }): string | null => {
    const date = s.date.slice(0, 10);
    const entry = entries.find(e => e.date.slice(0, 10) === date && parseCalendars(e.calendars).includes(s.calendar as never)
      && e.id !== s.schedule_entry_id && overlaps(s.start_time, s.end_time, e.start_time, e.end_time));
    if (entry) return `"${entry.title}" on the calendar`;
    const booked = slots.find(o => o.id !== s.id && o.calendar === s.calendar && o.reserved_by && o.date.slice(0, 10) === date
      && overlaps(s.start_time, s.end_time, o.start_time, o.end_time));
    if (booked) return `${booked.reserved_by}'s interview`;
    if (s.calendar === 'Bishop') {
      const t = tithing.find(t => t.reserved_by && t.date.slice(0, 10) === date && overlaps(s.start_time, s.end_time, t.start_time, t.end_time));
      if (t) return `${t.reserved_by}'s tithing declaration`;
    }
    return null;
  };

  const upcoming = useMemo(() => slots
    .filter(s => s.calendar === calendar && s.date.slice(0, 10) >= today)
    .sort((a, b) => a.date === b.date ? a.start_time.localeCompare(b.start_time) : a.date.localeCompare(b.date)),
  [slots, calendar, today]);

  const grouped = useMemo(() => {
    const map = new Map<string, InterviewSlot[]>();
    for (const s of upcoming) {
      const k = s.date.slice(0, 10);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return map;
  }, [upcoming]);

  const handleAdd = async () => {
    const start = toMinutes(form.from);
    const end = toMinutes(form.to);
    if (!form.date || end <= start) { toast.error('Pick an end time after the start time.'); return; }
    const toCreate: { date: string; start_time: string; end_time: string }[] = [];
    let skipped = 0;
    for (let w = 0; w <= form.repeatWeeks; w++) {
      const date = addDays(form.date, w * 7);
      for (let t = start; t + form.length <= end; t += form.length) {
        const s = { calendar, date, start_time: fromMinutes(t), end_time: fromMinutes(t + form.length) };
        const clash = slots.some(o => o.calendar === calendar && o.date.slice(0, 10) === date && overlaps(s.start_time, s.end_time, o.start_time, o.end_time))
          || busyReason(s) !== null;
        if (clash) skipped++; else toCreate.push(s);
      }
    }
    if (toCreate.length === 0) { toast.error(skipped ? 'Those times are already taken on this calendar.' : 'No slots fit in that time range.'); return; }
    setAdding(true);
    try {
      for (const s of toCreate) {
        await create({ calendar, ...s, location: form.location.trim(), notes: '' }, { silent: true });
      }
      toast.success(`Added ${toCreate.length} open time${toCreate.length === 1 ? '' : 's'}${skipped ? ` (skipped ${skipped} already taken)` : ''}`);
    } finally {
      setAdding(false);
    }
  };

  const cancelBooking = async (s: InterviewSlot) => {
    if (!await confirm({ message: `Cancel ${s.reserved_by}'s booking? The appointment comes off the ${s.calendar} calendar and the time opens up again. Let them know yourself — they aren't notified.` })) return;
    await update(s.id, { reserved_by: null, reserved_contact: null, reserved_purpose: null, reserved_at: null, schedule_entry_id: null });
  };

  const deleteSlot = async (s: InterviewSlot) => {
    if (s.reserved_by) {
      if (!await confirm({ message: `Delete this time? ${s.reserved_by}'s booking and its calendar appointment will be removed too.` })) return;
    }
    await remove(s.id);
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const link = `${origin}/book-interview?with=${encodeURIComponent(calendar)}`;
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success('Link copied'); } catch { toast.error('Could not copy — select the link and copy it.'); }
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Interview Booking</h1>
      <p className="text-sm text-gray-500 mb-4">
        Offer open times members can book themselves, without logging in. A booking goes straight onto that person's schedule, and they and
        the executive secretaries get it in My Actions and by email. Members only see open times — never who booked or why.
      </p>

      <div className="flex gap-1 mb-4 border-b border-gray-200 overflow-x-auto">
        {CALENDARS.map(c => (
          <button key={c} onClick={() => setCalendar(c)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${calendar === c ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm">
        <p className="font-medium text-blue-900 mb-1">Booking link for the {calendar}</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="bg-white border border-blue-100 rounded px-2 py-1 text-xs break-all">{link}</code>
          <button type="button" onClick={() => copy(link)} className="text-xs font-medium text-blue-700 hover:text-blue-900 border border-blue-200 rounded px-2 py-1 bg-white">Copy</button>
        </div>
        <p className="text-xs text-blue-800 mt-1">
          Or share <button type="button" onClick={() => copy(`${origin}/book-interview`)} className="underline">{origin}/book-interview</button>, which lets the member choose who to meet with.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Add open times</h2>
        <form onSubmit={e => { e.preventDefault(); handleAdd(); }} className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
          <div className="col-span-2 md:col-span-2"><Input label="Date" type="date" value={form.date} onChange={v => setForm({ ...form, date: v })} required /></div>
          <Input label="From" type="time" value={form.from} onChange={v => setForm({ ...form, from: v })} required />
          <Input label="To" type="time" value={form.to} onChange={v => setForm({ ...form, to: v })} required />
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Each</span>
            <select value={form.length} onChange={e => setForm({ ...form, length: Number(e.target.value) })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              {LENGTHS.map(l => <option key={l} value={l}>{l} min</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Repeat</span>
            <select value={form.repeatWeeks} onChange={e => setForm({ ...form, repeatWeeks: Number(e.target.value) })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value={0}>Just this day</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map(n => <option key={n} value={n}>+{n} more week{n === 1 ? '' : 's'}</option>)}
            </select>
          </label>
          <div className="col-span-2 md:col-span-4"><Input label="Location" value={form.location} onChange={v => setForm({ ...form, location: v })} /></div>
          <div className="col-span-2 md:col-span-2">
            <button type="submit" disabled={adding} className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {adding ? 'Adding…' : 'Add open times'}
            </button>
          </div>
        </form>
        <p className="text-xs text-gray-400 mt-2">Times that clash with something already on the {calendar}'s calendar are skipped.</p>
      </div>

      {isLoading ? <p className="text-gray-400 text-sm">Loading...</p> : grouped.size === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No upcoming times for the {calendar}.</p>
      ) : (
        <div className="space-y-4">
          {[...grouped.entries()].map(([date, daySlots]) => (
            <div key={date} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 font-medium text-gray-700 text-sm border-b border-gray-200">{formatDate(date)}</div>
              <ul className="divide-y divide-gray-100">
                {daySlots.map(s => {
                  const busy = !s.reserved_by ? busyReason(s) : null;
                  return (
                    <li key={s.id} className="px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div>
                        <span className="font-medium text-gray-800">{formatTime12(s.start_time)}–{formatTime12(s.end_time)}</span>
                        {s.location && <span className="text-gray-400 ml-2">{s.location}</span>}
                        {s.reserved_by ? (
                          <div className="text-green-700">
                            Booked: <span className="font-medium">{s.reserved_by}</span>
                            {s.reserved_purpose && <span> · {s.reserved_purpose}</span>}
                            {s.reserved_contact && <span className="text-gray-500"> · {s.reserved_contact}</span>}
                          </div>
                        ) : busy ? (
                          <div className="text-gray-400">Hidden from members: {busy}</div>
                        ) : (
                          <div className="text-blue-600">Open</div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {s.reserved_by && (
                          <button type="button" onClick={() => cancelBooking(s)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Cancel booking</button>
                        )}
                        <button type="button" onClick={() => deleteSlot(s)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
