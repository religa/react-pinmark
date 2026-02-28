import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { micromark } from 'micromark';
import type { Thread, Comment, Author, Attachment } from '../core/types';
import { formatRelativeTime } from '../core/format';
import { Composer } from './Composer';
import { resolvePin } from '../core/pin-resolver';

function CommentItem({ comment }: { comment: Comment }) {
  // micromark does not allow raw HTML by default — safe to use dangerouslySetInnerHTML
  const bodyHtml = useMemo(() => micromark(comment.body), [comment.body]);
  return (
    <div className="rc-comment">
      <div className="rc-comment-header">
        <span className="rc-comment-author">{comment.author.displayName}</span>
        <span className="rc-comment-time">
          {formatRelativeTime(comment.createdAt)}
        </span>
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
        {thread.comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
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
