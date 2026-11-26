// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CommentProvider } from './CommentProvider';
import { CommentOverlay } from './CommentOverlay';
import { ThreadList } from './ThreadList';
import type { BackendAdapter } from '../adapters/adapter';

const backend: BackendAdapter = {
  getThreads: vi.fn().mockResolvedValue([]),
  createThread: vi.fn(),
  updateThread: vi.fn(),
  deleteThread: vi.fn(),
  getComments: vi.fn(),
  createComment: vi.fn(),
  deleteComment: vi.fn(),
};

describe('server rendering', () => {
  it('renders without touching window/document', () => {
    expect(typeof document).toBe('undefined');
    const html = renderToString(
      <CommentProvider backend={backend} projectId="p">
        <main>app</main>
        <CommentOverlay />
        <ThreadList onNavigate={() => {}} />
      </CommentProvider>,
    );
    expect(html).toContain('<main>app</main>');
  });
});
