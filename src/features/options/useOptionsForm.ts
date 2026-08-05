import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores';

export type TabId = 'general' | 'editor' | 'interface' | 'connection';
export type TabCloseButtonType = 'hover' | 'always';

export interface Settings {
  showWelcomePage: boolean;
  autoCheckUpdate: boolean;
  language: string;
  editorFontSize: number;
  editorAutoSave: boolean;
  editorAutoComplete: boolean;
  editorTabSize: number;
  editorMinimap: boolean;
  sidebarDefaultCollapsed: boolean;
  statusBarVisible: boolean;
  tabCloseButton: TabCloseButtonType;
  connectionTimeout: number;
  maxConnections: number;
}

const defaultSettings: Settings = {
  showWelcomePage: true,
  autoCheckUpdate: true,
  language: 'zh-CN',
  editorFontSize: 14,
  editorAutoSave: false,
  editorAutoComplete: true,
  editorTabSize: 2,
  editorMinimap: true,
  sidebarDefaultCollapsed: false,
  statusBarVisible: true,
  tabCloseButton: 'hover',
  connectionTimeout: 30,
  maxConnections: 10,
};

const STORAGE_KEY = 'dbw-settings';

export const useOptionsForm = () => {
  const {
    sidebarCollapsed,
    statusBarVisible,
    toggleSidebar,
    toggleStatusBar,
  } = useAppStore();

  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [hasChanges, setHasChangesState] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<Settings>;
        setSettings((prev) => ({ ...prev, ...parsed }));
      } catch {
        // ignore parse error
      }
    }
  }, []);

  const updateSetting = useCallback(<K extends keyof Settings>(
    key: K,
    value: Settings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setHasChangesState(true);
  }, []);

  const save = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

    if (settings.sidebarDefaultCollapsed !== sidebarCollapsed) {
      toggleSidebar();
    }
    if (settings.statusBarVisible !== statusBarVisible) {
      toggleStatusBar();
    }

    window.dispatchEvent(new CustomEvent('dbw:settings-changed', {
      detail: settings,
    }));

    window.dispatchEvent(new CustomEvent('dbw:interface-settings-changed', {
      detail: {
        statusBarVisible: settings.statusBarVisible,
        tabCloseButton: settings.tabCloseButton,
      },
    }));

    setHasChangesState(false);
  }, [settings, sidebarCollapsed, statusBarVisible, toggleSidebar, toggleStatusBar]);

  const reset = useCallback(() => {
    setSettings(defaultSettings);
    setHasChangesState(true);
  }, []);

  const cancel = useCallback(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<Settings>;
        setSettings((prev) => ({ ...prev, ...parsed }));
      } catch {
        setSettings(defaultSettings);
      }
    } else {
      setSettings(defaultSettings);
    }
    setHasChangesState(false);
  }, []);

  const setHasChanges = useCallback((has: boolean) => {
    setHasChangesState(has);
  }, []);

  return {
    settings,
    hasChanges,
    updateSetting,
    save,
    reset,
    cancel,
    setHasChanges,
  };
};
