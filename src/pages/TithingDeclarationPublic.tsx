import { useState, useEffect, useMemo } from 'react';
import { api, ApiError } from '../lib/api';
import Modal from '../components/Modal';

interface PublicSlot {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  notes: string;
  reserved_by: string | null;
}

function formatTime12(t: string): string {
  const [hh, mm] = t.split(':').map(Number);
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 || 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

function formatDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function TithingDeclarationPublic() {
  const [slots, setSlots] = useState<PublicSlot[] | null>(null);
  const [error, setError] = useState('');
  const [reserving, setReserving] = useState<PublicSlot | null>(null);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [saving, setSaving] = useState(false);
  const [reserveError, setReserveError] = useState('');
  const [confirmed, setConfirmed] = useState<PublicSlot | null>(null);

  const load = () => {
    api.tithingDeclarations.listPublic()
      .then(rows => setSlots(rows as PublicSlot[]))
      .catch(() => setError('Could not load available times. Please try again later.'));
  };

  useEffect(load, []);

  const grouped = useMemo(() => {
    const map = new Map<string, PublicSlot[]>();
    for (const s of slots || []) {
      const key = s.date.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [slots]);

  const openReserve = (slot: PublicSlot) => {
    setReserving(slot);
    setName('');
    setContact('');
    setReserveError('');
  };

  const handleReserve = async () => {
    if (!reserving || !name.trim()) return;
    setSaving(true);
    setReserveError('');
    try {
      await api.tithingDeclarations.reserve(reserving.id, { name: name.trim(), contact: contact.trim() || undefined });
      setConfirmed(reserving);
      setReserving(null);
      load();
    } catch (err) {
      setReserveError(err instanceof ApiError && err.status === 409
        ? 'Sorry, that time was just reserved by someone else. Please pick another.'
        : 'Could not reserve that time — please try again.');
      if (err instanceof ApiError && err.status === 409) load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Tithing Declaration</h1>
        <p className="text-sm text-gray-600 mb-1">Pick a time below to reserve your appointment. No login required.</p>
        <p className="text-sm text-gray-500 mb-6">Need to cancel or change your appointment? Please contact the bishopric directly — this page can't cancel a reservation.</p>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {confirmed && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 text-sm text-green-800">
            You're reserved for {formatDate(confirmed.date)} at {formatTime12(confirmed.start_time)} — {confirmed.location}.
          </div>
        )}

        {slots === null && !error ? (
          <p className="text-gray-400 text-sm">Loading available times...</p>
        ) : slots && slots.length === 0 ? (
          <p className="text-gray-500 text-sm">No times right now — please check back later.</p>
        ) : (
          <div className="space-y-4">
            {[...grouped.entries()].map(([date, daySlots]) => (
              <div key={date} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 font-medium text-gray-700 text-sm border-b border-gray-200">{formatDate(date)}</div>
                <ul className="divide-y divide-gray-100">
                  {daySlots.map(slot => (
                    <li key={slot.id} className="px-4 py-2 flex items-center justify-between gap-2">
                      <div className="text-sm text-gray-800">
                        <div>{formatTime12(slot.start_time)}–{formatTime12(slot.end_time)}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <span aria-hidden="true">📍</span>{slot.location}
                        </div>
                        {slot.notes && <div className="text-xs text-gray-400">{slot.notes}</div>}
                      </div>
                      {slot.reserved_by ? (
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-3 py-1.5 whitespace-nowrap">
                          Reserved — {slot.reserved_by}
                        </span>
                      ) : (
                        <button onClick={() => openReserve(slot)} className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700 whitespace-nowrap">
                          Reserve
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={!!reserving} onClose={() => setReserving(null)} title="Reserve This Time">
        {reserving && (
          <form onSubmit={e => { e.preventDefault(); handleReserve(); }} className="space-y-3">
            <p className="text-sm text-gray-600">
              {formatDate(reserving.date)} at {formatTime12(reserving.start_time)}<br />
              <span className="text-gray-500"><span aria-hidden="true">📍</span> {reserving.location}</span>
            </p>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Name *</span>
              <input value={name} onChange={e => setName(e.target.value)} required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Phone or email (optional)</span>
              <input value={contact} onChange={e => setContact(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </label>
            <p className="text-xs text-gray-400">To cancel or change this later, contact the bishopric directly.</p>
            {reserveError && <p className="text-sm text-red-600">{reserveError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setReserving(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button type="submit" disabled={saving || !name.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Reserving…' : 'Reserve'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
