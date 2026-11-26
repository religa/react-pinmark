import type { BackendAdapter, AttachmentAdapter } from '../adapter';
import type {
  Author,
  Thread,
  ThreadEvent,
  Comment,
  GetThreadsParams,
  CreateThreadInput,
  CreateCommentInput,
} from '../../core/types';
import { statusesForFilter, type ThreadStatus } from '../../core/status';

interface SupabaseClient {
  from(table: string): SupabaseQueryBuilder;
  storage: { from(bucket: string): SupabaseStorageBucket };
}

interface SupabaseQueryBuilder {
  select(columns?: string): SupabaseQueryBuilder;
  insert(data: unknown): SupabaseQueryBuilder;
  update(data: unknown): SupabaseQueryBuilder;
  delete(): SupabaseQueryBuilder;
  eq(column: string, value: unknown): SupabaseQueryBuilder;
  in(column: string, values: readonly unknown[]): SupabaseQueryBuilder;
  order(column: string, options?: { ascending?: boolean }): SupabaseQueryBuilder;
  single(): SupabaseQueryBuilder;
  then<T>(
    resolve: (value: { data: T; error: SupabaseError | null }) => void,
    reject?: (reason: unknown) => void,
  ): void;
}

interface SupabaseStorageBucket {
  upload(
    path: string,
    file: File | Blob,
  ): Promise<{ data: { path: string } | null; error: SupabaseError | null }>;
  getPublicUrl(path: string): { data: { publicUrl: string } };
}

interface SupabaseError {
  message: string;
}

interface SupabaseAdapterConfig {
  supabaseClient: SupabaseClient;
}

function mapThread(row: Record<string, unknown>, comments: Comment[] = []): Thread {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    pageUrl: row.page_url as string,
    pin: row.pin as Thread['pin'],
    status: row.status as Thread['status'],
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: row.created_at as string,
    comments,
  };
}

function mapEvent(row: Record<string, unknown>): ThreadEvent {
  return {
    id: row.id as string,
    threadId: row.thread_id as string,
    type: row.type as ThreadEvent['type'],
    actor: row.actor as Author,
    toStatus: row.to_status as ThreadStatus,
    createdAt: row.created_at as string,
  };
}

function mapComment(row: Record<string, unknown>): Comment {
  return {
    id: row.id as string,
    threadId: row.thread_id as string,
    author: row.author as Comment['author'],
    body: row.body as string,
    attachments: (row.attachments as Comment['attachments']) ?? [],
    createdAt: row.created_at as string,
  };
}

export function createSupabaseAdapter(
  config: SupabaseAdapterConfig,
): BackendAdapter & AttachmentAdapter {
  const { supabaseClient: sb } = config;

  /**
   * Status history is auxiliary: if rc_thread_events is missing (migration 007 not
   * run) or unreadable, threads load without it instead of failing.
   */
  async function getEvents(projectId: string, threadId?: string): Promise<ThreadEvent[]> {
    let query = sb
      .from('rc_thread_events')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    if (threadId) query = query.eq('thread_id', threadId);
    try {
      const { data, error } = await asPromise<Record<string, unknown>[]>(query);
      if (error) {
        console.warn('[react-pinmark] Status history unavailable:', error.message);
        return [];
      }
      return (data ?? []).map(mapEvent);
    } catch (err) {
      console.warn('[react-pinmark] Status history unavailable:', err);
      return [];
    }
  }

  function withEvents(thread: Thread, events: ThreadEvent[]): Thread {
    return { ...thread, events: events.filter((e) => e.threadId === thread.id) };
  }

  const adapter: BackendAdapter & AttachmentAdapter = {
    async getThreads(params: GetThreadsParams): Promise<Thread[]> {
      let query = sb
        .from('rc_threads')
        .select('*, rc_comments(*)')
        .eq('project_id', params.projectId)
        .order('created_at', { ascending: true });

      if (params.pageUrl) {
        query = query.eq('page_url', params.pageUrl);
      }
      const statuses = statusesForFilter(params.status);
      if (statuses) {
        query = query.in('status', statuses);
      }

      const { data, error } = await asPromise<Record<string, unknown>[]>(query);
      if (error) throw new Error(error.message);
      if (!data?.length) return [];

      const events = await getEvents(params.projectId);
      return data.map((row) => {
        const rawComments = (row.rc_comments as Record<string, unknown>[]) ?? [];
        const comments = rawComments.map(mapComment);
        comments.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        return withEvents(mapThread(row, comments), events);
      });
    },

    async createThread(input: CreateThreadInput): Promise<Thread> {
      // Create thread row
      const { data: threadRow, error: threadError } =
        await asPromise<Record<string, unknown>>(
          sb
            .from('rc_threads')
            .insert({
              project_id: input.projectId,
              page_url: input.pageUrl,
              pin: input.pin,
              status: 'open',
              metadata: input.metadata ?? null,
            })
            .select()
            .single(),
        );
      if (threadError) throw new Error(threadError.message);
      const threadId = (threadRow as Record<string, unknown>).id;

      // Create the first comment
      const { data: commentRow, error: commentError } =
        await asPromise<Record<string, unknown>>(
          sb
            .from('rc_comments')
            .insert({
              thread_id: threadId,
              author: input.author,
              body: input.body,
              attachments: input.attachments ?? [],
            })
            .select()
            .single(),
        );
      if (commentError) {
        // Two inserts aren't atomic — roll back so a retry doesn't leave an empty pin.
        await asPromise<unknown>(sb.from('rc_threads').delete().eq('id', threadId)).catch(() => {});
        throw new Error(commentError.message);
      }

      return mapThread(threadRow as Record<string, unknown>, [
        mapComment(commentRow as Record<string, unknown>),
      ]);
    },

    async updateThread(
      id: string,
      patch: { status: ThreadStatus },
      actor: Author,
    ): Promise<Thread> {
      const { data, error } = await asPromise<Record<string, unknown>>(
        sb
          .from('rc_threads')
          .update({ status: patch.status })
          .eq('id', id)
          .select('*, rc_comments(*)')
          .single(),
      );
      if (error) throw new Error(error.message);

      const row = data as Record<string, unknown>;
      const rawComments = (row.rc_comments as Record<string, unknown>[]) ?? [];
      const comments = rawComments.map(mapComment);
      comments.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      const thread = mapThread(row, comments);

      // Record the change. The status already changed, so a history failure only warns.
      const { error: eventError } = await asPromise<unknown>(
        sb.from('rc_thread_events').insert({
          thread_id: id,
          project_id: thread.projectId,
          type: 'status_changed',
          actor,
          to_status: patch.status,
        }),
      ).catch((err: unknown) => ({ error: { message: String(err) } }));
      if (eventError) {
        console.warn('[react-pinmark] Could not record status history:', eventError.message);
      }

      return withEvents(thread, await getEvents(thread.projectId, id));
    },

    async getComments(threadId: string): Promise<Comment[]> {
      const { data, error } = await asPromise<Record<string, unknown>[]>(
        sb
          .from('rc_comments')
          .select('*')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: true }),
      );
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapComment);
    },

    async createComment(input: CreateCommentInput): Promise<Comment> {
      const { data, error } = await asPromise<Record<string, unknown>>(
        sb
          .from('rc_comments')
          .insert({
            thread_id: input.threadId,
            author: input.author,
            body: input.body,
            attachments: input.attachments ?? [],
          })
          .select()
          .single(),
      );
      if (error) throw new Error(error.message);
      return mapComment(data as Record<string, unknown>);
    },

    async deleteComment(id: string): Promise<void> {
      const { data, error } = await asPromise<unknown[] | null>(
        sb.from('rc_comments').delete().eq('id', id).select('id'),
      );
      if (error) throw new Error(error.message);
      // A missing row or an RLS-filtered delete returns no error, only no rows.
      if (!data?.length) throw new Error(`Comment ${id} not found or not deletable`);
    },

    async deleteThread(id: string): Promise<void> {
      // Delete comments first (in case there's no DB-level cascade)
      const { error: commentsError } = await asPromise<unknown>(
        sb.from('rc_comments').delete().eq('thread_id', id),
      );
      if (commentsError) throw new Error(commentsError.message);

      const { data, error } = await asPromise<unknown[] | null>(
        sb.from('rc_threads').delete().eq('id', id).select('id'),
      );
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error(`Thread ${id} not found or not deletable`);
    },

    async uploadAttachment(file: File | Blob) {
      // Never use the raw filename: Storage rejects non-ASCII/special-character keys,
      // and same-name files uploaded in the same millisecond would collide.
      const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      const path = `attachments/${unique}.${attachmentExtension(file)}`;

      const { error } = await sb.storage
        .from('rc-attachments')
        .upload(path, file);
      if (error) throw new Error(error.message);

      const {
        data: { publicUrl },
      } = sb.storage.from('rc-attachments').getPublicUrl(path);

      return {
        id: path,
        url: publicUrl,
      };
    },
  };

  return adapter;
}

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function attachmentExtension(file: File | Blob): string {
  if (MIME_EXTENSIONS[file.type]) return MIME_EXTENSIONS[file.type];
  const fromName = file instanceof File ? file.name.split('.').pop() ?? '' : '';
  return /^[a-z0-9]{1,8}$/i.test(fromName) ? fromName.toLowerCase() : 'bin';
}

// Helper to convert Supabase's thenable pattern into a proper Promise.
// Passes both callbacks so a rejecting builder (e.g. .throwOnError()) can't hang.
function asPromise<T>(
  query: SupabaseQueryBuilder,
): Promise<{ data: T; error: SupabaseError | null }> {
  return new Promise((resolve, reject) => {
    try {
      query.then(resolve, reject);
    } catch (err) {
      reject(err);
    }
  });
}
