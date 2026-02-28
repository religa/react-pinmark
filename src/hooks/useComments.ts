import { useSyncExternalStore, useCallback } from 'react';
import { useCommentContext } from '../components/CommentContext';
import { captureContext } from '../core/context-capture';
import { getStoredAuthor } from '../core/author';
import type { Thread, Comment, PinPosition, ThreadFilter, Attachment } from '../core/types';
import type { CommentStore } from '../core/state';

export interface UseComments {
  threads: Thread[];
  isCommentMode: boolean;
  activeThread: Thread | null;
  isThreadListOpen: boolean;
  filter: ThreadFilter;
  isLoading: boolean;

  toggleCommentMode(): void;
  openThread(threadId: string): void;
  closeThread(): void;
  openThreadList(): void;
  closeThreadList(): void;
  createThread(input: {
    pin: PinPosition;
    body: string;
    attachments?: Attachment[];
  }): Promise<Thread>;
  replyToThread(
    threadId: string,
    body: string,
    attachments?: Attachment[],
  ): Promise<Comment>;
  resolveThread(threadId: string): Promise<void>;
  unresolveThread(threadId: string): Promise<void>;
  deleteThread(threadId: string): Promise<void>;
  refreshThreads(): Promise<void>;
  setFilter(filter: Partial<ThreadFilter>): void;
}

function useStoreSelector<T>(
  store: { subscribe: (listener: () => void) => () => void; getState: () => CommentStore },
  selector: (state: CommentStore) => T,
): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

export function useComments(): UseComments {
  const { store, backend, projectId, author: propAuthor, contextProvider } =
    useCommentContext();

  const threads = useStoreSelector(store, (s) => s.threads);
  const isCommentMode = useStoreSelector(store, (s) => s.isCommentMode);
  const activeThread = useStoreSelector(store, (s) => s.activeThread);
  const isThreadListOpen = useStoreSelector(store, (s) => s.isThreadListOpen);
  const filter = useStoreSelector(store, (s) => s.filter);
  const isLoading = useStoreSelector(store, (s) => s.isLoading);

  const getAuthor = useCallback(() => {
    if (propAuthor) return propAuthor;
    const stored = getStoredAuthor();
    if (stored) return stored;
    return null;
  }, [propAuthor]);

  const refreshThreads = useCallback(async () => {
    const { filter: currentFilter } = store.getState();
    store.getState().setLoading(true);
    try {
      const fetched = await backend.getThreads({
        projectId,
        pageUrl: currentFilter.pageUrl,
        status: currentFilter.status,
      });
      store.getState().setThreads(fetched);
    } finally {
      store.getState().setLoading(false);
    }
  }, [store, backend, projectId]);

  const toggleCommentMode = useCallback(() => {
    const current = store.getState().isCommentMode;
    store.getState().setCommentMode(!current);
  }, [store]);

  const openThread = useCallback(
    (threadId: string) => {
      const thread = store.getState().threads.find((t) => t.id === threadId);
      if (thread) {
        store.getState().setActiveThread(thread);
      }
    },
    [store],
  );

  const closeThread = useCallback(() => {
    store.getState().setActiveThread(null);
  }, [store]);

  const openThreadList = useCallback(() => {
    store.getState().setThreadListOpen(true);
  }, [store]);

  const closeThreadList = useCallback(() => {
    store.getState().setThreadListOpen(false);
  }, [store]);

  const createThread = useCallback(
    async (input: {
      pin: PinPosition;
      body: string;
      attachments?: Attachment[];
    }): Promise<Thread> => {
      const author = getAuthor();
      if (!author) {
        throw new Error('Author identity required');
      }

      const metadata = captureContext(contextProvider) as unknown as Record<string, unknown>;

      const thread = await backend.createThread({
        projectId,
        pageUrl: window.location.pathname,
        pin: input.pin,
        metadata,
        body: input.body,
        author,
        attachments: input.attachments,
      });

      store.getState().addThread(thread);
      store.getState().setCommentMode(false);
      return thread;
    },
    [store, backend, projectId, getAuthor, contextProvider],
  );

  const replyToThread = useCallback(
    async (
      threadId: string,
      body: string,
      attachments?: Attachment[],
    ): Promise<Comment> => {
      const author = getAuthor();
      if (!author) {
        throw new Error('Author identity required');
      }

      const comment = await backend.createComment({
        threadId,
        author,
        body,
        attachments,
      });

      // Refresh the thread's comments
      const comments = await backend.getComments(threadId);
      store.getState().updateThread(threadId, { comments });
      return comment;
    },
    [store, backend, getAuthor],
  );

  const resolveThread = useCallback(
    async (threadId: string) => {
      const updated = await backend.updateThread(threadId, {
        status: 'resolved',
      });
      store.getState().updateThread(threadId, updated);
    },
    [store, backend],
  );

  const unresolveThread = useCallback(
    async (threadId: string) => {
      const updated = await backend.updateThread(threadId, {
        status: 'open',
      });
      store.getState().updateThread(threadId, updated);
    },
    [store, backend],
  );

  const deleteThread = useCallback(
    async (threadId: string) => {
      await backend.deleteThread(threadId);
      store.getState().removeThread(threadId);
    },
    [store, backend],
  );

  const setFilter = useCallback(
    (newFilter: Partial<ThreadFilter>) => {
      store.getState().setFilter(newFilter);
    },
    [store],
  );

  return {
    threads,
    isCommentMode,
    activeThread,
    isThreadListOpen,
    filter,
    isLoading,
    toggleCommentMode,
    openThread,
    closeThread,
    openThreadList,
    closeThreadList,
    createThread,
    replyToThread,
    resolveThread,
    unresolveThread,
    deleteThread,
    refreshThreads,
    setFilter,
  };
}
