import { useEffect, useMemo, useState } from 'react';
import { api, ApiError, type PublicInterviewSlot } from '../lib/api';
import Modal from '../components/Modal';

const CALENDARS = ['Bishop', 'First Counselor', 'Second Counselor'];
const PURPOSES = ['Temple recommend', 'Youth interview', 'Calling or release', 'Other / personal'];
const LABELS: Record<string, string> = {
  Bishop: 'the Bishop',
  'First Counselor': 'the First Counselor',
  'Second Counselor': 'the Second Counselor',
};

function formatTime12(t: string): string {
  const [hh, mm] = t.split(':').map(Number);
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`;
}

function formatDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function BookInterviewPublic() {
  const initial = new URLSearchParams(window.location.search).get('with') || '';
  const [calendar, setCalendar] = useState(CALENDARS.includes(initial) ? initial : '');
  const [slots, setSlots] = useState<PublicInterviewSlot[] | null>(null);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState<PublicInterviewSlot | null>(null);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [purpose, setPurpose] = useState('');
  const [saving, setSaving] = useState(false);
  const [bookError, setBookError] = useState('');
  const [confirmed, setConfirmed] = useState<PublicInterviewSlot | null>(null);

  const load = () => {
    api.interviewBooking.listPublic()
      .then(rows => { setError(''); setSlots(rows); })
      .catch(() => setError('Could not load available times. Please try again later.'));
  };
  useEffect(load, []);

  const available = useMemo(() => new Set((slots || []).map(s => s.calendar)), [slots]);
  const shown = useMemo(() => (slots || []).filter(s => s.calendar === calendar), [slots, calendar]);
  const grouped = useMemo(() => {
    const map = new Map<string, PublicInterviewSlot[]>();
    for (const s of shown) {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    }
    return map;
  }, [shown]);

  const openBooking = (s: PublicInterviewSlot) => {
    setBooking(s);
    setBookError('');
  };

  const handleBook = async () => {
    if (!booking || !name.trim() || !contact.trim() || !purpose) return;
    setSaving(true);
    setBookError('');
    try {
      await api.interviewBooking.reserve(booking.id, { name: name.trim(), contact: contact.trim(), purpose });
      setConfirmed(booking);
      setBooking(null);
      load();
    } catch (err) {
      const taken = err instanceof ApiError && err.status === 409;
      setBookError(taken ? 'Sorry, that time was just taken. Please pick another.' : 'Could not book that time. Please try again.');
      if (taken) load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Schedule an Interview</h1>
        <p className="text-sm text-gray-600 mb-1">Pick a time below. No login required.</p>
        <p className="text-sm text-gray-500 mb-6">Need to cancel or change it? Please contact the executive secretary or bishopric directly.</p>

        {confirmed && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 text-sm text-green-800">
            You're scheduled with {LABELS[confirmed.calendar]} on {formatDate(confirmed.date)} at {formatTime12(confirmed.start_time)}
            {confirmed.location ? ` (${confirmed.location})` : ''}.
          </div>
        )}

        <div className="mb-5">
          <p className="text-sm font-medium text-gray-700 mb-2">Who would you like to meet with?</p>
          <div className="flex flex-wrap gap-2">
            {CALENDARS.map(c => (
              <button key={c} type="button" onClick={() => setCalendar(c)}
                className={`px-4 py-2 rounded-md text-sm border ${calendar === c ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                {c}{slots && !available.has(c) ? ' (no times)' : ''}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {!calendar ? null : slots === null && !error ? (
          <p className="text-gray-400 text-sm">Loading available times...</p>
        ) : shown.length === 0 ? (
          <p className="text-gray-500 text-sm">No open times with {LABELS[calendar]} right now. Please check back later or contact the executive secretary.</p>
        ) : (
          <div className="space-y-4">
            {[...grouped.entries()].map(([date, daySlots]) => (
              <div key={date} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 font-medium text-gray-700 text-sm border-b border-gray-200">{formatDate(date)}</div>
                <ul className="divide-y divide-gray-100">
                  {daySlots.map(s => (
                    <li key={s.id} className="px-4 py-2 flex items-center justify-between gap-2">
                      <div className="text-sm text-gray-800">
                        <div>{formatTime12(s.start_time)}–{formatTime12(s.end_time)}</div>
                        {s.location && <div className="text-xs text-gray-500"><span aria-hidden="true">📍</span> {s.location}</div>}
                        {s.notes && <div className="text-xs text-gray-400">{s.notes}</div>}
                      </div>
                      <button onClick={() => openBooking(s)} className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700 whitespace-nowrap">Book</button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={!!booking} onClose={() => setBooking(null)} title="Book This Time">
        {booking && (
          <form onSubmit={e => { e.preventDefault(); handleBook(); }} className="space-y-3">
            <p className="text-sm text-gray-600">
              With {LABELS[booking.calendar]} · {formatDate(booking.date)} at {formatTime12(booking.start_time)}
              {booking.location && <><br /><span className="text-gray-500"><span aria-hidden="true">📍</span> {booking.location}</span></>}
            </p>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Your name *</span>
              <input value={name} onChange={e => setName(e.target.value)} required maxLength={120}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Phone or email *</span>
              <input value={contact} onChange={e => setContact(e.target.value)} required maxLength={200}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">What is it for? *</span>
              <select value={purpose} onChange={e => setPurpose(e.target.value)} required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                <option value="">Select…</option>
                {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <p className="text-xs text-gray-400">Only the bishopric sees your booking. To cancel or change it later, contact them directly.</p>
            {bookError && <p className="text-sm text-red-600">{bookError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setBooking(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button type="submit" disabled={saving || !name.trim() || !contact.trim() || !purpose}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Booking…' : 'Book'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
