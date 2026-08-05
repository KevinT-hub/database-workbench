// 表设计器容器：头部工具栏（表名/刷新/保存）、Tab 切换、错误与加载态。
// 领域状态见 useDesignerState，各 Tab 为独立子组件，SQL 生成为纯函数模块。

import React from 'react';
import { Tabs, Tab, Button, InputGroup, Intent, Spinner, Callout } from '@blueprintjs/core';
import { useTranslation } from 'react-i18next';
import type { ConnectionProfile, DesignerActionRequest } from '@/types';
import { useDesignerState } from './useDesignerState';
import { useAppStore } from '@/stores';
import { cn } from '@/lib/cn';
import { FieldsTab } from './FieldsTab';
import { IndexesTab } from './IndexesTab';
import { ForeignKeysTab } from './ForeignKeysTab';
import { ChecksTab } from './ChecksTab';
import { TriggersTab } from './TriggersTab';
import { OptionsTab } from './OptionsTab';
import { SqlPreviewTab } from './SqlPreviewTab';
import { DdlTab } from './DdlTab';

interface DesignerTabProps {
  tabId: string;
  connectionProfile: ConnectionProfile;
  database: string;
  tableName?: string;
  actionRequest?: DesignerActionRequest;
}

export const DesignerTab: React.FC<DesignerTabProps> = ({
  tabId,
  connectionProfile,
  database,
  tableName,
  actionRequest,
}) => {
  const { t } = useTranslation();
  const { theme } = useAppStore();
  const state = useDesignerState({ tabId, connectionProfile, database, tableName, actionRequest });

  if (state.isLoading) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-4">
        <Spinner size={50} />
        <span>{t('designerTab.loading')}</span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className={cn(
        'flex flex-shrink-0 items-center justify-between border-b px-3 py-2',
        theme === 'dark' ? 'border-[#3e3e42] bg-[#252a31]' : 'border-[#e1e5e9] bg-[#f5f6f7]',
      )}>
        <div className="flex items-center gap-3">
          <span className={cn('text-sm font-semibold', theme === 'dark' ? 'text-[#f6f7f9]' : 'text-[#1c2127]')}>
            {state.isNewTable ? t('designerTab.newTable') : `${t('designerTab.designTable')}: ${state.currentTableName}`}
          </span>
          <span className={cn('rounded-[3px] px-2 py-0.5 text-xs', theme === 'dark' ? 'bg-[#252a31] text-[#abb3bf]' : 'bg-white text-[#5f6b7c]')}>{database}</span>
          {state.isNewTable && (
            <InputGroup
              small
              value={state.newTableName}
              onChange={(e) => {
                state.setNewTableName(e.target.value);
                if (state.error) {
                  state.setError(null);
                }
              }}
              placeholder={t('designerTab.tableNamePlaceholder')}
              style={{ width: 220, marginLeft: 12 }}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            icon="refresh"
            text={t('designerTab.refresh')}
            small
            onClick={() => state.loadTableData()}
          />
          <Button
            icon="floppy-disk"
            text={t('designerTab.save')}
            intent={state.hasChanges ? Intent.PRIMARY : Intent.NONE}
            small
            onClick={state.handleSave}
            loading={state.isSaving}
            disabled={!state.hasChanges || !state.generatedSql}
          />
        </div>
      </div>

      {state.error && (
        <Callout intent={Intent.DANGER} className="mx-3 my-2 flex-shrink-0">
          {state.error}
        </Callout>
      )}

      <div className="designer-content flex min-h-0 flex-1 flex-col overflow-hidden">
        <Tabs
          id={`designer-tabs-${tabId}`}
          selectedTabId={state.selectedTabId}
          onChange={(id) => state.setSelectedTabId(id as string)}
          renderActiveTabPanelOnly={false}
          large={false}
          className="flex h-full min-h-0 flex-1 flex-col"
        >
          {!state.isNewTable && (
            <Tab id="ddl" title="DDL" panel={<DdlTab ddl={state.ddl} appTheme={state.appTheme} />} />
          )}
          <Tab
            id="fields"
            title={t('designerTab.tabs.fields')}
            panel={
              <FieldsTab
                fields={state.fields}
                selectedFieldId={state.selectedFieldId}
                onSelectField={state.setSelectedFieldId}
                onFieldChange={state.handleFieldChange}
                onAddField={state.handleAddField}
                onInsertField={state.handleInsertField}
                onDeleteField={state.handleDeleteField}
                onTogglePrimaryKey={state.handleTogglePrimaryKey}
                onMoveField={state.handleMoveField}
              />
            }
          />
          <Tab
            id="indexes"
            title={t('designerTab.tabs.indexes')}
            panel={
              <IndexesTab
                indexes={state.indexes}
                selectedIndexId={state.selectedIndexId}
                onSelectIndex={state.setSelectedIndexId}
                onIndexChange={state.handleIndexChange}
                onAddIndex={state.handleAddIndex}
                onDeleteIndex={state.handleDeleteIndex}
              />
            }
          />
          <Tab
            id="foreignKeys"
            title={t('designerTab.tabs.foreignKeys')}
            panel={
              <ForeignKeysTab
                foreignKeys={state.foreignKeys}
                selectedFkId={state.selectedFkId}
                onSelectFk={state.setSelectedFkId}
                onFkChange={state.handleFkChange}
                onAddForeignKey={state.handleAddForeignKey}
                onDeleteForeignKey={state.handleDeleteForeignKey}
              />
            }
          />
          <Tab
            id="checks"
            title={t('designerTab.tabs.checks')}
            panel={
              <ChecksTab
                checks={state.checks}
                selectedCheckId={state.selectedCheckId}
                onSelectCheck={state.setSelectedCheckId}
                onCheckChange={state.handleCheckChange}
                onAddCheck={state.handleAddCheck}
                onDeleteCheck={state.handleDeleteCheck}
              />
            }
          />
          <Tab
            id="triggers"
            title={t('designerTab.tabs.triggers')}
            panel={
              <TriggersTab
                triggers={state.triggers}
                selectedTriggerId={state.selectedTriggerId}
                onSelectTrigger={state.setSelectedTriggerId}
                onTriggerChange={state.handleTriggerChange}
                onAddTrigger={state.handleAddTrigger}
                onDeleteTrigger={state.handleDeleteTrigger}
                connectionProfile={connectionProfile}
                database={database}
                appTheme={state.appTheme}
              />
            }
          />
          <Tab
            id="options"
            title={t('designerTab.tabs.options')}
            panel={<OptionsTab tableOptions={state.tableOptions} onOptionsChange={state.setTableOptions} />}
          />
          <Tab
            id="sqlPreview"
            title={t('designerTab.tabs.sqlPreview')}
            panel={<SqlPreviewTab generatedSql={state.generatedSql} appTheme={state.appTheme} />}
          />
        </Tabs>
      </div>
    </div>
  );
};

