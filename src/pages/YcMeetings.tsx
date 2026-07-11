import { useState } from 'react';
import { useTable } from '../lib/useTable';
import { useAuth } from '../lib/auth';
import type { YcMeeting } from '../lib/api';
import Modal from '../components/Modal';
import { Input, Textarea } from '../components/FormFields';
import { useConfirm } from '../components/ConfirmDialog';

const TODAY = new Date().toISOString().slice(0, 10);

function formatDate(iso: string): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

const EMPTY: Partial<YcMeeting> = { date: '', agenda: '', notes: '' };

export default function YcMeetings() {
  const { isGuest, isWcReadOnly } = useAuth();
  const canEdit = !isGuest && !isWcReadOnly;
  const { rows, isLoading, create, update, remove } = useTable<YcMeeting>('yc-meetings');
  const [editing, setEditing] = useState<Partial<YcMeeting> | null>(null);
  const [showPast, setShowPast] = useState(false);
  const confirm = useConfirm();

  const upcoming = rows.filter(m => m.date.slice(0, 10) >= TODAY).sort((a, b) => a.date.localeCompare(b.date));
  const past = rows.filter(m => m.date.slice(0, 10) < TODAY).sort((a, b) => b.date.localeCompare(a.date));

  const handleSave = async () => {
    if (!editing) return;
    const data = { ...editing };
    delete (data as Record<string, unknown>).id;
    if (editing.id) await update(editing.id, data as Record<string, unknown>);
    else await create(data as Record<string, unknown>);
    setEditing(null);
  };

  const MeetingList = ({ meetings, readOnly }: { meetings: YcMeeting[]; readOnly?: boolean }) => (
    <div className="space-y-2">
      {meetings.length === 0 && <p className="text-sm text-gray-400 text-center py-4">None</p>}
      {meetings.map(m => (
        <div key={m.id}
          className={`bg-white rounded-lg border border-gray-200 p-3 ${!readOnly ? 'cursor-pointer hover:shadow-sm' : ''}`}
          onClick={!readOnly ? () => setEditing(m) : undefined}>
          <div className="flex items-center justify-between">
            <p className="font-medium text-gray-900">{formatDate(m.date)}</p>
            {!readOnly && (
              <button onClick={async e => { e.stopPropagation(); if (await confirm('Delete this meeting?')) remove(m.id); }}
                className="text-red-400 hover:text-red-600 text-xs">Del</button>
            )}
          </div>
          {m.agenda && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{m.agenda}</p>}
          {m.notes && <p className="text-sm text-gray-400 mt-1 whitespace-pre-wrap">{m.notes}</p>}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Youth Council Meetings</h1>
        {canEdit && (
          <button onClick={() => setEditing({ ...EMPTY })}
            className="bg-amber-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-amber-700">
            + Add Meeting
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 -mt-4">
        Agenda and notes for the ward youth council — bishopric, quorum/class presidencies, and advisers usually meet monthly.
      </p>

      {isLoading ? <p className="text-gray-400 text-sm">Loading…</p> : (
        <>
          <MeetingList meetings={upcoming} readOnly={!canEdit} />

          <div>
            <button onClick={() => setShowPast(p => !p)}
              className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-2">
              {showPast ? '▼' : '▶'} Past meetings ({past.length})
            </button>
            {showPast && <MeetingList meetings={past} readOnly />}
          </div>
        </>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Meeting' : 'Add YC Meeting'}>
        {editing && (
          <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-3">
            <Input label="Date" value={(editing.date || '').slice(0, 10)} onChange={v => setEditing({ ...editing, date: v })} type="date" required />
            <Textarea label="Agenda" value={editing.agenda || ''} onChange={v => setEditing({ ...editing, agenda: v })} />
            <Textarea label="Notes" value={editing.notes || ''} onChange={v => setEditing({ ...editing, notes: v })} />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-amber-600 text-white rounded-md text-sm hover:bg-amber-700">Save</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
