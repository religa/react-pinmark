import type { BackendAdapter } from '../adapters/adapter';
import type { PinmarkConfig } from './config';
import { formatThreadsTable, formatCommentsTable } from './format';

export interface CommandOptions {
  status?: string;
  page?: string;
  author?: string;
  body?: string;
  format?: string;
}

export async function listThreads(
  adapter: BackendAdapter,
  config: PinmarkConfig,
  opts: CommandOptions,
): Promise<void> {
  const validStatuses = new Set(['open', 'resolved', 'all']);
  const status = validStatuses.has(opts.status ?? '')
    ? (opts.status as 'open' | 'resolved' | 'all')
    : 'all';
  const threads = await adapter.getThreads({
    projectId: config.projectId,
    pageUrl: opts.page,
    status,
  });
  if (opts.format === 'json') {
    console.log(JSON.stringify(threads, null, 2));
  } else {
    console.log(formatThreadsTable(threads));
  }
}

export async function resolveThread(
  adapter: BackendAdapter,
  threadId: string,
): Promise<void> {
  await adapter.updateThread(threadId, { status: 'resolved' });
  console.log(`Resolved thread ${threadId}`);
}

export async function deleteThread(
  adapter: BackendAdapter,
  threadId: string,
): Promise<void> {
  await adapter.deleteThread(threadId);
  console.log(`Deleted thread ${threadId}`);
}

export async function listComments(
  adapter: BackendAdapter,
  threadId: string,
  opts: CommandOptions,
): Promise<void> {
  const comments = await adapter.getComments(threadId);
  if (opts.format === 'json') {
    console.log(JSON.stringify(comments, null, 2));
  } else {
    console.log(formatCommentsTable(comments));
  }
}

export async function addComment(
  adapter: BackendAdapter,
  threadId: string,
  opts: CommandOptions,
): Promise<void> {
  if (!opts.body) {
    throw new Error('--body is required');
  }
  const comment = await adapter.createComment({
    threadId,
    author: { displayName: opts.author ?? 'CLI' },
    body: opts.body,
  });
  console.log(`Created comment ${comment.id}`);
}

export async function deleteComment(
  adapter: BackendAdapter,
  commentId: string,
): Promise<void> {
  await adapter.deleteComment(commentId);
  console.log(`Deleted comment ${commentId}`);
}
