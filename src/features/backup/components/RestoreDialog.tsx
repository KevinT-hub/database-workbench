import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Callout,
  Checkbox,
  Classes,
  Dialog,
  FormGroup,
  HTMLSelect,
  InputGroup,
  Intent,
  Spinner,
} from '@blueprintjs/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useTranslation } from 'react-i18next';
import { useAppStore, useMetadataStore } from '@/stores';
import type { ConnectionProfile, RestoreRequest } from '@/types';
import { useRestoreExecution } from '../useRestoreExecution';
import { cn } from '@/lib/cn';

interface RestoreDialogProps {
  isOpen: boolean;
  onClose: () => void;
  connectionProfile?: ConnectionProfile;
  initialDatabase?: string;
}

const SYSTEM_DATABASES = new Set(['information_schema', 'mysql', 'performance_schema', 'sys']);

export const RestoreDialog: React.FC<RestoreDialogProps> = ({
  isOpen,
  onClose,
  connectionProfile,
  initialDatabase,
}) => {
  const { t } = useTranslation();
  const { theme } = useAppStore();
  const {
    isBusy,
    statusText,
    logs,
    setStatusText,
    appendLog,
    resetExecutionStatus,
    executeRestore,
  } = useRestoreExecution();
  const [sqlScriptPath, setSqlScriptPath] = useState('');
  const [targetMode, setTargetMode] = useState<'existing' | 'new'>('existing');
  const [selectedDatabase, setSelectedDatabase] = useState('');
  const [newDatabaseName, setNewDatabaseName] = useState(initialDatabase || '');

  const [useTransaction, setUseTransaction] = useState(true);
  const [continueOnError, setContinueOnError] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [existingDatabases, setExistingDatabases] = useState<string[]>([]);
  const [loadingDatabases, setLoadingDatabases] = useState(false);

  const subtitle = useMemo(() => {
    if (!connectionProfile) {
      return t('restoreDialog.noTarget');
    }
    return t('restoreDialog.target', {
      name: connectionProfile.name || t('restoreDialog.unnamedConnection'),
      host: connectionProfile.host,
    });
  }, [connectionProfile, t]);

  const loadDatabases = async () => {
    if (!connectionProfile) {
      return;
    }

    setLoadingDatabases(true);
    try {
      const allDatabases = await useMetadataStore.getState().fetchDatabases(connectionProfile);
      const userDatabases = allDatabases.filter((name) => !SYSTEM_DATABASES.has(name.toLowerCase()));
      setExistingDatabases(userDatabases);
      if (initialDatabase && userDatabases.includes(initialDatabase)) {
        setSelectedDatabase(initialDatabase);
      } else if (userDatabases.length > 0) {
        setSelectedDatabase(userDatabases[0]);
      }
    } catch (error) {
      appendLog(t('restoreDialog.loadDatabasesFailed', { error: String(error) }));
    } finally {
      setLoadingDatabases(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setSqlScriptPath('');
    setTargetMode('existing');
    resetExecutionStatus(t('restoreDialog.ready'));
    setNewDatabaseName(initialDatabase || '');
    void loadDatabases();
  }, [isOpen, connectionProfile, initialDatabase, t, resetExecutionStatus]);

  const pickSqlFile = async () => {
    const selected = await open({
      title: t('restoreDialog.selectSqlFile'),
      multiple: false,
      directory: false,
      filters: [{ name: 'SQL', extensions: ['sql', 'gz'] }],
    });
    if (!selected || Array.isArray(selected)) {
      return;
    }
    setSqlScriptPath(selected);
  };

  const runExecuteRestore = async () => {
    if (!connectionProfile) {
      return;
    }
    const targetSchema = targetMode === 'existing' ? selectedDatabase : newDatabaseName.trim();
    const createSchema = targetMode === 'new';

    const request: RestoreRequest = {
      conn: connectionProfile,
      targetSchema,
      inputPath: sqlScriptPath,
      createSchema,
      continueOnError,
      useTransaction,
    };

    await executeRestore(request);
  };

  const runRestore = async () => {
    if (!sqlScriptPath.trim()) {
      setStatusText(t('restoreDialog.missingSql'));
      return;
    }

    if (targetMode === 'existing') {
      if (!selectedDatabase.trim()) {
        setStatusText(t('restoreDialog.missingDatabase'));
        return;
      }
      setConfirmOpen(true);
      return;
    }

    if (!newDatabaseName.trim()) {
      setStatusText(t('restoreDialog.missingNewDatabase'));
      return;
    }

    await runExecuteRestore();
  };

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title={t('restoreDialog.title')}
        icon="import"
        style={{ width: 1020, maxWidth: '96vw', maxHeight: '92vh' }}
      >
        <div className={cn(Classes.DIALOG_BODY, 'max-h-[70vh] overflow-auto')}>
          <div className={cn('mb-2.5 text-xs', theme === 'dark' ? 'text-[#9ca3af]' : 'text-[#5f6b7c]')}>{subtitle}</div>

          {!connectionProfile ? (
            <Callout intent={Intent.WARNING}>{t('restoreDialog.missingContext')}</Callout>
          ) : (
            <>
              <section className={cn('mb-3.5 rounded-lg border p-3', theme === 'dark' ? 'border-[#374151] bg-[#1f2937]' : 'border-[#d8e1eb] bg-[#f8fbff]')}>
                <h3 className={cn('m-0 mb-2.5 text-sm', theme === 'dark' ? 'text-[#e5e7eb]' : 'text-[#1f2d3d]')}>{t('restoreDialog.scriptTitle')}</h3>
                <div className="flex items-center gap-2.5 max-[900px]:flex-col max-[900px]:items-stretch">
                  <InputGroup
                    value={sqlScriptPath}
                    onChange={(e) => setSqlScriptPath(e.target.value)}
                    placeholder={t('restoreDialog.scriptPlaceholder')}
                  />
                  <Button onClick={pickSqlFile} disabled={isBusy}>{t('restore.browse')}</Button>
                </div>
              </section>

              <section className={cn('mb-3.5 rounded-lg border p-3', theme === 'dark' ? 'border-[#374151] bg-[#1f2937]' : 'border-[#d8e1eb] bg-[#f8fbff]')}>
                <h3 className={cn('m-0 mb-2.5 text-sm', theme === 'dark' ? 'text-[#e5e7eb]' : 'text-[#1f2d3d]')}>{t('restoreDialog.targetTitle')}</h3>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 max-[900px]:grid-cols-1">
                  <Checkbox
                    checked={targetMode === 'existing'}
                    onChange={() => setTargetMode('existing')}
                    label={t('restoreDialog.restoreToExisting')}
                  />
                  <Checkbox
                    checked={targetMode === 'new'}
                    onChange={() => setTargetMode('new')}
                    label={t('restoreDialog.restoreToNew')}
                  />
                </div>

                {targetMode === 'existing' ? (
                  <FormGroup label={t('restoreDialog.selectDatabase')}>
                    <div className="flex items-center gap-2.5 max-[900px]:flex-col max-[900px]:items-stretch">
                      <HTMLSelect
                        fill
                        value={selectedDatabase}
                        onChange={(e) => setSelectedDatabase(e.target.value)}
                        disabled={loadingDatabases || existingDatabases.length === 0}
                        options={
                          existingDatabases.length > 0
                            ? existingDatabases
                            : [{ label: loadingDatabases ? t('common.loading') : t('restoreDialog.noDatabases'), value: '' }]
                        }
                      />
                      <Button
                        className="min-w-[72px] shrink-0 whitespace-nowrap"
                        onClick={loadDatabases}
                        disabled={loadingDatabases || isBusy}
                      >
                        {loadingDatabases ? <Spinner size={14} /> : t('common.refresh')}
                      </Button>
                    </div>
                  </FormGroup>
                ) : (
                  <FormGroup label={t('restoreDialog.newDatabaseName')}>
                    <InputGroup
                      value={newDatabaseName}
                      onChange={(e) => setNewDatabaseName(e.target.value)}
                      placeholder={t('restoreDialog.newDatabasePlaceholder')}
                    />
                  </FormGroup>
                )}
              </section>

              <section className={cn('mb-3.5 rounded-lg border p-3', theme === 'dark' ? 'border-[#374151] bg-[#1f2937]' : 'border-[#d8e1eb] bg-[#f8fbff]')}>
                <h3 className={cn('m-0 mb-2.5 text-sm', theme === 'dark' ? 'text-[#e5e7eb]' : 'text-[#1f2d3d]')}>{t('restoreDialog.optionsTitle')}</h3>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 max-[900px]:grid-cols-1">
                  <Checkbox checked={useTransaction} onChange={(e) => setUseTransaction((e.target as HTMLInputElement).checked)} label={t('restoreDialog.useTransaction')} />
                  <Checkbox checked={continueOnError} onChange={(e) => setContinueOnError((e.target as HTMLInputElement).checked)} label={t('restoreDialog.continueOnError')} />
                </div>
              </section>

              <section className={cn('mb-3.5 rounded-lg border p-3', theme === 'dark' ? 'border-[#374151] bg-[#1f2937]' : 'border-[#d8e1eb] bg-[#f8fbff]')}>
                <h3 className={cn('m-0 mb-2.5 text-sm', theme === 'dark' ? 'text-[#e5e7eb]' : 'text-[#1f2d3d]')}>{t('restoreDialog.logs')}</h3>
                <div className={cn(
                  "min-h-[180px] max-h-[320px] overflow-auto whitespace-pre-wrap rounded-md border p-2 font-['Consolas','Courier_New',monospace] text-xs",
                  theme === 'dark' ? 'border-[#374151] bg-[#111827] text-[#d1d5db]' : 'border-[#d8e1eb] bg-white',
                )}>{logs.length > 0 ? logs.join('\n') : t('restoreDialog.noLogs')}</div>
              </section>
            </>
          )}
        </div>

        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <span className={cn('mr-auto text-xs', theme === 'dark' ? 'text-[#9ca3af]' : 'text-[#5f6b7c]')}>{statusText}</span>
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button intent={Intent.PRIMARY} loading={isBusy} onClick={runRestore} disabled={!connectionProfile}>
              {t('restoreDialog.start')}
            </Button>
          </div>
        </div>
      </Dialog>

      <Alert
        isOpen={confirmOpen}
        intent="warning"
        cancelButtonText={t('common.cancel')}
        confirmButtonText={t('restoreDialog.confirmRestore')}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          setConfirmOpen(false);
          await runExecuteRestore();
        }}
      >
        <p>{t('restoreDialog.confirmOverwrite', { database: selectedDatabase })}</p>
        <p>{t('restoreDialog.confirmWarning')}</p>
      </Alert>
    </>
  );
};
