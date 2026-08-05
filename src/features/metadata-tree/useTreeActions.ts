// 元数据树动作组合根：持有节点/加载状态与生命周期事件，
// 并按职责组合子 hook（连接、文件夹加载、Tab 打开、删除、交互）。

import { useState, useCallback, useMemo, useRef } from 'react';
import { showEditConnectionNotice } from '@/hooks';
import type { TreeNode } from './treeUtils';
import type { TreeState } from './treeState';
import { useTreeDialogs } from './useTreeDialogs';
import { useTreeConnectionActions } from './useTreeConnectionActions';
import { useTreeFolderLoader } from './useTreeFolderLoader';
import { useTreeTabActions } from './useTreeTabActions';
import { useTreeDeleteActions } from './useTreeDeleteActions';
import { useTreeRefreshActions } from './useTreeRefreshActions';
import { useTreeCreateActions } from './useTreeCreateActions';
import { useTreeSelectionActions } from './useTreeSelectionActions';
import { useTreeEvents } from './useTreeEvents';


export const useTreeActions = () => {
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const nodesRef = useRef<TreeNode[]>([]);
  const [, setSelectedNodeId] = useState<string | null>(null);
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());

  const dialogs = useTreeDialogs();

  // 稳定引用：state 必须是 memo 化的，否则每次渲染新建对象会让所有子 hook
  // 的 useCallback/useEffect 依赖抖动，甚至造成 effect 无限循环。
  const state: TreeState = useMemo(() => ({
    nodes,
    setNodes,
    nodesRef,
    setSelectedNodeId,
    loadingNodes,
    setLoadingNodes,
    dialogs,
    setConfirmDialog: dialogs.setConfirmDialog,
    setCreateDbDialog: dialogs.setCreateDbDialog,
    setEditConnectionDialog: dialogs.setEditConnectionDialog,
    setAlertDialog: dialogs.setAlertDialog,
    setSystemDbConfirmDialog: dialogs.setSystemDbConfirmDialog,
    setViewDefinitionDialog: dialogs.setViewDefinitionDialog,
  }), [
    nodes,
    loadingNodes,
    dialogs,
    setNodes,
    setSelectedNodeId,
    setLoadingNodes,
  ]);

  const connection = useTreeConnectionActions(state);
  const folder = useTreeFolderLoader(state);
  const tabs = useTreeTabActions();
  const deletes = useTreeDeleteActions(state, {
    refreshFolderById: folder.refreshFolderById,
    getParentFolderId: folder.getParentFolderId,
  });
  const refresh = useTreeRefreshActions(state, {
    connectConnection: connection.connectConnection,
    connectDatabase: connection.connectDatabase,
  });
  const create = useTreeCreateActions(state);

  const handleEditConnection = useCallback((node: TreeNode) => {
    if (!node.nodeData?.connection) return;

    const isConnected = connection.isConnectionConnected(node);
    if (isConnected) {
      void showEditConnectionNotice(node.nodeData.connection.name || '未命名');
      return;
    }

    dialogs.setEditConnectionDialog({
      isOpen: true,
      profile: node.nodeData.connection,
      nodeId: node.id as string,
    });
  }, [connection, dialogs]);

  const selection = useTreeSelectionActions(state, {
    connection,
    folder,
    tabs,
    deletes,
    handleEditConnection,
    openCreateDatabaseDialog: dialogs.openCreateDatabaseDialog,
    openSystemDbConfirm: dialogs.openSystemDbConfirm,
    openViewDefinition: dialogs.openViewDefinition,
  });

  const eventsDeps = useMemo(() => ({
    connectConnection: connection.connectConnection,
    refreshMetadataTree: refresh.refreshMetadataTree,
  }), [connection.connectConnection, refresh.refreshMetadataTree]);

  useTreeEvents(state, eventsDeps);

  return {
    nodes,
    setNodes,
    loadingNodes,
    confirmDialog: dialogs.confirmDialog,
    setConfirmDialog: dialogs.setConfirmDialog,
    createDbDialog: dialogs.createDbDialog,
    setCreateDbDialog: dialogs.setCreateDbDialog,
    editConnectionDialog: dialogs.editConnectionDialog,
    setEditConnectionDialog: dialogs.setEditConnectionDialog,
    alertDialog: dialogs.alertDialog,
    setAlertDialog: dialogs.setAlertDialog,
    systemDbConfirmDialog: dialogs.systemDbConfirmDialog,
    setSystemDbConfirmDialog: dialogs.setSystemDbConfirmDialog,
    viewDefinitionDialog: dialogs.viewDefinitionDialog,
    setViewDefinitionDialog: dialogs.setViewDefinitionDialog,
    isConnectionConnected: connection.isConnectionConnected,
    isDatabaseOpened: connection.isDatabaseOpened,
    connectConnection: connection.connectConnection,
    closeConnection: connection.closeConnection,
    connectDatabase: connection.connectDatabase,
    closeDatabase: connection.closeDatabase,
    loadFolder: folder.loadFolder,
    refreshFolderById: folder.refreshFolderById,
    refreshMetadataTree: refresh.refreshMetadataTree,
    handleCreateDatabase: create.handleCreateDatabase,
    handleEditConnection,
    handleDeleteConnection: deletes.handleDeleteConnection,
    handleDeleteDatabase: deletes.handleDeleteDatabase,
    handleDeleteMetadataObject: deletes.handleDeleteMetadataObject,
    handleDeleteDesignerObject: deletes.handleDeleteDesignerObject,
    handleNodeClick: selection.handleNodeClick,
    handleNodeDoubleClick: selection.handleNodeDoubleClick,
    handleNodeExpand: selection.handleNodeExpand,
    handleNodeCollapse: selection.handleNodeCollapse,
    handleNodeContextMenu: selection.handleNodeContextMenu,
  };
};
