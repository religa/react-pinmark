import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { captureViewport, captureViewportWithPin } from './screenshot';

vi.mock('html-to-image', () => ({
  toJpeg: vi.fn(),
}));

vi.mock('./pin-resolver', () => ({
  resolvePin: vi.fn(() => ({ left: 200, top: 400 })),
}));

import { toJpeg } from 'html-to-image';
import { resolvePin } from './pin-resolver';

describe('captureViewport', () => {
  let rcRoot: HTMLElement;

  beforeEach(() => {
    rcRoot = document.createElement('div');
    rcRoot.className = 'rc-root';
    document.body.appendChild(rcRoot);

    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('innerHeight', 800);
    vi.stubGlobal('scrollY', 0);
    vi.stubGlobal('devicePixelRatio', 1);
  });

  afterEach(() => {
    document.body.removeChild(rcRoot);
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it('returns a Blob on success', async () => {
    vi.mocked(toJpeg).mockResolvedValue('data:image/jpeg;base64,AA==');
    const result = await captureViewport();
    expect(result).toBeInstanceOf(Blob);
  });

  it('returns null when html-to-image throws', async () => {
    vi.mocked(toJpeg).mockRejectedValue(new Error('canvas taint'));
    const result = await captureViewport();
    expect(result).toBeNull();
  });

  it('does not hide .rc-root with visibility during capture', async () => {
    vi.mocked(toJpeg).mockResolvedValue('data:image/jpeg;base64,AA==');
    await captureViewport();
    // rc-root should never have its visibility changed
    expect(rcRoot.style.visibility).toBe('');
  });

  it('excludes .rc-root and .rc-screenshot-hide via filter', async () => {
    vi.mocked(toJpeg).mockResolvedValue('data:image/jpeg;base64,AA==');
    await captureViewport();

    const call = vi.mocked(toJpeg).mock.calls[0];
    const opts = call[1] as { filter: (node: Node) => boolean };
    expect(opts.filter).toBeDefined();

    // .rc-root should be excluded
    const rcEl = document.createElement('div');
    rcEl.className = 'rc-root';
    expect(opts.filter(rcEl)).toBe(false);

    // .rc-screenshot-hide should be excluded
    const hideEl = document.createElement('div');
    hideEl.className = 'rc-screenshot-hide';
    expect(opts.filter(hideEl)).toBe(false);

    // Regular elements should be included
    const normalEl = document.createElement('div');
    expect(opts.filter(normalEl)).toBe(true);

    // Text nodes should be included
    const textNode = document.createTextNode('hello');
    expect(opts.filter(textNode)).toBe(true);
  });

  it('respects maxWidth option by scaling pixelRatio down', async () => {
    vi.stubGlobal('innerWidth', 2400);
    vi.stubGlobal('devicePixelRatio', 1);
    vi.mocked(toJpeg).mockResolvedValue('data:image/jpeg;base64,AA==');
    await captureViewport({ maxWidth: 1200 });
    expect(vi.mocked(toJpeg)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ pixelRatio: 0.5 }),
    );
  });

  it('uses devicePixelRatio when native width is within maxWidth', async () => {
    vi.stubGlobal('innerWidth', 900);
    vi.stubGlobal('devicePixelRatio', 2);
    vi.mocked(toJpeg).mockResolvedValue('data:image/jpeg;base64,AA==');
    // 900 * 2 = 1800 < 1920, so full DPR is used
    await captureViewport({ maxWidth: 1920 });
    expect(vi.mocked(toJpeg)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ pixelRatio: 2 }),
    );
  });

  it('caps Retina output to maxWidth', async () => {
    vi.stubGlobal('innerWidth', 1200);
    vi.stubGlobal('devicePixelRatio', 2);
    vi.mocked(toJpeg).mockResolvedValue('data:image/jpeg;base64,AA==');
    // 1200 * 2 = 2400 > 1920, so pixelRatio = 1920 / 1200 = 1.6
    await captureViewport({ maxWidth: 1920 });
    expect(vi.mocked(toJpeg)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ pixelRatio: 1920 / 1200 }),
    );
  });

  it('falls back to pixelRatio 1 when useDevicePixelRatio is false', async () => {
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('devicePixelRatio', 2);
    vi.mocked(toJpeg).mockResolvedValue('data:image/jpeg;base64,AA==');
    await captureViewport({ maxWidth: 1920, useDevicePixelRatio: false });
    expect(vi.mocked(toJpeg)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ pixelRatio: 1 }),
    );
  });

  describe('inner scroll preservation', () => {
    let scrollContainer: HTMLDivElement;
    let scrollContent: HTMLDivElement;

    beforeEach(() => {
      scrollContainer = document.createElement('div');
      scrollContent = document.createElement('div');
      scrollContainer.appendChild(scrollContent);
      document.body.appendChild(scrollContainer);

      // jsdom doesn't support real scroll, so we use defineProperty
      Object.defineProperty(scrollContainer, 'scrollLeft', {
        value: 515,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(scrollContainer, 'scrollTop', {
        value: 0,
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      document.body.removeChild(scrollContainer);
    });

    it('applies transform to children of scrolled elements during capture', async () => {
      let capturedTransform = '';
      vi.mocked(toJpeg).mockImplementation(async () => {
        capturedTransform = scrollContent.style.transform;
        return 'data:image/jpeg;base64,AA==';
      });

      await captureViewport();

      // During capture, the transform should simulate the scroll
      expect(capturedTransform).toBe('translate(-515px, 0)');
    });

    it('restores children transforms after capture', async () => {
      scrollContent.style.transform = 'scale(1.5)';
      vi.mocked(toJpeg).mockResolvedValue('data:image/jpeg;base64,AA==');

      await captureViewport();

      expect(scrollContent.style.transform).toBe('scale(1.5)');
    });

    it('restores scroll positions after capture', async () => {
      vi.mocked(toJpeg).mockResolvedValue('data:image/jpeg;base64,AA==');

      await captureViewport();

      expect(scrollContainer.scrollLeft).toBe(515);
    });

    it('restores scroll positions even when capture fails', async () => {
      vi.mocked(toJpeg).mockRejectedValue(new Error('fail'));

      await captureViewport();

      expect(scrollContainer.scrollLeft).toBe(515);
    });

    it('composes with existing inline transforms', async () => {
      scrollContent.style.transform = 'rotate(45deg)';
      let capturedTransform = '';
      vi.mocked(toJpeg).mockImplementation(async () => {
        capturedTransform = scrollContent.style.transform;
        return 'data:image/jpeg;base64,AA==';
      });

      await captureViewport();

      expect(capturedTransform).toBe('translate(-515px, 0) rotate(45deg)');
      // Original transform restored
      expect(scrollContent.style.transform).toBe('rotate(45deg)');
    });

    it('applies transform to SVG children of scrolled elements', async () => {
      const svgChild = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      scrollContainer.appendChild(svgChild);

      let capturedTransform = '';
      vi.mocked(toJpeg).mockImplementation(async () => {
        capturedTransform = (svgChild as SVGSVGElement).style.transform;
        return 'data:image/jpeg;base64,AA==';
      });

      await captureViewport();

      expect(capturedTransform).toBe('translate(-515px, 0)');
      // Restore for cleanup
      scrollContainer.removeChild(svgChild);
    });

    it('applies transform with both axes scrolled', async () => {
      Object.defineProperty(scrollContainer, 'scrollTop', {
        value: 120,
        writable: true,
        configurable: true,
      });

      let capturedTransform = '';
      vi.mocked(toJpeg).mockImplementation(async () => {
        capturedTransform = scrollContent.style.transform;
        return 'data:image/jpeg;base64,AA==';
      });

      await captureViewport();

      expect(capturedTransform).toBe('translate(-515px, -120px)');
    });

    it('skips elements inside .rc-root', async () => {
      // Move the scrolled container inside rc-root
      document.body.removeChild(scrollContainer);
      rcRoot.appendChild(scrollContainer);

      let capturedTransform = '';
      vi.mocked(toJpeg).mockImplementation(async () => {
        capturedTransform = scrollContent.style.transform;
        return 'data:image/jpeg;base64,AA==';
      });

      await captureViewport();

      // Should NOT have been modified — it's inside .rc-root
      expect(capturedTransform).toBe('');

      // Move it back for cleanup
      rcRoot.removeChild(scrollContainer);
      document.body.appendChild(scrollContainer);
    });
  });
});

describe('captureViewportWithPin', () => {
  beforeEach(() => {
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('innerHeight', 800);
    vi.stubGlobal('scrollY', 100);
    vi.stubGlobal('scrollTo', vi.fn());
    vi.stubGlobal('devicePixelRatio', 1);
    vi.mocked(resolvePin).mockReturnValue({ left: 200, top: 400 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
    // Clean up any markers left in DOM
    document.querySelectorAll('.rc-screenshot-marker').forEach((el) => el.remove());
  });

  it('creates and removes the marker element', async () => {
    vi.mocked(toJpeg).mockResolvedValue('data:image/jpeg;base64,AA==');
    await captureViewportWithPin({ x: 20, y: 400 });

    // Marker should be removed after capture
    expect(document.querySelector('.rc-screenshot-marker')).toBeNull();
  });

  it('positions marker at resolved coordinates', async () => {
    let capturedMarker: HTMLElement | null = null;
    vi.mocked(toJpeg).mockImplementation(async () => {
      capturedMarker = document.querySelector('.rc-screenshot-marker');
      return 'data:image/jpeg;base64,AA==';
    });

    await captureViewportWithPin({ x: 20, y: 400 });

    expect(capturedMarker).not.toBeNull();
    expect(capturedMarker!.style.left).toBe('200px');
    expect(capturedMarker!.style.top).toBe('400px');
  });

  it('marker is removed even when capture throws', async () => {
    vi.mocked(toJpeg).mockRejectedValue(new Error('fail'));
    await captureViewportWithPin({ x: 20, y: 400 });

    expect(document.querySelector('.rc-screenshot-marker')).toBeNull();
  });

  it('saves and restores scroll position', async () => {
    vi.mocked(toJpeg).mockResolvedValue('data:image/jpeg;base64,AA==');
    await captureViewportWithPin({ x: 20, y: 400 });

    const scrollTo = vi.mocked(window.scrollTo);
    // First call: scroll to center pin
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' }); // max(0, 400 - 400) = 0
    // Last call: restore scroll
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 100, behavior: 'instant' });
  });

  it('restores scroll position even when capture throws', async () => {
    vi.mocked(toJpeg).mockRejectedValue(new Error('fail'));
    await captureViewportWithPin({ x: 20, y: 400 });

    const scrollTo = vi.mocked(window.scrollTo);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 100, behavior: 'instant' });
  });
});
