import { describe, it, expect } from 'vitest';
import { parseUserAgent, formatElementIdentity, parseThreadContext } from './thread-context';
import type { Thread } from './types';
import type { TargetInfo } from './context-capture';

const CHROME_MACOS_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const EDGE_WINDOWS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0';
const FIREFOX_LINUX_UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0';
const SAFARI_IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function makeTargetInfo(overrides: Partial<TargetInfo> = {}): TargetInfo {
  return {
    text: '',
    tagName: 'div',
    attributes: {},
    ...overrides,
  };
}

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: 'thread-1',
    projectId: 'proj-1',
    pageUrl: '/',
    pin: { x: 50, y: 200 },
    status: 'open',
    createdAt: '2024-01-01T00:00:00Z',
    comments: [],
    ...overrides,
  };
}

describe('parseUserAgent', () => {
  it('detects Chrome on macOS', () => {
    expect(parseUserAgent(CHROME_MACOS_UA)).toEqual({ browser: 'Chrome 125', os: 'macOS' });
  });

  it('detects Edge on Windows (not Chrome)', () => {
    const result = parseUserAgent(EDGE_WINDOWS_UA);
    expect(result).toEqual({ browser: 'Edge 124', os: 'Windows' });
  });

  it('detects Firefox on Linux', () => {
    expect(parseUserAgent(FIREFOX_LINUX_UA)).toEqual({ browser: 'Firefox 127', os: 'Linux' });
  });

  it('detects Safari on iOS', () => {
    expect(parseUserAgent(SAFARI_IOS_UA)).toEqual({ browser: 'Safari 17', os: 'iOS' });
  });

  it('returns Unknown for unrecognized UA', () => {
    expect(parseUserAgent('CustomBot/1.0')).toEqual({ browser: 'Unknown', os: 'Unknown' });
  });
});

describe('formatElementIdentity', () => {
  it('prefers pin.anchorLabel over everything', () => {
    const result = formatElementIdentity(
      { x: 0, y: 0, anchorLabel: 'Submit Button' },
      makeTargetInfo({ attributes: { 'aria-label': 'ignored' } }),
    );
    expect(result).toBe('Submit Button');
  });

  it('uses aria-label when no anchorLabel', () => {
    const result = formatElementIdentity(
      { x: 0, y: 0 },
      makeTargetInfo({ tagName: 'button', attributes: { 'aria-label': 'Close dialog' } }),
    );
    expect(result).toBe('Close dialog');
  });

  it('falls back to parent_aria-label when aria-label absent', () => {
    const result = formatElementIdentity(
      { x: 0, y: 0 },
      makeTargetInfo({ attributes: { 'parent_aria-label': 'Filter panel' } }),
    );
    expect(result).toBe('Filter panel');
  });

  it('uses nearbyLabel when no aria-label', () => {
    const result = formatElementIdentity(
      { x: 0, y: 0 },
      makeTargetInfo({ nearbyLabel: 'Email address' }),
    );
    expect(result).toBe('Email address');
  });

  it('formats tag#id when no label', () => {
    const result = formatElementIdentity(
      { x: 0, y: 0 },
      makeTargetInfo({ tagName: 'button', attributes: { id: 'submit-btn' } }),
    );
    expect(result).toBe('button#submit-btn');
  });

  it('formats tag[data-testid] when no id', () => {
    const result = formatElementIdentity(
      { x: 0, y: 0 },
      makeTargetInfo({ tagName: 'input', attributes: { 'data-testid': 'email-field' } }),
    );
    expect(result).toBe('input[data-testid="email-field"]');
  });

  it('returns null when no attributes or labels (bare tagName is noise)', () => {
    const result = formatElementIdentity(
      { x: 0, y: 0 },
      makeTargetInfo({ tagName: 'span', attributes: {} }),
    );
    expect(result).toBeNull();
  });

  it('returns null when no targetElement and no anchorLabel', () => {
    expect(formatElementIdentity({ x: 0, y: 0 })).toBeNull();
  });

  it('prefers nearbyLabel over parent_aria-label when both present', () => {
    // parent_aria-label from a broad ancestor ("Filter panel") should lose to
    // a specific nearby label ("Email address") from a <label for> association.
    const result = formatElementIdentity(
      { x: 0, y: 0 },
      makeTargetInfo({
        attributes: { 'parent_aria-label': 'Filter panel' },
        nearbyLabel: 'Email address',
      }),
    );
    expect(result).toBe('Email address');
  });

  it('ignores whitespace-only anchorLabel and falls back', () => {
    const result = formatElementIdentity(
      { x: 0, y: 0, anchorLabel: '   ' },
      makeTargetInfo({ nearbyLabel: 'Email address' }),
    );
    expect(result).toBe('Email address');
  });

  it('ignores whitespace-only aria-label and falls back to nearbyLabel', () => {
    const result = formatElementIdentity(
      { x: 0, y: 0 },
      makeTargetInfo({ tagName: 'input', attributes: { 'aria-label': '  ' }, nearbyLabel: 'Search' }),
    );
    expect(result).toBe('Search');
  });
});

describe('parseThreadContext — numeric validation', () => {
  function makeThread(overrides: Partial<Thread> = {}): Thread {
    return {
      id: 't1', projectId: 'p1', pageUrl: '/', pin: { x: 50, y: 200 },
      status: 'open', createdAt: '2024-01-01T00:00:00Z', comments: [], ...overrides,
    };
  }

  it('returns null viewport when width is NaN', () => {
    const thread = makeThread({ metadata: { userAgent: 'Mozilla/5.0 Chrome/125', viewport: { width: NaN, height: 900 } } });
    expect(parseThreadContext(thread)?.viewport).toBeNull();
  });

  it('returns null viewport when height is Infinity', () => {
    const thread = makeThread({ metadata: { userAgent: 'Mozilla/5.0 Chrome/125', viewport: { width: 1440, height: Infinity } } });
    expect(parseThreadContext(thread)?.viewport).toBeNull();
  });

  it('treats non-finite DPR as 1 (no @Nx suffix)', () => {
    const thread = makeThread({ metadata: { userAgent: 'Mozilla/5.0 Chrome/125', viewport: { width: 800, height: 600 }, devicePixelRatio: NaN } });
    expect(parseThreadContext(thread)?.viewport).toBe('800×600');
  });
});

describe('parseThreadContext', () => {
  it('returns null when metadata is undefined', () => {
    expect(parseThreadContext(makeThread())).toBeNull();
  });

  it('returns partial context (no browser/os) when userAgent is absent but viewport present', () => {
    const thread = makeThread({ metadata: { viewport: { width: 1440, height: 900 } } });
    const result = parseThreadContext(thread);
    expect(result).not.toBeNull();
    expect(result?.browser).toBeNull();
    expect(result?.os).toBeNull();
    expect(result?.viewport).toBe('1440×900');
  });

  it('returns correct ThreadContext for full metadata', () => {
    const thread = makeThread({
      metadata: {
        userAgent: CHROME_MACOS_UA,
        viewport: { width: 1440, height: 900 },
        devicePixelRatio: 1,
      },
    });
    const result = parseThreadContext(thread);
    expect(result).toEqual({
      browser: 'Chrome 125',
      os: 'macOS',
      viewport: '1440×900',
      screen: null,
      elementIdentity: null,
      elementSize: null,
      surroundingText: null,
    });
  });

  it('extracts screen resolution', () => {
    const thread = makeThread({
      metadata: {
        userAgent: CHROME_MACOS_UA,
        screen: { width: 2560, height: 1600 },
      },
    });
    expect(parseThreadContext(thread)?.screen).toBe('2560×1600');
  });

  it('extracts element size from targetElement.dimensions', () => {
    const thread = makeThread({
      metadata: {
        userAgent: CHROME_MACOS_UA,
        targetElement: { text: '', tagName: 'button', attributes: {}, dimensions: { width: 120, height: 40 } },
      },
    });
    expect(parseThreadContext(thread)?.elementSize).toBe('120×40');
  });

  it('extracts surroundingText from targetElement', () => {
    const thread = makeThread({
      metadata: {
        userAgent: CHROME_MACOS_UA,
        targetElement: { text: 'Add to cart', tagName: 'button', attributes: {}, surroundingText: '...Price [Add to cart] $99...' },
      },
    });
    expect(parseThreadContext(thread)?.surroundingText).toBe('...Price [Add to cart] $99...');
  });

  it('returns null elementSize when dimensions absent', () => {
    const thread = makeThread({
      metadata: {
        userAgent: CHROME_MACOS_UA,
        targetElement: { text: '', tagName: 'button', attributes: {} },
      },
    });
    expect(parseThreadContext(thread)?.elementSize).toBeNull();
  });

  it('appends @Nx suffix when DPR > 1', () => {
    const thread = makeThread({
      metadata: {
        userAgent: CHROME_MACOS_UA,
        viewport: { width: 1440, height: 900 },
        devicePixelRatio: 2,
      },
    });
    expect(parseThreadContext(thread)?.viewport).toBe('1440×900 @2x');
  });

  it('omits @Nx suffix when DPR = 1', () => {
    const thread = makeThread({
      metadata: {
        userAgent: CHROME_MACOS_UA,
        viewport: { width: 1440, height: 900 },
        devicePixelRatio: 1,
      },
    });
    expect(parseThreadContext(thread)?.viewport).toBe('1440×900');
  });

  it('returns null viewport when dimensions absent', () => {
    const thread = makeThread({
      metadata: {
        userAgent: CHROME_MACOS_UA,
      },
    });
    expect(parseThreadContext(thread)?.viewport).toBeNull();
  });

  it('returns null when metadata has no useful fields', () => {
    const thread = makeThread({ metadata: {} });
    expect(parseThreadContext(thread)).toBeNull();
  });

  it('detects CriOS (Chrome on iOS) correctly', () => {
    const thread = makeThread({
      metadata: {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.111 Mobile/15E148 Safari/604.1',
      },
    });
    const result = parseThreadContext(thread);
    expect(result?.browser).toBe('Chrome 124');
    expect(result?.os).toBe('iOS');
  });
});
