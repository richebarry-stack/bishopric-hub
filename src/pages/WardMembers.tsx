import { useState, useMemo, useCallback } from 'react';
import { useTable } from '../lib/useTable';
import { toast } from '../lib/toast';
import { useConfirm } from '../components/ConfirmDialog';
import { useAuth } from '../lib/auth';
import { legalName } from '../lib/displayName';
import type { WardMember } from '../lib/api';
import WardMemberImport from '../components/WardMemberImport';

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

function BirthDateCell({ member, onSave }: { member: WardMember; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <input
        type="date"
        autoFocus
        defaultValue={member.birth_date || ''}
        onBlur={e => { setEditing(false); if (e.target.value && e.target.value !== member.birth_date) onSave(e.target.value); }}
        onKeyDown={e => { if (e.key === 'Escape') setEditing(false); }}
        className="text-xs rounded border border-gray-300 px-1.5 py-0.5"
      />
    );
  }
  return (
    <button type="button" onClick={() => setEditing(true)}
      className="text-xs text-gray-500 hover:text-blue-600 hover:underline" aria-label={`Edit birth date for ${legalName(member)}`}>
      {member.birth_date || 'Set birth date'}
    </button>
  );
}

function NameCell({ member, onSave }: { member: WardMember; onSave: (fields: { first_name: string; last_name: string }) => void }) {
  const [editing, setEditing] = useState(false);
  const [first, setFirst] = useState(member.first_name);
  const [last, setLast] = useState(member.last_name);

  if (editing) {
    const commit = () => {
      setEditing(false);
      const f = first.trim(), l = last.trim();
      if (l && (f !== member.first_name || l !== member.last_name)) onSave({ first_name: f, last_name: l });
      else { setFirst(member.first_name); setLast(member.last_name); }
    };
    return (
      <div className="flex gap-1">
        <input autoFocus value={last} onChange={e => setLast(e.target.value)} placeholder="Last"
          onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false); }}
          className="text-sm rounded border border-gray-300 px-1.5 py-0.5 w-24" />
        <input value={first} onChange={e => setFirst(e.target.value)} placeholder="First"
          onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false); }}
          className="text-sm rounded border border-gray-300 px-1.5 py-0.5 w-24" />
      </div>
    );
  }
  return (
    <button type="button" onClick={() => setEditing(true)} className="text-left hover:text-blue-600" aria-label={`Edit name for ${legalName(member)}`}>
      {legalName(member)}
    </button>
  );
}

function PreferredNameCell({ member, onSave }: { member: WardMember; onSave: (fields: { preferred_first_name: string; preferred_last_name: string }) => void }) {
  const [editing, setEditing] = useState(false);
  const [first, setFirst] = useState(member.preferred_first_name || '');
  const [last, setLast] = useState(member.preferred_last_name || '');

  if (editing) {
    const commit = () => {
      setEditing(false);
      const f = first.trim(), l = last.trim();
      if (f !== (member.preferred_first_name || '') || l !== (member.preferred_last_name || '')) {
        onSave({ preferred_first_name: f, preferred_last_name: l });
      }
    };
    return (
      <div className="flex gap-1">
        <input autoFocus value={last} onChange={e => setLast(e.target.value)} placeholder="Last"
          onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false); }}
          className="text-xs rounded border border-gray-300 px-1.5 py-0.5 w-20" />
        <input value={first} onChange={e => setFirst(e.target.value)} placeholder="First"
          onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false); }}
          className="text-xs rounded border border-gray-300 px-1.5 py-0.5 w-20" />
      </div>
    );
  }
  const shown = member.preferred_first_name || member.preferred_last_name
    ? `${member.preferred_last_name || ''}${member.preferred_last_name && member.preferred_first_name ? ', ' : ''}${member.preferred_first_name || ''}`
    : '';
  return (
    <button type="button" onClick={() => setEditing(true)}
      className="text-xs text-gray-500 hover:text-blue-600 hover:underline" aria-label={`Edit preferred name for ${legalName(member)}`}>
      {shown || <span className="text-gray-300">—</span>}
    </button>
  );
}

function GenderCell({ member, onSave }: { member: WardMember; onSave: (v: string) => void }) {
  return (
    <select
      value={member.gender || ''}
      onChange={e => onSave(e.target.value)}
      aria-label={`Gender for ${legalName(member)}`}
      className="text-xs rounded border border-gray-200 px-1.5 py-0.5 bg-transparent hover:border-gray-300"
    >
      <option value="">—</option>
      <option value="M">M</option>
      <option value="F">F</option>
    </select>
  );
}

interface GroupedRows {
  adults: WardMember[];
  youth: WardMember[];
  children: WardMember[];
  unknown: WardMember[];
}

function MemberSection({ title, members, onToggleActive, onDelete, onToggleExclude, onSaveBirthDate, onSaveGender, onSaveName, onSavePreferredName, onToggleOutOfWard }: {
  title: string;
  members: WardMember[];
  onToggleActive: (m: WardMember) => void;
  onDelete: (m: WardMember) => void;
  onToggleExclude: (m: WardMember, field: 'exclude_speakers' | 'exclude_prayers') => void;
  onSaveBirthDate: (m: WardMember, v: string) => void;
  onSaveGender: (m: WardMember, v: string) => void;
  onSaveName: (m: WardMember, fields: { first_name: string; last_name: string }) => void;
  onSavePreferredName: (m: WardMember, fields: { preferred_first_name: string; preferred_last_name: string }) => void;
  onToggleOutOfWard: (m: WardMember) => void;
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
              <th className="text-left px-4 py-2 font-medium text-gray-600 w-36">Preferred Name</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600 w-28">Birth Date</th>
              <th className="text-center px-4 py-2 font-medium text-gray-600 w-16">Gender</th>
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
                  <NameCell member={m} onSave={fields => onSaveName(m, fields)} />
                  <AgeTag birthDate={m.birth_date} />
                  {!!m.out_of_ward && (
                    <span className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 ml-1.5 align-middle">Out of ward</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <PreferredNameCell member={m} onSave={fields => onSavePreferredName(m, fields)} />
                </td>
                <td className="px-4 py-2">
                  <BirthDateCell member={m} onSave={v => onSaveBirthDate(m, v)} />
                </td>
                <td className="px-4 py-2 text-center">
                  <GenderCell member={m} onSave={v => onSaveGender(m, v)} />
                </td>
                <td className="px-4 py-2 text-center">
                  {m.active ? (
                    <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5">In Ward</span>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">Removed</span>
                  )}
                </td>
                <td className="px-4 py-2 text-center">
                  <button type="button" onClick={() => onToggleExclude(m, 'exclude_speakers')}
                    aria-label={`Toggle speaker eligibility for ${legalName(m)}`}
                    className={`text-xs px-2 py-0.5 rounded-full min-h-[28px] ${m.exclude_speakers ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                    {m.exclude_speakers ? 'Excluded' : 'Included'}
                  </button>
                </td>
                <td className="px-4 py-2 text-center">
                  <button type="button" onClick={() => onToggleExclude(m, 'exclude_prayers')}
                    aria-label={`Toggle prayer eligibility for ${legalName(m)}`}
                    className={`text-xs px-2 py-0.5 rounded-full min-h-[28px] ${m.exclude_prayers ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                    {m.exclude_prayers ? 'Excluded' : 'Included'}
                  </button>
                </td>
                <td className="px-4 py-2 text-right space-x-2">
                  <button onClick={() => onToggleOutOfWard(m)}
                    className="text-xs px-2 py-1 rounded text-amber-600 hover:bg-amber-50">
                    {m.out_of_ward ? 'Back in ward' : 'Mark out of ward'}
                  </button>
                  <button onClick={() => onToggleActive(m)}
                    className={`text-xs px-2 py-1 rounded ${m.active
                      ? 'text-orange-600 hover:bg-orange-50'
                      : 'text-green-600 hover:bg-green-50'}`}>
                    {m.active ? 'Remove from ward' : 'Add back to ward'}
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
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { rows, create, update, remove, refetch } = useTable<WardMember>('ward-members');
  const [filter, setFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [newLast, setNewLast] = useState('');
  const [newFirst, setNewFirst] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    return rows
      .filter(r => showInactive || r.active)
      .filter(r => !q || legalName(r).toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.active !== b.active) return b.active - a.active;
        return legalName(a).localeCompare(legalName(b));
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
    const last = newLast.trim();
    const first = newFirst.trim();
    if (!last || saving) return;
    if (rows.some(r => r.last_name.toLowerCase() === last.toLowerCase() && r.first_name.toLowerCase() === first.toLowerCase())) {
      toast.error('This member already exists.');
      return;
    }
    setSaving(true);
    try {
      await create({ last_name: last, first_name: first, active: 1 } as unknown as Record<string, unknown>);
      setNewLast('');
      setNewFirst('');
      setAdding(false);
    } finally {
      setSaving(false);
    }
  }, [newLast, newFirst, saving, rows, create]);

  const toggleActive = useCallback((m: WardMember) => {
    update(m.id, { active: m.active ? 0 : 1 } as unknown as Record<string, unknown>);
  }, [update]);

  const toggleExclude = useCallback((m: WardMember, field: 'exclude_speakers' | 'exclude_prayers') => {
    update(m.id, { [field]: m[field] ? 0 : 1 } as unknown as Record<string, unknown>);
  }, [update]);

  const saveBirthDate = useCallback((m: WardMember, v: string) => {
    update(m.id, { birth_date: v } as unknown as Record<string, unknown>);
  }, [update]);

  const saveGender = useCallback((m: WardMember, v: string) => {
    update(m.id, { gender: v } as unknown as Record<string, unknown>);
  }, [update]);

  const saveName = useCallback((m: WardMember, fields: { first_name: string; last_name: string }) => {
    update(m.id, fields as unknown as Record<string, unknown>);
  }, [update]);

  const savePreferredName = useCallback((m: WardMember, fields: { preferred_first_name: string; preferred_last_name: string }) => {
    update(m.id, fields as unknown as Record<string, unknown>);
  }, [update]);

  const toggleOutOfWard = useCallback((m: WardMember) => {
    update(m.id, { out_of_ward: m.out_of_ward ? 0 : 1 } as unknown as Record<string, unknown>);
  }, [update]);

  const confirm = useConfirm();
  const handleDelete = useCallback(async (m: WardMember) => {
    if (await confirm({ message: `Permanently delete ${legalName(m)}? This cannot be undone.` })) remove(m.id);
  }, [remove, confirm]);

  const sectionProps = { onToggleActive: toggleActive, onDelete: handleDelete, onToggleExclude: toggleExclude, onSaveBirthDate: saveBirthDate, onSaveGender: saveGender, onSaveName: saveName, onSavePreferredName: savePreferredName, onToggleOutOfWard: toggleOutOfWard };

  return (
    <div>
      {importing && (
        <WardMemberImport
          roster={rows}
          onClose={() => setImporting(false)}
          onImported={refetch}
        />
      )}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Ward Members</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{activeCount} in ward{inactiveCount > 0 && `, ${inactiveCount} removed`}</span>
          {isAdmin && (
            <button onClick={() => setImporting(true)}
              className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-gray-50">
              Import CSV
            </button>
          )}
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
          Show removed ({inactiveCount})
        </label>
      </div>

      {adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center gap-2">
          <input value={newLast} onChange={e => setNewLast(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Last name"
            autoFocus
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm w-36" />
          <input value={newFirst} onChange={e => setNewFirst(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="First name"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm w-36" />
          <button onClick={handleAdd} disabled={saving || !newLast.trim()}
            className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Adding...' : 'Add'}
          </button>
          <button onClick={() => { setAdding(false); setNewLast(''); setNewFirst(''); }}
            className="text-gray-500 hover:text-gray-700 text-sm">Cancel</button>
        </div>
      )}

      <MemberSection title="Adults" members={grouped.adults} {...sectionProps} />
      <MemberSection title="Youth" members={grouped.youth} {...sectionProps} />
      <MemberSection title="Children" members={grouped.children} {...sectionProps} />
      <MemberSection title="No Birth Date" members={grouped.unknown} {...sectionProps} />

      <p className="text-xs text-gray-400 mt-2">
        Removing a member from the ward hides them from Speakers &amp; Prayers but preserves their history.
        "Out of ward" marks someone who attends here but whose membership record is in another ward — it's informational only and doesn't change anything else.
        Age groups: children (&lt;12 this year), youth (12–17 this year), adults (18+ this year).
      </p>
    </div>
  );
}
