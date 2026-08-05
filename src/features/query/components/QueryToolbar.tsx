import React, { useState, useEffect } from 'react';
import { Button, Menu, MenuItem, Popover, Position, Divider } from '@blueprintjs/core';
import { useTranslation } from 'react-i18next';
import type { ConnectionProfile } from '@/types';
import { useAppStore, useMetadataStore } from '@/stores';
import { cn } from '@/lib/cn';
import {
  SaveIcon,
  PlayIcon,
  SearchIcon,
  FormatIcon,
  ClearIcon,
  CheckIcon,
  UndoIcon,
  ConnectionStatusIcon,
} from '@/components/icons/QueryIcons';

interface QueryToolbarProps {
  availableConnections: ConnectionProfile[];
  selectedConnection?: ConnectionProfile;
  selectedDatabase?: string;
  isConnected: boolean;
  isExecuting: boolean;
  autoCommit: boolean;
  statusMessage: string;
  connectionInfo: string;
  onConnectionChange: (connection?: ConnectionProfile) => void;
  onDatabaseChange: (database?: string) => void;
  onExecute: () => void;
  executeLabel?: string;
  onSave: () => void;
  onExplain: () => void;
  onFormat: () => void;
  onClear: () => void;
  onInsertSnippet: (snippet: string) => void;
  onTransactionModeChange: (mode: 'auto' | 'manual') => void;
  onCommit: () => void;
  onRollback: () => void;
}

export const QueryToolbar: React.FC<QueryToolbarProps> = ({
  availableConnections,
  selectedConnection,
  selectedDatabase,
  isConnected,
  isExecuting,
  autoCommit,
  statusMessage,
  connectionInfo,
  onConnectionChange,
  onDatabaseChange,
  onExecute,
  executeLabel,
  onSave,
  onExplain,
  onFormat,
  onClear,
  onInsertSnippet,
  onTransactionModeChange,
  onCommit,
  onRollback,
}) => {
  const { t } = useTranslation();
  const { theme } = useAppStore();
  const [databases, setDatabases] = useState<string[]>([]);
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(false);

  // Snippets for SQL
  const SQL_SNIPPETS = [
    { label: 'SELECT *', code: 'SELECT * FROM ' },
    { label: 'COUNT(*)', code: 'SELECT COUNT(*) FROM ' },
    { label: 'LIMIT 100', code: 'LIMIT 100' },
    { label: 'ORDER BY', code: 'ORDER BY id DESC' },
    { label: 'LEFT JOIN', code: 'LEFT JOIN table2 t2 ON t1.id = t2.id' },
    { label: 'INSERT INTO', code: 'INSERT INTO table_name (column1, column2) VALUES (value1, value2)' },
    { label: 'UPDATE', code: 'UPDATE table_name SET column1 = value1 WHERE condition' },
    { label: 'DELETE', code: 'DELETE FROM table_name WHERE condition' },
  ];

  // Load databases when connection changes
  useEffect(() => {
    const loadDatabases = async () => {
      if (!selectedConnection) {
        setDatabases([]);
        return;
      }

      setIsLoadingDatabases(true);
      try {
        const dbs = await useMetadataStore.getState().fetchDatabases(selectedConnection);
        setDatabases(dbs);
      } catch (error) {
        console.error('Failed to load databases:', error);
        setDatabases([]);
      } finally {
        setIsLoadingDatabases(false);
      }
    };

    loadDatabases();
  }, [selectedConnection]);

  return (
    <div className={cn(
      'flex flex-col flex-shrink-0 border-b px-2 py-1',
      theme === 'dark' ? 'border-[#3e3e42] bg-[#252a31]' : 'border-[#e1e5e9] bg-[#f5f6f7]',
    )}>
      {/* Connection and Database Selection Row */}
      <div className="flex items-center gap-3 py-0.5">
        <div className="flex items-center gap-1.5">
          <span className={cn('whitespace-nowrap text-xs', theme === 'dark' ? 'text-[#abb3bf]' : 'text-[#5f6b7c]')}>{t('queryToolbar.connection')}:</span>
          <div className="min-w-[120px]">
            <Popover
              position={Position.BOTTOM_LEFT}
              minimal
              content={
                <Menu>
                  <MenuItem
                    text={t('queryToolbar.noConnection')}
                    active={!selectedConnection}
                    onClick={() => onConnectionChange(undefined)}
                  />
                  {availableConnections.map((conn) => (
                    <MenuItem
                      key={conn.name || `${conn.host}:${conn.port}`}
                      text={conn.name || `${conn.host}:${conn.port}`}
                      active={selectedConnection?.name === conn.name}
                      onClick={() => onConnectionChange(conn)}
                    />
                  ))}
                </Menu>
              }
            >
              <Button
                text={selectedConnection?.name || t('queryToolbar.selectConnection')}
                rightIcon="caret-down"
                minimal
                small
                className="query-toolbar-dropdown flex items-center gap-1"
              />
            </Popover>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className={cn('whitespace-nowrap text-xs', theme === 'dark' ? 'text-[#abb3bf]' : 'text-[#5f6b7c]')}>{t('queryToolbar.database')}:</span>
          <div className="min-w-[120px]">
            <Popover
              position={Position.BOTTOM_LEFT}
              minimal
              content={
                <Menu>
                  <MenuItem
                    text={t('queryToolbar.selectDatabase')}
                    active={!selectedDatabase}
                    onClick={() => onDatabaseChange(undefined)}
                  />
                  {isLoadingDatabases ? (
                    <MenuItem text={t('common.loading')} disabled />
                  ) : (
                    databases.map((db) => (
                      <MenuItem
                        key={db}
                        text={db}
                        active={selectedDatabase === db}
                        onClick={() => onDatabaseChange(db)}
                      />
                    ))
                  )}
                </Menu>
              }
            >
              <Button
                text={selectedDatabase || t('queryToolbar.selectDatabase')}
                rightIcon="caret-down"
                minimal
                small
                className="query-toolbar-dropdown flex items-center gap-1"
                disabled={!isConnected}
              />
            </Popover>
          </div>
        </div>

        <div className="flex-1" />

        {/* Connection Status */}
        <div className="flex items-center gap-3">
          <span className={cn('text-xs', theme === 'dark' ? 'text-[#abb3bf]' : 'text-[#5f6b7c]')}>{statusMessage}</span>
          <div className="flex items-center gap-1.5">
            <ConnectionStatusIcon connected={isConnected} />
            <span className={cn('text-xs text-[#808080]', isConnected && 'text-[#28a745]')}>
              {connectionInfo}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="flex items-center gap-3 py-0.5">
        <div className="flex items-center gap-1.5">
          {/* Save Button */}
          <Button
            className="query-toolbar-btn"
            minimal
            small
            onClick={onSave}
            title={t('common.save')}
          >
            <SaveIcon size={16} />
            <span>{t('common.save')}</span>
          </Button>

          {/* Execute Button */}
          <Button
            className="query-toolbar-btn !bg-[#4299FF] !text-white hover:!bg-[#3182CE] disabled:!bg-[#cbd5e1] disabled:!text-[#64748b] disabled:!border-transparent disabled:opacity-60 disabled:cursor-not-allowed"
            minimal
            small
            onMouseDown={(e) => e.preventDefault()}
            onClick={onExecute}
            disabled={isExecuting || !isConnected}
            loading={isExecuting}
            title={t('queryToolbar.executeTitle')}
          >
            <PlayIcon size={16} color={isExecuting || !isConnected ? '#94a3b8' : '#28a745'} />
            <span>{executeLabel || t('queryToolbar.execute')}</span>
          </Button>

          {/* Explain Button */}
          <Button
            className="query-toolbar-btn"
            minimal
            small
            onMouseDown={(e) => e.preventDefault()}
            onClick={onExplain}
            disabled={isExecuting || !isConnected}
            title={t('queryToolbar.explain')}
          >
            <SearchIcon size={16} />
            <span>{t('queryToolbar.explain')}</span>
          </Button>

          {/* Format Button */}
          <Button
            className="query-toolbar-btn"
            minimal
            small
            onClick={onFormat}
            title={t('queryToolbar.format')}
          >
            <FormatIcon size={16} />
            <span>{t('queryToolbar.format')}</span>
          </Button>

          {/* Snippets Dropdown */}
          <Popover
            position={Position.BOTTOM_LEFT}
            minimal
            content={
              <Menu>
                {SQL_SNIPPETS.map((snippet) => (
                  <MenuItem
                    key={snippet.label}
                    text={snippet.label}
                    onClick={() => onInsertSnippet(snippet.code)}
                  />
                ))}
              </Menu>
            }
          >
            <Button
              className="query-toolbar-btn"
              minimal
              small
              rightIcon="caret-down"
              title={t('queryToolbar.snippets')}
            >
              <span>{t('queryToolbar.snippets')}</span>
            </Button>
          </Popover>

          {/* Clear Button */}
          <Button
            className="query-toolbar-btn"
            minimal
            small
            onClick={onClear}
            title={t('queryToolbar.clear')}
          >
            <ClearIcon size={16} />
            <span>{t('queryToolbar.clear')}</span>
          </Button>
        </div>

        <Divider className="!my-0 !mx-1 h-5" />

        <div className="flex items-center gap-1.5">
          <span className={cn('whitespace-nowrap text-xs', theme === 'dark' ? 'text-[#abb3bf]' : 'text-[#5f6b7c]')}>{t('queryToolbar.transaction')}:</span>
          <Popover
            position={Position.BOTTOM_LEFT}
            minimal
            content={
              <Menu>
                <MenuItem
                  text={t('queryToolbar.autoCommit')}
                  active={autoCommit}
                  onClick={() => onTransactionModeChange('auto')}
                />
                <MenuItem
                  text={t('queryToolbar.manualCommit')}
                  active={!autoCommit}
                  onClick={() => onTransactionModeChange('manual')}
                />
              </Menu>
            }
          >
            <Button
              text={autoCommit ? t('queryToolbar.autoCommit') : t('queryToolbar.manualCommit')}
              rightIcon="caret-down"
              minimal
              small
              className="query-toolbar-dropdown flex items-center gap-1"
              disabled={!isConnected}
            />
          </Popover>

          {/* Commit Button */}
          <Button
            className="query-toolbar-btn !text-[#28a745] disabled:!text-[#a8d5b5] disabled:cursor-not-allowed disabled:opacity-60"
            minimal
            small
            onClick={onCommit}
            disabled={autoCommit || !isConnected}
            title={t('queryToolbar.commit')}
          >
            <CheckIcon size={16} />
            <span>{t('queryToolbar.commit')}</span>
          </Button>

          {/* Rollback Button */}
          <Button
            className="query-toolbar-btn !text-[#dc3545] disabled:!text-[#f0b2b8] disabled:cursor-not-allowed disabled:opacity-60"
            minimal
            small
            onClick={onRollback}
            disabled={autoCommit || !isConnected}
            title={t('queryToolbar.rollback')}
          >
            <UndoIcon size={16} />
            <span>{t('queryToolbar.rollback')}</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
