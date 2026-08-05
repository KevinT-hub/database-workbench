import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, Tab, Button, Dialog, Classes } from '@blueprintjs/core';
import { X, Search, FileCode, Table, Eye, Edit3, Users, User, FunctionSquare } from 'lucide-react';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { useTabStore, useAppStore } from '../../stores';
import { QueryTab } from '@/features/query';
import { DatabaseObjectTab } from '@/features/database-objects';
import { TableDataTab, ViewDataTab } from '@/features/data-browser';
import { ViewDesignerTab, FunctionDesignerTab, DesignerTab } from '@/features/designer';
import { UserTab, UserEditorTab } from '@/features/user-management';
import { WelcomeTab } from '@/features/welcome';
import { ViewDefinitionDialog } from '@/features/dialogs';
import logoImage from '../../assets/Database Workbench.png';
import { cn } from '@/lib/cn';
import type { Tab as TabType, ConnectionProfile, DesignerActionRequest } from '../../types';

// 欢迎页面组件（背景板）
const WelcomePage: React.FC<{ theme: string }> = ({ theme }) => {
  const { t } = useTranslation();
  const shortcuts = [
    {
      id: 'new-connection',
      label: t('welcomeTab.newConnection'),
      shortcut: 'Ctrl + N',
    },
    {
      id: 'new-query',
      label: t('welcomeTab.newQuery'),
      shortcut: 'Ctrl + Q',
    },
  ];

  return (
    <div className={cn('flex h-full items-center justify-center', `bp5-${theme}`)}>
      <div className="flex flex-col items-center justify-center gap-10 text-center">
        <div className="flex items-center justify-center">
          <img 
            src={logoImage}
            alt="Database Workbench"
            className={cn('h-[180px] w-[180px] object-contain grayscale', theme === 'dark' ? 'opacity-15' : 'opacity-25')}
          />
        </div>
        <div className="flex flex-col gap-2">
          {shortcuts.map((item) => (
            <div 
              key={item.id} 
              className="flex min-w-[260px] items-center justify-between gap-10 px-3 py-1.5"
            >
              <span className="text-sm">{item.label}</span>
              <div className="flex items-center gap-1">
                {item.shortcut.split(' + ').map((key, index) => (
                  <React.Fragment key={key}>
                    <kbd className={cn(
                      'flex h-[22px] min-w-[22px] items-center justify-center rounded-[3px] border px-1.5 text-[11px] font-medium',
                      theme === 'dark' ? 'border-[#555] bg-[#3c3c3c]' : 'border-[#ccc] bg-white',
                    )}>{key}</kbd>
                    {index < item.shortcut.split(' + ').length - 1 && (
                      <span className="px-0.5 text-[11px]">+</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const TabContainer: React.FC = () => {
  const { theme, setStatusMessage } = useAppStore();
  const { t } = useTranslation();
  const {
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    addTab,
    updateTab,
  } = useTabStore();

  const [pendingCloseTabId, setPendingCloseTabId] = useState<string | null>(null);
  const [tabCloseButtonMode, setTabCloseButtonMode] = useState<'hover' | 'always'>('hover');

  const [viewDefinitionDialog, setViewDefinitionDialog] = useState<{
    isOpen: boolean;
    viewName: string;
    database: string;
    connectionProfile: ConnectionProfile | null;
  }>({
    isOpen: false,
    viewName: '',
    database: '',
    connectionProfile: null,
  });

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  const saveQueryTabToFile = useCallback(async (tab: TabType): Promise<boolean> => {
    if (tab.type !== 'query') return true;

    try {
      let filePath = tab.sqlFilePath;

      if (!filePath) {
        const defaultName = `${(tab.title || 'query')
          .replace(/^\*/, '')
          .replace(/\s+/g, '_')
          .replace(/[\\/:*?"<>|]/g, '_')}.sql`;

        const selectedPath = await save({
          filters: [{ name: 'SQL', extensions: ['sql'] }],
          defaultPath: defaultName,
        });

        if (!selectedPath) {
          setStatusMessage('已取消保存');
          return false;
        }

        filePath = selectedPath;
      }

      await writeTextFile(filePath, tab.sqlContent || '');

      const fileName = filePath.split(/[/\\]/).pop() || 'query.sql';
      updateTab(tab.id, {
        title: fileName,
        sqlFilePath: filePath,
        isModified: false,
      });
      setStatusMessage(`已保存: ${fileName}`);
      return true;
    } catch (error) {
      setStatusMessage(`保存失败: ${error}`);
      return false;
    }
  }, [setStatusMessage, updateTab]);

  const requestCloseTab = useCallback((tabId: string) => {
    const tab = tabs.find((item) => item.id === tabId);
    if (!tab) return;

    if (tab.type === 'query' && tab.isModified) {
      setPendingCloseTabId(tabId);
      return;
    }

    closeTab(tabId);
  }, [tabs, closeTab]);

  const handleTabClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    requestCloseTab(tabId);
  };

  useEffect(() => {
    const handleRequestCloseTab = (event: Event) => {
      const customEvent = event as CustomEvent<{ tabId?: string }>;
      const targetTabId = customEvent.detail?.tabId || activeTabId;
      if (!targetTabId) return;
      requestCloseTab(targetTabId);
    };

    window.addEventListener('dbw:request-close-tab', handleRequestCloseTab);

    return () => {
      window.removeEventListener('dbw:request-close-tab', handleRequestCloseTab);
    };
  }, [activeTabId, requestCloseTab]);

  // Load tab close button setting on mount
  useEffect(() => {
    const settings = localStorage.getItem('dbw-settings');
    if (settings) {
      try {
        const parsed = JSON.parse(settings);
        if (parsed.tabCloseButton) {
          setTabCloseButtonMode(parsed.tabCloseButton);
        }
      } catch {
        // Ignore parse error
      }
    }
  }, []);

  // Listen for interface settings changes
  useEffect(() => {
    const handleInterfaceSettingsChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ tabCloseButton?: 'hover' | 'always' }>;
      if (customEvent.detail?.tabCloseButton) {
        setTabCloseButtonMode(customEvent.detail.tabCloseButton);
      }
    };

    window.addEventListener('dbw:interface-settings-changed', handleInterfaceSettingsChanged as EventListener);

    return () => {
      window.removeEventListener('dbw:interface-settings-changed', handleInterfaceSettingsChanged as EventListener);
    };
  }, []);

  const renderTabTitle = (tab: TabType) => {
    const isModified = tab.isModified;
    const displayTitle = isModified ? `*${tab.title.replace(/^\*/, '')}` : tab.title;

    const getTabIcon = () => {
      const iconSize = 14;
      const iconClass = 'tab-icon';
      
      switch (tab.type) {
        case 'query':
          return <span className={`${iconClass} tab-icon-query`}><FileCode size={iconSize} /></span>;
        case 'tableList':
          return <span className={`${iconClass} tab-icon-table`}><Table size={iconSize} /></span>;
        case 'viewList':
          return <span className={`${iconClass} tab-icon-view`}><Eye size={iconSize} /></span>;
        case 'functionList':
          return <span className={`${iconClass} tab-icon-function`}><FunctionSquare size={iconSize} /></span>;
        case 'tableData':
          return <span className={`${iconClass} tab-icon-table`}><Table size={iconSize} /></span>;
        case 'viewData':
          return <span className={`${iconClass} tab-icon-view`}><Eye size={iconSize} /></span>;
        case 'designer':
          return <span className={`${iconClass} tab-icon-designer`}><Edit3 size={iconSize} /></span>;
        case 'viewDesigner':
          return <span className={`${iconClass} tab-icon-view`}><Eye size={iconSize} /></span>;
        case 'functionDesigner':
          return <span className={`${iconClass} tab-icon-function`}><FunctionSquare size={iconSize} /></span>;
        case 'userManager':
          return <span className={`${iconClass} tab-icon-user`}><Users size={iconSize} /></span>;
        case 'userEditor':
          return <span className={`${iconClass} tab-icon-user`}><User size={iconSize} /></span>;
        default:
          return <span className={`${iconClass} tab-icon-query`}><Search size={iconSize} /></span>;
      }
    };

    return (
      <div className={`flex h-full w-full items-center gap-2 tab-close-mode-${tabCloseButtonMode}`}>
        {getTabIcon()}
        <span className={cn(
          'flex flex-1 items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap',
          isModified && 'italic',
        )}>
          {displayTitle}
        </span>
        <Button
          minimal
          small
          className="tab-close-btn"
          onClick={(e) => handleTabClose(e, tab.id)}
        >
          <X size={12} />
        </Button>
      </div>
    );
  };

  const handleOpenTableData = (tab: TabType, tableName: string) => {
    const connectionName = tab.connectionProfile?.name || tab.connectionId || t('tabTitles.unknownConnection');
    addTab({
      type: 'tableData',
      title: t('tabTitles.tableData', { tableName, database: tab.database, connectionName }),
      connectionId: tab.connectionId,
      connectionProfile: tab.connectionProfile,
      database: tab.database,
      table: tableName,
    });
  };

  const handleOpenViewData = (tab: TabType, viewName: string) => {
    const connectionName = tab.connectionProfile?.name || tab.connectionId || t('tabTitles.unknownConnection');
    addTab({
      type: 'viewData',
      title: t('tabTitles.viewData', { viewName, database: tab.database || '', connectionName }),
      connectionId: tab.connectionId,
      connectionProfile: tab.connectionProfile,
      database: tab.database,
      objectName: viewName,
    });
  };

  const handleOpenDesigner = (tab: TabType, tableName?: string) => {
    let title: string;
    if (tableName) {
      title = t('tabTitles.designer.edit', { tableName });
    } else if (tab.database) {
      title = t('tabTitles.designer.newWithDatabase', { database: tab.database });
    } else {
      title = t('tabTitles.designer.new');
    }
    addTab({
      type: 'designer',
      title,
      connectionId: tab.connectionId,
      connectionProfile: tab.connectionProfile,
      database: tab.database,
      table: tableName,
    });
  };

  const handleOpenViewDesigner = (tab: TabType, viewName: string) => {
    addTab({
      type: 'viewDesigner',
      title: t('tabTitles.viewDesigner', { viewName }),
      connectionId: tab.connectionId,
      connectionProfile: tab.connectionProfile,
      database: tab.database,
      objectName: viewName,
    });
  };

  const handleViewDefinition = (tab: TabType, viewName: string) => {
    setViewDefinitionDialog({
      isOpen: true,
      viewName,
      database: tab.database || '',
      connectionProfile: tab.connectionProfile || null,
    });
  };

  const handleOpenFunctionDesigner = (tab: TabType, functionName: string, functionType?: 'FUNCTION' | 'PROCEDURE', autoExecute?: boolean) => {
    let title: string;
    if (functionName) {
      if (functionType === 'PROCEDURE') {
        title = t('tabTitles.functionDesigner.editProcedure', { name: functionName });
      } else {
        title = t('tabTitles.functionDesigner.editFunction', { name: functionName });
      }
    } else {
      if (functionType === 'PROCEDURE') {
        title = t('tabTitles.functionDesigner.newProcedure');
      } else {
        title = t('tabTitles.functionDesigner.newFunction');
      }
    }
    addTab({
      type: 'functionDesigner',
      title,
      connectionId: tab.connectionId,
      connectionProfile: tab.connectionProfile,
      database: tab.database,
      objectName: functionName || undefined,
      data: { functionType, autoExecute },
    });
  };

  const handleOpenUserEditor = (tab: TabType, username: string, host: string) => {
    addTab({
      type: 'userEditor',
      title: username ? t('tabTitles.userEditor.edit', { username, host }) : t('tabTitles.userEditor.new'),
      connectionId: tab.connectionId,
      connectionProfile: tab.connectionProfile,
      objectName: username,
      data: { host },
    });
  };

  const renderTabPanel = (tab: TabType) => {
    switch (tab.type) {
      case 'query':
        return (
          <QueryTab
            tabId={tab.id}
            initialConnection={tab.connectionProfile}
            initialDatabase={tab.database}
          />
        );
      
      case 'tableList':
      case 'viewList':
      case 'functionList':
        return (
          <DatabaseObjectTab
            tabId={tab.id}
            objectType={tab.objectType!}
            connectionProfile={tab.connectionProfile!}
            database={tab.database!}
            onOpenTableData={(name) => handleOpenTableData(tab, name)}
            onOpenViewData={(name) => handleOpenViewData(tab, name)}
            onOpenViewDesigner={(name) => handleOpenViewDesigner(tab, name)}
            onViewDefinition={(name) => handleViewDefinition(tab, name)}
            onOpenFunctionDesigner={(name, funcType, autoExec) => handleOpenFunctionDesigner(tab, name, funcType, autoExec)}
            onOpenDesigner={(name) => handleOpenDesigner(tab, name)}
          />
        );
      
      case 'tableData':
        return (
          <TableDataTab
            tabId={tab.id}
            connectionProfile={tab.connectionProfile!}
            database={tab.database!}
            tableName={tab.table!}
          />
        );

      case 'viewData':
        return (
          <ViewDataTab
            tabId={tab.id}
            connectionProfile={tab.connectionProfile!}
            database={tab.database!}
            viewName={tab.objectName || ''}
          />
        );

      case 'viewDesigner':
        return (
          <ViewDesignerTab
            tabId={tab.id}
            connectionProfile={tab.connectionProfile!}
            database={tab.database!}
            viewName={tab.objectName}
          />
        );
      
      case 'functionDesigner':
        return (
          <FunctionDesignerTab
            tabId={tab.id}
            connectionProfile={tab.connectionProfile!}
            database={tab.database!}
            functionName={tab.objectName}
            functionType={(tab.data as { functionType?: 'FUNCTION' | 'PROCEDURE' })?.functionType}
            autoExecute={(tab.data as { autoExecute?: boolean })?.autoExecute}
          />
        );
      
      case 'userManager':
        return (
          <UserTab
            tabId={tab.id}
            connectionProfile={tab.connectionProfile!}
            onOpenUserEditor={(username, host) => handleOpenUserEditor(tab, username, host)}
          />
        );
      
      case 'userEditor':
        return (
          <UserEditorTab
            tabId={tab.id}
            connectionProfile={tab.connectionProfile!}
            username={tab.objectName}
            host={(tab.data as { host?: string })?.host}
          />
        );
      
      case 'designer':
        return (
          <DesignerTab
            tabId={tab.id}
            connectionProfile={tab.connectionProfile!}
            database={tab.database!}
            tableName={tab.table}
            actionRequest={(tab.data as { designerAction?: DesignerActionRequest } | undefined)?.designerAction}
          />
        );

      case 'welcome':
        return <WelcomeTab />;
      
      default:
        return (
          <div className="tab-panel-placeholder">
            <p>{tab.title} - 功能开发中</p>
          </div>
        );
    }
  };

  if (tabs.length === 0) {
    return <WelcomePage theme={theme} />;
  }

  return (
    <>
      <div className={cn('flex h-full flex-col', `bp5-${theme}`)}>
        <Tabs
          selectedTabId={activeTabId || undefined}
          onChange={handleTabChange}
          className="main-tabs flex min-h-0 flex-1 flex-col"
        >
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              id={tab.id}
              title={renderTabTitle(tab)}
              panel={renderTabPanel(tab)}
            />
          ))}
        </Tabs>

        <ViewDefinitionDialog
          isOpen={viewDefinitionDialog.isOpen}
          onClose={() => setViewDefinitionDialog(prev => ({ ...prev, isOpen: false }))}
          connectionProfile={viewDefinitionDialog.connectionProfile!}
          database={viewDefinitionDialog.database}
          viewName={viewDefinitionDialog.viewName}
        />
      </div>

      <Dialog
        isOpen={!!pendingCloseTabId}
        onClose={() => setPendingCloseTabId(null)}
        title="未保存的查询"
        icon="warning-sign"
      >
        <div className={Classes.DIALOG_BODY}>
          <p>当前查询尚未保存，是否先保存再关闭？</p>
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button onClick={() => setPendingCloseTabId(null)}>取消</Button>
            <Button
              intent="warning"
              onClick={() => {
                if (!pendingCloseTabId) return;
                closeTab(pendingCloseTabId);
                setPendingCloseTabId(null);
              }}
            >
              不保存关闭
            </Button>
            <Button
              intent="primary"
              onClick={async () => {
                if (!pendingCloseTabId) return;
                const tab = tabs.find((item) => item.id === pendingCloseTabId);
                if (!tab) {
                  setPendingCloseTabId(null);
                  return;
                }

                const saved = await saveQueryTabToFile(tab);
                if (saved) {
                  closeTab(pendingCloseTabId);
                  setPendingCloseTabId(null);
                }
              }}
            >
              保存并关闭
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
};
