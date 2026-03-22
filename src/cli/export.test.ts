import { describe, it, expect, vi } from 'vitest';
import type { BackendAdapter } from '../adapters/adapter';
import type { Thread } from '../core/types';
import { exportThreads } from './export';
import type { ExportResult } from './export';

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: 'thread-1',
    projectId: 'test',
    pageUrl: '/page',
    pin: { x: 50, y: 100 },
    status: 'open',
    createdAt: '2024-01-01T00:00:00Z',
    comments: [
      {
        id: 'c1',
        threadId: 'thread-1',
        author: { displayName: 'Alice' },
        body: 'Hello world',
        attachments: [],
        createdAt: '2024-01-01T00:00:00Z',
      },
    ],
    ...overrides,
  };
}

function createMockAdapter(threads: Thread[] = []): BackendAdapter {
  return {
    getThreads: vi.fn().mockResolvedValue(threads),
    createThread: vi.fn(),
    updateThread: vi.fn(),
    deleteThread: vi.fn(),
    getComments: vi.fn(),
    createComment: vi.fn(),
    deleteComment: vi.fn(),
  };
}

describe('exportThreads', () => {
  describe('JSON format', () => {
    it('produces valid ExportResult JSON', async () => {
      const adapter = createMockAdapter([makeThread()]);
      const output = await exportThreads(adapter, 'test', { format: 'json' });
      const parsed: ExportResult = JSON.parse(output);

      expect(parsed.projectId).toBe('test');
      expect(parsed.threadCount).toBe(1);
      expect(parsed.threads).toHaveLength(1);
      expect(parsed.threads[0].id).toBe('thread-1');
      expect(parsed.exportedAt).toBeTruthy();
    });

    it('handles empty thread list', async () => {
      const adapter = createMockAdapter([]);
      const output = await exportThreads(adapter, 'test', { format: 'json' });
      const parsed: ExportResult = JSON.parse(output);

      expect(parsed.threadCount).toBe(0);
      expect(parsed.threads).toHaveLength(0);
    });

    it('passes status and page filters', async () => {
      const adapter = createMockAdapter([]);
      await exportThreads(adapter, 'test', {
        format: 'json',
        status: 'open',
        pageUrl: '/about',
      });

      expect(adapter.getThreads).toHaveBeenCalledWith({
        projectId: 'test',
        status: 'open',
        pageUrl: '/about',
      });
    });
  });

  describe('Markdown format', () => {
    it('has correct structure with headers and grouping', async () => {
      const threads = [
        makeThread({ id: 't1', pageUrl: '/page-a', status: 'open' }),
        makeThread({ id: 't2', pageUrl: '/page-a', status: 'resolved' }),
        makeThread({ id: 't3', pageUrl: '/page-b', status: 'open' }),
      ];
      const adapter = createMockAdapter(threads);
      const output = await exportThreads(adapter, 'test', {
        format: 'markdown',
      });

      expect(output).toContain('# Feedback Report — test');
      expect(output).toContain('Threads: 3 (open: 2, resolved: 1)');
      expect(output).toContain('## /page-a');
      expect(output).toContain('## /page-b');
      expect(output).toContain('### Thread #1 — open');
      expect(output).toContain('### Thread #2 — resolved');
      expect(output).toContain('**Alice**');
      expect(output).toContain('Hello world');
    });

    it('handles empty thread list', async () => {
      const adapter = createMockAdapter([]);
      const output = await exportThreads(adapter, 'test', {
        format: 'markdown',
      });

      expect(output).toContain('# Feedback Report — test');
      expect(output).toContain('Threads: 0 (open: 0, resolved: 0)');
    });
  });
});
