// 菜单栏对话框编排 Hook：11 个对话框的开闭状态、确认对话框 resolver、
// 连接导出选择与导出执行。与菜单栏渲染/动作解耦。

import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { relaunch } from '@tauri-apps/plugin-process';
import { useAppStore, useConnectionStore } from '@/stores';
import { appApi } from '@/api/app';

export interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  intent?: 'primary' | 'success' | 'warning' | 'danger';
}

export interface MenuDialogsState {
  isFavoritesDialogOpen: boolean;
  setIsFavoritesDialogOpen: (value: boolean) => void;
  isAddFavoriteDialogOpen: boolean;
  setIsAddFavoriteDialogOpen: (value: boolean) => void;
  isAboutDialogOpen: boolean;
  setIsAboutDialogOpen: (value: boolean) => void;
  isShortcutsDialogOpen: boolean;
  setIsShortcutsDialogOpen: (value: boolean) => void;
  isConnectionDialogOpen: boolean;
  setIsConnectionDialogOpen: (value: boolean) => void;
  isOptionsDialogOpen: boolean;
  setIsOptionsDialogOpen: (value: boolean) => void;
  isPropertiesDialogOpen: boolean;
  setIsPropertiesDialogOpen: (value: boolean) => void;
  isBackupDialogOpen: boolean;
  setIsBackupDialogOpen: (value: boolean) => void;
  isRestoreDialogOpen: boolean;
  setIsRestoreDialogOpen: (value: boolean) => void;
  isExportConnectionsDialogOpen: boolean;
  setIsExportConnectionsDialogOpen: (value: boolean) => void;
  exportSelection: Record<string, boolean>;
  setExportSelection: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  confirmDialogState: ConfirmDialogState;
  askForConfirm: (opts: { title: string; message: string; intent?: 'primary' | 'success' | 'warning' | 'danger' }) => Promise<boolean>;
  closeConfirmDialog: () => void;
  handleConfirmDialogConfirm: () => void;
  handleConfirmDialogCancel: () => void;
  handleConfirmExportConnections: () => Promise<void>;
  /** 失效运行时缓存并重启（确认 → 执行 → 状态提示） */
  invalidateRuntimeCache: () => Promise<void>;
}

export const useMenuDialogs = (): MenuDialogsState => {
  const { t } = useTranslation();
  const { setStatusMessage } = useAppStore();
  const { connections } = useConnectionStore();

  const [isFavoritesDialogOpen, setIsFavoritesDialogOpen] = useState(false);
  const [isAddFavoriteDialogOpen, setIsAddFavoriteDialogOpen] = useState(false);
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);
  const [isShortcutsDialogOpen, setIsShortcutsDialogOpen] = useState(false);
  const [isConnectionDialogOpen, setIsConnectionDialogOpen] = useState(false);
  const [isOptionsDialogOpen, setIsOptionsDialogOpen] = useState(false);
  const [isPropertiesDialogOpen, setIsPropertiesDialogOpen] = useState(false);
  const [isBackupDialogOpen, setIsBackupDialogOpen] = useState(false);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [isExportConnectionsDialogOpen, setIsExportConnectionsDialogOpen] = useState(false);
  const [exportSelection, setExportSelection] = useState<Record<string, boolean>>({});
  const [confirmDialogState, setConfirmDialogState] = useState<ConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    intent: 'primary',
  });
  const confirmResolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const askForConfirm = useCallback(
    ({ title, message, intent }: { title: string; message: string; intent?: 'primary' | 'success' | 'warning' | 'danger' }) => {
      return new Promise<boolean>((resolve) => {
        confirmResolverRef.current = resolve;
        setConfirmDialogState({
          isOpen: true,
          title,
          message,
          intent: intent || 'primary',
        });
      });
    },
    [],
  );

  const closeConfirmDialog = useCallback(() => {
    setConfirmDialogState((prev) => ({ ...prev, isOpen: false }));
    if (confirmResolverRef.current) {
      confirmResolverRef.current(false);
      confirmResolverRef.current = null;
    }
  }, []);

  const handleConfirmDialogConfirm = useCallback(() => {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(true);
      confirmResolverRef.current = null;
    }
    setConfirmDialogState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleConfirmDialogCancel = useCallback(() => {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(false);
      confirmResolverRef.current = null;
    }
    setConfirmDialogState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleConfirmExportConnections = useCallback(async () => {
    const selectedNames = Object.entries(exportSelection)
      .filter(([, checked]) => checked)
      .map(([name]) => name);

    if (selectedNames.length === 0) {
      setStatusMessage(t('menu.tools.selectAtLeastOneConnection'));
      return;
    }

    try {
      const filePath = await save({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        defaultPath: 'connections.json',
      });
      if (!filePath) {
        return;
      }

      const selectedSet = new Set(selectedNames.map((name) => name.trim()));
      const exportData = connections
        .filter((conn) => selectedSet.has((conn.profile.name || '').trim()))
        .map((conn) => ({ profile: conn.profile }));

      await writeTextFile(filePath, JSON.stringify(exportData, null, 2));
      setStatusMessage(t('menu.tools.exportConnectionsSaved', { count: exportData.length, filePath }));
      setIsExportConnectionsDialogOpen(false);
    } catch (error) {
      setStatusMessage(`${t('error.saveFailed')}: ${error}`);
    }
  }, [connections, exportSelection, setStatusMessage, t]);

  const invalidateRuntimeCache = useCallback(async () => {
    const confirmed = await askForConfirm({
      title: t('menu.file.invalidateCacheConfirmTitle'),
      message: t('menu.file.invalidateCacheConfirmMessage'),
      intent: 'warning',
    });

    if (!confirmed) {
      return;
    }

    try {
      await appApi.invalidateRuntimeCache();
      setStatusMessage(t('menu.file.invalidateCacheDone'));
      await relaunch();
    } catch (error) {
      setStatusMessage(`${t('menu.file.invalidateCacheFailed')}: ${error}`);
    }
  }, [askForConfirm, setStatusMessage, t]);

  return {
    isFavoritesDialogOpen,
    setIsFavoritesDialogOpen,
    isAddFavoriteDialogOpen,
    setIsAddFavoriteDialogOpen,
    isAboutDialogOpen,
    setIsAboutDialogOpen,
    isShortcutsDialogOpen,
    setIsShortcutsDialogOpen,
    isConnectionDialogOpen,
    setIsConnectionDialogOpen,
    isOptionsDialogOpen,
    setIsOptionsDialogOpen,
    isPropertiesDialogOpen,
    setIsPropertiesDialogOpen,
    isBackupDialogOpen,
    setIsBackupDialogOpen,
    isRestoreDialogOpen,
    setIsRestoreDialogOpen,
    isExportConnectionsDialogOpen,
    setIsExportConnectionsDialogOpen,
    exportSelection,
    setExportSelection,
    confirmDialogState,
    askForConfirm,
    closeConfirmDialog,
    handleConfirmDialogConfirm,
    handleConfirmDialogCancel,
    handleConfirmExportConnections,
    invalidateRuntimeCache,
  };
};
