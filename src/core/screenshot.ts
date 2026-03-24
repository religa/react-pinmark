import type { PinPosition } from './types';
import { resolvePin } from './pin-resolver';

export interface CaptureOptions {
  quality?: number;  // JPEG quality 0–1, default 0.8
  maxWidth?: number; // cap output pixel width (viewport × devicePixelRatio), default 1920
  /** Use devicePixelRatio for sharper captures on HiDPI displays. Default true. */
  useDevicePixelRatio?: boolean;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Finds all elements with non-zero scroll positions and applies CSS transforms
 * to their children to simulate the scroll. This is needed because html-to-image
 * clones the DOM, and scroll positions (scrollLeft/scrollTop) — which are runtime
 * state, not HTML attributes — are lost during cloning. CSS inline transforms ARE
 * preserved in the clone.
 *
 * Returns a cleanup function that restores original DOM state.
 */
function preserveScrollPositions(): () => void {
  const restoreFns: Array<() => void> = [];

  const walker = document.createTreeWalker(
    document.documentElement,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        if ((node as Element).classList?.contains('rc-root')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  let current = walker.nextNode();
  while (current) {
    // Skip document.body — main window scroll is handled separately via the
    // style.transform option passed to toJpeg().
    if (
      current !== document.body &&
      current instanceof HTMLElement &&
      (current.scrollLeft > 0 || current.scrollTop > 0)
    ) {
      const el = current;
      const savedScrollLeft = el.scrollLeft;
      const savedScrollTop = el.scrollTop;
      const childRestores: Array<() => void> = [];

      // Apply negative transforms to direct children to simulate scroll position.
      // With scrollLeft/scrollTop reset to 0 and children shifted by the scroll
      // amount, the visual result is identical to the original scrolled state.
      for (const child of Array.from(el.children)) {
        if (child instanceof HTMLElement || child instanceof SVGElement) {
          const saved = child.style.transform;
          const tx = savedScrollLeft > 0 ? `-${savedScrollLeft}px` : '0';
          const ty = savedScrollTop > 0 ? `-${savedScrollTop}px` : '0';
          child.style.transform = `translate(${tx}, ${ty})${saved ? ` ${saved}` : ''}`;
          childRestores.push(() => { child.style.transform = saved; });
        }
      }

      // Reset scroll to 0 so the live DOM matches the transforms we just applied
      // (prevents a visual double-shift while capture is in progress).
      el.scrollLeft = 0;
      el.scrollTop = 0;

      restoreFns.push(() => {
        for (const fn of childRestores) fn();
        el.scrollLeft = savedScrollLeft;
        el.scrollTop = savedScrollTop;
      });
    }
    current = walker.nextNode();
  }

  return () => { for (const fn of restoreFns) fn(); };
}

/**
 * Captures the current viewport as a JPEG Blob.
 * Excludes .rc-root (overlay chrome) and .rc-screenshot-hide elements
 * via html-to-image's filter callback so the live page is never visually
 * disrupted during capture.
 * Returns null if html-to-image is unavailable or capture fails.
 */
export async function captureViewport(options?: CaptureOptions): Promise<Blob | null> {
  const quality = options?.quality ?? 0.8;
  const maxWidth = options?.maxWidth ?? 1920;
  const useDevicePixelRatio = options?.useDevicePixelRatio ?? true;

  const restoreScrolls = preserveScrollPositions();
  try {
    const { toJpeg } = await import('html-to-image');

    const dpr = useDevicePixelRatio ? (window.devicePixelRatio || 1) : 1;
    const nativeWidth = window.innerWidth * dpr;
    const pixelRatio = nativeWidth > maxWidth
      ? maxWidth / window.innerWidth
      : dpr;

    // 1x1 transparent JPEG used when cross-origin images can't be inlined.
    // Prevents Firefox (and other strict browsers) from tainting the canvas
    // and aborting the entire capture.
    const PLACEHOLDER =
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsM' +
      'DRABAQ0KDBEMEA0QEBAQEA8REA8REA8REA8REP/AABEIAAEAAQMBIgACEQEDEQH/xABLAAEBAAAAAAAAAAAAAAAAAAAACgEBAQAA' +
      'AAAAAAAAAAAAAAAAABABAAAAAAAAAAAAAAAAAAAAEQEAAAAAAAAAAAAAAAAAAAAf/9oADAMBAAIRAxEAPwA/8H//2Q==';

    const dataUrl = await toJpeg(document.documentElement, {
      quality,
      pixelRatio,
      canvasWidth: window.innerWidth,
      canvasHeight: window.innerHeight,
      cacheBust: true,
      imagePlaceholder: PLACEHOLDER,
      style: {
        transform: `translateY(-${window.scrollY}px)`,
      },
      filter: (node: Node) => {
        if (!(node instanceof Element)) return true;
        return !node.classList.contains('rc-root') &&
               !node.classList.contains('rc-screenshot-hide');
      },
    });

    return dataUrlToBlob(dataUrl);
  } catch (err) {
    console.warn('[react-pinmark] Screenshot capture failed:', err);
    return null;
  } finally {
    restoreScrolls();
  }
}

/**
 * Captures the viewport with a visible pin marker and the pin scrolled into view.
 * Injects a temporary marker element at the pin's resolved coordinates,
 * scrolls so the pin is centered, captures, then cleans up.
 */
export async function captureViewportWithPin(
  pin: PinPosition,
  options?: CaptureOptions,
): Promise<Blob | null> {
  const resolved = resolvePin(pin);

  // Scroll so the pin is roughly centered in the viewport
  const savedScrollY = window.scrollY;
  const targetScrollY = Math.max(0, resolved.top - window.innerHeight / 2);
  window.scrollTo({ top: targetScrollY, behavior: 'instant' });

  // Inject marker at the pin location
  const marker = document.createElement('div');
  marker.className = 'rc-screenshot-marker';
  marker.style.left = `${resolved.left}px`;
  marker.style.top = `${resolved.top}px`;
  document.body.appendChild(marker);

  try {
    return await captureViewport(options);
  } finally {
    marker.remove();
    window.scrollTo({ top: savedScrollY, behavior: 'instant' });
  }
}
