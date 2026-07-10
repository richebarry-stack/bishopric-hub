import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

const JOB_LABELS: Record<string, string> = {
  syncConduct: 'Sacrament conducting sync',
  cleanupSessions: 'Expired session cleanup',
  cleanupLoginAttempts: 'Login attempt log cleanup',
  cleanupPresence: 'Stale presence cleanup',
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

function TimeZoneSetting() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['app-timezone'], queryFn: () => api.appTimezone.get() });
  const [timeZone, setTimeZone] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.timeZone) setTimeZone(data.timeZone);
  }, [data?.timeZone]);

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

      <TimeZoneSetting />

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-amber-800 space-y-2">
        <p className="font-semibold">Email sending not yet enabled</p>
        <p className="text-sm">
          Reminder emails for pending action items, spiritual thought assignments, and handbook topics
          are planned but require a custom domain and email provider to activate.
        </p>
      </div>
    </div>
  );
}
