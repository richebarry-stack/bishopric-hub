import { lazy, type ComponentType } from 'react';

// After a deploy, previously-hashed chunk files disappear from the server. A user
// who has the app open (or comes back later) can hit a dynamic-import 404 when
// navigating to a page they haven't loaded yet. Reload once to pick up the new
// build instead of showing a broken page.
export function lazyWithReload<T extends ComponentType<unknown>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      const key = 'chunk-reload-attempted';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
        return new Promise<{ default: T }>(() => {}); // never resolves; page is reloading
      }
      throw err;
    }
  });
}
