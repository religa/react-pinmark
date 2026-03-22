export interface TargetInfo {
  text: string;
  tagName: string;
  attributes: Record<string, string>;
  dimensions?: { width: number; height: number };
  isDisabled?: boolean;
  isHidden?: boolean;
  surroundingText?: string;
  nearbyLabel?: string;
}

export interface CapturedContext {
  viewport: { width: number; height: number };
  userAgent: string;
  timestamp: string;
  pageTitle?: string;
  targetElement?: TargetInfo;
  custom?: Record<string, unknown>;
}

const ATTR_NAMES = ['id', 'data-testid', 'data-comment-anchor', 'aria-label', 'role', 'name', 'data-field'];

export function captureTargetInfo(element: HTMLElement): TargetInfo {
  const attributes: Record<string, string> = {};
  for (const attr of ATTR_NAMES) {
    const val = element.getAttribute(attr);
    if (val !== null) attributes[attr] = val;
  }

  if (Object.keys(attributes).length === 0) {
    let el: HTMLElement | null = element.parentElement;
    while (el && el !== document.documentElement) {
      for (const attr of ATTR_NAMES) {
        const val = el.getAttribute(attr);
        if (val !== null) {
          attributes[`parent_${attr}`] = val;
        }
      }
      if (Object.keys(attributes).length > 0) break;
      el = el.parentElement;
    }
  }

  const rect = element.getBoundingClientRect();
  const dimensions = (rect.width > 0 || rect.height > 0)
    ? { width: Math.round(rect.width), height: Math.round(rect.height) }
    : undefined;

  const isDisabled = (element as HTMLButtonElement | HTMLInputElement).disabled === true
    || element.getAttribute('aria-disabled') === 'true'
    || undefined;

  const computedStyle = window.getComputedStyle(element);
  const isHidden = (
    computedStyle.display === 'none' ||
    computedStyle.visibility === 'hidden' ||
    computedStyle.opacity === '0' ||
    element.hasAttribute('hidden')
  ) || undefined;

  const surroundingText = captureSurroundingText(element);
  const nearbyLabel = findNearbyLabel(element);

  return {
    text: (element.innerText || element.textContent || '').trim().slice(0, 200),
    tagName: element.tagName.toLowerCase(),
    attributes,
    dimensions,
    isDisabled,
    isHidden,
    surroundingText,
    nearbyLabel,
  };
}

export function findNearbyLabel(element: HTMLElement): string | undefined {
  // 1. Explicit <label for="id">
  if (element.id) {
    const label = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(element.id)}"]`);
    if (label) return (label.innerText || label.textContent || '').trim().slice(0, 100);
  }

  // 2. Wrapping <label>
  const wrappingLabel = element.closest('label');
  if (wrappingLabel) {
    const clone = wrappingLabel.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('input, select, textarea').forEach(el => el.remove());
    const text = (clone.innerText || clone.textContent || '').trim();
    if (text) return text.slice(0, 100);
  }

  // 3. aria-labelledby (spec allows space-separated IDs)
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelText = labelledBy
      .trim()
      .split(/\s+/)
      .map((id) => document.getElementById(id))
      .filter((refEl): refEl is HTMLElement => refEl !== null)
      .map((refEl) => (refEl.innerText || refEl.textContent || '').trim())
      .filter(Boolean)
      .join(' ')
      .slice(0, 100);
    if (labelText) return labelText;
  }

  // 4. aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim().slice(0, 100);

  // 5. Table context: column header for <td>/<th>
  const cell = element.closest('td, th') as HTMLTableCellElement | null;
  if (cell) {
    const row = cell.closest('tr');
    const table = cell.closest('table');
    if (row && table) {
      const cellIndex = Array.from(row.cells).indexOf(cell);
      const headerRow = table.querySelector('thead tr') ?? table.querySelector('tr');
      if (headerRow && cellIndex >= 0) {
        const headerCell = headerRow.children[cellIndex];
        if (headerCell) {
          const headerText = ((headerCell as HTMLElement).innerText || (headerCell as HTMLElement).textContent || '').trim();
          if (headerText) return headerText.slice(0, 100);
        }
      }
    }
  }

  // 6. Nearest heading — walk up (max 5 levels) for preceding heading sibling or ancestor heading
  let el: HTMLElement | null = element;
  let depth = 0;
  while (el && el !== document.body && depth < 5) {
    let sibling = el.previousElementSibling;
    while (sibling) {
      if (sibling instanceof HTMLElement && /^H[1-6]$/.test(sibling.tagName)) {
        return (sibling.innerText || sibling.textContent || '').trim().slice(0, 100);
      }
      sibling = sibling.previousElementSibling;
    }
    if (el.parentElement && /^H[1-6]$/.test(el.parentElement.tagName)) {
      return (el.parentElement.innerText || el.parentElement.textContent || '').trim().slice(0, 100);
    }
    el = el.parentElement;
    depth++;
  }

  return undefined;
}

export function captureSurroundingText(element: HTMLElement): string | undefined {
  const parent = element.parentElement;
  if (!parent || parent === document.body || parent === document.documentElement) {
    return undefined;
  }

  const parentText = (parent.innerText || parent.textContent || '').trim();
  const elementText = (element.innerText || element.textContent || '').trim();

  if (!elementText || !parentText || parentText === elementText) {
    return undefined;
  }

  const index = parentText.indexOf(elementText);
  if (index === -1) return undefined;

  const RADIUS = 50;
  const before = parentText.slice(Math.max(0, index - RADIUS), index).trim();
  const after = parentText.slice(index + elementText.length, index + elementText.length + RADIUS).trim();

  if (!before && !after) return undefined;

  const parts: string[] = [];
  if (before) parts.push((index - RADIUS > 0 ? '...' : '') + before);
  parts.push(`[${elementText.slice(0, 50)}]`);
  if (after) parts.push(after + (index + elementText.length + RADIUS < parentText.length ? '...' : ''));

  return parts.join(' ');
}

export function captureContext(
  customProvider?: () => Record<string, unknown>,
  targetInfo?: TargetInfo,
): CapturedContext {
  const ctx: CapturedContext = {
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    pageTitle: document.title || undefined,
  };

  if (targetInfo) {
    ctx.targetElement = targetInfo;
  }

  if (customProvider) {
    try {
      ctx.custom = customProvider();
    } catch (err) {
      console.warn('[react-pinmark] contextProvider threw:', err);
    }
  }

  return ctx;
}
