// api/pool.ts —— 连接池管理命令

import { invoke } from './client';
import type {
  ConnectionProfile,
  PoolStats,
  ConnectionProperties,
} from '../types/connection';

export const poolApi = {
  create: (profile: ConnectionProfile): Promise<number> =>
    invoke<number>('pool_create', { profile }),

  getConnection: (poolId: number, initialDatabase?: string | null): Promise<number> =>
    invoke<number>('pool_get_connection', {
      poolId,
      initialDatabase: initialDatabase ?? null,
    }),

  /** 记录并切换连接的当前数据库（后端以 conn_database 为权威状态） */
  setDatabase: (poolId: number, connId: number, database: string): Promise<void> =>
    invoke<void>('pool_set_database', { poolId, connId, database }),

  releaseConnection: (poolId: number, connId: number): Promise<boolean> =>
    invoke<boolean>('pool_release_connection', { poolId, connId }),

  testConnection: (profile: ConnectionProfile): Promise<boolean> =>
    invoke<boolean>('pool_test_connection', { profile }),

  getStats: (poolId: number): Promise<PoolStats> =>
    invoke<PoolStats>('pool_get_stats', { poolId }),

  getConnectionProperties: (
    poolId: number,
    database?: string | null,
  ): Promise<ConnectionProperties> =>
    invoke<ConnectionProperties>('pool_get_connection_properties', {
      poolId,
      database: database ?? null,
    }),

  close: (poolId: number): Promise<void> =>
    invoke<void>('pool_close', { poolId }),

  closeAll: (): Promise<void> => invoke<void>('pool_close_all'),
};
