import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BackendAdapter } from '../adapters/adapter';
import type { Thread, Comment } from '../core/types';
import {
  listThreads,
  resolveThread,
  deleteThread,
  listComments,
  addComment,
  deleteComment,
} from './commands';
import type { PinmarkConfig } from './config';

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: 'thread-1',
    projectId: 'test',
    pageUrl: '/page',
    pin: { x: 50, y: 100 },
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

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'c1',
    threadId: 'thread-1',
    author: { displayName: 'Alice' },
    body: 'Hello world',
    attachments: [],
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function createMockAdapter(): BackendAdapter {
  return {
    getThreads: vi.fn().mockResolvedValue([makeThread()]),
    createThread: vi.fn(),
    updateThread: vi.fn().mockResolvedValue(makeThread({ status: 'resolved' })),
    deleteThread: vi.fn().mockResolvedValue(undefined),
    getComments: vi.fn().mockResolvedValue([makeComment()]),
    createComment: vi.fn().mockResolvedValue(makeComment({ id: 'c-new' })),
    deleteComment: vi.fn().mockResolvedValue(undefined),
  };
}

const config: PinmarkConfig = {
  supabaseUrl: 'https://test.supabase.co',
  supabaseAnonKey: 'test-key',
  projectId: 'test',
};

describe('CLI commands', () => {
  let adapter: BackendAdapter;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    adapter = createMockAdapter();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('listThreads', () => {
    it('fetches and prints threads', async () => {
      await listThreads(adapter, config, {});
      expect(adapter.getThreads).toHaveBeenCalledWith({
        projectId: 'test',
        pageUrl: undefined,
        status: 'all',
      });
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('outputs JSON when format=json', async () => {
      await listThreads(adapter, config, { format: 'json' });
      const output = consoleSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(output);
      expect(parsed[0].id).toBe('thread-1');
    });

    it('passes status and page filters', async () => {
      await listThreads(adapter, config, { status: 'open', page: '/about' });
      expect(adapter.getThreads).toHaveBeenCalledWith({
        projectId: 'test',
        pageUrl: '/about',
        status: 'open',
      });
    });
  });

  describe('resolveThread', () => {
    it('calls updateThread with resolved status', async () => {
      await resolveThread(adapter, 'thread-1');
      expect(adapter.updateThread).toHaveBeenCalledWith('thread-1', {
        status: 'resolved',
      });
      expect(consoleSpy).toHaveBeenCalledWith('Resolved thread thread-1');
    });
  });

  describe('deleteThread', () => {
    it('calls deleteThread on adapter', async () => {
      await deleteThread(adapter, 'thread-1');
      expect(adapter.deleteThread).toHaveBeenCalledWith('thread-1');
      expect(consoleSpy).toHaveBeenCalledWith('Deleted thread thread-1');
    });
  });

  describe('listComments', () => {
    it('fetches and prints comments', async () => {
      await listComments(adapter, 'thread-1', {});
      expect(adapter.getComments).toHaveBeenCalledWith('thread-1');
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('outputs JSON when format=json', async () => {
      await listComments(adapter, 'thread-1', { format: 'json' });
      const output = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed[0].id).toBe('c1');
    });
  });

  describe('addComment', () => {
    it('creates a comment with given body and author', async () => {
      await addComment(adapter, 'thread-1', {
        body: 'My reply',
        author: 'Bob',
      });
      expect(adapter.createComment).toHaveBeenCalledWith({
        threadId: 'thread-1',
        author: { displayName: 'Bob' },
        body: 'My reply',
      });
      expect(consoleSpy).toHaveBeenCalledWith('Created comment c-new');
    });

    it('defaults author to CLI', async () => {
      await addComment(adapter, 'thread-1', { body: 'No author' });
      expect(adapter.createComment).toHaveBeenCalledWith(
        expect.objectContaining({ author: { displayName: 'CLI' } }),
      );
    });

    it('throws if --body is missing', async () => {
      await expect(addComment(adapter, 'thread-1', {})).rejects.toThrow(
        '--body is required',
      );
    });
  });

  describe('deleteComment', () => {
    it('calls deleteComment on adapter', async () => {
      await deleteComment(adapter, 'c1');
      expect(adapter.deleteComment).toHaveBeenCalledWith('c1');
      expect(consoleSpy).toHaveBeenCalledWith('Deleted comment c1');
    });
  });
});
