import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type LcrSyncRun, type MailerRun } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useConfirm } from '../components/ConfirmDialog';

const WEEKDAYS = [
  { value: 'Sun', label: 'Sunday' }, { value: 'Mon', label: 'Monday' }, { value: 'Tue', label: 'Tuesday' },
  { value: 'Wed', label: 'Wednesday' }, { value: 'Thu', label: 'Thursday' }, { value: 'Fri', label: 'Friday' },
  { value: 'Sat', label: 'Saturday' },
];

const JOB_LABELS: Record<string, string> = {
  syncConduct: 'Sacrament conducting sync',
  cleanupSessions: 'Expired session cleanup',
  cleanupLoginAttempts: 'Login attempt log cleanup',
  cleanupPresence: 'Stale presence cleanup',
  syncYouthInterviews: 'Youth interview roster sync',
};

const COMMON_TIME_ZONES = [
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Chicago',
  'America/New_York',
  'America/Anchorage',
  'Pacific/Honolulu',
  'UTC',
];

function formatWhen(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function parseNames(json: string | null): string[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

function parseChanged(json: string | null, secondKey: 'calling' | 'section'): string[] {
  if (!json) return [];
  try {
    const items = JSON.parse(json) as Record<string, string>[];
    return items.map(it => `${it.name} — ${it[secondKey]} (${it.action})`);
  } catch { return []; }
}

function NameList({ label, names }: { label: string; names: string[] }) {
  if (names.length === 0) return null;
  return (
    <p className="text-xs text-gray-500 mt-1">
      <span className="text-gray-400">{label}:</span> {names.join(', ')}
    </p>
  );
}

// Runs shown expanded on load — the rest are archived behind a toggle.
const RECENT_RUNS = 5;

function SyncRun({ run }: { run: LcrSyncRun }) {
  const unmatchedUsers = parseNames(run.users_unmatched);
  return (
    <div className="py-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-gray-700 font-medium">{formatWhen(run.ran_at)}</span>
        {run.success ? (
          <span className="text-green-600 text-xs">✓ OK</span>
        ) : (
          <span className="text-red-600 text-xs" title={run.error || undefined}>✗ Failed{run.error ? `: ${run.error}` : ''}</span>
        )}
      </div>
      {!!run.success && (
        <div className="mt-1 text-xs text-gray-500 space-y-0.5">
          <p>Roster: {run.roster_created ?? 0} created, {run.roster_filled ?? 0} filled in{parseNames(run.roster_missing).length > 0 ? `, ${parseNames(run.roster_missing).length} missing from LCR` : ''}</p>
          <NameList label="Missing from LCR roster" names={parseNames(run.roster_missing)} />
          {unmatchedUsers.length > 0 && (
            <p className="text-red-600">
              <span className="font-medium">⚠ {unmatchedUsers.length} hub account name{unmatchedUsers.length === 1 ? '' : 's'} not found in the LCR roster</span> — assignments typed from LCR names won&apos;t reach them: {unmatchedUsers.join(', ')}
            </p>
          )}
          <p>Recommends: {run.recommend_updated ?? 0} changed{parseNames(run.recommend_unmatched).length > 0 ? `, ${parseNames(run.recommend_unmatched).length} unmatched` : ''}</p>
          <NameList label="Unmatched recommends" names={parseNames(run.recommend_unmatched)} />
          <p>Stake activations: {run.stake_flagged ?? 0} flagged, {run.stake_cleared ?? 0} cleared{parseNames(run.stake_unmatched).length > 0 ? `, ${parseNames(run.stake_unmatched).length} unmatched` : ''}</p>
          <NameList label="Unmatched stake activations" names={parseNames(run.stake_unmatched)} />
          <p>Callings: {run.callings_created ?? 0} created, {run.callings_updated ?? 0} updated, {run.callings_released ?? 0} released{parseNames(run.callings_unmatched).length > 0 ? `, ${parseNames(run.callings_unmatched).length} unmatched` : ''}</p>
          <NameList label="Callings changed" names={parseChanged(run.callings_changed, 'calling')} />
          <NameList label="Unmatched callings" names={parseNames(run.callings_unmatched)} />
          <p>Missionary status: {run.missionary_created ?? 0} created, {run.missionary_updated ?? 0} updated{parseNames(run.missionary_unmatched).length > 0 ? `, ${parseNames(run.missionary_unmatched).length} unmatched` : ''}</p>
          <NameList label="Missionary status changed" names={parseChanged(run.missionary_changed, 'section')} />
          <NameList label="Unmatched missionaries" names={parseNames(run.missionary_unmatched)} />
        </div>
      )}
    </div>
  );
}

function LcrSyncHistory() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { user } = useAuth();
  const [showArchived, setShowArchived] = useState(false);
  const { data: runs, isLoading } = useQuery({
    queryKey: ['lcr-sync-runs'],
    queryFn: () => api.list<LcrSyncRun>('lcr-sync-runs'),
  });

  const clearArchived = useMutation({
    mutationFn: () => api.lcrSyncRuns.clearArchived(RECENT_RUNS),
    onSuccess: () => {
      setShowArchived(false);
      queryClient.invalidateQueries({ queryKey: ['lcr-sync-runs'] });
    },
  });

  const recent = (runs || []).slice(0, RECENT_RUNS);
  const archived = (runs || []).slice(RECENT_RUNS);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <div>
        <h2 className="font-semibold text-gray-800 text-sm">LCR Sync History</h2>
        <p className="text-xs text-gray-400 mt-0.5">Weekly roster/recommend/stake-activation/callings/missionary sync run from your computer (scripts/lcr-sync) — not automatic on the server.</p>
      </div>
      {isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : recent.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">No sync runs yet.</p>
      ) : (
        <>
          <div className="divide-y divide-gray-100">
            {recent.map(run => <SyncRun key={run.id} run={run} />)}
          </div>
          {archived.length > 0 && (
            <div className="pt-1 border-t border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => setShowArchived(v => !v)}
                  className="text-xs text-blue-600 hover:text-blue-700">
                  {showArchived ? 'Hide' : 'Show'} {archived.length} older run{archived.length === 1 ? '' : 's'}
                </button>
                {user?.role === 'admin' && (
                  <button type="button" disabled={clearArchived.isPending}
                    onClick={async () => {
                      if (await confirm({ message: `Permanently delete ${archived.length} archived sync run${archived.length === 1 ? '' : 's'}? The ${RECENT_RUNS} most recent are kept.` })) {
                        clearArchived.mutate();
                      }
                    }}
                    className="text-xs text-red-500 hover:text-red-600 disabled:opacity-50">
                    Clear older runs
                  </button>
                )}
              </div>
              {showArchived && (
                <div className="divide-y divide-gray-100">
                  {archived.map(run => <SyncRun key={run.id} run={run} />)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function WardNameSetting() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['ward-name'], queryFn: () => api.wardName.get() });
  const [wardName, setWardName] = useState('');
  const [prevDataWardName, setPrevDataWardName] = useState(data?.wardName);
  const [saved, setSaved] = useState(false);

  if (data?.wardName !== prevDataWardName) {
    setPrevDataWardName(data?.wardName);
    setWardName(data?.wardName ?? '');
  }

  const mutation = useMutation({
    mutationFn: (name: string) => api.wardName.save(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ward-name'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <h2 className="font-semibold text-gray-800 text-sm">Ward Name</h2>
      <p className="text-xs text-gray-400">
        Shown as "{wardName.trim() || '(Ward Name)'} Ward Leadership Hub" on the login page and sidebar.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="e.g. Maple Grove"
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm flex-1"
          value={wardName}
          onChange={(e) => setWardName(e.target.value)}
        />
        <button
          className="px-3 py-1.5 text-sm rounded-lg bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(wardName.trim())}
        >
          Save
        </button>
        {saved && <span className="text-xs text-green-600">Saved</span>}
      </div>
    </div>
  );
}

function TimeZoneSetting() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['app-timezone'], queryFn: () => api.appTimezone.get() });
  const [timeZone, setTimeZone] = useState('');
  const [prevDataTimeZone, setPrevDataTimeZone] = useState(data?.timeZone);
  const [saved, setSaved] = useState(false);

  if (data?.timeZone !== prevDataTimeZone) {
    setPrevDataTimeZone(data?.timeZone);
    if (data?.timeZone) setTimeZone(data.timeZone);
  }

  const mutation = useMutation({
    mutationFn: (tz: string) => api.appTimezone.save(tz),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-timezone'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const options = COMMON_TIME_ZONES.includes(timeZone) || !timeZone ? COMMON_TIME_ZONES : [timeZone, ...COMMON_TIME_ZONES];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <h2 className="font-semibold text-gray-800 text-sm">Time Zone</h2>
      <p className="text-xs text-gray-400">
        Used to decide calendar-day boundaries, e.g. when "Last Access" on the Users page counts as "today".
      </p>
      <div className="flex items-center gap-2">
        <select
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          value={timeZone}
          onChange={(e) => setTimeZone(e.target.value)}
        >
          {options.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
        </select>
        <button
          className="px-3 py-1.5 text-sm rounded-lg bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50"
          disabled={!timeZone || mutation.isPending}
          onClick={() => mutation.mutate(timeZone)}
        >
          Save
        </button>
        {saved && <span className="text-xs text-green-600">Saved</span>}
      </div>
    </div>
  );
}

function MailerScheduleSetting() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['mailer-settings'], queryFn: () => api.mailerSettings.get() });
  const [weekday, setWeekday] = useState('Sat');
  const [hour, setHour] = useState(8);
  const [prevData, setPrevData] = useState(data);
  const [saved, setSaved] = useState(false);

  if (data !== prevData) {
    setPrevData(data);
    if (data) { setWeekday(data.weekday); setHour(data.hour); }
  }

  const mutation = useMutation({
    mutationFn: () => api.mailerSettings.save(weekday, hour),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mailer-settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <h2 className="font-semibold text-gray-800 text-sm">Weekly Assignment Email</h2>
      <p className="text-xs text-gray-400">
        When the "everything currently assigned to you" digest goes out, in the ward's time zone above.
        New assignments also email as they happen, regardless of this schedule.
      </p>
      <div className="flex items-center gap-2">
        <select
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm disabled:opacity-60"
          value={weekday}
          disabled={user?.role !== 'admin'}
          onChange={(e) => setWeekday(e.target.value)}
        >
          {WEEKDAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <select
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm disabled:opacity-60"
          value={hour}
          disabled={user?.role !== 'admin'}
          onChange={(e) => setHour(Number(e.target.value))}
        >
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>{h === 0 ? '12:00 AM' : h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`}</option>
          ))}
        </select>
        {user?.role === 'admin' && (
          <button
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Save
          </button>
        )}
        {saved && <span className="text-xs text-green-600">Saved</span>}
      </div>
    </div>
  );
}

function EmailPreferenceSetting() {
  const { user, setEmailNotifications } = useAuth();
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: (next: boolean) => api.auth.setEmailPreference(next),
    onSuccess: (_result, next) => {
      // Update the shared auth context (not just local state) so the preference
      // stays correct if the user navigates away and back without reloading.
      setEmailNotifications(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const enabled = user?.email_notifications !== false;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <h2 className="font-semibold text-gray-800 text-sm">My Email Notifications</h2>
      <p className="text-xs text-gray-400">
        Email me at {user?.email} when I'm assigned a new action item, and the weekly digest of everything still open.
      </p>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => mutation.mutate(e.target.checked)}
        />
        Email me my action items
        {saved && <span className="text-xs text-green-600 ml-1">Saved</span>}
      </label>
    </div>
  );
}

function MailerStatus() {
  const { data: runs, isLoading } = useQuery({
    queryKey: ['mailer-runs'],
    queryFn: () => api.list<MailerRun>('mailer-runs'),
  });

  const recent = (runs || []).slice(0, 10);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <div>
        <h2 className="font-semibold text-gray-800 text-sm">Action Item Emails</h2>
        <p className="text-xs text-gray-400 mt-0.5">Runs of the background mailer (workers/mailer) — only shown when it sent mail or hit an error.</p>
      </div>
      {isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : recent.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">No notable runs yet — nothing has been sent or failed.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {recent.map(run => {
            const errors = run.errors ? (JSON.parse(run.errors) as { recipient: string; error: string }[]) : [];
            return (
              <div key={run.id} className="py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">
                    {formatWhen(run.ran_at)} — {run.kind === 'weekly' ? 'Weekly digest' : run.kind === 'seed' ? 'Initial backlog recorded' : 'New assignments'}
                  </span>
                  <span className="text-gray-500 text-xs">{run.emails_sent} email{run.emails_sent === 1 ? '' : 's'} sent</span>
                </div>
                {run.kind === 'seed' && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {run.items_notified} already-open item{run.items_notified === 1 ? '' : 's'} recorded without emailing — MAILER_MODE is still "seed". Flip to "live" once this looks right.
                  </p>
                )}
                {errors.length > 0 && (
                  <p className="text-xs text-red-600 mt-0.5">
                    ⚠ Failed for: {errors.map(e => `${e.recipient} (${e.error})`).join(', ')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function EmailNotifications() {
  const { data, isLoading } = useQuery({
    queryKey: ['automation-status'],
    queryFn: () => api.automationStatus.get(),
  });

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Automation & Notifications</h1>
        <p className="text-sm text-gray-500">Background jobs that keep the hub up to date automatically.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="font-semibold text-gray-800 text-sm">Daily Jobs</h2>
        {isLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <>
            <p className="text-xs text-gray-400">Last ran: {formatWhen(data?.last_run ?? null)}</p>
            <div className="divide-y divide-gray-100">
              {Object.keys(data?.results || {}).length === 0 && (
                <p className="text-sm text-gray-400 py-2">Jobs run automatically once a day the next time anyone uses the app — nothing has run yet.</p>
              )}
              {Object.entries(data?.results || {}).map(([key, result]) => (
                <div key={key} className="py-2 flex items-center justify-between text-sm">
                  <span className="text-gray-700">{JOB_LABELS[key] || key}</span>
                  {result.ok ? (
                    <span className="text-green-600 text-xs">✓ OK{'created' in result || 'updated' in result ? ` — ${result.created ?? 0} created, ${result.updated ?? 0} updated` : ''}</span>
                  ) : (
                    <span className="text-red-600 text-xs" title={result.error}>✗ Failed</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <LcrSyncHistory />

      <WardNameSetting />

      <TimeZoneSetting />

      <MailerScheduleSetting />

      <EmailPreferenceSetting />

      <MailerStatus />
    </div>
  );
}
