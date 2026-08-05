// useQueryPool.ts —— 查询页连接池生命周期 hook
//
// 收敛 QueryTab 内联的池管理（create/getConnection/USE/setDatabase/release/close）、
// 切库与 SQL 执行/格式化动作。组件不再直接 import api 模块（阶段 3）。
// 通过 ref 记录最新 poolId/connId，确保卸载清理始终使用最新连接。

import { useCallback, useEffect, useRef, useState } from 'react';
import { poolApi } from '@/api/pool';
import { queryApi } from '@/api/query';
import { sqlUtilsApi } from '@/api/sqlUtils';
import type { ConnectionProfile } from '@/types';

interface OpenedPool {
  poolId: number;
  connId: number;
}

export const useQueryPool = () => {
  const [poolId, setPoolId] = useState<number | null>(null);
  const [connId, setConnId] = useState<number | null>(null);
  const poolIdRef = useRef<number | null>(null);
  const connIdRef = useRef<number | null>(null);

  const openWithTarget = useCallback(
    async (profile: ConnectionProfile, target?: string): Promise<OpenedPool> => {
      const newPoolId = await poolApi.create(profile);
      try {
        const newConnId = await poolApi.getConnection(newPoolId, target);

        if (target) {
          await queryApi.execute(newPoolId, newConnId, `USE \`${target.replace(/`/g, '``')}\``);
          await poolApi.setDatabase(newPoolId, newConnId, target);
        }

        return { poolId: newPoolId, connId: newConnId };
      } catch (error) {
        await poolApi.close(newPoolId).catch(() => undefined);
        throw error;
      }
    },
    [],
  );

  const closeCurrent = useCallback(async () => {
    const currentPoolId = poolIdRef.current;
    const currentConnId = connIdRef.current;
    try {
      if (currentPoolId && currentConnId) {
        await poolApi.releaseConnection(currentPoolId, currentConnId);
        await poolApi.close(currentPoolId);
      }
    } finally {
      // 无论关闭成功与否，都清空引用与状态，避免残留旧池阻塞后续连接
      poolIdRef.current = null;
      connIdRef.current = null;
      setPoolId(null);
      setConnId(null);
    }
  }, []);

  const applyOpened = useCallback((opened: OpenedPool) => {
    poolIdRef.current = opened.poolId;
    connIdRef.current = opened.connId;
    setPoolId(opened.poolId);
    setConnId(opened.connId);
  }, []);

  const executeSql = useCallback(async (sql: string) => {
    const currentPoolId = poolIdRef.current;
    const currentConnId = connIdRef.current;
    if (!currentPoolId || !currentConnId) return;
    await queryApi.execute(currentPoolId, currentConnId, sql);
  }, []);

  const switchDatabase = useCallback(async (database: string) => {
    const currentPoolId = poolIdRef.current;
    const currentConnId = connIdRef.current;
    if (!currentPoolId || !currentConnId) return;
    await queryApi.execute(currentPoolId, currentConnId, `USE \`${database.replace(/`/g, '``')}\``);
    await poolApi.setDatabase(currentPoolId, currentConnId, database);
  }, []);

  const formatSql = useCallback(
    (sql: string): Promise<string> => sqlUtilsApi.format(sql, 'MYSQL'),
    [],
  );

  // 卸载时释放连接（ref 确保 cleanup 始终拿到最新值）
  useEffect(
    () => () => {
      const currentPoolId = poolIdRef.current;
      const currentConnId = connIdRef.current;
      if (currentPoolId && currentConnId) {
        void poolApi.releaseConnection(currentPoolId, currentConnId).catch(() => undefined);
        void poolApi.close(currentPoolId).catch(() => undefined);
      }
    },
    [],
  );

  return {
    poolId,
    connId,
    openWithTarget,
    closeCurrent,
    applyOpened,
    executeSql,
    switchDatabase,
    formatSql,
  };
};
