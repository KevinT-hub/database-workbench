// useUserActions.ts —— 用户管理动作 hook
//
// 收敛 UserTab / UserEditorTab 的 userApi + ddlApi 调用（查询用户、加载模型、
// 生成 SQL、执行 DDL），组件不再直接 import api 模块（阶段 3：API 调用统一化）。

import { useCallback } from 'react';
import { userApi } from '@/api/user';
import { ddlApi } from '@/api/ddl';
import type { ConnectionProfile, UserModel, UserModelPayload, UserSummary } from '@/types';

export const useUserActions = () => {
  const getAllUsers = useCallback(
    (connectionProfile: ConnectionProfile): Promise<UserSummary[]> =>
      userApi.getAllUsers(connectionProfile),
    [],
  );

  const getUserModel = useCallback(
    (
      connectionProfile: ConnectionProfile,
      username: string,
      host: string,
    ): Promise<UserModelPayload> =>
      userApi.getUserModel(connectionProfile, username, host),
    [],
  );

  const generateUserSql = useCallback(
    (
      user: UserModel,
      isNewUser: boolean,
      original?: UserModel,
    ): Promise<string> =>
      userApi.generateUserSql(user, isNewUser, original),
    [],
  );

  const dropUser = useCallback(
    async (connectionProfile: ConnectionProfile, username: string, host: string) => {
      const sql = `DROP USER '${username.replace(/'/g, "''")}'@'${host.replace(/'/g, "''")}'`;
      await ddlApi.executeSql(connectionProfile, sql);
    },
    [],
  );

  const executeUserSql = useCallback(
    (connectionProfile: ConnectionProfile, sql: string): Promise<void> =>
      ddlApi.executeSql(connectionProfile, sql),
    [],
  );

  return {
    getAllUsers,
    getUserModel,
    generateUserSql,
    dropUser,
    executeUserSql,
  };
};
