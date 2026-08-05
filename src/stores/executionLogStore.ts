import { create } from 'zustand';
import type { ExecutionLogItem, ExecutionLogLevel, ExecutionLogPayload } from '../types/app';
import { throttle } from '../lib/fp';

interface ExecutionLogState {
  logPages: ExecutionLogItem[][];
  totalLogs: number;
  activePage: number;
  pageSize: number;
  addLog: (level: ExecutionLogLevel, message: string) => void;
  appendMany: (entries: ExecutionLogItem[]) => void;
  setActivePage: (page: number) => void;
  clearLogs: () => void;
}

const PAGE_SIZE = 300;
const MAX_UI_LOGS = 6000;
const MAX_UI_PAGES = Math.ceil(MAX_UI_LOGS / PAGE_SIZE);

const LOG_QUEUE: ExecutionLogItem[] = [];

const clampPage = (page: number, totalPages: number): number => {
  if (totalPages <= 0) {
    return 1;
  }
  return Math.min(Math.max(page, 1), totalPages);
};

const buildPagedLogs = (logs: ExecutionLogItem[]): ExecutionLogItem[][] => {
  if (logs.length === 0) {
    return [];
  }

  const pages: ExecutionLogItem[][] = [];
  for (let start = 0; start < logs.length; start += PAGE_SIZE) {
    pages.push(logs.slice(start, start + PAGE_SIZE));
  }
  return pages;
};

const makeLogItem = (
  level: ExecutionLogLevel,
  message: string,
  timestamp: number,
): ExecutionLogItem => ({
  id: `${timestamp}-${Math.random().toString(36).slice(2, 10)}`,
  level,
  message,
  timestamp,
});

const flushQueue = (): void => {
  if (LOG_QUEUE.length === 0) {
    return;
  }

  const entries = LOG_QUEUE.splice(0, LOG_QUEUE.length);
  useExecutionLogStore.getState().appendMany(entries);
};

// 16ms 节流：批量合并高频执行日志事件（尾部仍会补一次，空队列时自动跳过）
const scheduleFlush = throttle(flushQueue, 16);

export const useExecutionLogStore = create<ExecutionLogState>((set) => ({
  logPages: [],
  totalLogs: 0,
  activePage: 1,
  pageSize: PAGE_SIZE,
  addLog: (level, message) => {
    const ts = Date.now();
    useExecutionLogStore.getState().appendMany([makeLogItem(level, message, ts)]);
  },
  appendMany: (entries) => {
    if (entries.length === 0) {
      return;
    }

    set((state) => {
      const previous = state.logPages.flat();
      const merged = [...previous, ...entries];
      const trimmed = merged.length > MAX_UI_LOGS
        ? merged.slice(merged.length - MAX_UI_LOGS)
        : merged;
      const pages = buildPagedLogs(trimmed);
      const totalPages = pages.length || 1;
      const wasFollowing = state.activePage >= (state.logPages.length || 1);
      const nextActivePage = wasFollowing
        ? totalPages
        : clampPage(state.activePage, totalPages);

      return {
        logPages: pages.slice(Math.max(0, pages.length - MAX_UI_PAGES)),
        totalLogs: trimmed.length,
        activePage: nextActivePage,
      };
    });
  },
  setActivePage: (page) => {
    set((state) => {
      const totalPages = state.logPages.length || 1;
      return { activePage: clampPage(page, totalPages) };
    });
  },
  clearLogs: () => {
    LOG_QUEUE.splice(0, LOG_QUEUE.length);
    set({ logPages: [], totalLogs: 0, activePage: 1 });
  },
}));

export const appendExecutionLogFromEvent = (payload: ExecutionLogPayload): void => {
  if (!payload || typeof payload.sql !== 'string') {
    return;
  }

  const sql = payload.sql.trim();
  if (!sql) {
    return;
  }

  const message = `[SQL] ${sql} (${payload.affectedRows ?? 0} 行, ${payload.durationMs ?? 0} ms)`;
  if (!message) {
    return;
  }

  const ts = Number.isFinite(payload.timestampMs)
    ? payload.timestampMs
    : Date.now();

  LOG_QUEUE.push(makeLogItem('INFO', message, ts));
  scheduleFlush();
};
