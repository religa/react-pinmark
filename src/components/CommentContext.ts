import { createContext, useContext } from 'react';
import type { StoreApi } from 'zustand/vanilla';
import type { CommentStore } from '../core/state';
import type { BackendAdapter, AttachmentAdapter } from '../adapters/adapter';
import type { Author } from '../core/types';

export interface CommentContextValue {
  store: StoreApi<CommentStore>;
  backend: BackendAdapter;
  projectId: string;
  author?: Author;
  colorScheme: 'light' | 'dark' | 'system';
  contextProvider?: () => Record<string, unknown>;
  enabled: boolean;
  attachmentAdapter?: AttachmentAdapter;
  captureScreenshot?: boolean;
}

export const CommentContext = createContext<CommentContextValue | null>(null);

export function useCommentContext(): CommentContextValue {
  const ctx = useContext(CommentContext);
  if (!ctx) {
    throw new Error('useCommentContext must be used within <CommentProvider>');
  }
  return ctx;
}
