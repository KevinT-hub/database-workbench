// 数据浏览共享导出逻辑：全表/当前页导出、多页确认对话框状态、格式状态。
// 表与视图仅对象名与文案不同，行为与拆分前逐行一致。

import { useCallback, useState } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import type { ConnectionProfile, ExportFormat } from '@/types';
import { exportApi } from '@/api';
import { showExportSuccessNotice, showExportFailedNotice } from '@/hooks';
import { getFileExtension, getFileFilter } from './utils';

interface UseDataExportLabels {
  saveTitle: (format: string) => string;
  dialogTitle: string;
  dialogMessage: (totalRows: number) => string;
  confirmText: string;
  cancelText: string;
}

interface UseDataExportOptions {
  connectionProfile: ConnectionProfile;
  database: string;
  /** 表名或视图名（用于文件名与导出 SQL） */
  objectName: string;
  totalRows: number;
  pageSize: number;
  /**
   * “导出当前页”实际执行的 SQL（应包含 WHERE/GROUP BY/ORDER BY 筛选与
   * LIMIT 分页，与当前页显示内容一致）。缺省时回退为不带条件的 SELECT *。
   */
  currentPageSql?: string;
  labels: UseDataExportLabels;
}

export const useDataExport = ({
  connectionProfile,
  database,
  objectName,
  totalRows,
  pageSize,
  currentPageSql,
  labels,
}: UseDataExportOptions) => {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  const handleExport = useCallback(async (exportAll: boolean) => {
    try {
      const timestamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
      const ext = getFileExtension(exportFormat);
      const defaultFileName = `${objectName}_${timestamp}.${ext}`;

      const selectedPath = await save({
        title: labels.saveTitle(exportFormat.toUpperCase()),
        defaultPath: defaultFileName,
        filters: getFileFilter(exportFormat),
        canCreateDirectories: true,
      });

      if (!selectedPath) {
        return;
      }

      if (exportAll) {
        // 导出全表
        const result = await exportApi.exportTable(
          connectionProfile,
          database,
          objectName,
          selectedPath,
          exportFormat
        );
        if (result.success) {
          await showExportSuccessNotice(result.rowsExported, result.filePath);
        } else {
          await showExportFailedNotice(result.error || 'Unknown error');
        }
      } else {
        // 导出当前页（V2：后端重新执行 SQL 导出；SQL 含筛选与分页，与当前页一致）
        const sql = currentPageSql ?? `SELECT * FROM \`${database}\`.\`${objectName}\``;
        const result = await exportApi.exportQueryResult(
          connectionProfile,
          sql,
          exportFormat,
          selectedPath,
          database,
          objectName,
        );
        if (result.success) {
          await showExportSuccessNotice(result.rowsExported, result.filePath);
        } else {
          await showExportFailedNotice(result.error || 'Unknown error');
        }
      }
    } catch (error) {
      await showExportFailedNotice(String(error));
    }
  }, [connectionProfile, database, objectName, exportFormat, currentPageSql, labels]);

  const handleExportClick = useCallback(() => {
    const totalPages = Math.ceil(totalRows / pageSize);
    if (totalPages <= 1) {
      // 只有一页，直接导出全表
      void handleExport(true);
    } else {
      // 多页，显示选择对话框
      setIsExportDialogOpen(true);
    }
  }, [totalRows, pageSize, handleExport]);

  return {
    exportFormat,
    setExportFormat,
    isExportDialogOpen,
    setIsExportDialogOpen,
    handleExport,
    handleExportClick,
  };
};

