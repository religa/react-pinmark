import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useComments } from './useComments';
import { CommentContext, type CommentContextValue } from '../components/CommentContext';
import { createCommentStore } from '../core/state';
import type { BackendAdapter } from '../adapters/adapter';
import type { Thread, Comment } from '../core/types';

function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: 'thread-1',
    projectId: 'test',
    pageUrl: '/page',
    pin: { x: 50, y: 100 },
    status: 'open',
    createdAt: '2024-01-01T00:00:00Z',
    comments: [],
    ...overrides,
  };
}

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'c1',
    threadId: 'thread-1',
    author: { displayName: 'Alice' },
    body: 'Hello',
    attachments: [],
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function createMockBackend(): BackendAdapter {
  return {
    getThreads: vi.fn().mockResolvedValue([]),
    createThread: vi.fn().mockResolvedValue(makeThread({ id: 'new-thread' })),
    updateThread: vi.fn().mockResolvedValue({ status: 'resolved' }),
    deleteThread: vi.fn().mockResolvedValue(undefined),
    getComments: vi.fn().mockResolvedValue([makeComment()]),
    createComment: vi.fn().mockResolvedValue(makeComment({ id: 'c-new' })),
    deleteComment: vi.fn().mockResolvedValue(undefined),
  };
}

function setup(overrides: Partial<CommentContextValue> = {}) {
  const store = createCommentStore();
  const backend = createMockBackend();
  const ctx: CommentContextValue = {
    store,
    backend,
    projectId: 'test',
    colorScheme: 'system',
    enabled: true,
    ...overrides,
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <CommentContext.Provider value={ctx}>{children}</CommentContext.Provider>
  );

  const result = renderHook(() => useComments(), { wrapper });
  return { ...result, store, backend, ctx };
}

describe('useComments', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    vi.stubGlobal('localStorage', mockStorage);
  });

  describe('state selectors', () => {
    it('returns initial state', () => {
      const { result } = setup();
      expect(result.current.threads).toEqual([]);
      expect(result.current.isCommentMode).toBe(false);
      expect(result.current.activeThread).toBeNull();
      expect(result.current.isThreadListOpen).toBe(false);
      expect(result.current.filter).toEqual({});
      expect(result.current.isLoading).toBe(false);
    });

    it('reflects store changes', () => {
      const { result, store } = setup();
      const thread = makeThread();
      act(() => { store.getState().setThreads([thread]); });
      expect(result.current.threads).toHaveLength(1);
    });
  });

  describe('toggleCommentMode', () => {
    it('toggles comment mode on and off', () => {
      const { result } = setup();
      act(() => { result.current.toggleCommentMode(); });
      expect(result.current.isCommentMode).toBe(true);
      act(() => { result.current.toggleCommentMode(); });
      expect(result.current.isCommentMode).toBe(false);
    });
  });

  describe('openThread / closeThread', () => {
    it('sets and clears active thread', () => {
      const { result, store } = setup();
      const thread = makeThread();
      act(() => { store.getState().setThreads([thread]); });

      act(() => { result.current.openThread('thread-1'); });
      expect(result.current.activeThread).toEqual(thread);

      act(() => { result.current.closeThread(); });
      expect(result.current.activeThread).toBeNull();
    });

    it('does nothing if thread id not found', () => {
      const { result } = setup();
      act(() => { result.current.openThread('nonexistent'); });
      expect(result.current.activeThread).toBeNull();
    });
  });

  describe('openThreadList / closeThreadList', () => {
    it('toggles thread list visibility', () => {
      const { result } = setup();
      act(() => { result.current.openThreadList(); });
      expect(result.current.isThreadListOpen).toBe(true);
      act(() => { result.current.closeThreadList(); });
      expect(result.current.isThreadListOpen).toBe(false);
    });
  });

  describe('setFilter', () => {
    it('merges filter values', () => {
      const { result } = setup();
      act(() => { result.current.setFilter({ status: 'open' }); });
      expect(result.current.filter).toEqual({ status: 'open' });
      act(() => { result.current.setFilter({ pageUrl: '/foo' }); });
      expect(result.current.filter).toEqual({ status: 'open', pageUrl: '/foo' });
    });
  });

  describe('refreshThreads', () => {
    it('fetches threads from backend and updates store', async () => {
      const backend = createMockBackend();
      const threads = [makeThread()];
      (backend.getThreads as ReturnType<typeof vi.fn>).mockResolvedValue(threads);
      const { result } = setup({ backend });

      await act(async () => { await result.current.refreshThreads(); });
      expect(backend.getThreads).toHaveBeenCalledWith({
        projectId: 'test',
        pageUrl: undefined,
        status: undefined,
      });
      expect(result.current.threads).toEqual(threads);
      expect(result.current.isLoading).toBe(false);
    });

    it('resets loading even on error', async () => {
      const backend = createMockBackend();
      (backend.getThreads as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
      const { result } = setup({ backend });

      await expect(
        act(async () => { await result.current.refreshThreads(); }),
      ).rejects.toThrow('fail');
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('createThread', () => {
    it('creates a thread via backend and adds to store', async () => {
      const { result, backend } = setup({ author: { displayName: 'Alice' } });
      const pin = { x: 10, y: 20 };

      let thread: Thread | undefined;
      await act(async () => {
        thread = await result.current.createThread({ pin, body: 'Hello' });
      });

      expect(backend.createThread).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'test',
          pin,
          body: 'Hello',
          author: { displayName: 'Alice' },
        }),
      );
      expect(thread!.id).toBe('new-thread');
      expect(result.current.threads).toHaveLength(1);
      expect(result.current.isCommentMode).toBe(false);
    });

    it('throws when no author is available', async () => {
      const { result } = setup();
      await expect(
        act(async () => {
          await result.current.createThread({
            pin: { x: 0, y: 0 },
            body: 'Test',
          });
        }),
      ).rejects.toThrow('Author identity required');
    });

    it('uses localStorage author when no prop author', async () => {
      mockStorage.setItem('rc_author', JSON.stringify({ displayName: 'Bob' }));
      const { result, backend } = setup();

      await act(async () => {
        await result.current.createThread({
          pin: { x: 0, y: 0 },
          body: 'Test',
        });
      });

      expect(backend.createThread).toHaveBeenCalledWith(
        expect.objectContaining({ author: { displayName: 'Bob' } }),
      );
    });
  });

  describe('replyToThread', () => {
    it('creates a comment and refreshes thread comments', async () => {
      const { result, backend, store } = setup({ author: { displayName: 'Alice' } });
      act(() => { store.getState().setThreads([makeThread()]); });

      let comment: Comment | undefined;
      await act(async () => {
        comment = await result.current.replyToThread('thread-1', 'My reply');
      });

      expect(backend.createComment).toHaveBeenCalledWith({
        threadId: 'thread-1',
        author: { displayName: 'Alice' },
        body: 'My reply',
        attachments: undefined,
      });
      expect(comment!.id).toBe('c-new');
      expect(backend.getComments).toHaveBeenCalledWith('thread-1');
    });

    it('throws when no author is available', async () => {
      const { result } = setup();
      await expect(
        act(async () => {
          await result.current.replyToThread('thread-1', 'Test');
        }),
      ).rejects.toThrow('Author identity required');
    });
  });

  describe('resolveThread', () => {
    it('updates thread status to resolved', async () => {
      const { result, backend, store } = setup();
      act(() => { store.getState().setThreads([makeThread()]); });

      await act(async () => { await result.current.resolveThread('thread-1'); });
      expect(backend.updateThread).toHaveBeenCalledWith('thread-1', { status: 'resolved' });
    });
  });

  describe('unresolveThread', () => {
    it('updates thread status to open', async () => {
      const { result, backend, store } = setup();
      act(() => { store.getState().setThreads([makeThread({ status: 'resolved' })]); });

      await act(async () => { await result.current.unresolveThread('thread-1'); });
      expect(backend.updateThread).toHaveBeenCalledWith('thread-1', { status: 'open' });
    });
  });

  describe('deleteThread', () => {
    it('deletes thread and removes from store', async () => {
      const { result, backend, store } = setup();
      act(() => { store.getState().setThreads([makeThread()]); });
      expect(result.current.threads).toHaveLength(1);

      await act(async () => { await result.current.deleteThread('thread-1'); });
      expect(backend.deleteThread).toHaveBeenCalledWith('thread-1');
      expect(result.current.threads).toHaveLength(0);
    });
  });

  describe('deleteComment', () => {
    it('deletes comment and refreshes thread comments', async () => {
      const { result, backend, store } = setup();
      act(() => { store.getState().setThreads([makeThread()]); });

      await act(async () => {
        await result.current.deleteComment('c1', 'thread-1');
      });
      expect(backend.deleteComment).toHaveBeenCalledWith('c1');
      expect(backend.getComments).toHaveBeenCalledWith('thread-1');
    });
  });
});
