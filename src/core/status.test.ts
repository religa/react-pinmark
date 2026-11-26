import { describe, it, expect } from 'vitest';
import {
  isActiveStatus,
  isWaitingFor,
  isStatusFilter,
  isThreadStatus,
  matchesStatusFilter,
  statusesForFilter,
} from './status';

describe('status', () => {
  it('treats open and pending as active', () => {
    expect(isActiveStatus('open')).toBe(true);
    expect(isActiveStatus('pending')).toBe(true);
    expect(isActiveStatus('resolved')).toBe(false);
    expect(isActiveStatus('dismissed')).toBe(false);
  });

  it('validates statuses and filters', () => {
    expect(isThreadStatus('pending')).toBe(true);
    expect(isThreadStatus('active')).toBe(false);
    expect(isStatusFilter('active')).toBe(true);
    expect(isStatusFilter('all')).toBe(true);
    expect(isStatusFilter('done')).toBe(false);
    expect(isStatusFilter(undefined)).toBe(false);
  });

  it('expands filters to statuses', () => {
    expect(statusesForFilter(undefined)).toBeUndefined();
    expect(statusesForFilter('all')).toBeUndefined();
    expect(statusesForFilter('active')).toEqual(['open', 'pending']);
    expect(statusesForFilter('dismissed')).toEqual(['dismissed']);
  });

  it('a thread waits for its reporter only while pending', () => {
    const thread = (status: 'open' | 'pending', id?: string) => ({
      status,
      comments: [{ author: { displayName: 'Ana', id } }],
    });
    expect(isWaitingFor(thread('pending', 'ana-id'), 'ana-id')).toBe(true);
    expect(isWaitingFor(thread('open', 'ana-id'), 'ana-id')).toBe(false);
    expect(isWaitingFor(thread('pending', 'bob-id'), 'ana-id')).toBe(false);
    // Comments from before author ids existed never match
    expect(isWaitingFor(thread('pending', undefined), undefined)).toBe(false);
    expect(isWaitingFor(thread('pending', undefined), 'ana-id')).toBe(false);
  });

  it('matches statuses against filters', () => {
    expect(matchesStatusFilter('pending', 'active')).toBe(true);
    expect(matchesStatusFilter('resolved', 'active')).toBe(false);
    expect(matchesStatusFilter('resolved', undefined)).toBe(true);
    expect(matchesStatusFilter('open', 'pending')).toBe(false);
  });
});
