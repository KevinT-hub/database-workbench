// 元数据树删除/建库动作 Hook：确认对话框 + 执行 SQL + 树节点更新。

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore, useConnectionStore, useMetadataStore, useTabStore } from '@/stores';
import { ddlApi } from '@/api';
import {
  applySelectionToNodes,
  buildDeleteDesignerSql,
  buildDeleteObjectSql,
  type TreeNode,
} from './treeUtils';
import type { ConnectionProfile } from '@/types';
import type { TreeState } from './treeState';

interface TreeDeleteDeps {
  refreshFolderById: (folderId: string) => void;
  getParentFolderId: (nodeId: string) => string | undefined;
}

export const useTreeDeleteActions = (state: TreeState, deps: TreeDeleteDeps) => {
  const { t } = useTranslation();
  const { setStatusMessage } = useAppStore();
  const {
    activeConnectionId,
    activeDatabase,
    clearLastUsedDatabaseForConnection,
    removeConnection,
    setActiveConnection,
    setActiveDatabase,
    markDatabaseClosed,
  } = useConnectionStore();
  const { closeTabsForDatabase } = useTabStore();

  const handleDeleteMetadataObject = useCallback((node: TreeNode) => {
    const profile = node.nodeData?.connection;
    const database = node.nodeData?.database;
    const objectName = node.nodeData?.objectName || node.nodeData?.table;
    if (!profile || !database || !objectName) return;

    const built = buildDeleteObjectSql(node, t);
    if (!built) return;

    state.setConfirmDialog({
      isOpen: true,
      title: t('metadataTree.confirmDeleteObjectTitle'),
      message: t('metadataTree.confirmDeleteObjectMessage', { objectType: built.objectTypeText, name: objectName }),
      intent: 'danger',
      onConfirm: async () => {
        try {
          await ddlApi.executeSql(profile, built.sql, database);
          useMetadataStore.getState().invalidate(profile, database);
          setStatusMessage(t('metadataTree.objectDeleted', { objectType: built.objectTypeText, name: objectName }));

          const parentFolderId = deps.getParentFolderId(String(node.id));
          if (parentFolderId) {
            await deps.refreshFolderById(parentFolderId);
          }
        } catch (error) {
          console.error(t('metadataTree.objectDeleteFailed'), error);
          setStatusMessage(t('metadataTree.objectDeleteFailedWithError', { error: String(error) }));
        }
      },
    });
  }, [state, deps, setStatusMessage, t]);

  const handleDeleteDesignerObject = useCallback((
    profile: ConnectionProfile,
    database: string,
    tableName: string,
    itemType: 'column' | 'index' | 'foreignKey' | 'check' | 'trigger',
    objectName: string,
    objectTypeLabel: string,
    refreshParentFolder: () => void,
  ) => {
    const sql = buildDeleteDesignerSql(itemType, tableName, objectName);
    if (!sql) return;

    state.setConfirmDialog({
      isOpen: true,
      title: t('metadataTree.confirmDeleteObjectTitle'),
      message: t('metadataTree.confirmDeleteObjectMessage', { objectType: objectTypeLabel, name: objectName }),
      intent: 'danger',
      onConfirm: async () => {
        try {
          await ddlApi.executeSql(profile, sql, database);
          useMetadataStore.getState().invalidate(profile, database);
          setStatusMessage(t('metadataTree.objectDeleted', { objectType: objectTypeLabel, name: objectName }));
          refreshParentFolder();
        } catch (error) {
          console.error(t('metadataTree.objectDeleteFailed'), error);
          setStatusMessage(t('metadataTree.objectDeleteFailedWithError', { error: String(error) }));
        }
      },
    });
  }, [state, setStatusMessage, t]);

  const handleDeleteDatabase = useCallback(async (node: TreeNode) => {
    if (!node.nodeData?.connection || !node.nodeData?.database) return;
    const dbName = node.nodeData.database;
    const isSystemDb = node.nodeData.isSystemDb;

    if (isSystemDb) {
      state.setAlertDialog({ isOpen: true, message: t('metadataTree.systemDbProtected') });
      return;
    }

    state.setConfirmDialog({
      isOpen: true,
      title: t('metadataTree.confirmDeleteDatabase'),
      message: t('metadataTree.deleteDatabaseWarning', { name: dbName }),
      intent: 'danger',
      onConfirm: async () => {
        try {
          setStatusMessage(t('metadataTree.deletingDatabase'));
          const sql = `DROP DATABASE \`${dbName}\``;
          await ddlApi.executeSql(node.nodeData!.connection!, sql);
          useMetadataStore.getState().invalidate(node.nodeData!.connection!);
          setStatusMessage(t('metadataTree.databaseDeleted', { name: dbName }));

          const nodeId = node.id as string;
          const connectionName = node.nodeData?.connection?.name;
          const connectionNodeId = (nodeId.split('-').slice(0, -1).join('-')) || undefined;

          // 数据库已被删除：同步已打开数据库注册表，并连带关闭该库下打开的所有依赖型 tab
          if (connectionName && dbName) {
            markDatabaseClosed(connectionName, dbName);
            closeTabsForDatabase(connectionName, dbName);
          }

          if (connectionName && activeConnectionId === connectionName && activeDatabase === dbName) {
            setActiveConnection(connectionName);
            setActiveDatabase(null);
            clearLastUsedDatabaseForConnection(connectionName);
            if (connectionNodeId) {
              state.setSelectedNodeId(connectionNodeId);
            }
          }

          state.setNodes(prev => {
            const removeDbNode = (nodes: TreeNode[]): TreeNode[] => {
              return nodes.map(n => {
                if (String(n.id) === connectionNodeId) {
                  return {
                    ...n,
                    isSelected: connectionNodeId ? true : n.isSelected,
                    childNodes: n.childNodes
                      ? (n.childNodes as TreeNode[]).filter(child => child.id !== nodeId)
                      : n.childNodes,
                  };
                }
                if (n.childNodes) {
                  return { ...n, childNodes: (n.childNodes as TreeNode[]).filter(child => child.id !== nodeId) };
                }
                return n;
              });
            };
            return applySelectionToNodes(removeDbNode(prev), connectionNodeId || null);
          });
        } catch (error) {
          console.error(t('metadataTree.deleteDatabaseFailed'), error);
          setStatusMessage(t('metadataTree.deleteFailed', { error: String(error) }));
        }
      },
    });
  }, [
    state,
    activeConnectionId,
    activeDatabase,
    clearLastUsedDatabaseForConnection,
    markDatabaseClosed,
    closeTabsForDatabase,
    setActiveConnection,
    setActiveDatabase,
    setStatusMessage,
    t,
  ]);

  const handleDeleteConnection = useCallback((node: TreeNode) => {
    const connName = node.nodeData?.connection?.name;
    if (!connName) return;

    state.setConfirmDialog({
      isOpen: true,
      title: t('metadataTree.confirmDeleteConnection'),
      message: t('metadataTree.deleteConnectionWarning', { name: connName }),
      intent: 'danger',
      onConfirm: () => {
        removeConnection(connName);
        setStatusMessage(t('metadataTree.connectionDeleted', { name: connName }));
      },
    });
  }, [state, removeConnection, setStatusMessage, t]);

  return {
    handleDeleteMetadataObject,
    handleDeleteDesignerObject,
    handleDeleteDatabase,
    handleDeleteConnection,
  };
};
