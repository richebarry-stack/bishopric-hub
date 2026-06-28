import { useState, useMemo } from 'react';
import { useTable } from '../lib/useTable';
import type { MemberNeed } from '../lib/api';
import Modal from '../components/Modal';
import { Input, Textarea } from '../components/FormFields';
import { MEMBER_NEED_TYPES } from '../lib/constants';
import { useAuth } from '../lib/auth';

const CUSTOM_TYPES_KEY = 'bishopric_member_need_types';

function getStoredTypes(): string[] {
  try { return JSON.parse(localStorage.getItem(CUSTOM_TYPES_KEY) || '[]'); } catch { return []; }
}

function addStoredType(type: string) {
  const existing = getStoredTypes();
  if (type && !existing.includes(type)) {
    localStorage.setItem(CUSTOM_TYPES_KEY, JSON.stringify([...existing, type]));
  }
}

const EMPTY: Partial<MemberNeed> = { who: '', what: '', type: '', notes: '', share_with: '', next_steps: '', pray_for: 0 };

function NeedTable({ rows, onEdit, onDelete, onTogglePray }: {
  rows: MemberNeed[];
  onEdit: (r: MemberNeed) => void;
  onDelete: (id: number) => void;
  onTogglePray: (r: MemberNeed) => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-3 py-2 text-gray-400 font-medium text-center w-8" title="Pray for">🙏</th>
            <th className="text-left px-3 py-2 font-medium text-gray-600">Who</th>
            <th className="text-left px-3 py-2 font-medium text-gray-600">What</th>
            <th className="text-left px-3 py-2 font-medium text-gray-600">Next Steps</th>
            <th className="text-left px-3 py-2 font-medium text-gray-600">Notes</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
              onClick={() => onEdit(r)}>
              <td className="px-3 py-2 text-center">
                <span
                  className={`text-base select-none cursor-pointer ${r.pray_for ? 'opacity-100' : 'opacity-25'}`}
                  onClick={e => { e.stopPropagation(); onTogglePray(r); }}
                >🙏</span>
              </td>
              <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{r.who}</td>
              <td className="px-3 py-2 text-gray-700">{r.what}</td>
              <td className="px-3 py-2 text-gray-600">{r.next_steps}</td>
              <td className="px-3 py-2 text-gray-500">{r.notes}</td>
              <td className="px-3 py-2">
                <button onClick={e => { e.stopPropagation(); onDelete(r.id); }} className="text-red-400 hover:text-red-600 text-xs">Del</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MemberNeeds() {
  const { user, selectedHub } = useAuth();
  const isWcContext = user?.hub === 'wc' || (user?.hub === 'both' && selectedHub === 'wc');
  const { rows, isLoading, create, update, remove } = useTable<MemberNeed>('member-needs');
  const [editing, setEditing] = useState<Partial<MemberNeed> | null>(null);
  const [, forceUpdate] = useState(0);

  // hub='both' users in WC context see only WC-shared items (hub='wc' backend already filters)
  const visibleRows = useMemo(
    () => (isWcContext && user?.hub === 'both') ? rows.filter(r => r.shared_with_wc) : rows,
    [rows, isWcContext, user]
  );

  const allTypes = useMemo(() => {
    const stored = getStoredTypes();
    const inUse = visibleRows.map(r => r.type).filter(Boolean) as string[];
    return [...new Set([...MEMBER_NEED_TYPES, ...stored, ...inUse])];
  }, [visibleRows]);

  const grouped = useMemo(() => {
    const map = new Map<string, MemberNeed[]>();
    for (const type of allTypes) map.set(type, []);
    for (const r of visibleRows) {
      const t = r.type || 'Other';
      if (!map.has(t)) map.set(t, []);
      map.get(t)!.push(r);
    }
    return [...map.entries()].filter(([, items]) => items.length > 0);
  }, [visibleRows, allTypes]);

  const handleSave = async () => {
    if (!editing) return;
    const type = editing.type || '';
    if (type && !MEMBER_NEED_TYPES.includes(type)) {
      addStoredType(type);
      forceUpdate(n => n + 1);
    }
    const data = { ...editing };
    delete (data as Record<string, unknown>).id;
    if (editing.id) await update(editing.id, data as Record<string, unknown>);
    else await create(data as Record<string, unknown>);
    setEditing(null);
  };

  const handleTogglePray = (r: MemberNeed) => {
    update(r.id, { pray_for: r.pray_for ? 0 : 1 });
  };

  const openNew = () => setEditing({ ...EMPTY, shared_with_wc: isWcContext ? 1 : 0 });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Member Needs</h1>
        <button onClick={openNew} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
          + Add Need
        </button>
      </div>
      {isWcContext && (
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 mb-4">
          Showing needs shared with Ward Council.
        </p>
      )}

      {isLoading ? <p className="text-gray-400 text-sm">Loading...</p> : (
        <div className="space-y-8">
          {grouped.map(([type, typeRows]) => (
            <section key={type}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                {type}
                <span className="text-gray-400 font-normal normal-case tracking-normal">({typeRows.length})</span>
              </h2>
              <NeedTable rows={typeRows} onEdit={setEditing} onDelete={remove} onTogglePray={handleTogglePray} />
            </section>
          ))}
          {grouped.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No member needs</p>}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Need' : 'New Need'}>
        {editing && (
          <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-3">
            <Input label="Who" value={editing.who || ''} onChange={v => setEditing({ ...editing, who: v })} required />
            <Textarea label="What" value={editing.what || ''} onChange={v => setEditing({ ...editing, what: v })} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <input
                list="member-need-type-options"
                value={editing.type || ''}
                onChange={e => setEditing({ ...editing, type: e.target.value })}
                placeholder="Select or type a new type…"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <datalist id="member-need-type-options">
                {allTypes.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>
            <Input label="Next Steps" value={editing.next_steps || ''} onChange={v => setEditing({ ...editing, next_steps: v })} />
            <Textarea label="Notes" value={editing.notes || ''} onChange={v => setEditing({ ...editing, notes: v })} />
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={!!editing.pray_for} onChange={e => setEditing({ ...editing, pray_for: e.target.checked ? 1 : 0 })} className="rounded" />
              Include in prayer list
            </label>
            {!isWcContext && (
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={!!editing.shared_with_wc} onChange={e => setEditing({ ...editing, shared_with_wc: e.target.checked ? 1 : 0 })} className="rounded" />
                Share with ward council
              </label>
            )}
            <div className="flex justify-between pt-2">
              <div>
                {editing.id && (
                  <button type="button" onClick={() => { remove(editing.id!); setEditing(null); }}
                    className="px-4 py-2 text-sm text-red-600 hover:text-red-800">Delete</button>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Save</button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
