// 元数据树共享状态包：useTreeActions 持有 state，子 hook 通过该包协作，
// 避免多个子 hook 各自声明同一份节点状态。

import type React from 'react';
import type { ConnectionProfile } from '@/types';
import type { TreeNode } from './treeUtils';

export interface TreeConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  intent?: 'primary' | 'danger';
}

export interface TreeCreateDbDialogState {
  isOpen: boolean;
  connection?: ConnectionProfile;
  nodeId?: string;
}

export interface TreeEditConnectionDialogState {
  isOpen: boolean;
  profile?: ConnectionProfile;
  nodeId?: string;
}

export interface TreeAlertDialogState {
  isOpen: boolean;
  message: string;
}

export interface TreeSystemDbConfirmDialogState {
  isOpen: boolean;
  node?: TreeNode;
}

export interface TreeViewDefinitionDialogState {
  isOpen: boolean;
  connectionProfile?: ConnectionProfile;
  database: string;
  viewName: string;
}

export interface TreeDialogsState {
  confirmDialog: TreeConfirmDialogState;
  createDbDialog: TreeCreateDbDialogState;
  editConnectionDialog: TreeEditConnectionDialogState;
  alertDialog: TreeAlertDialogState;
  systemDbConfirmDialog: TreeSystemDbConfirmDialogState;
  viewDefinitionDialog: TreeViewDefinitionDialogState;
}

/** 兼容旧导出的汇总类型（MetadataTree 渲染对话框使用）。 */

/** 子 hook 共享的状态包（由 useTreeActions 创建并注入）。 */
export interface TreeState {
  nodes: TreeNode[];
  setNodes: React.Dispatch<React.SetStateAction<TreeNode[]>>;
  nodesRef: React.MutableRefObject<TreeNode[]>;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  loadingNodes: Set<string>;
  setLoadingNodes: React.Dispatch<React.SetStateAction<Set<string>>>;
  dialogs: TreeDialogsState;
  setConfirmDialog: React.Dispatch<React.SetStateAction<TreeConfirmDialogState>>;
  setCreateDbDialog: React.Dispatch<React.SetStateAction<TreeCreateDbDialogState>>;
  setEditConnectionDialog: React.Dispatch<React.SetStateAction<TreeEditConnectionDialogState>>;
  setAlertDialog: React.Dispatch<React.SetStateAction<TreeAlertDialogState>>;
  setSystemDbConfirmDialog: React.Dispatch<React.SetStateAction<TreeSystemDbConfirmDialogState>>;
  setViewDefinitionDialog: React.Dispatch<React.SetStateAction<TreeViewDefinitionDialogState>>;
}
