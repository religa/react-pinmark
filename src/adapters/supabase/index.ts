import type { BackendAdapter, AttachmentAdapter } from '../adapter';
import type {
  Thread,
  Comment,
  GetThreadsParams,
  CreateThreadInput,
  CreateCommentInput,
} from '../../core/types';

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
  order(column: string, options?: { ascending?: boolean }): SupabaseQueryBuilder;
  single(): SupabaseQueryBuilder;
  then<T>(
    resolve: (value: { data: T; error: SupabaseError | null }) => void,
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
      if (params.status && params.status !== 'all') {
        query = query.eq('status', params.status);
      }

      const { data, error } = await asPromise<Record<string, unknown>[]>(query);
      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => {
        const rawComments = (row.rc_comments as Record<string, unknown>[]) ?? [];
        const comments = rawComments.map(mapComment);
        comments.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        return mapThread(row, comments);
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

      // Create the first comment
      const { data: commentRow, error: commentError } =
        await asPromise<Record<string, unknown>>(
          sb
            .from('rc_comments')
            .insert({
              thread_id: (threadRow as Record<string, unknown>).id,
              author: input.author,
              body: input.body,
              attachments: input.attachments ?? [],
            })
            .select()
            .single(),
        );
      if (commentError) throw new Error(commentError.message);

      return mapThread(threadRow as Record<string, unknown>, [
        mapComment(commentRow as Record<string, unknown>),
      ]);
    },

    async updateThread(
      id: string,
      patch: { status: 'open' | 'resolved' },
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
      return mapThread(row, comments);
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

    async deleteThread(id: string): Promise<void> {
      // Delete comments first (in case there's no DB-level cascade)
      const { error: commentsError } = await asPromise<unknown>(
        sb.from('rc_comments').delete().eq('thread_id', id),
      );
      if (commentsError) throw new Error(commentsError.message);

      const { error } = await asPromise<unknown>(
        sb.from('rc_threads').delete().eq('id', id),
      );
      if (error) throw new Error(error.message);
    },

    async uploadAttachment(file: File | Blob) {
      const ext = file.type === 'image/jpeg' ? 'jpg'
        : file.type === 'image/png' ? 'png'
        : file.type === 'image/webp' ? 'webp'
        : file.type === 'image/gif' ? 'gif'
        : 'bin';
      const filename =
        file instanceof File ? file.name : `paste-${Date.now()}.${ext}`;
      const path = `attachments/${Date.now()}-${filename}`;

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

// Helper to convert Supabase's thenable pattern into a proper Promise
function asPromise<T>(
  query: SupabaseQueryBuilder,
): Promise<{ data: T; error: SupabaseError | null }> {
  return new Promise((resolve, reject) => {
    try {
      query.then((result: { data: T; error: SupabaseError | null }) => {
        resolve(result);
      });
    } catch (err) {
      reject(err);
    }
  });
}
