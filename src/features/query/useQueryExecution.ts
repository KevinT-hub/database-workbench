// 查询执行 Hook：执行 SQL、脚本分页执行、结果集状态管理。
// 从 QueryTab 拆分而来；QueryTab 只保留编辑器/连接/保存等职责。

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConnectionProfile, QueryResultData, ResultTab } from '@/types';
import { queryApi } from '@/api';
import { useConnectionStore } from '@/stores';
import { notifySQLMetadataChanged } from '@/completion';
import {
  extractAffectedDatabasesFromDdl,
  extractUseDatabaseFromStatement,
  isDatabaseListMutatingSql,
  isLikelySingleStatementSql,
  isMetadataMutatingSql,
  isQuerySqlLike,
  stripLeadingSqlComments,
} from '@/lib/sql';
import type { QueryEditorRef } from './components/QueryEditor';

const RESULT_TAB_FLUSH_BATCH_SIZE = 64;
const MAX_VISIBLE_RESULT_TABS = 600;

interface UseQueryExecutionOptions {
  poolId: number | null;
  connId: number | null;
  isConnected: boolean;
  selectedConnection?: ConnectionProfile;
  selectedDatabase?: string;
  setSelectedDatabase: (database?: string) => void;
  tabId: string;
  editorRef: React.RefObject<QueryEditorRef>;
  /** 状态栏提示（QueryTab 与全局状态栏共用） */
  setStatusMessage: (message: string) => void;
  /** 执行前展开结果面板 */
  expandResultPanel: () => void;
}

export const useQueryExecution = ({
  poolId,
  connId,
  isConnected,
  selectedConnection,
  selectedDatabase,
  setSelectedDatabase,
  tabId,
  editorRef,
  setStatusMessage,
  expandResultPanel,
}: UseQueryExecutionOptions) => {
  const { t } = useTranslation();
  const { setActiveDatabase, setLastUsedDatabaseForConnection } = useConnectionStore();
  const [isExecuting, setIsExecuting] = useState(false);
  const [resultTabs, setResultTabs] = useState<ResultTab[]>([]);
  const [metaResultTabs, setMetaResultTabs] = useState<ResultTab[]>([]);
  const [activeResultTabId, setActiveResultTabId] = useState<string | null>(null);
  const [executionWallTimeSec, setExecutionWallTimeSec] = useState<number | null>(null);

  const isServerPageableSql = useCallback((sql: string): boolean => {
    const trimmed = stripLeadingSqlComments(sql).trim().toLowerCase();
    return trimmed.startsWith('select') || trimmed.startsWith('with');
  }, []);

  const isStoredProcedureCallLike = useCallback((sql: string): boolean => {
    const trimmed = sql.trim().toLowerCase();
    return trimmed.startsWith('call');
  }, []);

  const pendingDqlTotalCountRef = React.useRef<Set<string>>(new Set());

  const fetchQueryPage = useCallback(async (
    sql: string,
    page: number,
    pageSize: number,
    includeTotal = false,
  ): Promise<QueryResultData> => {
    if (!poolId || !connId) {
      throw new Error(t('error.noActiveConnection'));
    }

    const result = await queryApi.queryPage(poolId, connId, sql, page, pageSize, includeTotal);

    return {
      columns: result.columns,
      rows: result.rows,
      queryTimeSecs: result.queryTimeSecs,
      fetchTimeSecs: result.fetchTimeSecs,
      sourceSql: sql,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.hasMore,
        totalRows: result.totalRows,
        totalPages: result.totalPages,
      },
    };
  }, [poolId, connId, t]);

  const hydrateQueryTotalForTab = useCallback((
    tabId: string,
    sql: string,
    page: number,
    pageSize: number,
  ) => {
    if (!poolId || !connId) {
      return;
    }
    if (pendingDqlTotalCountRef.current.has(tabId)) {
      return;
    }

    pendingDqlTotalCountRef.current.add(tabId);

    void queryApi.queryPage(poolId, connId, sql, page, pageSize, true)
      .then((countedResult) => {
        React.startTransition(() => {
          const patchTabData = (tab: ResultTab): ResultTab => {
            if (tab.id !== tabId || tab.type !== 'query') {
              return tab;
            }

            const data = tab.data as QueryResultData;
            const pagination = data.pagination;
            if (!pagination) {
              return tab;
            }

            return {
              ...tab,
              data: {
                ...data,
                pagination: {
                  ...pagination,
                  totalRows: countedResult.totalRows ?? pagination.totalRows,
                  totalPages: countedResult.totalPages ?? pagination.totalPages,
                },
              },
            };
          };

          setResultTabs((prev) => prev.map(patchTabData));
          setMetaResultTabs((prev) => prev.map(patchTabData));
        });
      })
      .catch(() => undefined)
      .finally(() => {
        pendingDqlTotalCountRef.current.delete(tabId);
      });
  }, [poolId, connId]);

  const executeSql = useCallback(async () => {
    if (!isConnected || !poolId || !connId) {
      setStatusMessage(t('error.noActiveConnection'));
      return;
    }

    const editor = editorRef.current;
    if (!editor) return;

    // Get selected text or all text
    const model = editor.getModel();
    const selection = editor.getSelection();
    let sql = '';

    // Try to get selected text
    if (selection && !selection.isEmpty()) {
      const range = {
        startLineNumber: selection.startLineNumber,
        startColumn: selection.startColumn,
        endLineNumber: selection.endLineNumber,
        endColumn: selection.endColumn,
      };
      sql = model?.getValueInRange(range) || '';
    } else {
      sql = editor.getValue();
    }

    if (!sql.trim()) {
      setStatusMessage(t('query.noQuery'));
      return;
    }

    setIsExecuting(true);
    setStatusMessage(t('status.executing'));
    setExecutionWallTimeSec(null);

    let encounteredExecutionError = false;

    try {
      const normalizedSelectedSql = sql.trim().replace(/;\s*$/, '');
      const strippedSelectedSql = stripLeadingSqlComments(normalizedSelectedSql).trim();
      const canUseSingleQueryFastPath = isLikelySingleStatementSql(normalizedSelectedSql)
        && isQuerySqlLike(strippedSelectedSql)
        && !isStoredProcedureCallLike(strippedSelectedSql);

      if (canUseSingleQueryFastPath) {
        const wallStart = performance.now();
        const startedAtIso = new Date().toISOString();

        setResultTabs([]);
        setMetaResultTabs([]);
        setActiveResultTabId(null);
        expandResultPanel();

        let queryData: QueryResultData;
        if (isServerPageableSql(strippedSelectedSql)) {
          queryData = await fetchQueryPage(strippedSelectedSql, 1, 200, false);
        } else {
          const result = await queryApi.query(poolId, connId, strippedSelectedSql);
          queryData = {
            ...result,
            sourceSql: strippedSelectedSql,
          };
        }

        const queryTab: ResultTab = {
          id: `result_${Date.now()}_0`,
          type: 'query',
          title: t('resultPanel.queryResult', { count: queryData.rows.length }),
          data: queryData,
          sql: strippedSelectedSql,
          executionTimeSec: queryData.queryTimeSecs,
          fetchTimeSec: queryData.fetchTimeSecs,
          statementOrder: 1,
          startedAt: startedAtIso,
          finishedAt: new Date().toISOString(),
          statusText: 'OK',
        };

        React.startTransition(() => {
          setResultTabs([queryTab]);
          setMetaResultTabs([queryTab]);
          setActiveResultTabId(queryTab.id);
        });

        if (queryData.pagination && (queryData.pagination.totalRows == null || queryData.pagination.totalPages == null)) {
          void hydrateQueryTotalForTab(
            queryTab.id,
            strippedSelectedSql,
            queryData.pagination.page,
            queryData.pagination.pageSize,
          );
        }

        const wallDurationSec = (performance.now() - wallStart) / 1000;
        setExecutionWallTimeSec(Number(wallDurationSec.toFixed(3)));
        setStatusMessage(t('resultPanel.execComplete', {
          success: 1,
          error: 0,
          time: wallDurationSec.toFixed(3),
        }));

        return;
      }

      // 脚本路径：一次性调用后端 pool_execute_script
      // 后端在专用事务连接上执行所有语句，保证同连接（修复 1046 no database selected）
      // + DELIMITER 感知切分（修复复合语句被切碎 + 中文 panic）
      // + raw_sql 简单查询协议（修复 prepared statement 1295）
      setResultTabs([]);
      setMetaResultTabs([]);
      setActiveResultTabId(null);
      expandResultPanel();

      const wallStart = performance.now();
      let successCount = 0;
      let errorCount = 0;
      let statementOrder = 0;
      let metadataChanged = false;
      let databaseListChanged = false;
      const affectedMetadataDatabases = new Set<string>();
      const pendingResultTabs: ResultTab[] = [];
      const pendingMetaTabs: ResultTab[] = [];
      let hasActivatedResultTab = false;
      let flushedResultTabCount = 0;
      let lastDetectedUseDatabase: string | undefined;

      const canAppendResultTab = (tab: ResultTab): boolean => {
        if (tab.type !== 'update') {
          return true;
        }
        const totalVisible = flushedResultTabCount + pendingResultTabs.length;
        if (totalVisible < MAX_VISIBLE_RESULT_TABS) {
          return true;
        }
        return false;
      };

      const flushResultTabs = (force = false) => {
        if (!force && pendingResultTabs.length < RESULT_TAB_FLUSH_BATCH_SIZE) {
          return;
        }
        if (pendingResultTabs.length === 0) {
          return;
        }

        const batch = pendingResultTabs.splice(0, pendingResultTabs.length);
        flushedResultTabCount += batch.length;
        if (!hasActivatedResultTab && batch.length > 0) {
          setActiveResultTabId(batch[0].id);
          hasActivatedResultTab = true;
        }

        React.startTransition(() => {
          setResultTabs((prev) => [...prev, ...batch]);
        });
      };

      const flushMetaTabs = (force = false) => {
        if (!force && pendingMetaTabs.length < RESULT_TAB_FLUSH_BATCH_SIZE) {
          return;
        }
        if (pendingMetaTabs.length === 0) {
          return;
        }

        const batch = pendingMetaTabs.splice(0, pendingMetaTabs.length);
        React.startTransition(() => {
          setMetaResultTabs((prev) => [...prev, ...batch]);
        });
      };

      const scriptResult = await queryApi.executeScript(
        poolId,
        connId,
        sql,
        selectedDatabase,
        true, // stopOnError
      );

      for (const entry of scriptResult.entries) {
        const statement = entry.sql.trim();
        if (!statement) continue;

        const statementWithoutLeadingComments = stripLeadingSqlComments(statement).trim();
        if (!statementWithoutLeadingComments) continue;

        const statementIndex = entry.statementIndex;

        statementOrder += 1;
        const startedAtIso = new Date().toISOString();

        if (entry.resultType === 'error') {
          errorCount++;
          encounteredExecutionError = true;
          const errorTab: ResultTab = {
            id: `result_${Date.now()}_${statementIndex}`,
            type: 'error',
            title: t('resultPanel.errorResult'),
            data: entry.error || t('resultPanel.execFailed'),
            sql: statement,
            executionTimeSec: 0,
            fetchTimeSec: 0,
            statementOrder,
            startedAt: startedAtIso,
            finishedAt: new Date().toISOString(),
            statusText: entry.error || t('resultPanel.execFailed'),
          };
          pendingMetaTabs.push(errorTab);
          pendingResultTabs.push(errorTab);
        } else if (entry.resultType === 'query' && entry.queryResult) {
          const result = entry.queryResult;
          const queryTab: ResultTab = {
            id: `result_${Date.now()}_${statementIndex}`,
            type: 'query',
            title: t('resultPanel.queryResult', { count: result.rows.length }),
            data: result,
            sql: statement,
            executionTimeSec: result.queryTimeSecs,
            fetchTimeSec: result.fetchTimeSecs,
            statementOrder,
            startedAt: startedAtIso,
            finishedAt: new Date().toISOString(),
            statusText: 'OK',
          };
          pendingMetaTabs.push(queryTab);
          pendingResultTabs.push(queryTab);
          successCount++;
        } else if (entry.resultType === 'exec' && entry.execResult) {
          const result = entry.execResult;
          const updateTab: ResultTab = {
            id: `result_${Date.now()}_${statementIndex}`,
            type: 'update',
            title: t('resultPanel.updateResult'),
            data: result,
            sql: statement,
            executionTimeSec: result.queryTimeSecs,
            fetchTimeSec: 0,
            statementOrder,
            startedAt: startedAtIso,
            finishedAt: new Date().toISOString(),
            statusText: 'OK',
          };
          pendingMetaTabs.push(updateTab);
          if (canAppendResultTab(updateTab)) {
            pendingResultTabs.push(updateTab);
          }
          successCount++;
        }

        const useDatabase = extractUseDatabaseFromStatement(statement);
        if (useDatabase) {
          lastDetectedUseDatabase = useDatabase;
        }

        if (isMetadataMutatingSql(statementWithoutLeadingComments)) {
          metadataChanged = true;
          extractAffectedDatabasesFromDdl(statementWithoutLeadingComments, selectedDatabase).forEach((dbName) => {
            affectedMetadataDatabases.add(dbName);
          });

          if (isDatabaseListMutatingSql(statementWithoutLeadingComments)) {
            databaseListChanged = true;
          }
        }

        flushResultTabs();
        flushMetaTabs();

        if (encounteredExecutionError) {
          break;
        }
      }

      flushResultTabs(true);
      flushMetaTabs(true);

      if (lastDetectedUseDatabase) {
        setSelectedDatabase(lastDetectedUseDatabase);
        setActiveDatabase(lastDetectedUseDatabase);
        if (selectedConnection?.name) {
          setLastUsedDatabaseForConnection(selectedConnection.name, lastDetectedUseDatabase);
        }
      }

      if (metadataChanged) {
        notifySQLMetadataChanged({
          source: 'query-tab',
          tabId,
          profile: selectedConnection,
          databases: Array.from(affectedMetadataDatabases),
          invalidateDatabasesList: databaseListChanged,
        });
      }

      const wallDurationSec = ((performance.now() - wallStart) / 1000).toFixed(3);
      setExecutionWallTimeSec(Number(wallDurationSec));
      setStatusMessage(t('resultPanel.execComplete', {
        success: successCount,
        error: errorCount,
        time: wallDurationSec,
      }));
    } catch (error) {
      // 单语句快路径/脚本路径在调用层抛错时（连接失败、致命 SQL 错误等），
      // 不能把结果区留在“空提示”状态：写入一个 error Tab，让消息/概览子页可展示。
      const message = error instanceof Error ? error.message : String(error);
      const errorText = message || t('resultPanel.execFailed');
      const errorTab: ResultTab = {
        id: `result_${Date.now()}_error`,
        type: 'error',
        title: t('resultPanel.errorResult'),
        data: errorText,
        sql,
        executionTimeSec: 0,
        fetchTimeSec: 0,
        statementOrder: 1,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        statusText: errorText,
      };
      React.startTransition(() => {
        setResultTabs([errorTab]);
        setMetaResultTabs([errorTab]);
        setActiveResultTabId(errorTab.id);
      });
      setStatusMessage(errorText);
    } finally {
      setIsExecuting(false);
    }
  }, [
    isConnected,
    poolId,
    connId,
    editorRef,
    expandResultPanel,
    fetchQueryPage,
    hydrateQueryTotalForTab,
    isServerPageableSql,
    isStoredProcedureCallLike,
    selectedConnection,
    selectedDatabase,
    setSelectedDatabase,
    tabId,
    t,
    setStatusMessage,
    setActiveDatabase,
    setLastUsedDatabaseForConnection,
  ]);

  const requestQueryPage = useCallback(async (tabId: string, page: number, pageSize: number) => {
    if (!isConnected || !poolId || !connId) {
      setStatusMessage(t('error.noActiveConnection'));
      return;
    }

    const targetTab = resultTabs.find((tab) => tab.id === tabId && tab.type === 'query');
    if (!targetTab) return;

    const queryData = targetTab.data as QueryResultData;
    const sourceSql = queryData.sourceSql || targetTab.sql;
    if (!sourceSql || !isServerPageableSql(sourceSql)) return;

    try {
      setStatusMessage(t('status.executing'));
      const nextPageData = await fetchQueryPage(sourceSql, page, pageSize, false);

      React.startTransition(() => {
        setResultTabs((prev) => prev.map((tab) => {
          if (tab.id !== tabId || tab.type !== 'query') return tab;

          return {
            ...tab,
            title: t('resultPanel.queryResult', { count: nextPageData.rows.length }),
            data: nextPageData,
            executionTimeSec: nextPageData.queryTimeSecs,
            fetchTimeSec: nextPageData.fetchTimeSecs,
            finishedAt: new Date().toISOString(),
            statusText: 'OK',
          };
        }));
        setMetaResultTabs((prev) => prev.map((tab) => {
          if (tab.id !== tabId || tab.type !== 'query') return tab;

          return {
            ...tab,
            title: t('resultPanel.queryResult', { count: nextPageData.rows.length }),
            data: nextPageData,
            executionTimeSec: nextPageData.queryTimeSecs,
            fetchTimeSec: nextPageData.fetchTimeSecs,
            finishedAt: new Date().toISOString(),
            statusText: 'OK',
          };
        }));
      });

      if (nextPageData.pagination && (nextPageData.pagination.totalRows == null || nextPageData.pagination.totalPages == null)) {
        void hydrateQueryTotalForTab(
          tabId,
          sourceSql,
          nextPageData.pagination.page,
          nextPageData.pagination.pageSize,
        );
      }

      setStatusMessage(t('resultPanel.execSuccess'));
    } catch (error) {
      setStatusMessage(t('error.queryFailed', { message: String(error) }));
    }
  }, [
    isConnected,
    poolId,
    connId,
    resultTabs,
    isServerPageableSql,
    fetchQueryPage,
    hydrateQueryTotalForTab,
    t,
    setStatusMessage,
  ]);

  const explainSql = useCallback(async () => {
    if (!isConnected || !poolId || !connId) {
      setStatusMessage(t('error.noActiveConnection'));
      return;
    }

    const editor = editorRef.current;
    if (!editor) return;

    const sql = editor.getValue().trim();

    if (!sql) {
      setStatusMessage(t('query.noQuery'));
      return;
    }

    setIsExecuting(true);
    try {
      const explainSqlText = `EXPLAIN ${sql}`;
      const result = await queryApi.query(poolId, connId, explainSqlText);

      const resultTab: ResultTab = {
        id: `result_${Date.now()}_explain`,
        type: 'query',
        title: t('resultPanel.explainResult'),
        data: result,
        sql: explainSqlText,
      };

      setResultTabs(prev => [...prev, resultTab]);
      setMetaResultTabs(prev => [...prev, resultTab]);
      setActiveResultTabId(resultTab.id);
      setStatusMessage(t('resultPanel.explainSuccess'));
    } catch (error) {
      setStatusMessage(t('resultPanel.explainFailed'));
    } finally {
      setIsExecuting(false);
    }
  }, [isConnected, poolId, connId, editorRef, t, setStatusMessage]);

  const clearResults = useCallback(() => {
    setResultTabs([]);
    setMetaResultTabs([]);
    setActiveResultTabId(null);
    setExecutionWallTimeSec(null);
  }, []);

  const closeResultTab = useCallback((id: string) => {
    setResultTabs(prev => {
      const newTabs = prev.filter(tab => tab.id !== id);
      if (activeResultTabId === id) {
        setActiveResultTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
      }
      return newTabs;
    });
  }, [activeResultTabId]);

  return {
    isExecuting,
    resultTabs,
    metaResultTabs,
    activeResultTabId,
    executionWallTimeSec,
    setActiveResultTabId,
    executeSql,
    requestQueryPage,
    explainSql,
    clearResults,
    closeResultTab,
  };
};
