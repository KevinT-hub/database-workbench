// useFunctionExecutor.ts —— 函数/存储过程执行 hook
//
// 收敛 FunctionDesignerTab 内联的执行 SQL 构建 + pool_set_database +
// queryMulti/query 调用（含 OUT 参数读取），组件不再直接 import api 模块。

import { useCallback } from 'react';
import { poolApi } from '@/api/pool';
import { queryApi } from '@/api/query';
import type { RoutineParamInfo, QueryResultData } from '@/types';

interface FunctionExecutorOptions {
  poolId: number | null;
  connId: number | null;
  savedName: string | null;
  type: 'FUNCTION' | 'PROCEDURE';
  database: string;
}

export const useFunctionExecutor = ({
  poolId,
  connId,
  savedName,
  type,
  database,
}: FunctionExecutorOptions) => {
  const runRoutine = useCallback(
    async (
      params: RoutineParamInfo[],
      values: Record<string, string>,
    ): Promise<QueryResultData[]> => {
      if (!poolId || !connId || !savedName) return [];

      // 通过 pool_set_database 登记当前数据库（后端权威状态），
      // 执行 CALL 时后端会在专用连接上先 USE，避免 1046 No database selected。
      await poolApi.setDatabase(poolId, connId, database);

      const inParams = params.filter((p) => p.mode === 'IN' || p.mode === 'INOUT');
      const outParams = params.filter((p) => p.mode === 'OUT' || p.mode === 'INOUT');

      let sql = '';
      if (type === 'FUNCTION') {
        const args = inParams.map((p) => values[p.name] || 'NULL').join(', ');
        sql = `SELECT \`${savedName}\`(${args}) AS result`;
      } else {
        const args = params
          .map((p) => {
            if (p.mode === 'OUT' || p.mode === 'INOUT') {
              return `@${p.name}`;
            }
            return values[p.name] || 'NULL';
          })
          .join(', ');
        sql = `CALL \`${savedName}\`(${args})`;
      }

      // 存储过程使用多结果集查询
      let results: QueryResultData[] = [];
      if (type === 'PROCEDURE') {
        const multiResult = await queryApi.queryMulti(poolId, connId, sql);
        results = multiResult.resultSets;
      } else {
        // 函数使用普通查询
        const result = await queryApi.query(poolId, connId, sql);
        results = [{
          columns: result.columns.map((col) => ({
            name: col.name,
            label: col.label,
            typeName: col.typeName,
          })),
          rows: result.rows,
        }];
      }

      // 若有 OUT 参数，读取会话变量
      if (type === 'PROCEDURE' && outParams.length > 0) {
        const selectOut = `SELECT ${outParams.map((p) => `@${p.name} AS ${p.name}`).join(', ')}`;
        const outResult = await queryApi.query(poolId, connId, selectOut);
        if (outResult.rows.length > 0) {
          results.push({
            columns: outResult.columns.map((col) => ({
              name: col.name,
              label: col.label,
              typeName: col.typeName,
            })),
            rows: outResult.rows,
          });
        }
      }

      return results;
    },
    [poolId, connId, savedName, type, database],
  );

  return { runRoutine };
};
