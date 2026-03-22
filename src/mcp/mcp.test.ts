import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BackendAdapter } from '../adapters/adapter';
import type { Thread, Comment } from '../core/types';
import type { PinmarkConfig } from '../cli/config';
import { buildToolHandlers, registerTools, type ToolHandler } from './tools';

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

describe('MCP tool handlers', () => {
  let adapter: BackendAdapter;
  let handlers: Map<string, ToolHandler>;

  beforeEach(() => {
    adapter = createMockAdapter();
    handlers = buildToolHandlers(adapter, config);
  });

  function getHandler(name: string): ToolHandler {
    const handler = handlers.get(name);
    if (!handler) throw new Error(`No handler for ${name}`);
    return handler;
  }

  function parseResult(result: { content: { text: string }[] }) {
    return JSON.parse(result.content[0].text);
  }

  describe('pinmark_list_threads', () => {
    it('lists all threads by default', async () => {
      const result = await getHandler('pinmark_list_threads')({});
      expect(adapter.getThreads).toHaveBeenCalledWith({
        projectId: 'test',
        status: 'all',
        pageUrl: undefined,
      });
      const data = parseResult(result);
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('thread-1');
    });

    it('passes status and page filters', async () => {
      await getHandler('pinmark_list_threads')({
        status: 'open',
        page: '/about',
      });
      expect(adapter.getThreads).toHaveBeenCalledWith({
        projectId: 'test',
        status: 'open',
        pageUrl: '/about',
      });
    });
  });

  describe('pinmark_get_comments', () => {
    it('returns comments for a thread', async () => {
      const result = await getHandler('pinmark_get_comments')({
        threadId: 'thread-1',
      });
      expect(adapter.getComments).toHaveBeenCalledWith('thread-1');
      const data = parseResult(result);
      expect(data[0].id).toBe('c1');
    });
  });

  describe('pinmark_add_comment', () => {
    it('creates a comment with given body and author', async () => {
      const result = await getHandler('pinmark_add_comment')({
        threadId: 'thread-1',
        body: 'My reply',
        author: 'Bob',
      });
      expect(adapter.createComment).toHaveBeenCalledWith({
        threadId: 'thread-1',
        author: { displayName: 'Bob' },
        body: 'My reply',
      });
      const data = parseResult(result);
      expect(data.id).toBe('c-new');
    });

    it('defaults author to MCP', async () => {
      await getHandler('pinmark_add_comment')({
        threadId: 'thread-1',
        body: 'No author',
      });
      expect(adapter.createComment).toHaveBeenCalledWith(
        expect.objectContaining({ author: { displayName: 'MCP' } }),
      );
    });
  });

  describe('pinmark_resolve_thread', () => {
    it('resolves a thread', async () => {
      const result = await getHandler('pinmark_resolve_thread')({
        threadId: 'thread-1',
      });
      expect(adapter.updateThread).toHaveBeenCalledWith('thread-1', {
        status: 'resolved',
      });
      const data = parseResult(result);
      expect(data.status).toBe('resolved');
    });
  });

  describe('pinmark_reopen_thread', () => {
    it('reopens a thread', async () => {
      await getHandler('pinmark_reopen_thread')({ threadId: 'thread-1' });
      expect(adapter.updateThread).toHaveBeenCalledWith('thread-1', {
        status: 'open',
      });
    });
  });

  describe('pinmark_delete_thread', () => {
    it('deletes a thread', async () => {
      const result = await getHandler('pinmark_delete_thread')({
        threadId: 'thread-1',
      });
      expect(adapter.deleteThread).toHaveBeenCalledWith('thread-1');
      const data = parseResult(result);
      expect(data.deleted).toBe(true);
      expect(data.threadId).toBe('thread-1');
    });
  });

  describe('pinmark_delete_comment', () => {
    it('deletes a comment', async () => {
      const result = await getHandler('pinmark_delete_comment')({
        commentId: 'c1',
      });
      expect(adapter.deleteComment).toHaveBeenCalledWith('c1');
      const data = parseResult(result);
      expect(data.deleted).toBe(true);
      expect(data.commentId).toBe('c1');
    });
  });

  describe('pinmark_export', () => {
    it('exports as JSON by default', async () => {
      const result = await getHandler('pinmark_export')({});
      expect(adapter.getThreads).toHaveBeenCalledWith({
        projectId: 'test',
        status: 'all',
        pageUrl: undefined,
      });
      const data = parseResult(result);
      expect(data.projectId).toBe('test');
      expect(data.threads).toHaveLength(1);
    });

    it('exports as markdown', async () => {
      const result = await getHandler('pinmark_export')({
        format: 'markdown',
      });
      const data = parseResult(result);
      expect(typeof data).toBe('string');
      expect(data).toContain('Feedback Report');
    });
  });

  describe('error handling', () => {
    it('handler throws on adapter error', async () => {
      (adapter.getThreads as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('DB connection failed'),
      );
      await expect(
        getHandler('pinmark_list_threads')({}),
      ).rejects.toThrow('DB connection failed');
    });
  });

  describe('registerTools error catching', () => {
    it('returns isError=true when handler throws', async () => {
      const reqHandlers = new Map<unknown, Function>();
      const mockServer = {
        setRequestHandler: vi.fn(
          (schema: unknown, handler: Function) => reqHandlers.set(schema, handler),
        ),
      };

      (adapter.getThreads as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('DB connection failed'),
      );
      registerTools(mockServer as never, adapter, config);

      // Find the CallTool handler (second registered handler)
      const callHandler = [...reqHandlers.values()][1];
      const result = await callHandler({
        params: { name: 'pinmark_list_threads', arguments: {} },
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('DB connection failed');
    });

    it('returns error for unknown tool', async () => {
      const reqHandlers = new Map<unknown, Function>();
      const mockServer = {
        setRequestHandler: vi.fn(
          (schema: unknown, handler: Function) => reqHandlers.set(schema, handler),
        ),
      };

      registerTools(mockServer as never, adapter, config);

      const callHandler = [...reqHandlers.values()][1];
      const result = await callHandler({
        params: { name: 'nonexistent_tool', arguments: {} },
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe('Unknown tool: nonexistent_tool');
    });
  });
});
