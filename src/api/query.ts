// api/query.ts —— SQL 查询/执行命令（属于 pool_query/execute 系列）

import { invoke } from './client';
import type {
  QueryResult,
  QueryPageResultData,
  ExecResult,
  SqlParam,
  MultiQueryResultData,
  ScriptExecuteResultData,
} from '../types/query';

export const queryApi = {
  query: (poolId: number, connId: number, sql: string): Promise<QueryResult> =>
    invoke<QueryResult>('pool_query', { poolId, connId, sql }),

  queryPage: (
    poolId: number,
    connId: number,
    sql: string,
    page: number,
    pageSize: number,
    includeTotal?: boolean,
  ): Promise<QueryPageResultData> =>
    invoke<QueryPageResultData>('pool_query_page', {
      poolId,
      connId,
      sql,
      page,
      pageSize,
      includeTotal,
    }),

  execute: (poolId: number, connId: number, sql: string): Promise<ExecResult> =>
    invoke<ExecResult>('pool_execute', { poolId, connId, sql }),

  /** 多结果集查询（存储过程 CALL 等） */
  queryMulti: (poolId: number, connId: number, sql: string): Promise<MultiQueryResultData> =>
    invoke<MultiQueryResultData>('pool_query_multi', { poolId, connId, sql }),

  queryPrepared: (
    poolId: number,
    connId: number,
    sql: string,
    params: SqlParam[],
  ): Promise<QueryResult> =>
    invoke<QueryResult>('pool_query_prepared', { poolId, connId, sql, params }),

  executePrepared: (
    poolId: number,
    connId: number,
    sql: string,
    params: SqlParam[],
  ): Promise<ExecResult> =>
    invoke<ExecResult>('pool_execute_prepared', { poolId, connId, sql, params }),

  /**
   * 在专用事务连接上一次性执行完整 SQL 脚本，返回每条语句的执行结果。
   *
   * 用于新建查询的多语句脚本执行场景：后端保证所有语句在同一物理连接上执行
   * （修复 1046），使用 DELIMITER 感知切分（修复复合语句被切碎 + 中文），
   * 走 raw_sql 简单查询协议（修复 prepared statement 1295）。
   */
  executeScript: (
    poolId: number,
    connId: number,
    sql: string,
    database?: string,
    stopOnError?: boolean,
  ): Promise<ScriptExecuteResultData> =>
    invoke<ScriptExecuteResultData>('pool_execute_script', {
      poolId,
      connId,
      sql,
      database,
      stopOnError,
    }),
};
