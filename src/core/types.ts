export interface Author {
  displayName: string;
}

export interface PinPosition {
  x: number; // % of viewport width
  y: number; // px from document top
  selector?: string;
  selectorOffset?: {
    x: number; // fraction of anchor element width (0..1)
    y: number; // fraction of anchor element height (0..1)
  };
}

export interface Attachment {
  id: string;
  url: string;
  width?: number;
  height?: number;
}

export interface Thread {
  id: string;
  projectId: string;
  pageUrl: string;
  pin: PinPosition;
  status: 'open' | 'resolved';
  metadata?: Record<string, unknown>;
  createdAt: string;
  comments: Comment[];
}

export interface Comment {
  id: string;
  threadId: string;
  author: Author;
  body: string;
  attachments: Attachment[];
  createdAt: string;
}

export interface ThreadFilter {
  pageUrl?: string;
  status?: 'open' | 'resolved' | 'all';
}

export interface GetThreadsParams {
  projectId: string;
  pageUrl?: string;
  status?: 'open' | 'resolved' | 'all';
}

export interface CreateThreadInput {
  projectId: string;
  pageUrl: string;
  pin: PinPosition;
  metadata?: Record<string, unknown>;
  body: string;
  author: Author;
  attachments?: Attachment[];
}

export interface CreateCommentInput {
  threadId: string;
  author: Author;
  body: string;
  attachments?: Attachment[];
}
