import { describe, it, expect, vi } from 'vitest';
import { createSupabaseAdapter } from './index';

type SupabaseClientArg = Parameters<typeof createSupabaseAdapter>[0]['supabaseClient'];

function createMockSupabase() {
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
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
  } as unknown as SupabaseClientArg;

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

      const adapter = createSupabaseAdapter({ supabaseClient: client });
      const threads = await adapter.getThreads({ projectId: 'proj' });

      expect(threads).toHaveLength(1);
      expect(threads[0].id).toBe('t1');
      expect(threads[0].comments).toHaveLength(1);
      expect(threads[0].comments[0].body).toBe('Hello');
    });

    it('loads threads without history when the events query fails', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { client, mockQuery } = createMockSupabase();
      mockQuery.then
        .mockImplementationOnce((resolve: Function) =>
          resolve({
            data: [{ id: 't1', project_id: 'proj', page_url: '/', pin: {}, status: 'open', created_at: 'x', rc_comments: [] }],
            error: null,
          }),
        )
        .mockImplementationOnce((resolve: Function) =>
          resolve({ data: null, error: { message: 'Could not find the table rc_thread_events' } }),
        );

      const adapter = createSupabaseAdapter({ supabaseClient: client });
      const threads = await adapter.getThreads({ projectId: 'proj' });

      expect(threads).toHaveLength(1);
      expect(threads[0].events).toEqual([]);
      warn.mockRestore();
    });

    it('applies pageUrl filter', async () => {
      const { client, mockQuery } = createMockSupabase();
      mockQuery.then.mockImplementation((resolve: Function) => {
        resolve({ data: [], error: null });
      });

      const adapter = createSupabaseAdapter({ supabaseClient: client });
      await adapter.getThreads({ projectId: 'proj', pageUrl: '/about' });

      expect(mockQuery.eq).toHaveBeenCalledWith('page_url', '/about');
    });

    it('applies status filter', async () => {
      const { client, mockQuery } = createMockSupabase();
      mockQuery.then.mockImplementation((resolve: Function) => {
        resolve({ data: [], error: null });
      });

      const adapter = createSupabaseAdapter({ supabaseClient: client });
      await adapter.getThreads({ projectId: 'proj', status: 'resolved' });

      expect(mockQuery.in).toHaveBeenCalledWith('status', ['resolved']);
    });

    it('expands the active filter to open + pending', async () => {
      const { client, mockQuery } = createMockSupabase();
      mockQuery.then.mockImplementation((resolve: Function) => {
        resolve({ data: [], error: null });
      });

      const adapter = createSupabaseAdapter({ supabaseClient: client });
      await adapter.getThreads({ projectId: 'proj', status: 'active' });

      expect(mockQuery.in).toHaveBeenCalledWith('status', ['open', 'pending']);
    });

    it('does not filter by status for all', async () => {
      const { client, mockQuery } = createMockSupabase();
      mockQuery.then.mockImplementation((resolve: Function) => {
        resolve({ data: [], error: null });
      });

      const adapter = createSupabaseAdapter({ supabaseClient: client });
      await adapter.getThreads({ projectId: 'proj', status: 'all' });

      expect(mockQuery.in).not.toHaveBeenCalled();
    });

    it('throws on error', async () => {
      const { client, mockQuery } = createMockSupabase();
      mockQuery.then.mockImplementation((resolve: Function) => {
        resolve({ data: null, error: { message: 'DB error' } });
      });

      const adapter = createSupabaseAdapter({ supabaseClient: client });
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

      const adapter = createSupabaseAdapter({ supabaseClient: client });
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

      const adapter = createSupabaseAdapter({ supabaseClient: client });
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

      const adapter = createSupabaseAdapter({ supabaseClient: client });
      const thread = await adapter.updateThread('t1', { status: 'resolved' }, { displayName: 'Ana' });
      expect(thread.status).toBe('resolved');
    });

    it('records a status_changed event and returns the history', async () => {
      const { client, mockQuery } = createMockSupabase();
      const threadRow = {
        id: 't1',
        project_id: 'proj',
        page_url: '/page',
        pin: { x: 0, y: 0 },
        status: 'pending',
        metadata: null,
        created_at: '2024-01-01T00:00:00Z',
        rc_comments: [],
      };
      const eventRow = {
        id: 'e1',
        thread_id: 't1',
        project_id: 'proj',
        type: 'status_changed',
        actor: { displayName: 'Claude' },
        to_status: 'pending',
        created_at: '2024-01-02T00:00:00Z',
      };
      mockQuery.then
        .mockImplementationOnce((resolve: Function) => resolve({ data: threadRow, error: null })) // update
        .mockImplementationOnce((resolve: Function) => resolve({ data: null, error: null })) // insert event
        .mockImplementationOnce((resolve: Function) => resolve({ data: [eventRow], error: null })); // read events

      const adapter = createSupabaseAdapter({ supabaseClient: client });
      const thread = await adapter.updateThread('t1', { status: 'pending' }, { displayName: 'Claude' });

      expect(mockQuery.insert).toHaveBeenCalledWith({
        thread_id: 't1',
        project_id: 'proj',
        type: 'status_changed',
        actor: { displayName: 'Claude' },
        to_status: 'pending',
      });
      expect(thread.events).toEqual([
        {
          id: 'e1',
          threadId: 't1',
          type: 'status_changed',
          actor: { displayName: 'Claude' },
          toStatus: 'pending',
          createdAt: '2024-01-02T00:00:00Z',
        },
      ]);
    });

    it('still changes the status when the history table is missing', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { client, mockQuery } = createMockSupabase();
      const missing = { data: null, error: { message: 'relation "rc_thread_events" does not exist' } };
      mockQuery.then
        .mockImplementationOnce((resolve: Function) =>
          resolve({
            data: { id: 't1', project_id: 'proj', page_url: '/', pin: {}, status: 'pending', created_at: 'x', rc_comments: [] },
            error: null,
          }),
        )
        .mockImplementation((resolve: Function) => resolve(missing));

      const adapter = createSupabaseAdapter({ supabaseClient: client });
      const thread = await adapter.updateThread('t1', { status: 'pending' }, { displayName: 'Ana' });

      expect(thread.status).toBe('pending');
      expect(thread.events).toEqual([]);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('deleteComment', () => {
    it('deletes a comment by id', async () => {
      const { client, mockQuery } = createMockSupabase();
      mockQuery.then.mockImplementation((resolve: Function) => {
        resolve({ data: [{ id: 'c1' }], error: null });
      });

      const adapter = createSupabaseAdapter({ supabaseClient: client });
      await adapter.deleteComment('c1');

      expect(client.from).toHaveBeenCalledWith('rc_comments');
      expect(mockQuery.delete).toHaveBeenCalled();
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'c1');
    });

    it('throws when no row was deleted (missing id or blocked by RLS)', async () => {
      const { client, mockQuery } = createMockSupabase();
      mockQuery.then.mockImplementation((resolve: Function) => {
        resolve({ data: [], error: null });
      });

      const adapter = createSupabaseAdapter({ supabaseClient: client });
      await expect(adapter.deleteComment('nope')).rejects.toThrow('not found or not deletable');
    });

    it('settles when the query builder rejects', async () => {
      const { client, mockQuery } = createMockSupabase();
      mockQuery.then.mockImplementation((_resolve: Function, reject: Function) => {
        reject(new Error('network down'));
      });

      const adapter = createSupabaseAdapter({ supabaseClient: client });
      await expect(adapter.deleteComment('c1')).rejects.toThrow('network down');
    });

    it('throws on error', async () => {
      const { client, mockQuery } = createMockSupabase();
      mockQuery.then.mockImplementation((resolve: Function) => {
        resolve({ data: null, error: { message: 'Delete failed' } });
      });

      const adapter = createSupabaseAdapter({ supabaseClient: client });
      await expect(adapter.deleteComment('c1')).rejects.toThrow('Delete failed');
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

      const adapter = createSupabaseAdapter({ supabaseClient: client });
      const file = new File(['data'], 'test.png', { type: 'image/png' });
      const attachment = await adapter.uploadAttachment(file);

      expect(attachment.url).toBe('https://cdn.example.com/test.png');
      expect(attachment.id).toBeTruthy();
    });
  });
});
