// useFunctionDesignerActions.ts —— 函数/存储过程保存动作 hook
//
// 收敛 FunctionDesignerTab 内联的 DROP + CREATE DDL 执行，
// 组件不再直接 import api 模块（阶段 3：API 调用统一化）。

import { useCallback } from 'react';
import { ddlApi } from '@/api/ddl';
import type { ConnectionProfile } from '@/types';

interface FunctionDesignerActionsOptions {
  connectionProfile: ConnectionProfile;
  database: string;
}

export const useFunctionDesignerActions = ({
  connectionProfile,
  database,
}: FunctionDesignerActionsOptions) => {
  const dropRoutine = useCallback(
    async (type: 'FUNCTION' | 'PROCEDURE', savedName: string) => {
      const escapedDatabase = database.replace(/`/g, '``');
      const escapedSavedName = savedName.replace(/`/g, '``');
      const dropSql = `DROP ${type} IF EXISTS \`${escapedDatabase}\`.\`${escapedSavedName}\`;`;
      await ddlApi.executeSql(connectionProfile, dropSql, database);
    },
    [connectionProfile, database],
  );

  const executeRoutineSql = useCallback(
    (sql: string): Promise<void> =>
      ddlApi.executeSql(connectionProfile, sql, database),
    [connectionProfile, database],
  );

  return { dropRoutine, executeRoutineSql };
};
