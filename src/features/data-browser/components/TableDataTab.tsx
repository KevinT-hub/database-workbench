// 表数据页：容器组件。共享状态机（连接/取数/行编辑/分页）在 useDataTable，
// 共享导出在 useDataExport，渲染由 DataFilterBar/DataToolbar/DataGrid/DataPagination
// 拼装；本文件只保留表页差异：列元数据加载、导入动作、预览/导出对话框。

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@blueprintjs/core';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/stores';
import type { ConnectionProfile, ExportFormat } from '@/types';
import { PreviewCommitDialog, ConfirmDialog } from '@/features/dialogs';
import { cn } from '@/lib/cn';

import { useDataTable } from '../useDataTable';
import { useDataExport } from '../useDataExport';
import { useDataImport } from '../useDataImport';
import { useTableColumns } from '../useTableColumns';
import type { DataColumnInfo } from '../types';
import { buildCurrentPageSql } from '../utils';
import { DataFilterBar } from './DataFilterBar';
import { DataToolbar } from './DataToolbar';
import { DataGrid } from './DataGrid';
import { DataPagination } from './DataPagination';

interface TableDataTabProps {
  tabId: string;
  connectionProfile: ConnectionProfile;
  database: string;
  tableName: string;
}

export const TableDataTab: React.FC<TableDataTabProps> = ({
  connectionProfile,
  database,
  tableName,
}) => {
  const { t } = useTranslation();
  const { theme } = useAppStore();

  // 列加载回调需要调用 useDataTable 的 setColumns，通过 ref 桥接
  // （loadColumns 只在连接建立后触发，ref 已就绪）。
  const setColumnsRef = useRef<(columns: DataColumnInfo[]) => void>(() => undefined);
  const tableColumns = useTableColumns({
    database,
    tableName,
    onColumns: (cols) => setColumnsRef.current(cols),
  });

  const table = useDataTable({
    connectionProfile,
    database,
    objectName: tableName,
    loadColumns: tableColumns.loadTableColumns,
    submitTarget: () => tableName,
    resolvePrimaryKeys: async (_poolId, _connId, cols) => cols.filter((c) => c.isPrimaryKey).map((c) => c.name),
    messages: {
      connectFailed: (error) => t('tableDataTab.errors.connectionFailed', { error: error instanceof Error ? error.message : String(error) }),
      loadDataFailed: (error) => t('tableDataTab.errors.loadDataFailed', { error: error instanceof Error ? error.message : String(error) }),
      submitFailed: (error) => t('tableDataTab.errors.submitFailed', { error: error instanceof Error ? error.message : String(error) }),
      cannotDeterminePk: '无法更新：表没有主键',
      pkColumnNotFound: (name) => `主键列不存在: ${name}`,
    },
  });
  const {
    isLoading, error, setError, columns, allRows, totalRows,
    page, pageSize, totalPages, offset, selectedRowIndexes, editingCell, editValue, columnWidths,
    whereClauseInput, setWhereClauseInput, groupByClauseInput, setGroupByClauseInput,
    orderByClauseInput, setOrderByClauseInput, appliedFilters, contextMenu, getDirtyRows, hasChanges,
    fetchData, handleRefresh, handleResetFilters, handleApplyFilters, handleAddRow, handleDeleteRow,
    handleWithdraw, handleSubmitChanges, handleRowSelect, handleCellDoubleClick, handleCellEditComplete,
    handleKeyDown, handleResizeStart, handlePageChange, handlePageSizeChange,
    handleCellContextMenu, handleCopyCell, handleCopyRow, handleEditCell, handleCancelContextMenu,
    setEditValue,
  } = table;

  useEffect(() => {
    setColumnsRef.current = table.setColumns;
  }, [table.setColumns]);

  const exportState = useDataExport({
    connectionProfile,
    database,
    objectName: tableName,
    totalRows,
    pageSize,
    currentPageSql: buildCurrentPageSql(database, tableName, appliedFilters, offset, pageSize),
    labels: {
      saveTitle: (format) => t('tableDataTab.export.title', { format }),
      dialogTitle: t('tableDataTab.export.dialogTitle'),
      dialogMessage: (count) => t('tableDataTab.export.dialogMessage', { totalRows: count }),
      confirmText: t('tableDataTab.export.exportAll'),
      cancelText: t('tableDataTab.export.exportCurrent'),
    },
  });
  const {
    exportFormat, setExportFormat, isExportDialogOpen, setIsExportDialogOpen,
    handleExport, handleExportClick,
  } = exportState;
  const { handleImport } = useDataImport({
    connectionProfile,
    database,
    tableName,
    onImported: fetchData,
  });

  // 表页特有状态：预览对话框
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);

  const formatOptions: { value: ExportFormat; label: string }[] = [
    { value: 'csv', label: t('tableDataTab.format.csv') },
    { value: 'txt', label: t('tableDataTab.format.txt') },
    { value: 'json', label: t('tableDataTab.format.json') },
    { value: 'html', label: t('tableDataTab.format.html') },
    { value: 'xml', label: t('tableDataTab.format.xml') },
    { value: 'sql', label: t('tableDataTab.format.sql') },
    { value: 'xlsx', label: t('tableDataTab.format.xlsx') },
  ];

  return (
    <div className="flex h-full w-full min-h-0 flex-col overflow-hidden">
      <DataFilterBar
        whereClauseInput={whereClauseInput}
        onWhereChange={setWhereClauseInput}
        groupByClauseInput={groupByClauseInput}
        onGroupByChange={setGroupByClauseInput}
        orderByClauseInput={orderByClauseInput}
        onOrderByChange={setOrderByClauseInput}
        onReset={handleResetFilters}
        onApply={handleApplyFilters}
        disabled={isLoading}
        labels={{
          reset: t('tableDataTab.buttons.reset'),
          confirm: t('tableDataTab.buttons.confirm'),
        }}
      />

      <DataToolbar
        showImport
        isLoading={isLoading}
        hasChanges={hasChanges}
        dirtyCount={getDirtyRows().length}
        selectedCount={selectedRowIndexes.size}
        exportFormat={exportFormat}
        formatOptions={formatOptions}
        onExportFormatChange={setExportFormat}
        onRefresh={handleRefresh}
        onAddRow={handleAddRow}
        onDeleteRow={handleDeleteRow}
        onPreview={() => setIsPreviewDialogOpen(true)}
        onWithdraw={handleWithdraw}
        onSubmit={() => void handleSubmitChanges()}
        onImport={() => void handleImport(exportFormat)}
        onExport={handleExportClick}
        exportDisabled={isLoading || allRows.length === 0}
        labels={{
          refreshTip: t('tableDataTab.tooltips.refresh'),
          refresh: t('tableDataTab.buttons.refresh'),
          addRowTip: t('tableDataTab.tooltips.addRow'),
          addRow: t('tableDataTab.buttons.addRow'),
          deleteRowTip: t('tableDataTab.tooltips.deleteRow'),
          deleteRow: t('tableDataTab.buttons.deleteRow'),
          previewTip: t('tableDataTab.tooltips.preview'),
          preview: t('tableDataTab.buttons.preview'),
          withdrawTip: t('tableDataTab.tooltips.withdraw'),
          withdraw: t('tableDataTab.buttons.withdraw'),
          submitTip: t('tableDataTab.tooltips.submit'),
          submit: t('tableDataTab.buttons.submit'),
          changesIndicator: (count) => t('tableDataTab.changesPending', { count }),
          rowsSelected: (count) => t('tableDataTab.rowsSelected', { count }),
          importTip: t('tableDataTab.tooltips.import'),
          import: t('tableDataTab.buttons.import'),
          exportTip: t('tableDataTab.tooltips.export'),
          export: t('tableDataTab.buttons.export'),
        }}
      />

      {error && (
        <div className={cn(
          'flex flex-shrink-0 items-center justify-between border-b px-3 py-2 text-[13px]',
          theme === 'dark'
            ? 'border-b-[rgba(220,53,69,0.3)] bg-[rgba(220,53,69,0.1)] text-[#f8d7da]'
            : 'border-b-[#feb2b2] bg-[#fff5f5] text-[#dc3545]',
        )}>
          <span>{error}</span>
          <Button small minimal onClick={() => setError(null)}>
            ✕
          </Button>
        </div>
      )}

      <DataGrid
        columns={columns}
        columnWidths={columnWidths}
        allRows={allRows}
        offset={offset}
        selectedRowIndexes={selectedRowIndexes}
        isLoading={isLoading}
        editingCell={editingCell}
        editValue={editValue}
        onEditValueChange={setEditValue}
        contextMenu={contextMenu}
        onRowSelect={handleRowSelect}
        onCellDoubleClick={handleCellDoubleClick}
        onCellEditComplete={handleCellEditComplete}
        onKeyDown={handleKeyDown}
        onResizeStart={handleResizeStart}
        onCellContextMenu={handleCellContextMenu}
        onCopyCell={handleCopyCell}
        onCopyRow={handleCopyRow}
        onEditCell={handleEditCell}
        onCancelContextMenu={handleCancelContextMenu}
        labels={{
          loading: t('tableDataTab.loading'),
          copy: t('tableDataTab.contextMenu.copy'),
          copyRow: t('tableDataTab.contextMenu.copyRow'),
          edit: t('tableDataTab.contextMenu.edit'),
          cancel: t('tableDataTab.contextMenu.cancel'),
        }}
      />

      <DataPagination
        page={page}
        pageSize={pageSize}
        totalRows={totalRows}
        totalPages={totalPages}
        offset={offset}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        labels={{
          showingRows: (start, end, total) => t('tableDataTab.pagination.showingRows', { start, end, total }),
          pageSize: t('tableDataTab.pagination.pageSize'),
          pageInfo: (current, total) => t('tableDataTab.pagination.pageInfo', { page: current, totalPages: total }),
        }}
      />

      <PreviewCommitDialog
        isOpen={isPreviewDialogOpen}
        onClose={() => setIsPreviewDialogOpen(false)}
        connectionProfile={connectionProfile}
        database={database}
        tableName={tableName}
        columns={columns}
        changedRows={getDirtyRows()}
        primaryKeys={columns.filter(col => col.isPrimaryKey).map(col => col.name)}
      />

      <ConfirmDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        onConfirm={() => handleExport(true)}
        onCancel={() => handleExport(false)}
        title={t('tableDataTab.export.dialogTitle')}
        message={t('tableDataTab.export.dialogMessage', { totalRows })}
        confirmText={t('tableDataTab.export.exportAll')}
        cancelText={t('tableDataTab.export.exportCurrent')}
        intent="primary"
      />
    </div>
  );
};

