import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocationPathname } from './useLocationPathname';

describe('useLocationPathname', () => {
  beforeEach(() => {
    // Reset to a known path
    window.history.replaceState(null, '', '/');
  });

  it('returns the current pathname', () => {
    window.history.replaceState(null, '', '/test-page');
    const { result } = renderHook(() => useLocationPathname());
    expect(result.current).toBe('/test-page');
  });

  it('updates when pushState is called', async () => {
    const { result } = renderHook(() => useLocationPathname());
    expect(result.current).toBe('/');

    act(() => {
      window.history.pushState(null, '', '/new-page');
    });

    // queueMicrotask is used internally, wait for it
    await act(async () => {
      await new Promise<void>((r) => queueMicrotask(r));
    });

    expect(result.current).toBe('/new-page');
  });

  it('updates when replaceState is called', async () => {
    const { result } = renderHook(() => useLocationPathname());

    act(() => {
      window.history.replaceState(null, '', '/replaced');
    });

    await act(async () => {
      await new Promise<void>((r) => queueMicrotask(r));
    });

    expect(result.current).toBe('/replaced');
  });

  it('updates on popstate event', () => {
    window.history.pushState(null, '', '/page-a');
    const { result } = renderHook(() => useLocationPathname());

    // Simulate browser back — jsdom doesn't fully support history navigation,
    // but we can dispatch a popstate event after manually changing the URL.
    window.history.replaceState(null, '', '/page-b');
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(result.current).toBe('/page-b');
  });

  it('cleans up popstate listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useLocationPathname());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
    removeSpy.mockRestore();
  });
});
