import { describe, it, expect } from 'vitest';
import { createCommentStore } from './state';
import type { Thread } from './types';

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: 'thread-1',
    projectId: 'proj-1',
    pageUrl: '/page',
    pin: { x: 50, y: 100 },
    status: 'open',
    createdAt: '2024-01-01T00:00:00Z',
    comments: [],
    ...overrides,
  };
}

describe('CommentStore', () => {
  it('starts with default state', () => {
    const store = createCommentStore();
    const s = store.getState();
    expect(s.threads).toEqual([]);
    expect(s.isCommentMode).toBe(false);
    expect(s.activeThread).toBeNull();
    expect(s.isThreadListOpen).toBe(false);
    expect(s.filter).toEqual({});
    expect(s.isLoading).toBe(false);
  });

  it('setThreads replaces the thread list', () => {
    const store = createCommentStore();
    const t1 = makeThread({ id: 'a' });
    const t2 = makeThread({ id: 'b' });
    store.getState().setThreads([t1, t2]);
    expect(store.getState().threads).toEqual([t1, t2]);
  });

  it('addThread appends a thread', () => {
    const store = createCommentStore();
    const t1 = makeThread({ id: 'a' });
    store.getState().addThread(t1);
    expect(store.getState().threads).toHaveLength(1);
    const t2 = makeThread({ id: 'b' });
    store.getState().addThread(t2);
    expect(store.getState().threads).toHaveLength(2);
  });

  it('updateThread patches a thread by id', () => {
    const store = createCommentStore();
    store.getState().setThreads([makeThread({ id: 'a' })]);
    store.getState().updateThread('a', { status: 'resolved' });
    expect(store.getState().threads[0].status).toBe('resolved');
  });

  it('updateThread also patches activeThread if same id', () => {
    const store = createCommentStore();
    const t = makeThread({ id: 'a' });
    store.getState().setThreads([t]);
    store.getState().setActiveThread(t);
    store.getState().updateThread('a', { status: 'resolved' });
    expect(store.getState().activeThread?.status).toBe('resolved');
  });

  it('setCommentMode toggles comment mode', () => {
    const store = createCommentStore();
    store.getState().setCommentMode(true);
    expect(store.getState().isCommentMode).toBe(true);
    store.getState().setCommentMode(false);
    expect(store.getState().isCommentMode).toBe(false);
  });

  it('setActiveThread sets and clears active thread', () => {
    const store = createCommentStore();
    const t = makeThread();
    store.getState().setActiveThread(t);
    expect(store.getState().activeThread).toEqual(t);
    store.getState().setActiveThread(null);
    expect(store.getState().activeThread).toBeNull();
  });

  it('setThreadListOpen toggles the thread list', () => {
    const store = createCommentStore();
    store.getState().setThreadListOpen(true);
    expect(store.getState().isThreadListOpen).toBe(true);
  });

  it('setFilter merges filter values', () => {
    const store = createCommentStore();
    store.getState().setFilter({ status: 'open' });
    expect(store.getState().filter).toEqual({ status: 'open' });
    store.getState().setFilter({ pageUrl: '/foo' });
    expect(store.getState().filter).toEqual({ status: 'open', pageUrl: '/foo' });
  });

  it('setLoading sets loading state', () => {
    const store = createCommentStore();
    store.getState().setLoading(true);
    expect(store.getState().isLoading).toBe(true);
  });

  it('removeThread removes a thread by id', () => {
    const store = createCommentStore();
    store.getState().setThreads([makeThread({ id: 'a' }), makeThread({ id: 'b' })]);
    store.getState().removeThread('a');
    expect(store.getState().threads).toHaveLength(1);
    expect(store.getState().threads[0].id).toBe('b');
  });

  it('removeThread clears activeThread if it matches removed id', () => {
    const store = createCommentStore();
    const t = makeThread({ id: 'a' });
    store.getState().setThreads([t]);
    store.getState().setActiveThread(t);
    store.getState().removeThread('a');
    expect(store.getState().activeThread).toBeNull();
  });

  it('removeThread does not clear activeThread if ids differ', () => {
    const store = createCommentStore();
    const t1 = makeThread({ id: 'a' });
    const t2 = makeThread({ id: 'b' });
    store.getState().setThreads([t1, t2]);
    store.getState().setActiveThread(t1);
    store.getState().removeThread('b');
    expect(store.getState().activeThread?.id).toBe('a');
  });
});
