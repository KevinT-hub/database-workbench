// 元数据树刷新动作 Hook：整体刷新所有已打开连接/数据库。

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/stores';
import type { TreeNode } from './treeUtils';
import type { TreeState } from './treeState';

interface TreeRefreshDeps {
  connectConnection: (node: TreeNode) => Promise<void>;
  connectDatabase: (node: TreeNode) => Promise<void>;
}

export const useTreeRefreshActions = (state: TreeState, deps: TreeRefreshDeps) => {
  const { t } = useTranslation();
  const { setStatusMessage } = useAppStore();

  const refreshMetadataTree = useCallback(async () => {
    const currentNodes = state.nodesRef.current;
    const connectedNodes = currentNodes.filter((node) => {
      return Boolean(
        node.nodeData?.connection && node.childNodes && (node.childNodes as TreeNode[]).length > 0
      );
    });

    if (connectedNodes.length === 0) {
      setStatusMessage(t('metadataTree.noMetadataToRefresh'));
      return;
    }

    setStatusMessage(t('metadataTree.refreshingMetadata'));

    for (const connectionNode of connectedNodes) {
      const openedDatabases = ((connectionNode.childNodes as TreeNode[]) || [])
        .filter((dbNode) => dbNode.nodeData?.database && dbNode.nodeData?.isDbOpened)
        .map((dbNode) => dbNode.nodeData?.database)
        .filter((dbName): dbName is string => Boolean(dbName));

      await deps.connectConnection(connectionNode);

      const latestConnectionNode = state.nodesRef.current.find((node) => node.id === connectionNode.id);
      if (!latestConnectionNode?.childNodes || openedDatabases.length === 0) {
        continue;
      }

      for (const dbName of openedDatabases) {
        const dbNode = (latestConnectionNode.childNodes as TreeNode[]).find(
          (child) => child.nodeData?.database === dbName,
        );
        if (dbNode) {
          await deps.connectDatabase(dbNode);
        }
      }
    }

    setStatusMessage(t('metadataTree.metadataRefreshed'));
  }, [state, deps, setStatusMessage, t]);

  return {
    refreshMetadataTree,
  };
};
