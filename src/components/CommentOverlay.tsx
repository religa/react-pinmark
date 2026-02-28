import React, { useEffect, useCallback, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useCommentContext } from './CommentContext';
import { useComments } from '../hooks/useComments';
import { captureViewport } from '../core/screenshot';
import { Pin } from './Pin';
import { ThreadPopover } from './ThreadPopover';
import { ThreadList } from './ThreadList';
import { Composer } from './Composer';
import { ErrorBoundary } from './ErrorBoundary';
import { createPinPosition, resolvePin } from '../core/pin-resolver';
import { useLocationPathname } from '../hooks/useLocationPathname';
import type { PinPosition, Author, Attachment } from '../core/types';
import '../styles/base.css';

export interface CommentOverlayProps {
  hideResolved?: boolean;
  zIndex?: number;
  /** Key that toggles comment mode. Pass null to disable the keyboard shortcut. Default: 'c' */
  shortcutKey?: string | null;
}

export function CommentOverlay({
  hideResolved = true,
  zIndex = 10000,
  shortcutKey = 'c',
}: CommentOverlayProps) {
  const { enabled, colorScheme, captureScreenshot, attachmentAdapter } = useCommentContext();
  const {
    threads,
    isCommentMode,
    activeThread,
    toggleCommentMode,
    openThread,
    closeThread,
    closeThreadList,
    isThreadListOpen,
    createThread,
    replyToThread,
    resolveThread,
    unresolveThread,
    openThreadList,
  } = useComments();
  const currentPage = useLocationPathname();

  const [pendingPin, setPendingPin] = useState<{
    pin: PinPosition;
    left: number;
    top: number;
  } | null>(null);
  const [highlightedThreadId, setHighlightedThreadId] = useState<string | null>(
    null,
  );
  const [toastError, setToastError] = useState<string | null>(null);

  useEffect(() => {
    if (!toastError) return;
    const t = setTimeout(() => setToastError(null), 4000);
    return () => clearTimeout(t);
  }, [toastError]);
  const overlayRef = useRef<HTMLDivElement>(null);
  const screenshotRef = useRef<Promise<Blob | null> | null>(null);

  // Keyboard shortcuts: configurable toggle key + Esc to exit
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in an input/textarea/contentEditable
      const target = e.target as HTMLElement;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (target?.isContentEditable) return;

      if (shortcutKey && !e.metaKey && !e.ctrlKey && !e.altKey &&
          (e.key === shortcutKey || e.key === shortcutKey.toUpperCase())) {
        if (activeThread || pendingPin) return;
        toggleCommentMode();
      }
      if (e.key === 'Escape') {
        // If a thread popover is open, let it handle Escape first
        if (activeThread) return;
        if (isCommentMode) {
          toggleCommentMode();
          setPendingPin(null);
          screenshotRef.current = null;
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [enabled, isCommentMode, shortcutKey, toggleCommentMode, activeThread, pendingPin]);

  // Handle overlay click to place pin
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isCommentMode) return;
      e.preventDefault();
      e.stopPropagation();

      // e.target is always the overlay div itself — find the real page element underneath
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const target = (elements.find((el) => !el.closest('.rc-root')) ?? e.target) as HTMLElement;

      const pin = createPinPosition(
        e.clientX,
        e.clientY,
        target,
      );
      setPendingPin({
        pin,
        left: e.clientX,
        top: e.clientY + window.scrollY,
      });

      if (captureScreenshot && attachmentAdapter) {
        screenshotRef.current = captureViewport();
      }
    },
    [isCommentMode, captureScreenshot, attachmentAdapter],
  );

  const handleNewThreadSubmit = useCallback(
    async (body: string, _author: Author, attachments: Attachment[]) => {
      if (!pendingPin) return;

      let allAttachments = attachments;
      if (screenshotRef.current && attachmentAdapter) {
        const timeout = new Promise<null>((r) => setTimeout(() => r(null), 10_000));
        const blob = await Promise.race([screenshotRef.current, timeout]);
        screenshotRef.current = null;
        if (blob) {
          try {
            const screenshotAttachment = await attachmentAdapter.uploadAttachment(blob);
            allAttachments = [screenshotAttachment, ...attachments];
          } catch {
            setToastError('Screenshot upload failed — comment will be posted without it.');
          }
        }
      }

      try {
        await createThread({
          pin: pendingPin.pin,
          body,
          attachments: allAttachments,
        });
        setPendingPin(null);
      } catch {
        setToastError('Failed to post comment. Please try again.');
      }
    },
    [pendingPin, createThread, attachmentAdapter],
  );

  const handleReply = useCallback(
    async (threadId: string, body: string, _author: Author, attachments: Attachment[]) => {
      try {
        await replyToThread(threadId, body, attachments);
      } catch {
        setToastError('Failed to post reply. Please try again.');
      }
    },
    [replyToThread],
  );

  const handleNavigateToThread = useCallback(
    (threadId: string) => {
      const thread = threads.find((t) => t.id === threadId);
      if (!thread) return;
      closeThreadList();
      openThread(threadId);
      const pos = resolvePin(thread.pin);
      window.scrollTo({ top: Math.max(0, pos.top - 100), behavior: 'smooth' });
      setHighlightedThreadId(threadId);
      setTimeout(() => setHighlightedThreadId(null), 2400);
    },
    [threads, closeThreadList, openThread],
  );

  if (!enabled) return null;

  const pageThreads = threads.filter((t) => t.pageUrl === currentPage);
  const visibleThreads = hideResolved
    ? pageThreads.filter((t) => t.status === 'open')
    : pageThreads;

  const unresolvedCount = pageThreads.filter((t) => t.status === 'open').length;
  const badgeLabel = unresolvedCount > 9 ? '9+' : unresolvedCount > 0 ? String(unresolvedCount) : null;

  const portalContent = (
    <ErrorBoundary>
    <div
      className="rc-root"
      data-color-scheme={colorScheme}
      style={{ '--rc-z-index': zIndex } as React.CSSProperties}
    >
      {/* Pin markers */}
      {visibleThreads.map((thread, i) => (
        <Pin
          key={thread.id}
          thread={thread}
          index={i}
          isActive={activeThread?.id === thread.id}
          highlighted={highlightedThreadId === thread.id}
          onClick={() => {
            if (activeThread?.id === thread.id) {
              closeThread();
            } else {
              openThread(thread.id);
            }
          }}
        />
      ))}

      {/* Active thread popover */}
      {activeThread && (
        <ThreadPopover
          thread={activeThread}
          onClose={closeThread}
          onReply={(body, author, attachments) =>
            handleReply(activeThread.id, body, author, attachments)
          }
          onResolve={() => resolveThread(activeThread.id)}
          onUnresolve={() => unresolveThread(activeThread.id)}
          onUploadError={setToastError}
        />
      )}

      {/* New comment composer (at pending pin position) */}
      {pendingPin && !activeThread && (
        <div
          className="rc-new-comment-popover"
          style={{
            position: 'absolute',
            left: `${pendingPin.left + 40}px`,
            top: `${pendingPin.top}px`,
          }}
        >
          <Composer
            onSubmit={handleNewThreadSubmit}
            placeholder="Add a comment..."
            screenshotPromise={screenshotRef.current}
            onScreenshotRemove={() => { screenshotRef.current = null; }}
            onUploadError={setToastError}
          />
        </div>
      )}

      {/* Comment mode overlay (click capture) */}
      {isCommentMode && (
        <div
          ref={overlayRef}
          className="rc-click-overlay"
          onClick={handleOverlayClick}
        />
      )}

      {/* Thread list panel */}
      <ThreadList onNavigate={handleNavigateToThread} shortcutKey={shortcutKey} />

      {/* Error toast */}
      {toastError && (
        <div className="rc-toast rc-toast--error" role="alert" aria-live="assertive">
          {toastError}
          <button className="rc-toast-dismiss" onClick={() => setToastError(null)} aria-label="Dismiss">&times;</button>
        </div>
      )}

      {/* Floating toggle button */}
      <div className="rc-floating-controls">
        <button
          className={`rc-toggle-btn ${isCommentMode ? 'rc-toggle-btn--active' : ''}`}
          onClick={toggleCommentMode}
          aria-label={
            isCommentMode ? 'Exit comment mode' : 'Enter comment mode'
          }
          title={isCommentMode ? 'Exit comment mode' : `Add comment${shortcutKey ? ` (${shortcutKey.toUpperCase()})` : ''}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
        <button
          className={`rc-toggle-btn rc-list-btn${isThreadListOpen ? ' rc-toggle-btn--active' : ''}`}
          onClick={isThreadListOpen ? closeThreadList : openThreadList}
          aria-label={isThreadListOpen ? 'Close thread list' : 'Open thread list'}
          title="Thread list"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          {badgeLabel && (
            <span className="rc-list-badge" aria-label={`${unresolvedCount} unresolved`}>
              {badgeLabel}
            </span>
          )}
        </button>
      </div>
    </div>
    </ErrorBoundary>
  );

  return createPortal(portalContent, document.body);
}
