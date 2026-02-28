import type { Author } from './types';

const STORAGE_KEY = 'rc_author';

export function getStoredAuthor(): Author | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.displayName === 'string') {
      return parsed as Author;
    }
    return null;
  } catch {
    return null;
  }
}

export function setStoredAuthor(author: Author): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(author));
  } catch {
    // Silently ignore — localStorage may be full or restricted
  }
}

export function clearStoredAuthor(): void {
  localStorage.removeItem(STORAGE_KEY);
}
