// Test-only URL boundary. Exercises the actual FilterSheet, not Next server navigation.
import { useMemo, useSyncExternalStore } from 'react';
const listeners = new Set<() => void>();
const subscribe = (notify: () => void) => { listeners.add(notify); return () => { listeners.delete(notify); }; };
const snapshot = () => location.search;
export const usePathname = () => location.pathname;
export function useSearchParams() {
  const value = useSyncExternalStore(subscribe, snapshot, snapshot);
  return useMemo(() => new URLSearchParams(value), [value]);
}
const router = {
  replace(url: string, options: { scroll?: boolean }) {
    if (options.scroll !== false) throw new Error('Filter navigation must preserve scroll');
    history.replaceState(null, '', url);
    for (const notify of listeners) notify();
  },
};
export const useRouter = () => router;
