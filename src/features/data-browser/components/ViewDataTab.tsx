// 视图数据页：容器组件。视图特有的可更新性检查/列映射/基表主键解析收敛到
// useViewColumns，共享状态机在 useDataTable，共享导出在 useDataExport，
// 渲染由 DataFilterBar/DataToolbar/DataGrid/DataPagination 拼装。

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@blueprintjs/core';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/stores';
import type { ConnectionProfile, ExportFormat } from '@/types';
import { ViewPreviewCommitDialog, ConfirmDialog } from '@/features/dialogs';
import { cn } from '@/lib/cn';

import { useDataTable } from '../useDataTable';
import { useDataExport } from '../useDataExport';
import { useViewColumns } from '../useViewColumns';
import type { DataColumnInfo } from '../types';
import { buildCurrentPageSql } from '../utils';
import { DataFilterBar } from './DataFilterBar';
import { DataToolbar } from './DataToolbar';
import { DataGrid } from './DataGrid';
import { DataPagination } from './DataPagination';

interface ViewDataTabProps {
  tabId: string;
  connectionProfile: ConnectionProfile;
  database: string;
  viewName: string;
}

export const ViewDataTab: React.FC<ViewDataTabProps> = ({
  connectionProfile,
  database,
  viewName,
}) => {
  const { t } = useTranslation();
  const { theme } = useAppStore();

  // useViewColumns 的列映射回调需要调用 useDataTable 的 setColumns，
  // 通过 ref 桥接（loadColumns 只在连接建立后触发，ref 已就绪）。
  const setColumnsRef = useRef<(columns: DataColumnInfo[]) => void>(() => undefined);
  const viewColumns = useViewColumns({
    database,
    viewName,
    onColumns: (cols) => setColumnsRef.current(cols),
  });
  const { readOnly, baseTableName, loadViewColumns, getBaseTablePrimaryKeys } = viewColumns;

  const table = useDataTable({
    connectionProfile,
    database,
    objectName: viewName,
    loadColumns: async (poolId, connId) => {
      await loadViewColumns(poolId, connId);
    },
    submitTarget: () => baseTableName,
    resolvePrimaryKeys: async (poolId, connId) => getBaseTablePrimaryKeys(poolId, connId),
    messages: {
      connectFailed: (error) => t('viewTab.data.errors.connectFailed', { error: error instanceof Error ? error.message : String(error) }),
      loadDataFailed: (error) => t('viewTab.data.errors.loadDataFailed', { error: error instanceof Error ? error.message : String(error) }),
      submitFailed: (error) => t('viewTab.data.errors.submitFailed', { error: error instanceof Error ? error.message : String(error) }),
      cannotDeterminePk: t('viewTab.data.errors.cannotDeterminePk'),
      pkColumnNotFound: (name) => t('viewTab.data.errors.pkColumnNotFound', { name }),
    },
  });

  useEffect(() => {
    setColumnsRef.current = table.setColumns;
  }, [table.setColumns]);

  const {
    isLoading, error, setError, columns, allRows, totalRows,
    page, pageSize, totalPages, offset, selectedRowIndexes, editingCell, editValue, columnWidths,
    whereClauseInput, setWhereClauseInput, groupByClauseInput, setGroupByClauseInput,
    orderByClauseInput, setOrderByClauseInput, appliedFilters, contextMenu, getDirtyRows, hasChanges,
    handleRefresh, handleResetFilters, handleApplyFilters, handleAddRow, handleDeleteRow,
    handleWithdraw, handleSubmitChanges, handleRowSelect, handleCellDoubleClick, handleCellEditComplete,
    handleKeyDown, handleResizeStart, handlePageChange, handlePageSizeChange,
    handleCellContextMenu, handleCopyCell, handleCopyRow, handleEditCell, handleCancelContextMenu,
    setEditValue,
  } = table;

  const exportState = useDataExport({
    connectionProfile,
    database,
    objectName: viewName,
    totalRows,
    pageSize,
    currentPageSql: buildCurrentPageSql(database, viewName, appliedFilters, offset, pageSize),
    labels: {
      saveTitle: (format) => t('viewTab.data.export.title', { format }),
      dialogTitle: t('viewTab.data.export.dialogTitle'),
      dialogMessage: (count) => t('viewTab.data.export.dialogMessage', { totalRows: count }),
      confirmText: t('viewTab.data.export.exportAll'),
      cancelText: t('viewTab.data.export.exportCurrent'),
    },
  });
  const {
    exportFormat, setExportFormat, isExportDialogOpen, setIsExportDialogOpen,
    handleExport, handleExportClick,
  } = exportState;

  // 视图页特有状态：预览对话框
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
          reset: t('viewTab.data.buttons.reset'),
          confirm: t('viewTab.data.buttons.confirm'),
        }}
      />

      <DataToolbar
        readOnly={readOnly}
        showImport={false}
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
        onImport={() => undefined}
        onExport={handleExportClick}
        exportDisabled={isLoading || allRows.length === 0}
        infoSlot={
          <span className={cn('text-xs', theme === 'dark' ? 'text-[#abb3bf]' : 'text-[#5f6b7c]')}>
            {t('viewTab.data.title')}
          </span>
        }
        labels={{
          refreshTip: t('viewTab.data.tooltips.refresh'),
          refresh: t('viewTab.data.toolbar.refresh'),
          addRowTip: t('viewTab.data.tooltips.addRow'),
          addRow: t('viewTab.data.toolbar.addRow'),
          deleteRowTip: t('viewTab.data.tooltips.deleteRow'),
          deleteRow: t('viewTab.data.toolbar.deleteRow'),
          previewTip: t('viewTab.data.tooltips.preview'),
          preview: t('viewTab.data.toolbar.preview'),
          withdrawTip: t('viewTab.data.tooltips.withdraw'),
          withdraw: t('viewTab.data.toolbar.withdraw'),
          submitTip: t('viewTab.data.tooltips.submit'),
          submit: t('viewTab.data.toolbar.submit'),
          changesIndicator: (count) => (
            <>
              {count} {t('viewTab.data.toolbar.changesPending')}
            </>
          ),
          rowsSelected: (count) => t('viewTab.data.toolbar.rowsSelected', { count }),
          exportTip: t('tableDataTab.tooltips.export'),
          export: t('tableDataTab.buttons.export'),
        }}
      />

      {readOnly && (
        <div className={cn(
          'flex flex-shrink-0 items-start gap-2.5 border-b px-3.5 py-2.5',
          theme === 'dark'
            ? 'border-b-[rgba(251,191,36,0.3)] bg-[rgba(251,191,36,0.1)]'
            : 'border-b-[#fcd34d] bg-[#fffbeb]',
        )}>
          <div className={cn('mt-px shrink-0', theme === 'dark' ? 'text-[#fbbf24]' : 'text-[#d97706]')}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="flex flex-col gap-0.5 text-[13px] leading-[1.4]">
            <strong className={cn('font-semibold', theme === 'dark' ? 'text-[#fcd34d]' : 'text-[#92400e]')}>{t('viewTab.data.readOnly.title')}</strong>
            <span className={cn(theme === 'dark' ? 'text-[#a8a29e]' : 'text-[#78716c]')}>{t('viewTab.data.readOnly.description')}</span>
          </div>
        </div>
      )}

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
        readOnly={readOnly}
        showEditTrailingDivider
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
          loading: t('viewTab.data.loading'),
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
          showingRows: (start, end, total) => t('viewTab.data.pagination.showing', { start, end, total }),
          pageSize: `${t('viewTab.data.pagination.pageSize')}:`,
          pageInfo: (current, total) => `第 ${current} / ${total} 页`,
        }}
      />

      {!readOnly && (
        <ViewPreviewCommitDialog
          isOpen={isPreviewDialogOpen}
          onClose={() => setIsPreviewDialogOpen(false)}
          connectionProfile={connectionProfile}
          database={database}
          viewName={viewName}
          baseTableName={baseTableName || viewName}
          columns={columns}
          changedRows={getDirtyRows()}
          primaryKeys={columns.filter(col => col.isPrimaryKey).map(col => col.name)}
        />
      )}

      <ConfirmDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        onConfirm={() => handleExport(true)}
        onCancel={() => handleExport(false)}
        title={t('viewTab.data.export.dialogTitle')}
        message={t('viewTab.data.export.dialogMessage', { totalRows })}
        confirmText={t('viewTab.data.export.exportAll')}
        cancelText={t('viewTab.data.export.exportCurrent')}
        intent="primary"
      />
    </div>
  );
};

