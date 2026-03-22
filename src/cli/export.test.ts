import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BackendAdapter } from '../adapters/adapter';
import type { Thread } from '../core/types';
import { exportThreads, exportCommand } from './export';
import type { ExportResult } from './export';
import type { PinmarkConfig } from './config';

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

describe('exportCommand', () => {
  const config: PinmarkConfig = {
    supabaseUrl: 'https://test.supabase.co',
    supabaseAnonKey: 'test-key',
    projectId: 'test',
  };
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('defaults to JSON format', async () => {
    const adapter = createMockAdapter([makeThread()]);
    await exportCommand(adapter, config, {});
    const output = consoleSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.projectId).toBe('test');
    expect(parsed.threads).toHaveLength(1);
  });

  it('outputs markdown when format=markdown', async () => {
    const adapter = createMockAdapter([makeThread()]);
    await exportCommand(adapter, config, { format: 'markdown' });
    const output = consoleSpy.mock.calls[0][0] as string;
    expect(output).toContain('# Feedback Report');
  });

  it('defaults to json for invalid format', async () => {
    const adapter = createMockAdapter([]);
    await exportCommand(adapter, config, { format: 'csv' });
    const output = consoleSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.projectId).toBe('test');
  });

  it('passes status and page filters', async () => {
    const adapter = createMockAdapter([]);
    await exportCommand(adapter, config, { status: 'open', page: '/about' });
    expect(adapter.getThreads).toHaveBeenCalledWith({
      projectId: 'test',
      status: 'open',
      pageUrl: '/about',
    });
  });
});
