import type { Author } from './types';

const STORAGE_KEY = 'rc_author';

function generateId(): string {
  // randomUUID is missing outside secure contexts (e.g. http on a LAN IP).
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function write(author: Author): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(author));
  } catch {
    // Silently ignore — localStorage may be full or restricted
  }
}

/** The saved author. A name saved before ids existed gets an id now (persisted). */
export function getStoredAuthor(): Author | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.displayName !== 'string') return null;
    if (typeof parsed.id === 'string' && parsed.id) {
      return { displayName: parsed.displayName, id: parsed.id };
    }
    const backfilled = { displayName: parsed.displayName, id: generateId() };
    write(backfilled);
    return backfilled;
  } catch {
    return null;
  }
}

/** Saves the name. The first save creates the author's id; renaming keeps it. */
export function setStoredAuthor(displayName: string): Author {
  const author = { displayName, id: getStoredAuthor()?.id ?? generateId() };
  write(author);
  return author;
}

export function clearStoredAuthor(): void {
  localStorage.removeItem(STORAGE_KEY);
}
