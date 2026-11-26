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

  it('stores an author with a generated id', () => {
    const saved = setStoredAuthor('Alice');
    expect(saved.displayName).toBe('Alice');
    expect(saved.id).toMatch(/.{16,}/);
    expect(getStoredAuthor()).toEqual(saved);
  });

  it('keeps the id when the name changes', () => {
    const first = setStoredAuthor('Alice');
    const renamed = setStoredAuthor('Alice K.');
    expect(renamed).toEqual({ displayName: 'Alice K.', id: first.id });
  });

  it('gives a name saved before ids existed a stable id', () => {
    mockStorage.setItem('rc_author', JSON.stringify({ displayName: 'Old' }));
    const a = getStoredAuthor();
    expect(a?.id).toBeTruthy();
    expect(getStoredAuthor()?.id).toBe(a?.id);
  });

  it('clears the stored author', () => {
    setStoredAuthor('Bob');
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
