// 数据浏览共享数据网格：表头（列宽拖拽/PK 标记/类型）、行渲染、
// 单元格编辑输入框、行选择、右键菜单。行为与拆分前的 Table/View Tab 一致。

import React from 'react';
import { InputGroup, Spinner } from '@blueprintjs/core';
import { useAppStore } from '@/stores';
import { cn } from '@/lib/cn';
import { RowState, type DataColumnInfo, type DataContextMenuState, type DataRow } from '../types';
import { formatCellValue } from '../utils';

interface DataGridLabels {
  loading: string;
  copy: string;
  copyRow: string;
  edit: string;
  cancel: string;
}

interface DataGridProps {
  columns: DataColumnInfo[];
  columnWidths: Record<string, number>;
  allRows: DataRow[];
  offset: number;
  selectedRowIndexes: Set<number>;
  isLoading: boolean;
  /** 视图只读时禁止双击编辑/行选择/编辑菜单项 */
  readOnly?: boolean;
  /** 视图右键菜单在“编辑”后多一条分隔线（与 V1 行为一致） */
  showEditTrailingDivider?: boolean;
  editingCell: { rowIndex: number; colIndex: number } | null;
  editValue: string;
  onEditValueChange: (value: string) => void;
  contextMenu: DataContextMenuState | null;
  onRowSelect: (rowIndex: number, event: React.MouseEvent) => void;
  onCellDoubleClick: (rowIndex: number, colIndex: number) => void;
  onCellEditComplete: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  onResizeStart: (colName: string, event: React.MouseEvent, thElement: HTMLTableCellElement) => void;
  onCellContextMenu: (
    event: React.MouseEvent<HTMLTableCellElement>,
    rowIndex: number,
    colIndex: number,
    row: DataRow,
  ) => void;
  onCopyCell: () => void;
  onCopyRow: () => void;
  onEditCell: () => void;
  onCancelContextMenu: () => void;
  labels: DataGridLabels;
}

export const DataGrid: React.FC<DataGridProps> = ({
  columns,
  columnWidths,
  allRows,
  offset,
  selectedRowIndexes,
  isLoading,
  readOnly = false,
  showEditTrailingDivider = false,
  editingCell,
  editValue,
  onEditValueChange,
  contextMenu,
  onRowSelect,
  onCellDoubleClick,
  onCellEditComplete,
  onKeyDown,
  onResizeStart,
  onCellContextMenu,
  onCopyCell,
  onCopyRow,
  onEditCell,
  onCancelContextMenu,
  labels,
}) => {
  const { theme } = useAppStore();

  const renderCell = (rowIndex: number, colIndex: number, row: DataRow) => {
    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex;
    const displayValue = row.currentData[colIndex];

    if (isEditing) {
      return (
        <InputGroup
          small
          autoFocus
          value={editValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onCellEditComplete}
          className="min-w-[100px] max-w-[280px]"
        />
      );
    }

    const isModified = row.state === RowState.MODIFIED && row.originalData[colIndex] !== row.currentData[colIndex];

    return (
      <div
        className={cn(
          'inline-block max-w-[320px] overflow-hidden text-ellipsis whitespace-nowrap rounded-[3px] px-1 py-0.5 align-middle transition-colors duration-100 hover:bg-[rgba(66,153,255,0.1)]',
          theme === 'dark' ? 'text-[#f3f4f6]' : 'text-[#495057]',
          isModified && 'bg-[rgba(255,193,7,0.2)]',
          displayValue === null && 'italic',
          displayValue === null && (theme === 'dark' ? 'text-[#9ca3af]' : 'text-[#8a94a1]'),
        )}
        title={formatCellValue(displayValue)}
        onDoubleClick={readOnly ? undefined : () => onCellDoubleClick(rowIndex, colIndex)}
      >
        {formatCellValue(displayValue)}
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {isLoading && !allRows.length ? (
        <div className={cn('flex h-full flex-col items-center justify-center gap-3', theme === 'dark' ? 'text-[#abb3bf]' : 'text-[#5f6b7c]')}>
          <Spinner size={32} />
          <span>{labels.loading}</span>
        </div>
      ) : (
        <div className={cn(
          'table-data-wrapper m-2 min-h-0 flex-1 overflow-auto rounded border bg-white [scrollbar-gutter:stable_both-edges]',
          theme === 'dark' ? 'border-[#374151] bg-[#111827]' : 'border-[#e1e5e9]',
        )}>
          <table className="w-max min-w-full border-collapse font-['Microsoft_YaHei','Segoe_UI',sans-serif] text-[13px]">
            <thead>
              <tr>
                <th className={cn(
                  'w-[44px] min-w-[44px] max-w-[44px] border-b px-0 py-2 text-center align-top font-medium select-none sticky top-0 z-[1]',
                  theme === 'dark' ? 'border-[#374151] bg-[#1f2937] text-[#9ca3af]' : 'border-[#e1e5e9] bg-[#f8f9fa] text-[#8a94a1]',
                )}>#</th>
                {columns.map((col, colIndex) => (
                  <th
                    key={col.name}
                    ref={(el) => {
                      if (el) {
                        el.dataset.colName = col.name;
                      }
                    }}
                    style={{ width: columnWidths[col.name] || 'auto', minWidth: columnWidths[col.name] || 120 }}
                    className={cn(
                      'relative min-w-[80px] max-w-[360px] whitespace-nowrap border-b px-3 py-2 text-left align-top font-medium select-none sticky top-0 z-[1]',
                      theme === 'dark' ? 'border-[#374151] bg-[#1f2937] text-[#f3f4f6]' : 'border-[#e1e5e9] bg-[#f8f9fa] text-[#495057]',
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.name}</span>
                      {col.isPrimaryKey && <span className="rounded-[3px] bg-[#4299FF] px-1 py-px text-[10px] font-semibold text-white">PK</span>}
                    </div>
                    <div className={cn('mt-0.5 text-[11px] font-normal', theme === 'dark' ? 'text-[#9ca3af]' : 'text-[#8a94a1]')}>{col.typeName}</div>
                    <div
                      className={cn(
                        'absolute top-0 bottom-0 z-10 cursor-col-resize bg-transparent transition-colors duration-150',
                        theme === 'dark' ? 'hover:bg-[#60a5fa]' : 'hover:bg-[#4299FF]',
                      )}
                      style={{ right: colIndex === columns.length - 1 ? '-10px' : 0, width: colIndex === columns.length - 1 ? 20 : 10 }}
                      onMouseDown={(e) => {
                        const thElement = e.currentTarget.parentElement as HTMLTableCellElement;
                        onResizeStart(col.name, e, thElement);
                      }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allRows.map((row, rowIndex) => {
                if (row.state === RowState.DELETED) return null;

                return (
                  <tr
                    key={`row-${rowIndex}`}
                    className={cn(
                    'cursor-pointer transition-colors duration-100',
                      selectedRowIndexes.has(rowIndex)
                        ? theme === 'dark'
                          ? 'bg-[#1d4ed8]'
                          : 'bg-[#e3f2fd]'
                        : theme === 'dark'
                          ? cn(
                              'bg-[#111827] text-[#f3f4f6] hover:bg-[#1f2937]',
                              row.state === RowState.NEW && 'bg-[rgba(40,167,69,0.1)]',
                              row.state === RowState.MODIFIED && 'bg-[rgba(255,193,7,0.1)]',
                            )
                          : cn(
                              'bg-white text-[#495057] hover:bg-[#f8f9fa]',
                              row.state === RowState.NEW && 'bg-[#e8f5e9]',
                              row.state === RowState.MODIFIED && 'bg-[#fff8e1]',
                            ),
                    )}
                    onClick={(e) => !readOnly && onRowSelect(rowIndex, e)}
                  >
                    <td className={cn(
                      'w-[44px] min-w-[44px] max-w-[44px] border-b px-0 py-2 text-center whitespace-nowrap',
                      theme === 'dark' ? 'border-[#374151] bg-[#1f2937] text-[#9ca3af]' : 'border-[#f1f3f4] bg-[#f8f9fa] text-[#8a94a1]',
                      selectedRowIndexes.has(rowIndex) && (theme === 'dark' ? 'text-white' : 'text-[#1976d2]'),
                    )}>
                      {row.state === RowState.NEW ? '*' : offset + rowIndex + 1}
                    </td>
                    {row.currentData.map((_, colIndex) => (
                      <td
                        key={`cell-${rowIndex}-${colIndex}`}
                        className={cn(
                          'max-w-[360px] whitespace-nowrap border-b px-3 py-2 text-left',
                          theme === 'dark' ? 'border-[#374151] text-[#f3f4f6]' : 'border-[#f1f3f4] text-[#495057]',
                          selectedRowIndexes.has(rowIndex) && (theme === 'dark' ? 'text-white' : 'text-[#1976d2]'),
                        )}
                        onContextMenu={(e) => onCellContextMenu(e, rowIndex, colIndex, row)}
                      >
                        {renderCell(rowIndex, colIndex, row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* 右键菜单 */}
          {contextMenu && (
            <div
              className={cn(
                'fixed z-[9999] min-w-[120px] rounded border p-1 shadow-[0_6px_18px_rgba(0,0,0,0.16)]',
                theme === 'dark' ? 'border-[#495057] bg-[#2d3436]' : 'border-[#d6d8db] bg-white',
              )}
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(event) => event.stopPropagation()}
            >
              <button className={cn(
                'w-full cursor-pointer rounded-[3px] border-none bg-transparent px-2.5 py-1.5 text-left text-xs',
                theme === 'dark' ? 'text-[#e9ecef] hover:bg-[#495057]' : 'text-[#2f3b4a] hover:bg-[#eef3fb]',
              )} onClick={onCopyCell}>
                {labels.copy}
              </button>
              <button className={cn(
                'w-full cursor-pointer rounded-[3px] border-none bg-transparent px-2.5 py-1.5 text-left text-xs',
                theme === 'dark' ? 'text-[#e9ecef] hover:bg-[#495057]' : 'text-[#2f3b4a] hover:bg-[#eef3fb]',
              )} onClick={onCopyRow}>
                {labels.copyRow}
              </button>
              {!readOnly && (
                <>
                  <div className={cn('my-1 h-px', theme === 'dark' ? 'bg-[#495057]' : 'bg-[#e1e5e9]')} />
                  <button className={cn(
                    'w-full cursor-pointer rounded-[3px] border-none bg-transparent px-2.5 py-1.5 text-left text-xs',
                    theme === 'dark' ? 'text-[#e9ecef] hover:bg-[#495057]' : 'text-[#2f3b4a] hover:bg-[#eef3fb]',
                  )} onClick={onEditCell}>
                    {labels.edit}
                  </button>
                  {showEditTrailingDivider && <div className={cn('my-1 h-px', theme === 'dark' ? 'bg-[#495057]' : 'bg-[#e1e5e9]')} />}
                </>
              )}
              {readOnly && <div className={cn('my-1 h-px', theme === 'dark' ? 'bg-[#495057]' : 'bg-[#e1e5e9]')} />}
              <button className={cn(
                'w-full cursor-pointer rounded-[3px] border-none bg-transparent px-2.5 py-1.5 text-left text-xs',
                theme === 'dark' ? 'text-[#e9ecef] hover:bg-[#495057]' : 'text-[#2f3b4a] hover:bg-[#eef3fb]',
              )} onClick={onCancelContextMenu}>
                {labels.cancel}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

