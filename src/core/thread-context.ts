import type { Thread, PinPosition } from './types';
import type { TargetInfo } from './context-capture';

const BROWSERS: [RegExp, string][] = [
  [/Edg\/(\d+)/, 'Edge'],
  [/OPR\/(\d+)/, 'Opera'],
  [/CriOS\/(\d+)/, 'Chrome'],   // Chrome on iOS uses CriOS token
  [/Firefox\/(\d+)/, 'Firefox'],
  [/Chrome\/(\d+)/, 'Chrome'],
  [/Version\/(\d+).*Safari/, 'Safari'],
];

export function parseUserAgent(ua: string): { browser: string; os: string } {
  let browser = 'Unknown';
  for (const [re, name] of BROWSERS) {
    const m = ua.match(re);
    if (m) { browser = `${name} ${m[1]}`; break; }
  }

  let os = 'Unknown';
  if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Linux/.test(ua)) os = 'Linux';

  return { browser, os };
}

export function formatElementIdentity(
  pin: PinPosition,
  targetElement?: TargetInfo,
): string | null {
  const anchorLabel = pin.anchorLabel?.trim();
  if (anchorLabel) return anchorLabel;

  if (!targetElement) return null;

  const { tagName, attributes, nearbyLabel } = targetElement;

  const ownAriaLabel = attributes['aria-label']?.trim();
  if (ownAriaLabel) return ownAriaLabel;

  const nearby = nearbyLabel?.trim();
  if (nearby) return nearby;

  const parentAriaLabel = attributes['parent_aria-label']?.trim();
  if (parentAriaLabel) return parentAriaLabel;

  const id = attributes['id']?.trim();
  if (id) return `${tagName}#${id}`;

  const testId = attributes['data-testid']?.trim();
  if (testId) return `${tagName}[data-testid="${testId}"]`;

  // Bare tagName conveys no element-specific information — omit rather than show noise.
  return null;
}

export interface ThreadContext {
  browser: string | null;
  os: string | null;
  viewport: string | null;
  screen: string | null;         // physical screen resolution, e.g. "2560×1600"
  elementIdentity: string | null;
  elementSize: string | null;    // clicked element dimensions, e.g. "120×40"
  surroundingText: string | null;
}

function finiteNum(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function parseThreadContext(thread: Thread): ThreadContext | null {
  const meta = thread.metadata;
  if (!meta) return null;

  const ua = typeof meta.userAgent === 'string' ? meta.userAgent : null;
  const { browser, os } = ua ? parseUserAgent(ua) : { browser: null, os: null };

  const vp = meta.viewport as { width?: unknown; height?: unknown } | undefined;
  const vpW = finiteNum(vp?.width);
  const vpH = finiteNum(vp?.height);
  const dpr = finiteNum(meta.devicePixelRatio) ?? 1;
  const viewport = vpW !== null && vpH !== null
    ? `${vpW}×${vpH}${dpr > 1 ? ` @${dpr}x` : ''}`
    : null;

  const sc = meta.screen as { width?: unknown; height?: unknown } | undefined;
  const scW = finiteNum(sc?.width);
  const scH = finiteNum(sc?.height);
  const screen = scW !== null && scH !== null ? `${scW}×${scH}` : null;

  const targetElement = meta.targetElement as TargetInfo | undefined;
  const elementIdentity = formatElementIdentity(thread.pin, targetElement);

  const dim = targetElement?.dimensions;
  const dimW = finiteNum(dim?.width);
  const dimH = finiteNum(dim?.height);
  const elementSize = dimW !== null && dimH !== null ? `${dimW}×${dimH}` : null;

  const surroundingText = typeof targetElement?.surroundingText === 'string'
    ? targetElement.surroundingText
    : null;

  if (browser === null && os === null && viewport === null && screen === null
      && elementIdentity === null && elementSize === null && surroundingText === null) {
    return null;
  }

  return { browser, os, viewport, screen, elementIdentity, elementSize, surroundingText };
}
