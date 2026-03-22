import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { useComments } from '../hooks/useComments';
import { formatRelativeTime } from '../core/format';

export interface ThreadListProps {
  onNavigate: (threadId: string) => void;
  shortcutKey?: string | null;
}

export function ThreadList({ onNavigate, shortcutKey }: ThreadListProps) {
  const {
    threads,
    isThreadListOpen,
    filter,
    closeThreadList,
    setFilter,
    resolveThread,
    unresolveThread,
    deleteThread,
  } = useComments();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  // Clear selection when panel closes
  useEffect(() => {
    if (!isThreadListOpen) setSelectedIds(new Set());
  }, [isThreadListOpen]);

  // Close on Esc when open
  useEffect(() => {
    if (!isThreadListOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeThreadList();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isThreadListOpen, closeThreadList]);

  // Pin number = 1-based index among all open threads (matches overlay pin numbers)
  const openThreads = useMemo(() => threads.filter((t) => t.status === 'open'), [threads]);
  const getPinNumber = useCallback(
    (threadId: string) => {
      const idx = openThreads.findIndex((t) => t.id === threadId);
      return idx >= 0 ? idx + 1 : null;
    },
    [openThreads],
  );

  // Client-side filtering against already-loaded threads
  const filteredThreads = useMemo(() => {
    let result = threads;
    if (filter.pageUrl) {
      result = result.filter((t) => t.pageUrl === filter.pageUrl);
    }
    if (filter.status && filter.status !== 'all') {
      result = result.filter((t) => t.status === filter.status);
    }
    return result;
  }, [threads, filter]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allSelected =
    filteredThreads.length > 0 && filteredThreads.every((t) => selectedIds.has(t.id));
  const someSelected = filteredThreads.some((t) => selectedIds.has(t.id));

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredThreads.map((t) => t.id)));
    }
  }, [allSelected, filteredThreads]);

  const handleBulkResolve = useCallback(async () => {
    setIsBulkLoading(true);
    try {
      await Promise.all([...selectedIds].map((id) => resolveThread(id)));
      setSelectedIds(new Set());
    } finally {
      setIsBulkLoading(false);
    }
  }, [selectedIds, resolveThread]);

  const handleBulkUnresolve = useCallback(async () => {
    setIsBulkLoading(true);
    try {
      await Promise.all([...selectedIds].map((id) => unresolveThread(id)));
      setSelectedIds(new Set());
    } finally {
      setIsBulkLoading(false);
    }
  }, [selectedIds, unresolveThread]);

  const handleBulkDelete = useCallback(async () => {
    if (!window.confirm(`Delete ${selectedIds.size} thread${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    setIsBulkLoading(true);
    try {
      await Promise.all([...selectedIds].map((id) => deleteThread(id)));
      setSelectedIds(new Set());
    } finally {
      setIsBulkLoading(false);
    }
  }, [selectedIds, deleteThread]);

  const handleDownload = useCallback(() => {
    const selected = threads.filter((t) => selectedIds.has(t.id));
    const now = new Date().toISOString();
    const data = {
      exportVersion: 1,
      exportedAt: now,
      threads: selected.map((t) => ({
        id: t.id,
        projectId: t.projectId,
        pinNumber: getPinNumber(t.id),
        status: t.status,
        pageUrl: t.pageUrl,
        createdAt: t.createdAt,
        pin: {
          x: t.pin.x,
          y: t.pin.y,
          anchorElement: t.pin.selector ?? null,
          anchorOffset: t.pin.selectorOffset ?? null,
          anchorLabel: t.pin.anchorLabel ?? null,
          contentFingerprint: t.pin.contentFingerprint ?? null,
          scrollContainers: t.pin.scrollContainers ?? null,
        },
        context: t.metadata ?? null,
        comments: t.comments.map((c) => ({
          author: c.author.displayName,
          body: c.body,
          createdAt: c.createdAt,
          attachments: c.attachments.map((a) => ({
            id: a.id,
            url: a.url,
          })),
        })),
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comments-${now.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [threads, selectedIds, getPinNumber]);

  const handlePageFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setFilter({
        pageUrl:
          e.target.value === 'current' ? window.location.pathname : undefined,
      });
    },
    [setFilter],
  );

  const handleStatusFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value as 'all' | 'open' | 'resolved';
      setFilter({ status: value === 'all' ? undefined : value });
    },
    [setFilter],
  );

  return (
    <div
      className={`rc-thread-list${isThreadListOpen ? ' rc-thread-list--open' : ''}`}
      role="complementary"
      aria-label="Comments panel"
    >
      <div className="rc-thread-list-header">
        <span className="rc-thread-list-title">Comments</span>
        <button
          className="rc-thread-list-close"
          onClick={closeThreadList}
          aria-label="Close thread list"
        >
          &times;
        </button>
      </div>

      <div className="rc-thread-list-filters">
        <label className="rc-select-all-check" title="Select all">
          <input
            type="checkbox"
            ref={(el) => {
              if (el) el.indeterminate = someSelected && !allSelected;
            }}
            checked={allSelected}
            onChange={toggleSelectAll}
            disabled={filteredThreads.length === 0}
            aria-label="Select all threads"
          />
        </label>
        <select
          className="rc-filter-select"
          value={filter.pageUrl ? 'current' : 'all'}
          onChange={handlePageFilterChange}
          aria-label="Page filter"
        >
          <option value="all">All pages</option>
          <option value="current">Current page</option>
        </select>
        <select
          className="rc-filter-select"
          value={filter.status ?? 'all'}
          onChange={handleStatusFilterChange}
          aria-label="Status filter"
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {someSelected && (
        <div className="rc-bulk-actions">
          <span className="rc-bulk-count">{selectedIds.size} selected</span>
          <button className="rc-bulk-btn" onClick={handleBulkResolve} disabled={isBulkLoading}>
            {isBulkLoading ? '…' : 'Resolve'}
          </button>
          <button className="rc-bulk-btn" onClick={handleBulkUnresolve} disabled={isBulkLoading}>
            {isBulkLoading ? '…' : 'Unresolve'}
          </button>
          <button className="rc-bulk-btn" onClick={handleDownload}>
            Download
          </button>
          <button className="rc-bulk-btn rc-bulk-btn--danger" onClick={handleBulkDelete} disabled={isBulkLoading}>
            {isBulkLoading ? '…' : 'Delete'}
          </button>
        </div>
      )}

      <div className="rc-thread-list-items">
        {filteredThreads.length === 0 ? (
          <div className="rc-thread-list-empty">
            <svg className="rc-thread-list-empty-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p className="rc-thread-list-empty-title">No comments yet</p>
            <p className="rc-thread-list-empty-hint">
              {shortcutKey
                ? <>Press <kbd>{shortcutKey.toUpperCase()}</kbd> to enter comment mode, then click anywhere to leave a comment.</>
                : 'Enter comment mode, then click anywhere to leave a comment.'}
            </p>
          </div>
        ) : (
          filteredThreads.map((thread) => {
            const firstComment = thread.comments[0];
            const replyCount = thread.comments.length - 1;
            const pinNum = getPinNumber(thread.id);
            const isSelected = selectedIds.has(thread.id);
            return (
              <div
                key={thread.id}
                className={`rc-thread-list-item${isSelected ? ' rc-thread-list-item--selected' : ''}`}
              >
                <label className="rc-thread-list-item-check">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(thread.id)}
                    aria-label={`Select thread by ${firstComment?.author.displayName ?? 'Unknown'}`}
                  />
                </label>
                <button
                  className="rc-thread-list-item-body"
                  onClick={() => onNavigate(thread.id)}
                  aria-label={`Open thread: ${firstComment?.body?.slice(0, 50) ?? ''}`}
                >
                  <div className="rc-thread-list-item-header">
                    {pinNum !== null && (
                      <span className="rc-thread-list-pin-num">{pinNum}</span>
                    )}
                    <span className="rc-thread-list-item-author">
                      {firstComment?.author.displayName ?? 'Unknown'}
                    </span>
                    <span className="rc-thread-list-item-time">
                      {firstComment ? formatRelativeTime(firstComment.createdAt) : ''}
                    </span>
                  </div>
                  <div className="rc-thread-list-item-preview">
                    {firstComment?.body ?? ''}
                  </div>
                  <div className="rc-thread-list-item-footer">
                    {replyCount > 0 && (
                      <span className="rc-thread-list-item-replies">
                        {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                      </span>
                    )}
                    <span className={`rc-status-badge rc-status-badge--${thread.status}`}>
                      {thread.status}
                    </span>
                  </div>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
