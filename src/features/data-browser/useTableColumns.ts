// useTableColumns.ts —— 表数据页列元数据加载 hook
//
// 与 useViewColumns 对称：收敛 TableDataTab 内联的列加载（pool_query），
// 组件不再直接 import api 模块（阶段 3：API 调用统一化）。

import { useCallback } from 'react';
import { queryApi } from '@/api/query';
import type { DataColumnInfo } from './types';
import { escapeSqlValue } from './utils';

interface UseTableColumnsOptions {
  database: string;
  tableName: string;
  /** 列元数据就绪后的回调（接 useDataTable.setColumns） */
  onColumns: (columns: DataColumnInfo[]) => void;
}

export const useTableColumns = ({
  database,
  tableName,
  onColumns,
}: UseTableColumnsOptions) => {
  const loadTableColumns = useCallback(
    async (poolId: number, connId: number) => {
      try {
        const columnResult = await queryApi.query(
          poolId,
          connId,
          `SELECT 
            COLUMN_NAME, 
            COLUMN_TYPE, 
            IS_NULLABLE, 
            COLUMN_KEY, 
            COLUMN_DEFAULT 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = ${escapeSqlValue(database, 'VARCHAR')} 
          AND TABLE_NAME = ${escapeSqlValue(tableName, 'VARCHAR')}
          ORDER BY ORDINAL_POSITION`,
        );
        onColumns(columnResult.rows.map((row) => ({
          name: String(row[0]),
          typeName: String(row[1]),
          isNullable: String(row[2]) === 'YES',
          isPrimaryKey: String(row[3]) === 'PRI',
          defaultValue: row[4],
        })));
      } catch (err) {
        console.error('Failed to fetch column metadata:', err);
      }
    },
    [database, tableName, onColumns],
  );

  return { loadTableColumns };
};
