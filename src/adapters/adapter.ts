import type {
  Author,
  Thread,
  Comment,
  Attachment,
  GetThreadsParams,
  CreateThreadInput,
  CreateCommentInput,
} from '../core/types';
import type { ThreadStatus } from '../core/status';

export interface BackendAdapter {
  getThreads(params: GetThreadsParams): Promise<Thread[]>;
  createThread(input: CreateThreadInput): Promise<Thread>;
  /** Changes the status and records a status_changed event by `actor` (if the backend keeps history). */
  updateThread(
    id: string,
    patch: { status: ThreadStatus },
    actor: Author,
  ): Promise<Thread>;
  deleteThread(id: string): Promise<void>;
  getComments(threadId: string): Promise<Comment[]>;
  createComment(input: CreateCommentInput): Promise<Comment>;
  deleteComment(id: string): Promise<void>;
}

export interface AttachmentAdapter {
  uploadAttachment(file: File | Blob): Promise<Attachment>;
}
