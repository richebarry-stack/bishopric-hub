import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useMyActionItems } from '../lib/myActions';

export default function MyActions() {
  const { user } = useAuth();
  const { items, isLoading } = useMyActionItems();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">My Actions</h1>
      <p className="text-sm text-gray-500 mb-4">
        Everything currently assigned to you{user?.church_role ? <> as <span className="font-medium text-gray-700">{user.church_role}</span></> : null}, gathered in one place.
      </p>

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
