// 菜单栏收藏夹编排 Hook：负责最近收藏列表、收藏执行（SQL/连接/数据库对象）、
// 连接自动打开与配置比对等全部收藏夹业务逻辑，使 MenuBar 只保留菜单渲染与调度。
import { useCallback, useEffect, useState } from 'react';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { useTranslation } from 'react-i18next';
import { useAppStore, useConnectionStore, useTabStore } from '@/stores';
import {
  parseFavoritePayload,
  type DatabaseObjectOpenMode,
  type DatabaseObjectType,
} from '@/features/favorites';
import { showToolbarRequirementNotice, useTraceTarget } from '@/hooks';
import { useFavorites } from '@/hooks/useFavorites';
import type { ConnectionProfile, FavoriteItem } from '@/types';
import type { MenuDialogsState } from './useMenuDialogs';

/** 连接配置规范化：用于收藏夹/连接导入时比较配置是否一致。 */
export const normalizeConnectionProfile = (profile: ConnectionProfile) => ({
  name: profile.name || '',
  host: profile.host,
  port: profile.port,
  username: profile.username,
  password: profile.password,
  database: profile.database || '',
  charset: profile.charset || '',
  collation: profile.collation || '',
  timeout: profile.timeout ?? 28800,
  connectionTimeout: profile.connectionTimeout ?? 30,
  ssl: profile.ssl ?? false,
  sslMode: profile.sslMode || 'preferred',
  sslCaPath: profile.sslCaPath || '',
  sslCertPath: profile.sslCertPath || '',
  sslKeyPath: profile.sslKeyPath || '',
});

/** 从连接导出 JSON 中解析 profile 列表。 */
const parseProfilesFromConnectionJson = (content: string): ConnectionProfile[] => {
  const parsed = JSON.parse(content) as unknown;
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const maybeProfile = (entry as { profile?: ConnectionProfile }).profile;
      if (!maybeProfile || typeof maybeProfile !== 'object') {
        return null;
      }
      return maybeProfile;
    })
    .filter((profile): profile is ConnectionProfile => Boolean(profile));
};

/** 按名称在当前连接列表中查找连接（不触发渲染，供异步流程读取最新状态）。 */
const findConnectionByName = (connectionName: string) => {
  const target = connectionName.trim();
  return useConnectionStore
    .getState()
    .connections
    .find((conn) => (conn.profile.name || '').trim() === target);
};

/** 从连接配置文件中按优先级挑选目标 profile。 */
const loadProfileFromConnectionJson = async (
  filePath: string,
  preferredProfileName?: string,
  fallbackProfileName?: string,
): Promise<ConnectionProfile> => {
  const content = await readTextFile(filePath);
  const profiles = parseProfilesFromConnectionJson(content);
  if (profiles.length === 0) {
    throw new Error('连接配置文件中未找到有效 profile');
  }

  const candidateNames = [preferredProfileName, fallbackProfileName]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  for (const name of candidateNames) {
    const matched = profiles.find((profile) => (profile.name || '').trim() === name);
    if (matched) {
      return matched;
    }
  }

  const existingNames = new Set(
    useConnectionStore
      .getState()
      .connections
      .map((conn) => (conn.profile.name || '').trim())
      .filter(Boolean),
  );
  const matchedByExisting = profiles.filter((profile) => existingNames.has((profile.name || '').trim()));
  if (matchedByExisting.length === 1) {
    return matchedByExisting[0];
  }

  if (profiles.length === 1) {
    return profiles[0];
  }

  throw new Error('配置文件包含多个连接，请在收藏中指定连接名称');
};

interface UseMenuFavoritesOptions {
  askForConfirm: MenuDialogsState['askForConfirm'];
}

interface UseMenuFavoritesReturn {
  recentFavorites: FavoriteItem[];
  handleUseFavorite: (item: FavoriteItem) => Promise<void>;
  handleAddFavorite: (item: Omit<FavoriteItem, 'id'>) => Promise<void>;
}

export const useMenuFavorites = ({
  askForConfirm,
}: UseMenuFavoritesOptions): UseMenuFavoritesReturn => {
  const { t } = useTranslation();
  const { setStatusMessage } = useAppStore();
  const { addTab } = useTabStore();
  // 痕迹递推统一入口：连接/数据库仅取「打开状态」，不把已关闭的过期痕迹带入
  const trace = useTraceTarget();
  const {
    addConnection,
    updateConnection,
    connect,
    checkMaxConnections,
    getConnectionState,
    setActiveConnection,
    setActiveDatabase,
    getLastUsedDatabaseForConnection,
  } = useConnectionStore();

  const { favorites, getAll, add, recordUsage } = useFavorites();
  const [recentFavorites, setRecentFavorites] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    void getAll();
  }, [getAll]);

  useEffect(() => {
    const sorted = [...favorites].sort((a, b) => b.lastUsedTime - a.lastUsedTime);
    setRecentFavorites(sorted.slice(0, 9));
  }, [favorites]);

  const ensureConnectionOpened = useCallback(
    async (connectionName: string): Promise<boolean> => {
      const connectionState = findConnectionByName(connectionName) || getConnectionState(connectionName);
      if (!connectionState) {
        return false;
      }

      const actualName = connectionState.profile.name || connectionName;
      setActiveConnection(actualName);

      if (!connectionState.isConnected) {
        const { allowed, current, max } = checkMaxConnections();
        if (!allowed) {
          setStatusMessage(t('metadataTree.maxConnectionsReached', { current, max }));
          return false;
        }

        await connect(actualName);
        const latest = findConnectionByName(actualName) || getConnectionState(actualName);
        if (!latest?.isConnected) {
          setStatusMessage(latest?.error || t('error.connectionFailed', { message: '连接打开失败' }));
          return false;
        }
      }

      window.dispatchEvent(new CustomEvent('dbw:open-connection-node', { detail: { connectionName: actualName } }));

      return true;
    },
    [checkMaxConnections, connect, getConnectionState, setActiveConnection, setStatusMessage, t],
  );

  const ensureProfileReadyAndOpen = useCallback(
    async (incomingProfile: ConnectionProfile): Promise<ConnectionProfile | null> => {
      const profileName = incomingProfile.name?.trim();
      if (!profileName) {
        setStatusMessage('连接配置缺少 name，无法打开。');
        return null;
      }

      const normalizedIncoming = { ...incomingProfile, name: profileName };
      const existing = findConnectionByName(profileName);

      if (!existing) {
        const shouldCreate = await askForConfirm({
          title: t('common.confirm'),
          message: `连接 "${profileName}" 不存在，是否先按收藏配置新建后再打开？`,
          intent: 'warning',
        });
        if (!shouldCreate) {
          return null;
        }
        addConnection(normalizedIncoming);
        const created = findConnectionByName(profileName);
        if (!created) {
          setStatusMessage(`新建连接失败：${profileName}`);
          return null;
        }

        const opened = await ensureConnectionOpened(profileName);
        if (!opened) {
          return null;
        }
        return findConnectionByName(profileName)?.profile || null;
      }

      const isSameConfig =
        JSON.stringify(normalizeConnectionProfile(existing.profile))
        === JSON.stringify(normalizeConnectionProfile(normalizedIncoming));

      if (!isSameConfig) {
        const shouldOverwrite = await askForConfirm({
          title: t('common.confirm'),
          message: `连接 "${profileName}" 已存在且配置不同，是否覆盖当前连接配置？\n选择"否"将直接打开当前连接。`,
          intent: 'warning',
        });

        if (shouldOverwrite) {
          updateConnection(profileName, normalizedIncoming);
        }
      }

      const opened = await ensureConnectionOpened(profileName);
      if (!opened) {
        return null;
      }
      return findConnectionByName(profileName)?.profile || null;
    },
    [addConnection, askForConfirm, ensureConnectionOpened, setStatusMessage, t, updateConnection],
  );

  const openDatabaseObjectFromFavorite = useCallback(
    async (
      objectType: DatabaseObjectType,
      objectName: string,
      openMode: DatabaseObjectOpenMode,
      connectionProfile: ConnectionProfile,
      database: string,
    ) => {
      setActiveDatabase(database);

      if (openMode === 'LIST') {
        addTab({
          type: objectType === 'TABLE' ? 'tableList' : objectType === 'VIEW' ? 'viewList' : 'functionList',
          title: `${objectType} - ${database}`,
          connectionId: connectionProfile.name,
          connectionProfile,
          database,
          objectType,
        });
        return;
      }

      if (objectType === 'TABLE') {
        if (openMode === 'DESIGNER') {
          addTab({
            type: 'designer',
            title: t('tabTitles.designer.edit', { tableName: objectName }),
            connectionId: connectionProfile.name,
            connectionProfile,
            database,
            table: objectName,
          });
          return;
        }
        addTab({
          type: 'tableData',
          title: t('tabTitles.tableData', { tableName: objectName, database, connectionName: connectionProfile.name }),
          connectionId: connectionProfile.name,
          connectionProfile,
          database,
          table: objectName,
        });
        return;
      }

      if (objectType === 'VIEW') {
        if (openMode === 'DESIGNER') {
          addTab({
            type: 'viewDesigner',
            title: t('tabTitles.viewDesigner', { viewName: objectName }),
            connectionId: connectionProfile.name,
            connectionProfile,
            database,
            objectName,
          });
          return;
        }
        addTab({
          type: 'viewData',
          title: t('tabTitles.viewData', { viewName: objectName, database, connectionName: connectionProfile.name }),
          connectionId: connectionProfile.name,
          connectionProfile,
          database,
          objectName,
        });
        return;
      }

      addTab({
        type: 'functionDesigner',
        title: t('tabTitles.functionDesigner.editFunction', { name: objectName }),
        connectionId: connectionProfile.name,
        connectionProfile,
        database,
        objectName,
        data: { functionType: 'FUNCTION' },
      });
    },
    [addTab, setActiveDatabase, t],
  );

  const handleUseFavorite = useCallback(
    async (item: FavoriteItem) => {
      const payload = parseFavoritePayload(item);

      if (item.type === 'SQL_QUERY') {
        const sql = payload?.kind === 'SQL_QUERY' ? payload.sql : (item.content || '');
        if (!sql.trim()) {
          setStatusMessage('该 SQL 收藏没有可执行内容。');
          return;
        }

        // 未指定收藏连接的 SQL：默认预填「打开状态」的痕迹连接（统一走 trace 递推）
        let targetProfile = trace.connection;
        const targetConnectionName = payload?.kind === 'SQL_QUERY' ? payload.connectionName : undefined;
        if (targetConnectionName) {
          const opened = await ensureConnectionOpened(targetConnectionName);
          if (!opened) {
            return;
          }
          targetProfile = useConnectionStore.getState().connections.find((conn) => conn.profile.name === targetConnectionName)?.profile;
        }

        if (!targetProfile) {
          void showToolbarRequirementNotice(t('menu.favorites.use'), 'connection');
          return;
        }

        addTab({
          type: 'query',
          title: item.name,
          connectionId: targetProfile.name,
          connectionProfile: targetProfile,
          database: (payload?.kind === 'SQL_QUERY' ? payload.database : undefined) || (trace.databaseOpened ? trace.database : undefined),
          sqlContent: sql,
        });

        if (item.id) {
          await recordUsage(item.id);
        }
        setStatusMessage(`${t('menu.favorites.opened')}: ${item.name}`);
        return;
      }

      if (item.type === 'CONNECTION_PROFILE') {
        if (!payload || payload.kind !== 'CONNECTION_PROFILE') {
          setStatusMessage('连接收藏内容无效，请重新编辑。');
          return;
        }

        try {
          const profile = await loadProfileFromConnectionJson(payload.filePath, payload.profileName, item.name);
          const readyProfile = await ensureProfileReadyAndOpen(profile);
          if (!readyProfile) {
            return;
          }

          const preferredDatabase = readyProfile.database || getLastUsedDatabaseForConnection(readyProfile.name);
          if (preferredDatabase) {
            setActiveDatabase(preferredDatabase);
          }
          if (item.id) {
            await recordUsage(item.id);
          }
          setStatusMessage(`${t('menu.favorites.connection')}: ${readyProfile.name}`);
        } catch (error) {
          setStatusMessage(`连接收藏打开失败: ${String(error)}`);
        }
        return;
      }

      if (!payload || payload.kind !== 'DATABASE_OBJECT') {
        setStatusMessage('数据库对象收藏内容无效，请重新编辑。');
        return;
      }

      const objectType = payload.objectType;
      const objectName = payload.objectName;
      const database = payload.database;
      const connectionName = payload.connectionName;
      const openMode = payload.openMode || 'DATA';

      if (!objectType || !objectName || !database || !connectionName) {
        setStatusMessage(`数据库对象路径无效：${payload.path}`);
        return;
      }

      try {
        const profile = findConnectionByName(connectionName)?.profile || null;

        if (!profile?.name) {
          setStatusMessage(`未找到连接：${connectionName}`);
          return;
        }

        const opened = await ensureConnectionOpened(profile.name);
        if (!opened) {
          return;
        }

        await openDatabaseObjectFromFavorite(objectType, objectName, openMode, profile, database);
        if (item.id) {
          await recordUsage(item.id);
        }
        setStatusMessage(`${t('menu.favorites.object')}: ${item.name}`);
      } catch (error) {
        setStatusMessage(`数据库对象收藏打开失败: ${String(error)}`);
      }
    },
    [
      trace,
      addTab,
      ensureConnectionOpened,
      ensureProfileReadyAndOpen,
      getLastUsedDatabaseForConnection,
      openDatabaseObjectFromFavorite,
      recordUsage,
      setActiveDatabase,
      setStatusMessage,
      t,
    ],
  );

  const handleAddFavorite = useCallback(
    async (item: Omit<FavoriteItem, 'id'>) => {
      try {
        await add(item);
        setStatusMessage(t('menu.favorites.added'));
        await getAll();
      } catch (error) {
        setStatusMessage(t('menu.favorites.addFailed'));
      }
    },
    [add, getAll, setStatusMessage, t],
  );

  return {
    recentFavorites,
    handleUseFavorite,
    handleAddFavorite,
  };
};
