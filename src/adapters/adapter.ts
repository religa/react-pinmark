import type {
  Thread,
  Comment,
  Attachment,
  GetThreadsParams,
  CreateThreadInput,
  CreateCommentInput,
} from '../core/types';

export interface BackendAdapter {
  getThreads(params: GetThreadsParams): Promise<Thread[]>;
  createThread(input: CreateThreadInput): Promise<Thread>;
  updateThread(
    id: string,
    patch: { status: 'open' | 'resolved' },
  ): Promise<Thread>;
  deleteThread(id: string): Promise<void>;
  getComments(threadId: string): Promise<Comment[]>;
  createComment(input: CreateCommentInput): Promise<Comment>;
}

export interface AttachmentAdapter {
  uploadAttachment(file: File | Blob): Promise<Attachment>;
}
