import { createStore } from 'zustand/vanilla';
import type { Thread, ThreadFilter } from './types';

export interface CommentState {
  threads: Thread[];
  isCommentMode: boolean;
  activeThread: Thread | null;
  isThreadListOpen: boolean;
  filter: ThreadFilter;
  isLoading: boolean;
}

export interface CommentActions {
  setThreads(threads: Thread[]): void;
  addThread(thread: Thread): void;
  updateThread(id: string, patch: Partial<Thread>): void;
  removeThread(id: string): void;
  setCommentMode(on: boolean): void;
  setActiveThread(thread: Thread | null): void;
  setThreadListOpen(open: boolean): void;
  setFilter(filter: Partial<ThreadFilter>): void;
  setLoading(loading: boolean): void;
}

export type CommentStore = CommentState & CommentActions;

export function createCommentStore() {
  return createStore<CommentStore>((set) => ({
    // State
    threads: [],
    isCommentMode: false,
    activeThread: null,
    isThreadListOpen: false,
    filter: {},
    isLoading: false,

    // Actions
    setThreads: (threads) => set({ threads }),
    addThread: (thread) =>
      set((s) => ({ threads: [...s.threads, thread] })),
    updateThread: (id, patch) =>
      set((s) => ({
        threads: s.threads.map((t) =>
          t.id === id ? { ...t, ...patch } : t,
        ),
        activeThread:
          s.activeThread?.id === id
            ? { ...s.activeThread, ...patch }
            : s.activeThread,
      })),
    removeThread: (id) =>
      set((s) => ({
        threads: s.threads.filter((t) => t.id !== id),
        activeThread: s.activeThread?.id === id ? null : s.activeThread,
      })),
    setCommentMode: (on) => set({ isCommentMode: on }),
    setActiveThread: (thread) => set({ activeThread: thread }),
    setThreadListOpen: (open) => set({ isThreadListOpen: open }),
    setFilter: (filter) =>
      set((s) => ({ filter: { ...s.filter, ...filter } })),
    setLoading: (loading) => set({ isLoading: loading }),
  }));
}
