import React, { useState, useRef, useCallback, useEffect } from 'react';
import { AuthorPrompt } from './AuthorPrompt';
import { useCommentContext } from './CommentContext';
import { getStoredAuthor, setStoredAuthor } from '../core/author';
import type { Author, Attachment } from '../core/types';

interface ComposerProps {
  onSubmit: (body: string, author: Author, attachments: Attachment[]) => void | Promise<void>;
  placeholder?: string;
  screenshotPromise?: Promise<Blob | null> | null;
  onScreenshotRemove?: () => void;
  onUploadError?: (msg: string) => void;
}

type ScreenshotStatus = 'pending' | 'captured' | null;

export function Composer({
  onSubmit,
  placeholder = 'Write a comment...',
  screenshotPromise,
  onScreenshotRemove,
  onUploadError,
}: ComposerProps) {
  const { author: propAuthor, attachmentAdapter } = useCommentContext();
  const [body, setBody] = useState('');
  const [localAuthor, setLocalAuthor] = useState<Author | null>(() => getStoredAuthor());
  const [isEditingName, setIsEditingName] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ssStatus, setSsStatus] = useState<ScreenshotStatus>(null);
  const [ssObjectUrl, setSsObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!screenshotPromise) {
      setSsStatus(null);
      return;
    }
    setSsStatus('pending');
    let cancelled = false;
    let createdUrl: string | null = null;

    screenshotPromise.then((blob) => {
      if (cancelled) return;
      if (blob) {
        createdUrl = URL.createObjectURL(blob);
        setSsObjectUrl(createdUrl);
        setSsStatus('captured');
      } else {
        setSsStatus(null);
      }
    });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [screenshotPromise]);

  const handleRemoveScreenshot = useCallback(() => {
    if (ssObjectUrl) URL.revokeObjectURL(ssObjectUrl);
    setSsObjectUrl(null);
    setSsStatus(null);
    onScreenshotRemove?.();
  }, [ssObjectUrl, onScreenshotRemove]);

  const resolvedAuthor = propAuthor ?? localAuthor;
  const needsAuthor = !resolvedAuthor || isEditingName;

  const handleAuthorSubmit = (author: Author) => {
    setStoredAuthor(author);
    setLocalAuthor(author);
    setIsEditingName(false);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    const author = propAuthor ?? localAuthor;
    if (!trimmed || !author || isUploading || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(trimmed, author, pendingAttachments);
      setBody('');
      setPendingAttachments([]);
    } catch {
      // Error handling is done upstream (toast) — keep body so user can retry
    } finally {
      setIsSubmitting(false);
    }
  };

  const uploadFile = useCallback(
    async (file: File | Blob) => {
      if (!attachmentAdapter) return;
      // Validate type
      const mimeType = file.type;
      if (!mimeType.startsWith('image/')) {
        onUploadError?.('Only image files are supported.');
        return;
      }
      // Validate size (5 MB)
      if (file.size > 5 * 1024 * 1024) {
        onUploadError?.('File is too large (max 5 MB).');
        return;
      }
      setIsUploading(true);
      try {
        const attachment = await attachmentAdapter.uploadAttachment(file);
        setPendingAttachments((prev) => [...prev, attachment]);
      } catch {
        onUploadError?.('Image upload failed.');
      } finally {
        setIsUploading(false);
      }
    },
    [attachmentAdapter, onUploadError],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        uploadFile(file);
      }
      // Reset so the same file can be selected again
      e.target.value = '';
    },
    [uploadFile],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!attachmentAdapter) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            uploadFile(blob);
            break;
          }
        }
      }
    },
    [attachmentAdapter, uploadFile],
  );

  const removeAttachment = useCallback((id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const formRef = useRef<HTMLFormElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }, []);

  if (needsAuthor) {
    return <AuthorPrompt onSubmit={handleAuthorSubmit} />;
  }

  return (
    <form ref={formRef} className="rc-composer" onSubmit={handleSubmit}>
      <div className="rc-composer-header">
        <span className="rc-composer-author">{resolvedAuthor.displayName}</span>
        {!propAuthor && (
          <button
            type="button"
            className="rc-composer-edit-author"
            onClick={() => setIsEditingName(true)}
          >
            edit
          </button>
        )}
      </div>
      {/* Screenshot status */}
      {ssStatus === 'pending' && (
        <div className="rc-screenshot-indicator" aria-live="polite">
          <span>📷</span>
          <span>Capturing screenshot…</span>
        </div>
      )}
      {ssStatus === 'captured' && ssObjectUrl && (
        <div className="rc-screenshot-preview">
          <img src={ssObjectUrl} alt="Screenshot preview" className="rc-screenshot-thumb" />
          <div className="rc-screenshot-info">
            <span>📷 Screenshot captured</span>
            <button
              type="button"
              className="rc-screenshot-remove"
              onClick={handleRemoveScreenshot}
              aria-label="Remove screenshot"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {pendingAttachments.length > 0 && (
        <div className="rc-composer-attachments">
          {pendingAttachments.map((att) => (
            <div key={att.id} className="rc-composer-attachment-preview">
              <img src={att.url} alt="Attachment" />
              <button
                type="button"
                className="rc-composer-attachment-remove"
                onClick={() => removeAttachment(att.id)}
                aria-label="Remove attachment"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
      <textarea
        className="rc-composer-textarea"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        placeholder={placeholder}
        rows={3}
        autoFocus
      />
      <div className="rc-composer-footer">
        {attachmentAdapter && (
          <>
            <button
              type="button"
              className="rc-composer-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              aria-label="Attach image"
              title="Attach image (max 5 MB)"
            >
              {isUploading ? 'Uploading…' : '📎 Image'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
              aria-hidden="true"
            />
          </>
        )}
        <div className="rc-composer-actions">
          <button
            className="rc-composer-submit"
            type="submit"
            disabled={!body.trim() || isUploading || isSubmitting}
          >
            Send
          </button>
        </div>
      </div>
    </form>
  );
}
