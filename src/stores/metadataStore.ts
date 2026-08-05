// stores/metadataStore.ts —— V2 元数据统一缓存

import { create } from 'zustand';
import { metadataApi } from '../api/metadata';
import type { ConnectionProfile } from '../types/connection';
import type {
  TableDetail,
  ViewDetail,
  FunctionDetail,
  RoutineDetail,
  RoutineParamInfo,
  MetadataRecord,
} from '../types/metadata';

const METADATA_TTL_MS = 30_000;

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

interface MetadataStoreState {
  cache: Map<string, CacheEntry>;
  inFlight: Map<string, Promise<unknown>>;

  // 读取型 action：命中缓存则返回，否则调用 metadataApi 并缓存
  fetchDatabases: (profile: ConnectionProfile) => Promise<string[]>;
  fetchAllDatabases: (profile: ConnectionProfile) => Promise<string[]>;
  fetchTables: (
    profile: ConnectionProfile,
    database: string,
  ) => Promise<string[]>;
  fetchTableDetails: (
    profile: ConnectionProfile,
    database: string,
  ) => Promise<TableDetail[]>;
  fetchViews: (
    profile: ConnectionProfile,
    database: string,
  ) => Promise<string[]>;
  fetchViewDetails: (
    profile: ConnectionProfile,
    database: string,
  ) => Promise<ViewDetail[]>;
  fetchFunctions: (
    profile: ConnectionProfile,
    database: string,
  ) => Promise<string[]>;
  fetchRoutinesWithDetails: (
    profile: ConnectionProfile,
    database: string,
  ) => Promise<RoutineDetail[]>;
  fetchFunctionDetails: (
    profile: ConnectionProfile,
    database: string,
  ) => Promise<FunctionDetail[]>;
  fetchColumns: (
    profile: ConnectionProfile,
    database: string,
    table: string,
  ) => Promise<MetadataRecord[]>;
  fetchForeignKeys: (
    profile: ConnectionProfile,
    database: string,
    table: string,
  ) => Promise<MetadataRecord[]>;
  fetchIndexes: (
    profile: ConnectionProfile,
    database: string,
    table: string,
  ) => Promise<MetadataRecord[]>;
  fetchTriggers: (
    profile: ConnectionProfile,
    database: string,
    table: string,
  ) => Promise<MetadataRecord[]>;
  fetchChecks: (
    profile: ConnectionProfile,
    database: string,
    table: string,
  ) => Promise<MetadataRecord[]>;
  loadDdl: (
    profile: ConnectionProfile,
    database: string,
    table: string,
  ) => Promise<string>;
  getFunctionDdl: (
    profile: ConnectionProfile,
    database: string,
    name: string,
    routineType: string,
  ) => Promise<string>;
  getRoutineParams: (
    profile: ConnectionProfile,
    database: string,
    name: string,
  ) => Promise<RoutineParamInfo[]>;

  invalidate: (profile?: ConnectionProfile, database?: string) => void;
  invalidateAll: () => void;
}

const getProfileKey = (profile: ConnectionProfile): string =>
  [
    profile.host,
    profile.port,
    profile.username,
    profile.database ?? '',
    profile.sslMode ?? '',
    profile.sslCaPath ?? '',
  ].join('|');

const buildCacheKey = (
  command: string,
  profile: ConnectionProfile,
  ...parts: string[]
): string => {
  return [command, getProfileKey(profile), ...parts].join('::');
};

const buildScopePrefix = (profile?: ConnectionProfile, database?: string): string | null => {
  if (!profile) return null;
  const profileKey = getProfileKey(profile);
  if (!database) return profileKey;
  return `${profileKey}::${database}`;
};

/**
 * 内部工具：执行带缓存的 fetch
 */
const cachedFetch = <T>(
  state: MetadataStoreState,
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> => {
  const now = Date.now();
  const cached = state.cache.get(key);
  if (cached && cached.expiresAt > now) {
    return Promise.resolve(cached.value as T);
  }

  const existing = state.inFlight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const request = fetcher()
    .then((result) => {
      state.cache.set(key, { value: result, expiresAt: Date.now() + METADATA_TTL_MS });
      return result;
    })
    .finally(() => {
      state.inFlight.delete(key);
    });

  state.inFlight.set(key, request);
  return request;
};

export const useMetadataStore = create<MetadataStoreState>((set, get) => {
  // 订阅全局刷新事件（与 V1 行为一致）
  if (typeof window !== 'undefined') {
    const win = window as Window & { __dbwMetadataStoreHooked?: boolean };
    if (!win.__dbwMetadataStoreHooked) {
      window.addEventListener('dbw:global-refresh', () => {
        get().invalidateAll();
      });
      win.__dbwMetadataStoreHooked = true;
    }
  }

  return {
    cache: new Map<string, CacheEntry>(),
    inFlight: new Map<string, Promise<unknown>>(),

    fetchDatabases: (profile) =>
      cachedFetch(get(), buildCacheKey('listDatabases', profile), () =>
        metadataApi.listDatabases(profile),
      ),

    fetchAllDatabases: (profile) =>
      cachedFetch(get(), buildCacheKey('getAllDatabases', profile), () =>
        metadataApi.getAllDatabases(profile),
      ),

    fetchTables: (profile, database) =>
      cachedFetch(get(), buildCacheKey('listTables', profile, database), () =>
        metadataApi.listTables(profile, database),
      ),

    fetchTableDetails: (profile, database) =>
      cachedFetch(get(), buildCacheKey('listTableDetails', profile, database), () =>
        metadataApi.listTableDetails(profile, database),
      ),

    fetchViews: (profile, database) =>
      cachedFetch(get(), buildCacheKey('listViews', profile, database), () =>
        metadataApi.listViews(profile, database),
      ),

    fetchViewDetails: (profile, database) =>
      cachedFetch(get(), buildCacheKey('listViewDetails', profile, database), () =>
        metadataApi.listViewDetails(profile, database),
      ),

    fetchFunctions: (profile, database) =>
      cachedFetch(get(), buildCacheKey('listFunctions', profile, database), () =>
        metadataApi.listFunctions(profile, database),
      ),

    fetchRoutinesWithDetails: (profile, database) =>
      cachedFetch(
        get(),
        buildCacheKey('listRoutinesWithDetails', profile, database),
        () => metadataApi.listRoutinesWithDetails(profile, database),
      ),

    fetchFunctionDetails: (profile, database) =>
      cachedFetch(get(), buildCacheKey('listFunctionDetails', profile, database), () =>
        metadataApi.listFunctionDetails(profile, database),
      ),

    fetchColumns: (profile, database, table) =>
      cachedFetch(
        get(),
        buildCacheKey('listColumns', profile, database, table),
        () => metadataApi.listColumns(profile, database, table),
      ),

    fetchForeignKeys: (profile, database, table) =>
      cachedFetch(
        get(),
        buildCacheKey('listForeignKeys', profile, database, table),
        () => metadataApi.listForeignKeys(profile, database, table),
      ),

    fetchIndexes: (profile, database, table) =>
      cachedFetch(
        get(),
        buildCacheKey('listIndexes', profile, database, table),
        () => metadataApi.listIndexes(profile, database, table),
      ),

    fetchTriggers: (profile, database, table) =>
      cachedFetch(
        get(),
        buildCacheKey('listTriggers', profile, database, table),
        () => metadataApi.listTriggers(profile, database, table),
      ),

    fetchChecks: (profile, database, table) =>
      cachedFetch(
        get(),
        buildCacheKey('listChecks', profile, database, table),
        () => metadataApi.listChecks(profile, database, table),
      ),

    loadDdl: (profile, database, table) =>
      cachedFetch(
        get(),
        buildCacheKey('loadDdl', profile, database, table),
        () => metadataApi.loadDdl(profile, database, table),
      ),

    getFunctionDdl: (profile, database, name, routineType) =>
      cachedFetch(
        get(),
        buildCacheKey('getFunctionDdl', profile, database, name, routineType),
        () => metadataApi.getFunctionDdl(profile, database, name, routineType),
      ),

    getRoutineParams: (profile, database, name) =>
      cachedFetch(
        get(),
        buildCacheKey('getRoutineParams', profile, database, name),
        () => metadataApi.getRoutineParams(profile, database, name),
      ),

    invalidate: (profile, database) => {
      const prefix = buildScopePrefix(profile, database);
      if (!prefix) {
        get().invalidateAll();
        return;
      }
      set((state) => {
        const next = new Map(state.cache);
        for (const key of next.keys()) {
          if (key.includes(prefix)) {
            next.delete(key);
          }
        }
        return { cache: next };
      });
    },

    invalidateAll: () => {
      set((state) => {
        state.cache.clear();
        state.inFlight.clear();
        return { cache: state.cache, inFlight: state.inFlight };
      });
    },
  };
});
