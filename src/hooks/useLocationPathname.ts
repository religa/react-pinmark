import { useSyncExternalStore } from 'react';

let patched = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function subscribe(callback: () => void): () => void {
  // Lazily patch history methods on first subscription so
  // pushState / replaceState also trigger React re-renders.
  if (!patched && typeof history !== 'undefined') {
    patched = true;
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function (
      ...args: Parameters<typeof origPush>
    ) {
      origPush.apply(this, args);
      // Defer notification so the SPA router can finish its synchronous
      // state update before our components re-render and query the DOM.
      queueMicrotask(notify);
    };
    history.replaceState = function (
      ...args: Parameters<typeof origReplace>
    ) {
      origReplace.apply(this, args);
      queueMicrotask(notify);
    };
  }

  listeners.add(callback);
  window.addEventListener('popstate', callback);

  return () => {
    listeners.delete(callback);
    window.removeEventListener('popstate', callback);
  };
}

function getSnapshot(): string {
  return window.location.pathname;
}

function getServerSnapshot(): string {
  return '/';
}

export function useLocationPathname(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
