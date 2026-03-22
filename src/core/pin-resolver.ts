import type { PinPosition, ScrollContainerInfo } from './types';

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
): { selector: string; selectorOffset: { x: number; y: number }; anchorLabel?: string } | null {
  // 1. Build a precise CSS path from target to nearest id / data-comment-anchor / body.
  const pathResult = buildSelectorPath(target);
  if (pathResult) {
    const rect = target.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return {
        selector: pathResult.selector,
        selectorOffset: {
          x: (clientX - rect.left) / rect.width,
          y: (clientY - rect.top) / rect.height,
        },
        anchorLabel: pathResult.anchorLabel,
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
            anchorLabel: anchor ? `anchor:${anchor}` : undefined,
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

const LABEL_PREFIXES: Record<string, string> = {
  'data-comment-anchor': 'anchor',
  'data-testid': 'testid',
  'data-id': 'data-id',
  'data-field': 'field',
  'data-rowindex': 'rowindex',
  'name': 'name',
};

/**
 * Try to produce a unique CSS selector from a single attribute on the element.
 * Checks (in priority order): id, data-comment-anchor, data-testid,
 * data-id (MUI DataGrid row key), data-field (MUI DataGrid cell),
 * data-rowindex, name.
 *
 * For non-id attributes, falls back to tag-qualified selectors
 * (e.g. `div[data-id="42"]`) when the bare attribute isn't globally unique.
 */
function uniqueAttrSelector(el: HTMLElement): { selector: string; anchorLabel: string } | null {
  if (el.id && !ROOT_IDS.has(el.id)) {
    return { selector: `#${CSS.escape(el.id)}`, anchorLabel: `#${el.id}` };
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
    const label = `${LABEL_PREFIXES[attr]}:${value}`;
    try {
      if (document.querySelectorAll(attrSel).length === 1) return { selector: attrSel, anchorLabel: label };
      if (document.querySelectorAll(tagSel).length === 1) return { selector: tagSel, anchorLabel: label };
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
function buildSelectorPath(target: HTMLElement): { selector: string; anchorLabel?: string } | null {
  if (target === document.body || target === document.documentElement) {
    return null;
  }

  const parts: string[] = [];
  let anchorLabel: string | undefined;
  let el: HTMLElement | null = target;

  while (el && el !== document.body && el !== document.documentElement) {
    // Anchor to a unique attribute (id, data-comment-anchor, data-testid, name)
    const anchor = uniqueAttrSelector(el);
    if (anchor) {
      parts.unshift(anchor.selector);
      anchorLabel = anchor.anchorLabel;
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
      return { selector, anchorLabel };
    }
  } catch {
    return null;
  }
  return null;
}

export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36).slice(0, 8);
}

function captureContentFingerprint(element: HTMLElement): PinPosition['contentFingerprint'] {
  const text = (element.innerText || element.textContent || '').trim();
  if (!text) return undefined;

  const tagName = element.tagName.toLowerCase();
  const parent = element.parentElement;
  let nthOfType = 1;
  if (parent) {
    const siblings = Array.from(parent.children).filter(
      (el) => el.tagName === element.tagName,
    );
    nthOfType = siblings.indexOf(element) + 1;
  }

  let parentSelector: string | undefined;
  let el: HTMLElement | null = element.parentElement;
  while (el && el !== document.body) {
    const anchor = uniqueAttrSelector(el);
    if (anchor) {
      parentSelector = anchor.selector;
      break;
    }
    el = el.parentElement;
  }

  return {
    textHash: simpleHash(text),
    tagName,
    nthOfType,
    parentSelector,
  };
}

function captureScrollContainers(element: HTMLElement): ScrollContainerInfo[] {
  const containers: ScrollContainerInfo[] = [];
  let el: HTMLElement | null = element.parentElement;

  while (el && el !== document.documentElement) {
    const style = window.getComputedStyle(el);
    const isScrollable =
      (style.overflowY === 'auto' || style.overflowY === 'scroll' ||
       style.overflowX === 'auto' || style.overflowX === 'scroll') &&
      (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth);

    if (isScrollable) {
      const selectorResult = buildSelectorPath(el);
      if (selectorResult) {
        containers.push({
          selector: selectorResult.selector,
          scrollTop: el.scrollTop,
          scrollLeft: el.scrollLeft,
        });
      }
    }
    el = el.parentElement;
  }

  return containers;
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
    if (selectorInfo.anchorLabel) {
      pin.anchorLabel = selectorInfo.anchorLabel;
    }
  }

  const fingerprint = captureContentFingerprint(target);
  if (fingerprint) {
    pin.contentFingerprint = fingerprint;
  }

  const scrollCont = captureScrollContainers(target);
  if (scrollCont.length > 0) {
    pin.scrollContainers = scrollCont;
  }

  return pin;
}
