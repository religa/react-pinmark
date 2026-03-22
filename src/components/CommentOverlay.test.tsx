import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CommentOverlay } from './CommentOverlay';
import { CommentProvider } from './CommentProvider';
import type { BackendAdapter, AttachmentAdapter } from '../adapters/adapter';
import type { Thread, Attachment } from '../core/types';

vi.mock('../core/screenshot', () => ({
  captureViewportWithPin: vi.fn(),
}));

import { captureViewportWithPin } from '../core/screenshot';

function createMockBackend(threads: Thread[] = []): BackendAdapter {
  return {
    getThreads: vi.fn().mockResolvedValue(threads),
    createThread: vi.fn(),
    updateThread: vi.fn(),
    deleteThread: vi.fn(),
    getComments: vi.fn().mockResolvedValue([]),
    createComment: vi.fn(),
    deleteComment: vi.fn(),
  };
}

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: 'thread-1',
    projectId: 'proj-1',
    pageUrl: '/',
    pin: { x: 50, y: 200 },
    status: 'open',
    createdAt: '2024-01-01T00:00:00Z',
    comments: [
      {
        id: 'c1',
        threadId: 'thread-1',
        author: { displayName: 'Alice' },
        body: 'Test comment',
        attachments: [],
        createdAt: '2024-01-01T00:00:00Z',
      },
    ],
    ...overrides,
  };
}

function renderOverlay(
  backend: BackendAdapter = createMockBackend(),
  props: { hideResolved?: boolean } = {},
) {
  return render(
    <CommentProvider backend={backend} projectId="test">
      <CommentOverlay {...props} />
    </CommentProvider>,
  );
}

describe('CommentOverlay', () => {
  beforeEach(() => {
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('scrollY', 0);
  });

  it('renders floating toggle buttons', async () => {
    renderOverlay();
    await waitFor(() => {
      expect(
        screen.getByLabelText('Enter comment mode'),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText('Open thread list'),
      ).toBeInTheDocument();
    });
  });

  it('toggles comment mode on button click', async () => {
    renderOverlay();
    const toggle = await screen.findByLabelText('Enter comment mode');
    fireEvent.click(toggle);
    expect(
      screen.getByLabelText('Exit comment mode'),
    ).toBeInTheDocument();
  });

  it('toggles comment mode on C key', async () => {
    renderOverlay();
    await screen.findByLabelText('Enter comment mode');
    fireEvent.keyDown(document, { key: 'c' });
    expect(
      screen.getByLabelText('Exit comment mode'),
    ).toBeInTheDocument();
  });

  it('exits comment mode on Escape', async () => {
    renderOverlay();
    await screen.findByLabelText('Enter comment mode');

    // Enter comment mode
    fireEvent.keyDown(document, { key: 'c' });
    expect(screen.getByLabelText('Exit comment mode')).toBeInTheDocument();

    // Exit with Escape
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(
      screen.getByLabelText('Enter comment mode'),
    ).toBeInTheDocument();
  });

  it('renders pin markers for threads', async () => {
    const thread = makeThread();
    const backend = createMockBackend([thread]);
    renderOverlay(backend);

    await waitFor(() => {
      expect(
        screen.getByLabelText('Comment thread 1'),
      ).toBeInTheDocument();
    });
  });

  it('hides resolved threads by default', async () => {
    const resolved = makeThread({ id: 'r1', status: 'resolved' });
    const open = makeThread({ id: 'o1', status: 'open' });
    const backend = createMockBackend([resolved, open]);
    renderOverlay(backend);

    await waitFor(() => {
      expect(screen.getByLabelText('Comment thread 1')).toBeInTheDocument();
    });
    // Only 1 pin should be visible (open thread)
    const pins = screen.getAllByRole('button', { name: /Comment thread/ });
    expect(pins).toHaveLength(1);
  });

  it('shows resolved threads when hideResolved is false', async () => {
    const resolved = makeThread({ id: 'r1', status: 'resolved' });
    const open = makeThread({ id: 'o1', status: 'open' });
    const backend = createMockBackend([resolved, open]);
    renderOverlay(backend, { hideResolved: false });

    await waitFor(() => {
      const pins = screen.getAllByRole('button', { name: /Comment thread/ });
      expect(pins).toHaveLength(2);
    });
  });

  it('only renders pins for threads matching the current page', async () => {
    const currentPage = makeThread({ id: 'current', pageUrl: '/', status: 'open' });
    const otherPage = makeThread({ id: 'other', pageUrl: '/other', status: 'open' });
    const backend = createMockBackend([currentPage, otherPage]);
    renderOverlay(backend, { hideResolved: false });

    await waitFor(() => {
      expect(screen.getByLabelText('Comment thread 1')).toBeInTheDocument();
    });
    const pins = screen.getAllByRole('button', { name: /Comment thread/ });
    expect(pins).toHaveLength(1);
  });

  it('updates visible pins after client-side navigation via pushState', async () => {
    const homePage = makeThread({ id: 'home', pageUrl: '/', status: 'open' });
    const aboutPage = makeThread({ id: 'about', pageUrl: '/about', status: 'open' });
    const backend = createMockBackend([homePage, aboutPage]);
    renderOverlay(backend, { hideResolved: false });

    // Initially on '/' — only home pin visible
    await waitFor(() => {
      expect(screen.getByLabelText('Comment thread 1')).toBeInTheDocument();
    });
    expect(screen.getAllByRole('button', { name: /Comment thread/ })).toHaveLength(1);

    // Navigate to /about via pushState
    act(() => {
      window.history.pushState({}, '', '/about');
    });

    await waitFor(() => {
      const pins = screen.getAllByRole('button', { name: /Comment thread/ });
      expect(pins).toHaveLength(1);
    });

    // Navigate back via popstate
    act(() => {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    await waitFor(() => {
      const pins = screen.getAllByRole('button', { name: /Comment thread/ });
      expect(pins).toHaveLength(1);
    });
  });
});

describe('CommentOverlay — cross-page navigation', () => {
  beforeEach(() => {
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('scrollY', 0);
    vi.stubGlobal('scrollTo', vi.fn());
    sessionStorage.clear();
  });

  it('scrolls to pin when clicking a thread on the current page', async () => {
    const thread = makeThread({ pageUrl: '/' });
    const backend = createMockBackend([thread]);

    render(
      <CommentProvider backend={backend} projectId="test">
        <CommentOverlay />
      </CommentProvider>,
    );

    // Open thread list
    const listBtn = await screen.findByLabelText('Open thread list');
    fireEvent.click(listBtn);

    // Click the thread row
    await waitFor(() => {
      expect(screen.getByText('Test comment')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Open thread/ }));

    // Should scroll to the pin
    expect(window.scrollTo).toHaveBeenCalled();
  });

  it('calls onNavigatePage when clicking a thread on a different page', async () => {
    const thread = makeThread({ pageUrl: '/other' });
    const backend = createMockBackend([thread]);
    const onNavigatePage = vi.fn();

    render(
      <CommentProvider backend={backend} projectId="test">
        <CommentOverlay onNavigatePage={onNavigatePage} />
      </CommentProvider>,
    );

    // Open thread list
    const listBtn = await screen.findByLabelText('Open thread list');
    fireEvent.click(listBtn);

    // Click the thread row
    await waitFor(() => {
      expect(screen.getByText('Test comment')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Open thread/ }));

    expect(onNavigatePage).toHaveBeenCalledWith('/other');
  });

  it('writes to sessionStorage when no onNavigatePage is provided and thread is on different page', async () => {
    const thread = makeThread({ pageUrl: '/other' });
    const backend = createMockBackend([thread]);

    // Mock window.location as writable
    const locationAssign = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { pathname: '/', href: '/', assign: locationAssign },
      writable: true,
      configurable: true,
    });

    render(
      <CommentProvider backend={backend} projectId="test">
        <CommentOverlay />
      </CommentProvider>,
    );

    // Open thread list
    const listBtn = await screen.findByLabelText('Open thread list');
    fireEvent.click(listBtn);

    await waitFor(() => {
      expect(screen.getByText('Test comment')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Open thread/ }));

    const stored = sessionStorage.getItem('rc_pending_thread');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.threadId).toBe('thread-1');
  });

  it('does not scroll when thread is on a different page', async () => {
    const thread = makeThread({ pageUrl: '/other' });
    const backend = createMockBackend([thread]);
    const onNavigatePage = vi.fn();

    render(
      <CommentProvider backend={backend} projectId="test">
        <CommentOverlay onNavigatePage={onNavigatePage} />
      </CommentProvider>,
    );

    // Open thread list and click thread from different page
    const listBtn = await screen.findByLabelText('Open thread list');
    fireEvent.click(listBtn);

    await waitFor(() => {
      expect(screen.getByText('Test comment')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Open thread/ }));

    // Should call onNavigatePage instead of scrolling
    expect(onNavigatePage).toHaveBeenCalledWith('/other');
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});

// Helper to create a backend mock that returns a valid thread on createThread
function createMockBackendWithCreate(): BackendAdapter {
  return {
    getThreads: vi.fn().mockResolvedValue([]),
    createThread: vi.fn().mockResolvedValue({
      id: 'new-thread',
      projectId: 'test',
      pageUrl: '/',
      pin: { x: 10, y: 100 },
      status: 'open',
      createdAt: new Date().toISOString(),
      comments: [],
    }),
    updateThread: vi.fn(),
    deleteThread: vi.fn(),
    getComments: vi.fn().mockResolvedValue([]),
    createComment: vi.fn(),
    deleteComment: vi.fn(),
  };
}

function makeMockAttachmentAdapter(
  attachment: Attachment = { id: 'ss-att', url: 'http://example.com/ss.jpg' },
): AttachmentAdapter {
  return { uploadAttachment: vi.fn().mockResolvedValue(attachment) };
}

// Click the overlay to place a pin at given coordinates
function clickOverlay(clientX = 100, clientY = 100) {
  const overlay = document.querySelector('.rc-click-overlay');
  if (!overlay) throw new Error('.rc-click-overlay not found');
  fireEvent.click(overlay, { clientX, clientY });
}

describe('CommentOverlay — screenshot capture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('scrollY', 0);
    // jsdom doesn't implement elementsFromPoint — define it so the overlay click handler works
    Object.defineProperty(document, 'elementsFromPoint', {
      value: vi.fn().mockReturnValue([]),
      configurable: true,
      writable: true,
    });
    // jsdom's URL.createObjectURL / revokeObjectURL are stubs; mock them cleanly
    // so the Composer screenshot preview doesn't produce unhandled errors
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:rc-test-screenshot'),
      revokeObjectURL: vi.fn(),
    });
    vi.mocked(captureViewportWithPin).mockResolvedValue(
      new Blob(['fake-screenshot'], { type: 'image/jpeg' }),
    );
  });

  it('calls captureViewportWithPin when captureScreenshot=true and attachmentAdapter is provided', async () => {
    const attachmentAdapter = makeMockAttachmentAdapter();
    render(
      <CommentProvider
        backend={createMockBackendWithCreate()}
        projectId="test"
        author={{ displayName: 'Tester' }}
        captureScreenshot={true}
        attachmentAdapter={attachmentAdapter}
      >
        <CommentOverlay />
      </CommentProvider>,
    );

    const toggle = await screen.findByLabelText('Enter comment mode');
    fireEvent.click(toggle);
    clickOverlay();

    expect(captureViewportWithPin).toHaveBeenCalledTimes(1);
  });

  it('does not call captureViewportWithPin when captureScreenshot=false', async () => {
    const attachmentAdapter = makeMockAttachmentAdapter();
    render(
      <CommentProvider
        backend={createMockBackendWithCreate()}
        projectId="test"
        author={{ displayName: 'Tester' }}
        captureScreenshot={false}
        attachmentAdapter={attachmentAdapter}
      >
        <CommentOverlay />
      </CommentProvider>,
    );

    const toggle = await screen.findByLabelText('Enter comment mode');
    fireEvent.click(toggle);
    clickOverlay();

    expect(captureViewportWithPin).not.toHaveBeenCalled();
  });

  it('does not call captureViewportWithPin without attachmentAdapter', async () => {
    render(
      <CommentProvider
        backend={createMockBackendWithCreate()}
        projectId="test"
        author={{ displayName: 'Tester' }}
        captureScreenshot={true}
      >
        <CommentOverlay />
      </CommentProvider>,
    );

    const toggle = await screen.findByLabelText('Enter comment mode');
    fireEvent.click(toggle);
    clickOverlay();

    expect(captureViewportWithPin).not.toHaveBeenCalled();
  });

  it('creates thread without screenshot if capture returns null', async () => {
    vi.mocked(captureViewportWithPin).mockResolvedValue(null);
    const backend = createMockBackendWithCreate();
    const attachmentAdapter = makeMockAttachmentAdapter();

    render(
      <CommentProvider
        backend={backend}
        projectId="test"
        author={{ displayName: 'Tester' }}
        captureScreenshot={true}
        attachmentAdapter={attachmentAdapter}
      >
        <CommentOverlay />
      </CommentProvider>,
    );

    const toggle = await screen.findByLabelText('Enter comment mode');
    fireEvent.click(toggle);
    clickOverlay();

    const textarea = await screen.findByPlaceholderText('Add a comment...');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(backend.createThread).toHaveBeenCalledWith(
        expect.objectContaining({ attachments: [] }),
      );
    });
    expect(attachmentAdapter.uploadAttachment).not.toHaveBeenCalled();
  });

  it('prepends screenshot attachment to thread attachments on submit', async () => {
    const screenshotAttachment: Attachment = { id: 'ss-att', url: 'http://example.com/ss.jpg' };
    const attachmentAdapter = makeMockAttachmentAdapter(screenshotAttachment);
    const backend = createMockBackendWithCreate();

    render(
      <CommentProvider
        backend={backend}
        projectId="test"
        author={{ displayName: 'Tester' }}
        captureScreenshot={true}
        attachmentAdapter={attachmentAdapter}
      >
        <CommentOverlay />
      </CommentProvider>,
    );

    const toggle = await screen.findByLabelText('Enter comment mode');
    fireEvent.click(toggle);
    clickOverlay();

    const textarea = await screen.findByPlaceholderText('Add a comment...');
    fireEvent.change(textarea, { target: { value: 'Look at this' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(backend.createThread).toHaveBeenCalledWith(
        expect.objectContaining({ attachments: [screenshotAttachment] }),
      );
    });
  });

  // Issue: STALE SCREENSHOT — screenshotRef is not cleared when pin is cancelled (Escape).
  // If captureScreenshot is then disabled before the next pin, the stale screenshot
  // from the cancelled pin will be attached to the next thread.
  it('does not attach a stale screenshot after pin is cancelled via Escape', async () => {
    const staleAttachment: Attachment = { id: 'stale', url: 'http://example.com/stale.jpg' };
    const attachmentAdapter = makeMockAttachmentAdapter(staleAttachment);
    const backend = createMockBackendWithCreate();

    const { rerender } = render(
      <CommentProvider
        backend={backend}
        projectId="test"
        author={{ displayName: 'Tester' }}
        captureScreenshot={true}
        attachmentAdapter={attachmentAdapter}
      >
        <CommentOverlay />
      </CommentProvider>,
    );

    // Enter comment mode and place a pin — screenshot capture fires
    const toggle = await screen.findByLabelText('Enter comment mode');
    fireEvent.click(toggle);
    clickOverlay(100, 100);
    expect(captureViewportWithPin).toHaveBeenCalledTimes(1);

    // Cancel with Escape — pendingPin is cleared but screenshotRef is NOT (bug)
    fireEvent.keyDown(document, { key: 'Escape' });

    // Disable captureScreenshot — next pin click will NOT start a new capture
    rerender(
      <CommentProvider
        backend={backend}
        projectId="test"
        author={{ displayName: 'Tester' }}
        captureScreenshot={false}
        attachmentAdapter={attachmentAdapter}
      >
        <CommentOverlay />
      </CommentProvider>,
    );

    // Re-enter comment mode and place another pin
    const toggle2 = await screen.findByLabelText('Enter comment mode');
    fireEvent.click(toggle2);
    clickOverlay(200, 200);

    // captureViewportWithPin should NOT have been called again
    expect(captureViewportWithPin).toHaveBeenCalledTimes(1);

    // Submit the comment
    const textarea = await screen.findByPlaceholderText('Add a comment...');
    fireEvent.change(textarea, { target: { value: 'New comment' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(backend.createThread).toHaveBeenCalled();
    });

    // BUG (without fix): createThread receives [staleAttachment] because screenshotRef was never cleared.
    // CORRECT (with fix): createThread receives [] because screenshotRef was cleared on Escape.
    expect(backend.createThread).toHaveBeenCalledWith(
      expect.objectContaining({ attachments: [] }),
    );
  });

  it('does not call captureViewportWithPin when a reply is submitted to an existing thread', async () => {
    const thread = makeThread();
    const backend = createMockBackend([thread]);
    const attachmentAdapter = makeMockAttachmentAdapter();

    render(
      <CommentProvider
        backend={backend}
        projectId="test"
        author={{ displayName: 'Tester' }}
        captureScreenshot={true}
        attachmentAdapter={attachmentAdapter}
      >
        <CommentOverlay />
      </CommentProvider>,
    );

    // Wait for the pin to appear, then click it to open the ThreadPopover
    const pin = await screen.findByLabelText('Comment thread 1');
    fireEvent.click(pin);

    // Find the reply composer and submit a reply
    const replyTextarea = await screen.findByPlaceholderText('Reply...');
    fireEvent.change(replyTextarea, { target: { value: 'My reply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    // captureViewportWithPin must NOT be called — replies never trigger screenshot capture
    expect(captureViewportWithPin).not.toHaveBeenCalled();
  });
});
