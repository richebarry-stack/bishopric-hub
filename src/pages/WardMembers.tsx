import { useState, useMemo, useCallback } from 'react';
import { useTable } from '../lib/useTable';

interface WardMember {
  id: number;
  name: string;
  active: number;
  exclude_speakers: number;
  exclude_prayers: number;
  birth_date: string | null;
  updated_at: string;
}

function currentAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const bd = new Date(birthDate + 'T12:00:00');
  let age = today.getFullYear() - bd.getFullYear();
  const m = today.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
  return age;
}

function ageGroup(birthDate: string | null): 'adult' | 'youth' | 'child' | 'unknown' {
  if (!birthDate) return 'unknown';
  const birthYear = parseInt(birthDate.slice(0, 4));
  const ageThisYear = new Date().getFullYear() - birthYear;
  if (ageThisYear < 12) return 'child';
  if (ageThisYear < 18) return 'youth';
  return 'adult';
}

function AgeTag({ birthDate }: { birthDate: string | null }) {
  const age = currentAge(birthDate);
  if (age === null) return null;
  return <span className="text-xs text-gray-400 font-normal ml-1.5">age {age}</span>;
}

interface GroupedRows {
  adults: WardMember[];
  youth: WardMember[];
  children: WardMember[];
  unknown: WardMember[];
}

function MemberSection({ title, members, onToggleActive, onDelete }: {
  title: string;
  members: WardMember[];
  onToggleActive: (m: WardMember) => void;
  onDelete: (m: WardMember) => void;
}) {
  if (members.length === 0) return null;
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1 mb-2">
        {title} <span className="font-normal normal-case text-gray-400">({members.length})</span>
      </h2>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-2 font-medium text-gray-600">Name</th>
              <th className="text-center px-4 py-2 font-medium text-gray-600 w-24">Status</th>
              <th className="text-center px-4 py-2 font-medium text-gray-600 w-28">Speakers</th>
              <th className="text-center px-4 py-2 font-medium text-gray-600 w-28">Prayers</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600 w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id} className={`border-b border-gray-50 hover:bg-gray-50 ${!m.active ? 'opacity-60' : ''}`}>
                <td className="px-4 py-2 font-medium text-gray-900">
                  {m.name}
                  <AgeTag birthDate={m.birth_date} />
                </td>
                <td className="px-4 py-2 text-center">
                  {m.active ? (
                    <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5">Active</span>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">Inactive</span>
                  )}
                </td>
                <td className="px-4 py-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${m.exclude_speakers ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                    {m.exclude_speakers ? 'Excluded' : 'Included'}
                  </span>
                </td>
                <td className="px-4 py-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${m.exclude_prayers ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                    {m.exclude_prayers ? 'Excluded' : 'Included'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right space-x-2">
                  <button onClick={() => onToggleActive(m)}
                    className={`text-xs px-2 py-1 rounded ${m.active
                      ? 'text-orange-600 hover:bg-orange-50'
                      : 'text-green-600 hover:bg-green-50'}`}>
                    {m.active ? 'Deactivate' : 'Reactivate'}
                  </button>
                  {!m.active && (
                    <button onClick={() => onDelete(m)}
                      className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50">
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function WardMembers() {
  const { rows, create, update, remove } = useTable<WardMember>('ward-members');
  const [filter, setFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    return rows
      .filter(r => showInactive || r.active)
      .filter(r => !q || r.name.toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.active !== b.active) return b.active - a.active;
        return a.name.localeCompare(b.name);
      });
  }, [rows, filter, showInactive]);

  const grouped = useMemo<GroupedRows>(() => {
    const groups: GroupedRows = { adults: [], youth: [], children: [], unknown: [] };
    for (const m of filtered) {
      const g = ageGroup(m.birth_date);
      (g === 'adult' ? groups.adults : g === 'youth' ? groups.youth : g === 'child' ? groups.children : groups.unknown).push(m);
    }
    return groups;
  }, [filtered]);

  const activeCount = useMemo(() => rows.filter(r => r.active).length, [rows]);
  const inactiveCount = rows.length - activeCount;

  const handleAdd = useCallback(async () => {
    const name = newName.trim();
    if (!name || saving) return;
    if (rows.some(r => r.name.toLowerCase() === name.toLowerCase())) {
      alert('This member already exists.');
      return;
    }
    setSaving(true);
    try {
      await create({ name, active: 1 } as unknown as Record<string, unknown>);
      setNewName('');
      setAdding(false);
    } finally {
      setSaving(false);
    }
  }, [newName, saving, rows, create]);

  const toggleActive = useCallback((m: WardMember) => {
    update(m.id, { active: m.active ? 0 : 1 } as unknown as Record<string, unknown>);
  }, [update]);

  const handleDelete = useCallback((m: WardMember) => {
    if (confirm(`Permanently delete ${m.name}? This cannot be undone.`)) remove(m.id);
  }, [remove]);

  const sectionProps = { onToggleActive: toggleActive, onDelete: handleDelete };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Ward Members</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{activeCount} active{inactiveCount > 0 && `, ${inactiveCount} inactive`}</span>
          <button onClick={() => setAdding(true)}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700">
            + Add Member
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <input value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Search by name..."
          className="rounded-md border border-gray-300 px-3 py-2 text-sm flex-1 max-w-sm" />
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}
            className="rounded border-gray-300" />
          Show inactive ({inactiveCount})
        </label>
      </div>

      {adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center gap-2">
          <input value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Lastname, Firstname"
            autoFocus
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm flex-1 max-w-xs" />
          <button onClick={handleAdd} disabled={saving || !newName.trim()}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Adding...' : 'Add'}
          </button>
          <button onClick={() => { setAdding(false); setNewName(''); }}
            className="text-gray-500 hover:text-gray-700 text-sm">Cancel</button>
        </div>
      )}

      <MemberSection title="Adults" members={grouped.adults} {...sectionProps} />
      <MemberSection title="Youth" members={grouped.youth} {...sectionProps} />
      <MemberSection title="Children" members={grouped.children} {...sectionProps} />
      <MemberSection title="No Birth Date" members={grouped.unknown} {...sectionProps} />

      <p className="text-xs text-gray-400 mt-2">
        Deactivating a member hides them from Speakers &amp; Prayers but preserves their history.
        Age groups: children (&lt;12 this year), youth (12–17 this year), adults (18+ this year).
      </p>
    </div>
  );
}
