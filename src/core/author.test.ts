import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getStoredAuthor, setStoredAuthor, clearStoredAuthor } from './author';

function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

describe('author identity', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    vi.stubGlobal('localStorage', mockStorage);
  });

  it('returns null when no author is stored', () => {
    expect(getStoredAuthor()).toBeNull();
  });

  it('stores and retrieves an author', () => {
    setStoredAuthor({ displayName: 'Alice' });
    expect(getStoredAuthor()).toEqual({ displayName: 'Alice' });
  });

  it('clears the stored author', () => {
    setStoredAuthor({ displayName: 'Bob' });
    clearStoredAuthor();
    expect(getStoredAuthor()).toBeNull();
  });

  it('returns null for corrupt stored data', () => {
    mockStorage.setItem('rc_author', 'not-json');
    expect(getStoredAuthor()).toBeNull();
  });

  it('returns null for stored data missing displayName', () => {
    mockStorage.setItem('rc_author', '{"name":"Jane"}');
    expect(getStoredAuthor()).toBeNull();
  });
});
