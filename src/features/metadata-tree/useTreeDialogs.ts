// 元数据树对话框状态 Hook：6 类对话框的 state 与打开动作。

import { useMemo, useState } from 'react';
import type { ConnectionProfile } from '@/types';
import type { TreeNode } from './treeUtils';
import type {
  TreeAlertDialogState,
  TreeConfirmDialogState,
  TreeCreateDbDialogState,
  TreeDialogsState,
  TreeEditConnectionDialogState,
  TreeSystemDbConfirmDialogState,
  TreeViewDefinitionDialogState,
} from './treeState';

export const useTreeDialogs = () => {
  const [confirmDialog, setConfirmDialog] = useState<TreeConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const [createDbDialog, setCreateDbDialog] = useState<TreeCreateDbDialogState>({ isOpen: false });
  const [editConnectionDialog, setEditConnectionDialog] = useState<TreeEditConnectionDialogState>({ isOpen: false });
  const [alertDialog, setAlertDialog] = useState<TreeAlertDialogState>({ isOpen: false, message: '' });
  const [systemDbConfirmDialog, setSystemDbConfirmDialog] = useState<TreeSystemDbConfirmDialogState>({ isOpen: false });
  const [viewDefinitionDialog, setViewDefinitionDialog] = useState<TreeViewDefinitionDialogState>({
    isOpen: false,
    database: '',
    viewName: '',
  });

  // 稳定引用：避免每次渲染新建对象导致上层 state 包/子 hook 依赖抖动
  const dialogs: TreeDialogsState = useMemo(() => ({
    confirmDialog,
    createDbDialog,
    editConnectionDialog,
    alertDialog,
    systemDbConfirmDialog,
    viewDefinitionDialog,
  }), [
    confirmDialog,
    createDbDialog,
    editConnectionDialog,
    alertDialog,
    systemDbConfirmDialog,
    viewDefinitionDialog,
  ]);

  const openCreateDatabaseDialog = (node: TreeNode, parentConnectionNodeId?: string) => {
    setCreateDbDialog({
      isOpen: true,
      connection: node.nodeData?.connection,
      nodeId: parentConnectionNodeId ?? (node.id as string),
    });
  };

  const openSystemDbConfirm = (node: TreeNode) => {
    setSystemDbConfirmDialog({ isOpen: true, node });
  };

  const openViewDefinition = (profile: ConnectionProfile, database: string, viewName: string) => {
    setViewDefinitionDialog({ isOpen: true, connectionProfile: profile, database, viewName });
  };

  return {
    dialogs,
    confirmDialog,
    setConfirmDialog,
    createDbDialog,
    setCreateDbDialog,
    editConnectionDialog,
    setEditConnectionDialog,
    alertDialog,
    setAlertDialog,
    systemDbConfirmDialog,
    setSystemDbConfirmDialog,
    viewDefinitionDialog,
    setViewDefinitionDialog,
    openCreateDatabaseDialog,
    openSystemDbConfirm,
    openViewDefinition,
  };
};
