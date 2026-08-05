// 结果区视图共享工具：格式化、剪贴板、虚拟滚动、列宽调整、摘要计算。
// 从 ResultPanel 拆分，供 QueryResultTable / ResultMessageView / ResultSummaryView 复用。

import React from 'react';
import { useAppStore } from '@/stores';
import { cn } from '@/lib/cn';
import {
  getSqlKeyword,
} from '@/lib/sql';
import type { ResultTab, ExecResultData } from '@/types';

export const MESSAGE_VIRTUAL_ROW_HEIGHT = 84;
export const MESSAGE_VIRTUAL_OVERSCAN = 10;
export const SUMMARY_VIRTUAL_ROW_HEIGHT = 36;
export const SUMMARY_VIRTUAL_OVERSCAN = 12;

interface VirtualWindowRange {
  start: number;
  end: number;
  topPadding: number;
  bottomPadding: number;
}

export interface SummaryDetailState {
  content: string;
  kind: 'sql' | 'info';
}

export interface SummaryRowItem {
  tab: ResultTab;
  infoMessage: string;
}

// 保持既有导入路径兼容：这些格式化/工具函数已收敛到 lib/，此处仅透传导出。
export { formatCellValue, formatDateTime, formatSeconds } from '@/lib/format';
export { normalizeSqlForMessage } from '@/lib/sql';
export { copyTextToClipboard } from '@/lib/dom';

export const useVirtualWindow = (
  enabled: boolean,
  rowCount: number,
  rowHeight: number,
  overscan: number,
): {
  containerRef: React.RefObject<HTMLDivElement>;
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  range: VirtualWindowRange;
} => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewportHeight, setViewportHeight] = React.useState(420);

  React.useEffect(() => {
    if (!enabled) {
      setScrollTop(0);
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const applyHeight = () => {
      setViewportHeight(container.clientHeight || 420);
    };

    applyHeight();
    const observer = new ResizeObserver(applyHeight);
    observer.observe(container);

    return () => observer.disconnect();
  }, [enabled]);

  const onScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (!enabled) {
      return;
    }
    setScrollTop((event.currentTarget as HTMLDivElement).scrollTop);
  }, [enabled]);

  const range = React.useMemo<VirtualWindowRange>(() => {
    if (!enabled) {
      return {
        start: 0,
        end: rowCount,
        topPadding: 0,
        bottomPadding: 0,
      };
    }

    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
    const end = Math.min(rowCount, start + visibleCount);
    const topPadding = start * rowHeight;
    const bottomPadding = Math.max(0, (rowCount - end) * rowHeight);

    return {
      start,
      end,
      topPadding,
      bottomPadding,
    };
  }, [enabled, overscan, rowCount, rowHeight, scrollTop, viewportHeight]);

  return {
    containerRef,
    onScroll,
    range,
  };
};

// Column resize handle component - matching DatabaseObjectTab style
export const ColumnResizeHandle: React.FC<{
  onResize: (delta: number) => void;
}> = ({ onResize }) => {
  const { theme } = useAppStore();
  const [isResizing, setIsResizing] = React.useState(false);
  const startXRef = React.useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    startXRef.current = e.clientX;
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  React.useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current;
      onResize(delta);
      startXRef.current = e.clientX;
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, onResize]);

  return (
    <div
      className={cn(
        'group absolute right-0 top-0 bottom-0 z-10 flex w-2.5 cursor-col-resize items-center justify-center bg-transparent transition-colors duration-150',
        isResizing ? 'bg-[#2d72d2]' : 'hover:bg-[#2d72d2]',
      )}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      <div className={cn(
        'h-1/2 w-px transition-colors duration-150',
        theme === 'dark' ? 'bg-[#3e3e42]' : 'bg-[#d1d5db]',
        'group-hover:bg-transparent',
        isResizing && 'bg-transparent',
      )} />
    </div>
  );
};

export const getSummaryInfoMessage = (
  tab: ResultTab,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string => {
  if (tab.type === 'error') {
    return tab.statusText || (typeof tab.data === 'string' ? tab.data : t('resultPanel.execFailed'));
  }

  if (tab.type === 'update') {
    const keyword = getSqlKeyword(tab.sql);
    const updateData = tab.data as ExecResultData;
    if (keyword === 'update' || keyword === 'delete' || keyword === 'insert' || keyword === 'replace') {
      return t('resultPanel.affectedRows', { count: updateData.affectedRows });
    }

    if (keyword === 'create') {
      return 'OK';
    }

    if (typeof updateData.affectedRows === 'number' && updateData.affectedRows > 0) {
      return t('resultPanel.affectedRows', { count: updateData.affectedRows });
    }

    return 'OK';
  }

  return 'OK';
};
