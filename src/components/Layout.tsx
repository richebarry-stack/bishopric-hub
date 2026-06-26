import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '⌂' },
  { path: '/current-sacrament', label: 'Current Sacrament Meeting', icon: '♫' },
  { path: '/calendaring', label: 'Calendar Events', icon: '▣' },
  { path: '/calling-pipeline', label: 'Calling Pipeline', icon: '◉' },
  { path: '/member-needs', label: 'Member Needs', icon: '♥' },
  { path: '/missionary-pipeline', label: 'Missionary Pipeline', icon: '✈' },
  { path: '/bishop-schedule', label: 'Bishop Schedule', icon: '🕐' },
  { path: '/sacrament-planning', label: 'Sacrament Planning', icon: '♪' },
  { path: '/interview-pipeline', label: 'Interview Pipeline', icon: '◎' },
  { path: '/tasks', label: 'Tasks', icon: '☑' },
  { path: '/bishopric-meetings', label: 'Bishopric Meetings', icon: '▦' },
  { path: '/babies', label: 'Babies', icon: '★' },
  { path: '/out-of-town', label: 'Out of Town', icon: '⇢' },
  { path: '/assignments', label: 'Assignments', icon: '⟳' },
  { path: '/important-links', label: 'Important Links', icon: '⇗' },
  { path: '/users', label: 'Users', icon: '⊕' },
];

const NAV_ORDER_KEY = (userId: number) => `nav_order_${userId}`;

function loadOrder(userId: number): string[] {
  try {
    const stored = localStorage.getItem(NAV_ORDER_KEY(userId));
    if (stored) {
      const parsed: string[] = JSON.parse(stored);
      // Keep only valid paths, append any new ones not yet in the stored order
      const valid = parsed.filter(p => NAV_ITEMS.some(n => n.path === p));
      const newItems = NAV_ITEMS.filter(n => !valid.includes(n.path)).map(n => n.path);
      return [...valid, ...newItems];
    }
  } catch { /* ignore */ }
  return NAV_ITEMS.map(n => n.path);
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  const [navOrder, setNavOrder] = useState<string[]>(() =>
    user ? loadOrder(user.id) : NAV_ITEMS.map(n => n.path)
  );
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);

  const orderedItems = navOrder
    .map(p => NAV_ITEMS.find(n => n.path === p))
    .filter(Boolean) as typeof NAV_ITEMS;

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

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-900">Bishopric Hub</h1>
          {user && <p className="text-xs text-gray-500 mt-1">{user.name}</p>}
        </div>
        <nav className="p-2 overflow-y-auto h-[calc(100vh-8rem)]">
          {orderedItems.map(item => (
            <div
              key={item.path}
              draggable
              onDragStart={e => {
                e.dataTransfer.setData('text/plain', item.path);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={e => { e.preventDefault(); setDragOverPath(item.path); }}
              onDragLeave={() => setDragOverPath(null)}
              onDrop={e => handleDrop(e, item.path)}
              onDragEnd={() => setDragOverPath(null)}
              className={`rounded-md transition-colors ${dragOverPath === item.path ? 'ring-2 ring-blue-400 ring-inset' : ''}`}
            >
              <Link
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  location.pathname === item.path
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                draggable={false}
              >
                <span className="w-5 text-center text-gray-400 text-xs cursor-grab select-none" title="Drag to reorder">⠿</span>
                <span className="w-4 text-center">{item.icon}</span>
                {item.label}
              </Link>
            </div>
          ))}
        </nav>
        <div className="p-2 border-t border-gray-200">
          <button onClick={logout} className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md">
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="p-1 text-gray-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-gray-900">Bishopric Hub</h1>
        </header>
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
