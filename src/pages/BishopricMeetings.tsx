import { useState } from 'react';
import { useTable } from '../lib/useTable';
import type { BishopricMeeting } from '../lib/api';
import Modal from '../components/Modal';
import { Input, Textarea, Checkbox, Select } from '../components/FormFields';
import { useConfirm } from '../components/ConfirmDialog';
import { toast } from '../lib/toast';

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

const REPEAT_OPTIONS = [
  { label: 'Weekly', weeks: 1 },
  { label: 'Every 2 weeks', weeks: 2 },
  { label: 'Every 3 weeks', weeks: 3 },
  { label: 'Every 4 weeks', weeks: 4 },
];

function addWeeks(dateStr: string, weeks: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

export default function BishopricMeetings() {
  const { rows, isLoading, create, update, remove } = useTable<BishopricMeeting>('bishopric-meetings');
  const [editing, setEditing] = useState<Partial<BishopricMeeting> | null>(null);
  const confirm = useConfirm();
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatWeeks, setRepeatWeeks] = useState(1);
  const [repeatCount, setRepeatCount] = useState(12);
  const [saving, setSaving] = useState(false);
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
    setSaving(true);
    try {
      const data = { ...editing };
      delete (data as Record<string, unknown>).id;

      if (editing.id) {
        await update(editing.id, data as Record<string, unknown>);
      } else if (repeatEnabled && editing.date) {
        const recurrenceId = crypto.randomUUID();
        await create({ ...data, recurrence_id: recurrenceId, recurrence_interval_weeks: repeatWeeks }, { silent: true });
        let date = editing.date;
        for (let i = 1; i < repeatCount; i++) {
          date = addWeeks(date, repeatWeeks);
          await create({
            ...EMPTY, date, recurrence_id: recurrenceId, recurrence_interval_weeks: repeatWeeks,
          }, { silent: true });
        }
        toast.success(`Saved ${repeatCount} meetings`);
      } else {
        await create(data as Record<string, unknown>);
      }
      if (editing.date) setViewDate(new Date(editing.date.slice(0, 10) + 'T12:00:00'));
      setEditing(null);
      setRepeatEnabled(false);
      setRepeatWeeks(1);
      setRepeatCount(12);
    } finally {
      setSaving(false);
    }
  };

  // Apply this meeting's content to every other meeting in its recurring series dated on or after it,
  // leaving each sibling's own date and recurrence settings untouched.
  const handleSaveToFutureSeries = async () => {
    if (!editing?.id || !editing.recurrence_id) return;
    setSaving(true);
    try {
      const ownData = { ...editing };
      delete (ownData as Record<string, unknown>).id;
      await update(editing.id, ownData as Record<string, unknown>, { silent: true });

      const contentData = { ...ownData };
      delete (contentData as Record<string, unknown>).date;
      delete (contentData as Record<string, unknown>).recurrence_id;
      delete (contentData as Record<string, unknown>).recurrence_interval_weeks;

      const futureSiblings = rows.filter(m =>
        m.recurrence_id === editing.recurrence_id && m.id !== editing.id && m.date.slice(0, 10) >= (editing.date || '').slice(0, 10)
      );
      for (const sibling of futureSiblings) {
        await update(sibling.id, contentData as Record<string, unknown>, { silent: true });
      }
      toast.success(`Saved ${futureSiblings.length + 1} meetings`);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const openNew = () => {
    const today = new Date().toISOString().slice(0, 10);
    setRepeatEnabled(false);
    setRepeatWeeks(1);
    setRepeatCount(12);
    setEditing({ ...EMPTY, date: today });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Bishopric Meeting Planning</h1>
        <button onClick={openNew} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
          + New Meeting
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">Agenda and minutes for weekly bishopric meetings.</p>

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
                  onClick={async e => { e.stopPropagation(); if (await confirm(`Delete the ${formatDate(m.date)} meeting?`)) remove(m.id); }}
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

            {!editing.id && (
              <div className="border border-gray-200 rounded-md p-3 space-y-2">
                <Checkbox label="Repeat this meeting" checked={repeatEnabled} onChange={setRepeatEnabled} />
                {repeatEnabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <Select label="Frequency" value={REPEAT_OPTIONS.find(o => o.weeks === repeatWeeks)?.label || ''}
                      onChange={v => setRepeatWeeks(REPEAT_OPTIONS.find(o => o.label === v)?.weeks || 1)}
                      options={REPEAT_OPTIONS.map(o => o.label)} />
                    <Input label="Number of occurrences" type="number" value={String(repeatCount)}
                      onChange={v => setRepeatCount(Math.max(1, parseInt(v, 10) || 1))} />
                  </div>
                )}
              </div>
            )}

            {editing.id && editing.recurrence_id && (
              <p className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                Part of a recurring series (every {editing.recurrence_interval_weeks ?? 1} week{editing.recurrence_interval_weeks === 1 ? '' : 's'}). Saving below only changes this meeting.
              </p>
            )}

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
              {editing.id && editing.recurrence_id && (
                <button type="button" disabled={saving} onClick={handleSaveToFutureSeries}
                  className="px-4 py-2 border border-blue-600 text-blue-600 rounded-md text-sm hover:bg-blue-50 disabled:opacity-50">
                  Save + apply to future meetings
                </button>
              )}
              <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
