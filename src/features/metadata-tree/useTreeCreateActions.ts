// 元数据树建库动作 Hook：CREATE DATABASE + 树节点即时插入。

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore, useMetadataStore } from '@/stores';
import { ddlApi } from '@/api';
import { buildDatabaseIcon } from './components/TreeNodeRenderer';
import type { TreeNode } from './treeUtils';
import type { TreeState } from './treeState';

export const useTreeCreateActions = (state: TreeState) => {
  const { t } = useTranslation();
  const { setStatusMessage } = useAppStore();

  const handleCreateDatabase = useCallback(async (name: string, charset: string, collation: string) => {
    const connection = state.dialogs.createDbDialog.connection;
    const targetNodeId = state.dialogs.createDbDialog.nodeId;
    if (!connection) return;

    try {
      setStatusMessage(t('metadataTree.creatingDatabase'));
      const sql = `CREATE DATABASE \`${name}\` CHARACTER SET ${charset} COLLATE ${collation}`;
      await ddlApi.executeSql(connection, sql);
      useMetadataStore.getState().invalidate(connection);
      setStatusMessage(t('metadataTree.databaseCreated', { name }));

      if (targetNodeId) {
        state.setNodes(prev => prev.map((node) => {
          if (String(node.id) !== targetNodeId) {
            return node;
          }

          const existingChildren = (node.childNodes as TreeNode[] | undefined) || [];
          const exists = existingChildren.some((child) => child.nodeData?.database === name);
          if (exists) {
            return node;
          }

          const createdNode: TreeNode = {
            id: `${targetNodeId}-${name}`,
            label: name,
            icon: buildDatabaseIcon(false, false),
            isExpanded: false,
            hasCaret: false,
            nodeData: {
              connection,
              database: name,
              isSystemDb: false,
              isDbOpened: false,
            },
          };

          const systemChildren = existingChildren.filter((child) => child.nodeData?.isSystemDb);
          const userChildren = existingChildren.filter((child) => !child.nodeData?.isSystemDb);
          const nextUserChildren = [...userChildren, createdNode].sort((a, b) => {
            const aLabel = String(a.label || '').toLowerCase();
            const bLabel = String(b.label || '').toLowerCase();
            return aLabel.localeCompare(bLabel);
          });

          return {
            ...node,
            hasCaret: true,
            childNodes: [...systemChildren, ...nextUserChildren],
          };
        }));
      }
    } catch (error) {
      console.error(t('metadataTree.createDatabaseFailed'), error);
      setStatusMessage(t('metadataTree.createFailed', { error: String(error) }));
    }
  }, [state, setStatusMessage, t]);

  return {
    handleCreateDatabase,
  };
};
