// 元数据树交互动作 Hook：点击/双击/展开/折叠/右键菜单分发。

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useConnectionStore } from '@/stores';
import {
  applySelectionToNodes,
  getSelectedDatabaseLikeJava,
  getSelectedProfileLikeJava,
  type TreeNode,
} from './treeUtils';
import { showNodeContextMenu, type TreeMenuActions } from './components/TreeContextMenu';
import type { TreeState } from './treeState';
import type { useTreeConnectionActions } from './useTreeConnectionActions';
import type { useTreeFolderLoader } from './useTreeFolderLoader';
import type { useTreeTabActions } from './useTreeTabActions';
import type { useTreeDeleteActions } from './useTreeDeleteActions';

interface TreeSelectionDeps {
  connection: ReturnType<typeof useTreeConnectionActions>;
  folder: ReturnType<typeof useTreeFolderLoader>;
  tabs: ReturnType<typeof useTreeTabActions>;
  deletes: ReturnType<typeof useTreeDeleteActions>;
  handleEditConnection: (node: TreeNode) => void;
  openCreateDatabaseDialog: (node: TreeNode, parentConnectionNodeId?: string) => void;
  openSystemDbConfirm: (node: TreeNode) => void;
  openViewDefinition: (
    profile: import('@/types').ConnectionProfile,
    database: string,
    viewName: string,
  ) => void;
}

export const useTreeSelectionActions = (state: TreeState, deps: TreeSelectionDeps) => {
  const { t } = useTranslation();
  const {
    setActiveConnection,
    setActiveDatabase,
    setLastUsedDatabaseForConnection,
    clearLastUsedDatabaseForConnection,
  } = useConnectionStore();
  const { connection, folder, tabs, deletes } = deps;

  // 痕迹同步（左键/右键通用）：依据元数据树节点向上递推连接与数据库，
  // 写入 connectionStore（activeConnectionId/activeDatabase/lastUsed）。
  // 工具栏按钮与底部状态栏均消费同一份痕迹，因此右键节点同样计入痕迹。
  const syncTraceFromNodeId = useCallback((clickedNodeId: string) => {
    const selectedProfile = getSelectedProfileLikeJava(state.nodes, clickedNodeId);
    const selectedDatabase = getSelectedDatabaseLikeJava(state.nodes, clickedNodeId);

    if (selectedProfile?.name) {
      setActiveConnection(selectedProfile.name);
      if (selectedDatabase) {
        setLastUsedDatabaseForConnection(selectedProfile.name, selectedDatabase);
      } else {
        clearLastUsedDatabaseForConnection(selectedProfile.name);
      }
    }

    setActiveDatabase(selectedDatabase || null);
  }, [
    state.nodes,
    setActiveConnection,
    setActiveDatabase,
    setLastUsedDatabaseForConnection,
    clearLastUsedDatabaseForConnection,
  ]);

  const handleNodeClick = useCallback((
    node: TreeNode,
    _nodePath: number[],
    _e: React.MouseEvent<HTMLElement>,
  ) => {
    const clickedNodeId = String(node.id);
    state.setSelectedNodeId(clickedNodeId);
    state.setNodes(prev => applySelectionToNodes(prev, clickedNodeId));

    // 左键单击：同步痕迹
    syncTraceFromNodeId(clickedNodeId);

    if (node.nodeData?.connectionId && node.childNodes && node.childNodes.length > 0 && !node.isExpanded) {
      const nodeId = node.id as string;
      state.setNodes(prev => prev.map(n =>
        n.id === nodeId ? { ...n, isExpanded: true } : n
      ));
    }
    if (node.nodeData?.database && node.nodeData.isDbOpened && node.childNodes && node.childNodes.length > 0 && !node.isExpanded) {
      const nodeId = node.id as string;
      state.setNodes(prev => {
        const updateNode = (nodes: TreeNode[]): TreeNode[] => {
          return nodes.map(n => {
            if (n.id === nodeId) {
              return { ...n, isExpanded: true };
            }
            if (n.childNodes) {
              return { ...n, childNodes: updateNode(n.childNodes as TreeNode[]) };
            }
            return n;
          });
        };
        return updateNode(prev);
      });
    }
  }, [
    state,
    syncTraceFromNodeId,
  ]);

  const handleNodeDoubleClick = useCallback((node: TreeNode) => {
    if (!node.nodeData) return;

    const profile = node.nodeData.connection;
    const database = node.nodeData.database;

    if (node.nodeData.connectionId && (!node.childNodes || node.childNodes.length === 0)) {
      void connection.connectConnection(node);
    } else if (node.nodeData.database && node.nodeData.isDbOpened === false && !node.nodeData.folderType && !node.nodeData.itemType) {
      if (node.nodeData.isSystemDb) {
        deps.openSystemDbConfirm(node);
      } else {
        void connection.connectDatabase(node);
      }
    } else if (node.nodeData.itemType === 'table' && profile && database) {
      const tableName = node.nodeData.table || node.nodeData.objectName;
      if (tableName) {
        tabs.openTableDataTab(profile, database, tableName);
      }
    } else if (node.nodeData.itemType === 'view' && profile && database) {
      const viewName = node.nodeData.objectName;
      if (viewName) {
        tabs.openViewDataTab(profile, database, viewName);
      }
    } else if (node.nodeData.itemType === 'function' && profile && database) {
      const functionName = node.nodeData.objectName;
      const functionType = node.nodeData.routineType === 'PROCEDURE' ? 'PROCEDURE' : 'FUNCTION';
      if (functionName) {
        tabs.openFunctionDesignerTab(profile, database, functionName, functionType);
      }
    }
  }, [connection, deps, tabs]);

  const handleNodeExpand = useCallback((node: TreeNode) => {
    const nodeId = node.id as string;
    state.setNodes(prev => {
      const updateNode = (nodes: TreeNode[]): TreeNode[] => {
        return nodes.map(n => {
          if (n.id === nodeId) {
            return { ...n, isExpanded: true };
          }
          if (n.childNodes) {
            return { ...n, childNodes: updateNode(n.childNodes as TreeNode[]) };
          }
          return n;
        });
      };
      return updateNode(prev);
    });
    if (node.nodeData?.folderType && (!node.childNodes || node.childNodes.length === 0)) {
      void folder.loadFolder(node);
    }
  }, [state, folder]);

  const handleNodeCollapse = useCallback((node: TreeNode) => {
    const nodeId = node.id as string;
    state.setNodes(prev => {
      const updateNode = (nodes: TreeNode[]): TreeNode[] => {
        return nodes.map(n => {
          if (n.id === nodeId) {
            return { ...n, isExpanded: false };
          }
          if (n.childNodes) {
            return { ...n, childNodes: updateNode(n.childNodes as TreeNode[]) };
          }
          return n;
        });
      };
      return updateNode(prev);
    });
  }, [state]);

  const menuActions: TreeMenuActions = useMemo(() => ({
    isConnectionConnected: connection.isConnectionConnected,
    isDatabaseOpened: connection.isDatabaseOpened,
    connectConnection: (node) => void connection.connectConnection(node),
    closeConnection: (node) => void connection.closeConnection(node),
    connectDatabase: (node) => void connection.connectDatabase(node),
    closeDatabase: (node) => void connection.closeDatabase(node),
    loadFolder: (node) => void folder.loadFolder(node),
    openCreateDatabaseDialog: deps.openCreateDatabaseDialog,
    openSystemDbConfirm: deps.openSystemDbConfirm,
    openViewDefinition: deps.openViewDefinition,
    openTableDataTab: tabs.openTableDataTab,
    openViewDataTab: tabs.openViewDataTab,
    openTableDesignerTab: tabs.openTableDesignerTab,
    openDesignerWithAction: tabs.openDesignerWithAction,
    openViewDesignerTab: tabs.openViewDesignerTab,
    openFunctionDesignerTab: tabs.openFunctionDesignerTab,
    handleDeleteMetadataObject: deletes.handleDeleteMetadataObject,
    handleDeleteDesignerObject: deletes.handleDeleteDesignerObject,
    handleEditConnection: deps.handleEditConnection,
    handleDeleteConnection: deletes.handleDeleteConnection,
    handleDeleteDatabase: (node) => void deletes.handleDeleteDatabase(node),
    getParentFolderId: folder.getParentFolderId,
    refreshFolderById: (folderId) => void folder.refreshFolderById(folderId),
    getNodes: () => state.nodesRef.current,
    t,
  }), [connection, folder, tabs, deletes, deps, state, t]);

  const handleNodeContextMenu = useCallback((
    node: TreeNode,
    _nodePath: number[],
    e: React.MouseEvent<HTMLElement>,
  ) => {
    const clickedNodeId = String(node.id);
    state.setSelectedNodeId(clickedNodeId);
    state.setNodes(prev => applySelectionToNodes(prev, clickedNodeId));
    // 右键同样计入痕迹（与左键一致）：工具栏/状态栏跟随右键选中的节点
    syncTraceFromNodeId(clickedNodeId);
    showNodeContextMenu(node, e, menuActions);
  }, [state, menuActions, syncTraceFromNodeId]);

  return {
    handleNodeClick,
    handleNodeDoubleClick,
    handleNodeExpand,
    handleNodeCollapse,
    handleNodeContextMenu,
  };
};
