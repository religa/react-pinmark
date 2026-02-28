import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThreadPopover } from './ThreadPopover';
import { CommentContext, type CommentContextValue } from './CommentContext';
import { createCommentStore } from '../core/state';
import type { Thread } from '../core/types';

function createMockContext(
  overrides: Partial<CommentContextValue> = {},
): CommentContextValue {
  return {
    store: createCommentStore(),
    backend: {
      getThreads: vi.fn(),
      createThread: vi.fn(),
      updateThread: vi.fn(),
      getComments: vi.fn(),
      createComment: vi.fn(),
    },
    projectId: 'test',
    colorScheme: 'system',
    enabled: true,
    author: { displayName: 'TestUser' },
    ...overrides,
  };
}

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: 'thread-1',
    projectId: 'proj-1',
    pageUrl: '/page',
    pin: { x: 50, y: 200 },
    status: 'open',
    createdAt: '2024-01-01T00:00:00Z',
    comments: [
      {
        id: 'c1',
        threadId: 'thread-1',
        author: { displayName: 'Alice' },
        body: 'Hello world',
        attachments: [],
        createdAt: '2024-01-01T00:00:00Z',
      },
    ],
    ...overrides,
  };
}

function renderWithContext(
  ui: React.ReactNode,
  ctx: CommentContextValue = createMockContext(),
) {
  return render(
    <CommentContext.Provider value={ctx}>{ui}</CommentContext.Provider>,
  );
}

describe('ThreadPopover', () => {
  beforeEach(() => {
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('scrollY', 0);
  });

  it('renders comments', () => {
    renderWithContext(
      <ThreadPopover
        thread={makeThread()}
        onClose={vi.fn()}
        onReply={vi.fn()}
        onResolve={vi.fn()}
        onUnresolve={vi.fn()}
      />,
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('shows resolve button for open threads', () => {
    renderWithContext(
      <ThreadPopover
        thread={makeThread({ status: 'open' })}
        onClose={vi.fn()}
        onReply={vi.fn()}
        onResolve={vi.fn()}
        onUnresolve={vi.fn()}
      />,
    );
    expect(screen.getByText('Resolve')).toBeInTheDocument();
  });

  it('shows unresolve button for resolved threads', () => {
    renderWithContext(
      <ThreadPopover
        thread={makeThread({ status: 'resolved' })}
        onClose={vi.fn()}
        onReply={vi.fn()}
        onResolve={vi.fn()}
        onUnresolve={vi.fn()}
      />,
    );
    expect(screen.getByText('Unresolve')).toBeInTheDocument();
  });

  it('calls onResolve when resolve button clicked', () => {
    const onResolve = vi.fn();
    renderWithContext(
      <ThreadPopover
        thread={makeThread()}
        onClose={vi.fn()}
        onReply={vi.fn()}
        onResolve={onResolve}
        onUnresolve={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Resolve'));
    expect(onResolve).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    renderWithContext(
      <ThreadPopover
        thread={makeThread()}
        onClose={onClose}
        onReply={vi.fn()}
        onResolve={vi.fn()}
        onUnresolve={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    renderWithContext(
      <ThreadPopover
        thread={makeThread()}
        onClose={onClose}
        onReply={vi.fn()}
        onResolve={vi.fn()}
        onUnresolve={vi.fn()}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows comment count', () => {
    renderWithContext(
      <ThreadPopover
        thread={makeThread()}
        onClose={vi.fn()}
        onReply={vi.fn()}
        onResolve={vi.fn()}
        onUnresolve={vi.fn()}
      />,
    );
    expect(screen.getByText('1 comment')).toBeInTheDocument();
  });

  it('renders markdown in comment body', () => {
    const thread = makeThread({
      comments: [
        {
          id: 'c1',
          threadId: 'thread-1',
          author: { displayName: 'Alice' },
          body: '**bold text**',
          attachments: [],
          createdAt: '2024-01-01T00:00:00Z',
        },
      ],
    });
    const { container } = renderWithContext(
      <ThreadPopover
        thread={thread}
        onClose={vi.fn()}
        onReply={vi.fn()}
        onResolve={vi.fn()}
        onUnresolve={vi.fn()}
      />,
    );
    expect(container.querySelector('strong')).toBeInTheDocument();
    expect(container.querySelector('strong')?.textContent).toBe('bold text');
  });

  it('does not render script tags from markdown', () => {
    const thread = makeThread({
      comments: [
        {
          id: 'c1',
          threadId: 'thread-1',
          author: { displayName: 'Alice' },
          body: '<script>alert("xss")</script>',
          attachments: [],
          createdAt: '2024-01-01T00:00:00Z',
        },
      ],
    });
    const { container } = renderWithContext(
      <ThreadPopover
        thread={thread}
        onClose={vi.fn()}
        onReply={vi.fn()}
        onResolve={vi.fn()}
        onUnresolve={vi.fn()}
      />,
    );
    expect(container.querySelector('script')).not.toBeInTheDocument();
  });
});
