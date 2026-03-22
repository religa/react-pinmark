import { describe, it, expect } from 'vitest';
import { formatThreadsTable, formatCommentsTable } from './format';
import type { Thread, Comment } from '../core/types';

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

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'c1',
    threadId: 'thread-1',
    author: { displayName: 'Alice' },
    body: 'Hello world',
    attachments: [],
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('formatThreadsTable', () => {
  it('returns message for empty list', () => {
    expect(formatThreadsTable([])).toBe('No threads found.');
  });

  it('formats a single thread into a table', () => {
    const output = formatThreadsTable([makeThread()]);
    expect(output).toContain('ID');
    expect(output).toContain('STATUS');
    expect(output).toContain('PAGE');
    expect(output).toContain('PREVIEW');
    expect(output).toContain('COMMENTS');
    expect(output).toContain('CREATED');
    expect(output).toContain('thread-1');
    expect(output).toContain('open');
    expect(output).toContain('/page');
    expect(output).toContain('Hello world');
  });

  it('formats multiple threads', () => {
    const threads = [
      makeThread({ id: 't1', status: 'open' }),
      makeThread({ id: 't2', status: 'resolved', pageUrl: '/about' }),
    ];
    const output = formatThreadsTable(threads);
    expect(output).toContain('t1');
    expect(output).toContain('t2');
    expect(output).toContain('/about');
    expect(output).toContain('resolved');
  });

  it('shows empty preview when thread has no comments', () => {
    const output = formatThreadsTable([makeThread({ comments: [] })]);
    expect(output).toContain('thread-1');
  });

  it('truncates long preview to 60 chars', () => {
    const longBody = 'A'.repeat(100);
    const thread = makeThread({
      comments: [makeComment({ body: longBody })],
    });
    const output = formatThreadsTable([thread]);
    expect(output).toContain('A'.repeat(60));
    expect(output).not.toContain('A'.repeat(61));
  });
});

describe('formatCommentsTable', () => {
  it('returns message for empty list', () => {
    expect(formatCommentsTable([])).toBe('No comments found.');
  });

  it('formats a single comment into a table', () => {
    const output = formatCommentsTable([makeComment()]);
    expect(output).toContain('ID');
    expect(output).toContain('AUTHOR');
    expect(output).toContain('BODY');
    expect(output).toContain('CREATED');
    expect(output).toContain('c1');
    expect(output).toContain('Alice');
    expect(output).toContain('Hello world');
  });

  it('truncates long body to 80 chars', () => {
    const longBody = 'B'.repeat(120);
    const output = formatCommentsTable([makeComment({ body: longBody })]);
    expect(output).toContain('B'.repeat(80));
    expect(output).not.toContain('B'.repeat(81));
  });
});
