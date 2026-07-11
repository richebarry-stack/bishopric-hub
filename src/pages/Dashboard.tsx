import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTable } from '../lib/useTable';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import type { CallingPipeline, CalendarEvent, Task, MemberNeed, MissionaryPipeline, BishopricMeeting, AnnualDuty, Baby } from '../lib/api';
import StatusBadge from '../components/StatusBadge';
import { CALLING_STATUS_COLORS } from '../lib/constants';
import { renderRichText } from '../lib/richText';
import {
  type DashboardConfig, type FontSize,
  DEFAULT_CONFIG, FONT_SIZE_LABELS, FONT_SIZE_CLASS,
  loadDashboardConfig, saveDashboardConfig,
} from '../lib/dashboardConfig';
import { inDutyWindow, useTimeZoneNow } from '../lib/annualDuties';
import { NAV_ITEMS, LAST_VISITED_KEY } from '../components/Layout';
import { responsiveGridCols } from '../lib/gridCols';

const TODAY = new Date().toISOString().slice(0, 10);
const ACTION_STATUSES = new Set(['3. Approved and assigned', '7. Need to release']);
const ACTIVE_MISSIONARY_STATUSES = new Set(['1-Considering', '2-Papers Started', '3-Papers Submitted', '4-Call Accepted']);
const FONT_SIZES: FontSize[] = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl'];

function formatEventDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function SectionTitle({ children, link }: { children: React.ReactNode; link?: string }) {
  return (
    <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-gray-200">
      <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">{children}</h2>
      {link && <Link to={link} className="text-xs text-blue-400 hover:text-blue-600">↗</Link>}
    </div>
  );
}

// Defined outside Dashboard so it's a stable component identity — prevents input focus loss on re-render
function NeedList({ items, onToggle, newValue, onChangeNew, onAdd, placeholder, fontSize }: {
  items: MemberNeed[];
  onToggle: (id: number) => void;
  newValue: string;
  onChangeNew: (v: string) => void;
  onAdd: (e: React.FormEvent) => void;
  placeholder: string;
  fontSize: FontSize;
}) {
  return (
    <div className="flex flex-col">
      <div className="space-y-1.5">
        {items.length === 0 && <p className="text-gray-300 text-lg italic">None</p>}
        {items.map(n => (
          <div key={n.id} className="flex items-center gap-2">
            <button
              onClick={() => onToggle(n.id)}
              className="text-xl leading-none flex-shrink-0 opacity-100 hover:opacity-40 transition-opacity"
              title="Remove from prayer list"
            >🙏</button>
            <span className={`${FONT_SIZE_CLASS[fontSize]} font-medium text-gray-800 leading-tight`}>{n.who}</span>
          </div>
        ))}
      </div>
      <form onSubmit={onAdd} className="flex gap-2 pt-3 mt-3 border-t border-gray-100 flex-shrink-0">
        <input
          value={newValue}
          onChange={e => onChangeNew(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex-shrink-0">Add</button>
      </form>
    </div>
  );
}

// ─── Settings components (module-level to avoid remount) ──────────────────────

function FontSizePicker({ value, onChange }: { value: FontSize; onChange: (v: FontSize) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {FONT_SIZES.map(s => (
        <button key={s} type="button" onClick={() => onChange(s)}
          className={`px-2 py-0.5 rounded text-xs border transition-colors ${value === s
            ? 'bg-blue-600 text-white border-blue-600'
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
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}>
      <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  );
}

function SubToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="rounded border-gray-300 text-blue-600" />
      <span className="text-xs text-gray-600">{label}</span>
    </label>
  );
}

function SettingsSection({ title, visible, onVisibleChange, fontSize, onFontSizeChange, children }: {
  title: string;
  visible: boolean;
  onVisibleChange: (v: boolean) => void;
  fontSize: FontSize;
  onFontSizeChange: (v: FontSize) => void;
  children?: React.ReactNode;
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

function DashboardSettingsModal({ config, onSave, onClose }: {
  config: DashboardConfig;
  onSave: (c: DashboardConfig) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<DashboardConfig>(config);

  const upd = <K extends keyof DashboardConfig>(key: K, patch: Partial<DashboardConfig[K]>) =>
    setDraft(d => ({ ...d, [key]: { ...d[key], ...patch } }));

  const handleSave = () => { saveDashboardConfig(draft); onSave(draft); onClose(); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-8">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="font-bold text-gray-900">Dashboard Settings</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Top panels</p>

          <SettingsSection title="Bishopric Meeting"
            visible={draft.bishopricMeeting.visible} onVisibleChange={v => upd('bishopricMeeting', { visible: v })}
            fontSize={draft.bishopricMeeting.fontSize} onFontSizeChange={v => upd('bishopricMeeting', { fontSize: v })}>
            <SubToggle label="Date" checked={draft.bishopricMeeting.showDate}
              onChange={v => upd('bishopricMeeting', { showDate: v })} />
            <SubToggle label="Spiritual Thought" checked={draft.bishopricMeeting.showSpiritualThought}
              onChange={v => upd('bishopricMeeting', { showSpiritualThought: v })} />
            <SubToggle label="Opening Prayer" checked={draft.bishopricMeeting.showOpeningPrayer}
              onChange={v => upd('bishopricMeeting', { showOpeningPrayer: v })} />
            <SubToggle label="Handbook Topic" checked={draft.bishopricMeeting.showHandbookTopic}
              onChange={v => upd('bishopricMeeting', { showHandbookTopic: v })} />
            <SubToggle label="Closing Prayer" checked={draft.bishopricMeeting.showClosingPrayer}
              onChange={v => upd('bishopricMeeting', { showClosingPrayer: v })} />
          </SettingsSection>

          <SettingsSection title="Health Needs"
            visible={draft.healthNeeds.visible} onVisibleChange={v => upd('healthNeeds', { visible: v })}
            fontSize={draft.healthNeeds.fontSize} onFontSizeChange={v => upd('healthNeeds', { fontSize: v })} />

          <SettingsSection title="Needs Support"
            visible={draft.supportNeeds.visible} onVisibleChange={v => upd('supportNeeds', { visible: v })}
            fontSize={draft.supportNeeds.fontSize} onFontSizeChange={v => upd('supportNeeds', { fontSize: v })} />

          <SettingsSection title="Missionaries"
            visible={draft.missionaries.visible} onVisibleChange={v => upd('missionaries', { visible: v })}
            fontSize={draft.missionaries.fontSize} onFontSizeChange={v => upd('missionaries', { fontSize: v })}>
            <SubToggle label="Show status / mission" checked={draft.missionaries.showStatus}
              onChange={v => upd('missionaries', { showStatus: v })} />
          </SettingsSection>

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-1">Bottom panels</p>

          <SettingsSection title="Action Items"
            visible={draft.tasks.visible} onVisibleChange={v => upd('tasks', { visible: v })}
            fontSize={draft.tasks.fontSize} onFontSizeChange={v => upd('tasks', { fontSize: v })}>
            <SubToggle label="Show assigned to" checked={draft.tasks.showAssignedTo}
              onChange={v => upd('tasks', { showAssignedTo: v })} />
          </SettingsSection>

          <SettingsSection title="Callings Needing Action"
            visible={draft.callings.visible} onVisibleChange={v => upd('callings', { visible: v })}
            fontSize={draft.callings.fontSize} onFontSizeChange={v => upd('callings', { fontSize: v })}>
            <SubToggle label="Show status badge" checked={draft.callings.showStatusBadge}
              onChange={v => upd('callings', { showStatusBadge: v })} />
          </SettingsSection>

          <SettingsSection title="Upcoming Events"
            visible={draft.events.visible} onVisibleChange={v => upd('events', { visible: v })}
            fontSize={draft.events.fontSize} onFontSizeChange={v => upd('events', { fontSize: v })}>
            <SubToggle label="Show date" checked={draft.events.showDate}
              onChange={v => upd('events', { showDate: v })} />
          </SettingsSection>

          <SettingsSection title="Annual Duties Due"
            visible={draft.annualDuties.visible} onVisibleChange={v => upd('annualDuties', { visible: v })}
            fontSize={draft.annualDuties.fontSize} onFontSizeChange={v => upd('annualDuties', { fontSize: v })} />
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t">
          <button onClick={() => setDraft(DEFAULT_CONFIG)} type="button"
            className="text-sm text-gray-400 hover:text-gray-700">Reset to defaults</button>
          <div className="flex gap-2">
            <button onClick={onClose} type="button"
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} type="button"
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const [config, setConfig] = useState<DashboardConfig>(loadDashboardConfig);
  const [showSettings, setShowSettings] = useState(false);

  const { rows: callings } = useTable<CallingPipeline>('calling-pipeline');
  const { rows: events } = useTable<CalendarEvent>('calendaring');
  const { rows: tasks } = useTable<Task>('tasks');
  const { rows: needs, create: createNeed, update: updateNeed } = useTable<MemberNeed>('member-needs');
  const { rows: missionaries } = useTable<MissionaryPipeline>('missionary-pipeline');
  const { rows: meetings } = useTable<BishopricMeeting>('bishopric-meetings');
  const { rows: annualDuties } = useTable<AnnualDuty>('annual-duties');
  const { rows: babies } = useTable<Baby>('babies');
  const { data: tzData } = useQuery({ queryKey: ['app-timezone'], queryFn: () => api.appTimezone.get() });
  const { month: currentMonth, year: currentYear } = useTimeZoneNow(tzData?.timeZone || 'America/Denver');

  const [newHealth, setNewHealth] = useState('');
  const [newSupport, setNewSupport] = useState('');
  const [pendingRegCount, setPendingRegCount] = useState(0);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    fetch('/api/registration-requests').then(r => r.ok ? r.json() : []).then((rows: unknown[]) => setPendingRegCount(rows.length)).catch(() => {});
  }, [user?.role]);

  const nextMeeting = useMemo(() =>
    meetings.filter(m => !m.no_meeting && m.date.slice(0, 10) >= TODAY)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null,
    [meetings]);

  const healthNeeds = useMemo(() => needs.filter(n => n.type === 'Health' && n.pray_for), [needs]);
  const supportNeeds = useMemo(() => needs.filter(n => n.type === 'Support' && n.pray_for), [needs]);
  const activeMissionaries = useMemo(() => missionaries.filter(m => ACTIVE_MISSIONARY_STATUSES.has(m.status)), [missionaries]);
  const actionCallings = useMemo(() => callings.filter(c => ACTION_STATUSES.has(c.status)), [callings]);
  const pendingTasks = useMemo(() => tasks.filter(t => !t.done), [tasks]);
  const upcomingEvents = useMemo(() => {
    const babyCutoff = new Date(); babyCutoff.setDate(babyCutoff.getDate() - 30);
    const babyCutoffStr = babyCutoff.toISOString().slice(0, 10);
    const items = [
      ...events.filter(e => e.dates && e.dates.slice(0, 10) >= TODAY)
        .map(e => ({ id: `event-${e.id}`, name: e.name, dates: e.dates })),
      ...babies.filter(b => b.status === 'Expecting' && b.due_birth_date && b.due_birth_date.slice(0, 10) >= babyCutoffStr)
        .map(b => ({ id: `baby-${b.id}`, name: `Baby expected — ${b.name}`, dates: b.due_birth_date })),
    ];
    return items.sort((a, b) => a.dates.localeCompare(b.dates)).slice(0, 10);
  }, [events, babies]);
  const dutiesDue = useMemo(() =>
    annualDuties.filter(d => d.last_completed_year !== currentYear && inDutyWindow(currentMonth, d.month_start, d.month_end)),
    [annualDuties, currentMonth, currentYear]);

  const removePrayer = (id: number) => updateNeed(id, { pray_for: 0 });

  const addNeed = async (type: 'Health' | 'Support', who: string) => {
    const name = who.trim();
    if (!name) return;
    await createNeed({ who: name, type, what: '', notes: '', share_with: '', next_steps: '', pray_for: 1 });
  };

  const handleAddHealth = async (e: React.FormEvent) => {
    e.preventDefault(); await addNeed('Health', newHealth); setNewHealth('');
  };
  const handleAddSupport = async (e: React.FormEvent) => {
    e.preventDefault(); await addNeed('Support', newSupport); setNewSupport('');
  };

  const cfg = config;
  const topCount = [cfg.bishopricMeeting.visible, cfg.healthNeeds.visible, cfg.supportNeeds.visible, cfg.missionaries.visible].filter(Boolean).length;
  const bottomCount = [cfg.tasks.visible, cfg.callings.visible, cfg.events.visible, cfg.annualDuties.visible].filter(Boolean).length;

  const lastVisited = useMemo(() => {
    const path = localStorage.getItem(LAST_VISITED_KEY);
    if (!path) return null;
    const item = NAV_ITEMS.find(n => n.path === path);
    return item ? { path: item.path, label: item.label } : null;
  }, []);

  return (
    <div className="flex flex-col lg:h-[calc(100vh-7rem)]">

      {showSettings && (
        <DashboardSettingsModal config={config} onSave={setConfig} onClose={() => setShowSettings(false)} />
      )}

      <div className="flex items-center justify-between mb-3">
        {lastVisited ? (
          <Link to={lastVisited.path} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
            ← {lastVisited.label}
          </Link>
        ) : <span />}
        {user?.role === 'admin' && (
          <button onClick={() => setShowSettings(true)}
            className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">
            ⚙ Customize
          </button>
        )}
      </div>

      {user?.role === 'admin' && pendingRegCount > 0 && (
        <Link to="/users"
          className="flex items-center gap-2 mb-3 px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800 hover:bg-amber-100 transition-colors">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold flex-shrink-0">{pendingRegCount}</span>
          <span>
            {pendingRegCount === 1 ? '1 access request is' : `${pendingRegCount} access requests are`} pending approval
          </span>
          <span className="ml-auto text-amber-500">→</span>
        </Link>
      )}

      {/* TOP panels */}
      {topCount > 0 && (
        <div className={`grid gap-4 mb-4 ${responsiveGridCols(topCount)}`}>

          {cfg.bishopricMeeting.visible && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
              <SectionTitle link="/bishopric-meetings">Bishopric Meeting</SectionTitle>
              {nextMeeting ? (
                <div className="space-y-4">
                  {cfg.bishopricMeeting.showDate && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Date</p>
                      <p className="text-lg font-bold text-gray-900">
                        {new Date(nextMeeting.date.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  )}
                  {cfg.bishopricMeeting.showSpiritualThought && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Spiritual Thought</p>
                      <p className={`${FONT_SIZE_CLASS[cfg.bishopricMeeting.fontSize]} font-bold text-gray-900`}>
                        {nextMeeting.spiritual_thought || <span className="text-gray-300 font-normal">—</span>}
                      </p>
                    </div>
                  )}
                  {cfg.bishopricMeeting.showOpeningPrayer && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Opening Prayer</p>
                      <p className={`${FONT_SIZE_CLASS[cfg.bishopricMeeting.fontSize]} font-bold text-gray-900`}>
                        {nextMeeting.opening_prayer || <span className="text-gray-300 font-normal">—</span>}
                      </p>
                    </div>
                  )}
                  {cfg.bishopricMeeting.showHandbookTopic && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Handbook Topic</p>
                      <p className={`${FONT_SIZE_CLASS[cfg.bishopricMeeting.fontSize]} font-bold text-gray-900`}>
                        {nextMeeting.handbook_training
                          ? <>{nextMeeting.handbook_training}{nextMeeting.handbook_section ? <span className="text-gray-400 font-normal"> §{nextMeeting.handbook_section}</span> : null}</>
                          : <span className="text-gray-300 font-normal">—</span>}
                      </p>
                    </div>
                  )}
                  {cfg.bishopricMeeting.showClosingPrayer && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Closing Prayer</p>
                      <p className={`${FONT_SIZE_CLASS[cfg.bishopricMeeting.fontSize]} font-bold text-gray-900`}>
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

          {cfg.healthNeeds.visible && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
              <SectionTitle link="/member-needs">Health Needs</SectionTitle>
              <NeedList items={healthNeeds} onToggle={removePrayer}
                newValue={newHealth} onChangeNew={setNewHealth} onAdd={handleAddHealth}
                placeholder="Add name…" fontSize={cfg.healthNeeds.fontSize} />
            </div>
          )}

          {cfg.supportNeeds.visible && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
              <SectionTitle link="/member-needs">Needs Support</SectionTitle>
              <NeedList items={supportNeeds} onToggle={removePrayer}
                newValue={newSupport} onChangeNew={setNewSupport} onAdd={handleAddSupport}
                placeholder="Add name…" fontSize={cfg.supportNeeds.fontSize} />
            </div>
          )}

          {cfg.missionaries.visible && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col">
              <SectionTitle link="/missionary-pipeline">Missionaries</SectionTitle>
              <div className="space-y-2">
                {activeMissionaries.length === 0 && <p className="text-gray-300 text-lg italic">None</p>}
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

      {/* BOTTOM panels */}
      {bottomCount > 0 && (
        <div className={`grid gap-4 min-h-0 flex-1 ${responsiveGridCols(bottomCount)}`}>

          {cfg.tasks.visible && (
            <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 flex-shrink-0">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Action Items ({pendingTasks.length})</span>
                <Link to="/tasks" className="text-xs text-blue-400 hover:text-blue-600">↗</Link>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
                {pendingTasks.length === 0
                  ? <p className="text-xs text-gray-400 py-2">All done!</p>
                  : pendingTasks.map(t => {
                    const isOverdue = t.due_date && t.due_date < TODAY;
                    const isDueSoon = !isOverdue && t.due_date && t.due_date <= new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
                    return (
                      <div key={t.id} className="flex items-baseline justify-between py-1 gap-2">
                        <span className={`${FONT_SIZE_CLASS[cfg.tasks.fontSize]} text-gray-800 truncate`}>{t.task}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isOverdue && <span className="text-xs text-red-600 font-semibold whitespace-nowrap">overdue</span>}
                          {isDueSoon && <span className="text-xs text-amber-600 font-semibold whitespace-nowrap">{t.due_date}</span>}
                          {cfg.tasks.showAssignedTo && t.assigned_to && (
                            <span className="text-xs text-gray-400 whitespace-nowrap">{t.assigned_to}</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          )}

          {cfg.callings.visible && (
            <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 flex-shrink-0">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Callings Needing Action ({actionCallings.length})</span>
                <Link to="/calling-pipeline" className="text-xs text-blue-400 hover:text-blue-600">↗</Link>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
                {actionCallings.length === 0
                  ? <p className="text-xs text-gray-400 py-2">None</p>
                  : actionCallings.map(c => (
                    <div key={c.id} className="flex items-center justify-between py-1 gap-2 min-w-0">
                      <span className={`${FONT_SIZE_CLASS[cfg.callings.fontSize]} text-gray-700 truncate`}>
                        {renderRichText(c.member)} — {c.calling}
                      </span>
                      {cfg.callings.showStatusBadge && (
                        <div className="flex-shrink-0"><StatusBadge status={c.status} colors={CALLING_STATUS_COLORS} /></div>
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
                <Link to="/calendaring" className="text-xs text-blue-400 hover:text-blue-600">↗</Link>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
                {upcomingEvents.length === 0
                  ? <p className="text-xs text-gray-400 py-2">None</p>
                  : upcomingEvents.map(e => (
                    <div key={e.id} className="flex items-baseline justify-between py-1 gap-2">
                      <span className={`${FONT_SIZE_CLASS[cfg.events.fontSize]} text-gray-800 truncate`}>{e.name}</span>
                      {cfg.events.showDate && (
                        <span className="text-xs text-gray-400 whitespace-nowrap">{formatEventDate(e.dates)}</span>
                      )}
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {cfg.annualDuties.visible && (
            <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 flex-shrink-0">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Annual Duties Due ({dutiesDue.length})</span>
                <Link to="/annual-duties" className="text-xs text-blue-400 hover:text-blue-600">↗</Link>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
                {dutiesDue.length === 0
                  ? <p className="text-xs text-gray-400 py-2">None</p>
                  : dutiesDue.map(d => (
                    <div key={d.id} className="py-1">
                      <span className={`${FONT_SIZE_CLASS[cfg.annualDuties.fontSize]} text-gray-800 truncate block`}>{d.title}</span>
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
