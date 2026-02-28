import { describe, it, expect, vi, beforeEach } from 'vitest';
import { captureContext } from './context-capture';

describe('captureContext', () => {
  beforeEach(() => {
    vi.stubGlobal('innerWidth', 1280);
    vi.stubGlobal('innerHeight', 720);
    vi.stubGlobal('navigator', { userAgent: 'TestAgent/1.0' });
  });

  it('captures viewport, userAgent, and timestamp', () => {
    const ctx = captureContext();
    expect(ctx.viewport).toEqual({ width: 1280, height: 720 });
    expect(ctx.userAgent).toBe('TestAgent/1.0');
    expect(ctx.timestamp).toBeTruthy();
    // Verify ISO format
    expect(() => new Date(ctx.timestamp)).not.toThrow();
    expect(ctx.custom).toBeUndefined();
  });

  it('includes custom context when provider is given', () => {
    const ctx = captureContext(() => ({ buildId: '123', env: 'staging' }));
    expect(ctx.custom).toEqual({ buildId: '123', env: 'staging' });
  });
});
