import { useState, useEffect, Suspense } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { SECURITY_QUESTIONS } from '../lib/constants';
import { usePresence, type PresenceUser } from '../lib/usePresence';

export const NAV_ITEMS: { path: string; label: string; icon: string; adminOnly?: boolean }[] = [
  { path: '/', label: 'Dashboard', icon: '⌂' },
  { path: '/current-sacrament', label: 'Current Sacrament Meeting', icon: '♫' },
  { path: '/calendaring', label: 'Calendar Events', icon: '▣' },
  { path: '/calling-pipeline', label: 'Calling Pipeline', icon: '◉' },
  { path: '/youth-activities', label: 'Youth Activities', icon: '⬡' },
  { path: '/sacrament-planning', label: 'Sacrament Planning', icon: '♪' },
  { path: '/tasks', label: 'Action Items', icon: '☑' },
  { path: '/member-needs', label: 'Member Needs', icon: '♥' },
  { path: '/missionary-pipeline', label: 'Missionary Pipeline', icon: '✈' },
  { path: '/interview-pipeline', label: 'Interview Pipeline', icon: '◎' },
  { path: '/babies', label: 'Babies', icon: '★' },
  { path: '/out-of-town', label: 'Out of Town', icon: '⇢' },
  { path: '/bishop-schedule', label: 'Bishop Schedule', icon: '🕐' },
  { path: '/assignments', label: 'Bishopric Assignments', icon: '⟳' },
  { path: '/bishopric-meetings', label: 'Bishopric Meetings', icon: '▦' },
  { path: '/important-links', label: 'Important Links', icon: '⇗' },
  { path: '/speakers-and-prayers', label: 'Speakers & Prayers', icon: '⊞' },
  { path: '/ward-members', label: 'Ward Members', icon: '♟' },
  { path: '/users', label: 'Users', icon: '⊕' },
  { path: '/email-notifications', label: 'Automation & Notifications', icon: '✉', adminOnly: true },
  { path: '/hub-suggestions', label: 'Hub Suggestions', icon: '◈' },
  { path: '/help', label: 'Help', icon: '?' },
];

const WC_DASHBOARD_ITEM = { path: '/', label: 'Dashboard', icon: '⌂' };
export const WC_NAV_CATEGORIES: { label: string; items: { path: string; label: string; icon: string }[] }[] = [
  {
    label: 'Ward Council',
    items: [
      { path: '/wc-meetings',           label: 'WC Meeting Assignments', icon: '▦' },
      { path: '/wc-discussion-topics',  label: 'Discussion Topics',      icon: '◈' },
      { path: '/wc-wins',               label: 'Wins for the Ward',      icon: '★' },
      { path: '/wc-members',            label: 'Ward Council Members',   icon: '⊕' },
    ],
  },
  {
    label: 'Ward Care',
    items: [
      { path: '/wc-family-needs', label: 'Member Needs', icon: '♥' },
      { path: '/babies',          label: 'Babies',        icon: '◌' },
    ],
  },
  {
    label: 'Sacrament Meeting',
    items: [
      { path: '/current-sacrament', label: 'Current Sacrament Meeting', icon: '♫' },
    ],
  },
  {
    label: 'Calendar',
    items: [
      { path: '/calendaring',      label: 'Calendar of Events', icon: '▣' },
      { path: '/youth-activities', label: 'Youth Calendar',     icon: '⬡' },
      { path: '/tasks',            label: 'Action Items',       icon: '☑' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { path: '/hub-suggestions', label: 'Hub Suggestions', icon: '✎' },
      { path: '/help',            label: 'Help',            icon: '?' },
    ],
  },
];

export const YC_NAV_ITEMS = [
  { path: '/youth-activities', label: 'Youth Calendar', icon: '⬡' },
  { path: '/help', label: 'Help', icon: '?' },
];

export const CAL_NAV_ITEMS = [
  { path: '/calendaring', label: 'Calendar of Events', icon: '▣' },
  { path: '/help', label: 'Help', icon: '?' },
];

const BH_DASHBOARD_ITEM = { path: '/', label: 'Dashboard', icon: 'ti-home' };
export const BH_NAV_CATEGORIES: { label: string; items: { path: string; label: string; icon: string; adminOnly?: boolean }[] }[] = [
  {
    label: 'Sacrament Meeting',
    items: [
      { path: '/sacrament-planning',   label: 'Sacrament Planning',        icon: 'ti-notebook'        },
      { path: '/current-sacrament',    label: 'Current Sacrament Meeting', icon: 'ti-music'           },
      { path: '/speakers-and-prayers', label: 'Speakers & Prayers',        icon: 'ti-microphone'      },
    ],
  },
  {
    label: 'Bishopric',
    items: [
      { path: '/bishopric-meetings',   label: 'Bishopric Meetings',     icon: 'ti-users'           },
      { path: '/assignments',          label: 'Bishopric Assignments',  icon: 'ti-list-check'      },
      { path: '/bishop-schedule',      label: 'Bishop Schedule',        icon: 'ti-calendar-time'   },
      { path: '/tasks',                label: 'Action Items',           icon: 'ti-checklist'       },
      { path: '/out-of-town',          label: 'Out of Town',            icon: 'ti-plane-departure' },
    ],
  },
  {
    label: 'Ward Care',
    items: [
      { path: '/calling-pipeline',     label: 'Calling Pipeline',    icon: 'ti-user-check'      },
      { path: '/interview-pipeline',   label: 'Interview Pipeline',  icon: 'ti-clipboard-list'  },
      { path: '/member-needs',         label: 'Member Needs',        icon: 'ti-heart'           },
      { path: '/missionary-pipeline',  label: 'Missionary Pipeline', icon: 'ti-compass'         },
      { path: '/babies',               label: 'Babies',              icon: 'ti-baby-carriage'   },
    ],
  },
  {
    label: 'Calendar',
    items: [
      { path: '/calendaring',          label: 'Calendar Events',  icon: 'ti-calendar-event' },
      { path: '/youth-activities',     label: 'Youth Activities', icon: 'ti-run'            },
    ],
  },
  {
    label: 'Administration',
    items: [
      { path: '/ward-members',         label: 'Ward Members',        icon: 'ti-address-book'              },
      { path: '/users',                label: 'Users',               icon: 'ti-user-cog'                  },
      { path: '/email-notifications',  label: 'Automation & Notifications', icon: 'ti-mail', adminOnly: true },
      { path: '/important-links',      label: 'Important Links',     icon: 'ti-link'                      },
      { path: '/hub-suggestions',      label: 'Hub Suggestions',     icon: 'ti-bulb'                      },
      { path: '/help',                 label: 'Help',                icon: 'ti-help-circle'               },
    ],
  },
];
const BH_ALL_ITEMS = [BH_DASHBOARD_ITEM, ...BH_NAV_CATEGORIES.flatMap(cat => cat.items)];

// Flattened path → friendly label map (for the presence indicator), covering every hub's pages.
const PATH_LABELS: Record<string, string> = {};
for (const item of [
  ...BH_ALL_ITEMS,
  WC_DASHBOARD_ITEM, ...WC_NAV_CATEGORIES.flatMap(cat => cat.items),
  ...YC_NAV_ITEMS, ...CAL_NAV_ITEMS,
]) {
  if (!(item.path in PATH_LABELS)) PATH_LABELS[item.path] = item.label;
}
function pathLabel(path: string): string {
  if (PATH_LABELS[path]) return PATH_LABELS[path];
  const segment = path.split('/').filter(Boolean).pop();
  return segment ? segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Dashboard';
}

const NAV_ORDER_KEY = (userId: number) => `nav_order_${userId}`;
export const LAST_VISITED_KEY = 'last_visited_page';

function loadOrder(userId: number): string[] {
  try {
    const stored = localStorage.getItem(NAV_ORDER_KEY(userId));
    if (stored) {
      const parsed: string[] = JSON.parse(stored);
      const valid = parsed.filter(p => NAV_ITEMS.some(n => n.path === p));
      const newItems = NAV_ITEMS.filter(n => !valid.includes(n.path)).map(n => n.path);
      return [...valid, ...newItems];
    }
  } catch { /* ignore */ }
  return NAV_ITEMS.map(n => n.path);
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) { setError('Passwords do not match'); return; }
    if (next.length < 6) { setError('Password must be at least 6 characters'); return; }
    setSaving(true);
    setError('');
    try {
      await api.auth.changePassword(current || null, next);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Change Password</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Current Password</span>
            <input type="password" value={current} onChange={e => setCurrent(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">New Password</span>
            <input type="password" value={next} onChange={e => setNext(e.target.value)} required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Confirm New Password</span>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SecurityQuestionsModal({ onClose }: { onClose: () => void }) {
  const { markSecurityQuestionsSetup } = useAuth();
  const [q1, setQ1] = useState(SECURITY_QUESTIONS[0]);
  const [a1, setA1] = useState('');
  const [q2, setQ2] = useState(SECURITY_QUESTIONS[1]);
  const [a2, setA2] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (q1 === q2) { setError('Please choose two different questions.'); return; }
    if (a1.trim().length < 2 || a2.trim().length < 2) { setError('Each answer must be at least 2 characters.'); return; }
    setSaving(true);
    setError('');
    try {
      await api.auth.saveSecurityQuestions({ question1: q1, answer1: a1, question2: q2, answer2: a2 });
      markSecurityQuestionsSetup();
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Security Questions</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Question 1</label>
            <select value={q1} onChange={e => { setQ1(e.target.value); if (e.target.value === q2) setQ2(SECURITY_QUESTIONS.find(q => q !== e.target.value) ?? SECURITY_QUESTIONS[1]); }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
            <input type="text" placeholder="Your answer" value={a1} onChange={e => setA1(e.target.value)} required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Question 2</label>
            <select value={q2} onChange={e => setQ2(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              {SECURITY_QUESTIONS.filter(q => q !== q1).map(q => <option key={q} value={q}>{q}</option>)}
            </select>
            <input type="text" placeholder="Your answer" value={a2} onChange={e => setA2(e.target.value)} required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <p className="text-xs text-gray-400">Answers are not case-sensitive.</p>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RenameLinksModal({ labels, onSave, onClose }: {
  labels: Record<string, string>;
  onSave: (labels: Record<string, string>) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({ ...labels });
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(draft); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Rename Page Links</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={submit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 space-y-2 overflow-y-auto">
            {BH_ALL_ITEMS.map(item => (
              <label key={item.path} className="flex items-center gap-3">
                <i className={`ti ${item.icon} w-4 text-center text-gray-400 shrink-0 text-base`} aria-hidden="true" />
                <input
                  value={draft[item.path] ?? item.label}
                  onChange={e => setDraft(d => ({ ...d, [item.path]: e.target.value }))}
                  className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
                {draft[item.path] && draft[item.path] !== item.label && (
                  <button type="button" title="Reset to default"
                    onClick={() => setDraft(d => { const n = { ...d }; delete n[item.path]; return n; })}
                    className="text-xs text-gray-400 hover:text-gray-600 shrink-0">↩</button>
                )}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Labels'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PresenceOnlineList({ others }: { others: PresenceUser[] }) {
  if (others.length === 0) return null;
  return (
    <div className="px-3 py-2 border-t border-gray-100">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Online now</p>
      <ul className="space-y-1">
        {others.map(o => (
          <li key={o.user_id} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${o.editing ? 'bg-amber-500' : 'bg-green-500'}`} title={o.editing ? 'Editing' : 'Viewing'} />
            <span className="truncate">{o.user_name} <span className="text-gray-400">— {pathLabel(o.path)}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PresenceBanner({ others, path }: { others: PresenceUser[]; path: string }) {
  const here = others.filter(o => o.path === path);
  if (here.length === 0) return null;
  const editing = here.some(o => o.editing);
  const names = here.map(o => o.user_name).join(', ');
  const verb = here.length === 1 ? 'is' : 'are';
  return (
    <div className={`mb-3 px-3 py-2 rounded-md text-sm border ${editing ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-blue-50 text-blue-800 border-blue-200'}`}>
      {names} {verb} {editing ? 'actively editing' : 'also viewing'} this page.
    </div>
  );
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [showSecurityQ, setShowSecurityQ] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [navLabels, setNavLabels] = useState<Record<string, string>>({});
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, selectedHub, chooseHub, isGuest, guestType } = useAuth();
  const othersOnline = usePresence(location.pathname, !isGuest);

  const HUB_DEFAULT: Record<string, string> = {
    yc: '/youth-activities',
    wc: '/',
    bh: '/',
    cal: '/calendaring',
  };

  const switchHub = (hub: string) => {
    chooseHub(hub as Parameters<typeof chooseHub>[0]);
    navigate(HUB_DEFAULT[hub] ?? '/');
  };

  const isCal = user?.hub === 'cal';
  const isYc = user?.hub === 'yc' || selectedHub === 'yc';
  const isWc = !isYc && (selectedHub === 'wc' || user?.hub === 'wc');
  const isAdmin = user?.role === 'admin';
  const isBh = !isCal && !isYc && !isWc;
  const canSwitchHub = user?.hub === 'both';
  const canSwitchToYc = (user?.hub === 'both' || user?.hub === 'wc') && !isYc;
  const canSwitchToBh = canSwitchHub && (isWc || isYc);
  const canSwitchToWc = (canSwitchHub || (user?.hub === 'wc' && isYc)) && !isWc;

  useEffect(() => {
    if (!isWc && !isCal) {
      api.navLabels.get().then(rows => {
        const map: Record<string, string> = {};
        for (const r of rows) map[r.path] = r.label;
        setNavLabels(map);
      }).catch(() => {});
    }
  }, [isWc, isCal]);

  useEffect(() => {
    if (location.pathname !== '/') {
      localStorage.setItem(LAST_VISITED_KEY, location.pathname);
    }
  }, [location.pathname]);

  const getLabel = (item: { path: string; label: string }) => isWc ? item.label : (navLabels[item.path] ?? item.label);

  const saveLabels = async (labels: Record<string, string>) => {
    await api.navLabels.set(labels);
    setNavLabels(labels);
  };

  const [navOrder, setNavOrder] = useState<string[]>(() =>
    user ? loadOrder(user.id) : NAV_ITEMS.map(n => n.path)
  );
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);

  const saveOrder = (order: string[]) => {
    setNavOrder(order);
    if (user) localStorage.setItem(NAV_ORDER_KEY(user.id), JSON.stringify(order));
  };

  const handleDrop = (e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    setDragOverPath(null);
    const from = e.dataTransfer.getData('text/plain');
    if (!from || from === targetPath) return;
    const next = [...navOrder];
    const fi = next.indexOf(from);
    const ti = next.indexOf(targetPath);
    if (fi === -1 || ti === -1) return;
    next.splice(fi, 1);
    next.splice(ti, 0, from);
    saveOrder(next);
  };

  const ycNavItems = isGuest
    ? (guestType === 'sac'
        ? [{ path: '/sacrament-program', label: 'Sacrament Program', icon: '♫' }]
        : [{ path: '/youth-activities', label: 'Youth Calendar', icon: '⬡' }])
    : YC_NAV_ITEMS;

  const navItems = isCal
    ? CAL_NAV_ITEMS
    : isYc
      ? ycNavItems
      : navOrder.map(p => NAV_ITEMS.find(n => n.path === p)).filter(Boolean).filter(n => !n!.adminOnly || isAdmin) as typeof NAV_ITEMS;

  const draggable = false;

  const activeCls = isCal
    ? 'bg-violet-50 text-violet-700 font-medium'
    : isYc
      ? 'bg-amber-50 text-amber-700 font-medium'
      : isWc
        ? 'bg-emerald-50 text-emerald-700 font-medium'
        : 'bg-blue-50 text-blue-700 font-medium';

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
      {showSecurityQ && <SecurityQuestionsModal onClose={() => setShowSecurityQ(false)} />}
      {showRename && !isWc && (
        <RenameLinksModal labels={navLabels} onSave={saveLabels} onClose={() => setShowRename(false)} />
      )}

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform lg:translate-x-0 flex flex-col h-screen lg:h-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className={`p-4 border-b shrink-0 ${isCal ? 'border-violet-200 bg-violet-50' : isYc ? 'border-amber-200 bg-amber-50' : isWc ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200'}`}>
          <h1 className={`text-lg font-bold ${isCal ? 'text-violet-800' : isYc ? 'text-amber-800' : isWc ? 'text-emerald-800' : 'text-gray-900'}`}>
            {isCal ? 'Calendar Hub' : isYc ? 'Youth Council Hub' : isWc ? 'Ward Council Hub' : 'Bishopric Hub'}
          </h1>
          {user && <p className={`text-xs mt-1 ${isCal ? 'text-violet-600' : isYc ? 'text-amber-600' : isWc ? 'text-emerald-600' : 'text-gray-500'}`}>{user.name}</p>}
          {isGuest && (
            <button onClick={logout}
              className="mt-2 w-full text-xs px-2 py-1.5 rounded border border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors font-medium">
              ← Back to Login
            </button>
          )}
          {(canSwitchToBh || canSwitchToWc || canSwitchToYc) && (
            <div className="mt-2 flex flex-col gap-1">
              {canSwitchToBh && (
                <button onClick={() => switchHub('bh')}
                  className="w-full text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors">
                  Switch to Bishopric Hub →
                </button>
              )}
              {canSwitchToWc && (
                <button onClick={() => switchHub('wc')}
                  className="w-full text-xs px-2 py-1 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-100 transition-colors">
                  Switch to Ward Council Hub →
                </button>
              )}
              {canSwitchToYc && (
                <button onClick={() => switchHub('yc')}
                  className="w-full text-xs px-2 py-1 rounded border border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors">
                  Switch to Youth Council Hub →
                </button>
              )}
            </div>
          )}
        </div>
        <nav className="p-2 overflow-y-auto flex-1">
          {isBh ? (
            <>
              <Link
                to="/"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors mb-1 ${
                  location.pathname === '/' ? activeCls : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <i className="ti ti-home text-base w-4 text-center" aria-hidden="true" />
                {getLabel(BH_DASHBOARD_ITEM)}
              </Link>
              {BH_NAV_CATEGORIES.map(cat => (
                <div key={cat.label} className="mt-3">
                  <p className="px-3 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 select-none">
                    {cat.label}
                  </p>
                  {cat.items
                    .filter(item => !item.adminOnly || isAdmin)
                    .map(item => (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-2 pl-4 pr-3 py-1.5 rounded-md text-sm transition-colors ${
                          location.pathname === item.path ? activeCls : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <i className={`ti ${item.icon} text-base w-4 text-center shrink-0`} aria-hidden="true" />
                        {getLabel(item)}
                      </Link>
                    ))}
                </div>
              ))}
            </>
          ) : isWc ? (
            <>
              <Link
                to="/"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors mb-1 ${
                  location.pathname === '/' ? activeCls : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="w-4 text-center">{WC_DASHBOARD_ITEM.icon}</span>
                {getLabel(WC_DASHBOARD_ITEM)}
              </Link>
              {WC_NAV_CATEGORIES.map(cat => (
                <div key={cat.label} className="mt-3">
                  <p className="px-3 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 select-none">
                    {cat.label}
                  </p>
                  {cat.items.map(item => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-2 pl-4 pr-3 py-1.5 rounded-md text-sm transition-colors ${
                        location.pathname === item.path ? activeCls : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <span className="w-4 text-center shrink-0">{item.icon}</span>
                      {getLabel(item)}
                    </Link>
                  ))}
                </div>
              ))}
            </>
          ) : (
            navItems.map(item => (
              <div
                key={item.path}
                draggable={draggable}
                onDragStart={draggable ? e => {
                  e.dataTransfer.setData('text/plain', item.path);
                  e.dataTransfer.effectAllowed = 'move';
                } : undefined}
                onDragOver={draggable ? e => { e.preventDefault(); setDragOverPath(item.path); } : undefined}
                onDragLeave={draggable ? () => setDragOverPath(null) : undefined}
                onDrop={draggable ? e => handleDrop(e, item.path) : undefined}
                onDragEnd={draggable ? () => setDragOverPath(null) : undefined}
                className={`rounded-md transition-colors ${dragOverPath === item.path ? `ring-2 ring-inset ${isYc ? 'ring-amber-400' : isWc ? 'ring-emerald-400' : 'ring-blue-400'}` : ''}`}
              >
                <Link
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    location.pathname === item.path ? activeCls : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  draggable={false}
                >
                  {draggable && <span className="w-5 text-center text-gray-400 text-xs cursor-grab select-none" title="Drag to reorder">⠿</span>}
                  <span className="w-4 text-center">{item.icon}</span>
                  {getLabel(item)}
                </Link>
              </div>
            ))
          )}
        </nav>
        <PresenceOnlineList others={othersOnline} />
        <div className="p-2 border-t border-gray-200 space-y-1">
          {isAdmin && !isWc && !isCal && (
            <button onClick={() => setShowRename(true)}
              className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md flex items-center gap-2">
              <span className="text-xs">✎</span> Rename Links
            </button>
          )}
          {!isGuest && (
            <>
              <button onClick={() => setShowChangePw(true)}
                className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md">
                Change Password
              </button>
              <button onClick={() => setShowSecurityQ(true)}
                className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md">
                Security Questions
              </button>
            </>
          )}
          {!isGuest && (
            <button onClick={logout}
              className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md">
              Sign out
            </button>
          )}
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className={`border-b px-4 py-3 flex items-center gap-3 lg:hidden ${isGuest ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
          {isGuest ? (
            <button onClick={logout}
              className="px-3 py-1.5 text-sm border border-amber-300 rounded text-amber-700 hover:bg-amber-100 font-medium shrink-0">
              ← Back to Login
            </button>
          ) : (
            <button onClick={() => setSidebarOpen(true)} className="p-1 text-gray-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          <h1 className={`text-lg font-bold ${isGuest ? 'text-amber-800' : 'text-gray-900'}`}>Bishopric Hub</h1>
        </header>
        <main className="p-4 lg:p-6">
          <PresenceBanner others={othersOnline} path={location.pathname} />
          <Suspense fallback={<p className="text-gray-400 text-sm">Loading…</p>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
