import { useState, useEffect, useMemo } from 'react';
import { useConnectionStore, useMetadataStore } from '@/stores';
import type { FavoriteItem, FavoriteType } from '@/types';
import {
  buildDatabaseObjectPath,
  parseDatabaseObjectPath,
  parseFavoritePayload,
  type DatabaseObjectOpenMode,
  type DatabaseObjectType,
} from './utils';

interface UseFavoritesFormOptions {
  editItem?: FavoriteItem | null;
  defaultType?: FavoriteType;
  isOpen: boolean;
}

interface UseFavoritesFormReturn {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  type: FavoriteType;
  setType: (v: FavoriteType) => void;
  sqlText: string;
  sqlFilePath: string;
  setSqlFilePath: (v: string) => void;
  connectionFilePath: string;
  setConnectionFilePath: (v: string) => void;
  connectionProfileName: string;
  setConnectionProfileName: (v: string) => void;
  objectConnectionName: string;
  setObjectConnectionName: (v: string) => void;
  objectDatabase: string;
  setObjectDatabase: (v: string) => void;
  objectType: DatabaseObjectType;
  setObjectType: (v: DatabaseObjectType) => void;
  objectName: string;
  setObjectName: (v: string) => void;
  objectOpenMode: DatabaseObjectOpenMode;
  setObjectOpenMode: (v: DatabaseObjectOpenMode) => void;
  databaseOptions: string[];
  objectOptions: string[];
  loadingDatabases: boolean;
  loadingObjects: boolean;
  connectionNameOptions: string[];
  generatedObjectPath: string;
  canSave: boolean;
  buildFavoriteContent: () => string;
  handleSetSqlText: (v: string) => void;
}

export function useFavoritesForm(options: UseFavoritesFormOptions): UseFavoritesFormReturn {
  const { editItem, defaultType = 'SQL_QUERY', isOpen } = options;
  const { connections, activeConnectionId } = useConnectionStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<FavoriteType>(defaultType);
  const [sqlText, setSqlText] = useState('');
  const [sqlFilePath, setSqlFilePath] = useState('');
  const [connectionFilePath, setConnectionFilePath] = useState('');
  const [connectionProfileName, setConnectionProfileName] = useState('');
  const [objectConnectionName, setObjectConnectionName] = useState('');
  const [objectDatabase, setObjectDatabase] = useState('');
  const [objectType, setObjectType] = useState<DatabaseObjectType>('TABLE');
  const [objectName, setObjectName] = useState('');
  const [objectOpenMode, setObjectOpenMode] = useState<DatabaseObjectOpenMode>('DATA');
  const [databaseOptions, setDatabaseOptions] = useState<string[]>([]);
  const [objectOptions, setObjectOptions] = useState<string[]>([]);
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [loadingObjects, setLoadingObjects] = useState(false);

  const resetFields = () => {
    setSqlText('');
    setSqlFilePath('');
    setConnectionFilePath('');
    setConnectionProfileName('');
    setObjectConnectionName('');
    setObjectDatabase('');
    setObjectType('TABLE');
    setObjectName('');
    setObjectOpenMode('DATA');
    setDatabaseOptions([]);
    setObjectOptions([]);
  };

  useEffect(() => {
    if (!isOpen) return;
    if (editItem) {
      setName(editItem.name);
      setDescription(editItem.description || '');
      setType(editItem.type);
      resetFields();
      const payload = parseFavoritePayload(editItem);
      if (payload?.kind === 'SQL_QUERY') {
        setSqlText(payload.sql || '');
        setSqlFilePath(payload.sourceFilePath || '');
      } else if (payload?.kind === 'CONNECTION_PROFILE') {
        setConnectionFilePath(payload.filePath || '');
        setConnectionProfileName(payload.profileName || '');
      } else if (payload?.kind === 'DATABASE_OBJECT') {
        const parsed = parseDatabaseObjectPath(payload.path);
        setObjectConnectionName(payload.connectionName || parsed.connectionName || '');
        setObjectDatabase(payload.database || parsed.database || '');
        setObjectType(payload.objectType || parsed.objectType || 'TABLE');
        setObjectName(payload.objectName || parsed.objectName || '');
        setObjectOpenMode(payload.openMode || 'DATA');
      } else if (editItem.type === 'SQL_QUERY') {
        setSqlText(editItem.content || '');
      }
      return;
    }
    setName('');
    setDescription('');
    setType(defaultType);
    resetFields();
  }, [defaultType, editItem, isOpen]);

  useEffect(() => {
    if (type !== 'DATABASE_OBJECT' || objectConnectionName.trim()) return;
    if (activeConnectionId) {
      setObjectConnectionName(activeConnectionId);
      return;
    }
    const first = connections[0]?.profile.name;
    if (first) setObjectConnectionName(first);
  }, [type, objectConnectionName, activeConnectionId, connections]);

  useEffect(() => {
    if (type !== 'DATABASE_OBJECT') return;
    const connName = objectConnectionName.trim();
    if (!connName) {
      setDatabaseOptions([]);
      setObjectDatabase('');
      setObjectOptions([]);
      setObjectName('');
      return;
    }
    const profile = connections.find((c) => c.profile.name === connName)?.profile;
    if (!profile) {
      setDatabaseOptions([]);
      setObjectDatabase('');
      setObjectOptions([]);
      setObjectName('');
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoadingDatabases(true);
      try {
        const dbs = await useMetadataStore.getState().fetchDatabases(profile);
        if (cancelled) return;
        setDatabaseOptions(dbs);
        if (!dbs.includes(objectDatabase)) {
          setObjectDatabase('');
          setObjectOptions([]);
          setObjectName('');
        }
      } catch {
        if (!cancelled) {
          setDatabaseOptions([]);
          setObjectDatabase('');
          setObjectOptions([]);
          setObjectName('');
        }
      } finally {
        if (!cancelled) setLoadingDatabases(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [type, objectConnectionName, objectDatabase, connections]);

  useEffect(() => {
    if (type !== 'DATABASE_OBJECT') return;
    const profile = connections.find((c) => c.profile.name === objectConnectionName.trim())?.profile;
    const db = objectDatabase.trim();
    if (!profile || !db) {
      setObjectOptions([]);
      setObjectName('');
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoadingObjects(true);
      try {
        const objs = objectType === 'TABLE'
          ? await useMetadataStore.getState().fetchTables(profile, db)
          : objectType === 'VIEW'
            ? await useMetadataStore.getState().fetchViews(profile, db)
            : await useMetadataStore.getState().fetchFunctions(profile, db);
        if (cancelled) return;
        setObjectOptions(objs);
        if (!objs.includes(objectName)) setObjectName('');
      } catch {
        if (!cancelled) {
          setObjectOptions([]);
          setObjectName('');
        }
      } finally {
        if (!cancelled) setLoadingObjects(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [type, objectConnectionName, objectDatabase, objectType, objectName, connections]);

  const connectionNameOptions = useMemo(
    () => connections.map((c) => c.profile.name || '').filter(Boolean),
    [connections]
  );

  const generatedObjectPath = buildDatabaseObjectPath(
    objectConnectionName,
    objectDatabase,
    objectType,
    objectName
  );

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (type === 'SQL_QUERY') return sqlText.trim().length > 0;
    if (type === 'CONNECTION_PROFILE') return connectionFilePath.trim().length > 0;
    return objectConnectionName.trim().length > 0 && objectDatabase.trim().length > 0 && objectName.trim().length > 0;
  }, [name, type, sqlText, connectionFilePath, objectConnectionName, objectDatabase, objectName]);

  const buildFavoriteContent = (): string => {
    if (type === 'SQL_QUERY') {
      return JSON.stringify({ version: 1, kind: 'SQL_QUERY', sql: sqlText, sourceFilePath: sqlFilePath || undefined });
    }
    if (type === 'CONNECTION_PROFILE') {
      return JSON.stringify({ version: 1, kind: 'CONNECTION_PROFILE', filePath: connectionFilePath, profileName: connectionProfileName || undefined });
    }
    return JSON.stringify({
      version: 1, kind: 'DATABASE_OBJECT', path: generatedObjectPath,
      connectionName: objectConnectionName, database: objectDatabase,
      objectType, objectName, openMode: objectOpenMode,
    });
  };

  return {
    name, setName,
    description, setDescription,
    type, setType,
    sqlText, sqlFilePath, setSqlFilePath,
    connectionFilePath, setConnectionFilePath,
    connectionProfileName, setConnectionProfileName,
    objectConnectionName, setObjectConnectionName,
    objectDatabase, setObjectDatabase,
    objectType, setObjectType,
    objectName, setObjectName,
    objectOpenMode, setObjectOpenMode,
    databaseOptions, objectOptions,
    loadingDatabases, loadingObjects,
    connectionNameOptions,
    generatedObjectPath,
    canSave,
    buildFavoriteContent,
    handleSetSqlText: setSqlText,
  };
}
