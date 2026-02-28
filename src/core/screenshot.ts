export interface CaptureOptions {
  quality?: number;  // JPEG quality 0–1, default 0.8
  maxWidth?: number; // scale down if viewport wider than this, default 1920
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

    const dataUrl = await toJpeg(document.documentElement, {
      quality,
      pixelRatio,
      canvasWidth: window.innerWidth,
      canvasHeight: window.innerHeight,
      style: {
        transform: `translateY(-${window.scrollY}px)`,
      },
      filter: (node: Node) => {
        if (!(node instanceof Element)) return true;
        return !node.classList.contains('rc-root') &&
               !node.classList.contains('rc-screenshot-hide');
      },
    });

    const response = await fetch(dataUrl);
    return await response.blob();
  } catch (err) {
    console.warn('[react-pinmark] Screenshot capture failed:', err);
    return null;
  }
}
