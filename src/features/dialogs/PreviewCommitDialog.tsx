import React, { useState, useEffect } from 'react';
import {
  Dialog,
  Classes,
  Tab,
  Tabs,
  TabId,
  Button,
  Spinner,
} from '@blueprintjs/core';
import { useTranslation } from 'react-i18next';
import type { ConnectionProfile } from '@/types';
import { usePreviewCommitAssociations } from './usePreviewCommitAssociations';
import { useAppStore } from '@/stores';
import { cn } from '@/lib/cn';

interface DataRow {
  state: 'SYNCED' | 'NEW' | 'MODIFIED' | 'DELETED';
  originalData: unknown[];
  currentData: unknown[];
}

interface ColumnInfo {
  name: string;
  typeName: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  defaultValue: unknown;
}

interface PreviewCommitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  connectionProfile: ConnectionProfile;
  database: string;
  tableName: string;
  columns: ColumnInfo[];
  changedRows: DataRow[];
  primaryKeys: string[];
}

export const PreviewCommitDialog: React.FC<PreviewCommitDialogProps> = ({
  isOpen,
  onClose,
  connectionProfile,
  database,
  tableName,
  columns,
  changedRows,
  primaryKeys: _primaryKeys,
}) => {
  const { t } = useTranslation();
  const { theme } = useAppStore();
  const [selectedTab, setSelectedTab] = useState<TabId>('changes');
  const associations = usePreviewCommitAssociations({
    connectionProfile,
    database,
    tableName,
    columns,
    changedRows,
  });
  const { isLoading, triggers, foreignKeyChecks, loadError, loadAssociations } = associations;

  useEffect(() => {
    if (isOpen && selectedTab === 'associations') {
      loadAssociations();
    }
  }, [isOpen, selectedTab]);

  const getOperationLabel = (state: DataRow['state']): string => {
    switch (state) {
      case 'NEW':
        return t('previewCommit.dialog.changes.operations.new');
      case 'MODIFIED':
        return t('previewCommit.dialog.changes.operations.modified');
      case 'DELETED':
        return t('previewCommit.dialog.changes.operations.deleted');
      default:
        return '';
    }
  };

  const getOperationClassName = (state: DataRow['state']): string => {
    switch (state) {
      case 'NEW':
        return 'operation-new';
      case 'MODIFIED':
        return 'operation-modified';
      case 'DELETED':
        return 'operation-deleted';
      default:
        return '';
    }
  };

  const formatCellValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    if (typeof value === 'string') {
      return value.length > 50 ? value.substring(0, 50) + '...' : value;
    }
    return String(value);
  };

  const isNullValue = (value: unknown): boolean => {
    return value === null || value === undefined;
  };

  const handleRowDoubleClick = () => {
    setSelectedTab('associations');
  };

  const renderChangesTab = () => {
    if (changedRows.length === 0) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-app-text opacity-70">
          <span className="bp5-icon bp5-icon-info-sign" />
          <span>{t('previewCommit.dialog.changes.noData')}</span>
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex-shrink-0 border-b px-4 py-2 text-[13px] text-app-text opacity-70">
          {t('previewCommit.dialog.changes.recordCount', { count: changedRows.length })}
        </div>
        <div className="min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable_both-edges]">
          <table className="w-max min-w-full border-collapse font-['Microsoft_YaHei','Segoe_UI',sans-serif] text-[13px]">
            <thead>
              <tr>
                <th className={cn(
                  'w-[60px] min-w-[60px] max-w-[60px] border-b px-3 py-2 text-center align-top font-medium select-none sticky top-0 z-[1]',
                  theme === 'dark' ? 'border-[#374151] bg-[#1f2937] text-[#f3f4f6]' : 'border-[#e1e5e9] bg-[#f8f9fa] text-[#495057]',
                )}>{t('previewCommit.dialog.changes.operation')}</th>
                {columns.map((col) => (
                  <th
                    key={col.name}
                    className={cn(
                      'max-w-[360px] whitespace-nowrap border-b px-3 py-2 text-left align-top font-medium select-none sticky top-0 z-[1]',
                      theme === 'dark' ? 'border-[#374151] bg-[#1f2937] text-[#f3f4f6]' : 'border-[#e1e5e9] bg-[#f8f9fa] text-[#495057]',
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={cn('font-medium', theme === 'dark' ? 'text-[#f3f4f6]' : 'text-[#495057]')}>{col.name}</span>
                      {col.isPrimaryKey && (
                        <span className="rounded-[3px] bg-[#4299FF] px-1 py-px text-[10px] font-semibold text-white">
                          {t('previewCommit.dialog.changes.pkIndicator')}
                        </span>
                      )}
                    </div>
                    <div className={cn('mt-0.5 text-[11px] font-normal', theme === 'dark' ? 'text-[#9ca3af]' : 'text-[#8a94a1]')}>{col.typeName}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {changedRows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={cn(
                    'cursor-pointer transition-colors duration-100',
                    row.state === 'DELETED' && 'opacity-70',
                    theme === 'dark'
                      ? cn('bg-[#111827] text-[#f3f4f6]', row.state !== 'DELETED' && 'hover:bg-[#1f2937]')
                      : cn('bg-white text-[#495057]', row.state !== 'DELETED' && 'hover:bg-[#f8f9fa]'),
                  )}
                  onDoubleClick={handleRowDoubleClick}
                >
                  <td className={cn(
                    'w-[60px] min-w-[60px] max-w-[60px] border-b px-3 py-2 text-center whitespace-nowrap',
                    theme === 'dark' ? 'border-[#374151] bg-[#1f2937]' : 'border-[#f1f3f4] bg-[#f8f9fa]',
                    getOperationClassName(row.state) === 'operation-new' && 'text-[#198754]',
                    getOperationClassName(row.state) === 'operation-modified' && 'text-[#fd7e14]',
                    getOperationClassName(row.state) === 'operation-deleted' && 'text-[#dc3545]',
                  )}>
                    <strong>{getOperationLabel(row.state)}</strong>
                  </td>
                  {columns.map((col, colIndex) => {
                    const currentValue = row.currentData[colIndex];
                    const originalValue = row.originalData[colIndex];
                    const isModified = row.state === 'MODIFIED' && currentValue !== originalValue;
                    const displayValue = row.state === 'DELETED' ? originalValue : currentValue;

                    return (
                      <td
                        key={col.name}
                        className={cn(
                          'max-w-[360px] whitespace-nowrap border-b px-3 py-2 text-left',
                          theme === 'dark' ? 'border-[#374151] text-[#f3f4f6]' : 'border-[#f1f3f4] text-[#495057]',
                          row.state === 'DELETED' && 'line-through',
                          row.state === 'DELETED' && (theme === 'dark' ? 'text-[#9ca3af]' : 'text-[#8a94a1]'),
                          isModified && (theme === 'dark' ? 'bg-[rgba(255,193,7,0.1)]' : 'bg-[rgba(255,193,7,0.15)]'),
                        )}
                      >
                        <span
                          className={cn(
                            'inline-block max-w-[320px] overflow-hidden text-ellipsis whitespace-nowrap align-middle',
                            theme === 'dark' ? 'text-[#f3f4f6]' : 'text-[#495057]',
                            isNullValue(displayValue) && 'italic',
                            isNullValue(displayValue) && (theme === 'dark' ? 'text-[#9ca3af]' : 'text-[#8a94a1]'),
                          )}
                          title={String(displayValue ?? '')}
                        >
                          {formatCellValue(displayValue)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAssociationsTab = () => {
    if (isLoading) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-app-text opacity-70">
          <Spinner size={32} />
          <span>{t('previewCommit.dialog.associations.loading')}</span>
        </div>
      );
    }

    if (loadError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-[#dc3545]">
          <span className="text-2xl">⚠</span>
          <span>{loadError}</span>
        </div>
      );
    }

    const hasContent = triggers.length > 0 || foreignKeyChecks.length > 0;

    if (!hasContent) {
      return (
        <div className={cn('flex h-full flex-col items-center justify-center gap-2 text-sm', theme === 'dark' ? 'text-[#6ee7b7]' : 'text-[#198754]')}>
          <span className="text-2xl">✓</span>
          <span>{t('previewCommit.dialog.associations.noAssociations')}</span>
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto p-4">
        {triggers.map((trigger, idx) => (
          <div key={`trigger-${idx}`} className={cn('rounded-lg border p-4 shadow-[0_1px_3px_rgba(0,0,0,0.1)]', theme === 'dark' ? 'border-[#374151] bg-[#1f2937]' : 'border-[#e1e5e9] bg-white')}>
            <div className={cn('mb-3 text-sm font-semibold', theme === 'dark' ? 'text-[#f06292]' : 'text-[#d63384]')}>
              {t('previewCommit.dialog.associations.trigger')}: {trigger.name} ({trigger.timing} {trigger.event})
            </div>
            <textarea
              className={cn(
                "w-full resize-none rounded border p-3 font-['Consolas','Monaco',monospace] text-xs",
                theme === 'dark' ? 'border-[#374151] bg-[#111827] text-[#f3f4f6]' : 'border-[#e1e5e9] bg-[#f8f9fa] text-[#495057]',
              )}
              value={trigger.statement}
              readOnly
              rows={4}
            />
          </div>
        ))}

        {foreignKeyChecks.map((fk, idx) => (
          <div key={`fk-${idx}`} className={cn('rounded-lg border p-4 shadow-[0_1px_3px_rgba(0,0,0,0.1)]', theme === 'dark' ? 'border-[#374151] bg-[#1f2937]' : 'border-[#e1e5e9] bg-white')}>
            {fk.type === 'outgoing' ? (
              <>
                <div className={cn('mb-3 text-sm font-semibold', theme === 'dark' ? 'text-[#6ee7b7]' : 'text-[#198754]')}>
                  {t('previewCommit.dialog.associations.foreignKeyConstraint', { myColumn: fk.myColumn, refTable: fk.refTable, refColumn: fk.refColumn })}
                </div>
                {fk.warning && fk.missingValues && (
                  <div className={cn(
                    'mt-2 rounded bg-[rgba(255,193,7,0.1)] px-3 py-2 text-[13px] font-semibold leading-[1.5]',
                    theme === 'dark' ? 'text-[#ffc107]' : 'text-[#e0a800]',
                  )}>
                    ⚠ {fk.warning}:<br />
                    {fk.missingValues.join(', ')}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className={cn('mb-3 text-sm font-semibold', theme === 'dark' ? 'text-[#60a5fa]' : 'text-[#0d6efd]')}>
                  {t('previewCommit.dialog.associations.dependencyCheck', { refTable: fk.refTable, refColumn: fk.refColumn, myColumn: fk.myColumn })}
                </div>
                {fk.warning && (
                  <div className={cn(
                    'mt-2 rounded bg-[rgba(255,193,7,0.1)] px-3 py-2 text-[13px] font-semibold leading-[1.5]',
                    theme === 'dark' ? 'text-[#ffc107]' : 'text-[#e0a800]',
                  )}>
                    ⚠ {fk.warning}
                  </div>
                )}
                {fk.dependentRows && fk.dependentRows.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr>
                          {Object.keys(fk.dependentRows[0]).map(key => (
                            <th
                              key={key}
                              className={cn(
                                'whitespace-nowrap border-b border-[#e1e5e9] px-2.5 py-1.5 text-left font-medium',
                                theme === 'dark' ? 'bg-[#374151] text-[#f3f4f6]' : 'bg-[#f8f9fa] text-[#495057]',
                                key === fk.refColumn && (theme === 'dark' ? 'bg-[rgba(25,135,84,0.2)] text-[#6ee7b7]' : 'bg-[#d1e7dd] text-[#0f5132]'),
                              )}
                            >
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fk.dependentRows.slice(0, 10).map((row, rowIdx) => (
                          <tr key={rowIdx}>
                            {Object.entries(row).map(([key, val]) => (
                              <td
                                key={key}
                                className={cn(
                                  'whitespace-nowrap border-b border-[#e1e5e9] px-2.5 py-1.5 text-left',
                                  theme === 'dark' ? 'text-[#f3f4f6]' : 'text-[#495057]',
                                  key === fk.refColumn && (theme === 'dark' ? 'bg-[rgba(25,135,84,0.2)] text-[#6ee7b7]' : 'bg-[#d1e7dd] text-[#0f5132]'),
                                )}
                              >
                                {formatCellValue(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {fk.dependentRows.length > 10 && (
                      <div className="p-2 text-center text-xs italic text-app-text opacity-70">
                        {t('previewCommit.dialog.associations.moreRows', { count: fk.dependentRows.length - 10 })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('previewCommit.dialog.title', { database, tableName })}
      className="preview-commit-dialog !w-[900px] !h-[600px] !max-h-[calc(100vh-40px)]"
    >
      <div className={cn(Classes.DIALOG_BODY, '!p-0 !flex-1 flex h-full min-h-0 flex-col overflow-hidden')}>
        <Tabs
          id="preview-tabs"
          selectedTabId={selectedTab}
          onChange={(tabId) => setSelectedTab(tabId)}
          className="preview-tabs flex min-h-0 flex-1 flex-col"
        >
          <Tab id="changes" title={t('previewCommit.dialog.tabs.changes')} panel={renderChangesTab()} />
          <Tab id="associations" title={t('previewCommit.dialog.tabs.associations')} panel={renderAssociationsTab()} />
        </Tabs>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button onClick={onClose}>{t('previewCommit.dialog.close')}</Button>
        </div>
      </div>
    </Dialog>
  );
};

