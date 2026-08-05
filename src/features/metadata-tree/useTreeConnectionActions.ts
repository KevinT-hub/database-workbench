// 元数据树连接动作 Hook：连接/关闭连接、打开/关闭数据库、整体刷新。

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useConnectionStore,
  useAppStore,
  useMetadataStore,
  useTabStore,
} from '@/stores';
import { SYSTEM_DATABASES, type TreeNode } from './treeUtils';
import {
  buildConnectionIcon,
  buildDatabaseIcon,
  buildDatabaseFolderNodes,
} from './components/TreeNodeRenderer';
import type { TreeState } from './treeState';

export const useTreeConnectionActions = (state: TreeState) => {
  const { t } = useTranslation();
  const { setStatusMessage } = useAppStore();
  const {
    connect,
    disconnect,
    checkMaxConnections,
    setActiveConnection,
    markDatabaseOpened,
    markDatabaseClosed,
  } = useConnectionStore();
  const { closeTabsForDatabase } = useTabStore();

  const isConnectionConnected = useCallback((node: TreeNode): boolean => {
    return !!(node.childNodes && node.childNodes.length > 0);
  }, []);

  const isDatabaseOpened = useCallback((node: TreeNode): boolean => {
    return node.nodeData?.isDbOpened === true;
  }, []);

  const connectConnection = useCallback(async (node: TreeNode) => {
    if (!node.nodeData?.connection) return;
    const nodeId = node.id as string;
    if (state.loadingNodes.has(nodeId)) return;

    const { allowed, current, max } = checkMaxConnections();
    if (!allowed) {
      state.setAlertDialog({
        isOpen: true,
        message: t('metadataTree.maxConnectionsReached', { current, max }),
      });
      return;
    }

    state.setLoadingNodes(prev => new Set([...prev, nodeId]));

    try {
      const connectionName = node.nodeData.connection.name;
      if (connectionName) {
        await connect(connectionName);
      }

      setStatusMessage(t('metadataTree.loadingDatabases'));
      const databases = await useMetadataStore.getState().fetchDatabases(node.nodeData.connection);

      const systemDbs = databases.filter(db => SYSTEM_DATABASES.has(db.toLowerCase()));
      const userDbs = databases.filter(db => !SYSTEM_DATABASES.has(db.toLowerCase()));
      const allDbs = [...systemDbs, ...userDbs];

      const dbNodes: TreeNode[] = allDbs.map(db => ({
        id: `${nodeId}-${db}`,
        label: db,
        icon: buildDatabaseIcon(false, SYSTEM_DATABASES.has(db.toLowerCase())),
        className: SYSTEM_DATABASES.has(db.toLowerCase()) ? 'system-db-node' : undefined,
        isExpanded: false,
        hasCaret: false,
        nodeData: {
          connection: node.nodeData?.connection,
          database: db,
          isSystemDb: SYSTEM_DATABASES.has(db.toLowerCase()),
          isDbOpened: false,
        },
      }));

      state.setNodes(prev => prev.map(n =>
        n.id === nodeId
          ? {
              ...n,
              childNodes: dbNodes,
              isExpanded: true,
              hasCaret: true,
              icon: buildConnectionIcon(true),
            }
          : n
      ));
      if (node.nodeData?.connection?.name) {
        setActiveConnection(node.nodeData.connection.name);
      }
      setStatusMessage(t('metadataTree.databasesLoaded', { count: dbNodes.length }));
    } catch (error) {
      console.error(t('metadataTree.connectionFailed'), error);
      setStatusMessage(t('metadataTree.connectionFailedWithError', { error: String(error) }));
    } finally {
      state.setLoadingNodes(prev => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    }
  }, [state, connect, checkMaxConnections, setStatusMessage, setActiveConnection, t]);

  const closeConnection = useCallback(async (node: TreeNode) => {
    if (!node.nodeData?.connection) return;
    const nodeId = node.id as string;

    const connectionName = node.nodeData.connection.name;
    if (connectionName) {
      try {
        await disconnect(connectionName);
      } catch (e) {
        console.warn('关闭连接池失败', e);
      }
    }

    state.setNodes(prev => prev.map(n =>
      n.id === nodeId
        ? {
            ...n,
            childNodes: undefined,
            isExpanded: false,
            hasCaret: false,
            icon: buildConnectionIcon(false),
          }
        : n
    ));
    setStatusMessage(t('metadataTree.connectionClosed'));
  }, [state, disconnect, setStatusMessage, t]);

  const connectDatabase = useCallback(async (node: TreeNode) => {
    if (!node.nodeData?.connection || !node.nodeData?.database) return;
    const nodeId = node.id as string;
    if (state.loadingNodes.has(nodeId)) return;
    state.setLoadingNodes(prev => new Set([...prev, nodeId]));

    try {
      const folderNodes = buildDatabaseFolderNodes(
        nodeId,
        node.nodeData.connection,
        node.nodeData.database,
        t,
      );

      state.setNodes(prev => {
        const updateNode = (nodes: TreeNode[]): TreeNode[] => {
          return nodes.map(n => {
            if (n.id === nodeId) {
              return {
                ...n,
                childNodes: folderNodes,
                isExpanded: true,
                hasCaret: true,
                icon: buildDatabaseIcon(true, n.nodeData?.isSystemDb || false),
                nodeData: { ...n.nodeData!, isDbOpened: true },
              };
            }
            if (n.childNodes) {
              return { ...n, childNodes: updateNode(n.childNodes as TreeNode[]) };
            }
            return n;
          });
        };
        return updateNode(prev);
      });

      // 同步记录「该连接下已打开的数据库」：工具栏痕迹递推的数据库打开兜底依赖此注册表
      const connectionName = node.nodeData.connection.name;
      const database = node.nodeData.database;
      if (connectionName && database) {
        markDatabaseOpened(connectionName, database);
      }
    } catch (error) {
      console.error(t('metadataTree.openDatabaseFailed'), error);
    } finally {
      state.setLoadingNodes(prev => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    }
  }, [state, t, markDatabaseOpened]);

  const closeDatabase = useCallback(async (node: TreeNode) => {
    const nodeId = node.id as string;
    const connectionName = node.nodeData?.connection?.name;
    const database = node.nodeData?.database;

    state.setNodes(prev => {
      const updateNode = (nodes: TreeNode[]): TreeNode[] => {
        return nodes.map(n => {
          if (n.id === nodeId) {
            return {
              ...n,
              childNodes: undefined,
              isExpanded: false,
              hasCaret: false,
              icon: buildDatabaseIcon(false, n.nodeData?.isSystemDb || false),
              nodeData: { ...n.nodeData!, isDbOpened: false },
            };
          }
          if (n.childNodes) {
            return { ...n, childNodes: updateNode(n.childNodes as TreeNode[]) };
          }
          return n;
        });
      };
      return updateNode(prev);
    });

    // 关闭数据库：同步注册表，并按「连接 + 数据库」双字段精确匹配，
    // 连带关闭该库下打开的表/视图/函数列表、数据页、设计器等依赖型 tab。
    // 注意：仅在 A 连接 B 数据库下打开的 tab 才会被关闭；
    // 用户在 C 连接关闭 C 数据库不会影响 A 连接下的 tab。
    if (connectionName && database) {
      markDatabaseClosed(connectionName, database);
      closeTabsForDatabase(connectionName, database);
    }
    setStatusMessage(t('metadataTree.databaseClosed'));
  }, [state, setStatusMessage, t, markDatabaseClosed, closeTabsForDatabase]);

  return {
    isConnectionConnected,
    isDatabaseOpened,
    connectConnection,
    closeConnection,
    connectDatabase,
    closeDatabase,
  };
};
