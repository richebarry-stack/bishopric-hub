import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, type InterviewPipeline as InterviewType } from '../../lib/api';
import { INTERVIEW_TYPES, INTERVIEW_STATUSES, SETUP_STATUSES } from '../../lib/constants';
import { toast } from '../../lib/toast';
import InterviewTable from './InterviewTable';
import InterviewEditModal from './InterviewEditModal';
import { useInterviews, EMPTY_INTERVIEW } from './useInterviews';
import { YOUTH_TYPES } from './shared';

export default function InterviewsPage({ title, description, types, showAge, showRecExpires = true, showCalling = false, mergedSectionLabel, showSyncNow = false }: {
  title: string;
  description: string;
  types: string[];
  showAge?: boolean;
  showRecExpires?: boolean;
  showCalling?: boolean;
  /** When set, all `types` are rendered as a single merged section under this label (e.g. Youth Interviews). */
  mergedSectionLabel?: string;
  /** Shows a "Sync now" button that immediately runs the expiring-recommend-to-interview sync, instead of waiting for the once-a-day automatic pass. */
  showSyncNow?: boolean;
}) {
  const h = useInterviews();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const result = await api.syncTempleRecommends();
      await queryClient.invalidateQueries({ queryKey: ['interview-pipeline'] });
      toast.success(result.created > 0 ? `Added ${result.created} interview${result.created === 1 ? '' : 's'}` : 'Already up to date');
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const pageRows = applyYouthAgedOutFilter(h.filtered.filter(r => types.includes(r.type_of_interview)), h);

  const grouped: [string, InterviewType[]][] = mergedSectionLabel
    ? [[mergedSectionLabel, pageRows.filter(r => YOUTH_TYPES.has(r.type_of_interview))]]
    : types.map(t => [t, pageRows.filter(r => r.type_of_interview === t)]);

  const allowedTypes = h.editing?.id ? types : types.filter(t => !YOUTH_TYPES.has(t));

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <div className="flex items-center gap-2">
          {showSyncNow && (
            <button onClick={handleSyncNow} disabled={syncing}
              title="Immediately check for recommends expiring within 2 months and add them below, instead of waiting for the once-a-day automatic check."
              className="border border-gray-300 text-gray-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
          )}
          <button onClick={() => h.setEditing({ ...EMPTY_INTERVIEW, type_of_interview: allowedTypes[0] || '' })}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700">
            + New Interview
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-4">{description}</p>

      <div className="flex flex-col sm:flex-row gap-2 mb-2">
        <input value={h.filter} onChange={e => h.setFilter(e.target.value)} placeholder="Search member..."
          className="rounded-md border border-gray-300 px-3 py-2 text-sm flex-1" />
        <select value={h.typeFilter} onChange={e => h.setTypeFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={h.statusFilter} onChange={e => h.setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {INTERVIEW_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={h.assignedFilter} onChange={e => h.setAssignedFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="">All interviewers</option>
          {h.assignedOptions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {h.selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-2 bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-sm">
          <span className="text-blue-700 font-medium">{h.selected.size} selected</span>
          <select value={h.bulkStatus} onChange={e => h.setBulkStatus(e.target.value)}
            className="rounded border border-blue-300 px-2 py-1 text-sm bg-white">
            <option value="">Set status…</option>
            {INTERVIEW_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={h.handleBulkStatus} disabled={!h.bulkStatus}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-40 hover:bg-blue-700">Apply</button>
          <span className="text-blue-300">|</span>
          <input list="interview-bulk-assign-options" value={h.bulkAssignedTo} onChange={e => h.setBulkAssignedTo(e.target.value)} placeholder="Interviewer…"
            className="rounded border border-blue-300 px-2 py-1 text-sm bg-white w-32" />
          <datalist id="interview-bulk-assign-options">
            {h.bishopricOptions.map(o => <option key={o} value={o} />)}
          </datalist>
          <button onClick={h.handleBulkAssign} disabled={!h.bulkAssignedTo.trim()}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-40 hover:bg-blue-700">Assign</button>
          <span className="text-blue-300">|</span>
          <select value={h.bulkSetupStatus} onChange={e => h.setBulkSetupStatus(e.target.value)}
            className="rounded border border-blue-300 px-2 py-1 text-sm bg-white">
            <option value="">Setup status…</option>
            {SETUP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={h.handleBulkSetupStatus} disabled={!h.bulkSetupStatus}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-40 hover:bg-blue-700">Apply</button>
          <input list="interview-bulk-setup-assign-options" value={h.bulkSetupAssignedTo} onChange={e => h.setBulkSetupAssignedTo(e.target.value)} placeholder="Setup assign…"
            className="rounded border border-blue-300 px-2 py-1 text-sm bg-white w-32" />
          <datalist id="interview-bulk-setup-assign-options">
            {h.setupOptions.map(o => <option key={o} value={o} />)}
          </datalist>
          <button onClick={h.handleBulkSetupAssign} disabled={!h.bulkSetupAssignedTo.trim()}
            className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-40 hover:bg-blue-700">Assign</button>
          <button onClick={() => h.setSelected(new Set())} className="ml-auto text-blue-500 hover:text-blue-700">Clear</button>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        {showRecExpires && (
          <>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-300 inline-block" />Expires within 1 month</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-50 border border-yellow-300 inline-block" />Expires within 2 months</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-100 border border-orange-300 inline-block" />Expired within 1 month</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-100 border border-red-300 inline-block" />Expired over 1 month ago</span>
          </>
        )}
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-rose-50 border border-rose-300 inline-block" />Interview overdue/due</span>
      </div>

      {h.isLoading ? <p className="text-gray-400 text-sm">Loading...</p> : (
        <div className="space-y-8">
          {grouped.map(([type, typeRows]) => (
            <div key={type}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                {type}
                <span className="text-gray-400 font-normal normal-case tracking-normal">({typeRows.length})</span>
                {type === mergedSectionLabel && h.agedOutYouthCount > 0 && (
                  <button onClick={() => h.setShowAgedOutYouth(s => !s)}
                    className="ml-auto text-xs text-gray-400 hover:text-gray-600 normal-case tracking-normal font-normal">
                    {h.showAgedOutYouth ? 'Hide' : 'Show'} aged-out/inactive ({h.agedOutYouthCount})
                  </button>
                )}
              </h2>
              {typeRows.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4 bg-white rounded-lg border border-gray-200 border-dashed">
                  No {type} interviews
                </p>
              ) : (
                <InterviewTable rows={typeRows} onEdit={h.setEditing} onDelete={h.remove}
                  showAge={showAge}
                  showRecExpires={showRecExpires}
                  showCalling={showCalling}
                  showLastInterview={type !== 'Setting Apart'}
                  nextInterviewLabel={type === 'Setting Apart' ? 'Scheduled Date' : 'Next Interview'}
                  rowMetaById={h.rowMetaById}
                  selected={h.selected} onToggleSelect={h.toggleSelect}
                  setupOptions={h.setupOptions} onQuickAssignSetup={h.quickAssignSetup} />
              )}
            </div>
          ))}
        </div>
      )}

      <InterviewEditModal
        editing={h.editing}
        onClose={() => h.setEditing(null)}
        onChange={next => h.setEditing(prev => (prev ? { ...prev, ...next } : prev))}
        onSave={h.handleSave}
        wardMembers={h.wardMembers}
        wardMembersById={h.wardMembersById}
        ageByName={h.ageByName}
        activeYouthWardMemberIds={h.activeYouthWardMemberIds}
        callingsById={h.callingsById}
        bishopricOptions={h.bishopricOptions}
        setupOptions={h.setupOptions}
        allowedTypes={allowedTypes.length ? allowedTypes : INTERVIEW_TYPES}
        preferredNameDraft={h.preferredNameDraft}
        setPreferredNameDraft={h.setPreferredNameDraft}
      />
    </div>
  );
}

// While ward-members is still loading, don't hide anyone; and hide aged-out/inactive
// linked youth rows from the merged Youth Interviews section unless toggled on.
function applyYouthAgedOutFilter(rows: InterviewType[], h: ReturnType<typeof useInterviews>): InterviewType[] {
  return rows.filter(r => {
    if (!YOUTH_TYPES.has(r.type_of_interview)) return true;
    const isCurrentYouth = h.wardMembersLoading || !r.ward_member_id || h.activeYouthWardMemberIds.has(r.ward_member_id);
    return isCurrentYouth || h.showAgedOutYouth;
  });
}
