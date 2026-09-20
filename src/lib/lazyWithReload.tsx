import { lazy, type ComponentType } from 'react';

const RELOAD_KEY = 'chunk-reload-at';
const RELOAD_COOLDOWN_MS = 30_000;

// True if the last chunk-triggered reload happened moments ago (guards against reload loops).
export function reloadedRecently(): boolean {
  try {
    const at = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    return Date.now() - at < RELOAD_COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function reloadForNewBuild() {
  try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch { /* ignore */ }
  window.location.reload();
}

// After a deploy, previously-hashed chunk files disappear from the server, and flaky
// connections can also fail a dynamic import. Retry once (covers transient network
// errors), then reload to pick up the new build. The reload is throttled by a cooldown
// rather than a permanent flag, so it still works for later deploys in the same tab.
export function lazyWithReload<T extends ComponentType<unknown>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await factory();
    } catch {
      try {
        await new Promise(r => setTimeout(r, 500));
        return await factory();
      } catch (err) {
        if (!reloadedRecently()) {
          reloadForNewBuild();
          return new Promise<{ default: T }>(() => {}); // never resolves; page is reloading
        }
        throw err;
      }
    }
  });
}
