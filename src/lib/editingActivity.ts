// Tracks whether the current user has saved a change recently, as a cheap proxy
// for "is actively editing" — used by the presence heartbeat. No per-page wiring
// needed: useTable calls markEditing() from its mutation functions.
const EDITING_WINDOW_MS = 60_000;
let lastEditAt = 0;

export function markEditing(): void {
  lastEditAt = Date.now();
}

export function isEditing(): boolean {
  return Date.now() - lastEditAt < EDITING_WINDOW_MS;
}
