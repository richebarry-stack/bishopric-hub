import type { ChecklistItem, ChecklistState } from '../../shared/checklists';

/** A list of checkboxes backed by a { key: true } map (see shared/checklists.ts). */
export default function Checklist({ items, state, onChange, disabled }: {
  items: ChecklistItem[];
  state: ChecklistState;
  onChange: (next: ChecklistState) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      {items.map(item => (
        <label key={item.key} className={`flex items-start gap-2 text-sm text-gray-700 select-none ${disabled ? '' : 'cursor-pointer'}`}>
          <input type="checkbox" checked={!!state[item.key]} disabled={disabled}
            onChange={e => onChange({ ...state, [item.key]: e.target.checked })}
            className="mt-0.5 rounded border-gray-300" />
          <span>
            <span className={state[item.key] ? 'text-gray-400 line-through' : ''}>{item.label}</span>
            {item.hint && <span className="block text-xs text-gray-400">{item.hint}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

/** "3/5" pill with a green tint once everything is done. */
export function ProgressPill({ done, total }: { done: number; total: number }) {
  const complete = total > 0 && done === total;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${complete ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
      {done}/{total}{complete ? ' ✓' : ''}
    </span>
  );
}
