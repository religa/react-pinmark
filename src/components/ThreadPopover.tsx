import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { micromark } from 'micromark';
import type { Thread, Comment, Author, Attachment, ThreadEvent } from '../core/types';
import { THREAD_STATUSES, STATUS_LABELS, type ThreadStatus } from '../core/status';
import { formatRelativeTime, formatAbsoluteTime } from '../core/format';
import { Composer } from './Composer';
import { resolvePin } from '../core/pin-resolver';
import { parseThreadContext, type ThreadContext } from '../core/thread-context';

// Tooltip clips above viewport when trigger is within this many px of the top edge.
const FLIP_THRESHOLD = 90;

function ContextTooltip({ context }: { context: ThreadContext }) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);

  const readRect = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    return r ? { top: r.top, right: document.documentElement.clientWidth - r.right } : null;
  }, []);

  const show = useCallback(() => setAnchor(readRect()), [readRect]);
  const hide = useCallback(() => setAnchor(null), []);

  // Keep position in sync while visible (scroll / resize can move the trigger).
  useEffect(() => {
    if (!anchor) return;
    const update = () => setAnchor(readRect());
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [anchor !== null]); // re-subscribe only when visibility changes, not on every position update

  const flipped = anchor !== null && anchor.top < FLIP_THRESHOLD;

  return (
    <span
      ref={triggerRef}
      className="rc-ctx-trigger"
      tabIndex={0}
      role="button"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      aria-label="Environment info"
    >
      ⓘ
      {anchor && createPortal(
        <div
          className={`rc-ctx-tooltip${flipped ? ' rc-ctx-tooltip--below' : ''}`}
          role="tooltip"
          style={{
            position: 'fixed',
            ...(flipped
              ? { top: anchor.top + 18, right: anchor.right }
              : { bottom: window.innerHeight - anchor.top + 6, right: anchor.right }),
          }}
        >
          {context.browser && context.os && (
            <span className="rc-ctx-row">
              <span className="rc-ctx-key">Browser</span>
              <span className="rc-ctx-val">{context.browser} / {context.os}</span>
            </span>
          )}
          {context.viewport && (
            <span className="rc-ctx-row">
              <span className="rc-ctx-key">Viewport</span>
              <span className="rc-ctx-val">{context.viewport}</span>
            </span>
          )}
          {context.screen && (
            <span className="rc-ctx-row">
              <span className="rc-ctx-key">Screen</span>
              <span className="rc-ctx-val">{context.screen}</span>
            </span>
          )}
          {context.elementIdentity && (
            <span className="rc-ctx-row">
              <span className="rc-ctx-key">Element</span>
              <span className="rc-ctx-val">{context.elementIdentity}</span>
            </span>
          )}
          {context.elementSize && (
            <span className="rc-ctx-row">
              <span className="rc-ctx-key">Size</span>
              <span className="rc-ctx-val">{context.elementSize}</span>
            </span>
          )}
          {context.surroundingText && (
            <span className="rc-ctx-row rc-ctx-row--wrap">
              <span className="rc-ctx-key">Context</span>
              <span className="rc-ctx-val">{context.surroundingText}</span>
            </span>
          )}
        </div>,
        document.body,
      )}
    </span>
  );
}

function CommentItem({
  comment,
  threadContext,
}: {
  comment: Comment;
  threadContext?: ThreadContext | null;
}) {
  // micromark does not allow raw HTML by default — safe to use dangerouslySetInnerHTML
  const bodyHtml = useMemo(() => micromark(comment.body), [comment.body]);
  return (
    <div className="rc-comment">
      <div className="rc-comment-header">
        <span className="rc-comment-author">{comment.author.displayName}</span>
        <span className="rc-comment-time" title={formatAbsoluteTime(comment.createdAt)}>
          {formatRelativeTime(comment.createdAt)}
        </span>
        {threadContext && <ContextTooltip context={threadContext} />}
      </div>
      <div
        className="rc-comment-body rc-comment-body--md"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
      {comment.attachments.length > 0 && (
        <div className="rc-comment-attachments">
          {comment.attachments.map((att) => (
            <a
              key={att.id}
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rc-comment-attachment"
            >
              <img
                src={att.url}
                alt="Attachment"
                width={att.width}
                height={att.height}
              />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function EventItem({ event }: { event: ThreadEvent }) {
  return (
    <div className="rc-event">
      <span className="rc-event-actor">{event.actor.displayName}</span>
      {' → '}
      <span className={`rc-status-badge rc-status-badge--${event.toStatus}`}>
        {STATUS_LABELS[event.toStatus]}
      </span>
      <span className="rc-event-time" title={formatAbsoluteTime(event.createdAt)}>
        {' · '}
        {formatRelativeTime(event.createdAt)}
      </span>
    </div>
  );
}

type TimelineItem =
  | { kind: 'comment'; at: string; comment: Comment; isFirst: boolean }
  | { kind: 'event'; at: string; event: ThreadEvent };

/** Comments and status changes in one chronological list. */
function buildTimeline(thread: Thread): TimelineItem[] {
  const items: TimelineItem[] = [
    ...thread.comments.map((comment, i) => ({
      kind: 'comment' as const,
      at: comment.createdAt,
      comment,
      isFirst: i === 0,
    })),
    ...(thread.events ?? []).map((event) => ({
      kind: 'event' as const,
      at: event.createdAt,
      event,
    })),
  ];
  // Stable sort keeps comment order for equal timestamps.
  return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

/** One-click primary action per status; the status dropdown covers every other transition. */
const QUICK_ACTIONS: Record<ThreadStatus, { label: string; to: ThreadStatus }> = {
  open: { label: 'Resolve', to: 'resolved' },
  pending: { label: 'Confirm fix', to: 'resolved' },
  resolved: { label: 'Reopen', to: 'open' },
  dismissed: { label: 'Reopen', to: 'open' },
};

interface ThreadPopoverProps {
  thread: Thread;
  /** The pin's number, shown in the title ("#3 · 2 comments"). */
  pinNumber?: number;
  onClose: () => void;
  onReply: (body: string, author: Author, attachments: Attachment[]) => void;
  onStatusChange: (status: ThreadStatus) => void | Promise<void>;
  onUploadError?: (msg: string) => void;
}

export function ThreadPopover({
  thread,
  pinNumber,
  onClose,
  onReply,
  onStatusChange,
  onUploadError,
}: ThreadPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const pinPos = useMemo(() => resolvePin(thread.pin), [thread.pin]);
  const threadContext = useMemo(() => parseThreadContext(thread), [thread]);
  const timeline = useMemo(() => buildTimeline(thread), [thread]);

  const changeStatus = useCallback(
    async (status: ThreadStatus) => {
      setIsUpdatingStatus(true);
      try {
        await onStatusChange(status);
      } finally {
        setIsUpdatingStatus(false);
      }
    },
    [onStatusChange],
  );

  const quickAction = QUICK_ACTIONS[thread.status];

  // Close on Esc
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!popoverRef.current || popoverRef.current.contains(target)) return;
      // This thread's own pin toggles the popover via its click handler. Closing
      // here on mousedown would make that click reopen it.
      const pin = target.closest?.('.rc-pin');
      if (pin?.getAttribute('data-thread-id') === thread.id) return;
      onClose();
    };
    // Delay to avoid closing on the same click that opens
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose, thread.id]);

  // Focus trap: save previous focus, move focus into dialog, restore on close
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;

    const focusable = popoverRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !popoverRef.current) return;
      const all = Array.from(
        popoverRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (all.length === 0) return;
      const first = all[0];
      const last = all[all.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, []); // mount-only

  // Position: prefer right of pin, flip if near edge
  const popoverLeft =
    pinPos.left + 40 + 320 > window.innerWidth
      ? pinPos.left - 320 - 8
      : pinPos.left + 40;

  // Vertical: clamp so popover stays within viewport
  const popoverHeight = 320; // approximate max height
  const viewportBottom = window.scrollY + window.innerHeight;
  const popoverTop =
    pinPos.top + popoverHeight > viewportBottom
      ? Math.max(window.scrollY + 8, viewportBottom - popoverHeight - 8)
      : pinPos.top;

  return (
    <div
      ref={popoverRef}
      className="rc-popover"
      role="dialog"
      aria-modal="true"
      aria-label="Comment thread"
      style={{
        position: 'absolute',
        left: `${popoverLeft}px`,
        top: `${popoverTop}px`,
      }}
    >
      <div className="rc-popover-header">
        <span className="rc-popover-title">
          {pinNumber ? `#${pinNumber} · ` : ''}
          {thread.comments.length} comment{thread.comments.length !== 1 ? 's' : ''}
        </span>
        <div className="rc-popover-header-actions">
          <button
            className="rc-popover-resolve"
            onClick={() => changeStatus(quickAction.to)}
            disabled={isUpdatingStatus}
          >
            {isUpdatingStatus ? '…' : quickAction.label}
          </button>
          <select
            className={`rc-popover-status rc-status-badge--${thread.status}`}
            value={thread.status}
            onChange={(e) => changeStatus(e.target.value as ThreadStatus)}
            disabled={isUpdatingStatus}
            aria-label="Thread status"
          >
            {THREAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <button
            className="rc-popover-close"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
      </div>

      <div className="rc-popover-comments">
        {timeline.map((item) =>
          item.kind === 'comment' ? (
            <CommentItem
              key={item.comment.id}
              comment={item.comment}
              threadContext={item.isFirst ? threadContext : null}
            />
          ) : (
            <EventItem key={item.event.id} event={item.event} />
          ),
        )}
      </div>

      <Composer
        onSubmit={(body, author, attachments) => onReply(body, author, attachments)}
        placeholder="Reply..."
        onUploadError={onUploadError}
      />
    </div>
  );
}
