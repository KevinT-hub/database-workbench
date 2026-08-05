// useFunctionPool.ts —— 函数/存储过程设计器专用连接池 hook
//
// 收敛 FunctionDesignerTab 内联的 pool 生命周期（create/getConnection/close）。
// 修复：原内联 cleanup 闭包捕获首次渲染的 poolId/connId（恒为 null），
// 导致 tab 卸载时连接池从未释放；改用 ref 记录最新值，确保真正清理。

import { useEffect, useRef, useState } from 'react';
import { poolApi } from '@/api/pool';
import type { ConnectionProfile } from '@/types';

export const useFunctionPool = (connectionProfile: ConnectionProfile) => {
  const [poolId, setPoolId] = useState<number | null>(null);
  const [connId, setConnId] = useState<number | null>(null);
  const poolIdRef = useRef<number | null>(null);
  const connIdRef = useRef<number | null>(null);

  useEffect(() => {
    const initConnection = async () => {
      if (!connectionProfile) return;

      try {
        const newPoolId = await poolApi.create(connectionProfile);
        const newConnId = await poolApi.getConnection(newPoolId);
        poolIdRef.current = newPoolId;
        connIdRef.current = newConnId;
        setPoolId(newPoolId);
        setConnId(newConnId);
      } catch (err) {
        console.error('Failed to create connection:', err);
      }
    };

    void initConnection();

    return () => {
      const currentPoolId = poolIdRef.current;
      const currentConnId = connIdRef.current;
      if (currentPoolId !== null && currentConnId !== null) {
        poolApi.releaseConnection(currentPoolId, currentConnId).catch(() => {});
        poolApi.close(currentPoolId).catch(() => {});
      }
    };
  }, [connectionProfile]);

  return { poolId, connId };
};
