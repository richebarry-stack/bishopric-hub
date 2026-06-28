import { useState } from 'react';
import { useTable } from '../lib/useTable';
import { useAuth } from '../lib/auth';
import type { WcMeeting } from '../lib/api';
import Modal from '../components/Modal';
import { Input } from '../components/FormFields';

const TODAY = new Date().toISOString().slice(0, 10);

function formatDate(iso: string): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return new Date(iso.slice(0,10) + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function InlineText({ value, onSave, placeholder }: { value: string; onSave: (v: string) => void; placeholder?: string }) {
  const [local, setLocal] = useState(value);
  return (
    <input
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { if (local !== value) onSave(local); }}
      placeholder={placeholder}
      className="w-full rounded border border-transparent hover:border-gray-200 focus:border-emerald-400 focus:outline-none px-2 py-1 text-sm bg-transparent"
    />
  );
}

const EMPTY = { date: '', opening_prayer: '', spiritual_thought: '', closing_prayer: '' };

export default function WcMeetings() {
  const { user } = useAuth();
  const canEdit = user?.hub === 'both';
  const { rows, isLoading, create, update, remove } = useTable<WcMeeting>('wc-meetings');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [showPast, setShowPast] = useState(false);

  const upcoming = rows.filter(m => m.date.slice(0, 10) >= TODAY).sort((a, b) => a.date.localeCompare(b.date));
  const past = rows.filter(m => m.date.slice(0, 10) < TODAY).sort((a, b) => b.date.localeCompare(a.date));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await create(form);
    setForm({ ...EMPTY });
    setAdding(false);
  };

  const handleUpdate = (id: number, field: string, value: string) => {
    update(id, { [field]: value });
  };

  const MeetingTable = ({ meetings, readOnly }: { meetings: WcMeeting[]; readOnly?: boolean }) => (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left px-3 py-2 font-medium text-gray-600 w-44">Date</th>
            <th className="text-left px-3 py-2 font-medium text-gray-600">Opening Prayer</th>
            <th className="text-left px-3 py-2 font-medium text-gray-600">Spiritual Thought</th>
            <th className="text-left px-3 py-2 font-medium text-gray-600">Closing Prayer</th>
            <th className="px-3 py-2 w-10" />
          </tr>
        </thead>
        <tbody>
          {meetings.length === 0 && (
            <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-400">None</td></tr>
          )}
          {meetings.map(m => (
            <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{formatDate(m.date)}</td>
              <td className="px-1 py-1">
                {readOnly
                  ? <span className="px-2 py-1 text-sm text-gray-600">{m.opening_prayer || '—'}</span>
                  : <InlineText value={m.opening_prayer || ''} onSave={v => handleUpdate(m.id, 'opening_prayer', v)} placeholder="—" />}
              </td>
              <td className="px-1 py-1">
                {readOnly
                  ? <span className="px-2 py-1 text-sm text-gray-600">{m.spiritual_thought || '—'}</span>
                  : <InlineText value={m.spiritual_thought || ''} onSave={v => handleUpdate(m.id, 'spiritual_thought', v)} placeholder="—" />}
              </td>
              <td className="px-1 py-1">
                {readOnly
                  ? <span className="px-2 py-1 text-sm text-gray-600">{m.closing_prayer || '—'}</span>
                  : <InlineText value={m.closing_prayer || ''} onSave={v => handleUpdate(m.id, 'closing_prayer', v)} placeholder="—" />}
              </td>
              <td className="px-3 py-2">
                {!readOnly && (
                  <button onClick={() => { if (confirm('Delete this meeting?')) remove(m.id); }}
                    className="text-red-400 hover:text-red-600 text-xs">Del</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">WC Meeting Assignments</h1>
        {canEdit && (
          <button onClick={() => setAdding(true)}
            className="bg-emerald-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-emerald-700">
            + Add Meeting
          </button>
        )}
      </div>

      {isLoading ? <p className="text-gray-400 text-sm">Loading…</p> : (
        <>
          <MeetingTable meetings={upcoming} readOnly={!canEdit} />

          <div>
            <button onClick={() => setShowPast(p => !p)}
              className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-2">
              {showPast ? '▼' : '▶'} Past meetings ({past.length})
            </button>
            {showPast && <MeetingTable meetings={past} readOnly />}
          </div>
        </>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add WC Meeting">
        <form onSubmit={handleAdd} className="space-y-3">
          <Input label="Date" value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} type="date" required />
          <Input label="Opening Prayer" value={form.opening_prayer} onChange={v => setForm(f => ({ ...f, opening_prayer: v }))} />
          <Input label="Spiritual Thought" value={form.spiritual_thought} onChange={v => setForm(f => ({ ...f, spiritual_thought: v }))} />
          <Input label="Closing Prayer" value={form.closing_prayer} onChange={v => setForm(f => ({ ...f, closing_prayer: v }))} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setAdding(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm hover:bg-emerald-700">Add</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
