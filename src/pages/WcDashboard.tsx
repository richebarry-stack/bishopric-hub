import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTable } from '../lib/useTable';
import { useAuth } from '../lib/auth';
import type { WcMeeting, MemberNeed, MissionaryPipeline, Task, CalendarEvent } from '../lib/api';
import {
  type WcDashboardConfig, type FontSize,
  WC_DEFAULT_CONFIG, FONT_SIZE_LABELS, FONT_SIZE_CLASS,
  loadWcDashboardConfig, saveWcDashboardConfig,
} from '../lib/wcDashboardConfig';

const TODAY = new Date().toISOString().slice(0, 10);
const ACTIVE_MISSIONARY_STATUSES = new Set(['1-Considering', '2-Papers Started', '3-Papers Submitted', '4-Call Accepted']);
const FONT_SIZES: FontSize[] = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl'];

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function SectionTitle({ children, link }: { children: React.ReactNode; link?: string }) {
  return (
    <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-gray-200">
      <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">{children}</h2>
      {link && <Link to={link} className="text-xs text-emerald-500 hover:text-emerald-700">↗</Link>}
    </div>
  );
}

function FontSizePicker({ value, onChange }: { value: FontSize; onChange: (v: FontSize) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {FONT_SIZES.map(s => (
        <button key={s} type="button" onClick={() => onChange(s)}
          className={`px-2 py-0.5 rounded text-xs border transition-colors ${value === s
            ? 'bg-emerald-600 text-white border-emerald-600'
            : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
          {FONT_SIZE_LABELS[s]}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-emerald-600' : 'bg-gray-200'}`}>
      <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  );
}

function SubToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="rounded border-gray-300 text-emerald-600" />
      <span className="text-xs text-gray-600">{label}</span>
    </label>
  );
}

function SettingsSection({ title, visible, onVisibleChange, fontSize, onFontSizeChange, children }: {
  title: string; visible: boolean; onVisibleChange: (v: boolean) => void;
  fontSize: FontSize; onFontSizeChange: (v: FontSize) => void; children?: React.ReactNode;
}) {
  return (
    <div className={`border rounded-lg p-3 space-y-2.5 ${visible ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
      <div className="flex items-center gap-3">
        <Toggle checked={visible} onChange={onVisibleChange} />
        <span className="text-sm font-medium text-gray-700">{title}</span>
      </div>
      {visible && (
        <>
          <div className="flex items-center gap-3 pl-1">
            <span className="text-xs text-gray-400 w-14 shrink-0">Font size</span>
            <FontSizePicker value={fontSize} onChange={onFontSizeChange} />
          </div>
          {children && <div className="pl-1 space-y-1.5">{children}</div>}
        </>
      )}
    </div>
  );
}

function SettingsModal({ config, onSave, onClose }: {
  config: WcDashboardConfig; onSave: (c: WcDashboardConfig) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<WcDashboardConfig>(config);
  const upd = <K extends keyof WcDashboardConfig>(key: K, patch: Partial<WcDashboardConfig[K]>) =>
    setDraft(d => ({ ...d, [key]: { ...d[key], ...patch } }));
  const handleSave = () => { saveWcDashboardConfig(draft); onSave(draft); onClose(); };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-8">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-bold text-gray-900">Dashboard Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Top panels</p>
          <SettingsSection title="WC Meeting" visible={draft.meeting.visible} onVisibleChange={v => upd('meeting', { visible: v })}
            fontSize={draft.meeting.fontSize} onFontSizeChange={v => upd('meeting', { fontSize: v })}>
            <SubToggle label="Date" checked={draft.meeting.showDate} onChange={v => upd('meeting', { showDate: v })} />
            <SubToggle label="Spiritual Thought" checked={draft.meeting.showSpiritualThought} onChange={v => upd('meeting', { showSpiritualThought: v })} />
            <SubToggle label="Opening Prayer" checked={draft.meeting.showOpeningPrayer} onChange={v => upd('meeting', { showOpeningPrayer: v })} />
            <SubToggle label="Closing Prayer" checked={draft.meeting.showClosingPrayer} onChange={v => upd('meeting', { showClosingPrayer: v })} />
          </SettingsSection>
          <SettingsSection title="Member Needs" visible={draft.memberNeeds.visible} onVisibleChange={v => upd('memberNeeds', { visible: v })}
            fontSize={draft.memberNeeds.fontSize} onFontSizeChange={v => upd('memberNeeds', { fontSize: v })} />
          <SettingsSection title="Missionaries" visible={draft.missionaries.visible} onVisibleChange={v => upd('missionaries', { visible: v })}
            fontSize={draft.missionaries.fontSize} onFontSizeChange={v => upd('missionaries', { fontSize: v })}>
            <SubToggle label="Show status / mission" checked={draft.missionaries.showStatus} onChange={v => upd('missionaries', { showStatus: v })} />
          </SettingsSection>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-1">Bottom panels</p>
          <SettingsSection title="Action Items" visible={draft.actionItems.visible} onVisibleChange={v => upd('actionItems', { visible: v })}
            fontSize={draft.actionItems.fontSize} onFontSizeChange={v => upd('actionItems', { fontSize: v })}>
            <SubToggle label="Show assigned to" checked={draft.actionItems.showAssignedTo} onChange={v => upd('actionItems', { showAssignedTo: v })} />
          </SettingsSection>
          <SettingsSection title="Upcoming Events" visible={draft.events.visible} onVisibleChange={v => upd('events', { visible: v })}
            fontSize={draft.events.fontSize} onFontSizeChange={v => upd('events', { fontSize: v })}>
            <SubToggle label="Show date" checked={draft.events.showDate} onChange={v => upd('events', { showDate: v })} />
          </SettingsSection>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <button onClick={() => setDraft(WC_DEFAULT_CONFIG)} type="button" className="text-sm text-gray-400 hover:text-gray-700">Reset to defaults</button>
          <div className="flex gap-2">
            <button onClick={onClose} type="button" className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} type="button" className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WcDashboard() {
  const { user, selectedHub } = useAuth();
  const [config, setConfig] = useState<WcDashboardConfig>(loadWcDashboardConfig);
  const [showSettings, setShowSettings] = useState(false);

  const isWcContext = user?.hub === 'wc' || (user?.hub === 'both' && selectedHub === 'wc');
  const { rows: meetings } = useTable<WcMeeting>('wc-meetings');
  const { rows: allNeeds, create: createNeed, update: updateNeed } = useTable<MemberNeed>('member-needs');
  const { rows: missionaries } = useTable<MissionaryPipeline>('missionary-pipeline');
  const { rows: tasks } = useTable<Task>('tasks');
  const { rows: events } = useTable<CalendarEvent>('calendaring');

  const nextMeeting = useMemo(() =>
    meetings.filter(m => m.date.slice(0, 10) >= TODAY).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null,
    [meetings]);

  const activeMissionaries = useMemo(() =>
    missionaries.filter(m => ACTIVE_MISSIONARY_STATUSES.has(m.status)), [missionaries]);

  const pendingTasks = useMemo(() => {
    const undone = tasks.filter(t => !t.done);
    // hub='both' users in WC context: only show WC-tagged tasks (hub='wc' is filtered by backend)
    if (user?.hub === 'both' && selectedHub === 'wc') {
      return undone.filter(t => t.share_with?.split(',').map(v => v.trim()).includes('Ward Council'));
    }
    return undone;
  }, [tasks, user, selectedHub]);

  // member needs: filter to shared_with_wc=1 for hub='both' in WC context (hub='wc' backend filters already)
  const memberNeeds = useMemo(() =>
    (isWcContext && user?.hub === 'both') ? allNeeds.filter(n => n.shared_with_wc) : allNeeds,
    [allNeeds, isWcContext, user]);

  const prayerNeeds = useMemo(() => memberNeeds.filter(n => n.pray_for), [memberNeeds]);

  const [newNeed, setNewNeed] = useState('');

  const handleAddNeed = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newNeed.trim();
    if (!name) return;
    await createNeed({ who: name, what: '', type: 'Support', notes: '', share_with: '', next_steps: '', pray_for: 1, shared_with_wc: 1 });
    setNewNeed('');
  };

  const removePrayer = (id: number) => updateNeed(id, { pray_for: 0 });

  const upcomingEvents = useMemo(() =>
    events.filter(e => e.dates && e.dates.slice(0, 10) >= TODAY)
      .sort((a, b) => a.dates.localeCompare(b.dates)).slice(0, 10),
    [events]);

  const cfg = config;
  const topCount = [cfg.meeting.visible, cfg.memberNeeds.visible, cfg.missionaries.visible].filter(Boolean).length;
  const bottomCount = [cfg.actionItems.visible, cfg.events.visible].filter(Boolean).length;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 7rem)' }}>
      {showSettings && <SettingsModal config={config} onSave={setConfig} onClose={() => setShowSettings(false)} />}

      <div className="flex items-center justify-between mb-3">
        <span />
        <button onClick={() => setShowSettings(true)}
          className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">
          ⚙ Customize
        </button>
      </div>

      {topCount > 0 && (
        <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: `repeat(${topCount}, 1fr)` }}>

          {cfg.meeting.visible && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
              <SectionTitle link="/wc-meetings">WC Meeting</SectionTitle>
              {nextMeeting ? (
                <div className="space-y-4">
                  {cfg.meeting.showDate && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Date</p>
                      <p className={`${FONT_SIZE_CLASS[cfg.meeting.fontSize]} font-bold text-gray-900`}>
                        {new Date(nextMeeting.date.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  )}
                  {cfg.meeting.showSpiritualThought && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Spiritual Thought</p>
                      <p className={`${FONT_SIZE_CLASS[cfg.meeting.fontSize]} font-bold text-gray-900`}>
                        {nextMeeting.spiritual_thought || <span className="text-gray-300 font-normal">—</span>}
                      </p>
                    </div>
                  )}
                  {cfg.meeting.showOpeningPrayer && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Opening Prayer</p>
                      <p className={`${FONT_SIZE_CLASS[cfg.meeting.fontSize]} font-bold text-gray-900`}>
                        {nextMeeting.opening_prayer || <span className="text-gray-300 font-normal">—</span>}
                      </p>
                    </div>
                  )}
                  {cfg.meeting.showClosingPrayer && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Closing Prayer</p>
                      <p className={`${FONT_SIZE_CLASS[cfg.meeting.fontSize]} font-bold text-gray-900`}>
                        {nextMeeting.closing_prayer || <span className="text-gray-300 font-normal">—</span>}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center py-6">
                  <p className="text-gray-300 text-lg">No upcoming meetings</p>
                </div>
              )}
            </div>
          )}

          {cfg.memberNeeds.visible && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
              <SectionTitle link="/wc-family-needs">Member Needs</SectionTitle>
              <div className="flex flex-col">
                <div className="space-y-1.5">
                  {prayerNeeds.length === 0 && <p className="text-gray-300 text-lg italic">None</p>}
                  {prayerNeeds.map(n => (
                    <div key={n.id} className="flex items-center gap-2">
                      <button onClick={() => removePrayer(n.id)}
                        className="text-xl leading-none flex-shrink-0 opacity-100 hover:opacity-40 transition-opacity"
                        title="Remove from prayer list">🙏</button>
                      <span className={`${FONT_SIZE_CLASS[cfg.memberNeeds.fontSize]} font-medium text-gray-800 leading-tight`}>{n.who}</span>
                      {n.what && <span className="text-xs text-gray-400 truncate">{n.what}</span>}
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAddNeed} className="flex gap-2 pt-3 mt-3 border-t border-gray-100 flex-shrink-0">
                  <input value={newNeed} onChange={e => setNewNeed(e.target.value)} placeholder="Add name…"
                    className="flex-1 min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex-shrink-0">Add</button>
                </form>
              </div>
            </div>
          )}

          {cfg.missionaries.visible && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
              <SectionTitle link="/missionary-pipeline">Missionaries</SectionTitle>
              <div className="space-y-2">
                {activeMissionaries.length === 0 && <p className="text-gray-300 italic">None</p>}
                {activeMissionaries.map(m => (
                  <div key={m.id}>
                    <p className={`${FONT_SIZE_CLASS[cfg.missionaries.fontSize]} font-medium text-gray-800 leading-tight`}>{m.who}</p>
                    {cfg.missionaries.showStatus && (
                      <p className="text-sm text-gray-400">{m.status.replace(/^\d+-/, '')}{m.mission_call ? ` — ${m.mission_call}` : ''}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {bottomCount > 0 && (
        <div className="grid gap-4 min-h-0 flex-1" style={{ gridTemplateColumns: `repeat(${bottomCount}, 1fr)` }}>

          {cfg.actionItems.visible && (
            <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 flex-shrink-0">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Action Items ({pendingTasks.length})</span>
                <Link to="/tasks" className="text-xs text-emerald-500 hover:text-emerald-700">↗</Link>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
                {pendingTasks.length === 0
                  ? <p className="text-xs text-gray-400 py-2">All done!</p>
                  : pendingTasks.map(t => (
                    <div key={t.id} className="flex items-baseline justify-between py-1 gap-2">
                      <span className={`${FONT_SIZE_CLASS[cfg.actionItems.fontSize]} text-gray-800 truncate`}>{t.task}</span>
                      {cfg.actionItems.showAssignedTo && t.assigned_to && (
                        <span className="text-xs text-gray-400 whitespace-nowrap">{t.assigned_to}</span>
                      )}
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {cfg.events.visible && (
            <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 flex-shrink-0">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Upcoming Events</span>
                <Link to="/calendaring" className="text-xs text-emerald-500 hover:text-emerald-700">↗</Link>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
                {upcomingEvents.length === 0
                  ? <p className="text-xs text-gray-400 py-2">None</p>
                  : upcomingEvents.map(e => (
                    <div key={e.id} className="flex items-baseline justify-between py-1 gap-2">
                      <span className={`${FONT_SIZE_CLASS[cfg.events.fontSize]} text-gray-800 truncate`}>{e.name}</span>
                      {cfg.events.showDate && (
                        <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(e.dates)}</span>
                      )}
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
