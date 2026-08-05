// 元数据树文件夹加载 Hook：拉取表/视图/函数/列/索引/外键/检查/触发器子节点。

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMetadataStore } from '@/stores';
import { findNodePathById, type TreeNode } from './treeUtils';
import { buildFolderItemNodes } from './components/TreeNodeRenderer';
import type { TreeState } from './treeState';

export const useTreeFolderLoader = (state: TreeState) => {
  const { t } = useTranslation();

  const loadFolder = useCallback(async (node: TreeNode) => {
    if (!node.nodeData?.folderType || !node.nodeData?.connection || !node.nodeData?.database) return;
    const nodeId = node.id as string;
    if (state.loadingNodes.has(nodeId)) return;
    state.setLoadingNodes(prev => new Set([...prev, nodeId]));

    try {
      let items: string[] = [];
      let routines: Array<{ name: string; type: string; returnType?: string; params: Array<{ name: string; type: string; mode?: string }> }> = [];
      let records: Array<Record<string, string>> = [];
      const conn = node.nodeData.connection;
      const db = node.nodeData.database;
      switch (node.nodeData.folderType) {
        case 'tables':
          items = await useMetadataStore.getState().fetchTables(conn, db);
          break;
        case 'views':
          items = await useMetadataStore.getState().fetchViews(conn, db);
          break;
        case 'functions':
          routines = await useMetadataStore.getState().fetchRoutinesWithDetails(conn, db);
          break;
        case 'columns':
          if (node.nodeData.table) {
            records = await useMetadataStore.getState().fetchColumns(conn, db, node.nodeData.table);
          }
          break;
        case 'indexes':
          if (node.nodeData.table) {
            records = await useMetadataStore.getState().fetchIndexes(conn, db, node.nodeData.table);
          }
          break;
        case 'foreignKeys':
          if (node.nodeData.table) {
            records = await useMetadataStore.getState().fetchForeignKeys(conn, db, node.nodeData.table);
          }
          break;
        case 'checks':
          if (node.nodeData.table) {
            records = await useMetadataStore.getState().fetchChecks(conn, db, node.nodeData.table);
          }
          break;
        case 'triggers':
          if (node.nodeData.table) {
            records = await useMetadataStore.getState().fetchTriggers(conn, db, node.nodeData.table);
          }
          break;
      }

      const itemNodes = buildFolderItemNodes({
        nodeId,
        folderType: node.nodeData.folderType,
        items,
        routines,
        records,
        connection: conn,
        database: db,
        table: node.nodeData.table,
        t,
      });

      state.setNodes(prev => {
        const updateNode = (nodes: TreeNode[]): TreeNode[] => {
          return nodes.map(n => {
            if (n.id === nodeId) {
              return { ...n, childNodes: itemNodes, isExpanded: true };
            }
            if (n.childNodes) {
              return { ...n, childNodes: updateNode(n.childNodes as TreeNode[]) };
            }
            return n;
          });
        };
        return updateNode(prev);
      });
    } catch (error) {
      console.error(t('metadataTree.loadFailed'), error);
    } finally {
      state.setLoadingNodes(prev => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    }
  }, [state, t]);

  const refreshFolderById = useCallback(async (folderId: string) => {
    const path = findNodePathById(state.nodesRef.current, folderId);
    const folderNode = path?.[path.length - 1]?.node;
    if (!folderNode?.nodeData?.folderType) return;
    await loadFolder(folderNode);
  }, [state, loadFolder]);

  const getParentFolderId = useCallback((nodeId: string): string | undefined => {
    const path = findNodePathById(state.nodesRef.current, nodeId);
    if (!path || path.length < 2) return undefined;
    const parentNode = path[path.length - 2].node;
    if (parentNode.nodeData?.folderType) {
      return String(parentNode.id);
    }
    return undefined;
  }, [state]);

  return {
    loadFolder,
    refreshFolderById,
    getParentFolderId,
  };
};
