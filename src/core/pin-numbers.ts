import type { Thread } from './types';

/**
 * Stable pin numbers: 1-based position of each thread among all threads on the
 * same page, in load (creation) order, regardless of status. The overlay, the
 * thread list and exports all use this, so "pin 3" means the same thread
 * everywhere, and resolving one thread never renumbers the others.
 */
export function computePinNumbers(threads: readonly Thread[]): Map<string, number> {
  const perPage = new Map<string, number>();
  const numbers = new Map<string, number>();
  for (const thread of threads) {
    const n = (perPage.get(thread.pageUrl) ?? 0) + 1;
    perPage.set(thread.pageUrl, n);
    numbers.set(thread.id, n);
  }
  return numbers;
}
