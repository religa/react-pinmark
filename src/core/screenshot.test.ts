import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { captureViewport } from './screenshot';

vi.mock('html-to-image', () => ({
  toJpeg: vi.fn(),
}));

import { toJpeg } from 'html-to-image';

function makeFetchMock(blob: Blob = new Blob(['img'], { type: 'image/jpeg' })) {
  return vi.fn().mockResolvedValue({ blob: vi.fn().mockResolvedValue(blob) });
}

describe('captureViewport', () => {
  let rcRoot: HTMLElement;

  beforeEach(() => {
    rcRoot = document.createElement('div');
    rcRoot.className = 'rc-root';
    document.body.appendChild(rcRoot);

    vi.stubGlobal('fetch', makeFetchMock());
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('innerHeight', 800);
    vi.stubGlobal('scrollY', 0);
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
    vi.mocked(toJpeg).mockResolvedValue('data:image/jpeg;base64,AA==');
    await captureViewport({ maxWidth: 1200 });
    expect(vi.mocked(toJpeg)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ pixelRatio: 0.5 }),
    );
  });

  it('uses pixelRatio 1 when viewport is within maxWidth', async () => {
    vi.stubGlobal('innerWidth', 1000);
    vi.mocked(toJpeg).mockResolvedValue('data:image/jpeg;base64,AA==');
    await captureViewport({ maxWidth: 1920 });
    expect(vi.mocked(toJpeg)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ pixelRatio: 1 }),
    );
  });
});
