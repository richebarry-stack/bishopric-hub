import { useState, useMemo } from 'react';
import type { InterviewPipeline as InterviewType } from '../../lib/api';
import StatusBadge from '../StatusBadge';
import { INTERVIEW_STATUS_COLORS, SETUP_STATUS_COLORS, SETTING_APART_STATUS_COLORS } from '../../lib/constants';
import {
  type RowMeta, type SortKey, YOUTH_STATE_RANK, YOUTH_STATE_COLORS,
  recommendRowClass, formatRecommendDate, isPast,
} from './shared';

function SetupAssignedCell({ row, setupOptions, onAssign }: {
  row: InterviewType;
  setupOptions: string[];
  onAssign: (id: number, name: string) => void;
}) {
  return (
    <select
      value={row.setup_assigned_to || ''}
      onChange={e => onAssign(row.id, e.target.value)}
      onClick={e => e.stopPropagation()}
      aria-label={`Setup assigned to for ${row.member}`}
      className="text-xs rounded border border-gray-200 px-1 py-0.5 bg-transparent hover:border-gray-300 max-w-[8rem]"
    >
      <option value="">Assign…</option>
      {setupOptions.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export default function InterviewTable({ rows, onEdit, onDelete, showAge, showRecExpires = true, showCalling = false, showLastInterview = true, nextInterviewLabel = 'Next Interview', rowMetaById, selected, onToggleSelect, setupOptions, onQuickAssignSetup }: {
  rows: InterviewType[];
  onEdit: (r: InterviewType) => void;
  onDelete: (id: number) => void;
  showAge?: boolean;
  showRecExpires?: boolean;
  showCalling?: boolean;
  showLastInterview?: boolean;
  nextInterviewLabel?: string;
  rowMetaById: Map<number, RowMeta>;
  selected: Set<number>;
  onToggleSelect: (id: number) => void;
  setupOptions: string[];
  onQuickAssignSetup: (id: number, name: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('member');
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  };

  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const metaA = rowMetaById.get(a.id);
    const metaB = rowMetaById.get(b.id);
    if (sortKey === 'age') {
      const av = metaA?.age ?? 999;
      const bv = metaB?.age ?? 999;
      return sortAsc ? av - bv : bv - av;
    }
    if (sortKey === 'member') {
      const av = metaA?.displayName ?? a.member;
      const bv = metaB?.displayName ?? b.member;
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    if (sortKey === 'status' && (metaA?.youthState || metaB?.youthState)) {
      const av = metaA?.youthState ? YOUTH_STATE_RANK[metaA.youthState] : 99;
      const bv = metaB?.youthState ? YOUTH_STATE_RANK[metaB.youthState] : 99;
      return sortAsc ? av - bv : bv - av;
    }
    const sk = sortKey as keyof InterviewType;
    const av = ((a[sk] ?? '') as string).slice(0, 10);
    const bv = ((b[sk] ?? '') as string).slice(0, 10);
    return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
  }), [rows, sortKey, sortAsc, rowMetaById]);

  const Th = ({ col, label }: { col: SortKey; label: string }) => (
    <th className="text-left px-3 py-2 font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900 whitespace-nowrap"
      onClick={() => handleSort(col)}>
      {label}
      <span className="ml-1 text-gray-400">{sortKey === col ? (sortAsc ? '↑' : '↓') : '↕'}</span>
    </th>
  );

  const rowTint = (r: InterviewType): { overdueInterview: boolean; rowColor: string } => {
    const meta = rowMetaById.get(r.id);
    const rowColor = showRecExpires ? recommendRowClass(r.date_recommend_expires) : '';
    const overdueInterview = !rowColor && (meta?.youthState ? meta.youthState === 'Due' : isPast(r.next_interview_date));
    return { overdueInterview, rowColor };
  };

  return (
    <>
      <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-3 py-2 w-8"></th>
              <Th col="member" label="Member" />
              {showAge && <Th col="age" label="Age" />}
              {showCalling && <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Calling</th>}
              <Th col="status" label="Status" />
              <Th col="assigned_to" label="Interviewer" />
              <Th col="setup_status" label="Setup" />
              {showRecExpires && <Th col="date_recommend_expires" label="Rec. Expires" />}
              {showLastInterview && <Th col="last_interview_datetime" label="Last Interview" />}
              <Th col="next_interview_date" label={nextInterviewLabel} />
              <Th col="comments" label="Comments" />
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => {
              const { overdueInterview, rowColor } = rowTint(r);
              const meta = rowMetaById.get(r.id);
              return (
              <tr key={r.id} className={`border-b border-gray-50 cursor-pointer hover:brightness-95 ${overdueInterview ? 'bg-rose-50' : rowColor || 'hover:bg-gray-50'}`} onClick={() => onEdit(r)}>
                <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => onToggleSelect(r.id)}
                    className="rounded border-gray-300 text-blue-600" />
                </td>
                <td className="px-3 py-2 font-medium text-gray-900">{meta?.displayName ?? r.member}</td>
                {showAge && <td className="px-3 py-2 text-gray-600 text-center">{meta?.age ?? '—'}</td>}
                {showCalling && <td className="px-3 py-2 text-gray-600">{meta?.calling ?? ''}</td>}
                <td className="px-3 py-2">
                  {meta?.youthState
                    ? <StatusBadge status={meta.youthState} colors={YOUTH_STATE_COLORS} />
                    : <StatusBadge status={r.status} colors={r.type_of_interview === 'Setting Apart' ? SETTING_APART_STATUS_COLORS : INTERVIEW_STATUS_COLORS} />}
                </td>
                <td className="px-3 py-2 text-gray-600">{r.assigned_to}</td>
                <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                  <div className="flex flex-col gap-0.5 items-start">
                    <StatusBadge status={r.setup_status || 'Not started'} colors={SETUP_STATUS_COLORS} />
                    <SetupAssignedCell row={r} setupOptions={setupOptions} onAssign={onQuickAssignSetup} />
                  </div>
                </td>
                {showRecExpires && (
                  <td className="px-3 py-2 text-sm font-medium text-gray-700">
                    {formatRecommendDate(r.date_recommend_expires)}
                  </td>
                )}
                {showLastInterview && (
                  <td className="px-3 py-2">
                    <span className="font-mono text-sm text-gray-600">
                      {(r.last_interview_datetime || '').slice(0, 10) || (meta?.youthState ? '—' : '')}
                    </span>
                  </td>
                )}
                <td className="px-3 py-2">
                  <span className={`font-mono text-sm ${isPast(r.next_interview_date) ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                    {(r.next_interview_date || '').slice(0, 10) || (meta?.youthState ? '—' : '')}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-700">{r.comments}</td>
                <td className="px-3 py-2">
                  <button onClick={e => { e.stopPropagation(); onDelete(r.id); }} className="text-red-400 hover:text-red-600 text-xs">Del</button>
                </td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-2">
        {sorted.map(r => {
          const { overdueInterview, rowColor } = rowTint(r);
          const meta = rowMetaById.get(r.id);
          return (
            <div key={r.id} onClick={() => onEdit(r)}
              className={`rounded-lg border border-gray-200 p-3 cursor-pointer ${overdueInterview ? 'bg-rose-50' : rowColor || 'bg-white'}`}>
              <div className="flex items-start gap-2">
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => onToggleSelect(r.id)}
                  onClick={e => e.stopPropagation()}
                  className="mt-1 rounded border-gray-300 text-blue-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-900 truncate">
                      {meta?.displayName ?? r.member}{showAge && meta?.age !== undefined && <span className="text-gray-500 font-normal"> (age {meta.age})</span>}
                    </p>
                    <button onClick={e => { e.stopPropagation(); onDelete(r.id); }}
                      className="text-red-400 hover:text-red-600 text-xs shrink-0">Del</button>
                  </div>
                  {showCalling && meta?.calling && <p className="text-xs text-gray-500 mt-0.5">{meta.calling}</p>}
                  <div className="mt-1 flex flex-wrap gap-1.5 items-center">
                    {meta?.youthState
                      ? <StatusBadge status={meta.youthState} colors={YOUTH_STATE_COLORS} />
                      : <StatusBadge status={r.status} colors={r.type_of_interview === 'Setting Apart' ? SETTING_APART_STATUS_COLORS : INTERVIEW_STATUS_COLORS} />}
                    <StatusBadge status={r.setup_status || 'Not started'} colors={SETUP_STATUS_COLORS} />
                  </div>
                  {r.assigned_to && <p className="text-xs text-gray-500 mt-1">Interviewer: {r.assigned_to}</p>}
                  <div className="flex items-center gap-1.5 mt-1" onClick={e => e.stopPropagation()}>
                    <span className="text-xs text-gray-500">Setup:</span>
                    <SetupAssignedCell row={r} setupOptions={setupOptions} onAssign={onQuickAssignSetup} />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs">
                    {showRecExpires && r.date_recommend_expires && <span className="text-gray-600">Rec. expires: {formatRecommendDate(r.date_recommend_expires)}</span>}
                    {r.next_interview_date && (
                      <span className={isPast(r.next_interview_date) ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                        {nextInterviewLabel}: {r.next_interview_date.slice(0, 10)}
                      </span>
                    )}
                    {showLastInterview && r.last_interview_datetime && (
                      <span className="text-gray-600">
                        Last: {r.last_interview_datetime.slice(0, 10)}
                      </span>
                    )}
                  </div>
                  {r.comments && <p className="text-xs text-gray-700 mt-1 truncate">{r.comments}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
