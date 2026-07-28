import { useState, useMemo, useCallback } from 'react';
import { useTable } from '../lib/useTable';
import { toast } from '../lib/toast';
import { useConfirm } from '../components/ConfirmDialog';
import { useAuth } from '../lib/auth';
import { legalName } from '../lib/displayName';
import type { WardMember, InterviewPipeline, CallingPipeline, MemberCalling, RosterReviewFlag } from '../lib/api';
import WardMemberImport from '../components/WardMemberImport';
import { YOUTH_TYPES, formatRecommendDate } from '../components/interviews/shared';
import { CALLING_STATUSES, CALLING_STATUS_COLORS } from '../lib/constants';
import StatusBadge from '../components/StatusBadge';

function normCalling(s: string): string {
  return s.trim().toLowerCase();
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
      <div className="flex gap-1"
        onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) commit(); }}>
        <input autoFocus value={last} onChange={e => setLast(e.target.value)} placeholder="Last"
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false); }}
          className="text-sm rounded border border-gray-300 px-1.5 py-0.5 w-24" />
        <input value={first} onChange={e => setFirst(e.target.value)} placeholder="First"
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false); }}
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
      <div className="flex gap-1"
        onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) commit(); }}>
        <input autoFocus value={last} onChange={e => setLast(e.target.value)} placeholder="Last"
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false); }}
          className="text-xs rounded border border-gray-300 px-1.5 py-0.5 w-20" />
        <input value={first} onChange={e => setFirst(e.target.value)} placeholder="First"
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditing(false); }}
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

function RecommendCell({ member, onSave }: { member: WardMember; onSave: (fields: { recommend_type: string; recommend_expires: string }) => void }) {
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState(member.recommend_type || '');
  const [expires, setExpires] = useState((member.recommend_expires || '').slice(0, 7));

  if (editing) {
    const commit = () => {
      setEditing(false);
      if (type !== (member.recommend_type || '') || expires !== (member.recommend_expires || '').slice(0, 7)) {
        onSave({ recommend_type: type, recommend_expires: expires });
      }
    };
    return (
      <div className="flex gap-1"
        onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) commit(); }}>
        <select value={type} onChange={e => setType(e.target.value)}
          className="text-xs rounded border border-gray-300 px-1 py-0.5">
          <option value="">—</option>
          <option value="Endowed">Endowed</option>
          <option value="Limited">Limited</option>
        </select>
        <input type="month" value={expires} onChange={e => setExpires(e.target.value)}
          className="text-xs rounded border border-gray-300 px-1 py-0.5" />
      </div>
    );
  }
  const shown = member.recommend_type
    ? `${member.recommend_type}${member.recommend_expires ? ` · ${formatRecommendDate(member.recommend_expires)}` : ''}`
    : '';
  return (
    <button type="button" onClick={() => setEditing(true)}
      className="text-xs text-gray-500 hover:text-blue-600 hover:underline" aria-label={`Edit temple recommend for ${legalName(member)}`}>
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

function CallingsCell({ tracked, lcrOnly, expanded, onToggle }: { tracked: CallingPipeline[]; lcrOnly: MemberCalling[]; expanded: boolean; onToggle: () => void }) {
  const names = [...tracked.map(c => c.calling), ...lcrOnly.map(c => c.calling)].join(', ');
  const count = tracked.length + lcrOnly.length;
  return (
    <button type="button" onClick={onToggle}
      className="text-left text-xs text-gray-600 hover:text-blue-600 hover:underline max-w-[180px] truncate block"
      title={names || undefined}>
      {names || <span className="text-gray-300">—</span>}
      {count > 0 && <span className="ml-1 text-gray-400">{expanded ? '▲' : '▼'}</span>}
    </button>
  );
}

function CallingEditRow({ calling, onUpdate }: { calling: CallingPipeline; onUpdate: (fields: Record<string, unknown>) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-1.5 border-b border-gray-100 last:border-0 text-sm">
      <span className="flex-1 min-w-[120px] text-gray-800">{calling.calling}</span>
      <StatusBadge status={calling.status} colors={CALLING_STATUS_COLORS} />
      <select value={calling.status} onChange={e => onUpdate({ status: e.target.value })}
        aria-label={`Status for ${calling.calling}`}
        className="text-xs rounded border border-gray-300 px-1.5 py-0.5">
        {CALLING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <label className="flex items-center gap-1 text-xs text-gray-500">
        Sustained
        <input type="date" value={(calling.sustained_date || '').slice(0, 10)}
          onChange={e => onUpdate({ sustained_date: e.target.value })}
          aria-label={`Sustained date for ${calling.calling}`}
          className="text-xs rounded border border-gray-300 px-1.5 py-0.5" />
      </label>
      <label className="flex items-center gap-1 text-xs text-gray-600">
        <input type="checkbox" checked={!!calling.set_apart_recorded}
          onChange={e => onUpdate({ set_apart_recorded: e.target.checked ? 1 : 0 })}
          className="rounded border-gray-300" />
        Set apart
      </label>
    </div>
  );
}

function LcrCallingRow({ calling, onConsiderForRelease }: { calling: MemberCalling; onConsiderForRelease: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-1.5 border-b border-gray-100 last:border-0 text-sm">
      <span className="flex-1 min-w-[120px] text-gray-800">{calling.calling}</span>
      <span className="text-xs text-gray-400">{calling.organization}</span>
      {calling.sustained_date && <span className="text-xs text-gray-400">Sustained {calling.sustained_date}</span>}
      {!!calling.set_apart && <span className="text-xs text-gray-400">Set apart</span>}
      <button type="button" onClick={onConsiderForRelease}
        title="Start tracking this calling in the Calling Pipeline, flagged as needing release"
        className="text-xs px-2 py-0.5 rounded text-orange-600 hover:bg-orange-50">
        Consider for release
      </button>
    </div>
  );
}

interface GroupedRows {
  adults: WardMember[];
  youth: WardMember[];
  children: WardMember[];
  unknown: WardMember[];
}

function MemberSection({ title, members, onToggleActive, onDelete, onToggleExclude, onSaveBirthDate, onSaveGender, onSaveName, onSavePreferredName, onToggleOutOfWard, onSaveRecommend, callingsByMember, lcrCallingsByMember, expandedId, onToggleExpand, onUpdateCalling, onConsiderForRelease, sortByCallingDate, callingSortAsc, onToggleCallingSort, showRecommend = true }: {
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
  onSaveRecommend: (m: WardMember, fields: { recommend_type: string; recommend_expires: string }) => void;
  callingsByMember: Map<number, CallingPipeline[]>;
  lcrCallingsByMember: Map<number, MemberCalling[]>;
  expandedId: number | null;
  onToggleExpand: (id: number) => void;
  onUpdateCalling: (callingId: number, fields: Record<string, unknown>) => void;
  onConsiderForRelease: (m: WardMember, calling: MemberCalling) => void;
  sortByCallingDate: boolean;
  callingSortAsc: boolean;
  onToggleCallingSort: () => void;
  showRecommend?: boolean;
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
              {showRecommend && <th className="text-left px-4 py-2 font-medium text-gray-600 w-40">Temple Recommend</th>}
              <th className="text-center px-4 py-2 font-medium text-gray-600 w-16">Gender</th>
              <th className="text-center px-4 py-2 font-medium text-gray-600 w-24">Status</th>
              <th className="text-center px-4 py-2 font-medium text-gray-600 w-28">Speakers</th>
              <th className="text-center px-4 py-2 font-medium text-gray-600 w-28">Prayers</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600 w-44">
                <button type="button" onClick={onToggleCallingSort} className="hover:text-gray-900 inline-flex items-center gap-1"
                  title="Sort by most recent calling (sustained) date">
                  Callings
                  {sortByCallingDate && <span className="text-gray-400">{callingSortAsc ? '▲' : '▼'}</span>}
                </button>
              </th>
              <th className="text-right px-4 py-2 font-medium text-gray-600 w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map(m => {
              const memberCallings = callingsByMember.get(m.id) || [];
              const trackedNorm = new Set(memberCallings.map(c => normCalling(c.calling)));
              const lcrOnly = (lcrCallingsByMember.get(m.id) || []).filter(c => !trackedNorm.has(normCalling(c.calling)));
              return (
              <>
              <tr key={m.id} className={`border-b border-gray-50 hover:bg-gray-50 ${!m.active ? 'opacity-60' : ''}`}>
                <td className="px-4 py-2 font-medium text-gray-900">
                  <NameCell member={m} onSave={fields => onSaveName(m, fields)} />
                  <AgeTag birthDate={m.birth_date} />
                  {!!m.out_of_ward && (
                    <span title="Attends here, but their membership record is in another ward. Informational only."
                      className="text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 ml-1.5 align-middle">Records elsewhere</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <PreferredNameCell member={m} onSave={fields => onSavePreferredName(m, fields)} />
                </td>
                <td className="px-4 py-2">
                  <BirthDateCell member={m} onSave={v => onSaveBirthDate(m, v)} />
                </td>
                {showRecommend && (
                  <td className="px-4 py-2">
                    <RecommendCell member={m} onSave={fields => onSaveRecommend(m, fields)} />
                  </td>
                )}
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
                <td className="px-4 py-2">
                  <CallingsCell tracked={memberCallings} lcrOnly={lcrOnly} expanded={expandedId === m.id} onToggle={() => onToggleExpand(m.id)} />
                </td>
                <td className="px-4 py-2 text-right space-x-2">
                  <button onClick={() => onToggleOutOfWard(m)}
                    title="Informational flag only — does not remove them from ward lists or affect Speakers/Prayers eligibility."
                    className="text-xs px-2 py-1 rounded text-amber-600 hover:bg-amber-50">
                    {m.out_of_ward ? 'Clear "records elsewhere" flag' : 'Flag: records elsewhere'}
                  </button>
                  <button onClick={() => onToggleActive(m)}
                    title="Removes them from the active ward roster and hides them from Speakers/Prayers, but keeps their history."
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
              {expandedId === m.id && (
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td colSpan={showRecommend ? 10 : 9} className="px-4 py-2">
                    {memberCallings.length === 0 && lcrOnly.length === 0 ? (
                      <p className="text-xs text-gray-400">No current callings.</p>
                    ) : (
                      <>
                        {memberCallings.map(c => (
                          <CallingEditRow key={c.id} calling={c} onUpdate={fields => onUpdateCalling(c.id, fields)} />
                        ))}
                        {lcrOnly.map(c => (
                          <LcrCallingRow key={c.id} calling={c} onConsiderForRelease={() => onConsiderForRelease(m, c)} />
                        ))}
                      </>
                    )}
                  </td>
                </tr>
              )}
              </>
            );})}
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
  const { rows: interviews, update: updateInterview } = useTable<InterviewPipeline>('interview-pipeline');
  const { rows: callings, create: createCalling, update: updateCalling } = useTable<CallingPipeline>('calling-pipeline');
  const { rows: lcrCallings } = useTable<MemberCalling>('member-callings');
  const { rows: reviewFlags, remove: removeReviewFlag } = useTable<RosterReviewFlag>('roster-review-flags');
  const [filter, setFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [newLast, setNewLast] = useState('');
  const [newFirst, setNewFirst] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const callingsByMember = useMemo(() => {
    const m = new Map<number, CallingPipeline[]>();
    for (const c of callings) {
      if (c.type !== 'Calling' || c.ward_member_id === null || c.status === '9. Released' || c.status === '10. Declined') continue;
      const list = m.get(c.ward_member_id) || [];
      list.push(c);
      m.set(c.ward_member_id, list);
    }
    return m;
  }, [callings]);

  const lcrCallingsByMember = useMemo(() => {
    const m = new Map<number, MemberCalling[]>();
    for (const c of lcrCallings) {
      const list = m.get(c.ward_member_id) || [];
      list.push(c);
      m.set(c.ward_member_id, list);
    }
    return m;
  }, [lcrCallings]);

  const toggleExpand = useCallback((id: number) => {
    setExpandedId(prev => (prev === id ? null : id));
  }, []);

  const considerForRelease = useCallback((m: WardMember, calling: MemberCalling) => {
    createCalling({
      member: legalName(m),
      calling: calling.calling,
      organization: calling.organization,
      status: '7. Need to release',
      assigned_to: '',
      sustain_recorded: 1,
      set_apart_recorded: calling.set_apart ? 1 : 0,
      release_recorded: 0,
      type: 'Calling',
      ward_member_id: m.id,
      sustained_date: calling.sustained_date,
    } as unknown as Record<string, unknown>);
  }, [createCalling]);

  // Click "Callings" header: off -> newest first -> oldest first -> off.
  const [sortByCallingDate, setSortByCallingDate] = useState(false);
  const [callingSortAsc, setCallingSortAsc] = useState(false);
  const toggleCallingSort = useCallback(() => {
    if (!sortByCallingDate) { setSortByCallingDate(true); setCallingSortAsc(false); }
    else if (!callingSortAsc) { setCallingSortAsc(true); }
    else { setSortByCallingDate(false); }
  }, [sortByCallingDate, callingSortAsc]);

  // Most recent sustained date among a member's callings (tracked + full LCR list), or null if none.
  const mostRecentSustainedDate = useCallback((memberId: number): string | null => {
    const tracked = callingsByMember.get(memberId) || [];
    const lcr = lcrCallingsByMember.get(memberId) || [];
    let max: string | null = null;
    for (const c of [...tracked, ...lcr]) {
      if (c.sustained_date && (!max || c.sustained_date > max)) max = c.sustained_date;
    }
    return max;
  }, [callingsByMember, lcrCallingsByMember]);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    return rows
      .filter(r => showInactive || r.active)
      .filter(r => !q || legalName(r).toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.active !== b.active) return b.active - a.active;
        if (sortByCallingDate) {
          const da = mostRecentSustainedDate(a.id);
          const db = mostRecentSustainedDate(b.id);
          if (da !== db) {
            if (!da) return 1;
            if (!db) return -1;
            return callingSortAsc ? da.localeCompare(db) : db.localeCompare(da);
          }
        }
        return legalName(a).localeCompare(legalName(b));
      });
  }, [rows, filter, showInactive, sortByCallingDate, callingSortAsc, mostRecentSustainedDate]);

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

  const saveRecommend = useCallback((m: WardMember, fields: { recommend_type: string; recommend_expires: string }) => {
    update(m.id, fields as unknown as Record<string, unknown>);
    const linkedYouthInterview = interviews.find(i => i.ward_member_id === m.id && YOUTH_TYPES.has(i.type_of_interview));
    if (linkedYouthInterview && (linkedYouthInterview.date_recommend_expires || '').slice(0, 7) !== fields.recommend_expires) {
      updateInterview(linkedYouthInterview.id, { date_recommend_expires: fields.recommend_expires } as unknown as Record<string, unknown>, { silent: true });
    }
  }, [update, interviews, updateInterview]);

  const confirm = useConfirm();
  const handleDelete = useCallback(async (m: WardMember) => {
    if (await confirm({ message: `Permanently delete ${legalName(m)}? This cannot be undone.` })) remove(m.id);
  }, [remove, confirm]);

  const updateCallingFields = useCallback((callingId: number, fields: Record<string, unknown>) => {
    updateCalling(callingId, fields);
  }, [updateCalling]);

  const reviewFlagMembers = useMemo(() => {
    return reviewFlags
      .map(f => ({ flag: f, member: rows.find(r => r.id === f.ward_member_id) }))
      .filter((x): x is { flag: RosterReviewFlag; member: WardMember } => !!x.member);
  }, [reviewFlags, rows]);

  const handleFlagOutOfWard = useCallback((flag: RosterReviewFlag, m: WardMember) => {
    toggleOutOfWard(m);
    removeReviewFlag(flag.id);
  }, [toggleOutOfWard, removeReviewFlag]);

  const handleRemoveFromWardReview = useCallback((flag: RosterReviewFlag, m: WardMember) => {
    toggleActive(m);
    removeReviewFlag(flag.id);
  }, [toggleActive, removeReviewFlag]);

  const handleDismissFlag = useCallback((flag: RosterReviewFlag) => {
    removeReviewFlag(flag.id);
  }, [removeReviewFlag]);

  const sectionProps = {
    onToggleActive: toggleActive, onDelete: handleDelete, onToggleExclude: toggleExclude,
    onSaveBirthDate: saveBirthDate, onSaveGender: saveGender, onSaveName: saveName,
    onSavePreferredName: savePreferredName, onToggleOutOfWard: toggleOutOfWard, onSaveRecommend: saveRecommend,
    callingsByMember, lcrCallingsByMember, expandedId, onToggleExpand: toggleExpand, onUpdateCalling: updateCallingFields,
    onConsiderForRelease: considerForRelease,
    sortByCallingDate, callingSortAsc, onToggleCallingSort: toggleCallingSort,
  };

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

      {reviewFlagMembers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <p className="text-sm font-medium text-amber-800 mb-2">
            Not found in LCR's Member Directory ({reviewFlagMembers.length}) — records elsewhere, moved, or a name mismatch?
          </p>
          <div className="space-y-1.5">
            {reviewFlagMembers.map(({ flag, member }) => (
              <div key={flag.id} className="flex items-center gap-3 text-sm">
                <span className="flex-1 text-gray-800">{legalName(member)}</span>
                <button type="button" onClick={() => handleFlagOutOfWard(flag, member)}
                  className="text-xs px-2 py-1 rounded text-amber-700 hover:bg-amber-100">
                  Flag: records elsewhere
                </button>
                <button type="button" onClick={() => handleRemoveFromWardReview(flag, member)}
                  className="text-xs px-2 py-1 rounded text-orange-600 hover:bg-orange-100">
                  Remove from ward
                </button>
                <button type="button" onClick={() => handleDismissFlag(flag)}
                  className="text-xs px-2 py-1 rounded text-gray-500 hover:bg-gray-100">
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
      <MemberSection title="Children" members={grouped.children} {...sectionProps} showRecommend={false} />
      <MemberSection title="No Birth Date" members={grouped.unknown} {...sectionProps} />

      <p className="text-xs text-gray-400 mt-2">
        "Remove from ward" takes them off the active roster — hides them from Speakers &amp; Prayers, but preserves their history.
        "Flag: records elsewhere" is unrelated — it just marks someone who attends here but whose membership record is in another ward. It's informational only and doesn't remove them from anything.
        Age groups: children (&lt;12 this year), youth (12–17 this year), adults (18+ this year).
      </p>
    </div>
  );
}
