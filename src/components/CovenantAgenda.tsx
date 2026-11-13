import { Link } from 'react-router-dom';
import type { CouncilAgendaEntry, CovenantAgendaEntry } from '../../shared/covenantPath';
import { useCovenantAgenda } from '../lib/useCovenantAgenda';

async function putEntry(id: number, data: Record<string, unknown>) {
  await fetch(`/api/covenant-path-agenda/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
}

/** Bishopric view: list name, detail and note; remove from the bishopric agenda. */
export function BishopricCovenantAgenda({ textClass = 'text-sm', showEmpty = true }: { textClass?: string; showEmpty?: boolean }) {
  const { entries, loaded, reload } = useCovenantAgenda<CovenantAgendaEntry>();
  const mine = entries.filter(e => e.for_bishopric);
  if (!loaded) return null;
  if (mine.length === 0) {
    return showEmpty ? (
      <p className="text-sm text-gray-400 py-2">
        No one added yet. Use the Bishopric button on <Link to="/covenant-path" className="text-blue-600 hover:underline">Covenant Path</Link>.
      </p>
    ) : null;
  }
  return (
    <ul className="divide-y divide-gray-100">
      {mine.map(e => (
        <li key={e.id} className="py-1.5 flex items-baseline gap-2">
          <div className="min-w-0 flex-1">
            <span className={`${textClass} text-gray-900`}>{e.subject_name}</span>
            <span className="text-xs text-gray-500 ml-2">{e.categoryTitle} · {e.detail}</span>
            {e.for_ward_council ? <span className="text-xs text-emerald-700 ml-2">also on Ward Council</span> : null}
            {e.note && <p className="text-xs text-gray-600 italic">{e.note}</p>}
          </div>
          <button type="button" title="Take off the bishopric agenda"
            onClick={async () => { await putEntry(e.id, { for_bishopric: 0 }); reload(); }}
            className="text-xs text-gray-400 hover:text-red-600 shrink-0">Remove</button>
        </li>
      ))}
    </ul>
  );
}

/** Ward council view (read-only): only what the bishopric opted in. */
export function CouncilCovenantAgenda({ textClass = 'text-sm', showEmpty = true }: { textClass?: string; showEmpty?: boolean }) {
  const { entries: raw, loaded } = useCovenantAgenda<CouncilAgendaEntry & { for_ward_council?: number }>();
  // Bishopric users get the full list from the server; show them only what the council sees.
  const entries = raw.filter(e => e.for_ward_council === undefined || e.for_ward_council === 1);
  if (!loaded) return null;
  if (entries.length === 0) return showEmpty ? <p className="text-sm text-gray-400 py-2">Nothing from the bishopric right now.</p> : null;
  return (
    <ul className="divide-y divide-gray-100">
      {entries.map(e => (
        <li key={e.id} className="py-1.5">
          <span className={`${textClass} text-gray-900`}>{e.subject_name}</span>
          <span className="text-xs text-gray-500 ml-2">{e.topic}</span>
          {e.note && <p className="text-xs text-gray-600 italic">{e.note}</p>}
        </li>
      ))}
    </ul>
  );
}
