// 元数据树生命周期事件 Hook：ref 同步、连接列表同步、全局刷新/打开连接事件。

import { useEffect } from 'react';
import { useConnectionStore } from '@/stores';
import { GLOBAL_REFRESH_EVENT, OPEN_CONNECTION_EVENT, type TreeNode } from './treeUtils';
import { buildConnectionIcon } from './components/TreeNodeRenderer';
import type { TreeState } from './treeState';

interface TreeEventsDeps {
  connectConnection: (node: TreeNode) => Promise<void>;
  refreshMetadataTree: () => Promise<void>;
}

export const useTreeEvents = (state: TreeState, deps: TreeEventsDeps) => {
  const { connections } = useConnectionStore();
  const { setNodes, nodesRef, nodes } = state;

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes, nodesRef]);

  useEffect(() => {
    setNodes((prev) => {
      const previousById = new Map(prev.map((node) => [String(node.id), node]));
      return connections.map((conn, index) => {
        const connId = conn.profile.name || `conn-${index}`;
        const existing = previousById.get(connId);
        if (existing) {
          return {
            ...existing,
            id: connId,
            label: conn.profile.name || `${conn.profile.host}:${conn.profile.port}`,
            nodeData: {
              ...(existing.nodeData || {}),
              connection: conn.profile,
              connectionId: connId,
            },
          };
        }
        return {
          id: connId,
          label: conn.profile.name || `${conn.profile.host}:${conn.profile.port}`,
          icon: buildConnectionIcon(false),
          isExpanded: false,
          hasCaret: false,
          childNodes: undefined,
          nodeData: {
            connection: conn.profile,
            connectionId: connId,
          },
        };
      });
    });
    // 注意：不能依赖 state（每次渲染都是新对象），否则 setNodes 触发重渲染后
    // effect 再次执行，形成无限循环。setNodes 是 useState 的稳定引用。
  }, [connections, setNodes]);

  useEffect(() => {
    const handleOpenConnection = (event: Event) => {
      const detail = (event as CustomEvent<{ connectionName?: string }>).detail;
      const connectionName = detail?.connectionName?.trim();
      if (!connectionName) {
        return;
      }

      const targetNode = state.nodesRef.current.find((node) => {
        const nodeName = node.nodeData?.connection?.name?.trim();
        return nodeName === connectionName;
      });
      if (!targetNode) {
        return;
      }

      if (targetNode.childNodes && targetNode.childNodes.length > 0) {
        state.setNodes((prev) => prev.map((node) => (
          node.id === targetNode.id
            ? {
                ...node,
                isExpanded: true,
                hasCaret: true,
                icon: buildConnectionIcon(true),
              }
            : node
        )));
        if (targetNode.nodeData?.connection?.name) {
          useConnectionStore.getState().setActiveConnection(targetNode.nodeData.connection.name);
        }
        return;
      }

      void deps.connectConnection(targetNode);
    };

    window.addEventListener(OPEN_CONNECTION_EVENT, handleOpenConnection);
    return () => {
      window.removeEventListener(OPEN_CONNECTION_EVENT, handleOpenConnection);
    };
  }, [state, deps]);

  useEffect(() => {
    const handleGlobalRefresh = () => {
      void deps.refreshMetadataTree();
    };

    window.addEventListener(GLOBAL_REFRESH_EVENT, handleGlobalRefresh);
    return () => {
      window.removeEventListener(GLOBAL_REFRESH_EVENT, handleGlobalRefresh);
    };
  }, [deps]);
};
