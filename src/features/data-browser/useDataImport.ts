// useDataImport.ts —— 表数据页导入动作 hook
//
// 收敛 V1 中 TableDataTab 内联的导入流程：文件选择 → importApi → 成功/失败通知 → 刷新。
// 组件不再直接 import api 模块（阶段 3：API 调用统一化）。

import { useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useTranslation } from 'react-i18next';
import { importApi } from '@/api';
import { showImportSuccessNotice, showImportFailedNotice } from '@/hooks';
import type { ConnectionProfile, ExportFormat, ImportFormat } from '@/types';
import { getFileFilter } from './utils';

interface UseDataImportOptions {
  connectionProfile: ConnectionProfile;
  database: string;
  tableName: string;
  /** 导入成功后刷新数据 */
  onImported: () => Promise<void>;
}

export const useDataImport = ({
  connectionProfile,
  database,
  tableName,
  onImported,
}: UseDataImportOptions) => {
  const { t } = useTranslation();

  const handleImport = useCallback(
    async (exportFormat: ExportFormat) => {
      try {
        // 导入仅支持：txt、csv、json、xml、sql（不支持 html）
        const importFormatValue: ImportFormat = exportFormat === 'html' ? 'csv' : exportFormat as ImportFormat;

        const selectedPath = await open({
          title: t('tableDataTab.import.title', { format: importFormatValue.toUpperCase() }),
          filters: getFileFilter(importFormatValue),
          canCreateDirectories: false,
        });

        if (!selectedPath || typeof selectedPath !== 'string') {
          return;
        }

        const result = await importApi.importTable(
          connectionProfile,
          database,
          tableName,
          selectedPath,
          importFormatValue,
        );

        if (result.success) {
          await showImportSuccessNotice(result.rowsImported);
          await onImported();
        } else {
          await showImportFailedNotice(result.error || 'Unknown error');
        }
      } catch (error) {
        await showImportFailedNotice(String(error));
      }
    },
    [connectionProfile, database, tableName, onImported, t],
  );

  return { handleImport };
};
