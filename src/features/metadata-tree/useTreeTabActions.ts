// 元数据树 Tab 打开动作 Hook：数据/设计器/函数设计器等标签页。

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTabStore } from '@/stores';
import type { ConnectionProfile, DesignerActionRequest } from '@/types';

export const useTreeTabActions = () => {
  const { t } = useTranslation();
  const { addTab, setActiveTab, updateTab } = useTabStore();

  const getConnectionName = useCallback((profile?: ConnectionProfile): string => {
    return profile?.name || `${profile?.host}:${profile?.port}`;
  }, []);

  const openTableDataTab = useCallback((profile: ConnectionProfile, database: string, tableName: string) => {
    addTab({
      type: 'tableData',
      title: t('tabTitles.tableData', { tableName, database, connectionName: getConnectionName(profile) }),
      connectionId: profile.name,
      connectionProfile: profile,
      database,
      table: tableName,
    });
  }, [addTab, getConnectionName, t]);

  const openViewDataTab = useCallback((profile: ConnectionProfile, database: string, viewName: string) => {
    addTab({
      type: 'viewData',
      title: t('tabTitles.viewData', { viewName, database, connectionName: getConnectionName(profile) }),
      connectionId: profile.name,
      connectionProfile: profile,
      database,
      objectName: viewName,
    });
  }, [addTab, getConnectionName, t]);

  const openTableDesignerTab = useCallback((profile: ConnectionProfile, database?: string, tableName?: string) => {
    let title = t('tabTitles.designer.new');
    if (tableName) {
      title = t('tabTitles.designer.edit', { tableName });
    } else if (database) {
      title = t('tabTitles.designer.newWithDatabase', { database });
    }
    addTab({
      type: 'designer',
      title,
      connectionId: profile.name,
      connectionProfile: profile,
      database,
      table: tableName,
    });
  }, [addTab, t]);

  const openDesignerWithAction = useCallback((
    profile: ConnectionProfile,
    targetDatabase: string,
    targetTable: string,
    action: Omit<DesignerActionRequest, 'nonce'>,
  ) => {
    const payload: DesignerActionRequest = { ...action, nonce: Date.now() };
    const findMatchingDesignerTab = () => useTabStore.getState().tabs.find((tab) => (
      tab.type === 'designer' &&
      tab.connectionId === profile.name &&
      tab.database === targetDatabase &&
      tab.table === targetTable
    ));

    const existingTab = findMatchingDesignerTab();
    if (existingTab) {
      updateTab(existingTab.id, {
        data: { ...(existingTab.data as Record<string, unknown> | undefined), designerAction: payload },
      });
      setActiveTab(existingTab.id);
      return;
    }

    addTab({
      type: 'designer',
      title: t('tabTitles.designer.edit', { tableName: targetTable }),
      connectionId: profile.name,
      connectionProfile: profile,
      database: targetDatabase,
      table: targetTable,
      data: { designerAction: payload },
    });

    const latestMatch = findMatchingDesignerTab();
    if (latestMatch) {
      updateTab(latestMatch.id, {
        data: { ...(latestMatch.data as Record<string, unknown> | undefined), designerAction: payload },
      });
      setActiveTab(latestMatch.id);
    }
  }, [addTab, setActiveTab, t, updateTab]);

  const openViewDesignerTab = useCallback((profile: ConnectionProfile, database: string, viewName: string) => {
    addTab({
      type: 'viewDesigner',
      title: t('tabTitles.viewDesigner', { viewName }),
      connectionId: profile.name,
      connectionProfile: profile,
      database,
      objectName: viewName,
    });
  }, [addTab, t]);

  const openFunctionDesignerTab = useCallback((
    profile: ConnectionProfile,
    database: string,
    functionName?: string,
    functionType: 'FUNCTION' | 'PROCEDURE' = 'FUNCTION',
    autoExecute?: boolean,
  ) => {
    const title = functionName
      ? (functionType === 'PROCEDURE'
        ? t('tabTitles.functionDesigner.editProcedure', { name: functionName })
        : t('tabTitles.functionDesigner.editFunction', { name: functionName }))
      : (functionType === 'PROCEDURE'
        ? t('tabTitles.functionDesigner.newProcedure')
        : t('tabTitles.functionDesigner.newFunction'));
    addTab({
      type: 'functionDesigner',
      title,
      connectionId: profile.name,
      connectionProfile: profile,
      database,
      objectName: functionName || undefined,
      data: { functionType, autoExecute },
    });
  }, [addTab, t]);

  return {
    getConnectionName,
    openTableDataTab,
    openViewDataTab,
    openTableDesignerTab,
    openDesignerWithAction,
    openViewDesignerTab,
    openFunctionDesignerTab,
  };
};
