import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTable } from '../lib/useTable';
import type { CallingPipeline as CallingType, MemberWithoutCalling, User } from '../lib/api';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { Input, Select, Checkbox, Textarea } from '../components/FormFields';
import { CALLING_STATUSES, CALLING_STATUS_COLORS, ORGANIZATIONS } from '../lib/constants';
import { renderRichText, stripBold } from '../lib/richText';

const ASSIGNED_DATALIST = 'assigned-to-options';

function AssignedToField({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">Assigned To</span>
      <input
        list={ASSIGNED_DATALIST}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Select or type name…"
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
      <datalist id={ASSIGNED_DATALIST}>
        {options.map(o => <option key={o} value={o} />)}
      </datalist>
    </label>
  );
}

// Member field with a "B" button that bolds the currently selected portion (markdown **...**).
function MemberInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const applyBold = () => {
    const el = ref.current;
    if (!el) return;
    const s = el.selectionStart ?? 0;
    const e = el.selectionEnd ?? 0;
    if (s === e) return; // nothing selected
    const before = value.slice(0, s), sel = value.slice(s, e), after = value.slice(e);
    const next = sel.length >= 4 && sel.startsWith('**') && sel.endsWith('**')
      ? before + sel.slice(2, -2) + after   // toggle off
      : before + '**' + sel + '**' + after; // toggle on
    onChange(next);
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">Member *</span>
        {/* onMouseDown preventDefault keeps the input's text selection from clearing on button click */}
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={applyBold}
          className="text-xs px-2 py-0.5 border border-gray-300 rounded hover:bg-gray-50 font-bold">B</button>
      </div>
      <input
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        required
        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
      <p className="text-xs text-gray-400 mt-1">
        Select text and click <span className="font-bold">B</span> to bold it. Preview: <span className="text-gray-600">{renderRichText(value) || '—'}</span>
      </p>
    </div>
  );
}

const EMPTY: Partial<CallingType> = {
  member: '', calling: '', status: '1. Discussion', assigned_to: '',
  sustain_recorded: 0, set_apart_recorded: 0, organization: '', type: 'Calling',
};

const EMPTY_MWC: Partial<MemberWithoutCalling> = { name: '', potential_calling: '', notes: '' };

export default function CallingPipeline() {
  const { rows, isLoading, create, update, remove } = useTable<CallingType>('calling-pipeline');
  const { data: allUsers = [] } = useQuery<User[]>({ queryKey: ['users'], queryFn: () => fetch('/api/users').then(r => r.json()) });
  const bishopricOptions = allUsers
    .filter(u => u.church_role && /bishop|counselor/i.test(u.church_role))
    .map(u => u.name);
  const { rows: mwcRows, create: mwcCreate, update: mwcUpdate, remove: mwcRemove } = useTable<MemberWithoutCalling>('members-without-callings');
  const [editing, setEditing] = useState<Partial<CallingType> | null>(null);
  const [editingMwc, setEditingMwc] = useState<Partial<MemberWithoutCalling> | null>(null);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [groupBy, setGroupBy] = useState<'status' | 'org' | 'sustained'>('status');
  const [orgStatusFilter, setOrgStatusFilter] = useState<Set<string>>(
    () => new Set(CALLING_STATUSES.filter(s => s !== '5. Sustained'))
  );
  const [saving, setSaving] = useState(false);

  const toggleOrgStatus = (s: string) =>
    setOrgStatusFilter(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });

  const filtered = rows.filter(r => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (filter) {
      const q = filter.toLowerCase();
      return stripBold(r.member).toLowerCase().includes(q) || r.calling?.toLowerCase().includes(q);
    }
    return true;
  });

  const handleSaveMwc = async () => {
    if (!editingMwc || saving) return;
    setSaving(true);
    try {
      const data = { ...editingMwc };
      delete (data as Record<string, unknown>).id;
      if (editingMwc.id) await mwcUpdate(editingMwc.id, data as Record<string, unknown>);
      else await mwcCreate(data as Record<string, unknown>);
      setEditingMwc(null);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!editing || saving) return;
    setSaving(true);
    try {
      const data = { ...editing };
      delete (data as Record<string, unknown>).id;
      if (editing.id) await update(editing.id, data as Record<string, unknown>);
      else await create(data as Record<string, unknown>);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const ACTION_STATUSES = new Set(['3. Approved and assigned', '7. Need to release']);
  const actionRows = rows.filter(r => ACTION_STATUSES.has(r.status));
  const callings = filtered.filter(r => r.type !== 'Release');
  const releases = filtered.filter(r => r.type === 'Release');

  const groupByStatus = (items: CallingType[]) => {
    const grouped = new Map<string, CallingType[]>();
    for (const r of items) {
      const status = r.status || 'Unknown';
      if (!grouped.has(status)) grouped.set(status, []);
      grouped.get(status)!.push(r);
    }
    return [...grouped.entries()].sort((a, b) => {
      const ia = CALLING_STATUSES.indexOf(a[0]);
      const ib = CALLING_STATUSES.indexOf(b[0]);
      return ia - ib;
    });
  };

  const groupByOrg = (items: CallingType[]) => {
    const grouped = new Map<string, CallingType[]>();
    for (const r of items) {
      const org = r.organization?.trim() || 'No Organization';
      if (!grouped.has(org)) grouped.set(org, []);
      grouped.get(org)!.push(r);
    }
    return [...grouped.entries()].sort((a, b) => {
      const ia = ORGANIZATIONS.indexOf(a[0]);
      const ib = ORGANIZATIONS.indexOf(b[0]);
      if (ia === -1 && ib === -1) return a[0].localeCompare(b[0]);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  };

  const renderGrouped = (items: CallingType[]) =>
    groupByStatus(items).map(([status, rows]) => (
      <div key={status} className="mb-6">
        <h3 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-2">
          <StatusBadge status={status} colors={CALLING_STATUS_COLORS} />
          <span>({rows.length})</span>
        </h3>
        <Table rows={rows} onEdit={setEditing} onDelete={remove} />
      </div>
    ));

  const renderGroupedByOrg = (items: CallingType[]) =>
    groupByOrg(items).map(([org, rows]) => {
      const callingRows = rows.filter(r => r.type !== 'Release');
      const releaseRows = rows.filter(r => r.type === 'Release');
      return (
        <div key={org} className="mb-8">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="bg-gray-100 text-gray-700 rounded px-2 py-0.5">{org}</span>
            <span className="text-gray-400">({rows.length})</span>
          </h3>
          {callingRows.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">Callings ({callingRows.length})</p>
              <Table rows={callingRows} onEdit={setEditing} onDelete={remove} />
            </div>
          )}
          {releaseRows.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1.5 ml-1">Releases ({releaseRows.length})</p>
              <Table rows={releaseRows} onEdit={setEditing} onDelete={remove} />
            </div>
          )}
        </div>
      );
    });

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Calling Pipeline</h1>
        <button onClick={() => setEditing({ ...EMPTY })} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
          + New Calling / Release
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search member or calling..."
          className="rounded-md border border-gray-300 px-3 py-2 text-sm flex-1" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {CALLING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex rounded-md border border-gray-300 overflow-hidden self-start sm:self-auto">
          {([['status', 'By Status'], ['org', 'By Org'], ['sustained', 'Needs Set Apart']] as const).map(([g, label]) => (
            <button key={g} onClick={() => setGroupBy(g)}
              className={`px-3 py-2 text-xs font-medium transition-colors border-r last:border-r-0 border-gray-300 ${
                groupBy === g ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {groupBy === 'org' && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {CALLING_STATUSES.map(s => (
            <button key={s} onClick={() => toggleOrgStatus(s)}
              className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                orgStatusFilter.has(s)
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-400 line-through'
              }`}>
              {s}
            </button>
          ))}
        </div>
      )}

      {!isLoading && actionRows.length > 0 && groupBy !== 'sustained' && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-amber-700 mb-3">
            Needs Action ({actionRows.length})
          </h2>
          <Table rows={actionRows} onEdit={setEditing} onDelete={remove} />
        </div>
      )}

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : statusFilter ? (
        <Table rows={filtered} onEdit={setEditing} onDelete={remove} />
      ) : groupBy === 'sustained' ? (() => {
          const sustainedRows = filtered.filter(r => r.status === '5. Sustained');
          return (
            <>
              <h2 className="text-lg font-bold text-gray-800 mb-3 border-b border-gray-200 pb-2">Needs Set Apart ({sustainedRows.length})</h2>
              {sustainedRows.length === 0
                ? <p className="text-gray-400 text-sm">No sustained callings.</p>
                : renderGroupedByOrg(sustainedRows)}
            </>
          );
        })()
      : groupBy === 'org' ? (() => {
          const orgFiltered = filtered.filter(r => orgStatusFilter.has(r.status ?? ''));
          return (
            <>
              <h2 className="text-lg font-bold text-gray-800 mb-3 border-b border-gray-200 pb-2">By Organization ({orgFiltered.length})</h2>
              {renderGroupedByOrg(orgFiltered)}
            </>
          );
        })()
      : (
        <>
          <h2 className="text-lg font-bold text-gray-800 mb-3 border-b border-gray-200 pb-2">Callings ({callings.length})</h2>
          {renderGrouped(callings)}

          <h2 className="text-lg font-bold text-gray-800 mb-3 mt-8 border-b border-gray-200 pb-2">Releases ({releases.length})</h2>
          {renderGrouped(releases)}
        </>
      )}

      {groupBy === 'status' && !statusFilter && (
        <div className="mt-10">
          <div className="flex items-center justify-between mb-3 border-b border-gray-200 pb-2">
            <h2 className="text-lg font-bold text-gray-800">Members Without Callings ({mwcRows.length})</h2>
            <button onClick={() => setEditingMwc({ ...EMPTY_MWC })} className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700">+ Add</button>
          </div>
          {mwcRows.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 border-dashed p-4 text-center text-gray-400 text-sm">No members listed</div>
          ) : (
            <MwcTable rows={mwcRows} onEdit={setEditingMwc} onDelete={mwcRemove} />
          )}
        </div>
      )}

      <Modal open={!!editingMwc} onClose={() => setEditingMwc(null)} title={editingMwc?.id ? 'Edit Member' : 'Add Member Without Calling'}>
        {editingMwc && (
          <form onSubmit={e => { e.preventDefault(); handleSaveMwc(); }} className="space-y-3">
            <Input label="Name" value={editingMwc.name || ''} onChange={v => setEditingMwc({ ...editingMwc, name: v })} required />
            <Input label="Potential Calling" value={editingMwc.potential_calling || ''} onChange={v => setEditingMwc({ ...editingMwc, potential_calling: v })} />
            <Textarea label="Notes" value={editingMwc.notes || ''} onChange={v => setEditingMwc({ ...editingMwc, notes: v })} />
            <div className="flex justify-between pt-2">
              <div>
                {editingMwc.id && (
                  <button type="button" onClick={() => { mwcRemove(editingMwc.id!); setEditingMwc(null); }} className="px-4 py-2 text-sm text-red-600 hover:text-red-800">Delete</button>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditingMwc(null)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">Save</button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Calling' : 'New Calling'}>
        {editing && (
          <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-3">
            <MemberInput value={editing.member || ''} onChange={v => setEditing({ ...editing, member: v })} />
            <Input label="Calling" value={editing.calling || ''} onChange={v => setEditing({ ...editing, calling: v })} required />
            <div>
              <span className="text-sm font-medium text-gray-700">Type</span>
              <div className="flex gap-4 mt-1">
                {(['Calling', 'Release'] as const).map(t => (
                  <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="calling-type" value={t}
                      checked={(editing.type || 'Calling') === t}
                      onChange={() => setEditing({ ...editing, type: t })}
                      className="text-blue-600" />
                    <span className="text-sm text-gray-700">{t}</span>
                  </label>
                ))}
              </div>
            </div>
            <Select label="Status" value={editing.status || ''} onChange={v => setEditing({ ...editing, status: v })} options={CALLING_STATUSES} />
            <AssignedToField value={editing.assigned_to || ''} onChange={v => setEditing({ ...editing, assigned_to: v })} options={bishopricOptions} />
            <Select label="Organization" value={editing.organization || ''} onChange={v => setEditing({ ...editing, organization: v })} options={ORGANIZATIONS} />
            <Checkbox label="Sustain recorded in LCR" checked={!!editing.sustain_recorded} onChange={v => setEditing({ ...editing, sustain_recorded: v ? 1 : 0 })} />
            <Checkbox label="Setting apart recorded in LCR" checked={!!editing.set_apart_recorded} onChange={v => setEditing({ ...editing, set_apart_recorded: v ? 1 : 0 })} />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50">Save</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

type MwcSortKey = 'name' | 'potential_calling' | 'notes';

function MwcTable({ rows, onEdit, onDelete }: { rows: MemberWithoutCalling[]; onEdit: (r: MemberWithoutCalling) => void; onDelete: (id: number) => void }) {
  const [sortKey, setSortKey] = useState<MwcSortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (key: MwcSortKey) => {
    if (key === sortKey) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  };

  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const av = (a[sortKey] ?? '') as string;
    const bv = (b[sortKey] ?? '') as string;
    return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
  }), [rows, sortKey, sortAsc]);

  const Th = ({ col, label }: { col: MwcSortKey; label: string }) => (
    <th className="text-left px-3 py-2 font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900 whitespace-nowrap"
      onClick={() => handleSort(col)}>
      {label}
      <span className="ml-1 text-gray-400">{sortKey === col ? (sortAsc ? '↑' : '↓') : '↕'}</span>
    </th>
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <Th col="name" label="Name" />
            <Th col="potential_calling" label="Potential Calling" />
            <Th col="notes" label="Notes" />
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => (
            <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => onEdit(r)}>
              <td className="px-3 py-2 font-medium text-gray-900">{r.name}</td>
              <td className="px-3 py-2 text-gray-700">{r.potential_calling}</td>
              <td className="px-3 py-2 text-gray-600">{r.notes}</td>
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

type SortKey = 'member' | 'calling' | 'status' | 'assigned_to' | 'organization';

function Table({ rows, onEdit, onDelete }: { rows: CallingType[]; onEdit: (r: CallingType) => void; onDelete: (id: number) => void }) {
  const [sortKey, setSortKey] = useState<SortKey>('member');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  };

  const sorted = useMemo(() => [...rows].sort((a, b) => {
    let av = '', bv = '';
    if (sortKey === 'status') {
      av = String(CALLING_STATUSES.indexOf(a.status ?? ''));
      bv = String(CALLING_STATUSES.indexOf(b.status ?? ''));
    } else {
      av = (a[sortKey] ?? '') as string;
      bv = (b[sortKey] ?? '') as string;
      if (sortKey === 'member') { av = stripBold(av); bv = stripBold(bv); }
    }
    return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
  }), [rows, sortKey, sortAsc]);

  const Th = ({ col, label }: { col: SortKey; label: string }) => (
    <th className="text-left px-3 py-2 font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900 whitespace-nowrap"
      onClick={() => handleSort(col)}>
      {label}
      <span className="ml-1 text-gray-400">{sortKey === col ? (sortAsc ? '↑' : '↓') : '↕'}</span>
    </th>
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <Th col="member" label="Member" />
            <Th col="calling" label="Calling" />
            <Th col="status" label="Status" />
            <Th col="assigned_to" label="Assigned To" />
            <Th col="organization" label="Org" />
            <th className="text-left px-3 py-2 font-medium text-gray-600">LCR</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => (
            <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => onEdit(r)}>
              <td className="px-3 py-2 font-medium text-gray-900">{renderRichText(r.member)}</td>
              <td className="px-3 py-2 text-gray-700">{r.calling}</td>
              <td className="px-3 py-2"><StatusBadge status={r.status} colors={CALLING_STATUS_COLORS} /></td>
              <td className="px-3 py-2 text-gray-600">{r.assigned_to}</td>
              <td className="px-3 py-2 text-gray-600">{r.organization}</td>
              <td className="px-3 py-2 text-gray-600">
                {r.sustain_recorded ? '✓S' : ''}{r.set_apart_recorded ? ' ✓A' : ''}
              </td>
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
