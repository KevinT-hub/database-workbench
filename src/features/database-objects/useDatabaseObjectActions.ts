// useDatabaseObjectActions.ts —— 数据库对象删除动作 hook
//
// 收敛 DatabaseObjectTab 内联的 DROP SQL 构建 + ddlApi 执行 + 元数据缓存失效，
// 组件不再直接 import api 模块（阶段 3：API 调用统一化）。

import { useCallback } from 'react';
import { ddlApi } from '@/api/ddl';
import { useMetadataStore } from '@/stores';
import type {
  ConnectionProfile,
  TableDetail,
  ViewDetail,
  FunctionDetail,
  ObjectType,
} from '@/types';

type DatabaseObjectData = TableDetail | ViewDetail | FunctionDetail;

interface DropObjectOptions {
  connectionProfile: ConnectionProfile;
  database: string;
  objectType: ObjectType;
  objectName: string;
  objects: DatabaseObjectData[];
}

export const useDatabaseObjectActions = () => {
  const dropObject = useCallback(
    async ({
      connectionProfile,
      database,
      objectType,
      objectName,
      objects,
    }: DropObjectOptions) => {
      let sql = '';
      switch (objectType) {
        case 'TABLE':
          sql = `DROP TABLE \`${objectName.replace(/`/g, '``')}\``;
          break;
        case 'VIEW':
          sql = `DROP VIEW \`${objectName.replace(/`/g, '``')}\``;
          break;
        case 'FUNCTION': {
          const funcToDelete = objects.find(
            (obj) => 'Name' in obj && obj.Name === objectName,
          ) as FunctionDetail | undefined;
          const funcType = funcToDelete?.Type === 'PROCEDURE' ? 'PROCEDURE' : 'FUNCTION';
          sql = `DROP ${funcType} \`${objectName.replace(/`/g, '``')}\``;
          break;
        }
      }

      await ddlApi.executeSql(connectionProfile, sql, database);
      useMetadataStore.getState().invalidate(connectionProfile, database);
    },
    [],
  );

  return { dropObject };
};
