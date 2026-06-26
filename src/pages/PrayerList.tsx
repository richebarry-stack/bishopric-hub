import { useState } from 'react';
import { useTable } from '../lib/useTable';
import type { MemberNeed, MissionaryPipeline, PrayerOther } from '../lib/api';

const ACTIVE_MISSIONARY_STATUSES = new Set([
  '1-Considering', '2-Papers Started', '3-Papers Completed', '4-Call Accepted',
]);

function PrayerToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
        active ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 hover:border-blue-400'
      }`}
      title={active ? 'Remove from prayer list' : 'Add to prayer list'}
    >
      {active && <svg className="w-2.5 h-2.5" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    </button>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-col min-h-0">
      <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 pb-1 border-b border-gray-100">{title}</h2>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

export default function PrayerList() {
  const { rows: needs, update: updateNeed } = useTable<MemberNeed>('member-needs');
  const { rows: missionaries } = useTable<MissionaryPipeline>('missionary-pipeline');
  const { rows: others, create, remove } = useTable<PrayerOther>('prayer-others');

  const [newName, setNewName] = useState('');

  const healthNeeds = needs.filter(n => n.type === 'Health');
  const supportNeeds = needs.filter(n => n.type === 'Support');
  const activeMissionaries = missionaries.filter(m => ACTIVE_MISSIONARY_STATUSES.has(m.status));

  const togglePray = (n: MemberNeed) => updateNeed(n.id, { pray_for: n.pray_for ? 0 : 1 });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    await create({ name });
    setNewName('');
  };

  function NeedList({ items }: { items: MemberNeed[] }) {
    const tagged = items.filter(n => n.pray_for);
    const untagged = items.filter(n => !n.pray_for);
    return (
      <div className="space-y-0.5">
        {tagged.map(n => (
          <div key={n.id} className="flex items-center gap-2 py-0.5">
            <PrayerToggle active={true} onToggle={() => togglePray(n)} />
            <span className="text-sm text-gray-900 font-medium leading-tight">{n.who}</span>
            {n.what && <span className="text-xs text-gray-400 truncate">{n.what}</span>}
          </div>
        ))}
        {tagged.length > 0 && untagged.length > 0 && <div className="border-t border-dashed border-gray-200 my-1.5" />}
        {untagged.map(n => (
          <div key={n.id} className="flex items-center gap-2 py-0.5">
            <PrayerToggle active={false} onToggle={() => togglePray(n)} />
            <span className="text-sm text-gray-400 leading-tight">{n.who}</span>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-gray-300 italic">None</p>}
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col">
      <h1 className="text-2xl font-bold text-gray-900 mb-3">Prayer List</h1>

      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0 overflow-auto">
        {/* Health Needs */}
        <Panel title="Health Needs">
          <NeedList items={healthNeeds} />
        </Panel>

        {/* Needs Support */}
        <Panel title="Needs Support">
          <NeedList items={supportNeeds} />
        </Panel>

        {/* Missionaries */}
        <Panel title="Missionaries">
          {activeMissionaries.length === 0
            ? <p className="text-xs text-gray-300 italic">None</p>
            : <div className="space-y-0.5">
                {activeMissionaries.map(m => (
                  <div key={m.id} className="py-0.5">
                    <span className="text-sm text-gray-900 font-medium">{m.who}</span>
                    <span className="text-xs text-gray-400 ml-2">{m.status.replace(/^\d+-/, '')}{m.mission_call ? ` — ${m.mission_call}` : ''}</span>
                  </div>
                ))}
              </div>
          }
        </Panel>

        {/* Others */}
        <Panel title="Others to Pray For">
          <div className="space-y-0.5 mb-2">
            {others.map(o => (
              <div key={o.id} className="flex items-center justify-between py-0.5">
                <span className="text-sm text-gray-900 font-medium">{o.name}</span>
                <button onClick={() => remove(o.id)} className="text-red-300 hover:text-red-500 text-xs ml-2 flex-shrink-0">×</button>
              </div>
            ))}
            {others.length === 0 && <p className="text-xs text-gray-300 italic mb-1">None</p>}
          </div>
          <form onSubmit={handleAdd} className="flex gap-1.5 pt-1 border-t border-gray-100">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Add a name…"
              className="flex-1 min-w-0 rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button type="submit" className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 flex-shrink-0">Add</button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
