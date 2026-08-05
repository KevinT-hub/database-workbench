import React from 'react';
import { Callout } from '@blueprintjs/core';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import type { Settings, TabCloseButtonType } from '../useOptionsForm';
import { SettingItemSwitch, SettingItemNumber, SettingItemSelect, SettingGroup } from './SettingItems';

/* ---------- GeneralPanel ---------- */
interface GeneralPanelProps {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  languageOptions: { value: string; label: string }[];
}

export const GeneralPanel: React.FC<GeneralPanelProps> = ({
  settings,
  updateSetting,
  languageOptions,
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6 max-w-[600px]">
      <SettingGroup title={t('dialog.options.general.startupOptions')}>
        <SettingItemSwitch
          label={t('dialog.options.general.showWelcome')}
          description={t('dialog.options.general.showWelcomeDesc')}
          checked={settings.showWelcomePage}
          onChange={(v) => updateSetting('showWelcomePage', v)}
        />
        <SettingItemSwitch
          label={t('dialog.options.general.autoCheckUpdate')}
          description={t('dialog.options.general.autoCheckUpdateDesc')}
          checked={settings.autoCheckUpdate}
          onChange={(v) => updateSetting('autoCheckUpdate', v)}
        />
      </SettingGroup>

      <SettingGroup title={t('dialog.options.general.language')}>
        <SettingItemSelect
          label={t('dialog.options.general.language')}
          value={settings.language}
          options={languageOptions}
          onChange={(v) => updateSetting('language', v)}
        />
      </SettingGroup>

      <Callout intent="primary" icon="info-sign" className="options-callout mt-2 rounded-lg px-4 py-3 text-[13px] leading-relaxed">
        {t('dialog.options.general.languageTooltip')}
      </Callout>
    </div>
  );
};

/* ---------- EditorPanel ---------- */
interface EditorPanelProps {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({ settings, updateSetting }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6 max-w-[600px]">
      <SettingGroup title={t('dialog.options.editor.fontAndLayout')}>
        <SettingItemNumber
          label={t('dialog.options.editor.fontSize')}
          description={t('dialog.options.editor.fontSizeDesc')}
          value={settings.editorFontSize}
          min={12}
          max={20}
          suffix="px"
          onChange={(v) => updateSetting('editorFontSize', v)}
        />
        <SettingItemNumber
          label={t('dialog.options.editor.tabSize')}
          description={t('dialog.options.editor.tabSizeDesc')}
          value={settings.editorTabSize}
          min={2}
          max={8}
          stepSize={2}
          suffix={t('dialog.options.editor.spaces')}
          onChange={(v) => updateSetting('editorTabSize', v)}
        />
      </SettingGroup>

      <SettingGroup title={t('dialog.options.editor.behavior')}>
        <SettingItemSwitch
          label={t('dialog.options.editor.autoSave')}
          description={t('dialog.options.editor.autoSaveDesc')}
          checked={settings.editorAutoSave}
          onChange={(v) => updateSetting('editorAutoSave', v)}
        />
        <SettingItemSwitch
          label={t('dialog.options.editor.autoComplete')}
          description={t('dialog.options.editor.autoCompleteDesc')}
          checked={settings.editorAutoComplete}
          onChange={(v) => updateSetting('editorAutoComplete', v)}
        />
        <SettingItemSwitch
          label={t('dialog.options.editor.minimap')}
          description={t('dialog.options.editor.minimapDesc')}
          checked={settings.editorMinimap}
          onChange={(v) => updateSetting('editorMinimap', v)}
        />
      </SettingGroup>
    </div>
  );
};

/* ---------- InterfacePanel ---------- */
interface InterfacePanelProps {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  theme: string;
  setTheme: (theme: 'light' | 'dark') => void;
  setHasChanges: (has: boolean) => void;
  tabCloseButtonOptions: { value: string; label: string }[];
}

export const InterfacePanel: React.FC<InterfacePanelProps> = ({
  settings,
  updateSetting,
  theme,
  setTheme,
  setHasChanges,
  tabCloseButtonOptions,
}) => {
  const { t } = useTranslation();

  const ThemePreview: React.FC<{ variant: 'light' | 'dark' }> = ({
    variant,
  }) => (
    <div
      className={cn(
        'w-20 h-[60px] rounded-md overflow-hidden relative border',
        variant === 'light'
          ? 'border-[#e0e0e0] bg-[#f5f5f5]'
          : 'border-[#3e3e42] bg-[#1e1e1e]'
      )}
    >
      <div
        className={cn(
          'absolute top-0 left-0 right-0 h-3',
          variant === 'light' ? 'bg-[#e8e8e8]' : 'bg-[#2d2d30]'
        )}
      />
      <div
        className={cn(
          'absolute top-3 left-0 w-5 bottom-0',
          variant === 'light' ? 'bg-[#f0f0f0]' : 'bg-[#252526]'
        )}
      />
      <div
        className={cn(
          'absolute top-3 left-5 right-0 bottom-0',
          variant === 'light' ? 'bg-[#ffffff]' : 'bg-[#1e1e1e]'
        )}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-6 max-w-[600px]">
      <SettingGroup title={t('dialog.options.interface.appearance')}>
        <div className="flex items-center justify-between gap-4 px-4 py-3.5 bg-[var(--options-item-bg)] hover:bg-[var(--options-item-hover)] transition-colors duration-150 animate-[setting-item-fade-in_0.3s_ease-out]">
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div className="text-[13px] font-medium text-[var(--bp6-text-color)] leading-snug">
              {t('dialog.options.interface.theme')}
            </div>
            <div className="text-xs text-[var(--bp6-text-color-muted)] leading-snug">
              {t('dialog.options.interface.themeDesc')}
            </div>
          </div>
          <div className="flex gap-4 shrink-0">
            <button
              className={cn(
                'flex flex-col items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 min-w-[100px]',
                theme === 'light'
                  ? 'border-[var(--bp6-intent-primary,#007acc)] bg-[rgba(0,122,204,0.08)]'
                  : 'border-[var(--options-card-border)] bg-[var(--options-card-bg)] hover:border-[var(--bp6-text-color-muted)] hover:-translate-y-0.5'
              )}
              onClick={() => {
                setTheme('light');
                setHasChanges(true);
              }}
            >
              <ThemePreview variant="light" />
              <span className="text-[13px] font-medium text-[var(--bp6-text-color)]">
                {t('theme.light')}
              </span>
            </button>
            <button
              className={cn(
                'flex flex-col items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 min-w-[100px]',
                theme === 'dark'
                  ? 'border-[var(--bp6-intent-primary,#007acc)] bg-[rgba(0,122,204,0.08)]'
                  : 'border-[var(--options-card-border)] bg-[var(--options-card-bg)] hover:border-[var(--bp6-text-color-muted)] hover:-translate-y-0.5'
              )}
              onClick={() => {
                setTheme('dark');
                setHasChanges(true);
              }}
            >
              <ThemePreview variant="dark" />
              <span className="text-[13px] font-medium text-[var(--bp6-text-color)]">
                {t('theme.dark')}
              </span>
            </button>
          </div>
        </div>
      </SettingGroup>

      <SettingGroup title={t('dialog.options.interface.elements')}>
        <SettingItemSwitch
          label={t('dialog.options.interface.sidebarDefaultCollapsed')}
          description={t('dialog.options.interface.sidebarDefaultCollapsedDesc')}
          checked={settings.sidebarDefaultCollapsed}
          onChange={(v) => updateSetting('sidebarDefaultCollapsed', v)}
        />
        <SettingItemSwitch
          label={t('dialog.options.interface.statusBarVisible')}
          description={t('dialog.options.interface.statusBarVisibleDesc')}
          checked={settings.statusBarVisible}
          onChange={(v) => updateSetting('statusBarVisible', v)}
        />
        <SettingItemSelect
          label={t('dialog.options.interface.tabCloseButton')}
          description={t('dialog.options.interface.tabCloseButtonDesc')}
          value={settings.tabCloseButton}
          options={tabCloseButtonOptions}
          onChange={(v) => updateSetting('tabCloseButton', v as TabCloseButtonType)}
        />
      </SettingGroup>
    </div>
  );
};

/* ---------- ConnectionPanel ---------- */
interface ConnectionPanelProps {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

export const ConnectionPanel: React.FC<ConnectionPanelProps> = ({
  settings,
  updateSetting,
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6 max-w-[600px]">
      <SettingGroup title={t('dialog.options.connection.config')}>
        <SettingItemNumber
          label={t('dialog.options.connection.timeout')}
          description={t('dialog.options.connection.timeoutDesc')}
          value={settings.connectionTimeout}
          min={5}
          max={300}
          stepSize={5}
          suffix={t('dialog.options.connection.seconds')}
          onChange={(v) => updateSetting('connectionTimeout', v)}
        />
        <SettingItemNumber
          label={t('dialog.options.connection.maxConnections')}
          description={t('dialog.options.connection.maxConnectionsDesc')}
          value={settings.maxConnections}
          min={1}
          max={50}
          suffix={t('dialog.options.connection.count')}
          onChange={(v) => updateSetting('maxConnections', v)}
        />
      </SettingGroup>
    </div>
  );
};
