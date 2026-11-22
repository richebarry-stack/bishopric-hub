// Checklists stored as a JSON object of item key -> true on member_care.checklist,
// funerals.checklist and missionary_pipeline.rm_checklist. Keys are stable; labels
// can be reworded freely. Shared so the UI and any server-side logic agree.

export interface ChecklistItem { key: string; label: string; hint?: string }

/** New & returning member care (General Handbook 23.5; reviewed in ward council, 29.2.5). */
export const MEMBER_CARE_ITEMS: ChecklistItem[] = [
  { key: 'welcome_visit', label: 'Bishopric welcome visit' },
  { key: 'ministering', label: 'Ministering brothers/sisters assigned' },
  { key: 'introduced_wc', label: 'Introduced in ward council' },
  { key: 'calling', label: 'Calling extended' },
  { key: 'temple', label: 'Temple / temple prep discussed' },
];

export const MEMBER_CARE_KINDS = ['Move-in', 'New convert', 'Returning member'];

/** Funeral planning (General Handbook 29.5). */
export const FUNERAL_ITEMS: ChecklistItem[] = [
  { key: 'family_visit', label: 'Bishop visited / contacted the family' },
  { key: 'eq_rs_notified', label: 'Elders quorum and Relief Society presidents notified' },
  { key: 'program', label: 'Program planned with the family (speakers, music, prayers)', hint: 'Usually no more than 1½ hours.' },
  { key: 'building', label: 'Building / chapel scheduled' },
  { key: 'luncheon', label: 'Family meal / luncheon arranged (Relief Society)' },
  { key: 'program_printed', label: 'Printed program ready' },
  { key: 'grave', label: 'Grave dedication arranged' },
  { key: 'follow_up', label: 'Follow-up visit with the family after the funeral' },
];

/** Returned missionaries, once released from the mission field (General Handbook 24.8). */
export const RM_ITEMS: ChecklistItem[] = [
  { key: 'released', label: 'Released by the stake president' },
  { key: 'homecoming', label: 'Homecoming sacrament meeting talk scheduled' },
  { key: 'high_council', label: 'Reported to the high council' },
  { key: 'ward_council', label: 'Reported to the ward council' },
  { key: 'calling', label: 'Calling extended' },
  { key: 'temple', label: 'Temple recommend current' },
];

export type ChecklistState = Record<string, boolean>;

export function parseChecklist(raw: string | null | undefined): ChecklistState {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: ChecklistState = {};
    for (const [k, v] of Object.entries(parsed)) if (v === true) out[k] = true;
    return out;
  } catch {
    return {};
  }
}

export function stringifyChecklist(state: ChecklistState): string {
  const out: ChecklistState = {};
  for (const [k, v] of Object.entries(state)) if (v) out[k] = true;
  return JSON.stringify(out);
}

/** How many of `items` are checked in `state`. */
export function checklistProgress(items: ChecklistItem[], state: ChecklistState): { done: number; total: number } {
  return { done: items.filter(i => state[i.key]).length, total: items.length };
}
