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

  const CHROME_MACOS_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

  it('shows context icon on first comment when thread has metadata', () => {
    const thread = makeThread({
      metadata: {
        userAgent: CHROME_MACOS_UA,
        viewport: { width: 1440, height: 900 },
        devicePixelRatio: 2,
      },
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
    expect(container.querySelector('.rc-ctx-trigger')).not.toBeNull();
  });

  it('hides context icon when thread has no metadata', () => {
    const { container } = renderWithContext(
      <ThreadPopover
        thread={makeThread()}
        onClose={vi.fn()}
        onReply={vi.fn()}
        onResolve={vi.fn()}
        onUnresolve={vi.fn()}
      />,
    );
    expect(container.querySelector('.rc-ctx-trigger')).toBeNull();
  });

  it('tooltip contains browser, viewport, and element rows when trigger is hovered', () => {
    const thread = makeThread({
      pin: { x: 50, y: 200, anchorLabel: 'Submit Button' },
      metadata: {
        userAgent: CHROME_MACOS_UA,
        viewport: { width: 800, height: 600 },
        devicePixelRatio: 1,
      },
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
    const trigger = container.querySelector('.rc-ctx-trigger') as HTMLElement;
    fireEvent.mouseEnter(trigger);
    // Tooltip is portalled to document.body, not inside container
    const tooltip = document.body.querySelector('.rc-ctx-tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip?.textContent).toContain('Chrome 125');
    expect(tooltip?.textContent).toContain('macOS');
    expect(tooltip?.textContent).toContain('800×600');
    expect(tooltip?.textContent).toContain('Submit Button');
    fireEvent.mouseLeave(trigger);
    expect(document.body.querySelector('.rc-ctx-tooltip')).toBeNull();
  });

  it('context icon only appears on first comment, not replies', () => {
    const thread = makeThread({
      metadata: {
        userAgent: CHROME_MACOS_UA,
        viewport: { width: 800, height: 600 },
        devicePixelRatio: 1,
      },
      comments: [
        { id: 'c1', threadId: 'thread-1', author: { displayName: 'Alice' }, body: 'First', attachments: [], createdAt: '2024-01-01T00:00:00Z' },
        { id: 'c2', threadId: 'thread-1', author: { displayName: 'Bob' }, body: 'Reply', attachments: [], createdAt: '2024-01-02T00:00:00Z' },
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
    expect(container.querySelectorAll('.rc-ctx-trigger')).toHaveLength(1);
  });

  it('shows tooltip on focus and hides on blur (keyboard accessible)', () => {
    const thread = makeThread({
      metadata: {
        userAgent: CHROME_MACOS_UA,
        viewport: { width: 800, height: 600 },
        devicePixelRatio: 1,
      },
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
    const trigger = container.querySelector('.rc-ctx-trigger') as HTMLElement;
    fireEvent.focus(trigger);
    expect(document.body.querySelector('.rc-ctx-tooltip')).not.toBeNull();
    fireEvent.blur(trigger);
    expect(document.body.querySelector('.rc-ctx-tooltip')).toBeNull();
  });
});
