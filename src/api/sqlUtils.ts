// api/sqlUtils.ts —— SQL 工具命令

import { invoke } from './client';
import type { DbType } from '../types/connection';

export const sqlUtilsApi = {
  format: (sql: string, dbType: DbType): Promise<string> =>
    invoke<string>('sql_format', { sql, dbType }),

  extractViewSelect: (ddl: string, dbType: DbType): Promise<string | null> =>
    invoke<string | null>('sql_extract_view_select', { ddl, dbType }),

  splitStatements: (sql: string, dbType: DbType): Promise<string[]> =>
    invoke<string[]>('sql_split_statements', { sql, dbType }),
};
