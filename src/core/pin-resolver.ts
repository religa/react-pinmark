import type { PinPosition } from './types';

export interface ResolvedPosition {
  left: number;
  top: number;
}

/**
 * Resolve a pin to pixel coordinates.
 * Strategy: selector-first, coordinate-fallback.
 */
export function resolvePin(pin: PinPosition): ResolvedPosition {
  // Try selector-based resolution first
  if (pin.selector) {
    const el = document.querySelector(pin.selector);
    if (el) {
      const rect = el.getBoundingClientRect();
      const scrollY = window.scrollY;
      return {
        left: rect.left + (pin.selectorOffset?.x ?? 0) * rect.width,
        top: rect.top + scrollY + (pin.selectorOffset?.y ?? 0) * rect.height,
      };
    }
  }

  // Fallback to coordinate-based positioning
  return {
    left: (pin.x / 100) * window.innerWidth,
    top: pin.y,
  };
}

/**
 * Detect a stable CSS selector for the given DOM element.
 * Prefers a CSS path (tag:nth-child) anchored to the nearest id or
 * data-comment-anchor, which resolves to the exact element and tracks
 * scrolling. Falls back to a walk-up for data-comment-anchor ancestors.
 */
export function detectSelector(
  target: HTMLElement,
  clientX: number,
  clientY: number,
): { selector: string; selectorOffset: { x: number; y: number } } | null {
  // 1. Build a precise CSS path from target to nearest id / data-comment-anchor / body.
  const pathSelector = buildSelectorPath(target);
  if (pathSelector) {
    const rect = target.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return {
        selector: pathSelector,
        selectorOffset: {
          x: (clientX - rect.left) / rect.width,
          y: (clientY - rect.top) / rect.height,
        },
      };
    }
  }

  // 2. Walk up for explicit data-comment-anchor attributes (user-defined anchors).
  let el: HTMLElement | null = target;
  while (el && el !== document.documentElement) {
    if (el.hasAttribute('data-comment-anchor')) {
      const anchor = el.getAttribute('data-comment-anchor');
      const selector = anchor
        ? `[data-comment-anchor="${CSS.escape(anchor)}"]`
        : `[data-comment-anchor]`;
      if (document.querySelectorAll(selector).length === 1) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return {
            selector,
            selectorOffset: {
              x: (clientX - rect.left) / rect.width,
              y: (clientY - rect.top) / rect.height,
            },
          };
        }
      }
    }
    el = el.parentElement;
  }

  return null;
}

/** Common app-root ids that are too broad to be useful anchors. */
const ROOT_IDS = new Set(['root', 'app', '__next', '__nuxt', 'gatsby-focus-wrapper']);

/**
 * Try to produce a unique CSS selector from a single attribute on the element.
 * Checks (in priority order): id, data-comment-anchor, data-testid,
 * data-id (MUI DataGrid row key), data-field (MUI DataGrid cell),
 * data-rowindex, name.
 *
 * For non-id attributes, falls back to tag-qualified selectors
 * (e.g. `div[data-id="42"]`) when the bare attribute isn't globally unique.
 */
function uniqueAttrSelector(el: HTMLElement): string | null {
  if (el.id && !ROOT_IDS.has(el.id)) {
    return `#${CSS.escape(el.id)}`;
  }

  const tag = el.tagName.toLowerCase();
  const candidates: [string, string | null][] = [
    ['data-comment-anchor', el.getAttribute('data-comment-anchor')],
    ['data-testid', el.getAttribute('data-testid')],
    ['data-id', el.getAttribute('data-id')],
    ['data-field', el.getAttribute('data-field')],
    ['data-rowindex', el.getAttribute('data-rowindex')],
    ['name', el.getAttribute('name')],
  ];

  for (const [attr, value] of candidates) {
    if (value == null) continue;
    const escaped = CSS.escape(value);
    const attrSel = `[${attr}="${escaped}"]`;
    const tagSel = `${tag}[${attr}="${escaped}"]`;
    try {
      if (document.querySelectorAll(attrSel).length === 1) return attrSel;
      if (document.querySelectorAll(tagSel).length === 1) return tagSel;
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Build a CSS selector path from target up to the nearest ancestor with a
 * unique attribute (id, data-comment-anchor, data-testid, name) or to the
 * body. Uses `tag:nth-child(n)` at each level, producing selectors like:
 *   [data-testid="users-table"] > tbody:nth-child(1) > tr:nth-child(3) > td:nth-child(2)
 */
function buildSelectorPath(target: HTMLElement): string | null {
  if (target === document.body || target === document.documentElement) {
    return null;
  }

  const parts: string[] = [];
  let el: HTMLElement | null = target;

  while (el && el !== document.body && el !== document.documentElement) {
    // Anchor to a unique attribute (id, data-comment-anchor, data-testid, name)
    const anchorSel = uniqueAttrSelector(el);
    if (anchorSel) {
      parts.unshift(anchorSel);
      break;
    }

    const parent: HTMLElement | null = el.parentElement;
    if (!parent) break;

    const index = Array.from(parent.children).indexOf(el) + 1;
    parts.unshift(`${el.tagName.toLowerCase()}:nth-child(${index})`);

    el = parent;
  }

  if (parts.length === 0) return null;

  const selector = parts.join(' > ');
  try {
    if (document.querySelectorAll(selector).length === 1) {
      return selector;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Create a PinPosition from a click event.
 */
export function createPinPosition(
  clientX: number,
  clientY: number,
  target: HTMLElement,
): PinPosition {
  const x = (clientX / window.innerWidth) * 100;
  const y = clientY + window.scrollY;

  const selectorInfo = detectSelector(target, clientX, clientY);

  const pin: PinPosition = { x, y };
  if (selectorInfo) {
    pin.selector = selectorInfo.selector;
    pin.selectorOffset = selectorInfo.selectorOffset;
  }

  return pin;
}
