import { Link } from 'react-router-dom';
import { useTable } from '../../lib/useTable';
import type { InterviewPipeline } from '../../lib/api';
import { YOUTH_TYPES, TEMPLE_TYPES, OTHER_TYPES } from '../../components/interviews/shared';

const CATEGORIES: { label: string; types: Set<string>; path: string }[] = [
  { label: 'Youth', types: YOUTH_TYPES, path: '/youth-interviews' },
  { label: 'Adult Temple', types: TEMPLE_TYPES, path: '/temple-interviews' },
  { label: 'Other', types: OTHER_TYPES, path: '/other-interviews' },
];

export default function InterviewsNeededSection() {
  const { rows, update } = useTable<InterviewPipeline>('interview-pipeline');
  const flagged = rows.filter(r => r.flagged_for_meeting);

  const clearFlag = (id: number) => update(id, { flagged_for_meeting: 0 }, { silent: true });

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-700">Interviews Needed</h2>
        <span className="text-xs text-gray-400">Carries over automatically until cleared — nothing to copy</span>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-3">
        {flagged.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-2">
            No interviews flagged — flag one from a member's interview row.
          </p>
        ) : (
          CATEGORIES.map(cat => {
            const catRows = flagged.filter(r => cat.types.has(r.type_of_interview));
            if (catRows.length === 0) return null;
            return (
              <div key={cat.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{cat.label}</span>
                  <Link to={cat.path} className="text-xs text-blue-500 hover:text-blue-700">View list</Link>
                </div>
                <div className="space-y-1">
                  {catRows.map(r => (
                    <label key={r.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={!!r.flagged_for_meeting} onChange={() => clearFlag(r.id)}
                        className="rounded border-gray-300" />
                      <span className="text-gray-800">{r.member}</span>
                      <span className="text-gray-400 text-xs">{r.type_of_interview}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
