// 元数据树组件：树渲染与对话框挂载。
// 节点状态/动作逻辑见 ../useTreeActions.ts，右键菜单见 ./TreeContextMenu.tsx，
// 纯工具见 ../treeUtils.ts。

import React from 'react';
import { Tree, Alert } from '@blueprintjs/core';
import { useTranslation } from 'react-i18next';
import { useAppStore, useConnectionStore } from '@/stores';
import { ConfirmDialog } from '@/features/dialogs';
import { CreateDatabaseDialog, ConnectionDialog } from '@/features/connection';
import { ViewDefinitionDialog } from '@/features/dialogs/ViewDefinitionDialog';
import { useTreeActions } from '../useTreeActions';
import { filterTreeNodes } from '../treeUtils';

export const MetadataTree: React.FC<{ searchQuery: string }> = ({ searchQuery }) => {
  const { t } = useTranslation();
  const { theme } = useAppStore();
  const { connections } = useConnectionStore();
  const actions = useTreeActions();
  const filteredNodes = filterTreeNodes(actions.nodes, searchQuery);

  if (connections.length === 0) {
    return (
      <div className="metadata-tree-empty">
        <p>{t('metadataTree.noConnections')}</p>
        <p className="hint">{t('metadataTree.addConnectionHint')}</p>
      </div>
    );
  }

  return (
    <div className={`metadata-tree bp5-${theme}`}>
      <Tree
        contents={filteredNodes}
        onNodeExpand={actions.handleNodeExpand}
        onNodeCollapse={actions.handleNodeCollapse}
        onNodeClick={actions.handleNodeClick}
        onNodeDoubleClick={actions.handleNodeDoubleClick}
        onNodeContextMenu={actions.handleNodeContextMenu}
        className="metadata-tree-inner"
      />

      <ConfirmDialog
        isOpen={actions.confirmDialog.isOpen}
        onClose={() => actions.setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={actions.confirmDialog.onConfirm}
        title={actions.confirmDialog.title}
        message={actions.confirmDialog.message}
        intent={actions.confirmDialog.intent}
      />

      <CreateDatabaseDialog
        isOpen={actions.createDbDialog.isOpen}
        onClose={() => actions.setCreateDbDialog({ isOpen: false })}
        onCreate={actions.handleCreateDatabase}
      />

      <ConnectionDialog
        isOpen={actions.editConnectionDialog.isOpen}
        onClose={() => actions.setEditConnectionDialog({ isOpen: false })}
        editProfile={actions.editConnectionDialog.profile}
      />

      <Alert
        isOpen={actions.alertDialog.isOpen}
        onClose={() => actions.setAlertDialog({ isOpen: false, message: '' })}
        confirmButtonText={t('common.ok')}
        icon="warning-sign"
      >
        {actions.alertDialog.message}
      </Alert>

      <ConfirmDialog
        isOpen={actions.systemDbConfirmDialog.isOpen}
        onClose={() => actions.setSystemDbConfirmDialog({ isOpen: false })}
        onConfirm={() => {
          if (actions.systemDbConfirmDialog.node) {
            void actions.connectDatabase(actions.systemDbConfirmDialog.node);
          }
          actions.setSystemDbConfirmDialog({ isOpen: false });
        }}
        title={t('metadataTree.openSystemDbTitle')}
        message={t('metadataTree.openSystemDbWarning')}
        intent="warning"
      />

      {actions.viewDefinitionDialog.connectionProfile && (
        <ViewDefinitionDialog
          isOpen={actions.viewDefinitionDialog.isOpen}
          onClose={() => actions.setViewDefinitionDialog({ isOpen: false, database: '', viewName: '' })}
          connectionProfile={actions.viewDefinitionDialog.connectionProfile}
          database={actions.viewDefinitionDialog.database}
          viewName={actions.viewDefinitionDialog.viewName}
        />
      )}
    </div>
  );
};

