import React, { useState } from 'react';
import { Dialog, Button, Icon } from '@blueprintjs/core';
import type { IconName } from '@blueprintjs/icons';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/stores';
import { cn } from '@/lib/cn';
import { useOptionsForm, type TabId } from '../useOptionsForm';
import {
  GeneralPanel,
  EditorPanel,
  InterfacePanel,
  ConnectionPanel,
} from './OptionPanels';

interface OptionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const useTabsConfig = () => {
  const { t } = useTranslation();
  return [
    { id: 'general' as TabId, label: t('dialog.options.general.title'), icon: 'settings' as IconName },
    { id: 'editor' as TabId, label: t('dialog.options.editor.title'), icon: 'code' as IconName },
    { id: 'interface' as TabId, label: t('dialog.options.interface.title'), icon: 'desktop' as IconName },
    { id: 'connection' as TabId, label: t('dialog.options.connection.title'), icon: 'database' as IconName },
  ];
};

export const OptionsDialog: React.FC<OptionsDialogProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const tabsConfig = useTabsConfig();

  const {
    theme,
    setTheme,
  } = useAppStore();

  const {
    settings,
    hasChanges,
    updateSetting,
    save,
    reset,
    cancel,
    setHasChanges,
  } = useOptionsForm();

  const handleSave = () => {
    save();
    onClose();
  };

  const handleCancel = () => {
    cancel();
    onClose();
  };

  const languageOptions = [
    { value: 'zh-CN', label: t('language.zhCN') },
    { value: 'en-US', label: t('language.enUS') },
  ];

  const tabCloseButtonOptions = [
    { value: 'hover', label: t('dialog.options.interface.tabCloseButtonHover') },
    { value: 'always', label: t('dialog.options.interface.tabCloseButtonAlways') },
  ];

  const activeTabLabel = tabsConfig.find((t) => t.id === activeTab)?.label ?? '';

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleCancel}
      title=""
      icon={null}
      className="options-dialog animate-[options-dialog-fade-in_0.2s_ease-out]"
      style={{ width: 800, height: 550 }}
    >
      <div className="flex h-full min-h-[550px]">
        {/* 左侧导航栏 */}
        <div className="w-[200px] shrink-0 flex flex-col bg-[var(--options-sidebar-bg)] border-r border-[var(--options-sidebar-border)]">
          <div className="flex items-center gap-2.5 px-5 py-4 text-[15px] font-semibold text-[var(--bp6-text-color)] border-b border-[var(--options-sidebar-border)]">
            <Icon icon="cog" size={18} className="text-[var(--bp6-intent-primary)]" />
            <span>{t('dialog.options.title')}</span>
          </div>
          <nav className="flex-1 p-2 flex flex-col gap-0.5 overflow-y-auto options-scrollable">
            {tabsConfig.map((tab) => (
              <button
                key={tab.id}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 border-none bg-transparent text-[13px] font-medium cursor-pointer rounded-md transition-all duration-150 text-left relative',
                  activeTab === tab.id
                    ? 'bg-[var(--options-nav-active-bg)] text-[var(--options-nav-active-text)] font-semibold'
                    : 'text-[var(--bp6-text-color-muted)] hover:bg-[var(--bp6-menu-background-color-hover)] hover:text-[var(--bp6-text-color)]'
                )}
                onClick={() => setActiveTab(tab.id)}
              >
                {activeTab === tab.id && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[var(--bp6-intent-primary)] rounded-r-sm" />
                )}
                <Icon
                  icon={tab.icon}
                  size={16}
                  className={cn(
                    'shrink-0',
                    activeTab === tab.id && 'text-[var(--bp6-intent-primary)]'
                  )}
                />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* 右侧内容区 */}
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--bp6-app-background-color)]">
          <div className="shrink-0 px-6 pt-5 pb-4 border-b border-[var(--bp6-divider-black)]">
            <h2 className="m-0 text-xl font-semibold text-[var(--bp6-text-color)] leading-snug">
              {activeTabLabel}
            </h2>
          </div>

          <div className="flex-1 px-6 py-6 overflow-y-auto options-scrollable">
            {activeTab === 'general' && (
              <GeneralPanel
                settings={settings}
                updateSetting={updateSetting}
                languageOptions={languageOptions}
              />
            )}
            {activeTab === 'editor' && (
              <EditorPanel settings={settings} updateSetting={updateSetting} />
            )}
            {activeTab === 'interface' && (
              <InterfacePanel
                settings={settings}
                updateSetting={updateSetting}
                theme={theme}
                setTheme={setTheme}
                setHasChanges={setHasChanges}
                tabCloseButtonOptions={tabCloseButtonOptions}
              />
            )}
            {activeTab === 'connection' && (
              <ConnectionPanel settings={settings} updateSetting={updateSetting} />
            )}
          </div>

          <div className="shrink-0 flex items-center justify-between px-6 py-4 border-t border-[var(--bp6-divider-black)] bg-[var(--bp6-app-background-color)]">
            <div className="flex items-center">
              {hasChanges && (
                <span className="flex items-center gap-1.5 text-xs text-[var(--bp6-intent-primary)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--bp6-intent-primary)] animate-[options-pulse_1.5s_ease-in-out_infinite]" />
                  {t('query.unsavedChanges')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button minimal onClick={reset} className="text-[13px] !text-[var(--bp6-text-color-muted)] hover:!text-[var(--bp6-text-color)]">
                {t('common.reset')}
              </Button>
              <Button onClick={handleCancel} className="text-[13px] px-4 py-1.5">
                {t('common.cancel')}
              </Button>
              <Button intent="primary" onClick={handleSave} className="text-[13px] px-5 py-1.5 font-medium">
                {t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
