import React, { useState } from 'react';
import {
  Dialog,
  Button,
  Icon,
  Callout,
} from '@blueprintjs/core';
import type { IconName } from '@blueprintjs/icons';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { usePropertiesData } from './usePropertiesData';
import { GeneralPanel, ConnectionPanel, DatabasePanel } from './PropertiesPanels';

interface PropertiesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabId = 'general' | 'connection' | 'database';

export const PropertiesDialog: React.FC<PropertiesDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const { activeConnection, activeDatabase, realProperties } = usePropertiesData(isOpen);

  const tabsConfig: { id: TabId; label: string; icon: IconName }[] = [
    { id: 'general', label: t('propertiesDialog.tabs.general'), icon: 'info-sign' },
    { id: 'connection', label: t('propertiesDialog.tabs.connection'), icon: 'data-connection' },
    { id: 'database', label: t('propertiesDialog.tabs.database'), icon: 'database' },
  ];

  const isConnected = realProperties?.connectionStatus ?? activeConnection?.isConnected ?? false;
  const currentDatabase = realProperties?.currentDatabase ?? activeDatabase ?? null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title=""
      icon={null}
      className="properties-dialog animate-[properties-dialog-fade-in_0.2s_ease-out]"
      style={{ width: 700, height: 500 }}
    >
      <div className="flex h-full min-h-[500px]">
        {/* 左侧边栏 */}
        <div className="w-[180px] flex flex-col shrink-0 border-r border-[var(--properties-sidebar-border)] bg-[var(--properties-sidebar-bg)]">
          {/* 侧边栏 Header */}
          <div className="flex items-center gap-2.5 px-5 py-4 text-[15px] font-semibold text-[var(--properties-nav-text)] border-b border-[var(--properties-sidebar-border)]">
            <Icon icon="properties" size={18} className="text-[var(--bp6-intent-primary)]" />
            <span className="truncate">{t('propertiesDialog.title')}</span>
          </div>

          {/* 导航 */}
          <nav className="flex-1 p-2 flex flex-col gap-0.5 overflow-y-auto properties-scrollable">
            {tabsConfig.map((tab) => (
              <button
                key={tab.id}
                className={cn(
                  'relative flex items-center gap-2.5 px-3 py-2.5 w-full text-left text-[13px] font-medium rounded-md transition-all duration-150 border-none bg-transparent cursor-pointer',
                  'text-[var(--properties-nav-text-muted)] hover:text-[var(--properties-nav-text)] hover:bg-[var(--properties-nav-hover-bg)]',
                  activeTab === tab.id && [
                    'bg-[var(--properties-nav-active-bg)] text-[var(--properties-nav-active-text)] font-semibold',
                    'before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-[3px] before:h-5 before:bg-[var(--bp6-intent-primary)] before:rounded-r-sm',
                  ]
                )}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon
                  icon={tab.icon}
                  size={16}
                  className={cn(
                    'shrink-0',
                    activeTab === tab.id && 'text-[var(--bp6-intent-primary)]'
                  )}
                />
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* 右侧内容区 */}
        <div className="flex flex-col flex-1 min-w-0 bg-[var(--bp6-app-background-color)]">
          {/* 内容 Header */}
          <div className="px-6 pt-5 pb-4 border-b border-[var(--properties-content-border)] shrink-0">
            <h2 className="text-xl font-semibold text-[var(--bp6-text-color)] leading-tight m-0">
              {tabsConfig.find((tab) => tab.id === activeTab)?.label}
            </h2>
          </div>

          {/* 内容 Body */}
          <div className="flex-1 p-6 overflow-y-auto overflow-x-hidden properties-scrollable">
            {!activeConnection ? (
              <Callout intent="warning" icon="warning-sign" className="properties-callout">
                {t('propertiesDialog.noActiveConnection')}
              </Callout>
            ) : (
              <>
                {activeTab === 'general' && (
                  <GeneralPanel
                    connection={activeConnection}
                    database={currentDatabase}
                    realProperties={realProperties}
                  />
                )}
                {activeTab === 'connection' && (
                  <ConnectionPanel
                    connection={activeConnection}
                    realProperties={realProperties}
                  />
                )}
                {activeTab === 'database' && (
                  <DatabasePanel
                    connection={activeConnection}
                    database={currentDatabase}
                    realProperties={realProperties}
                  />
                )}
              </>
            )}
          </div>

          {/* 内容 Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--properties-content-border)] shrink-0 bg-[var(--bp6-app-background-color)]">
            <div className="flex items-center">
              {activeConnection && (
                <span className="flex items-center gap-2 text-[13px] text-[var(--bp6-text-color-muted)]">
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full',
                      isConnected
                        ? 'bg-[#4caf50] shadow-[0_0_0_2px_rgba(76,175,80,0.3)]'
                        : 'bg-[#f44336] shadow-[0_0_0_2px_rgba(244,67,54,0.3)]'
                    )}
                  />
                  {isConnected
                    ? t('propertiesDialog.connected')
                    : t('propertiesDialog.disconnected')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={onClose} className="!text-[13px] !px-5 !py-1.5 !font-medium">
                {t('common.close')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
