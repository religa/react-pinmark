import React, { useEffect, useMemo, useRef } from 'react';
import { createCommentStore } from '../core/state';
import type { BackendAdapter, AttachmentAdapter } from '../adapters/adapter';
import type { Author } from '../core/types';
import { CommentContext, type CommentContextValue } from './CommentContext';
import { useLocationPathname } from '../hooks/useLocationPathname';

export interface CommentProviderProps {
  backend: BackendAdapter;
  projectId: string;
  author?: Author;
  colorScheme?: 'light' | 'dark' | 'system';
  contextProvider?: () => Record<string, unknown>;
  enabled?: boolean;
  attachmentAdapter?: AttachmentAdapter;
  captureScreenshot?: boolean;
  children: React.ReactNode;
}

export function CommentProvider({
  backend,
  projectId,
  author,
  colorScheme = 'system',
  contextProvider,
  enabled = true,
  attachmentAdapter,
  captureScreenshot = false,
  children,
}: CommentProviderProps) {
  const storeRef = useRef<ReturnType<typeof createCommentStore>>(undefined as never);
  if (!storeRef.current) storeRef.current = createCommentStore();

  const fetchThreads = useMemo(
    () => async () => {
      const store = storeRef.current;
      const { filter } = store.getState();
      store.getState().setLoading(true);
      try {
        const threads = await backend.getThreads({
          projectId,
          pageUrl: filter.pageUrl,
          status: filter.status,
        });
        store.getState().setThreads(threads);
      } catch (err) {
        console.error('[react-pinmark] Failed to fetch threads:', err);
      } finally {
        store.getState().setLoading(false);
      }
    },
    [backend, projectId],
  );

  const pathname = useLocationPathname();

  // Fetch threads on mount and on client-side navigation
  useEffect(() => {
    fetchThreads().catch(() => {/* error is logged below */});
  }, [fetchThreads, pathname]);

  // Re-fetch on window focus
  useEffect(() => {
    const onFocus = () => fetchThreads().catch(() => {});
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchThreads]);

  const contextValue: CommentContextValue = useMemo(
    () => ({
      store: storeRef.current,
      backend,
      projectId,
      author,
      colorScheme,
      contextProvider,
      enabled,
      attachmentAdapter,
      captureScreenshot,
    }),
    [backend, projectId, author, colorScheme, contextProvider, enabled, attachmentAdapter, captureScreenshot],
  );

  return (
    <CommentContext.Provider value={contextValue}>
      {children}
    </CommentContext.Provider>
  );
}
