import { useEffect, useState } from 'react';
import { api, type CalendarFeed } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useConfirm } from './ConfirmDialog';
import Modal from './Modal';
import { toast } from '../lib/toast';

const CALENDARS = ['Bishop', 'First Counselor', 'Second Counselor'];

/** "Subscribe" button + dialog for the signed-in user's private calendar feed link. */
export default function CalendarSubscribe() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState<CalendarFeed | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.calendarFeed.get().then(f => {
      setFeed(f);
      setPicked(f.token ? f.calendars : CALENDARS.filter(c => c === user?.church_role));
    }).catch(() => toast.error('Could not load your calendar link.'));
  }, [open, user?.church_role]);

  const url = feed?.token ? `${window.location.origin}/api/calendar-feed/ics/${feed.token}.ics` : '';
  const webcal = url.replace(/^https?:/, 'webcal:');

  const save = async (reset = false) => {
    setBusy(true);
    try {
      const f = await api.calendarFeed.save({ calendars: picked, reset });
      setFeed(f);
      toast.success(reset ? 'New link created — the old one no longer works' : 'Saved');
    } catch {
      toast.error('Could not save.');
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    if (!await confirm({ message: 'Turn off your calendar link? Calendars subscribed to it will stop updating.' })) return;
    await api.calendarFeed.remove();
    setFeed({ token: null, calendars: [] });
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast.success('Link copied'); } catch { toast.error('Could not copy — select the link and copy it.'); }
  };

  const changed = !!feed?.token && (picked.length !== feed.calendars.length || picked.some(c => !feed.calendars.includes(c)));

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Show these appointments in Google, Apple or Outlook Calendar"
        className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md text-sm hover:bg-gray-50 whitespace-nowrap">
        <i className="ti ti-calendar-plus mr-1" aria-hidden="true" />Subscribe
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Subscribe on your phone or computer">
        <div className="space-y-4 text-sm">
          <p className="text-gray-600">
            Get a private link that keeps your phone's calendar in sync with the hub (updates every hour or so). It includes appointments with
            their titles and notes, plus Sundays you're conducting sacrament meeting.
          </p>
          <div>
            <p className="font-medium text-gray-700 mb-1">Include these schedules</p>
            {CALENDARS.map(c => (
              <label key={c} className="flex items-center gap-2 text-gray-700 cursor-pointer select-none">
                <input type="checkbox" checked={picked.includes(c)} className="rounded border-gray-300"
                  onChange={e => setPicked(p => e.target.checked ? [...p, c] : p.filter(x => x !== c))} />
                {c}
              </label>
            ))}
          </div>

          {feed === null ? <p className="text-gray-400">Loading…</p> : !feed.token ? (
            <button type="button" disabled={busy} onClick={() => save(false)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Create my link</button>
          ) : (
            <>
              {changed && (
                <button type="button" disabled={busy} onClick={() => save(false)}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Save schedules</button>
              )}
              <div className="bg-gray-50 border border-gray-200 rounded p-2">
                <code className="text-xs break-all">{url}</code>
                <div className="flex flex-wrap gap-3 mt-2">
                  <button type="button" onClick={copy} className="text-xs font-medium text-blue-600 hover:text-blue-800">Copy link</button>
                  <a href={webcal} className="text-xs font-medium text-blue-600 hover:text-blue-800">Open in Apple / Outlook Calendar</a>
                  <a href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noreferrer"
                    className="text-xs font-medium text-blue-600 hover:text-blue-800">Add to Google Calendar</a>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Keep this link private: anyone who has it can see these appointments. If it gets shared by mistake, make a new one.
              </p>
              <div className="flex flex-wrap gap-4">
                <button type="button" disabled={busy} onClick={() => save(true)} className="text-xs text-gray-600 hover:text-gray-900 underline">Make a new link</button>
                <button type="button" onClick={turnOff} className="text-xs text-red-600 hover:text-red-800 underline">Turn off</button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
