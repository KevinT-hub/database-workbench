import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { poolApi } from '../api/pool';
import { useTabStore } from './tabStore';
import type { ConnectionProfile, ConnectionState, PoolStats } from '../types';

interface ConnectionStore {
  connections: ConnectionState[];
  activeConnectionId: string | null;
  activeDatabase: string | null;
  lastUsedDatabaseByConnection: Record<string, string>;
  openedDatabasesByConnection: Record<string, string[]>;
  poolStats: Map<number, PoolStats>;

  // Actions
  addConnection: (profile: ConnectionProfile) => void;
  removeConnection: (id: string) => void;
  updateConnection: (id: string, profile: ConnectionProfile) => void;
  setActiveConnection: (id: string | null) => void;
  setActiveDatabase: (database: string | null) => void;
  setLastUsedDatabaseForConnection: (connectionId: string, database: string) => void;
  getLastUsedDatabaseForConnection: (connectionId: string | null | undefined) => string | undefined;
  clearLastUsedDatabaseForConnection: (connectionId: string) => void;
  markDatabaseOpened: (connectionId: string, database: string) => void;
  markDatabaseClosed: (connectionId: string, database: string) => void;
  isDatabaseOpened: (connectionId: string | null | undefined, database: string | null | undefined) => boolean;
  getOpenedDatabases: (connectionId: string) => string[];
  connect: (id: string) => Promise<void>;
  disconnect: (id: string) => Promise<void>;
  disconnectAll: () => Promise<void>;
  getConnectionState: (id: string) => ConnectionState | undefined;
  getActiveConnection: () => ConnectionState | undefined;
  getActiveConnectionCount: () => number;
  checkMaxConnections: () => { allowed: boolean; current: number; max: number };
}

const generateId = () => `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const connectInFlight = new Map<string, Promise<void>>();

export const useConnectionStore = create<ConnectionStore>()(
  persist(
    (set, get) => ({
      connections: [],
      activeConnectionId: null,
      activeDatabase: null,
      lastUsedDatabaseByConnection: {},
      openedDatabasesByConnection: {},
      poolStats: new Map(),
      
      addConnection: (profile) => {
        const id = generateId();
        set((state) => ({
          connections: [
            ...state.connections,
            {
              profile,
              isConnected: false,
              isConnecting: false,
            },
          ],
        }));
        return id;
      },
      
      removeConnection: async (id) => {
        const state = get();
        const conn = state.connections.find((c) => c.profile.name === id);
        if (conn?.poolId) {
          await poolApi.close(conn.poolId);
        }
        // 连接被删除：连带关闭依赖该连接的所有 tab（数据库依赖型 + 用户管理型）
        useTabStore.getState().closeTabsForConnection(id);
        const remainingConnections = state.connections.filter((c) => c.profile.name !== id);
        const fallbackConnection = remainingConnections[0];
        const nextLastUsed = { ...state.lastUsedDatabaseByConnection };
        delete nextLastUsed[id];
        const nextOpenedDatabases = { ...state.openedDatabasesByConnection };
        delete nextOpenedDatabases[id];
        const nextActiveConnectionId =
          state.activeConnectionId === id
            ? (fallbackConnection?.profile.name || null)
            : state.activeConnectionId;
        const nextActiveDatabase =
          state.activeConnectionId === id
            ? (nextActiveConnectionId ? (nextLastUsed[nextActiveConnectionId] || null) : null)
            : state.activeDatabase;
        set((state) => ({
          connections: state.connections.filter((c) => c.profile.name !== id),
          activeConnectionId: nextActiveConnectionId,
          activeDatabase: nextActiveDatabase,
          lastUsedDatabaseByConnection: nextLastUsed,
          openedDatabasesByConnection: nextOpenedDatabases,
        }));
      },
      
      updateConnection: (id, profile) => {
        set((state) => ({
          connections: state.connections.map((c) =>
            c.profile.name === id ? { ...c, profile } : c
          ),
        }));
      },
      
      setActiveConnection: (id) => {
        set({ activeConnectionId: id });
      },

      setActiveDatabase: (database) => {
        set({ activeDatabase: database });
      },

      setLastUsedDatabaseForConnection: (connectionId, database) => {
        if (!connectionId || !database) return;
        set((state) => ({
          lastUsedDatabaseByConnection: {
            ...state.lastUsedDatabaseByConnection,
            [connectionId]: database,
          },
        }));
      },

      getLastUsedDatabaseForConnection: (connectionId) => {
        if (!connectionId) return undefined;
        return get().lastUsedDatabaseByConnection[connectionId];
      },

      clearLastUsedDatabaseForConnection: (connectionId) => {
        if (!connectionId) return;
        set((state) => {
          const next = { ...state.lastUsedDatabaseByConnection };
          delete next[connectionId];
          return { lastUsedDatabaseByConnection: next };
        });
      },

      markDatabaseOpened: (connectionId, database) => {
        if (!connectionId || !database) return;
        set((state) => {
          const existing = state.openedDatabasesByConnection[connectionId] || [];
          if (existing.includes(database)) return state;
          return {
            openedDatabasesByConnection: {
              ...state.openedDatabasesByConnection,
              [connectionId]: [...existing, database],
            },
          };
        });
      },

      markDatabaseClosed: (connectionId, database) => {
        if (!connectionId || !database) return;
        set((state) => {
          const existing = state.openedDatabasesByConnection[connectionId];
          if (!existing || !existing.includes(database)) return state;
          const next = existing.filter((db) => db !== database);
          const openedDatabasesByConnection = { ...state.openedDatabasesByConnection };
          if (next.length === 0) {
            delete openedDatabasesByConnection[connectionId];
          } else {
            openedDatabasesByConnection[connectionId] = next;
          }
          return { openedDatabasesByConnection };
        });
      },

      isDatabaseOpened: (connectionId, database) => {
        if (!connectionId || !database) return false;
        const opened = get().openedDatabasesByConnection[connectionId];
        return Boolean(opened && opened.includes(database));
      },

      getOpenedDatabases: (connectionId) => {
        if (!connectionId) return [];
        return get().openedDatabasesByConnection[connectionId] || [];
      },
      
      connect: async (id) => {
        const existing = connectInFlight.get(id);
        if (existing) {
          await existing;
          return;
        }

        const task = (async () => {
          const state = get();
          const conn = state.connections.find((c) => c.profile.name === id);
          if (!conn) return;
          if (conn.isConnected && conn.poolId) return;
          if (conn.isConnecting) return;

          set((state) => ({
            connections: state.connections.map((c) =>
              c.profile.name === id ? { ...c, isConnecting: true, error: undefined } : c
            ),
          }));

          try {
            const latestConn = get().connections.find((c) => c.profile.name === id);
            if (!latestConn) return;

            const poolId = await poolApi.create(latestConn.profile);
            set((state) => ({
              connections: state.connections.map((c) =>
                c.profile.name === id
                  ? { ...c, isConnected: true, isConnecting: false, poolId }
                  : c
              ),
            }));
          } catch (error) {
            set((state) => ({
              connections: state.connections.map((c) =>
                c.profile.name === id
                  ? { ...c, isConnected: false, isConnecting: false, error: String(error) }
                  : c
              ),
            }));
          }
        })();

        connectInFlight.set(id, task);
        try {
          await task;
        } finally {
          connectInFlight.delete(id);
        }
      },
      
      disconnect: async (id) => {
        const state = get();
        const conn = state.connections.find((c) => c.profile.name === id);
        if (conn?.poolId) {
          await poolApi.close(conn.poolId);
        }
        // 连接关闭：其下所有数据库一并失效，连带关闭依赖该连接的所有 tab
        useTabStore.getState().closeTabsForConnection(id);
        set((state) => {
          // 连接关闭后其下已打开的数据库全部失效（树中数据库节点一并收起）
          const openedDatabasesByConnection = { ...state.openedDatabasesByConnection };
          delete openedDatabasesByConnection[id];
          return {
            connections: state.connections.map((c) =>
              c.profile.name === id
                ? { ...c, isConnected: false, poolId: undefined }
                : c
            ),
            openedDatabasesByConnection,
          };
        });
      },
      
      disconnectAll: async () => {
        await poolApi.closeAll();
        // 全部连接关闭：连带关闭所有依赖连接的 tab（查询/欢迎自足 tab 保留）
        const { connections } = get();
        const tabStore = useTabStore.getState();
        for (const conn of connections) {
          if (conn.profile.name) {
            tabStore.closeTabsForConnection(conn.profile.name);
          }
        }
        set((state) => ({
          connections: state.connections.map((c) => ({
            ...c,
            isConnected: false,
            poolId: undefined,
          })),
          openedDatabasesByConnection: {},
        }));
      },
      
      getConnectionState: (id) => {
        return get().connections.find((c) => c.profile.name === id);
      },
      
      getActiveConnection: () => {
        const { connections, activeConnectionId } = get();
        return connections.find((c) => c.profile.name === activeConnectionId);
      },

      getActiveConnectionCount: () => {
        const { connections } = get();
        return connections.filter((c) => c.isConnected).length;
      },

      checkMaxConnections: () => {
        const { connections } = get();
        const current = connections.filter((c) => c.isConnected).length;

        // 从设置中读取最大连接数
        const settings = localStorage.getItem('dbw-settings');
        let maxConnections = 10; // 默认值
        if (settings) {
          try {
            const parsed = JSON.parse(settings);
            if (parsed.maxConnections !== undefined) {
              maxConnections = parsed.maxConnections;
            }
          } catch {
            // 忽略解析错误，使用默认值
          }
        }

        return {
          allowed: current < maxConnections,
          current,
          max: maxConnections,
        };
      },
    }),
    {
      name: 'connection-storage',
      version: 2,
      migrate: (persistedState: unknown, _version: number) => {
        const state = (persistedState as Partial<ConnectionStore>) || {};
        return {
          ...state,
          activeConnectionId: null,
          activeDatabase: null,
          lastUsedDatabaseByConnection: {},
        } as ConnectionStore;
      },
      partialize: (state) => ({ 
        connections: state.connections.map(c => ({ 
          profile: c.profile, 
          isConnected: false,
          isConnecting: false 
        })),
      }),
    }
  )
);
