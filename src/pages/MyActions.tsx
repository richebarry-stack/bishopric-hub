import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useMyActionItems } from '../lib/myActions';

// Ward Council-only accounts can't open the Email Notifications page, so their
// on/off switch for assignment emails lives here.
function EmailToggle() {
  const { user, setEmailNotifications } = useAuth();
  const [saved, setSaved] = useState(false);
  const mutation = useMutation({
    mutationFn: (next: boolean) => api.auth.setEmailPreference(next),
    onSuccess: (_r, next) => {
      setEmailNotifications(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });
  const enabled = user?.email_notifications !== false;
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700 mb-4 bg-white rounded-lg border border-gray-200 px-3 py-2">
      <input type="checkbox" checked={enabled} disabled={mutation.isPending}
        onChange={e => mutation.mutate(e.target.checked)} />
      <span>Email me at {user?.email} when I'm given a new assignment, plus a weekly summary</span>
      {saved && <span className="text-xs text-green-600">Saved</span>}
    </label>
  );
}

export default function MyActions() {
  const { user } = useAuth();
  const { items, isLoading } = useMyActionItems();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">My Actions</h1>
      <p className="text-sm text-gray-500 mb-4">
        Everything currently assigned to you{user?.church_role ? <> as <span className="font-medium text-gray-700">{user.church_role}</span></> : null}, gathered in one place.
      </p>
      {user?.hub === 'wc' && <EmailToggle />}

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-400">Nothing needs your attention right now.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <Link key={item.id} to={item.link}
              className="block bg-white rounded-lg border border-gray-200 p-3 hover:border-blue-300 hover:shadow-sm transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{item.label}</p>
                  {item.detail && <p className="text-sm text-gray-500">{item.detail}</p>}
                </div>
                <div className="text-right shrink-0">
                  {item.date && <p className="text-xs text-gray-400 whitespace-nowrap">{item.date.slice(0, 10)}</p>}
                  <p className="text-xs text-blue-500 whitespace-nowrap">{item.source}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
