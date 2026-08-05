import React from 'react';
import { Button } from '@blueprintjs/core';
import { useTranslation } from 'react-i18next';
import type { ResultTab, ConnectionProfile } from '@/types';
import { ClearResultsIcon } from '@/components/icons/QueryIcons';
import { useResultExport } from '../useResultExport';
import { useAppStore } from '@/stores';
import { cn } from '@/lib/cn';

interface ResultActionsProps {
  /** 当前选中的查询结果 tab（仅 type === 'query' 时可导出 CSV） */
  activeTab: ResultTab | null;
  /** 执行结果总条数（含 update/error/query） */
  tabCount: number;
  connectionProfile?: ConnectionProfile | null;
  onClearAll: () => void;
}

/**
 * 结果区操作栏：标题/统计、导出 CSV、清空结果。
 * 从 ResultPanel 拆分而来，导出逻辑与提示状态收敛在本组件内。
 */
export const ResultActions: React.FC<ResultActionsProps> = ({
  activeTab,
  tabCount,
  connectionProfile,
  onClearAll,
}) => {
  const { t } = useTranslation();
  const { theme } = useAppStore();
  const { exportNotice, canExportCsv, handleExportCsv } = useResultExport({
    activeTab,
    connectionProfile,
  });

  return (
    <div className={cn(
      'flex flex-shrink-0 items-center justify-between border-b px-3 py-1.5',
      theme === 'dark' ? 'border-[#3e3e42] bg-[#252a31]' : 'border-[#e1e5e9] bg-[#f5f6f7]',
    )}>
      <div className={cn('flex items-center gap-1.5 text-[13px] font-semibold', theme === 'dark' ? 'text-[#f6f7f9]' : 'text-[#1c2127]')}>
        <span>{t('resultPanel.title')}</span>
        {tabCount > 0 && (
          <span className={cn('text-xs font-normal', theme === 'dark' ? 'text-[#abb3bf]' : 'text-[#5f6b7c]')}>({tabCount})</span>
        )}
        {exportNotice && (
          <span className={cn('text-xs font-normal', theme === 'dark' ? 'text-[#abb3bf]' : 'text-[#5f6b7c]')}>{exportNotice}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          small
          minimal
          onClick={handleExportCsv}
          disabled={!canExportCsv}
          className="flex items-center gap-1 text-sm"
        >
          <span>{t('resultPanel.exportCsv')}</span>
        </Button>
        <Button
          small
          minimal
          onClick={onClearAll}
          disabled={tabCount === 0}
          className="flex items-center gap-1 text-sm"
        >
          <ClearResultsIcon size={14} />
          <span>{t('resultPanel.clearResults')}</span>
        </Button>
      </div>
    </div>
  );
};
