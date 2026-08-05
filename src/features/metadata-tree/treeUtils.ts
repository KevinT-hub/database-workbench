// 元数据树纯工具：节点模型、节点判定、路径查找、选中态与搜索过滤。
// 不依赖 React/Store，便于单测与复用。

import type { TreeNodeInfo } from '@blueprintjs/core';
import type { ConnectionProfile } from '@/types';

export const SYSTEM_DATABASES = new Set(['mysql', 'information_schema', 'performance_schema', 'sys']);
export const GLOBAL_REFRESH_EVENT = 'dbw:global-refresh';
export const OPEN_CONNECTION_EVENT = 'dbw:open-connection-node';

export interface TreeNodeData {
  connection?: ConnectionProfile;
  connectionId?: string;
  database?: string;
  table?: string;
  objectName?: string;
  routineType?: 'FUNCTION' | 'PROCEDURE';
  isSystemDb?: boolean;
  folderType?: 'tables' | 'views' | 'functions' | 'columns' | 'indexes' | 'foreignKeys' | 'checks' | 'triggers';
  itemType?: 'table' | 'view' | 'function' | 'column' | 'index' | 'foreignKey' | 'check' | 'trigger' | 'param';
  isDbOpened?: boolean;
}

export type TreeNode = TreeNodeInfo<TreeNodeData>;

const isConnectionNodeLikeJava = (node: TreeNode, parent: TreeNode | null): boolean => {
  return parent === null && !!node.nodeData?.connection;
};

const isDatabaseNodeLikeJava = (node: TreeNode, parent: TreeNode | null): boolean => {
  return parent !== null && isConnectionNodeLikeJava(parent, null) && !!node.nodeData?.database;
};

export const findNodePathById = (
  treeNodes: TreeNode[],
  targetId: string,
  parent: TreeNode | null = null,
): Array<{ node: TreeNode; parent: TreeNode | null }> | null => {
  for (const node of treeNodes) {
    const current = { node, parent };
    if (String(node.id) === targetId) {
      return [current];
    }
    if (node.childNodes && node.childNodes.length > 0) {
      const childPath = findNodePathById(node.childNodes as TreeNode[], targetId, node);
      if (childPath) {
        return [current, ...childPath];
      }
    }
  }
  return null;
};

export const getSelectedProfileLikeJava = (
  treeNodes: TreeNode[],
  selectedId: string,
): ConnectionProfile | undefined => {
  const path = findNodePathById(treeNodes, selectedId);
  if (!path || path.length === 0) return undefined;

  for (let i = path.length - 1; i >= 0; i -= 1) {
    const current = path[i];
    if (isConnectionNodeLikeJava(current.node, current.parent)) {
      return current.node.nodeData?.connection;
    }
  }
  return undefined;
};

export const getSelectedDatabaseLikeJava = (
  treeNodes: TreeNode[],
  selectedId: string,
): string | undefined => {
  const path = findNodePathById(treeNodes, selectedId);
  if (!path || path.length === 0) return undefined;

  const selected = path[path.length - 1];
  if (isDatabaseNodeLikeJava(selected.node, selected.parent)) {
    return selected.node.nodeData?.database;
  }

  for (let i = path.length - 1; i >= 0; i -= 1) {
    const current = path[i];
    if (isDatabaseNodeLikeJava(current.node, current.parent)) {
      return current.node.nodeData?.database;
    }
    if (current.parent) {
      const grandParent = i - 2 >= 0 ? path[i - 2].node : null;
      if (isDatabaseNodeLikeJava(current.parent, grandParent)) {
        return current.parent.nodeData?.database;
      }
    }
  }

  return undefined;
};

export const applySelectionToNodes = (
  treeNodes: TreeNode[],
  selectedId: string | null,
): TreeNode[] => {
  return treeNodes.map((node) => {
    const nodeId = String(node.id);
    const selected = !!selectedId && nodeId === selectedId;
    return {
      ...node,
      isSelected: selected,
      childNodes: node.childNodes
        ? applySelectionToNodes(node.childNodes as TreeNode[], selectedId)
        : node.childNodes,
    };
  });
};

/** 搜索过滤：命中或子节点命中的节点保留并展开。 */
export const filterTreeNodes = (treeNodes: TreeNode[], query: string): TreeNode[] => {
  if (!query) return treeNodes;
  return treeNodes.reduce<TreeNode[]>((filtered, node) => {
    const label = (node.label as string) || '';
    const matches = label.toLowerCase().includes(query.toLowerCase());
    let filteredChildren: TreeNode[] = [];
    if (node.childNodes) {
      filteredChildren = filterTreeNodes(node.childNodes as TreeNode[], query);
    }
    if (matches || filteredChildren.length > 0) {
      filtered.push({
        ...node,
        childNodes: filteredChildren.length > 0 ? filteredChildren : node.childNodes,
        isExpanded: true,
      });
    }
    return filtered;
  }, []);
};

interface DeleteObjectSql {
  sql: string;
  objectTypeText: string;
}

/** 表/视图/函数/存储过程 的 DROP SQL（返回 null 表示不可删除类型）。 */
export const buildDeleteObjectSql = (
  node: TreeNode,
  t: (key: string, opts?: Record<string, unknown>) => string,
): DeleteObjectSql | null => {
  const itemType = node.nodeData?.itemType;
  const objectName = node.nodeData?.objectName || node.nodeData?.table;
  if (!itemType || !objectName) return null;

  const escapedObject = objectName.replace(/`/g, '``');
  if (itemType === 'table') {
    return { sql: `DROP TABLE \`${escapedObject}\``, objectTypeText: t('metadataTree.objectTypeTable') };
  }
  if (itemType === 'view') {
    return { sql: `DROP VIEW \`${escapedObject}\``, objectTypeText: t('metadataTree.objectTypeView') };
  }
  if (itemType === 'function') {
    const routineType = node.nodeData?.routineType === 'PROCEDURE' ? 'PROCEDURE' : 'FUNCTION';
    const objectTypeText = routineType === 'PROCEDURE'
      ? t('metadataTree.objectTypeProcedure')
      : t('metadataTree.objectTypeFunction');
    return { sql: `DROP ${routineType} \`${escapedObject}\``, objectTypeText };
  }
  return null;
};

/** 设计器子对象（列/索引/外键/检查/触发器）的删除 SQL。 */
export const buildDeleteDesignerSql = (
  itemType: 'column' | 'index' | 'foreignKey' | 'check' | 'trigger',
  tableName: string,
  objectName: string,
): string => {
  const escapedTable = tableName.replace(/`/g, '``');
  const escapedObject = objectName.replace(/`/g, '``');
  switch (itemType) {
    case 'column':
      return `ALTER TABLE \`${escapedTable}\` DROP COLUMN \`${escapedObject}\``;
    case 'index':
      return `ALTER TABLE \`${escapedTable}\` DROP INDEX \`${escapedObject}\``;
    case 'foreignKey':
      return `ALTER TABLE \`${escapedTable}\` DROP FOREIGN KEY \`${escapedObject}\``;
    case 'check':
      return `ALTER TABLE \`${escapedTable}\` DROP CHECK \`${escapedObject}\``;
    case 'trigger':
      return `DROP TRIGGER \`${escapedObject}\``;
  }
};
