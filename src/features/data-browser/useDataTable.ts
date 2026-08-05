// 数据浏览共享状态机：连接、分页取数、行状态（新增/删除/修改/撤销/提交）、
// 单元格编辑、行选择、列宽、筛选、右键菜单。
// TableDataTab / ViewDataTab 通过选项注入差异点（列加载、DML 目标表、
// 主键解析、错误文案），本模块保持与拆分前逐行一致的行为。

import { useState, useCallback, useEffect, useRef } from 'react';
import { poolApi } from '@/api/pool';
import { queryApi } from '@/api/query';
import type { ConnectionProfile, ColumnMeta } from '@/types';
import {
  RowState,
  type DataColumnInfo,
  type DataContextMenuState,
  type DataRow,
} from './types';
import { copyTextToClipboard, escapeIdentifier, escapeSqlValue, formatCellValue } from './utils';

interface UseDataTableMessages {
  connectFailed: (error: unknown) => string;
  loadDataFailed: (error: unknown) => string;
  submitFailed: (error: unknown) => string;
  cannotDeterminePk: string;
  pkColumnNotFound: (name: string) => string;
}

interface UseDataTableOptions {
  connectionProfile: ConnectionProfile;
  database: string;
  /** 表/视图名（用于 COUNT / SELECT *） */
  objectName: string;
  /** 连接建立后加载列元数据（表/视图实现不同） */
  loadColumns: (poolId: number, connId: number) => Promise<void>;
  /** DML 目标表（视图场景为基表名） */
  submitTarget: () => string;
  /** 解析主键列名（表直接用列上的 PK 标记；视图查基表） */
  resolvePrimaryKeys: (poolId: number, connId: number, columns: DataColumnInfo[]) => Promise<string[]>;
  messages: UseDataTableMessages;
}

export const useDataTable = ({
  connectionProfile,
  database,
  objectName,
  loadColumns,
  submitTarget,
  resolvePrimaryKeys,
  messages,
}: UseDataTableOptions) => {
  const {
    connectFailed,
    loadDataFailed,
    submitFailed,
    cannotDeterminePk,
    pkColumnNotFound,
  } = messages;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [columns, setColumns] = useState<DataColumnInfo[]>([]);
  const [allRows, setAllRows] = useState<DataRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [selectedRowIndexes, setSelectedRowIndexes] = useState<Set<number>>(new Set());
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [whereClauseInput, setWhereClauseInput] = useState<string>('');
  const [groupByClauseInput, setGroupByClauseInput] = useState<string>('');
  const [orderByClauseInput, setOrderByClauseInput] = useState<string>('');
  const [appliedFilters, setAppliedFilters] = useState<{
    where: string;
    groupBy: string;
    orderBy: string;
  }>({ where: '', groupBy: '', orderBy: '' });
  const [contextMenu, setContextMenu] = useState<DataContextMenuState | null>(null);

  const poolIdRef = useRef<number | null>(null);
  const connIdRef = useRef<number | null>(null);
  // 列元数据（含主键标记）是否已由 loadColumns 写入；未写入时才允许
  // 用查询结果列做降级填充，避免降级列（isPrimaryKey=false）覆盖真实元数据。
  const columnsLoadedRef = useRef(false);
  const resizingColRef = useRef<string | null>(null);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(0);

  const offset = (page - 1) * pageSize;
  const totalPages = Math.ceil(totalRows / pageSize);

  const getDirtyRows = useCallback(() => allRows.filter(row => row.state !== RowState.SYNCED), [allRows]);
  const hasChanges = getDirtyRows().length > 0;

  const connect = useCallback(async () => {
    try {
      const newPoolId = await poolApi.create(connectionProfile);
      const newConnId = await poolApi.getConnection(newPoolId, database);

      await queryApi.execute(newPoolId, newConnId, `USE ${escapeIdentifier(database)}`);
      await poolApi.setDatabase(newPoolId, newConnId, database);

      poolIdRef.current = newPoolId;
      connIdRef.current = newConnId;
      return true;
    } catch (err) {
      setError(connectFailed(err));
      return false;
    }
  }, [connectionProfile, database, connectFailed]);

  const disconnect = useCallback(async () => {
    if (poolIdRef.current && connIdRef.current) {
      try {
        await poolApi.releaseConnection(poolIdRef.current, connIdRef.current);
        await poolApi.close(poolIdRef.current);
      } catch (err) {
        console.error('Disconnect error:', err);
      }
    }
    poolIdRef.current = null;
    connIdRef.current = null;
  }, []);

  const fetchData = useCallback(async () => {
    if (!poolIdRef.current || !connIdRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const countResult = await queryApi.query(
        poolIdRef.current,
        connIdRef.current,
        `SELECT COUNT(*) FROM ${escapeIdentifier(database)}.${escapeIdentifier(objectName)}`,
      );
      const count = Number(countResult.rows[0]?.[0] || 0);
      setTotalRows(count);

      let sql = `SELECT * FROM ${escapeIdentifier(database)}.${escapeIdentifier(objectName)}`;
      if (appliedFilters.where.trim()) {
        sql += ` WHERE ${appliedFilters.where.trim()}`;
      }
      if (appliedFilters.groupBy.trim()) {
        sql += ` GROUP BY ${appliedFilters.groupBy.trim()}`;
      }
      if (appliedFilters.orderBy.trim()) {
        sql += ` ORDER BY ${appliedFilters.orderBy.trim()}`;
      }
      sql += ` LIMIT ${offset}, ${pageSize}`;

      const dataResult = await queryApi.query(poolIdRef.current, connIdRef.current, sql);

      const dataRows: DataRow[] = dataResult.rows.map((row) => ({
        state: RowState.SYNCED,
        originalData: row,
        currentData: [...row],
      }));

      setAllRows(dataRows);

      if (!columnsLoadedRef.current) {
        setColumns(dataResult.columns.map((col: ColumnMeta) => ({
          name: col.name,
          typeName: col.typeName,
          isNullable: true,
          isPrimaryKey: false,
          defaultValue: null,
        })));
      }
    } catch (err) {
      setError(loadDataFailed(err));
    } finally {
      setIsLoading(false);
    }
  }, [database, objectName, offset, pageSize, appliedFilters, loadDataFailed]);

  const handleRefresh = useCallback(() => {
    void fetchData();
  }, [fetchData]);

  const handleResetFilters = useCallback(() => {
    setWhereClauseInput('');
    setGroupByClauseInput('');
    setOrderByClauseInput('');
    setAppliedFilters({ where: '', groupBy: '', orderBy: '' });
    setPage(1);
  }, []);

  const handleApplyFilters = useCallback(() => {
    setAppliedFilters({
      where: whereClauseInput,
      groupBy: groupByClauseInput,
      orderBy: orderByClauseInput,
    });
    setPage(1);
  }, [whereClauseInput, groupByClauseInput, orderByClauseInput]);

  const handleAddRow = useCallback(() => {
    const newRow = columns.map(() => null);
    const dataRow: DataRow = {
      state: RowState.NEW,
      originalData: [],
      currentData: newRow,
    };
    setAllRows((prev) => [...prev, dataRow]);
  }, [columns]);

  const handleDeleteRow = useCallback(() => {
    if (selectedRowIndexes.size === 0) return;

    setAllRows((prev) => {
      const newRows = [...prev];
      for (const rowIndex of selectedRowIndexes) {
        if (newRows[rowIndex]) {
          if (newRows[rowIndex].state === RowState.NEW) {
            newRows[rowIndex] = { ...newRows[rowIndex], state: RowState.DELETED };
          } else {
            newRows[rowIndex] = { ...newRows[rowIndex], state: RowState.DELETED };
          }
        }
      }
      return newRows;
    });
    setSelectedRowIndexes(new Set());
  }, [selectedRowIndexes]);

  const handleWithdraw = useCallback(() => {
    setAllRows((prevRows) => {
      const newRows: DataRow[] = [];
      for (const row of prevRows) {
        if (row.state === RowState.NEW) {
          continue;
        } else if (row.state === RowState.DELETED) {
          newRows.push({
            ...row,
            state: RowState.SYNCED,
          });
        } else if (row.state === RowState.MODIFIED) {
          newRows.push({
            ...row,
            state: RowState.SYNCED,
            currentData: [...row.originalData],
          });
        } else {
          newRows.push(row);
        }
      }
      return newRows;
    });
    setSelectedRowIndexes(new Set());
  }, []);

  const handleSubmitChanges = useCallback(async () => {
    if (!poolIdRef.current || !connIdRef.current) return;
    const dirtyRows = getDirtyRows();
    if (dirtyRows.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const targetTable = submitTarget();
      const pkColumns = await resolvePrimaryKeys(poolIdRef.current, connIdRef.current, columns);

      if (pkColumns.length === 0) {
        throw new Error(cannotDeterminePk);
      }

      for (const row of dirtyRows) {
        if (row.state === RowState.DELETED) {
          if (row.originalData.length > 0 && pkColumns.length > 0) {
            const whereClause = pkColumns
              .map((pkName) => {
                const colIndex = columns.findIndex((c) => c.name === pkName);
                if (colIndex === -1) {
                  throw new Error(pkColumnNotFound(pkName));
                }
                return `${escapeIdentifier(pkName)} = ${escapeSqlValue(row.originalData[colIndex], columns[colIndex]?.typeName || '')}`;
              })
              .join(' AND ');

            await queryApi.execute(
              poolIdRef.current,
              connIdRef.current,
              `DELETE FROM ${escapeIdentifier(database)}.${escapeIdentifier(targetTable)} WHERE ${whereClause}`,
            );
          }
        } else if (row.state === RowState.NEW) {
          const colNames = columns.map((col) => escapeIdentifier(col.name)).join(', ');
          const values = row.currentData
            .map((value, idx) => escapeSqlValue(value, columns[idx]?.typeName || ''))
            .join(', ');

          await queryApi.execute(
            poolIdRef.current,
            connIdRef.current,
            `INSERT INTO ${escapeIdentifier(database)}.${escapeIdentifier(targetTable)} (${colNames}) VALUES (${values})`,
          );
        } else if (row.state === RowState.MODIFIED) {
          const changedColumns: { colIndex: number; value: unknown }[] = [];
          for (let i = 0; i < row.currentData.length; i++) {
            if (row.currentData[i] !== row.originalData[i]) {
              changedColumns.push({ colIndex: i, value: row.currentData[i] });
            }
          }

          if (changedColumns.length > 0) {
            const setClause = changedColumns
              .map(({ colIndex, value }) => {
                const col = columns[colIndex];
                return `${escapeIdentifier(col.name)} = ${escapeSqlValue(value, col.typeName)}`;
              })
              .join(', ');

            const whereClause = pkColumns
              .map((pkName) => {
                const colIndex = columns.findIndex((c) => c.name === pkName);
                if (colIndex === -1) {
                  throw new Error(pkColumnNotFound(pkName));
                }
                return `${escapeIdentifier(pkName)} = ${escapeSqlValue(row.originalData[colIndex], columns[colIndex]?.typeName || '')}`;
              })
              .join(' AND ');

            await queryApi.execute(
              poolIdRef.current,
              connIdRef.current,
              `UPDATE ${escapeIdentifier(database)}.${escapeIdentifier(targetTable)} SET ${setClause} WHERE ${whereClause}`,
            );
          }
        }
      }

      await fetchData();
    } catch (err) {
      setError(submitFailed(err));
    } finally {
      setIsLoading(false);
    }
  }, [
    getDirtyRows,
    columns,
    database,
    fetchData,
    submitTarget,
    resolvePrimaryKeys,
    cannotDeterminePk,
    pkColumnNotFound,
    submitFailed,
  ]);

  const handleRowSelect = useCallback((rowIndex: number, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      setSelectedRowIndexes((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(rowIndex)) {
          newSet.delete(rowIndex);
        } else {
          newSet.add(rowIndex);
        }
        return newSet;
      });
    } else if (event.shiftKey && selectedRowIndexes.size > 0) {
      const lastSelected = Math.max(...Array.from(selectedRowIndexes));
      const start = Math.min(lastSelected, rowIndex);
      const end = Math.max(lastSelected, rowIndex);
      setSelectedRowIndexes(new Set(Array.from({ length: end - start + 1 }, (_, i) => start + i)));
    } else {
      setSelectedRowIndexes(new Set([rowIndex]));
    }
  }, [selectedRowIndexes]);

  const handleCellDoubleClick = useCallback((rowIndex: number, colIndex: number) => {
    const row = allRows[rowIndex];
    if (!row || row.state === RowState.DELETED) return;

    const value = row.currentData[colIndex];
    setEditingCell({ rowIndex, colIndex });
    setEditValue(value === null || value === undefined ? '' : String(value));
  }, [allRows]);

  const handleCellEditComplete = useCallback(() => {
    if (!editingCell) return;
    const { rowIndex, colIndex } = editingCell;

    setAllRows((prev) => {
      const next = [...prev];
      const row = next[rowIndex];
      if (!row) return prev;

      if (row.state === RowState.NEW) {
        next[rowIndex] = {
          ...row,
          currentData: row.currentData.map((v, i) => (i === colIndex ? editValue : v)),
        };
      } else {
        const original = row.originalData[colIndex];
        const rawValue = original === null || original === undefined ? '' : String(original);
        const isSame = rawValue === editValue;
        next[rowIndex] = {
          ...row,
          currentData: row.currentData.map((v, i) => (i === colIndex ? editValue : v)),
          state: isSame ? RowState.SYNCED : RowState.MODIFIED,
        };
      }
      return next;
    });

    setEditingCell(null);
    setEditValue('');
  }, [editingCell, editValue]);

  const handleCellEditCancel = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleCellEditComplete();
    } else if (event.key === 'Escape') {
      handleCellEditCancel();
    }
  }, [handleCellEditComplete, handleCellEditCancel]);

  const handleResizeStart = useCallback((colName: string, e: React.MouseEvent, thElement: HTMLTableCellElement) => {
    e.preventDefault();
    e.stopPropagation();
    resizingColRef.current = colName;
    startXRef.current = e.clientX;
    const actualWidth = thElement.getBoundingClientRect().width;
    const currentWidth = columnWidths[colName] || actualWidth;
    startWidthRef.current = currentWidth;

    if (!columnWidths[colName]) {
      setColumnWidths(prev => ({
        ...prev,
        [colName]: actualWidth,
      }));
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingColRef.current) return;
      const delta = moveEvent.clientX - startXRef.current;
      const newWidth = Math.max(80, startWidthRef.current + delta);
      setColumnWidths(prev => ({
        ...prev,
        [resizingColRef.current!]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      resizingColRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [columnWidths]);

  const handlePageChange = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  }, [totalPages]);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  }, []);

  const handleCellContextMenu = useCallback((
    event: React.MouseEvent<HTMLTableCellElement>,
    rowIndex: number,
    colIndex: number,
    row: DataRow,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const cellValue = row.currentData[colIndex];
    const rowData = row.currentData;

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      rowIndex,
      colIndex,
      cellValue,
      rowData,
    });
  }, []);

  const handleCopyCell = useCallback(async () => {
    if (!contextMenu) return;
    const text = formatCellValue(contextMenu.cellValue);
    await copyTextToClipboard(text);
    setContextMenu(null);
  }, [contextMenu]);

  const handleCopyRow = useCallback(async () => {
    if (!contextMenu) return;
    const text = contextMenu.rowData.map((value) => formatCellValue(value)).join('\t');
    await copyTextToClipboard(text);
    setContextMenu(null);
  }, [contextMenu]);

  const handleEditCell = useCallback(() => {
    if (!contextMenu) return;
    handleCellDoubleClick(contextMenu.rowIndex, contextMenu.colIndex);
    setContextMenu(null);
  }, [contextMenu, handleCellDoubleClick]);

  const handleCancelContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  useEffect(() => {
    if (!contextMenu) return;

    const handleGlobalClick = () => setContextMenu(null);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
      }
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('contextmenu', handleGlobalClick);
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('scroll', handleGlobalClick, true);

    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('contextmenu', handleGlobalClick);
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('scroll', handleGlobalClick, true);
    };
  }, [contextMenu]);

  // 初始化：连接 → 加载列 → 取数；卸载时断开
  useEffect(() => {
    const init = async () => {
      const connected = await connect();
      if (connected && poolIdRef.current && connIdRef.current) {
        // 先加载真实列元数据（含主键标记），再取数；
        // fetchData 通过 columnsLoadedRef 跳过降级列覆盖，主键判定不会被“吃掉”。
        await loadColumns(poolIdRef.current, connIdRef.current);
        columnsLoadedRef.current = true;
        await fetchData();
      }
    };
    void init();

    return () => {
      void disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 翻页/页大小/筛选条件变化时重新取数。
  // 依赖 appliedFilters 而非 fetchData：fetchData 依赖调用方注入的
  // loadDataFailed 回调（每渲染新建），依赖 fetchData 会触发无限重取。
  useEffect(() => {
    if (poolIdRef.current && connIdRef.current) {
      void fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, appliedFilters]);

  return {
    poolIdRef,
    connIdRef,
    isLoading,
    error,
    setError,
    columns,
    setColumns,
    allRows,
    totalRows,
    page,
    pageSize,
    totalPages,
    offset,
    selectedRowIndexes,
    editingCell,
    editValue,
    columnWidths,
    whereClauseInput,
    setWhereClauseInput,
    groupByClauseInput,
    setGroupByClauseInput,
    orderByClauseInput,
    setOrderByClauseInput,
    appliedFilters,
    contextMenu,
    getDirtyRows,
    hasChanges,
    connect,
    disconnect,
    fetchData,
    handleRefresh,
    handleResetFilters,
    handleApplyFilters,
    handleAddRow,
    handleDeleteRow,
    handleWithdraw,
    handleSubmitChanges,
    handleRowSelect,
    handleCellDoubleClick,
    handleCellEditComplete,
    handleCellEditCancel,
    handleKeyDown,
    handleResizeStart,
    handlePageChange,
    handlePageSizeChange,
    handleCellContextMenu,
    handleCopyCell,
    handleCopyRow,
    handleEditCell,
    handleCancelContextMenu,
    setEditValue,
    setEditingCell,
  };
};
