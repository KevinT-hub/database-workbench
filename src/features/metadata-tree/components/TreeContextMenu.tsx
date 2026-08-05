// 元数据树右键菜单：按节点类型分发连接/数据库/文件夹/对象四类菜单。
// 从 MetadataTree 拆分而来；菜单依赖的动作通过 TreeMenuActions 注入，
// 保持组件自身无状态、可测试。

import { Menu, MenuItem, showContextMenu, Divider } from '@blueprintjs/core';
import type { TFunction } from 'i18next';
import type { ConnectionProfile, DesignerActionRequest } from '@/types';
import type { TreeNode } from '../treeUtils';

export interface TreeMenuActions {
  isConnectionConnected(node: TreeNode): boolean;
  isDatabaseOpened(node: TreeNode): boolean;
  connectConnection(node: TreeNode): void;
  closeConnection(node: TreeNode): void;
  connectDatabase(node: TreeNode): void;
  closeDatabase(node: TreeNode): void;
  loadFolder(node: TreeNode): void;
  openCreateDatabaseDialog(node: TreeNode, parentConnectionNodeId?: string): void;
  openSystemDbConfirm(node: TreeNode): void;
  openViewDefinition(profile: ConnectionProfile, database: string, viewName: string): void;
  openTableDataTab(profile: ConnectionProfile, database: string, tableName: string): void;
  openViewDataTab(profile: ConnectionProfile, database: string, viewName: string): void;
  openTableDesignerTab(profile: ConnectionProfile, database?: string, tableName?: string): void;
  openDesignerWithAction(
    profile: ConnectionProfile,
    targetDatabase: string,
    targetTable: string,
    action: Omit<DesignerActionRequest, 'nonce'>,
  ): void;
  openViewDesignerTab(profile: ConnectionProfile, database: string, viewName: string): void;
  openFunctionDesignerTab(
    profile: ConnectionProfile,
    database: string,
    functionName?: string,
    functionType?: 'FUNCTION' | 'PROCEDURE',
    autoExecute?: boolean,
  ): void;
  handleDeleteMetadataObject(node: TreeNode): void;
  handleDeleteDesignerObject(
    profile: ConnectionProfile,
    database: string,
    tableName: string,
    itemType: 'column' | 'index' | 'foreignKey' | 'check' | 'trigger',
    objectName: string,
    objectTypeLabel: string,
    refreshParentFolder: () => void,
  ): void;
  handleEditConnection(node: TreeNode): void;
  handleDeleteConnection(node: TreeNode): void;
  handleDeleteDatabase(node: TreeNode): void;
  getParentFolderId(nodeId: string): string | undefined;
  refreshFolderById(folderId: string): void;
  /** 当前树节点（菜单中查找父连接等场景使用） */
  getNodes(): TreeNode[];
  t: TFunction;
}

const showMenuAt = (content: React.ReactElement, e: React.MouseEvent<HTMLElement>) => {
  showContextMenu({
    content,
    targetOffset: { left: e.clientX, top: e.clientY },
  });
};

const showConnectionMenu = (node: TreeNode, e: React.MouseEvent<HTMLElement>, actions: TreeMenuActions) => {
  const { t } = actions;
  const isConnected = actions.isConnectionConnected(node);

  const menu = (
    <Menu className="tree-context-menu">
      <MenuItem
        text={t('metadataTree.openConnection')}
        disabled={isConnected}
        onClick={() => actions.connectConnection(node)}
      />
      <MenuItem
        text={t('metadataTree.closeConnection')}
        disabled={!isConnected}
        onClick={() => actions.closeConnection(node)}
      />
      <Divider />
      <MenuItem
        text={t('metadataTree.newDatabase')}
        disabled={!isConnected}
        onClick={() => actions.openCreateDatabaseDialog(node)}
      />
      <Divider />
      <MenuItem
        text={t('metadataTree.editConnection')}
        onClick={() => actions.handleEditConnection(node)}
      />
      <MenuItem
        text={t('metadataTree.deleteConnection')}
        onClick={() => actions.handleDeleteConnection(node)}
      />
    </Menu>
  );

  showMenuAt(menu, e);
};

const showDatabaseMenu = (node: TreeNode, e: React.MouseEvent<HTMLElement>, actions: TreeMenuActions) => {
  const { t } = actions;
  const isOpened = actions.isDatabaseOpened(node);
  const isSystemDb = node.nodeData?.isSystemDb || false;

  const menuItems: React.ReactNode[] = [];

  if (isSystemDb) {
    menuItems.push(
      <MenuItem
        key="warning"
        text={t('metadataTree.systemDbWarning')}
        disabled
      />
    );
  }

  menuItems.push(
    <MenuItem
      key="open"
      text={t('metadataTree.openDatabase')}
      disabled={isOpened}
      onClick={() => {
        if (isSystemDb) {
          actions.openSystemDbConfirm(node);
        } else {
          actions.connectDatabase(node);
        }
      }}
    />,
    <MenuItem
      key="close"
      text={t('metadataTree.closeDatabase')}
      disabled={!isOpened}
      onClick={() => actions.closeDatabase(node)}
    />,
    <Divider key="div1" />,
    <MenuItem
      key="create"
      text={t('metadataTree.newDatabase')}
      onClick={() => {
        const parentConnId = (node.id as string).split('-').slice(0, -1).join('-');
        const parentConn = actions.getNodes().find(n => n.id === parentConnId);
        actions.openCreateDatabaseDialog(
          {
            ...node,
            nodeData: {
              ...node.nodeData,
              connection: parentConn?.nodeData?.connection || node.nodeData?.connection,
            },
          },
          parentConnId,
        );
      }}
    />,
    <MenuItem
      key="delete"
      text={isSystemDb ? t('metadataTree.deleteSystemDb') : t('metadataTree.deleteDatabase')}
      disabled={isSystemDb}
      onClick={() => actions.handleDeleteDatabase(node)}
    />
  );

  showMenuAt(
    <Menu className="tree-context-menu">
      {menuItems}
    </Menu>,
    e,
  );
};

const showFolderMenu = (node: TreeNode, e: React.MouseEvent<HTMLElement>, actions: TreeMenuActions) => {
  const { t } = actions;
  const profile = node.nodeData?.connection;
  const database = node.nodeData?.database;
  const table = node.nodeData?.table;
  const folderType = node.nodeData?.folderType;
  if (!profile || !database || !folderType) return;

  const handleNewObject = () => {
    if (folderType === 'tables') {
      actions.openTableDesignerTab(profile, database);
    } else if (folderType === 'views') {
      actions.openViewDesignerTab(profile, database, 'new_view');
    } else if (folderType === 'functions') {
      actions.openFunctionDesignerTab(profile, database, undefined, 'FUNCTION');
    } else if (folderType === 'columns' && table) {
      actions.openDesignerWithAction(profile, database, table, { target: 'field', action: 'new' });
    } else if (folderType === 'indexes' && table) {
      actions.openDesignerWithAction(profile, database, table, { target: 'index', action: 'new' });
    } else if (folderType === 'foreignKeys' && table) {
      actions.openDesignerWithAction(profile, database, table, { target: 'foreignKey', action: 'new' });
    } else if (folderType === 'checks' && table) {
      actions.openDesignerWithAction(profile, database, table, { target: 'check', action: 'new' });
    } else if (folderType === 'triggers' && table) {
      actions.openDesignerWithAction(profile, database, table, { target: 'trigger', action: 'new' });
    }
  };

  const menu = (
    <Menu className="tree-context-menu">
      <MenuItem text={t('metadataTree.newObject')} onClick={handleNewObject} />
      <MenuItem text={t('common.refresh')} onClick={() => void actions.loadFolder(node)} />
    </Menu>
  );

  showMenuAt(menu, e);
};

const showMetadataItemMenu = (node: TreeNode, e: React.MouseEvent<HTMLElement>, actions: TreeMenuActions) => {
  const { t } = actions;
  const profile = node.nodeData?.connection;
  const database = node.nodeData?.database;
  const itemType = node.nodeData?.itemType;
  if (!profile || !database || !itemType) return;

  const objectName = node.nodeData?.objectName || node.nodeData?.table;
  const tableName = node.nodeData?.table;
  const routineType = node.nodeData?.routineType === 'PROCEDURE' ? 'PROCEDURE' : 'FUNCTION';

  const parentFolderId = actions.getParentFolderId(String(node.id));
  const refreshParentFolder = () => {
    if (parentFolderId) {
      void actions.refreshFolderById(parentFolderId);
    }
  };

  let menu: React.ReactNode = null;

  if (itemType === 'table' && objectName) {
    menu = (
      <Menu className="tree-context-menu">
        <MenuItem text={t('metadataTree.openTable')} onClick={() => actions.openTableDataTab(profile, database, objectName)} />
        <MenuItem text={t('metadataTree.newTable')} onClick={() => actions.openTableDesignerTab(profile, database)} />
        <MenuItem text={t('metadataTree.designTable')} onClick={() => actions.openTableDesignerTab(profile, database, objectName)} />
        <MenuItem text={t('metadataTree.deleteTable')} onClick={() => actions.handleDeleteMetadataObject(node)} />
        <Divider />
        <MenuItem text={t('common.refresh')} onClick={refreshParentFolder} />
      </Menu>
    );
  } else if (itemType === 'view' && objectName) {
    menu = (
      <Menu className="tree-context-menu">
        <MenuItem text={t('metadataTree.openView')} onClick={() => actions.openViewDataTab(profile, database, objectName)} />
        <MenuItem text={t('metadataTree.newView')} onClick={() => actions.openViewDesignerTab(profile, database, 'new_view')} />
        <MenuItem text={t('metadataTree.editView')} onClick={() => actions.openViewDesignerTab(profile, database, objectName)} />
        <MenuItem text={t('metadataTree.deleteView')} onClick={() => actions.handleDeleteMetadataObject(node)} />
        <MenuItem
          text={t('metadataTree.viewDefinition')}
          onClick={() => actions.openViewDefinition(profile, database, objectName)}
        />
        <Divider />
        <MenuItem text={t('common.refresh')} onClick={refreshParentFolder} />
      </Menu>
    );
  } else if (itemType === 'function' && objectName) {
    menu = (
      <Menu className="tree-context-menu">
        <MenuItem
          text={t('metadataTree.newFunction')}
          onClick={() => actions.openFunctionDesignerTab(profile, database, undefined, 'FUNCTION')}
        />
        <MenuItem
          text={t('metadataTree.editFunction')}
          onClick={() => actions.openFunctionDesignerTab(profile, database, objectName, routineType)}
        />
        <MenuItem
          text={t('metadataTree.executeFunction')}
          onClick={() => actions.openFunctionDesignerTab(profile, database, objectName, routineType, true)}
        />
        <MenuItem text={t('metadataTree.deleteFunction')} onClick={() => actions.handleDeleteMetadataObject(node)} />
        <Divider />
        <MenuItem text={t('common.refresh')} onClick={refreshParentFolder} />
      </Menu>
    );
  } else if (
    ['column', 'index', 'foreignKey', 'check', 'trigger'].includes(itemType) &&
    objectName &&
    tableName
  ) {
    const objectTypeMap: Record<string, string> = {
      column: t('metadataTree.objectTypeColumn'),
      index: t('metadataTree.objectTypeIndex'),
      foreignKey: t('metadataTree.objectTypeForeignKey'),
      check: t('metadataTree.objectTypeCheck'),
      trigger: t('metadataTree.objectTypeTrigger'),
    };

    const targetMap: Record<string, DesignerActionRequest['target']> = {
      column: 'field',
      index: 'index',
      foreignKey: 'foreignKey',
      check: 'check',
      trigger: 'trigger',
    };

    const target = targetMap[itemType];
    const objectTypeLabel = objectTypeMap[itemType];

    menu = (
      <Menu className="tree-context-menu">
        <MenuItem
          text={t('metadataTree.editObject', { objectType: objectTypeLabel })}
          onClick={() => actions.openDesignerWithAction(profile, database, tableName, {
            target,
            action: 'edit',
            name: objectName,
          })}
        />
        <MenuItem
          text={t('metadataTree.newObjectWithType', { objectType: objectTypeLabel })}
          onClick={() => actions.openDesignerWithAction(profile, database, tableName, {
            target,
            action: 'new',
          })}
        />
        <MenuItem
          text={t('metadataTree.deleteObjectWithType', { objectType: objectTypeLabel })}
          onClick={() => actions.handleDeleteDesignerObject(
            profile,
            database,
            tableName,
            itemType as 'column' | 'index' | 'foreignKey' | 'check' | 'trigger',
            objectName,
            objectTypeLabel,
            refreshParentFolder,
          )}
        />
        <MenuItem
          text={t('metadataTree.renameObject')}
          onClick={() => {
            const input = window.prompt(
              t('metadataTree.renamePrompt', { objectType: objectTypeLabel, name: objectName }),
              objectName,
            );
            const newName = input?.trim();
            if (!newName || newName === objectName) return;
            actions.openDesignerWithAction(profile, database, tableName, {
              target,
              action: 'rename',
              name: objectName,
              newName,
            });
          }}
        />
        <Divider />
        <MenuItem text={t('common.refresh')} onClick={refreshParentFolder} />
      </Menu>
    );
  }

  if (!menu) return;

  showMenuAt(menu, e);
};

/** 按节点类型分发右键菜单（选中态处理由调用方负责）。 */
export const showNodeContextMenu = (
  node: TreeNode,
  e: React.MouseEvent<HTMLElement>,
  actions: TreeMenuActions,
): void => {
  if (node.nodeData?.connectionId && !node.nodeData?.database) {
    showConnectionMenu(node, e, actions);
  } else if (node.nodeData?.database && !node.nodeData?.folderType && !node.nodeData?.itemType) {
    showDatabaseMenu(node, e, actions);
  } else if (
    node.nodeData?.folderType &&
    ['tables', 'views', 'functions', 'columns', 'indexes', 'foreignKeys', 'checks', 'triggers'].includes(node.nodeData.folderType)
  ) {
    showFolderMenu(node, e, actions);
  } else if (
    node.nodeData?.itemType &&
    ['table', 'view', 'function', 'column', 'index', 'foreignKey', 'check', 'trigger'].includes(node.nodeData.itemType)
  ) {
    showMetadataItemMenu(node, e, actions);
  }
};
