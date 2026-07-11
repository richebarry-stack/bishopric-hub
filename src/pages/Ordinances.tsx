import { useState, useMemo } from 'react';
import { useTable } from '../lib/useTable';
import type { Ordinance, WardMember } from '../lib/api';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { Input, Select, Textarea } from '../components/FormFields';
import { ORDINANCE_TYPES, ORDINANCE_STATUSES, ORDINANCE_STATUS_COLORS } from '../lib/constants';
import { useConfirm } from '../components/ConfirmDialog';
import { legalName } from '../lib/displayName';

const EMPTY: Partial<Ordinance> = { member_name: '', ordinance_type: '', status: 'Upcoming', target_date: '', completed_date: '', notes: '' };

function toDateOnly(v: string): string {
  if (!v) return '';
  return v.slice(0, 10);
}

interface Suggestion { name: string; ordinance_type: string; age: number; }

// Baptism candidates: any child turning 8 this calendar year. Aaronic Priesthood
// advancement (young men only): 12 -> Deacon, 14 -> Teacher, 16 -> Priest, in the
// year they turn that age, per General Handbook guidance.
function suggestionsFromRoster(members: WardMember[], existing: Ordinance[]): Suggestion[] {
  const year = new Date().getFullYear();
  const tracked = new Set(existing.map(o => `${o.member_name.trim().toLowerCase()}|${o.ordinance_type}`));
  const out: Suggestion[] = [];
  for (const m of members) {
    if (!m.active || !m.birth_date) continue;
    const birthYear = parseInt(m.birth_date.slice(0, 4), 10);
    if (!birthYear) continue;
    const ageThisYear = year - birthYear;
    const add = (type: string) => {
      const name = legalName(m);
      const key = `${name.trim().toLowerCase()}|${type}`;
      if (!tracked.has(key)) out.push({ name, ordinance_type: type, age: ageThisYear });
    };
    if (ageThisYear === 8) add('Baptism');
    if (m.gender === 'M') {
      if (ageThisYear === 12) add('Deacon');
      else if (ageThisYear === 14) add('Teacher');
      else if (ageThisYear === 16) add('Priest');
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export default function Ordinances() {
  const { rows, isLoading, create, update, remove } = useTable<Ordinance>('ordinances');
  const { rows: wardMembers } = useTable<WardMember>('ward-members');
  const [editing, setEditing] = useState<Partial<Ordinance> | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const confirm = useConfirm();

  const suggestions = useMemo(
    () => suggestionsFromRoster(wardMembers, rows).filter(s => !dismissed.has(`${s.name.toLowerCase()}|${s.ordinance_type}`)),
    [wardMembers, rows, dismissed]
  );

  const rosterHasBirthDates = useMemo(() => wardMembers.some(m => m.birth_date), [wardMembers]);

  const handleSave = async () => {
    if (!editing) return;
    const data = { ...editing };
    delete (data as Record<string, unknown>).id;
    if (editing.id) await update(editing.id, data as Record<string, unknown>);
    else await create(data as Record<string, unknown>);
    setEditing(null);
  };

  const trackSuggestion = (s: Suggestion) => {
    create({ member_name: s.name, ordinance_type: s.ordinance_type, status: 'Upcoming', target_date: '', completed_date: '', notes: '' });
  };

  const dismissSuggestion = (s: Suggestion) => {
    setDismissed(prev => new Set(prev).add(`${s.name.toLowerCase()}|${s.ordinance_type}`));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Ordinances</h1>
        <button onClick={() => setEditing({ ...EMPTY })} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">+ Add</button>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Baptisms and Aaronic Priesthood advancement, tracked from discussion through recording.
        Suggestions below are computed automatically from birth dates on Ward Members.
      </p>

      {!rosterHasBirthDates && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
          No birth dates are on file yet, so no suggestions can be computed. Add birth dates for children and youth on the{' '}
          <span className="font-medium">Ward Members</span> page to see suggested candidates here.
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h2 className="text-sm font-semibold text-blue-800 mb-2">Suggested this year ({suggestions.length})</h2>
          <div className="space-y-1.5">
            {suggestions.map(s => (
              <div key={`${s.name}|${s.ordinance_type}`} className="flex items-center justify-between bg-white rounded-md px-3 py-2 border border-blue-100">
                <span className="text-sm text-gray-800">{s.name} <span className="text-gray-400">— {s.ordinance_type} (turns {s.age} this year)</span></span>
                <div className="flex items-center gap-2">
                  <button onClick={() => trackSuggestion(s)} className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">Track</button>
                  <button onClick={() => dismissSuggestion(s)} className="text-xs px-2 py-1 rounded text-gray-500 hover:bg-gray-100">Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? <p className="text-gray-400 text-sm">Loading...</p> : rows.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No ordinances tracked yet — use "+ Add" above, or track a suggestion above.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map(o => (
            <div key={o.id} className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:shadow-sm" onClick={() => setEditing(o)}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900">{o.member_name}</h3>
                <div className="flex items-center gap-2">
                  <StatusBadge status={o.status} colors={ORDINANCE_STATUS_COLORS} />
                  <button onClick={async e => { e.stopPropagation(); if (await confirm(`Delete ${o.member_name} — ${o.ordinance_type}?`)) remove(o.id); }} className="text-red-400 hover:text-red-600 text-xs">Del</button>
                </div>
              </div>
              <div className="text-sm text-gray-500 space-y-0.5">
                <p>{o.ordinance_type}</p>
                {o.target_date && <p>Target: {toDateOnly(o.target_date)}</p>}
                {o.completed_date && <p>Completed: {toDateOnly(o.completed_date)}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Ordinance' : 'New Ordinance'}>
        {editing && (
          <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-3">
            <Input label="Member" value={editing.member_name || ''} onChange={v => setEditing({ ...editing, member_name: v })} required />
            <Select label="Ordinance" value={editing.ordinance_type || ''} onChange={v => setEditing({ ...editing, ordinance_type: v })} options={ORDINANCE_TYPES} required />
            <Select label="Status" value={editing.status || ''} onChange={v => setEditing({ ...editing, status: v })} options={ORDINANCE_STATUSES} />
            <Input label="Target Date" value={toDateOnly(editing.target_date || '')} onChange={v => setEditing({ ...editing, target_date: v })} type="date" />
            <Input label="Completed Date" value={toDateOnly(editing.completed_date || '')} onChange={v => setEditing({ ...editing, completed_date: v })} type="date" />
            <Textarea label="Notes" value={editing.notes || ''} onChange={v => setEditing({ ...editing, notes: v })} />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Save</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
