import { describe, it, expect } from 'vitest';
import { computePinNumbers } from './pin-numbers';
import type { Thread } from './types';

const t = (id: string, pageUrl: string, status: Thread['status'] = 'open'): Thread => ({
  id,
  projectId: 'p',
  pageUrl,
  pin: { x: 0, y: 0 },
  status,
  createdAt: '2024-01-01T00:00:00Z',
  comments: [],
});

describe('computePinNumbers', () => {
  it('numbers threads per page, independent of status', () => {
    const numbers = computePinNumbers([
      t('a', '/'),
      t('b', '/other'),
      t('c', '/', 'resolved'),
      t('d', '/'),
    ]);
    expect(Object.fromEntries(numbers)).toEqual({ a: 1, b: 1, c: 2, d: 3 });
  });
});
