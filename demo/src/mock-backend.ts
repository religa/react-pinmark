import type { BackendAdapter } from 'react-pinmark';
import type { Thread, Comment, GetThreadsParams, CreateThreadInput, CreateCommentInput } from 'react-pinmark';

const STORAGE_KEY = 'rc_demo_threads';

function load(): Thread[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Thread[]) : [];
  } catch {
    return [];
  }
}

function save(threads: Thread[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
}

export const mockBackend: BackendAdapter = {
  async getThreads(params: GetThreadsParams): Promise<Thread[]> {
    let threads = load();
    if (params.pageUrl) threads = threads.filter((t) => t.pageUrl === params.pageUrl);
    if (params.status && params.status !== 'all') {
      threads = threads.filter((t) => t.status === params.status);
    }
    return threads;
  },

  async createThread(input: CreateThreadInput): Promise<Thread> {
    const threads = load();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const comment: Comment = {
      id: crypto.randomUUID(),
      threadId: id,
      author: input.author,
      body: input.body,
      attachments: input.attachments ?? [],
      createdAt: now,
    };
    const thread: Thread = {
      id,
      projectId: input.projectId,
      pageUrl: input.pageUrl,
      pin: input.pin,
      status: 'open',
      metadata: input.metadata,
      createdAt: now,
      comments: [comment],
    };
    threads.push(thread);
    save(threads);
    return thread;
  },

  async updateThread(id: string, patch: { status: 'open' | 'resolved' }): Promise<Thread> {
    const threads = load();
    const idx = threads.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error(`Thread ${id} not found`);
    threads[idx] = { ...threads[idx], ...patch };
    save(threads);
    return threads[idx];
  },

  async deleteThread(id: string): Promise<void> {
    const threads = load();
    save(threads.filter((t) => t.id !== id));
  },

  async getComments(threadId: string): Promise<Comment[]> {
    const thread = load().find((t) => t.id === threadId);
    return thread?.comments ?? [];
  },

  async createComment(input: CreateCommentInput): Promise<Comment> {
    const threads = load();
    const thread = threads.find((t) => t.id === input.threadId);
    if (!thread) throw new Error(`Thread ${input.threadId} not found`);
    const comment: Comment = {
      id: crypto.randomUUID(),
      threadId: input.threadId,
      author: input.author,
      body: input.body,
      attachments: input.attachments ?? [],
      createdAt: new Date().toISOString(),
    };
    thread.comments.push(comment);
    save(threads);
    return comment;
  },
};
