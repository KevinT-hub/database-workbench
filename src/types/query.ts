// 查询相关类型

export interface SqlParam {
  type: string;
  value: unknown;
}

export interface ColumnMeta {
  name: string;
  label: string;
  typeName: string;
}

export interface QueryResult {
  columns: ColumnMeta[];
  rows: unknown[][];
}

export interface ExecResult {
  affectedRows: number;
  lastInsertId: number;
}

// V2 后端字段对应（camelCase）
export interface QueryResultColumn {
  name: string;
  label: string;
  typeName: string;
}

export interface QueryResultData {
  columns: QueryResultColumn[];
  rows: unknown[][];
  queryTimeSecs?: number;
  fetchTimeSecs?: number;
  sourceSql?: string;
  pagination?: {
    page: number;
    pageSize: number;
    hasMore: boolean;
    totalRows?: number | null;
    totalPages?: number | null;
  };
}

export interface QueryPageResultData extends QueryResultData {
  page: number;
  pageSize: number;
  hasMore: boolean;
  totalRows?: number | null;
  totalPages?: number | null;
}

export interface MultiQueryResultData {
  resultSets: QueryResultData[];
  affectedRows: number;
  lastInsertId: number;
  queryTimeSecs?: number;
  fetchTimeSecs?: number;
}

export interface ExecResultData {
  affectedRows: number;
  lastInsertId: number;
  queryTimeSecs?: number;
}

export type ResultTabType = 'query' | 'update' | 'error';

export interface ResultTab {
  id: string;
  type: ResultTabType;
  title: string;
  data: QueryResultData | ExecResultData | string;
  sql: string;
  executionTimeSec?: number;
  fetchTimeSec?: number;
  statementOrder?: number;
  startedAt?: string;
  finishedAt?: string;
  statusText?: string;
}


// 脚本一次性执行（pool_execute_script）的结果类型
// 对应后端 models::query::{ScriptExecuteResult, ScriptExecutePageEntry}
type ScriptExecuteEntryType = 'query' | 'exec' | 'error';

export interface ScriptExecuteEntryData {
  resultType: ScriptExecuteEntryType;
  statementIndex: number;
  sql: string;
  queryResult?: QueryResultData;
  execResult?: ExecResultData;
  error?: string;
}

export interface ScriptExecuteResultData {
  entries: ScriptExecuteEntryData[];
  total: number;
  successCount: number;
  errorCount: number;
}
