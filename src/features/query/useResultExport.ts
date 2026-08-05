// useResultExport.ts —— 查询结果区 CSV 导出 hook
//
// 收敛 ResultActions 内联的导出流程：save 对话框 → exportApi → 结果提示。
// 组件不再直接 import api 模块（阶段 3：API 调用统一化）。

import { useCallback, useEffect, useState } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { useTranslation } from 'react-i18next';
import { exportApi } from '@/api';
import type { ResultTab, QueryResultData, ConnectionProfile } from '@/types';

interface UseResultExportOptions {
  activeTab: ResultTab | null;
  connectionProfile?: ConnectionProfile | null;
}

export const useResultExport = ({
  activeTab,
  connectionProfile,
}: UseResultExportOptions) => {
  const { t } = useTranslation();
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const canExportCsv =
    activeTab?.type === 'query' &&
    Boolean((activeTab.data as QueryResultData | undefined)?.columns?.length);

  useEffect(() => {
    if (!exportNotice) return;
    const timer = window.setTimeout(() => setExportNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [exportNotice]);

  const handleExportCsv = useCallback(async () => {
    if (!activeTab || activeTab.type !== 'query') return;
    if (!connectionProfile) {
      setExportNotice(t('resultPanel.exportFailed', { error: 'no active connection' }));
      return;
    }

    try {
      const queryData = activeTab.data as QueryResultData;
      const sourceSql = queryData.sourceSql || activeTab.sql;

      const timestamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      const defaultFileName = `query_result_${timestamp}.csv`;

      const selectedPath = await save({
        title: t('resultPanel.exportTitle'),
        defaultPath: defaultFileName,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
        canCreateDirectories: true,
      });

      if (!selectedPath) {
        setExportNotice(t('resultPanel.exportCancelled'));
        return;
      }

      // V2 契约：export_query_result 由后端重新执行 SQL 并写出文件
      const result = await exportApi.exportQueryResult(
        connectionProfile,
        sourceSql,
        'csv',
        selectedPath,
      );

      if (result.success) {
        setExportNotice(t('resultPanel.exportSuccess', {
          time: `${result.durationMs}ms`,
          path: result.filePath,
        }));
      } else {
        setExportNotice(t('resultPanel.exportFailed', { error: result.error || 'Unknown error' }));
      }
    } catch (error) {
      setExportNotice(t('resultPanel.exportFailed', { error: String(error) }));
    }
  }, [activeTab, connectionProfile, t]);

  return { exportNotice, canExportCsv, handleExportCsv };
};
