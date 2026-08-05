import React, { useState, useRef, useCallback, useEffect } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { useTranslation } from 'react-i18next';
import type { ConnectionProfile } from '@/types';
import { useAppStore, useConnectionStore, useTabStore } from '@/stores';
import { QueryToolbar } from './QueryToolbar';
import { QueryEditor, type QueryEditorRef } from './QueryEditor';
import { ResultPanel } from './ResultPanel';
import { useQueryExecution } from '../useQueryExecution';
import { useQueryPool } from '../useQueryPool';
import { cn } from '@/lib/cn';
import { debounce, type DebouncedFunction } from '@/lib/fp';
import { ChevronDownIcon, ChevronUpIcon } from '@/components/icons/NavIcons';
import { getEditorSettings } from '@/lib/editorSettings';

interface QueryTabProps {
  tabId: string;
  initialConnection?: ConnectionProfile;
  initialDatabase?: string;
}

// Split pane resizer component with collapse button
const SplitPaneResizer: React.FC<{
  isDragging: boolean;
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  onToggleCollapse: () => void;
}> = ({ isDragging, onMouseDown, onToggleCollapse }) => {
  const { theme } = useAppStore();
  const handleCollapseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleCollapse();
  };

  return (
    <div
      className={cn(
        'relative z-[2] flex h-2.5 flex-shrink-0 cursor-row-resize touch-none items-center justify-center border-y',
        theme === 'dark' ? 'border-[#3e3e42] bg-[#252a31]' : 'border-[#e1e5e9] bg-[#f5f6f7]',
        isDragging && (theme === 'dark' ? 'bg-[#60a5fa]' : 'bg-[#2d72d2]'),
        !isDragging && (theme === 'dark' ? 'hover:bg-[#60a5fa]' : 'hover:bg-[#2d72d2]'),
      )}
      onMouseDown={onMouseDown}
    >
      <div className={cn(
        'h-0.5 w-[30px] rounded-[1px]',
        theme === 'dark' ? 'bg-[#abb3bf]' : 'bg-[#5f6b7c]',
        isDragging && 'bg-white',
      )} />
      <button
        className={cn(
          'absolute left-2 z-[3] flex cursor-pointer items-center justify-center rounded-[3px] border px-1.5 py-0.5 text-[11px] transition-all duration-150',
          theme === 'dark' ? 'border-[#3e3e42] bg-[#252a31] text-[#abb3bf]' : 'border-[#e1e5e9] bg-[#f5f6f7] text-[#5f6b7c]',
          isDragging
            ? 'border-white bg-[#2d72d2] text-white'
            : theme === 'dark'
              ? 'hover:border-[#60a5fa] hover:bg-[#60a5fa] hover:text-white'
              : 'hover:border-[#2d72d2] hover:bg-[#2d72d2] hover:text-white',
        )}
        onClick={handleCollapseClick}
        title="折叠结果面板"
      >
        <ChevronDownIcon size={12} />
      </button>
    </div>
  );
};

const SPLITTER_HEIGHT = 8;
const MIN_EDITOR_HEIGHT = 160;
const MIN_RESULT_HEIGHT = 140;
const SQL_STORE_SYNC_DEBOUNCE_MS = 180;
const MENU_EDIT_EVENT_COMMANDS = {
  'dbw:undo': 'undo',
  'dbw:redo': 'redo',
  'dbw:cut': 'editor.action.clipboardCutAction',
  'dbw:copy': 'editor.action.clipboardCopyAction',
  'dbw:paste': 'editor.action.clipboardPasteAction',
  'dbw:select-all': 'editor.action.selectAll',
} as const;
type MenuEditEventName = keyof typeof MENU_EDIT_EVENT_COMMANDS;

const clampEditorHeight = (containerHeight: number, targetHeight: number): number => {
  if (containerHeight <= 0) return MIN_EDITOR_HEIGHT;

  const maxEditorHeight = Math.max(
    MIN_EDITOR_HEIGHT,
    containerHeight - SPLITTER_HEIGHT - MIN_RESULT_HEIGHT,
  );

  const minEditorHeight = Math.min(MIN_EDITOR_HEIGHT, maxEditorHeight);

  return Math.min(maxEditorHeight, Math.max(minEditorHeight, targetHeight));
};

export const QueryTab: React.FC<QueryTabProps> = ({
  tabId,
  initialConnection,
  initialDatabase,
}) => {
  const { t } = useTranslation();
  const { setStatusMessage: setGlobalStatusMessage, theme } = useAppStore();
  const activeTabId = useTabStore((state) => state.activeTabId);
  const updateTab = useTabStore((state) => state.updateTab);
  const setTabModified = useTabStore((state) => state.setTabModified);
  const currentTab = useTabStore((state) => state.tabs.find((tab) => tab.id === tabId));
  const {
    connections,
    activeConnectionId,
    activeDatabase,
    isDatabaseOpened,
    setActiveConnection,
    setActiveDatabase,
    setLastUsedDatabaseForConnection,
    getLastUsedDatabaseForConnection,
    clearLastUsedDatabaseForConnection,
  } = useConnectionStore();
  const activeConnection = connections.find((c) => c.profile.name === activeConnectionId);
  // 痕迹递推统一规则：查询页内 fallback 只跟随「打开状态」的痕迹连接/数据库，
  // 连接已关闭时不把过期痕迹带入（与 useTraceTarget.resolveQueryTrace 语义一致）
  const activeTraceConnection = activeConnection?.isConnected ? activeConnection.profile : undefined;

  // Editor ref
  const editorRef = useRef<QueryEditorRef>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(0);

  // Split pane state (pixel based)
  const [editorHeightPx, setEditorHeightPx] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  // Connection state
  const [selectedConnection, setSelectedConnection] = useState<ConnectionProfile | undefined>(initialConnection || activeTraceConnection);
  // 优先使用initialDatabase，否则仅在「痕迹连接打开且痕迹数据库已打开」时预填，
  // 不使用lastUsedDatabase作为初始值
  // lastUsedDatabase只在用户明确选择连接后、没有指定数据库时作为后备
  const [selectedDatabase, setSelectedDatabase] = useState<string | undefined>(
    initialDatabase !== undefined
      ? initialDatabase
      : (activeTraceConnection && activeDatabase && isDatabaseOpened(activeTraceConnection.name, activeDatabase)
          ? activeDatabase
          : undefined)
  );
  const [isConnected, setIsConnected] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState('');
  const pool = useQueryPool();
  const { poolId, connId } = pool;

  const [statusMessage, setStatusMessage] = useState('');
  const [hasSelection, setHasSelection] = useState(false);

  // Transaction state
  const [autoCommit, setAutoCommit] = useState(true);

  const [isResultPanelCollapsed, setIsResultPanelCollapsed] = useState(true); // Default collapsed

  // 执行引擎与结果集状态（V2：收敛到 useQueryExecution）
  const {
    isExecuting,
    resultTabs,
    metaResultTabs,
    activeResultTabId,
    executionWallTimeSec,
    setActiveResultTabId,
    executeSql,
    requestQueryPage,
    explainSql,
    clearResults,
    closeResultTab,
  } = useQueryExecution({
    poolId,
    connId,
    isConnected,
    selectedConnection,
    selectedDatabase,
    setSelectedDatabase,
    tabId,
    editorRef,
    setStatusMessage,
    expandResultPanel: () => setIsResultPanelCollapsed(false),
  });

  // SQL content
  const [sqlContent, setSqlContent] = useState(currentTab?.sqlContent || '');
  const savedSqlContentRef = useRef(currentTab?.sqlContent || '');
  const latestSqlContentRef = useRef(currentTab?.sqlContent || '');
  const pendingSqlContentForStoreRef = useRef<string | null>(null);

  // Auto save
  const editorSettingsRef = useRef(getEditorSettings());

  const buildDefaultSqlFileName = useCallback(() => {
    const baseTitle = (currentTab?.title || 'query')
      .replace(/^\*/, '')
      .replace(/\s+/g, '_')
      .replace(/[\\/:*?"<>|]/g, '_')
      .trim();

    const normalized = baseTitle || 'query';
    return normalized.toLowerCase().endsWith('.sql') ? normalized : `${normalized}.sql`;
  }, [currentTab?.title]);

  const flushPendingSqlToStore = useCallback(() => {
    const pendingValue = pendingSqlContentForStoreRef.current;
    if (pendingValue == null) return;

    updateTab(tabId, { sqlContent: pendingValue });
    setTabModified(tabId, pendingValue !== savedSqlContentRef.current);
    pendingSqlContentForStoreRef.current = null;
  }, [setTabModified, tabId, updateTab]);

  const saveSqlFile = useCallback(async (forcedFilePath?: string, isAutoSave = false): Promise<boolean> => {
    try {
      let filePath = forcedFilePath || currentTab?.sqlFilePath;

      if (!filePath) {
        const selectedPath = await save({
          filters: [{ name: 'SQL', extensions: ['sql'] }],
          defaultPath: buildDefaultSqlFileName(),
        });
        if (!selectedPath) {
          setStatusMessage(t('resultPanel.exportCancelled'));
          setGlobalStatusMessage(t('resultPanel.exportCancelled'));
          return false;
        }
        filePath = selectedPath;
      }

      // Read from ref to always persist the most recent editor content.
      const contentToSave = latestSqlContentRef.current;
      await writeTextFile(filePath, contentToSave);

      const fileName = filePath.split(/[/\\]/).pop() || 'query.sql';
      savedSqlContentRef.current = contentToSave;
      
      // For auto save, don't update sqlContent in tab to avoid editor re-render/flicker
      // The editor already has the correct content
      if (isAutoSave) {
        updateTab(tabId, {
          title: fileName,
          sqlFilePath: filePath,
          // Don't include sqlContent here to prevent re-render
        });
      } else {
        updateTab(tabId, {
          title: fileName,
          sqlFilePath: filePath,
          sqlContent: contentToSave,
        });
      }
      setTabModified(tabId, false);

      const message = isAutoSave ? t('status.autoSaved') : t('status.saved');
      setStatusMessage(message);
      setGlobalStatusMessage(message);
      return true;
    } catch (error) {
      const message = t('error.saveFailed', { message: error });
      setStatusMessage(message);
      setGlobalStatusMessage(message);
      return false;
    }
  }, [
    buildDefaultSqlFileName,
    currentTab?.sqlFilePath,
    flushPendingSqlToStore,
    setGlobalStatusMessage,
    tabId,
    updateTab,
    setTabModified,
  ]);

  // 防抖工具（lib/fp）：SQL 写入 store 180ms 防抖，外部文件自动保存 2000ms 防抖。
  // 通过 ref 持有最新回调，避免 debounce 闭包捕获过期函数。
  const flushPendingSqlToStoreRef = useRef(flushPendingSqlToStore);
  flushPendingSqlToStoreRef.current = flushPendingSqlToStore;
  const saveSqlFileRef = useRef(saveSqlFile);
  saveSqlFileRef.current = saveSqlFile;

  const sqlStoreSyncDebouncedRef = useRef<DebouncedFunction<[]> | null>(null);
  if (!sqlStoreSyncDebouncedRef.current) {
    sqlStoreSyncDebouncedRef.current = debounce(() => {
      flushPendingSqlToStoreRef.current();
    }, SQL_STORE_SYNC_DEBOUNCE_MS);
  }

  const autoSaveDebouncedRef = useRef<DebouncedFunction<[]> | null>(null);
  if (!autoSaveDebouncedRef.current) {
    autoSaveDebouncedRef.current = debounce(() => {
      void saveSqlFileRef.current(undefined, true);
    }, 2000);
  }

  const scheduleSqlStoreSync = useCallback(() => {
    sqlStoreSyncDebouncedRef.current?.();
  }, []);

  const handleSqlContentChange = useCallback((nextValue: string) => {
    setSqlContent(nextValue);
    latestSqlContentRef.current = nextValue;
    pendingSqlContentForStoreRef.current = nextValue;
    scheduleSqlStoreSync();

    const modified = nextValue !== savedSqlContentRef.current;

    // Auto save logic: only for external files with sqlFilePath
    if (modified && currentTab?.sqlFilePath && editorSettingsRef.current.editorAutoSave) {
      // 2000ms 防抖：连续输入时重置计时，停顿后触发一次自动保存
      autoSaveDebouncedRef.current?.();
    }
  }, [currentTab?.sqlFilePath, scheduleSqlStoreSync]);

  const handleResizerMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const containerHeight = contentRef.current?.clientHeight || 0;
    dragStartYRef.current = event.clientY;
    dragStartHeightRef.current = editorHeightPx ?? Math.floor(containerHeight * 0.68);
    setIsResizing(true);
  }, [editorHeightPx]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (event: MouseEvent) => {
      const containerHeight = contentRef.current?.clientHeight || 0;
      if (containerHeight <= 0) return;

      const delta = event.clientY - dragStartYRef.current;
      const nextHeight = dragStartHeightRef.current + delta;
      setEditorHeightPx(clampEditorHeight(containerHeight, nextHeight));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const syncHeight = () => {
      const containerHeight = container.clientHeight;
      if (containerHeight <= 0) return;

      setEditorHeightPx((previous) => {
        if (previous == null) {
          return clampEditorHeight(containerHeight, Math.floor(containerHeight * 0.68));
        }
        return clampEditorHeight(containerHeight, previous);
      });
    };

    syncHeight();

    const observer = new ResizeObserver(syncHeight);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // Connect to database
  const connect = useCallback(async (profile: ConnectionProfile, database?: string) => {
    if (!profile) return;

    const targetDatabase = database || getLastUsedDatabaseForConnection(profile.name);

    try {
      // Close existing connection
      await pool.closeCurrent();

      setStatusMessage(t('queryToolbar.connecting'));

      let opened;
      let resolvedDatabase = targetDatabase;

      // Clear stale remembered database and retry once without database binding.
      if (targetDatabase) {
        try {
          opened = await pool.openWithTarget(profile, targetDatabase);
        } catch (error) {
          const message = String(error).toLowerCase();
          const isUnknownDatabase = message.includes('unknown database') || message.includes('error 1049');
          if (!isUnknownDatabase) {
            throw error;
          }

          if (profile.name) {
            clearLastUsedDatabaseForConnection(profile.name);
          }
          resolvedDatabase = undefined;
          opened = await pool.openWithTarget(profile, undefined);
        }
      } else {
        opened = await pool.openWithTarget(profile, undefined);
      }

      pool.applyOpened(opened);
      setActiveConnection(profile.name || null);
      if (resolvedDatabase) {
        setSelectedDatabase(resolvedDatabase);
        setActiveDatabase(resolvedDatabase);
        if (profile.name) {
          setLastUsedDatabaseForConnection(profile.name, resolvedDatabase);
        }
      } else {
        setSelectedDatabase(undefined);
        setActiveDatabase(null);
      }
      setIsConnected(true);
      setConnectionInfo(`${profile.host}:${profile.port}`);
      setStatusMessage(t('connection.connected'));
    } catch (error) {
      setIsConnected(false);
      setConnectionInfo('');
      setStatusMessage(t('error.connectionFailed', { message: error }));
    }
  }, [
    clearLastUsedDatabaseForConnection,
    getLastUsedDatabaseForConnection,
    pool,
    setActiveConnection,
    setActiveDatabase,
    setLastUsedDatabaseForConnection,
    t,
  ]);

  // Disconnect
  const disconnect = useCallback(async () => {
    try {
      await pool.closeCurrent();
    } catch (error) {
      console.error('Disconnect error:', error);
    }
    setIsConnected(false);
    setConnectionInfo('');
    setStatusMessage('');
  }, [pool]);

  useEffect(() => {
    if (!selectedConnection?.name) return;
    const stillExists = connections.some((conn) => conn.profile.name === selectedConnection.name);
    if (stillExists) return;

    setSelectedConnection(undefined);
    setSelectedDatabase(undefined);
    setActiveConnection(null);
    setActiveDatabase(null);
    void disconnect();
  }, [
    connections,
    disconnect,
    selectedConnection,
    setActiveConnection,
    setActiveDatabase,
  ]);

  // Switch database
  const switchDatabase = useCallback(async (database: string) => {
    if (!poolId || !connId || !isConnected) return;

    try {
      await pool.switchDatabase(database);
      setSelectedDatabase(database);
      setActiveDatabase(database);
      if (selectedConnection?.name) {
        setLastUsedDatabaseForConnection(selectedConnection.name, database);
      }
      setStatusMessage(t('status.connected', { database }));
    } catch (error) {
      setStatusMessage(t('error.queryFailed', { message: error }));
    }
  }, [
    pool,
    poolId,
    connId,
    isConnected,
    selectedConnection,
    setActiveDatabase,
    setLastUsedDatabaseForConnection,
  ]);

  // Format SQL
  const formatSql = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;

    const sql = editor.getValue();

    if (!sql.trim()) return;

    try {
      const formatted = await pool.formatSql(sql);
      const model = editor.getModel();
      if (model) {
        model.setValue(formatted);
      }
      setStatusMessage(t('queryToolbar.formatSuccess'));
    } catch (error) {
      setStatusMessage(t('queryToolbar.formatFailed'));
    }
  }, [pool, t]);

  // Clear SQL
  const clearSql = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const model = editor.getModel();
    if (model) {
      model.setValue('');
    }
    setStatusMessage('');
  }, []);

  // Insert snippet
  const insertSnippet = useCallback((snippet: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    const position = editor.getPosition();
    if (position) {
      editor.executeEdits('snippet', [{
        range: {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        },
        text: snippet,
      }]);
      editor.setPosition({
        lineNumber: position.lineNumber,
        column: position.column + snippet.length,
      });
      editor.focus();
    }
  }, []);

  // Handle transaction mode change
  const handleTransactionModeChange = useCallback(async (mode: 'auto' | 'manual') => {
    if (!isConnected || !poolId || !connId) return;

    const isAuto = mode === 'auto';
    try {
      await pool.executeSql(`SET autocommit=${isAuto ? '1' : '0'}`);
      setAutoCommit(isAuto);
      setStatusMessage(isAuto ? t('queryToolbar.autoCommit') : t('queryToolbar.manualCommit'));
    } catch (error) {
      setStatusMessage(t('queryToolbar.txModeFailed'));
    }
  }, [isConnected, pool, poolId, connId, t]);

  // Commit transaction
  const commitTransaction = useCallback(async () => {
    if (!isConnected || !poolId || !connId) return;

    try {
      await pool.executeSql('COMMIT');
      setStatusMessage(t('queryToolbar.commitSuccess'));
    } catch (error) {
      setStatusMessage(t('queryToolbar.commitFailed'));
    }
  }, [isConnected, pool, poolId, connId, t]);

  // Rollback transaction
  const rollbackTransaction = useCallback(async () => {
    if (!isConnected || !poolId || !connId) return;

    try {
      await pool.executeSql('ROLLBACK');
      setStatusMessage(t('queryToolbar.rollbackSuccess'));
    } catch (error) {
      setStatusMessage(t('queryToolbar.rollbackFailed'));
    }
  }, [isConnected, pool, poolId, connId, t]);

  // Initial connection
  useEffect(() => {
    if (initialConnection && !isConnected) {
      connect(initialConnection, initialDatabase);
    }
  }, [initialConnection, initialDatabase, connect, isConnected]);

  useEffect(() => {
    // 页内 fallback 同样只跟随「打开状态」的痕迹连接（统一递推规则）
    if (!selectedConnection && activeTraceConnection) {
      setSelectedConnection(activeTraceConnection);
    }
  }, [activeConnection, activeTraceConnection, selectedConnection]);

  useEffect(() => {
    if (currentTab?.sqlContent === undefined) return;
    if (currentTab.sqlContent === latestSqlContentRef.current) return;

    latestSqlContentRef.current = currentTab.sqlContent;
    pendingSqlContentForStoreRef.current = null;

    sqlStoreSyncDebouncedRef.current?.cancel();

    setSqlContent(currentTab.sqlContent);
  }, [currentTab?.sqlContent]);

  useEffect(() => {
    const handleSaveCurrentTab = () => {
      if (activeTabId !== tabId) return;
      void saveSqlFile();
    };

    const handleSaveAs = (event: Event) => {
      if (activeTabId !== tabId) return;
      const customEvent = event as CustomEvent<{ filePath?: string }>;
      void saveSqlFile(customEvent.detail?.filePath);
    };

    window.addEventListener('dbw:save-current-tab', handleSaveCurrentTab);
    window.addEventListener('dbw:save-as', handleSaveAs);

    return () => {
      window.removeEventListener('dbw:save-current-tab', handleSaveCurrentTab);
      window.removeEventListener('dbw:save-as', handleSaveAs);
    };
  }, [activeTabId, saveSqlFile, tabId]);

  useEffect(() => {
    const executeMenuEditCommand = (eventName: MenuEditEventName) => {
      if (activeTabId !== tabId) return;
      if (currentTab?.type !== 'query') return;

      const commandId = MENU_EDIT_EVENT_COMMANDS[eventName];
      editorRef.current?.focus();
      editorRef.current?.runCommand(commandId);
    };

    const listeners: Array<{ name: MenuEditEventName; handler: EventListener }> = (
      Object.keys(MENU_EDIT_EVENT_COMMANDS) as MenuEditEventName[]
    ).map((eventName) => {
      const handler: EventListener = () => executeMenuEditCommand(eventName);
      window.addEventListener(eventName, handler);
      return { name: eventName, handler };
    });

    return () => {
      listeners.forEach(({ name, handler }) => {
        window.removeEventListener(name, handler);
      });
    };
  }, [activeTabId, currentTab?.type, tabId]);

  useEffect(() => {
    if (!selectedConnection?.name || selectedDatabase) return;
    const persistedDb = getLastUsedDatabaseForConnection(selectedConnection.name);
    if (persistedDb) {
      setSelectedDatabase(persistedDb);
      setActiveDatabase(persistedDb);
    }
  }, [selectedConnection, selectedDatabase, getLastUsedDatabaseForConnection, setActiveDatabase]);

  // Listen for execute SQL keyboard shortcut
  useEffect(() => {
    const handleExecuteSql = () => {
      if (activeTabId !== tabId) return;
      void executeSql();
    };

    window.addEventListener('dbw:execute-sql', handleExecuteSql);
    return () => {
      window.removeEventListener('dbw:execute-sql', handleExecuteSql);
    };
  }, [activeTabId, executeSql, tabId]);

  // Listen for settings changes to update auto save behavior
  useEffect(() => {
    const handleSettingsChanged = () => {
      editorSettingsRef.current = getEditorSettings();
    };

    window.addEventListener('dbw:settings-changed', handleSettingsChanged as EventListener);
    return () => {
      window.removeEventListener('dbw:settings-changed', handleSettingsChanged as EventListener);
    };
  }, []);

  // Cleanup auto save timer on unmount
  useEffect(() => {
    return () => {
      autoSaveDebouncedRef.current?.cancel();
      sqlStoreSyncDebouncedRef.current?.cancel();
      flushPendingSqlToStoreRef.current();
    };
  }, []);

  return (
    <div className="flex h-full w-full min-h-0 flex-col overflow-hidden">
      {/* Toolbar */}
      <QueryToolbar
        availableConnections={connections.map((c) => c.profile)}
        selectedConnection={selectedConnection}
        selectedDatabase={selectedDatabase}
        isConnected={isConnected}
        isExecuting={isExecuting}
        autoCommit={autoCommit}
        statusMessage={statusMessage}
        connectionInfo={connectionInfo}
        onConnectionChange={(conn) => {
          const persistedDb = conn?.name ? getLastUsedDatabaseForConnection(conn.name) : undefined;
          setSelectedConnection(conn);
          setSelectedDatabase(persistedDb);
          setActiveConnection(conn?.name || null);
          setActiveDatabase(persistedDb || null);
          if (conn) {
            connect(conn, persistedDb);
          } else {
            disconnect();
          }
        }}
        onDatabaseChange={(db) => {
          setSelectedDatabase(db);
          setActiveDatabase(db || null);
          if (db && selectedConnection?.name) {
            setLastUsedDatabaseForConnection(selectedConnection.name, db);
          }
          if (db) {
            switchDatabase(db);
          }
        }}
        onExecute={executeSql}
        executeLabel={hasSelection ? t('queryToolbar.executeSelected') : t('queryToolbar.execute')}
        onSave={() => {
          void saveSqlFile();
        }}
        onExplain={explainSql}
        onFormat={formatSql}
        onClear={clearSql}
        onInsertSnippet={insertSnippet}
        onTransactionModeChange={handleTransactionModeChange}
        onCommit={commitTransaction}
        onRollback={rollbackTransaction}
      />

      {/* Content area with split pane */}
      <div className={`query-tab-content relative flex min-h-0 flex-1 flex-col overflow-hidden ${isResultPanelCollapsed ? 'result-collapsed' : ''}`} ref={contentRef}>
        {/* SQL Editor (top) */}
        <div
          className="query-editor-container flex min-h-[100px] flex-col flex-shrink-0 overflow-hidden"
          style={{
            flex: isResultPanelCollapsed ? 1 : `0 0 ${editorHeightPx ?? MIN_EDITOR_HEIGHT}px`,
            height: isResultPanelCollapsed ? '100%' : `${editorHeightPx ?? MIN_EDITOR_HEIGHT}px`,
          }}
        >
          <QueryEditor
            ref={editorRef}
            value={sqlContent}
            onChange={handleSqlContentChange}
            onExecute={executeSql}
            onSelectionChange={setHasSelection}
            completionContext={selectedConnection ? { profile: selectedConnection, database: selectedDatabase } : undefined}
          />
        </div>

        {/* Resizer with collapse button - only show when result panel is visible */}
        {!isResultPanelCollapsed && (
          <SplitPaneResizer
            isDragging={isResizing}
            onMouseDown={handleResizerMouseDown}
            onToggleCollapse={() => setIsResultPanelCollapsed(true)}
          />
        )}

        {/* Result Panel (bottom) */}
        {!isResultPanelCollapsed && (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <ResultPanel
              tabs={resultTabs}
              metaTabs={metaResultTabs}
              executionWallTimeSec={executionWallTimeSec ?? undefined}
              connectionProfile={selectedConnection}
              activeTabId={activeResultTabId}
              onTabChange={setActiveResultTabId}
              onTabClose={closeResultTab}
              onClearAll={clearResults}
              onRequestQueryPage={requestQueryPage}
            />
          </div>
        )}
        
        {/* Collapsed state - show expand button bar */}
        {isResultPanelCollapsed && (
          <div className={cn(
            'flex h-7 flex-shrink-0 items-center border-t px-3',
            theme === 'dark' ? 'border-[#3e3e42] bg-[#252a31]' : 'border-[#e1e5e9] bg-[#f5f6f7]',
          )}>
            <button 
              className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-[3px] border px-2 py-0.5 text-xs transition-all duration-150',
                theme === 'dark'
                  ? 'border-[#3e3e42] bg-[#252a31] text-[#abb3bf] hover:border-[#2d72d2] hover:bg-[#2d72d2] hover:text-white'
                  : 'border-[#e1e5e9] bg-[#f5f6f7] text-[#5f6b7c] hover:border-[#2d72d2] hover:bg-[#2d72d2] hover:text-white',
              )}
              onClick={() => setIsResultPanelCollapsed(false)}
              title={t('resultPanel.expand')}
            >
              <ChevronUpIcon size={12} />
              <span>{t('resultPanel.title')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
