import type { ThreadStatus, StatusFilter } from './status';

export interface Author {
  displayName: string;
  /** Stable identity, generated when the user first saves their name. Renaming keeps it. */
  id?: string;
}

export interface ScrollContainerInfo {
  selector: string;
  scrollTop: number;
  scrollLeft: number;
}

export interface PinPosition {
  x: number; // % of viewport width
  y: number; // px from document top
  selector?: string;
  selectorOffset?: {
    x: number; // fraction of anchor element width (0..1)
    y: number; // fraction of anchor element height (0..1)
  };
  anchorLabel?: string;
  scrollContainers?: ScrollContainerInfo[];
  contentFingerprint?: {
    textHash: string;
    tagName: string;
    nthOfType: number;
    parentSelector?: string;
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
  status: ThreadStatus;
  metadata?: Record<string, unknown>;
  createdAt: string;
  comments: Comment[];
  /** Status history, oldest first. Absent when the backend doesn't record history. */
  events?: ThreadEvent[];
}

export interface ThreadEvent {
  id: string;
  threadId: string;
  type: 'status_changed';
  actor: Author;
  toStatus: ThreadStatus;
  createdAt: string;
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
  status?: StatusFilter;
  /** Only pending threads the current author opened. */
  waitingForMe?: boolean;
}

export interface GetThreadsParams {
  projectId: string;
  pageUrl?: string;
  status?: StatusFilter;
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
