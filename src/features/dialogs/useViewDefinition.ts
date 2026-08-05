// useViewDefinition.ts —— 视图定义对话框数据 hook
//
// 收敛 ViewDefinitionDialog 内联的池生命周期 + SHOW CREATE VIEW 查询，
// 组件不再直接 import api 模块（阶段 3：API 调用统一化）。

import { useCallback, useState } from 'react';
import { poolApi } from '@/api/pool';
import { queryApi } from '@/api/query';
import type { ConnectionProfile } from '@/types';

interface ViewDefinitionState {
  ddl: string;
  isLoading: boolean;
  error: string | null;
}

const formatViewDDL = (ddl: string): string => {
  if (!ddl) return '';

  let formatted = ddl.trim();

  formatted = formatted.replace(/\s+/g, ' ');

  const keywords = [
    'CREATE', 'OR', 'REPLACE', 'VIEW', 'AS', 'SELECT', 'FROM', 'WHERE',
    'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AND', 'OR', 'NOT',
    'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL',
    'DISTINCT', 'INSERT', 'UPDATE', 'DELETE', 'SET', 'VALUES', 'INTO',
    'ALTER', 'TABLE', 'INDEX', 'KEY', 'PRIMARY', 'FOREIGN', 'REFERENCES',
    'CONSTRAINT', 'DEFAULT', 'NULL', 'NOT', 'UNIQUE', 'CHECK', 'CASCADE',
    'WITH', 'CASCADED', 'LOCAL', 'CHECK', 'OPTION',
  ];

  const upperKeywords = new Set(keywords);

  formatted = formatted.replace(/\b(\w+)\b/g, (match) => {
    if (upperKeywords.has(match.toUpperCase())) {
      return match.toUpperCase();
    }
    return match;
  });

  formatted = formatted.replace(/\s*,\s*/g, ',\n  ');

  const clauseKeywords = [
    'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY',
    'LIMIT', 'OFFSET', 'UNION', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN',
    'INNER JOIN', 'OUTER JOIN', 'ON', 'AND', 'OR',
  ];

  for (const keyword of clauseKeywords) {
    const regex = new RegExp(`\\s+${keyword}\\s+`, 'gi');
    formatted = formatted.replace(regex, `\n${keyword}\n  `);
  }

  formatted = formatted.replace(/\n\s*\n/g, '\n');

  formatted = formatted.trim();

  return formatted;
};

export const useViewDefinition = () => {
  const [state, setState] = useState<ViewDefinitionState>({
    ddl: '',
    isLoading: false,
    error: null,
  });

  const fetchViewDefinition = useCallback(
    async (connectionProfile: ConnectionProfile, database: string, viewName: string) => {
      setState({ ddl: '', isLoading: true, error: null });

      // 池生命周期审计修复：create/getConnection 任一步失败都要归还租约并关闭池，
      // 避免 getConnection 抛错（如 PoolNotFound）时池泄漏。
      let poolId: number | null = null;
      let connId: number | null = null;

      try {
        poolId = await poolApi.create(connectionProfile);
        connId = await poolApi.getConnection(poolId);

        const sql = `SHOW CREATE VIEW \`${database}\`.\`${viewName}\``;
        const result = await queryApi.query(poolId, connId, sql);

        if (result.rows && result.rows.length > 0) {
          const createViewColumn = result.columns.findIndex(
            (col) =>
              col.name.toLowerCase().includes('create view') ||
              col.name.toLowerCase() === 'create view',
          );

          const ddlIndex = createViewColumn >= 0 ? createViewColumn : 1;
          const rawDDL = String(result.rows[0][ddlIndex] || '');
          setState({ ddl: formatViewDDL(rawDDL), isLoading: false, error: null });
        } else {
          setState({ ddl: '', isLoading: false, error: '无法获取视图定义' });
        }
      } catch (err) {
        setState({
          ddl: '',
          isLoading: false,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        if (poolId !== null) {
          if (connId !== null) {
            await poolApi.releaseConnection(poolId, connId).catch(() => undefined);
          }
          await poolApi.close(poolId).catch(() => undefined);
        }
      }
    },
    [],
  );

  return {
    ...state,
    fetchViewDefinition,
  };
};
