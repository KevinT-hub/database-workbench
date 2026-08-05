// 执行结果面板容器：视图切换（消息/概览/查询结果）与操作栏。
// 子视图已拆分为 ResultMessageView / ResultSummaryView / QueryResultTable，
// ResultActions 负责导出 CSV 与清空；本文件只保留容器职责。

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/stores';
import { cn } from '@/lib/cn';
import type { ResultTab, QueryResultData, ConnectionProfile } from '@/types';
import { ResultActions } from './ResultActions';
import { QueryResultTable } from './QueryResultTable';
import { ResultMessageView } from './ResultMessageView';
import { ResultSummaryView } from './ResultSummaryView';

interface ResultPanelProps {
  tabs: ResultTab[];
  metaTabs?: ResultTab[];
  executionWallTimeSec?: number;
  connectionProfile?: ConnectionProfile | null;
  activeTabId: string | null;
  onTabChange: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onClearAll: () => void;
  onRequestQueryPage?: (tabId: string, page: number, pageSize: number) => void | Promise<void>;
}

export const ResultPanel: React.FC<ResultPanelProps> = ({
  tabs,
  metaTabs,
  executionWallTimeSec,
  connectionProfile,
  activeTabId,
  onTabChange,
  onTabClose,
  onClearAll,
  onRequestQueryPage,
}) => {
  const { t } = useTranslation();
  const { theme } = useAppStore();
  const [activeViewId, setActiveViewId] = React.useState<string>('');
  const [pinMetaView, setPinMetaView] = React.useState(false);
  const [summaryOnlyErrors, setSummaryOnlyErrors] = React.useState(false);

  const executionTabs = React.useMemo(
    () => (metaTabs && metaTabs.length > 0 ? metaTabs : tabs),
    [metaTabs, tabs],
  );

  void onTabClose;

  const sortedTabs = React.useMemo(
    () => [...executionTabs].sort((a, b) => (a.statementOrder || 0) - (b.statementOrder || 0) || a.id.localeCompare(b.id)),
    [executionTabs],
  );

  const resultViews = React.useMemo(
    () => sortedTabs.filter((tab) => tab.type === 'query'),
    [sortedTabs],
  );
  const hasQueryResults = resultViews.length > 0;

  React.useEffect(() => {
    if (executionTabs.length === 0) {
      setActiveViewId('');
      setPinMetaView(false);
      return;
    }

    if (pinMetaView && (activeViewId === 'messages' || activeViewId === 'summary')) {
      return;
    }

    if (activeTabId && resultViews.some((tab) => tab.id === activeTabId)) {
      setActiveViewId(activeTabId);
      return;
    }

    if (!activeViewId || !resultViews.some((tab) => tab.id === activeViewId)) {
      if (hasQueryResults) {
        setActiveViewId(resultViews[0].id);
      } else {
        setActiveViewId('summary');
      }
    }
  }, [executionTabs, activeTabId, resultViews, activeViewId, pinMetaView, hasQueryResults]);

  const activeTab = React.useMemo(
    () => resultViews.find((tab) => tab.id === activeViewId) ?? null,
    [resultViews, activeViewId],
  );

  const handleSwitchView = (nextViewId: string) => {
    setActiveViewId(nextViewId);
    setPinMetaView(nextViewId === 'messages' || nextViewId === 'summary');
    if (nextViewId !== 'messages' && nextViewId !== 'summary') {
      onTabChange(nextViewId);
    }
  };

  const renderResultContent = (tab: ResultTab) => {
    return (
      <QueryResultTable
        data={tab.data as QueryResultData}
        onRequestPage={(page, pageSize) => onRequestQueryPage?.(tab.id, page, pageSize)}
      />
    );
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ResultActions
        activeTab={activeTab}
        tabCount={executionTabs.length}
        connectionProfile={connectionProfile}
        onClearAll={onClearAll}
      />

      {executionTabs.length === 0 ? (
        <div className={cn('flex flex-1 items-center justify-center text-sm', theme === 'dark' ? 'text-[#abb3bf]' : 'text-[#5f6b7c]')}>
          <p>{t('resultPanel.emptyHint')}</p>
        </div>
      ) : (
        <>
          <div className={cn(
            'flex flex-shrink-0 items-stretch overflow-x-auto overflow-y-hidden whitespace-nowrap border-b bg-[#f3f4f6]',
            theme === 'dark' ? 'border-[#374151] bg-[#1f2937]' : 'border-[#d9dde3]',
          )}>
            <button
              className={cn(
                'flex-none cursor-pointer border-none border-r bg-[#eceff3] px-3.5 py-1.5 text-xs text-[#334155]',
                theme === 'dark' ? 'border-[#374151] bg-[#273244] text-[#d1d5db]' : 'border-[#d9dde3]',
                activeViewId === 'messages'
                  ? theme === 'dark'
                    ? 'border-b bg-[#111827] font-semibold text-[#f9fafb]'
                    : 'border-b bg-white font-semibold text-[#0f172a]'
                  : theme === 'dark'
                    ? 'hover:bg-[#334155]'
                    : 'hover:bg-[#e5e9ef]',
              )}
              onClick={() => handleSwitchView('messages')}
            >
              {t('resultPanel.messages')}
            </button>
            <button
              className={cn(
                'flex-none cursor-pointer border-none border-r bg-[#eceff3] px-3.5 py-1.5 text-xs text-[#334155]',
                theme === 'dark' ? 'border-[#374151] bg-[#273244] text-[#d1d5db]' : 'border-[#d9dde3]',
                activeViewId === 'summary'
                  ? theme === 'dark'
                    ? 'border-b bg-[#111827] font-semibold text-[#f9fafb]'
                    : 'border-b bg-white font-semibold text-[#0f172a]'
                  : theme === 'dark'
                    ? 'hover:bg-[#334155]'
                    : 'hover:bg-[#e5e9ef]',
              )}
              onClick={() => handleSwitchView('summary')}
            >
              {t('resultPanel.summary')}
            </button>
            {resultViews.map((tab, index) => (
              <button
                key={`view_${tab.id}`}
                className={cn(
                  'flex-none cursor-pointer border-none border-r bg-[#eceff3] px-3.5 py-1.5 text-xs text-[#334155]',
                  theme === 'dark' ? 'border-[#374151] bg-[#273244] text-[#d1d5db]' : 'border-[#d9dde3]',
                  activeViewId === tab.id
                    ? theme === 'dark'
                      ? 'border-b bg-[#111827] font-semibold text-[#f9fafb]'
                      : 'border-b bg-white font-semibold text-[#0f172a]'
                    : theme === 'dark'
                      ? 'hover:bg-[#334155]'
                      : 'hover:bg-[#e5e9ef]',
                )}
                onClick={() => handleSwitchView(tab.id)}
              >
                {t('resultPanel.resultSetSimple', { index: index + 1 })}
              </button>
            ))}
          </div>

          <div className={cn('flex min-h-0 flex-1 flex-col bg-white', theme === 'dark' && 'bg-[#111827]')}>
            {activeViewId === 'messages' && <ResultMessageView tabs={sortedTabs} />}
            {activeViewId === 'summary' && (
              <ResultSummaryView
                tabs={sortedTabs}
                executionWallTimeSec={executionWallTimeSec}
                onlyErrors={summaryOnlyErrors}
                onToggleOnlyErrors={setSummaryOnlyErrors}
                onOpenQueryResult={handleSwitchView}
              />
            )}
            {activeTab && activeViewId !== 'messages' && activeViewId !== 'summary' && (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">{renderResultContent(activeTab)}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

