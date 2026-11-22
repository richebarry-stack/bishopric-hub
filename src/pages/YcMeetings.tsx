import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTable } from '../lib/useTable';
import { useAuth } from '../lib/auth';
import { api, type Task, type YcMeeting, type YcDiscussionTopic, type YouthActivity } from '../lib/api';
import Modal from '../components/Modal';
import AutoTextarea from '../components/AutoTextarea';
import { Input } from '../components/FormFields';
import { useConfirm } from '../components/ConfirmDialog';
import { toast } from '../lib/toast';

const TODAY = new Date().toLocaleDateString('en-CA');
const CALENDAR_WEEKS = 6;

// The ward youth council's groups (General Handbook 29.2.6). The list is editable and
// shared via ui-settings, like the Ward Council's Discussion Topics categories.
const DEFAULT_ORGS = [
  'Priests Quorum', 'Teachers Quorum', 'Deacons Quorum',
  'Gatherers of Light', 'Messengers of Hope', 'Builders of Faith',
];
const ORGS_SETTINGS_KEY = 'yc_discussion_orgs';

// Youth Calendar columns, in the same order as the default groups.
const CALENDAR_GROUPS: { key: keyof YouthActivity; label: string }[] = [
  { key: 'priests', label: 'Priests' },
  { key: 'teachers', label: 'Teachers' },
  { key: 'deacons', label: 'Deacons' },
  { key: 'gatherers_of_light', label: 'Gatherers of Light' },
  { key: 'messengers_of_hope', label: 'Messengers of Hope' },
  { key: 'builders_of_faith', label: 'Builders of Faith' },
];

async function fetchOrgs(): Promise<string[]> {
  try {
    const res = await fetch(`/api/ui-settings/${ORGS_SETTINGS_KEY}`);
    if (!res.ok) return DEFAULT_ORGS;
    const data = await res.json() as { orgs?: string[] };
    return Array.isArray(data.orgs) && data.orgs.length ? data.orgs : DEFAULT_ORGS;
  } catch { return DEFAULT_ORGS; }
}

async function saveOrgs(orgs: string[]): Promise<void> {
  await fetch(`/api/ui-settings/${ORGS_SETTINGS_KEY}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgs }),
  });
}

function formatDate(iso: string, style: 'long' | 'short' = 'long'): string {
  if (!iso) return '';
  return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', style === 'long'
    ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
    : { weekday: 'short', month: 'short', day: 'numeric' });
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d + n).toLocaleDateString('en-CA');
}

type Field = 'status' | 'next_steps' | 'help_needed';

export default function YcMeetings() {
  const { user, isGuest, isWcReadOnly } = useAuth();
  const canEdit = !isGuest && !isWcReadOnly;
  const canManage = canEdit && (user?.role === 'admin' || user?.hub === 'both');
  const confirm = useConfirm();
  const queryClient = useQueryClient();

  const { rows: meetings, isLoading: l1, create: createMeeting, update: updateMeeting, remove: removeMeeting } = useTable<YcMeeting>('yc-meetings');
  const { rows: topics, isLoading: l2, create: createTopic, update: updateTopic } = useTable<YcDiscussionTopic>('yc-discussion-topics');
  const { rows: activities } = useTable<YouthActivity>('youth-activities');
  // Action items shared with Youth Council. A dual-access account asks for the YC view
  // explicitly, since its normal (bishopric) task list leaves those out.
  const tasksKey = ['tasks', 'yc-meeting-view'];
  const { data: allTasks = [] } = useQuery({
    queryKey: tasksKey,
    queryFn: () => api.list<Task>('tasks', user?.hub === 'both' ? { viewHub: 'yc' } : undefined),
    enabled: !isGuest,
  });
  const ycTasks = useMemo(() => allTasks.filter(t => (t.share_with || '').includes('Youth Council')), [allTasks]);

  const [orgs, setOrgs] = useState<string[]>(DEFAULT_ORGS);
  useEffect(() => { fetchOrgs().then(setOrgs); }, []);
  const [manageOpen, setManageOpen] = useState(false);
  const [newOrg, setNewOrg] = useState('');

  const upcoming = useMemo(() => meetings.filter(m => m.date.slice(0, 10) >= TODAY).sort((a, b) => a.date.localeCompare(b.date)), [meetings]);
  const past = useMemo(() => meetings.filter(m => m.date.slice(0, 10) < TODAY).sort((a, b) => b.date.localeCompare(a.date)), [meetings]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const activeDate = selectedDate ?? upcoming[0]?.date.slice(0, 10) ?? past[0]?.date.slice(0, 10) ?? null;
  const active = meetings.find(m => m.date.slice(0, 10) === activeDate) ?? null;

  // The meeting before the one being viewed — for "copy from prior" and "done since".
  const prior = useMemo(() => activeDate
    ? [...meetings].filter(m => m.date.slice(0, 10) < activeDate).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
    : null, [meetings, activeDate]);

  const activeTopics = useMemo(() => topics.filter(t => t.meeting_date.slice(0, 10) === activeDate), [topics, activeDate]);
  const priorTopics = useMemo(() => prior ? topics.filter(t => t.meeting_date.slice(0, 10) === prior.date.slice(0, 10)) : [], [topics, prior]);

  const [editing, setEditing] = useState<Partial<YcMeeting> | null>(null);
  const [copying, setCopying] = useState(false);

  const saveTopic = useCallback(async (org: string, field: Field, value: string) => {
    if (!activeDate) return;
    const row = activeTopics.find(t => t.organization === org);
    if (row) await updateTopic(row.id, { [field]: value }, { silent: true });
    else await createTopic({ meeting_date: activeDate, organization: org, status: '', next_steps: '', help_needed: '', [field]: value }, { silent: true });
  }, [activeDate, activeTopics, createTopic, updateTopic]);

  const copyFromPrior = async () => {
    if (!activeDate || !prior) return;
    const hasContent = activeTopics.some(t => t.status || t.next_steps || t.help_needed) || !!active?.agenda?.trim();
    if (hasContent && !await confirm({ message: 'This replaces what is already filled in for this meeting. Continue?', destructive: false, confirmLabel: 'Replace' })) return;
    setCopying(true);
    try {
      if (active && prior.agenda?.trim()) await updateMeeting(active.id, { agenda: prior.agenda }, { silent: true });
      for (const org of orgs) {
        const prev = priorTopics.find(t => t.organization === org);
        if (!prev) continue;
        const payload = { status: prev.status || '', next_steps: prev.next_steps || '', help_needed: prev.help_needed || '' };
        const cur = activeTopics.find(t => t.organization === org);
        if (cur) await updateTopic(cur.id, payload, { silent: true });
        else await createTopic({ meeting_date: activeDate, organization: org, ...payload }, { silent: true });
      }
      toast.success('Copied from the prior meeting');
    } finally {
      setCopying(false);
    }
  };

  const handleSaveMeeting = async () => {
    if (!editing?.date) return;
    const data = { date: editing.date, agenda: editing.agenda || '', notes: editing.notes || '' };
    if (editing.id) await updateMeeting(editing.id, data);
    else {
      await createMeeting(data);
      setSelectedDate(editing.date.slice(0, 10));
    }
    setEditing(null);
  };

  const deleteMeeting = async () => {
    if (!active) return;
    if (!await confirm({ message: `Delete the ${formatDate(active.date)} meeting?` })) return;
    await removeMeeting(active.id);
    setSelectedDate(null);
  };

  const toggleTask = async (t: Task) => {
    await api.update('tasks', t.id, { done: t.done ? 0 : 1, _base_updated_at: t.updated_at ?? null });
    queryClient.invalidateQueries({ queryKey: tasksKey });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const calendar = useMemo(() => {
    if (!activeDate) return [];
    // Never show past activities: start today, and run six weeks past the meeting
    // (or past today, when looking back at an earlier meeting).
    const end = addDays(activeDate > TODAY ? activeDate : TODAY, CALENDAR_WEEKS * 7);
    return activities
      .filter(a => a.date.slice(0, 10) >= TODAY && a.date.slice(0, 10) <= end)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(a => ({
        id: a.id, date: a.date.slice(0, 10), notes: a.notes,
        items: CALENDAR_GROUPS.map(g => ({ label: g.label, text: String(a[g.key] || '').trim() })).filter(i => i.text),
      }))
      .filter(a => a.items.length > 0 || a.notes?.trim());
  }, [activities, activeDate]);

  const openTasks = useMemo(() => ycTasks.filter(t => !t.done)
    .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999')), [ycTasks]);
  const doneSince = useMemo(() => {
    const since = prior?.date.slice(0, 10);
    return ycTasks.filter(t => t.done && (!since || (t.updated_at || '').slice(0, 10) >= since));
  }, [ycTasks, prior]);

  const isLoading = l1 || l2;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Youth Council Meetings</h1>
        <div className="flex items-center gap-2">
          {canManage && (
            <button type="button" onClick={() => setManageOpen(o => !o)}
              className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">⚙ Manage groups</button>
          )}
          {canEdit && (
            <button onClick={() => setEditing({ date: '', agenda: '', notes: '' })}
              className="bg-amber-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-amber-700">+ Add Meeting</button>
          )}
        </div>
      </div>
      <p className="text-sm text-gray-500 -mt-3">
        The ward youth council: the bishopric with the quorum and class presidencies, usually monthly (General Handbook 29.2.6). Each group
        reports its status, next steps and help needed; upcoming activities and the council's action items are pulled in below.
      </p>

      {manageOpen && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
          {orgs.map(org => (
            <div key={org} className="flex items-center gap-2">
              <input defaultValue={org} className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
                onBlur={e => {
                  const name = e.target.value.trim();
                  if (!name || name === org || orgs.includes(name)) return;
                  const next = orgs.map(o => o === org ? name : o);
                  setOrgs(next); saveOrgs(next);
                }} />
              <button type="button" onClick={() => { const next = orgs.filter(o => o !== org); setOrgs(next); saveOrgs(next); }}
                className="text-red-400 hover:text-red-600 text-xs">Remove</button>
            </div>
          ))}
          <form className="flex items-center gap-2 pt-2 border-t border-gray-100"
            onSubmit={e => {
              e.preventDefault();
              const name = newOrg.trim();
              if (!name || orgs.includes(name)) return;
              const next = [...orgs, name];
              setOrgs(next); saveOrgs(next); setNewOrg('');
            }}>
            <input value={newOrg} onChange={e => setNewOrg(e.target.value)} placeholder="New group name…"
              className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm" />
            <button type="submit" className="px-3 py-1 bg-amber-600 text-white rounded-md text-xs font-medium hover:bg-amber-700">Add</button>
          </form>
        </div>
      )}

      {isLoading ? <p className="text-gray-400 text-sm">Loading…</p> : !active ? (
        <div className="text-center py-12 text-gray-400">
          <p>No youth council meetings yet.</p>
          {canEdit && <p className="text-sm mt-1">Use "+ Add Meeting" to schedule one.</p>}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm font-medium text-gray-700">Meeting:</label>
            <select value={activeDate ?? ''} onChange={e => setSelectedDate(e.target.value || null)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm">
              {upcoming.map((m, i) => (
                <option key={m.id} value={m.date.slice(0, 10)}>{formatDate(m.date)}{i === 0 ? ' (next)' : ''}</option>
              ))}
              {past.length > 0 && <option disabled>── Past meetings ──</option>}
              {past.map(m => <option key={m.id} value={m.date.slice(0, 10)}>{formatDate(m.date)}</option>)}
            </select>
            {canEdit && (
              <>
                {prior && (
                  <button type="button" onClick={copyFromPrior} disabled={copying}
                    className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded hover:bg-amber-100 disabled:opacity-50">
                    {copying ? 'Copying…' : 'Copy from prior meeting'}
                  </button>
                )}
                <button type="button" onClick={() => setEditing(active)} className="text-xs text-gray-500 hover:text-gray-800">Change date</button>
                <button type="button" onClick={deleteMeeting} className="text-xs text-red-400 hover:text-red-600">Delete meeting</button>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-600 mb-2">Agenda</h2>
              <AutoTextarea value={active.agenda || ''} readOnly={!canEdit} minRows={6} placeholder="Opening prayer, spiritual thought, topics…"
                onSave={v => updateMeeting(active.id, { agenda: v }, { silent: true })} />
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-600 mb-2">Notes</h2>
              <AutoTextarea value={active.notes || ''} readOnly={!canEdit} minRows={6} placeholder="Decisions and follow-up from the meeting…"
                onSave={v => updateMeeting(active.id, { notes: v }, { silent: true })} />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 720, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 160 }} /><col /><col /><col />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-2 font-semibold text-gray-600">Group</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Next Steps</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Help Needed</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org, i) => {
                  const row = activeTopics.find(t => t.organization === org);
                  return (
                    <tr key={org} className={`border-b border-gray-100 ${i % 2 ? 'bg-gray-50/50' : ''}`}>
                      <td className="px-4 py-2 font-medium text-gray-800 align-top">{org}</td>
                      {(['status', 'next_steps', 'help_needed'] as const).map(f => (
                        <td key={f} className="px-2 py-1 align-top">
                          <AutoTextarea value={row?.[f] || ''} readOnly={!canEdit}
                            placeholder={{ status: 'Status…', next_steps: 'Next steps…', help_needed: 'Help needed…' }[f]}
                            onSave={v => saveTopic(org, f, v)} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-gray-600">Upcoming on the Youth Calendar</h2>
                <Link to="/youth-activities" className="text-xs text-amber-700 hover:underline">Open calendar</Link>
              </div>
              {calendar.length === 0 ? <p className="text-sm text-gray-400">Nothing on the Youth Calendar yet.</p> : (
                <ul className="space-y-2">
                  {calendar.map(a => (
                    <li key={a.id} className="text-sm">
                      <p className="font-medium text-gray-800">{formatDate(a.date, 'short')}</p>
                      {a.items.map(i => <p key={i.label} className="text-gray-600"><span className="text-gray-400">{i.label}:</span> {i.text}</p>)}
                      {a.notes?.trim() && <p className="text-gray-500 text-xs">{a.notes}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-gray-600">Action Items</h2>
                {!isWcReadOnly && <Link to="/tasks" className="text-xs text-amber-700 hover:underline">Add or edit</Link>}
              </div>
              <p className="text-xs text-gray-400 mb-2">Action items shared with Youth Council.</p>
              {openTasks.length === 0 ? <p className="text-sm text-gray-400">No open action items.</p> : (
                <ul className="space-y-1.5">
                  {openTasks.map(t => (
                    <li key={t.id} className="flex items-start gap-2 text-sm">
                      <input type="checkbox" checked={false} disabled={!canEdit} onChange={() => toggleTask(t)} className="mt-0.5 rounded border-gray-300" />
                      <span className="text-gray-800">
                        {t.task}
                        <span className="text-gray-400">{t.assigned_to ? ` — ${t.assigned_to}` : ''}{t.due_date ? ` · due ${t.due_date.slice(0, 10)}` : ''}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {doneSince.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-1">Done{prior ? ` since ${formatDate(prior.date, 'short')}` : ''}</p>
                  <ul className="space-y-1">
                    {doneSince.map(t => (
                      <li key={t.id} className="flex items-start gap-2 text-sm">
                        <input type="checkbox" checked disabled={!canEdit} onChange={() => toggleTask(t)} className="mt-0.5 rounded border-gray-300" />
                        <span className="text-gray-400 line-through">{t.task}{t.assigned_to ? ` — ${t.assigned_to}` : ''}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Change Meeting Date' : 'Add YC Meeting'}>
        {editing && (
          <form onSubmit={e => { e.preventDefault(); handleSaveMeeting(); }} className="space-y-3">
            <Input label="Date" value={(editing.date || '').slice(0, 10)} onChange={v => setEditing({ ...editing, date: v })} type="date" required />
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
