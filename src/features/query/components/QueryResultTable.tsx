// 查询结果表格视图：排序、列宽调整、虚拟滚动、服务端分页、右键复制。
// 从 ResultPanel 拆分而来（行为与拆分前一致）。

import React from 'react';
import { Button } from '@blueprintjs/core';
import { useTranslation } from 'react-i18next';
import type { QueryResultData } from '@/types';
import { useAppStore } from '@/stores';
import { cn } from '@/lib/cn';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import {
  ColumnResizeHandle,
  copyTextToClipboard,
  formatCellValue,
} from './resultViewShared';

interface ResultContextMenuState {
  x: number;
  y: number;
  cellText: string;
  rowText: string;
}

export const QueryResultTable: React.FC<{
  data: QueryResultData;
  onRequestPage?: (page: number, pageSize: number) => void | Promise<void>;
}> = ({ data, onRequestPage }) => {
  const { t } = useTranslation();
  const { theme } = useAppStore();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [selectedRowIndex, setSelectedRowIndex] = React.useState<number | null>(null);
  const [contextMenu, setContextMenu] = React.useState<ResultContextMenuState | null>(null);
  const [columnWidths, setColumnWidths] = React.useState<Record<string, number>>({});
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewportHeight, setViewportHeight] = React.useState(420);
  const VIRTUAL_ROW_HEIGHT = 30;
  const VIRTUAL_OVERSCAN = 12;
  const serverPaginationData = data.pagination;
  const serverPagination = Boolean(serverPaginationData);
  const serverOffset = serverPaginationData
    ? (serverPaginationData.page - 1) * serverPaginationData.pageSize
    : 0;

  const columns: ColumnDef<unknown[], string>[] = React.useMemo(() => {
    const sourceColumns = data.columns.length > 0
      ? data.columns
      : [{ name: '__empty__', label: t('resultPanel.result'), typeName: '' }];

    const rowNumberColumn: ColumnDef<unknown[], string> = {
      id: '__rownum',
      header: '#',
      accessorFn: (_row, index) => String(index + 1 + serverOffset),
      enableSorting: false,
      cell: (info) => String(info.row.index + 1 + serverOffset),
    };

    const dataColumns = sourceColumns.map((col, index) => ({
      id: col.name,
      header: col.label,
      accessorFn: (row: unknown[]) => row[index],
      enableSorting: true,
      cell: (info: { getValue: () => unknown }) => {
        const value = info.getValue();
        return value === null || value === undefined ? '' : String(value);
      },
    }));

    return [rowNumberColumn, ...dataColumns];
  }, [data.columns, t, serverOffset]);

  const table = useReactTable({
    data: data.rows,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const visibleRows = table.getRowModel().rows;
  const virtualEnabled = !serverPagination && visibleRows.length > 200;

  React.useEffect(() => {
    if (!virtualEnabled) {
      return;
    }

    const el = wrapperRef.current;
    if (!el) {
      return;
    }

    const applyHeight = () => {
      setViewportHeight(el.clientHeight || 420);
    };

    applyHeight();
    const observer = new ResizeObserver(applyHeight);
    observer.observe(el);

    return () => observer.disconnect();
  }, [virtualEnabled]);

  const virtualRange = React.useMemo(() => {
    if (!virtualEnabled) {
      return {
        start: 0,
        end: visibleRows.length,
        topPadding: 0,
        bottomPadding: 0,
      };
    }

    const start = Math.max(0, Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - VIRTUAL_OVERSCAN);
    const count = Math.ceil(viewportHeight / VIRTUAL_ROW_HEIGHT) + VIRTUAL_OVERSCAN * 2;
    const end = Math.min(visibleRows.length, start + count);
    const topPadding = start * VIRTUAL_ROW_HEIGHT;
    const bottomPadding = Math.max(0, (visibleRows.length - end) * VIRTUAL_ROW_HEIGHT);

    return {
      start,
      end,
      topPadding,
      bottomPadding,
    };
  }, [virtualEnabled, visibleRows.length, scrollTop, viewportHeight]);

  const renderedRows = React.useMemo(
    () => visibleRows.slice(virtualRange.start, virtualRange.end),
    [visibleRows, virtualRange.start, virtualRange.end],
  );

  const handleServerPageChange = React.useCallback((page: number, pageSize?: number) => {
    if (!serverPaginationData || !onRequestPage) return;
    void onRequestPage(page, pageSize ?? serverPaginationData.pageSize);
  }, [serverPaginationData, onRequestPage]);

  const handleServerPageSizeChange = React.useCallback((newSize: number) => {
    if (!serverPaginationData || !onRequestPage) return;
    void onRequestPage(1, newSize);
  }, [serverPaginationData, onRequestPage]);

  React.useEffect(() => {
    if (!contextMenu) return;

    const handleGlobalClick = () => setContextMenu(null);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('contextmenu', handleGlobalClick);
    window.addEventListener('scroll', handleGlobalClick, true);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('contextmenu', handleGlobalClick);
      window.removeEventListener('scroll', handleGlobalClick, true);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu]);

  const handleCellContextMenu = (
    event: React.MouseEvent<HTMLTableCellElement>,
    rowValues: unknown[],
    cellValue: unknown,
    rowIndex: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedRowIndex(rowIndex);

    const cellText = formatCellValue(cellValue);
    const rowText = rowValues.map((value) => formatCellValue(value)).join('\t');

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      cellText,
      rowText,
    });
  };

  const handleCopyCell = async () => {
    if (!contextMenu) return;
    await copyTextToClipboard(contextMenu.cellText);
    setContextMenu(null);
  };

  const handleCopyRow = async () => {
    if (!contextMenu) return;
    await copyTextToClipboard(contextMenu.rowText);
    setContextMenu(null);
  };

  const handleColumnResize = (columnId: string, delta: number) => {
    setColumnWidths((prev) => {
      const currentWidth = prev[columnId] || getDefaultColumnWidth(columnId);
      const newWidth = Math.max(60, currentWidth + delta);
      return { ...prev, [columnId]: newWidth };
    });
  };

  const getDefaultColumnWidth = (columnId: string): number => {
    if (columnId === '__rownum') return 44;
    const column = data.columns.find((col) => col.name === columnId);
    if (column) {
      return Math.max(120, (column.label || column.name).length * 10 + 28);
    }
    return 120;
  };

  const getColumnWidth = (columnId: string): number => {
    return columnWidths[columnId] || getDefaultColumnWidth(columnId);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div
        ref={wrapperRef}
        className={cn(
          'result-table-wrapper relative h-full min-h-0 flex-1 overflow-auto rounded border bg-white [scrollbar-gutter:stable_both-edges]',
          theme === 'dark' ? 'border-[#374151] bg-[#111827]' : 'border-[#e1e5e9]',
        )}
        onScroll={(event) => setScrollTop((event.currentTarget as HTMLDivElement).scrollTop)}
      >
        <table className="w-max min-w-full border-collapse font-['Microsoft_YaHei','Segoe_UI',sans-serif] text-[13px]">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{
                      width: getColumnWidth(header.column.id),
                      minWidth: getColumnWidth(header.column.id),
                    }}
                    className={cn(
                      'relative overflow-hidden !p-0 sticky top-0 z-[1] select-none border-b font-medium',
                      theme === 'dark' ? 'border-[#374151] bg-[#1f2937] text-[#f3f4f6]' : 'border-[#e1e5e9] bg-[#f8f9fa] text-[#495057]',
                      header.column.id === '__rownum' && 'w-[44px] min-w-[44px] max-w-[44px] px-0',
                      header.column.getCanSort() && 'cursor-pointer',
                    )}
                  >
                    <div
                      className="mr-2.5 flex flex-1 cursor-pointer items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap px-3 py-2 hover:bg-[rgba(0,0,0,0.04)]"
                      onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <span className="overflow-hidden text-ellipsis">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                      {header.column.getCanSort() && (
                        <span className={cn('ml-0.5 shrink-0 text-[11px]', theme === 'dark' ? 'text-[#9ca3af]' : 'text-[#7a838c]')} aria-hidden="true">
                          {header.column.getIsSorted() === 'asc'
                            ? '▲'
                            : header.column.getIsSorted() === 'desc'
                              ? '▼'
                              : '↕'}
                        </span>
                      )}
                    </div>
                    {header.column.id !== '__rownum' && (
                      <ColumnResizeHandle
                        onResize={(delta) => handleColumnResize(header.column.id, delta)}
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={table.getAllColumns().length} className={cn('!px-3 !py-[26px] text-center', theme === 'dark' ? 'text-[#9ca3af]' : 'text-[#7a838c]')}>
                  {t('resultPanel.noData')}
                </td>
              </tr>
            ) : (
              <>
                {virtualRange.topPadding > 0 && (
                  <tr>
                    <td colSpan={table.getAllColumns().length} style={{ height: `${virtualRange.topPadding}px`, padding: 0, border: 'none' }} />
                  </tr>
                )}
                {renderedRows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      'transition-colors duration-100',
                      selectedRowIndex === row.index
                        ? theme === 'dark'
                          ? 'bg-[#1d4ed8]'
                          : 'bg-[#e3f2fd]'
                        : theme === 'dark'
                          ? 'bg-[#111827] text-[#f3f4f6] hover:bg-[#374151]'
                          : 'bg-white text-[#495057] hover:bg-[#f8f9fa]',
                    )}
                    onClick={() => setSelectedRowIndex(row.index)}
                    style={virtualEnabled ? { height: `${VIRTUAL_ROW_HEIGHT}px` } : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        onContextMenu={(event) => handleCellContextMenu(event, row.original, cell.getValue(), row.index)}
                        className={cn(
                          'max-w-[360px] whitespace-nowrap border-b px-3 py-2 text-center',
                          theme === 'dark' ? 'border-[#374151] text-[#f3f4f6]' : 'border-[#f1f3f4] text-[#495057]',
                          cell.column.id === '__rownum' && 'w-[44px] min-w-[44px] max-w-[44px] px-0',
                          selectedRowIndex === row.index && (theme === 'dark' ? 'text-white' : 'text-[#1976d2]'),
                        )}
                      >
                        <div
                          className={cn(
                            'inline-block max-w-[320px] overflow-hidden text-ellipsis whitespace-nowrap align-middle',
                            theme === 'dark' ? 'text-[#f3f4f6]' : 'text-[#495057]',
                            cell.column.id === '__rownum' && 'max-w-[44px] tabular-nums',
                          )}
                          title={formatCellValue(cell.getValue())}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
                {virtualRange.bottomPadding > 0 && (
                  <tr>
                    <td colSpan={table.getAllColumns().length} style={{ height: `${virtualRange.bottomPadding}px`, padding: 0, border: 'none' }} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>

        {contextMenu && (
          <div
            className={cn(
              'fixed z-[9999] min-w-[120px] rounded border p-1 shadow-[0_6px_18px_rgba(0,0,0,0.16)]',
              theme === 'dark' ? 'border-[#374151] bg-[#1f2937]' : 'border-[#d6d8db] bg-white',
            )}
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <button className={cn(
              'w-full cursor-pointer rounded-[3px] border-none bg-transparent px-2.5 py-1.5 text-left text-xs',
              theme === 'dark' ? 'text-[#e5e7eb] hover:bg-[#374151]' : 'text-[#2f3b4a] hover:bg-[#eef3fb]',
            )} onClick={handleCopyCell}>
              {t('resultPanel.copy')}
            </button>
            <button className={cn(
              'w-full cursor-pointer rounded-[3px] border-none bg-transparent px-2.5 py-1.5 text-left text-xs',
              theme === 'dark' ? 'text-[#e5e7eb] hover:bg-[#374151]' : 'text-[#2f3b4a] hover:bg-[#eef3fb]',
            )} onClick={handleCopyRow}>
              {t('resultPanel.copyRow')}
            </button>
          </div>
        )}
      </div>
      {/* Pagination */}
      <div className={cn(
        'flex flex-shrink-0 items-center justify-between border-t bg-[#f8f9fa] px-3 py-2',
        theme === 'dark' ? 'border-[#374151] bg-[#1f2937]' : 'border-[#e1e5e9]',
      )}>
        <div className={cn('text-xs', theme === 'dark' ? 'text-[#e5e7eb]' : 'text-[#6c757d]')}>
          {!serverPagination && t('resultPanel.showingRows', { shown: visibleRows.length, total: data.rows.length })}
          {serverPagination && t('resultPanel.showingRows', {
            shown: data.rows.length,
            total: data.pagination?.totalRows ?? (data.pagination?.hasMore ? `${data.rows.length}+` : `${data.rows.length}`),
          })}
        </div>
        <div className="flex items-center gap-1">
          {!serverPagination && (
            <>
              <span className={cn('px-2 text-xs', theme === 'dark' ? 'text-[#e5e7eb]' : 'text-[#495057]')}>
                {virtualEnabled ? 'Virtual Scroll' : 'Client Mode'}
              </span>
            </>
          )}
          {serverPagination && serverPaginationData && (
            <>
              <span className={cn('text-xs', theme === 'dark' ? 'text-[#e5e7eb]' : 'text-[#6c757d]')}>{t('resultPanel.pageSize')}</span>
              <select
                className="pagination-page-size-select"
                value={serverPaginationData.pageSize}
                onChange={(event) => handleServerPageSizeChange(Number(event.target.value))}
              >
                {[100, 200, 500, 1000].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
              <Button
                small
                minimal
                disabled={serverPaginationData.page <= 1}
                onClick={() => handleServerPageChange(1)}
              >
                {'<<'}
              </Button>
              <Button
                small
                minimal
                disabled={serverPaginationData.page <= 1}
                onClick={() => handleServerPageChange(serverPaginationData.page - 1)}
              >
                {'<'}
              </Button>
              <span className={cn('px-2 text-xs', theme === 'dark' ? 'text-[#e5e7eb]' : 'text-[#495057]')}>
                {t('resultPanel.page', {
                  current: serverPaginationData.page,
                  total: serverPaginationData.totalPages ?? '?',
                })}
              </span>
              <Button
                small
                minimal
                disabled={!serverPaginationData.hasMore}
                onClick={() => handleServerPageChange(serverPaginationData.page + 1)}
              >
                {'>'}
              </Button>
              <Button
                small
                minimal
                disabled={!serverPaginationData.totalPages || serverPaginationData.page >= serverPaginationData.totalPages}
                onClick={() => {
                  if (serverPaginationData.totalPages) {
                    handleServerPageChange(serverPaginationData.totalPages);
                  }
                }}
              >
                {'>>'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

