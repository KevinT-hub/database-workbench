// useViewDesignerActions.ts —— 视图设计器保存/新建动作 hook
//
// 收敛 ViewDesignerTab 内联的 SQL 构建 + ddlApi 执行 + 补全元数据通知，
// 组件不再直接 import api 模块（阶段 3：API 调用统一化）。

import { useCallback } from 'react';
import { ddlApi } from '@/api/ddl';
import { notifySQLMetadataChanged } from '@/completion';
import type { ConnectionProfile } from '@/types';

interface ViewDesignerActionsOptions {
  connectionProfile: ConnectionProfile;
  database: string;
}

export const useViewDesignerActions = ({
  connectionProfile,
  database,
}: ViewDesignerActionsOptions) => {
  const saveView = useCallback(
    async (viewName: string, sqlDefinition: string, isNewView: boolean) => {
      const escapedName = viewName.trim().replace(/`/g, '``');
      const createViewSql = `CREATE OR REPLACE VIEW \`${escapedName}\` AS ${sqlDefinition.trim()}`;

      await ddlApi.executeSql(connectionProfile, createViewSql, database);

      notifySQLMetadataChanged({
        source: 'view-designer',
        profile: connectionProfile,
        databases: [database],
        viewName: viewName.trim(),
        action: isNewView ? 'create-or-replace' : 'replace',
      });
    },
    [connectionProfile, database],
  );

  const createView = useCallback(
    async (viewName: string, sqlDefinition: string) => {
      const escapedName = viewName.trim().replace(/`/g, '``');
      const createViewSql = `CREATE VIEW \`${escapedName}\` AS ${sqlDefinition.trim()}`;

      await ddlApi.executeSql(connectionProfile, createViewSql, database);

      notifySQLMetadataChanged({
        source: 'view-designer',
        profile: connectionProfile,
        databases: [database],
        viewName: viewName.trim(),
        action: 'create',
      });
    },
    [connectionProfile, database],
  );

  return { saveView, createView };
};
