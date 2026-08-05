// 执行结果“概览”视图：统计 + 明细表（虚拟滚动）。
// 从 ResultPanel 拆分而来（行为与拆分前一致）。

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/stores';
import { cn } from '@/lib/cn';
import type { ResultTab } from '@/types';
import {
  SUMMARY_VIRTUAL_ROW_HEIGHT,
  SUMMARY_VIRTUAL_OVERSCAN,
  formatDateTime,
  formatSeconds,
  getSummaryInfoMessage,
  useVirtualWindow,
  type SummaryDetailState,
  type SummaryRowItem,
} from './resultViewShared';

export const ResultSummaryView: React.FC<{
  tabs: ResultTab[];
  executionWallTimeSec?: number;
  onlyErrors: boolean;
  onToggleOnlyErrors: (checked: boolean) => void;
  onOpenQueryResult: (tabId: string) => void;
}> = ({ tabs, executionWallTimeSec, onlyErrors, onToggleOnlyErrors, onOpenQueryResult }) => {
  const { t } = useTranslation();
  const { theme } = useAppStore();
  const [detailState, setDetailState] = React.useState<SummaryDetailState | null>(null);

  const summaryStats = React.useMemo(() => {
    const processed = tabs.length;
    const success = tabs.filter((tab) => tab.type !== 'error').length;
    const error = processed - success;
    const startAt = tabs[0]?.startedAt;
    const endAt = tabs[tabs.length - 1]?.finishedAt;
    const runtimeSec = tabs
      .reduce((acc, tab) => acc + (tab.executionTimeSec || 0) + (tab.fetchTimeSec || 0), 0)
      .toFixed(3);
    const runtimeDisplay = typeof executionWallTimeSec === 'number'
      ? executionWallTimeSec.toFixed(3)
      : runtimeSec;

    return {
      processed,
      success,
      error,
      startAt,
      endAt,
      runtimeSec: runtimeDisplay,
    };
  }, [tabs, executionWallTimeSec]);

  const tableRows = React.useMemo<SummaryRowItem[]>(() => {
    const sourceTabs = onlyErrors
      ? tabs.filter((tab) => tab.type === 'error')
      : tabs;

    return sourceTabs.map((tab) => ({
      tab,
      infoMessage: getSummaryInfoMessage(tab, t),
    }));
  }, [onlyErrors, tabs, t]);

  const summaryVirtualEnabled = tableRows.length > 220;
  const {
    containerRef,
    onScroll,
    range,
  } = useVirtualWindow(summaryVirtualEnabled, tableRows.length, SUMMARY_VIRTUAL_ROW_HEIGHT, SUMMARY_VIRTUAL_OVERSCAN);

  const renderedRows = React.useMemo(
    () => tableRows.slice(range.start, range.end),
    [tableRows, range.start, range.end],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cn(
        'flex items-start justify-between gap-3 border-b px-3 pb-1.5 pt-2.5',
        theme === 'dark' ? 'border-[#374151] bg-[#1f2937]' : 'border-[#e1e5ea] bg-[#f7f7f8]',
      )}>
        <div className={cn('grid grid-cols-[repeat(2,minmax(180px,1fr))] gap-x-6 gap-y-1 text-[13px]', theme === 'dark' ? 'text-[#e5e7eb]' : 'text-[#111827]')}>
          <div>{t('resultPanel.processed', { count: summaryStats.processed })}</div>
          <div>{t('resultPanel.startTime', { time: formatDateTime(summaryStats.startAt) })}</div>
          <div>{t('resultPanel.successCount', { count: summaryStats.success })}</div>
          <div>{t('resultPanel.endTime', { time: formatDateTime(summaryStats.endAt) })}</div>
          <div>{t('resultPanel.errorCount', { count: summaryStats.error })}</div>
          <div>{t('resultPanel.runtime', { time: summaryStats.runtimeSec })}</div>
        </div>
        <label className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-xs', theme === 'dark' ? 'text-[#e5e7eb]' : 'text-[#475569]')}>
          <input
            type="checkbox"
            checked={onlyErrors}
            onChange={(event) => onToggleOnlyErrors(event.target.checked)}
          />
          <span>{t('resultPanel.onlyErrors')}</span>
        </label>
      </div>

      <div ref={containerRef} className="min-h-0 flex-1 overflow-auto" onScroll={onScroll}>
        <table className="w-full table-fixed border-collapse text-[13px]">
          <thead>
            <tr>
              {[t('resultPanel.summarySql'), t('resultPanel.summaryMessage'), t('resultPanel.summaryQueryTime'), t('resultPanel.summaryFetchTime')].map((label) => (
                <th
                  key={label}
                  className={cn(
                    'sticky top-0 z-[1] whitespace-nowrap border-b border-r px-2.5 py-[7px] text-left align-middle font-semibold',
                    theme === 'dark' ? 'border-[#374151] bg-[#1f2937] text-[#e5e7eb]' : 'border-[#edf0f3] bg-[#f8fafc] text-[#111827]',
                  )}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {range.topPadding > 0 && (
              <tr>
                <td colSpan={4} style={{ height: `${range.topPadding}px`, padding: 0, border: 'none' }} />
              </tr>
            )}
            {renderedRows.map(({ tab, infoMessage }) => (
              <tr
                key={`summary_${tab.id}`}
                className={cn('group', tab.type === 'error' && (theme === 'dark' ? 'text-[#f4a746]' : 'text-[#c26a00]'))}
                style={summaryVirtualEnabled ? { height: `${SUMMARY_VIRTUAL_ROW_HEIGHT}px` } : undefined}
              >
                <td
                  className={cn(
                    'w-[44%] whitespace-nowrap border-b border-r px-2.5 py-[7px] text-left align-middle',
                    theme === 'dark' ? 'border-[#374151] text-[#e5e7eb]' : 'border-[#edf0f3] text-[#111827]',
                  )}
                  onDoubleClick={() => {
                    if (tab.type === 'query') {
                      onOpenQueryResult(tab.id);
                    }
                  }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 flex-1 overflow-hidden text-ellipsis" title={tab.sql}>
                      {tab.sql}
                    </span>
                    <button
                      className={cn(
                        'h-5 w-[22px] shrink-0 cursor-pointer rounded-[3px] border p-0 opacity-0 transition-opacity duration-100 group-hover:opacity-100',
                        theme === 'dark'
                          ? 'border-[#4b5563] bg-[#1f2937] text-[#d1d5db] hover:bg-[#334155]'
                          : 'border-[#d1d5db] bg-[#f8fafc] text-[#64748b] hover:bg-[#eef2f7]',
                      )}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDetailState({ content: tab.sql, kind: 'sql' });
                      }}
                      aria-label={t('resultPanel.viewDetail')}
                    >
                      ...
                    </button>
                  </div>
                </td>
                <td className={cn(
                  'w-[32%] whitespace-nowrap border-b border-r px-2.5 py-[7px] text-left align-middle',
                  theme === 'dark' ? 'border-[#374151] text-[#e5e7eb]' : 'border-[#edf0f3] text-[#111827]',
                )}>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="min-w-0 flex-1 overflow-hidden text-ellipsis" title={infoMessage}>
                      {infoMessage}
                    </span>
                    <button
                      className={cn(
                        'h-5 w-[22px] shrink-0 cursor-pointer rounded-[3px] border p-0 opacity-0 transition-opacity duration-100 group-hover:opacity-100',
                        theme === 'dark'
                          ? 'border-[#4b5563] bg-[#1f2937] text-[#d1d5db] hover:bg-[#334155]'
                          : 'border-[#d1d5db] bg-[#f8fafc] text-[#64748b] hover:bg-[#eef2f7]',
                      )}
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDetailState({ content: infoMessage, kind: 'info' });
                      }}
                      aria-label={t('resultPanel.viewDetail')}
                    >
                      ...
                    </button>
                  </div>
                </td>
                <td className={cn('whitespace-nowrap border-b border-r px-2.5 py-[7px] text-left align-middle', theme === 'dark' ? 'border-[#374151] text-[#e5e7eb]' : 'border-[#edf0f3] text-[#111827]')}>{formatSeconds(tab.executionTimeSec)}s</td>
                <td className={cn('whitespace-nowrap border-b border-r px-2.5 py-[7px] text-left align-middle', theme === 'dark' ? 'border-[#374151] text-[#e5e7eb]' : 'border-[#edf0f3] text-[#111827]')}>{formatSeconds(tab.fetchTimeSec)}s</td>
              </tr>
            ))}
            {range.bottomPadding > 0 && (
              <tr>
                <td colSpan={4} style={{ height: `${range.bottomPadding}px`, padding: 0, border: 'none' }} />
              </tr>
            )}
            {tableRows.length === 0 && (
              <tr>
                <td colSpan={4} className={cn('border-b border-r px-2.5 py-[7px] text-left align-middle', theme === 'dark' ? 'border-[#374151] text-[#e5e7eb]' : 'border-[#edf0f3] text-[#111827]')}>{t('resultPanel.noData')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detailState && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[rgba(0,0,0,0.2)]" onClick={() => setDetailState(null)}>
          <div
            className={cn(
              'flex w-[min(720px,78vw)] min-h-[240px] max-h-[72vh] flex-col rounded-lg border bg-white shadow-[0_12px_30px_rgba(0,0,0,0.22)]',
              theme === 'dark' ? 'border-[#374151] bg-[#111827]' : 'border-[#d1d5db]',
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={cn('min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words px-3 py-2.5 text-sm leading-[1.45]', theme === 'dark' ? 'text-[#e5e7eb]' : 'text-[#111827]')}>
              <textarea
                className={cn(
                  'h-full min-h-[180px] w-full resize-none overflow-y-auto whitespace-pre-wrap rounded border bg-white px-2.5 py-2 text-[13px] leading-[1.45] select-text',
                  theme === 'dark' ? 'border-[#4b5563] bg-[#111827] text-[#e5e7eb]' : 'border-[#d1d5db]',
                )}
                value={detailState.content}
                readOnly
                spellCheck={false}
              />
            </div>
            <div className={cn('flex justify-end px-3 py-2.5 border-t', theme === 'dark' ? 'border-[#374151]' : 'border-[#e5e7eb]')}>
              <button
                type="button"
                className={cn(
                  'h-[34px] min-w-[76px] cursor-pointer rounded-[5px] border',
                  theme === 'dark'
                    ? 'border-[#4b5563] bg-[#1f2937] text-[#e5e7eb] hover:bg-[#334155]'
                    : 'border-[#cbd5e1] bg-[#f8fafc] text-[#1e293b] hover:bg-[#eef2f7]',
                )}
                onClick={() => setDetailState(null)}
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

