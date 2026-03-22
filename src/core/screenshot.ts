import type { PinPosition } from './types';
import { resolvePin } from './pin-resolver';

export interface CaptureOptions {
  quality?: number;  // JPEG quality 0–1, default 0.8
  maxWidth?: number; // scale down if viewport wider than this, default 1920
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
 * Captures the current viewport as a JPEG Blob.
 * Excludes .rc-root (overlay chrome) and .rc-screenshot-hide elements
 * via html-to-image's filter callback so the live page is never visually
 * disrupted during capture.
 * Returns null if html-to-image is unavailable or capture fails.
 */
export async function captureViewport(options?: CaptureOptions): Promise<Blob | null> {
  const quality = options?.quality ?? 0.8;
  const maxWidth = options?.maxWidth ?? 1920;

  try {
    const { toJpeg } = await import('html-to-image');

    const pixelRatio = window.innerWidth > maxWidth
      ? maxWidth / window.innerWidth
      : 1;

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
