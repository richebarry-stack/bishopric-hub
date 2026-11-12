import { useState } from 'react';
import { useTable } from '../lib/useTable';
import type { RotatingAssignment, User } from '../lib/api';
import Modal from '../components/Modal';
import { useConfirm } from '../components/ConfirmDialog';

const CLS = 'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** The bishopric, in order, by the Church Role set on the Users page. */
const BISHOPRIC_ROLES = ['Bishop', 'First Counselor', 'Second Counselor'];

/**
 * A dropdown that also keeps a saved value that isn't one of the choices
 * (for example a former counselor's name), so opening an entry never loses it.
 */
function PickField({ label, value, onChange, options, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  const known = options.some(o => o.value === value);
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} className={CLS}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        {value && !known && <option value={value}>{value} (not current)</option>}
      </select>
    </label>
  );
}

const EMPTY: Partial<RotatingAssignment> = { month: '', plan_conduct: '', primary_message: '' };

export default function Assignments() {
  const { rows, isLoading, create, update, remove } = useTable<RotatingAssignment>('rotating-assignments');
  const { rows: users } = useTable<User>('users');
  // Whoever currently holds Bishop, First Counselor and Second Counselor (Users page → Church Role).
  const bishopric = users
    .filter(u => u.church_role && BISHOPRIC_ROLES.includes(u.church_role))
    .sort((a, b) => BISHOPRIC_ROLES.indexOf(a.church_role!) - BISHOPRIC_ROLES.indexOf(b.church_role!) || a.name.localeCompare(b.name))
    .map(u => ({ value: u.name, label: `${u.name} — ${u.church_role}` }));
  const monthOptions = MONTHS.map(m => ({ value: m, label: m }));
  const [editing, setEditing] = useState<Partial<RotatingAssignment> | null>(null);
  const confirm = useConfirm();

  const handleSave = async () => {
    if (!editing) return;
    const data = { ...editing };
    delete (data as Record<string, unknown>).id;
    if (editing.id) await update(editing.id, data as Record<string, unknown>);
    else await create(data as Record<string, unknown>);
    setEditing(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Bishopric Assignments</h1>
        <button onClick={() => setEditing({ ...EMPTY })} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">+ Add</button>
      </div>
      <p className="text-sm text-gray-500 mb-4">Rotating monthly assignments for who plans/conducts sacrament meeting and gives the primary message — auto-fills Conducting on the sacrament agenda.</p>

      {isLoading ? <p className="text-gray-400 text-sm">Loading...</p> : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-3 py-2 font-medium text-gray-600">Month</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Plan & Conduct</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Primary Message</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-400">No assignments yet — use "+ Add" above to create the first one.</td></tr>
              )}
              {rows.map(r => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => setEditing(r)}>
                  <td className="px-3 py-2 font-medium text-gray-900">{r.month}</td>
                  <td className="px-3 py-2 text-gray-700">{r.plan_conduct}</td>
                  <td className="px-3 py-2 text-gray-700">{r.primary_message}</td>
                  <td className="px-3 py-2">
                    <button onClick={async e => { e.stopPropagation(); if (await confirm(`Delete the ${r.month} assignment?`)) remove(r.id); }} className="text-red-400 hover:text-red-600 text-xs">Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit' : 'New Assignment'}>
        {editing && (
          <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-3">
            <PickField label="Month" value={editing.month || ''} onChange={v => setEditing({ ...editing, month: v })}
              options={monthOptions} placeholder="Choose a month…" />
            <PickField label="Plan & Conduct" value={editing.plan_conduct || ''} onChange={v => setEditing({ ...editing, plan_conduct: v })}
              options={bishopric} placeholder="Choose a member of the bishopric…" />
            <PickField label="Primary Message" value={editing.primary_message || ''} onChange={v => setEditing({ ...editing, primary_message: v })}
              options={bishopric} placeholder="Choose a member of the bishopric…" />
            {bishopric.length === 0 && (
              <p className="text-xs text-amber-700">No one has the Church Role Bishop, First Counselor or Second Counselor yet. Set it on the Users page.</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button type="submit" disabled={!editing.month} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">Save</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
