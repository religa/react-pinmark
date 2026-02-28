import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CommentProvider } from './CommentProvider';
import { useComments } from '../hooks/useComments';
import type { BackendAdapter } from '../adapters/adapter';
import type { Thread } from '../core/types';

function createMockBackend(threads: Thread[] = []): BackendAdapter {
  return {
    getThreads: vi.fn().mockResolvedValue(threads),
    createThread: vi.fn(),
    updateThread: vi.fn(),
    getComments: vi.fn().mockResolvedValue([]),
    createComment: vi.fn(),
  };
}

function TestConsumer() {
  const { threads, isCommentMode } = useComments();
  return (
    <div>
      <span data-testid="thread-count">{threads.length}</span>
      <span data-testid="comment-mode">{String(isCommentMode)}</span>
    </div>
  );
}

describe('CommentProvider', () => {
  it('provides context to children', async () => {
    const backend = createMockBackend();
    render(
      <CommentProvider backend={backend} projectId="test">
        <TestConsumer />
      </CommentProvider>,
    );

    expect(screen.getByTestId('comment-mode')).toHaveTextContent('false');
  });

  it('fetches threads on mount', async () => {
    const thread: Thread = {
      id: 't1',
      projectId: 'test',
      pageUrl: '/page',
      pin: { x: 50, y: 100 },
      status: 'open',
      createdAt: '2024-01-01T00:00:00Z',
      comments: [],
    };
    const backend = createMockBackend([thread]);

    render(
      <CommentProvider backend={backend} projectId="test">
        <TestConsumer />
      </CommentProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('thread-count')).toHaveTextContent('1');
    });
    expect(backend.getThreads).toHaveBeenCalledWith({
      projectId: 'test',
      pageUrl: undefined,
      status: undefined,
    });
  });

  it('refreshes threads on focus', async () => {
    const backend = createMockBackend();
    render(
      <CommentProvider backend={backend} projectId="test">
        <TestConsumer />
      </CommentProvider>,
    );

    await waitFor(() => {
      expect(backend.getThreads).toHaveBeenCalledTimes(1);
    });

    // Simulate focus
    window.dispatchEvent(new Event('focus'));

    await waitFor(() => {
      expect(backend.getThreads).toHaveBeenCalledTimes(2);
    });
  });
});
