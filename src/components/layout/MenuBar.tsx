import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Menu,
  MenuItem,
  Popover,
  Position,
  Divider,
} from '@blueprintjs/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { exit } from '@tauri-apps/plugin-process';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useTranslation } from 'react-i18next';
import { getMenuConfig } from './menuConfig';
import type { MenuItem as MenuItemType } from './menuConfig';
import { useAppStore, useConnectionStore, useTabStore } from '../../stores';
import { cn } from '@/lib/cn';
import { useTraceTarget, requireOpenConnection, requireOpenedDatabase, resolveQueryTrace, showToolbarRequirementNotice } from '@/hooks';
import type { ConnectionProfile } from '../../types';
import { useMenuDialogs } from './useMenuDialogs';
import { useMenuFavorites, normalizeConnectionProfile } from './useMenuFavorites';
import { MenuDialogs } from './MenuDialogs';

export const MenuBar: React.FC = () => {
  const { t } = useTranslation();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const {
    theme,
    setStatusMessage,
    toggleTheme,
    toggleSidebar,
    toggleStatusBar,
    statusBarVisible,
    updateAvailable,
    updateDismissed
  } = useAppStore();
  const {
    addTab,
    closeAllTabs,
    activeTabId,
    getActiveTab
  } = useTabStore();
  const {
    connections,
    addConnection,
    updateConnection,
  } = useConnectionStore();
  // 痕迹递推 + 兜底：与工具栏一致，递推连接/数据库后必须校验连接与数据库均处于打开状态
  const trace = useTraceTarget();
  const dialogs = useMenuDialogs();
  const favorites = useMenuFavorites({ askForConfirm: dialogs.askForConfirm });
  const {
    setIsFavoritesDialogOpen,
    setIsAddFavoriteDialogOpen,
    setIsAboutDialogOpen,
    setIsShortcutsDialogOpen,
    setIsConnectionDialogOpen,
    setIsOptionsDialogOpen,
    setIsPropertiesDialogOpen,
    setIsBackupDialogOpen,
    setIsRestoreDialogOpen,
    setIsExportConnectionsDialogOpen,
    askForConfirm,
    invalidateRuntimeCache,
  } = dialogs;

  // 获取菜单配置
  const menuConfig = getMenuConfig(t);

  useEffect(() => {
    const onOpenBackup = () => {
      // 与工具栏备份按钮一致的递推兜底：连接必须打开、数据库必须打开
      if (!requireOpenConnection(trace, t('database.backup'))) return;
      if (!requireOpenedDatabase(trace, t('database.backup'))) return;
      setIsBackupDialogOpen(true);
    };

    const onOpenRestore = () => {
      // 还原仅依赖连接（不需要数据库字段）
      if (!requireOpenConnection(trace, t('database.restore'))) return;
      setIsRestoreDialogOpen(true);
    };

    window.addEventListener('dbw:open-backup-dialog', onOpenBackup as EventListener);
    window.addEventListener('dbw:open-restore-dialog', onOpenRestore as EventListener);

    const onOpenFavorites = () => {
      setIsFavoritesDialogOpen(true);
      setActiveMenu(null);
    };

    const onOpenOptions = () => {
      setIsOptionsDialogOpen(true);
      setActiveMenu(null);
    };

    const onOpenProperties = () => {
      setIsPropertiesDialogOpen(true);
      setActiveMenu(null);
    };

    window.addEventListener('dbw:open-favorites-dialog', onOpenFavorites as EventListener);
    window.addEventListener('dbw:open-options-dialog', onOpenOptions as EventListener);
    window.addEventListener('dbw:open-properties-dialog', onOpenProperties as EventListener);

    return () => {
      window.removeEventListener('dbw:open-backup-dialog', onOpenBackup as EventListener);
      window.removeEventListener('dbw:open-restore-dialog', onOpenRestore as EventListener);
      window.removeEventListener('dbw:open-favorites-dialog', onOpenFavorites as EventListener);
      window.removeEventListener('dbw:open-options-dialog', onOpenOptions as EventListener);
      window.removeEventListener('dbw:open-properties-dialog', onOpenProperties as EventListener);
    };
  }, [trace, t]);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      const clickedInsidePopover =
        !!target.closest('.menubar-popover') ||
        !!target.closest('.bp5-popover') ||
        !!target.closest('.bp6-popover') ||
        !!target.closest('.bp5-menu') ||
        !!target.closest('.bp6-menu');
      if (clickedInsidePopover) {
        return;
      }

      if (menuBarRef.current && !menuBarRef.current.contains(target)) {
        setActiveMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuClick = (label: string) => {
    setActiveMenu(activeMenu === label ? null : label);
  };

  // 文件菜单操作
  const handleNewConnection = useCallback(() => {
    setIsConnectionDialogOpen(true);
    setActiveMenu(null);
  }, []);

  const handleNewQuery = useCallback(() => {
    // 查询不要求连接和数据库（原有允许，不阻断）：统一走痕迹预填（仅预填打开状态）
    const resolved = resolveQueryTrace(trace);
    addTab({
      type: 'query',
      title: t('query.new'),
      connectionId: resolved.connection?.name,
      connectionProfile: resolved.connection,
      database: resolved.database,
    });
    setStatusMessage(t('status.ready'));
    setActiveMenu(null);
  }, [trace, addTab, setStatusMessage, t]);

  const handleOpenSqlFile = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'SQL', extensions: ['sql'] }]
      });
      if (selected && typeof selected === 'string') {
        const content = await readTextFile(selected);
        const fileName = selected.split(/[/\\]/).pop() || 'query.sql';
        // 打开 SQL 文件同查询：不阻断，统一走痕迹预填（仅预填打开状态的连接/数据库）
        const resolved = resolveQueryTrace(trace);
        addTab({
          type: 'query',
          title: fileName,
          connectionId: resolved.connection?.name,
          connectionProfile: resolved.connection,
          database: resolved.database,
          sqlContent: content,
          sqlFilePath: selected,
          isModified: false,
        });
        // 添加到最近文件
        const newFile = {
          path: selected,
          name: fileName,
          lastOpened: Date.now(),
        };
        const saved = localStorage.getItem('dbw-recent-files');
        const prevFiles = saved ? JSON.parse(saved) : [];
        const filtered = prevFiles.filter((f: { path: string }) => f.path !== selected);
        const updated = [newFile, ...filtered].slice(0, 8);
        localStorage.setItem('dbw-recent-files', JSON.stringify(updated));
        // 通知 WelcomeTab 更新最近文件列表
        window.dispatchEvent(new CustomEvent('dbw:recent-files-updated'));
        setStatusMessage(`${t('common.open')}: ${selected}`);
      }
    } catch (error) {
      setStatusMessage(`${t('error.loadFailed')}: ${error}`);
    }
    setActiveMenu(null);
  }, [trace, addTab, setStatusMessage, t]);

  const handleSave = useCallback(() => {
    const activeTab = getActiveTab();
    if (!activeTab) {
      void showToolbarRequirementNotice(t('common.save'), 'query');
      setActiveMenu(null);
      return;
    }
    if (activeTab.type !== 'query') {
      void showToolbarRequirementNotice(t('common.save'), 'query');
      setActiveMenu(null);
      return;
    }
    window.dispatchEvent(new CustomEvent('dbw:save-current-tab'));
    setStatusMessage(t('status.saving'));
    setActiveMenu(null);
  }, [setStatusMessage, getActiveTab, t]);

  const handleSaveAs = useCallback(async () => {
    const activeTab = getActiveTab();
    if (!activeTab) {
      void showToolbarRequirementNotice(t('common.saveAs'), 'query');
      setActiveMenu(null);
      return;
    }
    if (activeTab.type !== 'query') {
      void showToolbarRequirementNotice(t('common.saveAs'), 'query');
      setActiveMenu(null);
      return;
    }
    try {
      const filePath = await save({
        filters: [{ name: 'SQL', extensions: ['sql'] }]
      });
      if (filePath) {
        window.dispatchEvent(new CustomEvent('dbw:save-as', { detail: { filePath } }));
        setStatusMessage(`${t('common.save')}: ${filePath}`);
      }
    } catch (error) {
      setStatusMessage(`${t('error.saveFailed')}: ${error}`);
    }
    setActiveMenu(null);
  }, [setStatusMessage, getActiveTab, t]);

  const handleExit = useCallback(async () => {
    await exit(0);
  }, []);

  const handleInvalidateCache = useCallback(async () => {
    await invalidateRuntimeCache();
    setActiveMenu(null);
  }, [invalidateRuntimeCache]);

  // 编辑菜单操作
  const handleUndo = useCallback(() => {
    window.dispatchEvent(new CustomEvent('dbw:undo'));
    setActiveMenu(null);
  }, []);

  const handleRedo = useCallback(() => {
    window.dispatchEvent(new CustomEvent('dbw:redo'));
    setActiveMenu(null);
  }, []);

  const handleCut = useCallback(() => {
    window.dispatchEvent(new CustomEvent('dbw:cut'));
    setActiveMenu(null);
  }, []);

  const handleCopy = useCallback(() => {
    window.dispatchEvent(new CustomEvent('dbw:copy'));
    setActiveMenu(null);
  }, []);

  const handlePaste = useCallback(() => {
    window.dispatchEvent(new CustomEvent('dbw:paste'));
    setActiveMenu(null);
  }, []);

  const handleSelectAll = useCallback(() => {
    window.dispatchEvent(new CustomEvent('dbw:select-all'));
    setActiveMenu(null);
  }, []);

  // 查看菜单操作
  const handleRefresh = useCallback(() => {
    window.dispatchEvent(new CustomEvent('dbw:global-refresh', { detail: { source: 'menu' } }));
    setStatusMessage(t('status.loading'));
    setActiveMenu(null);
  }, [setStatusMessage, t]);

  const handleProperties = useCallback(() => {
    setIsPropertiesDialogOpen(true);
    setStatusMessage(t('dialog.properties.title'));
    setActiveMenu(null);
  }, [setStatusMessage, t]);

  const handleToggleSidebarMenu = useCallback(() => {
    toggleSidebar();
    setStatusMessage(t('menu.view.toggleSidebar'));
    setActiveMenu(null);
  }, [toggleSidebar, setStatusMessage, t]);

  const handleToggleStatusBarMenu = useCallback(() => {
    toggleStatusBar();
    setStatusMessage(statusBarVisible ? t('menu.view.hideStatusbar') : t('menu.view.showStatusbar'));
    setActiveMenu(null);
  }, [toggleStatusBar, statusBarVisible, setStatusMessage, t]);

  // 收藏夹菜单操作
  const handleAddToFavorites = useCallback(() => {
    setIsAddFavoriteDialogOpen(true);
    setActiveMenu(null);
  }, []);

  const handleManageFavorites = useCallback(() => {
    setIsFavoritesDialogOpen(true);
    setActiveMenu(null);
  }, []);

  // 工具菜单操作
  const handleBackupDatabase = useCallback(() => {
    // 与工具栏备份按钮一致的递推兜底：连接必须打开、数据库必须打开
    if (!requireOpenConnection(trace, t('database.backup'))) {
      setActiveMenu(null);
      return;
    }
    if (!requireOpenedDatabase(trace, t('database.backup'))) {
      setActiveMenu(null);
      return;
    }
    setIsBackupDialogOpen(true);
    setActiveMenu(null);
  }, [trace, t]);

  const handleRestoreDatabase = useCallback(() => {
    // 还原仅依赖连接（不需要数据库字段）
    if (!requireOpenConnection(trace, t('database.restore'))) {
      setActiveMenu(null);
      return;
    }
    setIsRestoreDialogOpen(true);
    setActiveMenu(null);
  }, [trace, t]);

  const handleImportConnections = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      if (selected && typeof selected === 'string') {
        const content = await readTextFile(selected);
        const importedConnections = JSON.parse(content) as Array<{ profile?: ConnectionProfile }>;
        if (Array.isArray(importedConnections)) {
          let created = 0;
          let updated = 0;
          let skipped = 0;
          const existingByName = new Map(
            useConnectionStore
              .getState()
              .connections
              .map((conn) => [(conn.profile.name || '').trim(), conn.profile]),
          );

          for (const item of importedConnections) {
            if (!item?.profile) {
              skipped += 1;
              continue;
            }

            const importedProfile = item.profile;
            const profileName = (importedProfile.name || '').trim();
            if (!profileName) {
              skipped += 1;
              continue;
            }

            const existing = existingByName.get(profileName);
            if (!existing) {
              addConnection({ ...importedProfile, name: profileName });
              existingByName.set(profileName, importedProfile);
              created += 1;
              continue;
            }

            const sameConfig =
              JSON.stringify(normalizeConnectionProfile(existing))
              === JSON.stringify(normalizeConnectionProfile({ ...importedProfile, name: profileName }));
            if (sameConfig) {
              skipped += 1;
              continue;
            }

            const shouldOverwrite = await askForConfirm({
              title: t('common.confirm'),
              message: t('menu.tools.importConnectionsOverwritePrompt', { name: profileName }),
              intent: 'warning',
            });
            if (shouldOverwrite) {
              updateConnection(profileName, { ...importedProfile, name: profileName });
              existingByName.set(profileName, importedProfile);
              updated += 1;
            } else {
              skipped += 1;
            }
          }

          setStatusMessage(t('menu.tools.importConnectionsSummary', { created, updated, skipped }));
        }
      }
    } catch (error) {
      setStatusMessage(`${t('error.loadFailed')}: ${error}`);
    }
    setActiveMenu(null);
  }, [addConnection, dialogs.askForConfirm, setStatusMessage, t, updateConnection]);

  const handleExportConnections = useCallback(() => {
    const selectable = connections
      .map((conn) => conn.profile.name || '')
      .filter((name): name is string => Boolean(name));

    if (selectable.length === 0) {
      setStatusMessage(t('menu.tools.noConnectionsToExport'));
      setActiveMenu(null);
      return;
    }

    const nextSelection: Record<string, boolean> = {};
    selectable.forEach((name) => {
      nextSelection[name] = true;
    });
    dialogs.setExportSelection(nextSelection);
    setIsExportConnectionsDialogOpen(true);
    setActiveMenu(null);
  }, [connections, setStatusMessage, t]);

  // 窗口菜单操作
  const handleMaximize = useCallback(async () => {
    try {
      const appWindow = getCurrentWindow();
      const maximized = await appWindow.isMaximized();
      if (maximized) {
        await appWindow.unmaximize();
      } else {
        await appWindow.maximize();
      }
    } catch (error) {
      setStatusMessage(`${t('error.error')}: ${error}`);
    }
    setActiveMenu(null);
  }, [setStatusMessage, t]);

  const handleMinimize = useCallback(async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.minimize();
    } catch (error) {
      setStatusMessage(`${t('error.error')}: ${error}`);
    }
    setActiveMenu(null);
  }, [setStatusMessage, t]);

  const handleOptions = useCallback(() => {
    setIsOptionsDialogOpen(true);
    setStatusMessage(t('dialog.options.title'));
    setActiveMenu(null);
  }, [setStatusMessage, t]);

  const handleCloseCurrentTab = useCallback(() => {
    if (activeTabId) {
      window.dispatchEvent(new CustomEvent('dbw:request-close-tab', { detail: { tabId: activeTabId } }));
      setStatusMessage(t('menu.window.closeCurrentTab'));
    }
    setActiveMenu(null);
  }, [activeTabId, setStatusMessage, t]);

  const handleCloseAllTabs = useCallback(() => {
    closeAllTabs();
    setStatusMessage(t('menu.window.closeAllTabs'));
    setActiveMenu(null);
  }, [closeAllTabs, setStatusMessage, t]);

  const handleToggleThemeMenu = useCallback(() => {
    toggleTheme();
    setStatusMessage(t('menu.window.toggleTheme'));
    setActiveMenu(null);
  }, [toggleTheme, setStatusMessage, t]);

  // 监听键盘快捷键事件
  useEffect(() => {
    const handleNewConnectionEvent = () => {
      setIsConnectionDialogOpen(true);
    };

    const handleNewQueryEvent = () => {
      handleNewQuery();
    };

    const handleOpenSqlFileEvent = () => {
      handleOpenSqlFile();
    };

    const handleToggleThemeEvent = () => {
      handleToggleThemeMenu();
    };

    window.addEventListener('dbw:new-connection', handleNewConnectionEvent);
    window.addEventListener('dbw:new-query', handleNewQueryEvent);
    window.addEventListener('dbw:open-sql-file', handleOpenSqlFileEvent);
    window.addEventListener('dbw:toggle-theme', handleToggleThemeEvent);

    return () => {
      window.removeEventListener('dbw:new-connection', handleNewConnectionEvent);
      window.removeEventListener('dbw:new-query', handleNewQueryEvent);
      window.removeEventListener('dbw:open-sql-file', handleOpenSqlFileEvent);
      window.removeEventListener('dbw:toggle-theme', handleToggleThemeEvent);
    };
  }, [handleNewQuery, handleOpenSqlFile, handleToggleThemeMenu]);

  // 帮助菜单操作
  const handleMySQLDocs = useCallback(async () => {
    try {
      await openUrl('https://dev.mysql.com/doc/');
      setStatusMessage(t('menu.help.mysqlDocs'));
    } catch (error) {
      setStatusMessage(`${t('error.error')}: ${error}`);
    }
    setActiveMenu(null);
  }, [setStatusMessage, t]);

  const handleShortcuts = useCallback(() => {
    setIsShortcutsDialogOpen(true);
    setActiveMenu(null);
  }, []);

  const handleAbout = useCallback(() => {
    setIsAboutDialogOpen(true);
    setActiveMenu(null);
  }, []);

  const handleCheckUpdate = useCallback(() => {
    window.dispatchEvent(new CustomEvent('dbw:check-update'));
    setActiveMenu(null);
  }, []);

  const handleMenuItemClick = (item: MenuItemType) => {
    // 使用翻译后的标签进行匹配
    const label = item.label;
    
    // 文件菜单
    if (label === t('menu.file.newConnection')) {
      handleNewConnection();
      return;
    }
    if (label === t('menu.file.newQuery')) {
      handleNewQuery();
      return;
    }
    if (label === t('menu.file.open')) {
      handleOpenSqlFile();
      return;
    }
    if (label === t('menu.file.save')) {
      handleSave();
      return;
    }
    if (label === t('menu.file.saveAs')) {
      handleSaveAs();
      return;
    }
    if (label === t('menu.file.invalidateCache')) {
      handleInvalidateCache();
      return;
    }
    if (label === t('menu.file.exit')) {
      handleExit();
      return;
    }

    // 编辑菜单
    if (label === t('menu.edit.undo')) {
      handleUndo();
      return;
    }
    if (label === t('menu.edit.redo')) {
      handleRedo();
      return;
    }
    if (label === t('menu.edit.cut')) {
      handleCut();
      return;
    }
    if (label === t('menu.edit.copy')) {
      handleCopy();
      return;
    }
    if (label === t('menu.edit.paste')) {
      handlePaste();
      return;
    }
    if (label === t('menu.edit.selectAll')) {
      handleSelectAll();
      return;
    }

    // 查看菜单
    if (label === t('menu.view.refresh')) {
      handleRefresh();
      return;
    }
    if (label === t('menu.view.properties')) {
      handleProperties();
      return;
    }
    if (label === t('menu.view.toggleSidebar')) {
      handleToggleSidebarMenu();
      return;
    }
    if (label === t('menu.view.toggleStatusbar')) {
      handleToggleStatusBarMenu();
      return;
    }

    // 收藏夹菜单
    if (label === t('menu.favorites.add')) {
      handleAddToFavorites();
      return;
    }
    if (label === t('menu.favorites.manage')) {
      handleManageFavorites();
      return;
    }

    // 工具菜单
    if (label === t('menu.tools.backup')) {
      handleBackupDatabase();
      return;
    }
    if (label === t('menu.tools.restore')) {
      handleRestoreDatabase();
      return;
    }
    if (label === t('menu.tools.importConnections')) {
      handleImportConnections();
      return;
    }
    if (label === t('menu.tools.exportConnections')) {
      handleExportConnections();
      return;
    }
    if (label === t('menu.tools.options')) {
      handleOptions();
      return;
    }

    // 窗口菜单
    if (label === t('menu.window.maximize')) {
      handleMaximize();
      return;
    }
    if (label === t('menu.window.minimize')) {
      handleMinimize();
      return;
    }
    if (label === t('menu.window.closeCurrentTab')) {
      handleCloseCurrentTab();
      return;
    }
    if (label === t('menu.window.closeAllTabs')) {
      handleCloseAllTabs();
      return;
    }
    if (label === t('menu.window.toggleTheme')) {
      handleToggleThemeMenu();
      return;
    }

    // 帮助菜单
    if (label === t('menu.help.mysqlDocs')) {
      handleMySQLDocs();
      return;
    }
    if (label === t('menu.help.shortcuts')) {
      handleShortcuts();
      return;
    }
    if (label === t('menu.help.checkUpdate')) {
      handleCheckUpdate();
      return;
    }
    if (label === t('menu.help.about')) {
      handleAbout();
      return;
    }

    if (item.onClick) {
      item.onClick();
    }
    setActiveMenu(null);
  };

  const renderMenuItems = (items: MenuItemType[], menuLabel: string) => {
    if (menuLabel === t('menu.favorites.title')) {
      const staticItems = items.filter(item => item.label === t('menu.favorites.add') || item.label === t('menu.favorites.manage') || item.divider);

      const sqlFavorites = favorites.recentFavorites.filter(f => f.type === 'SQL_QUERY');
      const connectionFavorites = favorites.recentFavorites.filter(f => f.type === 'CONNECTION_PROFILE');
      const objectFavorites = favorites.recentFavorites.filter(f => f.type === 'DATABASE_OBJECT');

      return (
        <>
          {staticItems.map((item, index) => {
            if (item.divider) {
              return <Divider key={`divider-${index}`} />;
            }
            return (
              <MenuItem
                key={`${item.label}-${index}`}
                text={item.label}
                label={item.shortcut}
                disabled={item.disabled}
                onClick={() => handleMenuItemClick(item)}
              />
            );
          })}

          <Divider />

          {sqlFavorites.length > 0 && (
            <>
              <MenuItem text={t('menu.favorites.sqlQueries')} disabled>
                {sqlFavorites.map(fav => (
                  <MenuItem
                    key={fav.id}
                    text={fav.name}
                    onClick={() => favorites.handleUseFavorite(fav)}
                  />
                ))}
              </MenuItem>
              <Divider />
            </>
          )}

          {connectionFavorites.length > 0 && (
            <>
              <MenuItem text={t('menu.favorites.connections')} disabled>
                {connectionFavorites.map(fav => (
                  <MenuItem
                    key={fav.id}
                    text={fav.name}
                    onClick={() => favorites.handleUseFavorite(fav)}
                  />
                ))}
              </MenuItem>
              <Divider />
            </>
          )}

          {objectFavorites.length > 0 && (
            <>
              <MenuItem text={t('menu.favorites.object')} disabled>
                {objectFavorites.map(fav => (
                  <MenuItem
                    key={fav.id}
                    text={fav.name}
                    onClick={() => favorites.handleUseFavorite(fav)}
                  />
                ))}
              </MenuItem>
              <Divider />
            </>
          )}

          {favorites.recentFavorites.length === 0 && (
            <MenuItem text={t('menu.favorites.empty')} disabled />
          )}
        </>
      );
    }

    const showUpdateIndicator = updateAvailable && !updateDismissed;

    return items.map((item, index) => {
      if (item.divider) {
        return <Divider key={`divider-${index}`} />;
      }

      const isCheckUpdateItem = item.label === t('menu.help.checkUpdate');
      const shouldShowDot = showUpdateIndicator && isCheckUpdateItem;

      return (
        <MenuItem
          key={`${item.label}-${index}`}
          text={
            shouldShowDot ? (
              <span className="menu-item-with-dot">
                {item.label}
                <span className="update-dot" />
              </span>
            ) : (
              item.label
            )
          }
          label={item.shortcut}
          disabled={item.disabled}
          onClick={() => handleMenuItemClick(item)}
        />
      );
    });
  };

  return (
    <>
      <div ref={menuBarRef} className="flex h-full items-center px-1">
        {menuConfig.map((menu) => {
          const isHelpMenu = menu.label === t('menu.help.title');
          const showHelpDot = isHelpMenu && updateAvailable && !updateDismissed;
          
          return (
            <Popover
              key={menu.label}
              isOpen={activeMenu === menu.label}
              onClose={() => setActiveMenu(null)}
              position={Position.BOTTOM_LEFT}
              minimal
              content={
                <Menu className="min-w-[200px]">
                  {renderMenuItems(menu.items, menu.label)}
                </Menu>
              }
            >
              <button
                className={cn(
                  'relative cursor-pointer rounded-[3px] border-none bg-none px-3 py-1 text-[13px] transition-colors duration-150',
                  theme === 'dark' ? 'text-[#cccccc]' : 'text-[#333333]',
                  activeMenu === menu.label
                    ? theme === 'dark' ? 'bg-[#094771]' : 'bg-[#007acc]'
                    : theme === 'dark' ? 'hover:bg-[#3e3e42]' : 'hover:bg-[#e8e8e8]',
                )}
                onClick={() => handleMenuClick(menu.label)}
              >
                {menu.label}
                {showHelpDot && <span className="menu-dot-indicator" />}
              </button>
            </Popover>
          );
        })}
      </div>

      <MenuDialogs
        state={dialogs}
        connections={connections}
        // 对话框预填同样统一走痕迹递推（连接/数据库仅传打开状态，与按钮检查一致）
        connectionProfile={trace.connection}
        database={trace.databaseOpened ? trace.database : undefined}
        onUseFavorite={favorites.handleUseFavorite}
        onAddFavorite={favorites.handleAddFavorite}
      />
    </>
  );
};
