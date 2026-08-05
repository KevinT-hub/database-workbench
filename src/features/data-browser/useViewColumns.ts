// 视图数据页专用列元数据 hook：可更新性检查、视图→基表列映射、
// 基表主键解析。逻辑与拆分前的 ViewDataTab 完全一致。

import { useCallback, useState } from 'react';
import { queryApi } from '@/api/query';
import type { DataColumnInfo } from './types';
import { escapeSqlValue } from './utils';

type ViewColumnInfo = DataColumnInfo & {
  baseTableName?: string;
  baseColumnName?: string;
};

interface UseViewColumnsOptions {
  database: string;
  viewName: string;
  /** 列元数据就绪后的回调（接 useDataTable.setColumns） */
  onColumns: (columns: DataColumnInfo[]) => void;
}

export const useViewColumns = ({ database, viewName, onColumns }: UseViewColumnsOptions) => {
  const [isUpdatable, setIsUpdatable] = useState<boolean | null>(null);
  const [baseTableName, setBaseTableName] = useState<string>('');

  const checkViewUpdatability = useCallback(async (poolId: number, connId: number) => {
    try {
      const result = await queryApi.query(poolId, connId, `SELECT IS_UPDATABLE 
              FROM INFORMATION_SCHEMA.VIEWS 
              WHERE TABLE_SCHEMA = ${escapeSqlValue(database, 'VARCHAR')} 
              AND TABLE_NAME = ${escapeSqlValue(viewName, 'VARCHAR')}`);

      if (result.rows.length > 0) {
        setIsUpdatable(String(result.rows[0][0]) === 'YES');
      } else {
        setIsUpdatable(false);
      }
    } catch (err) {
      console.error('Failed to check view updatability:', err);
      setIsUpdatable(false);
    }
  }, [database, viewName]);

  const fetchViewColumnMappings = useCallback(async (poolId: number, connId: number) => {
    try {
      const viewDefResult = await queryApi.query(poolId, connId, `SELECT VIEW_DEFINITION 
              FROM INFORMATION_SCHEMA.VIEWS 
              WHERE TABLE_SCHEMA = ${escapeSqlValue(database, 'VARCHAR')} 
              AND TABLE_NAME = ${escapeSqlValue(viewName, 'VARCHAR')}`);

      if (viewDefResult.rows.length > 0) {
        const viewDefinition = String(viewDefResult.rows[0][0] || '');
        const fromMatch = viewDefinition.match(/FROM\s+(?:`?\w+`?\s*\.\s*)?`?(\w+)`?/i);
        if (fromMatch) {
          setBaseTableName(fromMatch[1]);
          console.log('Base table name extracted:', fromMatch[1]);
        } else {
          console.log('Failed to extract base table name from view definition');
        }
      }

      const columnResult = await queryApi.query(poolId, connId, `SELECT 
          COLUMN_NAME,
          COLUMN_TYPE,
          IS_NULLABLE,
          COLUMN_KEY,
          COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ${escapeSqlValue(database, 'VARCHAR')} 
        AND TABLE_NAME = ${escapeSqlValue(viewName, 'VARCHAR')}
        ORDER BY ORDINAL_POSITION`);

      const baseTableColumns: Record<string, string> = {};

      if (baseTableName) {
        try {
          const baseColumnResult = await queryApi.query(poolId, connId, `SELECT 
              COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ${escapeSqlValue(database, 'VARCHAR')} 
            AND TABLE_NAME = ${escapeSqlValue(baseTableName, 'VARCHAR')}
            ORDER BY ORDINAL_POSITION`);

          const baseColNames = baseColumnResult.rows.map(row => String(row[0]));

          if (viewDefResult.rows.length > 0) {
            const viewDefinition = String(viewDefResult.rows[0][0] || '');
            const selectMatch = viewDefinition.match(/SELECT\s+(.+?)\s+FROM/i);
            if (selectMatch) {
              const selectPart = selectMatch[1];
              const colDefs = selectPart.split(',').map(s => s.trim());

              colDefs.forEach((colDef) => {
                const aliasMatch = colDef.match(/`?(?:\w+`?\s*\.\s*)?`?(\w+)`?\s+AS\s+`?(\w+)`?/i);
                if (aliasMatch) {
                  const baseCol = aliasMatch[1];
                  const viewCol = aliasMatch[2];
                  baseTableColumns[viewCol] = baseCol;
                  baseTableColumns[viewCol.toLowerCase()] = baseCol;
                } else {
                  const simpleMatch = colDef.match(/`?(?:\w+`?\s*\.\s*)?`?(\w+)`?$/i);
                  if (simpleMatch) {
                    const colName = simpleMatch[1];
                    baseTableColumns[colName] = colName;
                  }
                }
              });
            }
          }

          columnResult.rows.forEach((row) => {
            const viewColName = String(row[0]);
            if (!baseTableColumns[viewColName]) {
              const matchedBaseCol = baseColNames.find(
                baseCol => baseCol.toLowerCase() === viewColName.toLowerCase()
              );
              if (matchedBaseCol) {
                baseTableColumns[viewColName] = matchedBaseCol;
              }
            }
          });
        } catch (err) {
          console.error('Failed to fetch base table columns:', err);
        }
      }

      const columnInfos: ViewColumnInfo[] = columnResult.rows.map((row) => {
        const viewColName = String(row[0]);
        const baseColName = baseTableColumns[viewColName] || viewColName;

        return {
          name: viewColName,
          typeName: String(row[1]),
          isNullable: String(row[2]) === 'YES',
          isPrimaryKey: String(row[3]) === 'PRI',
          defaultValue: row[4],
          baseTableName,
          baseColumnName: baseColName,
        };
      });

      onColumns(columnInfos);
    } catch (err) {
      console.error('Failed to fetch view column mappings:', err);
    }
  }, [database, viewName, baseTableName, onColumns]);

  const getBaseTablePrimaryKeys = useCallback(async (poolId: number, connId: number): Promise<string[]> => {
    if (!baseTableName) return [];

    try {
      const result = await queryApi.query(poolId, connId, `SELECT COLUMN_NAME 
              FROM INFORMATION_SCHEMA.COLUMNS 
              WHERE TABLE_SCHEMA = ${escapeSqlValue(database, 'VARCHAR')} 
              AND TABLE_NAME = ${escapeSqlValue(baseTableName, 'VARCHAR')}
              AND COLUMN_KEY = 'PRI'`);

      return result.rows.map(row => String(row[0]));
    } catch (err) {
      console.error('Failed to get base table primary keys:', err);
      return [];
    }
  }, [database, baseTableName]);

  const loadViewColumns = useCallback(async (poolId: number, connId: number) => {
    await checkViewUpdatability(poolId, connId);
    await fetchViewColumnMappings(poolId, connId);
  }, [checkViewUpdatability, fetchViewColumnMappings]);

  const readOnly = isUpdatable === false;

  return {
    isUpdatable,
    readOnly,
    baseTableName,
    loadViewColumns,
    getBaseTablePrimaryKeys,
  };
};

