import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Composer } from './Composer';
import { CommentContext, type CommentContextValue } from './CommentContext';
import { createCommentStore } from '../core/state';

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
    ...overrides,
  };
}

function renderWithContext(
  ui: React.ReactNode,
  ctx: CommentContextValue,
) {
  return render(
    <CommentContext.Provider value={ctx}>{ui}</CommentContext.Provider>,
  );
}

describe('Composer', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockStorage();
    vi.stubGlobal('localStorage', mockStorage);
  });

  it('shows author prompt when no author is available', () => {
    const ctx = createMockContext();
    renderWithContext(<Composer onSubmit={vi.fn()} />, ctx);
    expect(screen.getByLabelText('Your name')).toBeInTheDocument();
  });

  it('shows textarea when author is set via prop', () => {
    const ctx = createMockContext({
      author: { displayName: 'Alice' },
    });
    renderWithContext(<Composer onSubmit={vi.fn()} />, ctx);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('shows textarea when author is in localStorage', () => {
    mockStorage.setItem(
      'rc_author',
      JSON.stringify({ displayName: 'Bob' }),
    );
    const ctx = createMockContext();
    renderWithContext(<Composer onSubmit={vi.fn()} />, ctx);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('calls onSubmit with body and author on form submit', () => {
    const onSubmit = vi.fn();
    const ctx = createMockContext({
      author: { displayName: 'Alice' },
    });
    renderWithContext(<Composer onSubmit={onSubmit} />, ctx);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Test comment' } });
    fireEvent.submit(textarea.closest('form')!);

    expect(onSubmit).toHaveBeenCalledWith('Test comment', {
      displayName: 'Alice',
    }, []);
  });

  it('does not show edit link when author is from prop', () => {
    const ctx = createMockContext({
      author: { displayName: 'Alice' },
    });
    renderWithContext(<Composer onSubmit={vi.fn()} />, ctx);
    expect(screen.queryByText('edit')).not.toBeInTheDocument();
  });

  it('shows edit link when author is from localStorage', () => {
    mockStorage.setItem(
      'rc_author',
      JSON.stringify({ displayName: 'Bob' }),
    );
    const ctx = createMockContext();
    renderWithContext(<Composer onSubmit={vi.fn()} />, ctx);
    expect(screen.getByText('edit')).toBeInTheDocument();
  });

  it('does not show upload button without attachmentAdapter', () => {
    const ctx = createMockContext({ author: { displayName: 'Alice' } });
    renderWithContext(<Composer onSubmit={vi.fn()} />, ctx);
    expect(screen.queryByLabelText('Attach image')).not.toBeInTheDocument();
  });

  it('shows upload button when attachmentAdapter is provided', () => {
    const ctx = createMockContext({
      author: { displayName: 'Alice' },
      attachmentAdapter: { uploadAttachment: vi.fn() },
    });
    renderWithContext(<Composer onSubmit={vi.fn()} />, ctx);
    expect(screen.getByLabelText('Attach image')).toBeInTheDocument();
  });

  it('calls onSubmit with empty attachments when no files attached', () => {
    const onSubmit = vi.fn();
    const ctx = createMockContext({ author: { displayName: 'Alice' } });
    renderWithContext(<Composer onSubmit={onSubmit} />, ctx);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Test' } });
    fireEvent.submit(textarea.closest('form')!);

    expect(onSubmit).toHaveBeenCalledWith('Test', { displayName: 'Alice' }, []);
  });

  it('uploads file and shows preview', async () => {
    const uploadAttachment = vi.fn().mockResolvedValue({
      id: 'att-1',
      url: 'https://example.com/img.png',
    });
    const ctx = createMockContext({
      author: { displayName: 'Alice' },
      attachmentAdapter: { uploadAttachment },
    });
    renderWithContext(<Composer onSubmit={vi.fn()} />, ctx);

    const file = new File(['image content'], 'test.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(uploadAttachment).toHaveBeenCalledWith(file);
    });
  });
});

describe('Composer — screenshot preview', () => {
  const ctx = () =>
    ({
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
      author: { displayName: 'Alice' },
    } as CommentContextValue);

  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:rc-test-screenshot'),
      revokeObjectURL: vi.fn(),
    });
  });

  function renderComposer(props: Parameters<typeof Composer>[0]) {
    return render(
      <CommentContext.Provider value={ctx()}>
        <Composer {...props} />
      </CommentContext.Provider>,
    );
  }

  it('shows no screenshot indicator when screenshotPromise is not provided', () => {
    renderComposer({ onSubmit: vi.fn() });
    expect(screen.queryByText(/capturing screenshot/i)).not.toBeInTheDocument();
    expect(screen.queryByAltText('Screenshot preview')).not.toBeInTheDocument();
  });

  it('shows "Capturing screenshot…" while the promise is pending', async () => {
    // A promise that never resolves — simulates in-flight capture
    const neverResolves = new Promise<Blob | null>(() => {});
    renderComposer({ onSubmit: vi.fn(), screenshotPromise: neverResolves });

    await waitFor(() => {
      expect(screen.getByText('Capturing screenshot…')).toBeInTheDocument();
    });
  });

  it('shows thumbnail once screenshot resolves', async () => {
    const blob = new Blob(['img'], { type: 'image/jpeg' });
    const resolved = Promise.resolve(blob);
    renderComposer({ onSubmit: vi.fn(), screenshotPromise: resolved });

    await waitFor(() => {
      expect(screen.getByAltText('Screenshot preview')).toBeInTheDocument();
      expect(screen.getByText('📷 Screenshot captured')).toBeInTheDocument();
    });
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
  });

  it('shows nothing if screenshot capture fails (resolves to null)', async () => {
    const failed = Promise.resolve(null);
    renderComposer({ onSubmit: vi.fn(), screenshotPromise: failed });

    // Give the effect time to run
    await waitFor(() => {
      expect(screen.queryByText(/capturing/i)).not.toBeInTheDocument();
    });
    expect(screen.queryByAltText('Screenshot preview')).not.toBeInTheDocument();
  });

  it('hides thumbnail and calls onScreenshotRemove when Remove is clicked', async () => {
    const blob = new Blob(['img'], { type: 'image/jpeg' });
    const resolved = Promise.resolve(blob);
    const onScreenshotRemove = vi.fn();
    renderComposer({
      onSubmit: vi.fn(),
      screenshotPromise: resolved,
      onScreenshotRemove,
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Remove screenshot' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove screenshot' }));

    expect(screen.queryByAltText('Screenshot preview')).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:rc-test-screenshot');
    expect(onScreenshotRemove).toHaveBeenCalledTimes(1);
  });
});
