import { useMemo, useState } from 'react';
import { useTable } from '../lib/useTable';
import type { WelfareCase } from '../lib/api';
import Modal from '../components/Modal';
import MemberNameInput from '../components/MemberNameInput';
import StatusBadge from '../components/StatusBadge';
import { Input, Select, Textarea } from '../components/FormFields';
import { useConfirm } from '../components/ConfirmDialog';

const WELFARE_HELP_TYPES = ['Fast offering assistance', "Bishop's order (food/commodities)", 'Self-reliance plan', 'Employment / education referral', 'Counseling / Family Services referral', 'Other'];
const STATUSES = ['Open', 'Monitoring', 'Closed'];
const COLORS: Record<string, { bg: string; text: string }> = {
  Open: { bg: 'bg-amber-100', text: 'text-amber-800' },
  Monitoring: { bg: 'bg-blue-100', text: 'text-blue-800' },
  Closed: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

const EMPTY: Partial<WelfareCase> = { member_name: '', help_type: '', status: 'Open', next_follow_up: '', notes: '' };

function todayKey(): string {
  return new Date().toLocaleDateString('en-CA');
}

export default function Welfare() {
  const { rows, isLoading, create, update, remove } = useTable<WelfareCase>('welfare-cases');
  const [editing, setEditing] = useState<Partial<WelfareCase> | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const confirm = useConfirm();
  const today = todayKey();

  const open = useMemo(() => rows.filter(r => r.status !== 'Closed'), [rows]);
  const closed = useMemo(() => rows.filter(r => r.status === 'Closed'), [rows]);

  const handleSave = async () => {
    if (!editing || !editing.member_name?.trim()) return;
    const data = {
      member_name: editing.member_name.trim(), help_type: editing.help_type || '', status: editing.status || 'Open',
      next_follow_up: editing.status === 'Closed' ? '' : (editing.next_follow_up || ''), notes: editing.notes || '',
    };
    if (editing.id) await update(editing.id, data);
    else await create(data);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!editing?.id) return;
    if (!await confirm({ message: `Delete ${editing.member_name}'s welfare record?` })) return;
    await remove(editing.id);
    setEditing(null);
  };

  const table = (list: WelfareCase[]) => (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Member / household</th>
            <th className="text-left px-3 py-2 font-medium">Help</th>
            <th className="text-left px-3 py-2 font-medium">Status</th>
            <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Next follow-up</th>
          </tr>
        </thead>
        <tbody>
          {list.map(r => {
            const due = (r.next_follow_up || '').slice(0, 10);
            const overdue = r.status !== 'Closed' && !!due && due < today;
            return (
              <tr key={r.id} onClick={() => setEditing(r)} className="border-t border-gray-100 cursor-pointer hover:bg-gray-50 align-top">
                <td className="px-3 py-2 font-medium text-gray-900">
                  {r.member_name}
                  {r.notes && <p className="text-xs font-normal text-gray-500 line-clamp-2">{r.notes}</p>}
                </td>
                <td className="px-3 py-2 text-gray-600">{r.help_type || '—'}</td>
                <td className="px-3 py-2"><StatusBadge status={r.status} colors={COLORS} /></td>
                <td className={`px-3 py-2 whitespace-nowrap ${overdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                  {due || '—'}{overdue ? ' (overdue)' : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Welfare Follow-up</h1>
        <button onClick={() => setEditing({ ...EMPTY })} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">+ Add</button>
      </div>
      <p className="text-sm text-gray-500 mb-1">
        Who the bishop is helping with temporal needs and when to follow up (General Handbook chapter 22).
      </p>
      <p className="text-xs text-gray-400 mb-4">
        🔒 Only the Bishop and Clerk can see this page. Keep amounts and details in the Church's own systems; follow-ups due within a week show
        in the Bishop's My Actions.
      </p>

      {isLoading ? <p className="text-gray-400 text-sm">Loading...</p> : open.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No open welfare follow-ups.</p>
      ) : table(open)}

      {closed.length > 0 && (
        <div className="mt-6">
          <button type="button" onClick={() => setShowClosed(v => !v)} className="text-sm text-gray-600 hover:text-gray-900 font-medium mb-2">
            {showClosed ? '▾' : '▸'} Closed ({closed.length})
          </button>
          {showClosed && table(closed)}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Welfare Follow-up' : 'New Welfare Follow-up'}>
        {editing && (
          <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-3">
            <MemberNameInput label="Member / household" format="firstLast" value={editing.member_name || ''} onChange={v => setEditing({ ...editing, member_name: v })} required />
            <Select label="Type of help" value={editing.help_type || ''} onChange={v => setEditing({ ...editing, help_type: v })} options={WELFARE_HELP_TYPES} placeholder="Select…" />
            <Select label="Status" value={editing.status || 'Open'} onChange={v => setEditing({ ...editing, status: v })} options={STATUSES} />
            {editing.status !== 'Closed' && (
              <Input label="Next follow-up" type="date" value={(editing.next_follow_up || '').slice(0, 10)} onChange={v => setEditing({ ...editing, next_follow_up: v })} />
            )}
            <Textarea label="Notes (brief)" value={editing.notes || ''} onChange={v => setEditing({ ...editing, notes: v })} />
            <div className="flex justify-between pt-2">
              <div>
                {editing.id && <button type="button" onClick={handleDelete} className="px-4 py-2 text-sm text-red-600 hover:text-red-800">Delete</button>}
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
