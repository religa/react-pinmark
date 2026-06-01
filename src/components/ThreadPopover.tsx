import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { micromark } from 'micromark';
import type { Thread, Comment, Author, Attachment } from '../core/types';
import { formatRelativeTime } from '../core/format';
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
        <span className="rc-comment-time">
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

interface ThreadPopoverProps {
  thread: Thread;
  onClose: () => void;
  onReply: (body: string, author: Author, attachments: Attachment[]) => void;
  onResolve: () => void | Promise<void>;
  onUnresolve: () => void | Promise<void>;
  onUploadError?: (msg: string) => void;
}

export function ThreadPopover({
  thread,
  onClose,
  onReply,
  onResolve,
  onUnresolve,
  onUploadError,
}: ThreadPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const pinPos = useMemo(() => resolvePin(thread.pin), [thread.pin]);
  const threadContext = useMemo(() => parseThreadContext(thread), [thread]);

  const handleResolveClick = useCallback(async () => {
    setIsResolving(true);
    try {
      await (thread.status === 'open' ? onResolve() : onUnresolve());
    } finally {
      setIsResolving(false);
    }
  }, [thread.status, onResolve, onUnresolve]);

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
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    // Delay to avoid closing on the same click that opens
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

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
          {thread.comments.length} comment{thread.comments.length !== 1 ? 's' : ''}
        </span>
        <div className="rc-popover-header-actions">
          <button
            className="rc-popover-resolve"
            onClick={handleResolveClick}
            disabled={isResolving}
          >
            {isResolving ? '…' : (thread.status === 'open' ? 'Resolve' : 'Unresolve')}
          </button>
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
        {thread.comments.map((comment, i) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            threadContext={i === 0 ? threadContext : null}
          />
        ))}
      </div>

      <Composer
        onSubmit={(body, author, attachments) => onReply(body, author, attachments)}
        placeholder="Reply..."
        onUploadError={onUploadError}
      />
    </div>
  );
}
