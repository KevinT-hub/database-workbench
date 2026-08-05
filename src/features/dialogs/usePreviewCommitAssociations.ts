// usePreviewCommitAssociations.ts —— 提交预览关联检查共享 hook
//
// 收敛 PreviewCommitDialog / ViewPreviewCommitDialog 重复的加载逻辑：
// 池生命周期（create/getConnection/USE/setDatabase/release/close）、
// 触发器加载、外键引用检查。组件不再直接 import api 模块（阶段 3）。

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { poolApi } from '@/api/pool';
import { queryApi } from '@/api/query';
import { escapeIdentifier, escapeSqlValue } from '@/lib/sql';
import type { ConnectionProfile } from '@/types';

interface PreviewCommitColumnInfo {
  name: string;
  typeName: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  defaultValue: unknown;
  /** 视图列映射到基表的列名（仅视图预览传入） */
  baseColumnName?: string;
}

interface PreviewCommitRow {
  state: 'SYNCED' | 'NEW' | 'MODIFIED' | 'DELETED';
  originalData: unknown[];
  currentData: unknown[];
}

interface TriggerInfo {
  name: string;
  timing: string;
  event: string;
  statement: string;
}

interface ForeignKeyCheck {
  type: 'outgoing' | 'incoming';
  myColumn: string;
  refTable: string;
  refColumn: string;
  missingValues?: string[];
  dependentRows?: Record<string, unknown>[];
  warning?: string;
}

interface UsePreviewCommitAssociationsOptions {
  connectionProfile: ConnectionProfile;
  database: string;
  /** 表名：表预览传表名，视图预览传基表名 */
  tableName: string;
  columns: PreviewCommitColumnInfo[];
  changedRows: PreviewCommitRow[];
  /** 视图场景启用 baseColumnName 优先匹配（默认仅精确匹配 name） */
  matchByBaseColumn?: boolean;
}

export const usePreviewCommitAssociations = ({
  connectionProfile,
  database,
  tableName,
  columns,
  changedRows,
  matchByBaseColumn = false,
}: UsePreviewCommitAssociationsOptions) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [triggers, setTriggers] = useState<TriggerInfo[]>([]);
  const [foreignKeyChecks, setForeignKeyChecks] = useState<ForeignKeyCheck[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const hasInsert = changedRows.some((r) => r.state === 'NEW');
  const hasUpdate = changedRows.some((r) => r.state === 'MODIFIED');
  const hasDelete = changedRows.some((r) => r.state === 'DELETED');
  const insOrMod = useMemo(
    () => changedRows.filter((r) => r.state === 'NEW' || r.state === 'MODIFIED'),
    [changedRows],
  );
  const delOrMod = useMemo(
    () => changedRows.filter((r) => r.state === 'DELETED' || r.state === 'MODIFIED'),
    [changedRows],
  );

  const findColumnIndex = useCallback(
    (myCol: string): number => {
      if (matchByBaseColumn) {
        return columns.findIndex(
          (c) =>
            c.baseColumnName === myCol ||
            c.name === myCol ||
            c.name.toLowerCase() === myCol.toLowerCase(),
        );
      }
      return columns.findIndex((c) => c.name === myCol);
    },
    [columns, matchByBaseColumn],
  );

  const loadTriggers = useCallback(
    async (poolId: number, connId: number): Promise<TriggerInfo[]> => {
      const result: TriggerInfo[] = [];

      try {
        const trigResult = await queryApi.query(
          poolId,
          connId,
          `SELECT TRIGGER_NAME, ACTION_TIMING, EVENT_MANIPULATION, ACTION_STATEMENT 
              FROM INFORMATION_SCHEMA.TRIGGERS 
              WHERE EVENT_OBJECT_SCHEMA = ${escapeSqlValue(database)} 
              AND EVENT_OBJECT_TABLE = ${escapeSqlValue(tableName)}`,
        );

        for (const row of trigResult.rows) {
          const event = String(row[2]);
          const relevant =
            (event === 'INSERT' && hasInsert) ||
            (event === 'UPDATE' && hasUpdate) ||
            (event === 'DELETE' && hasDelete);

          if (relevant) {
            result.push({
              name: String(row[0]),
              timing: String(row[1]),
              event,
              statement: String(row[3]),
            });
          }
        }
      } catch (err) {
        console.error('Failed to load triggers:', err);
      }

      return result;
    },
    [database, tableName, hasInsert, hasUpdate, hasDelete],
  );

  const checkForeignKeys = useCallback(
    async (poolId: number, connId: number): Promise<ForeignKeyCheck[]> => {
      const result: ForeignKeyCheck[] = [];

      if (insOrMod.length > 0) {
        try {
          const outFkResult = await queryApi.query(
            poolId,
            connId,
            `SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME 
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
                WHERE TABLE_SCHEMA = ${escapeSqlValue(database)} 
                AND TABLE_NAME = ${escapeSqlValue(tableName)} 
                AND REFERENCED_TABLE_NAME IS NOT NULL`,
          );

          for (const row of outFkResult.rows) {
            const myCol = String(row[0]);
            const parentTable = String(row[1]);
            const parentCol = String(row[2]);

            const colIndex = findColumnIndex(myCol);
            if (colIndex === -1) {
              if (matchByBaseColumn) {
                console.log(`Outgoing FK: Column ${myCol} not found in view columns`);
              }
              continue;
            }

            const checkingValues = new Set<string>();
            for (const dataRow of insOrMod) {
              const val = dataRow.currentData[colIndex];
              if (val !== null && val !== undefined && String(val) !== '') {
                checkingValues.add(String(val));
              }
            }

            if (checkingValues.size > 0) {
              const valuesList = Array.from(checkingValues).map((v) => escapeSqlValue(v)).join(',');
              const q = `SELECT DISTINCT ${escapeIdentifier(parentCol)} FROM ${escapeIdentifier(database)}.${escapeIdentifier(parentTable)} WHERE ${escapeIdentifier(parentCol)} IN (${valuesList})`;

              const foundResult = await queryApi.query(poolId, connId, q);

              const foundValues = new Set<string>();
              for (const foundRow of foundResult.rows) {
                if (foundRow[0] !== null) {
                  foundValues.add(String(foundRow[0]));
                }
              }

              const missingValues = Array.from(checkingValues).filter((v) => !foundValues.has(v));

              if (missingValues.length > 0) {
                result.push({
                  type: 'outgoing',
                  myColumn: myCol,
                  refTable: parentTable,
                  refColumn: parentCol,
                  missingValues,
                  warning: t('previewCommit.dialog.associations.missingValuesWarning', { parentTable }),
                });
              }
            }
          }
        } catch (err) {
          console.error('Failed to check outgoing FKs:', err);
        }
      }

      if (delOrMod.length > 0) {
        try {
          const inFkResult = await queryApi.query(
            poolId,
            connId,
            `SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_COLUMN_NAME 
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
                WHERE REFERENCED_TABLE_SCHEMA = ${escapeSqlValue(database)} 
                AND REFERENCED_TABLE_NAME = ${escapeSqlValue(tableName)} 
                AND REFERENCED_COLUMN_NAME IS NOT NULL`,
          );

          for (const row of inFkResult.rows) {
            const refTable = String(row[0]);
            const refCol = String(row[1]);
            const myCol = String(row[2]);

            const colIndex = findColumnIndex(myCol);
            if (colIndex === -1) {
              if (matchByBaseColumn) {
                console.log(`Incoming FK: Column ${myCol} not found in view columns`);
              }
              continue;
            }

            const targetValues = new Set<string>();
            for (const dataRow of delOrMod) {
              let isAffected = false;

              if (dataRow.state === 'DELETED') {
                isAffected = true;
              } else if (dataRow.state === 'MODIFIED') {
                const curVal = dataRow.currentData[colIndex];
                const origVal = dataRow.originalData[colIndex];
                if (curVal !== origVal) {
                  isAffected = true;
                }
              }

              if (isAffected) {
                const val = dataRow.originalData[colIndex];
                if (val !== null && val !== undefined) {
                  targetValues.add(String(val));
                }
              }
            }

            if (targetValues.size > 0) {
              const valuesList = Array.from(targetValues).map((v) => escapeSqlValue(v)).join(',');
              const q = `SELECT * FROM ${escapeIdentifier(database)}.${escapeIdentifier(refTable)} WHERE ${escapeIdentifier(refCol)} IN (${valuesList}) LIMIT 20`;

              const childResult = await queryApi.query(poolId, connId, q);

              if (childResult.rows.length > 0) {
                const dependentRows: Record<string, unknown>[] = [];
                for (const childRow of childResult.rows) {
                  const rowMap: Record<string, unknown> = {};
                  for (let i = 0; i < childResult.columns.length; i++) {
                    rowMap[childResult.columns[i].name] = childRow[i];
                  }
                  dependentRows.push(rowMap);
                }

                result.push({
                  type: 'incoming',
                  myColumn: myCol,
                  refTable,
                  refColumn: refCol,
                  dependentRows,
                  warning: t('previewCommit.dialog.associations.dependencyWarning'),
                });
              }
            }
          }
        } catch (err) {
          console.error('Failed to check incoming FKs:', err);
        }
      }

      return result;
    },
    [database, tableName, insOrMod, delOrMod, findColumnIndex, matchByBaseColumn, t],
  );

  const loadAssociations = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    let poolId: number | null = null;
    let connId: number | null = null;

    try {
      poolId = await poolApi.create(connectionProfile);
      connId = await poolApi.getConnection(poolId, database);

      await queryApi.execute(poolId, connId, `USE ${escapeIdentifier(database)}`);
      // 通知后端更新数据库状态
      await poolApi.setDatabase(poolId, connId, database);

      const loadedTriggers = await loadTriggers(poolId, connId);
      const loadedFkChecks = await checkForeignKeys(poolId, connId);

      setTriggers(loadedTriggers);
      setForeignKeyChecks(loadedFkChecks);
    } catch (err) {
      setLoadError(t('previewCommit.dialog.errors.loadAssociationsFailed', { error: err }));
    } finally {
      if (poolId && connId) {
        try {
          await poolApi.releaseConnection(poolId, connId);
          await poolApi.close(poolId);
        } catch (e) {
          console.error('Failed to close connection:', e);
        }
      }
      setIsLoading(false);
    }
  }, [connectionProfile, database, loadTriggers, checkForeignKeys, t]);

  return {
    isLoading,
    triggers,
    foreignKeyChecks,
    loadError,
    loadAssociations,
  };
};
