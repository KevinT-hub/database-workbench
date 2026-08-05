// 执行结果“消息”视图：逐条展示 SQL 与执行状态（虚拟滚动）。
// 从 ResultPanel 拆分而来（行为与拆分前一致）。

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ResultTab } from '@/types';
import { useAppStore } from '@/stores';
import { cn } from '@/lib/cn';
import {
  MESSAGE_VIRTUAL_ROW_HEIGHT,
  MESSAGE_VIRTUAL_OVERSCAN,
  formatSeconds,
  normalizeSqlForMessage,
  useVirtualWindow,
} from './resultViewShared';

export const ResultMessageView: React.FC<{ tabs: ResultTab[] }> = ({ tabs }) => {
  const { t } = useTranslation();
  const { theme } = useAppStore();
  const virtualEnabled = tabs.length > 220;
  const {
    containerRef,
    onScroll,
    range,
  } = useVirtualWindow(virtualEnabled, tabs.length, MESSAGE_VIRTUAL_ROW_HEIGHT, MESSAGE_VIRTUAL_OVERSCAN);

  const renderedTabs = React.useMemo(
    () => tabs.slice(range.start, range.end),
    [tabs, range.start, range.end],
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "min-h-0 flex-1 overflow-auto px-3 py-2.5 font-['Consolas','Microsoft_YaHei',monospace] text-sm leading-[1.55]",
        theme === 'dark' ? 'text-[#e5e7eb]' : 'text-[#111827]',
      )}
      onScroll={onScroll}
    >
      {range.topPadding > 0 && <div className="w-full" style={{ height: `${range.topPadding}px` }} />}
      {renderedTabs.map((tab, index) => {
        const actualIndex = range.start + index;

        return (
          <div key={tab.id} className="overflow-hidden py-1" style={virtualEnabled ? { height: `${MESSAGE_VIRTUAL_ROW_HEIGHT}px` } : undefined}>
            <p className={cn('m-0 overflow-hidden text-ellipsis whitespace-nowrap', theme === 'dark' ? 'text-[#e5e7eb]' : 'text-[#0f172a]')} title={tab.sql}>{normalizeSqlForMessage(tab.sql) || tab.title}</p>
            <p className={cn('m-0 overflow-hidden text-ellipsis whitespace-nowrap', theme === 'dark' ? 'text-[#e5e7eb]' : 'text-[#1f2937]')}>&gt; {tab.type === 'error' ? tab.statusText || t('resultPanel.execFailed') : 'OK'}</p>
            <p className={cn('m-0 overflow-hidden text-ellipsis whitespace-nowrap', theme === 'dark' ? 'text-[#e5e7eb]' : 'text-[#1f2937]')}>
              &gt; {t('resultPanel.queryTime', { time: formatSeconds(tab.executionTimeSec) })}
            </p>
            {actualIndex < tabs.length - 1 && <div className={cn('mb-1 mt-2 border-t border-dashed', theme === 'dark' ? 'border-[#374151]' : 'border-[#d7dbe2]')} />}
          </div>
        );
      })}
      {range.bottomPadding > 0 && <div className="w-full" style={{ height: `${range.bottomPadding}px` }} />}
    </div>
  );
};

