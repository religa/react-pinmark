import { describe, it, expect, vi } from 'vitest';
import { createSupabaseAdapter } from './index';

function createMockSupabase() {
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    then: vi.fn(),
  };

  const mockStorage = {
    upload: vi.fn(),
    getPublicUrl: vi.fn(),
  };

  const client = {
    from: vi.fn(() => mockQuery),
    storage: {
      from: vi.fn(() => mockStorage),
    },
  };

  return { client, mockQuery, mockStorage };
}

describe('createSupabaseAdapter', () => {
  describe('getThreads', () => {
    it('fetches threads with project filter', async () => {
      const { client, mockQuery } = createMockSupabase();
      mockQuery.then.mockImplementation((resolve: Function) => {
        resolve({
          data: [
            {
              id: 't1',
              project_id: 'proj',
              page_url: '/page',
              pin: { x: 50, y: 100 },
              status: 'open',
              metadata: null,
              created_at: '2024-01-01T00:00:00Z',
              rc_comments: [
                {
                  id: 'c1',
                  thread_id: 't1',
                  author: { displayName: 'Alice' },
                  body: 'Hello',
                  attachments: [],
                  created_at: '2024-01-01T00:00:00Z',
                },
              ],
            },
          ],
          error: null,
        });
      });

      const adapter = createSupabaseAdapter({ supabaseClient: client as any });
      const threads = await adapter.getThreads({ projectId: 'proj' });

      expect(threads).toHaveLength(1);
      expect(threads[0].id).toBe('t1');
      expect(threads[0].comments).toHaveLength(1);
      expect(threads[0].comments[0].body).toBe('Hello');
    });

    it('applies pageUrl filter', async () => {
      const { client, mockQuery } = createMockSupabase();
      mockQuery.then.mockImplementation((resolve: Function) => {
        resolve({ data: [], error: null });
      });

      const adapter = createSupabaseAdapter({ supabaseClient: client as any });
      await adapter.getThreads({ projectId: 'proj', pageUrl: '/about' });

      expect(mockQuery.eq).toHaveBeenCalledWith('page_url', '/about');
    });

    it('applies status filter', async () => {
      const { client, mockQuery } = createMockSupabase();
      mockQuery.then.mockImplementation((resolve: Function) => {
        resolve({ data: [], error: null });
      });

      const adapter = createSupabaseAdapter({ supabaseClient: client as any });
      await adapter.getThreads({ projectId: 'proj', status: 'resolved' });

      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'resolved');
    });

    it('throws on error', async () => {
      const { client, mockQuery } = createMockSupabase();
      mockQuery.then.mockImplementation((resolve: Function) => {
        resolve({ data: null, error: { message: 'DB error' } });
      });

      const adapter = createSupabaseAdapter({ supabaseClient: client as any });
      await expect(adapter.getThreads({ projectId: 'proj' })).rejects.toThrow(
        'DB error',
      );
    });
  });

  describe('createThread', () => {
    it('creates a thread and first comment', async () => {
      const { client, mockQuery } = createMockSupabase();
      let callCount = 0;
      mockQuery.then.mockImplementation((resolve: Function) => {
        callCount++;
        if (callCount === 1) {
          resolve({
            data: {
              id: 't1',
              project_id: 'proj',
              page_url: '/page',
              pin: { x: 50, y: 100 },
              status: 'open',
              metadata: null,
              created_at: '2024-01-01T00:00:00Z',
            },
            error: null,
          });
        } else {
          resolve({
            data: {
              id: 'c1',
              thread_id: 't1',
              author: { displayName: 'Alice' },
              body: 'First!',
              attachments: [],
              created_at: '2024-01-01T00:00:01Z',
            },
            error: null,
          });
        }
      });

      const adapter = createSupabaseAdapter({ supabaseClient: client as any });
      const thread = await adapter.createThread({
        projectId: 'proj',
        pageUrl: '/page',
        pin: { x: 50, y: 100 },
        body: 'First!',
        author: { displayName: 'Alice' },
      });

      expect(thread.id).toBe('t1');
      expect(thread.comments).toHaveLength(1);
      expect(thread.comments[0].body).toBe('First!');
    });
  });

  describe('createComment', () => {
    it('creates a comment', async () => {
      const { client, mockQuery } = createMockSupabase();
      mockQuery.then.mockImplementation((resolve: Function) => {
        resolve({
          data: {
            id: 'c2',
            thread_id: 't1',
            author: { displayName: 'Bob' },
            body: 'Reply!',
            attachments: [],
            created_at: '2024-01-01T00:00:02Z',
          },
          error: null,
        });
      });

      const adapter = createSupabaseAdapter({ supabaseClient: client as any });
      const comment = await adapter.createComment({
        threadId: 't1',
        author: { displayName: 'Bob' },
        body: 'Reply!',
      });

      expect(comment.id).toBe('c2');
      expect(comment.body).toBe('Reply!');
    });
  });

  describe('updateThread', () => {
    it('updates thread status', async () => {
      const { client, mockQuery } = createMockSupabase();
      mockQuery.then.mockImplementation((resolve: Function) => {
        resolve({
          data: {
            id: 't1',
            project_id: 'proj',
            page_url: '/page',
            pin: { x: 50, y: 100 },
            status: 'resolved',
            metadata: null,
            created_at: '2024-01-01T00:00:00Z',
            rc_comments: [],
          },
          error: null,
        });
      });

      const adapter = createSupabaseAdapter({ supabaseClient: client as any });
      const thread = await adapter.updateThread('t1', { status: 'resolved' });
      expect(thread.status).toBe('resolved');
    });
  });

  describe('uploadAttachment', () => {
    it('uploads a file and returns attachment info', async () => {
      const { client, mockStorage } = createMockSupabase();
      mockStorage.upload.mockResolvedValue({
        data: { path: 'attachments/test.png' },
        error: null,
      });
      mockStorage.getPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://cdn.example.com/test.png' },
      });

      const adapter = createSupabaseAdapter({ supabaseClient: client as any });
      const file = new File(['data'], 'test.png', { type: 'image/png' });
      const attachment = await adapter.uploadAttachment(file);

      expect(attachment.url).toBe('https://cdn.example.com/test.png');
      expect(attachment.id).toBeTruthy();
    });
  });
});
