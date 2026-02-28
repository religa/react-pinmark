import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatRelativeTime } from './format';

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for dates less than 60 seconds ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:30Z'));
    expect(formatRelativeTime('2025-01-15T12:00:00Z')).toBe('just now');
  });

  it('returns minutes ago for dates 1-59 minutes ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:05:00Z'));
    expect(formatRelativeTime('2025-01-15T12:00:00Z')).toBe('5m ago');
  });

  it('returns hours ago for dates 1-23 hours ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T15:00:00Z'));
    expect(formatRelativeTime('2025-01-15T12:00:00Z')).toBe('3h ago');
  });

  it('returns days ago for dates 1-29 days ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-20T12:00:00Z'));
    expect(formatRelativeTime('2025-01-15T12:00:00Z')).toBe('5d ago');
  });

  it('returns locale date string for dates 30+ days ago', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-15T12:00:00Z'));
    const result = formatRelativeTime('2025-01-15T12:00:00Z');
    // toLocaleDateString() output varies by locale, just verify it's not a relative format
    expect(result).not.toContain('ago');
    expect(result).not.toBe('just now');
  });

  it('returns "just now" for future dates (negative diff)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
    expect(formatRelativeTime('2025-01-15T12:01:00Z')).toBe('just now');
  });

  it('returns the input string for invalid dates', () => {
    expect(formatRelativeTime('not-a-date')).toBe('not-a-date');
    expect(formatRelativeTime('')).toBe('');
  });

  it('handles boundary at exactly 60 seconds', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:01:00Z'));
    expect(formatRelativeTime('2025-01-15T12:00:00Z')).toBe('1m ago');
  });

  it('handles boundary at exactly 60 minutes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T13:00:00Z'));
    expect(formatRelativeTime('2025-01-15T12:00:00Z')).toBe('1h ago');
  });

  it('handles boundary at exactly 24 hours', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-16T12:00:00Z'));
    expect(formatRelativeTime('2025-01-15T12:00:00Z')).toBe('1d ago');
  });
});
