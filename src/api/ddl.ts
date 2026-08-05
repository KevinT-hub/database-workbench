// api/ddl.ts —— 对象 DDL 执行命令（写操作，不走 metadataStore 缓存）
//
// 与 metadataApi（只读元数据）分离：调用方应在成功后失效 metadataStore 缓存。

import { invoke } from './client';
import type { ConnectionProfile } from '../types/connection';

export const ddlApi = {
  executeSql: (
    profile: ConnectionProfile,
    sql: string,
    database?: string,
  ): Promise<void> =>
    invoke<void>('metadata_execute_sql', { profile, sql, database }),
};
