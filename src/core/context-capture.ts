export interface CapturedContext {
  viewport: { width: number; height: number };
  userAgent: string;
  timestamp: string;
  custom?: Record<string, unknown>;
}

export function captureContext(
  customProvider?: () => Record<string, unknown>,
): CapturedContext {
  const ctx: CapturedContext = {
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
  };

  if (customProvider) {
    try {
      ctx.custom = customProvider();
    } catch (err) {
      console.warn('[react-pinmark] contextProvider threw:', err);
    }
  }

  return ctx;
}
