import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Callout,
  Checkbox,
  Classes,
  Dialog,
  Divider,
  FormGroup,
  HTMLSelect,
  InputGroup,
  Intent,
  Spinner,
  Tag,
} from '@blueprintjs/core';
import { save } from '@tauri-apps/plugin-dialog';
import { useTranslation } from 'react-i18next';
import { useAppStore, useMetadataStore } from '@/stores';
import type { BackupRequest, ConnectionProfile } from '@/types';
import { useBackupExecution } from '../useBackupExecution';
import { cn } from '@/lib/cn';

interface BackupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  connectionProfile?: ConnectionProfile;
  database?: string;
}

const nowTimestamp = () => {
  const date = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

export const BackupDialog: React.FC<BackupDialogProps> = ({
  isOpen,
  onClose,
  connectionProfile,
  database,
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
    executeBackup,
  } = useBackupExecution();
  const [outputPath, setOutputPath] = useState('');
  const [includeStructure, setIncludeStructure] = useState(true);
  const [includeData, setIncludeData] = useState(true);
  const [includeViews, setIncludeViews] = useState(true);
  const [includeRoutines, setIncludeRoutines] = useState(true);
  const [includeTriggers, setIncludeTriggers] = useState(true);
  const [addDropTable, setAddDropTable] = useState(true);
  const [useTransaction, setUseTransaction] = useState(true);
  const [compressOutput, setCompressOutput] = useState(false);
  const [compressionLevel, setCompressionLevel] = useState(6);
  const [insertBatchSize, setInsertBatchSize] = useState(300);

  const [tables, setTables] = useState<string[]>([]);
  const [views, setViews] = useState<string[]>([]);
  const [routines, setRoutines] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [selectedViews, setSelectedViews] = useState<string[]>([]);
  const [selectedRoutines, setSelectedRoutines] = useState<string[]>([]);

  const [loadingObjects, setLoadingObjects] = useState(false);

  const targetDb = database || connectionProfile?.database || '';

  const subtitle = useMemo(() => {
    if (!connectionProfile || !targetDb) {
      return t('backupDialog.noTarget');
    }
    return t('backupDialog.target', {
      database: targetDb,
      host: connectionProfile.host,
    });
  }, [connectionProfile, targetDb, t]);

  const loadObjects = async () => {
    if (!connectionProfile || !targetDb) {
      return;
    }

    setLoadingObjects(true);
    try {
      const [tableList, viewList, routineList] = await Promise.all([
        useMetadataStore.getState().fetchTables(connectionProfile, targetDb),
        useMetadataStore.getState().fetchViews(connectionProfile, targetDb),
        useMetadataStore.getState().fetchRoutinesWithDetails(connectionProfile, targetDb),
      ]);
      setTables(tableList);
      setViews(viewList);
      setRoutines(routineList.map((item) => item.name));
      setSelectedTables(tableList);
      setSelectedViews(viewList);
      setSelectedRoutines(routineList.map((item) => item.name));
    } catch (error) {
      appendLog(t('backupDialog.loadObjectsFailed', { error: String(error) }));
    } finally {
      setLoadingObjects(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setOutputPath('');
    resetExecutionStatus(t('backupDialog.ready'));
    void loadObjects();
  }, [isOpen, connectionProfile, targetDb, t, resetExecutionStatus]);

  const pickOutput = async () => {
    const selected = await save({
      title: t('backupDialog.selectOutput'),
      defaultPath: `${targetDb || 'database'}_backup_${nowTimestamp()}.sql`,
      filters: [{ name: 'SQL', extensions: ['sql', 'gz'] }],
      canCreateDirectories: true,
    });

    if (!selected) {
      return;
    }

    setOutputPath(selected);
  };

  const toggleSelection = (name: string, current: string[], set: (next: string[]) => void) => {
    if (current.includes(name)) {
      set(current.filter((item) => item !== name));
      return;
    }
    set([...current, name]);
  };

  const runBackup = async () => {
    if (!connectionProfile || !targetDb) {
      return;
    }
    if (!outputPath.trim()) {
      setStatusText(t('backupDialog.missingOutput'));
      return;
    }

    const request: BackupRequest = {
      conn: connectionProfile,
      schema: targetDb,
      outputPath,
      selectedTables,
      selectedViews,
      selectedRoutines,
      options: {
        includeStructure,
        includeData,
        includeViews,
        includeRoutines,
        includeTriggers,
        addDropTable,
        useTransaction,
        compressOutput,
        compressionLevel,
        insertBatchSize,
      },
    };

    await executeBackup(request, outputPath);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('backupDialog.title')}
      icon="database"
      style={{ width: 1180, maxWidth: '96vw', maxHeight: '92vh' }}
    >
      <div className={cn(Classes.DIALOG_BODY, 'max-h-[70vh] overflow-auto')}>
        <div className={cn('mb-2.5 text-xs', theme === 'dark' ? 'text-[#9ca3af]' : 'text-[#5f6b7c]')}>{subtitle}</div>

        {!connectionProfile || !targetDb ? (
          <Callout intent={Intent.WARNING}>{t('backupDialog.missingContext')}</Callout>
        ) : (
          <>
            <section className={cn('mb-3.5 rounded-lg border p-3', theme === 'dark' ? 'border-[#374151] bg-[#1f2937]' : 'border-[#d8e1eb] bg-[#f8fbff]')}>
              <div className="mb-2.5 flex items-center justify-between">
                <h3 className={cn('m-0 mb-2.5 text-sm', theme === 'dark' ? 'text-[#e5e7eb]' : 'text-[#1f2d3d]')}>{t('backupDialog.outputTitle')}</h3>
                <Tag minimal>{targetDb}</Tag>
              </div>
              <div className="flex items-center gap-2.5 max-[900px]:flex-col max-[900px]:items-stretch">
                <InputGroup
                  value={outputPath}
                  onChange={(e) => setOutputPath(e.target.value)}
                  placeholder={t('backupDialog.outputPlaceholder')}
                />
                <Button onClick={pickOutput} disabled={isBusy}>{t('backup.browse')}</Button>
              </div>
            </section>

            <section className={cn('mb-3.5 rounded-lg border p-3', theme === 'dark' ? 'border-[#374151] bg-[#1f2937]' : 'border-[#d8e1eb] bg-[#f8fbff]')}>
              <h3 className={cn('m-0 mb-2.5 text-sm', theme === 'dark' ? 'text-[#e5e7eb]' : 'text-[#1f2d3d]')}>{t('backupDialog.objectsTitle')}</h3>
              <div className="mb-2 flex gap-2">
                <Button onClick={() => setSelectedTables(tables)} small>{t('backupDialog.selectAllTables')}</Button>
                <Button onClick={() => setSelectedTables([])} small>{t('backupDialog.clearTables')}</Button>
                <Button className="min-w-[72px] shrink-0 whitespace-nowrap" onClick={loadObjects} small disabled={loadingObjects || isBusy}>
                  {loadingObjects ? <Spinner size={14} /> : t('common.refresh')}
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2.5 max-[900px]:grid-cols-1">
                <div className={cn('flex min-h-[220px] flex-col rounded-md border', theme === 'dark' ? 'border-[#374151] bg-[#111827]' : 'border-[#d8e1eb] bg-white')}>
                  <div className={cn('border-b px-2.5 py-2 text-xs font-semibold', theme === 'dark' ? 'border-[#374151] text-[#d1d5db]' : 'border-[#eef3f8]')}>{t('backupDialog.tables')}</div>
                  <div className="overflow-auto px-2.5 py-2">
                    {tables.map((name) => (
                      <Checkbox
                        key={name}
                        checked={selectedTables.includes(name)}
                        onChange={() => toggleSelection(name, selectedTables, setSelectedTables)}
                        label={name}
                      />
                    ))}
                  </div>
                </div>
                <div className={cn('flex min-h-[220px] flex-col rounded-md border', theme === 'dark' ? 'border-[#374151] bg-[#111827]' : 'border-[#d8e1eb] bg-white')}>
                  <div className={cn('border-b px-2.5 py-2 text-xs font-semibold', theme === 'dark' ? 'border-[#374151] text-[#d1d5db]' : 'border-[#eef3f8]')}>{t('backupDialog.views')}</div>
                  <div className="overflow-auto px-2.5 py-2">
                    {views.map((name) => (
                      <Checkbox
                        key={name}
                        checked={selectedViews.includes(name)}
                        onChange={() => toggleSelection(name, selectedViews, setSelectedViews)}
                        label={name}
                        disabled={!includeViews}
                      />
                    ))}
                  </div>
                </div>
                <div className={cn('flex min-h-[220px] flex-col rounded-md border', theme === 'dark' ? 'border-[#374151] bg-[#111827]' : 'border-[#d8e1eb] bg-white')}>
                  <div className={cn('border-b px-2.5 py-2 text-xs font-semibold', theme === 'dark' ? 'border-[#374151] text-[#d1d5db]' : 'border-[#eef3f8]')}>{t('backupDialog.routines')}</div>
                  <div className="overflow-auto px-2.5 py-2">
                    {routines.map((name) => (
                      <Checkbox
                        key={name}
                        checked={selectedRoutines.includes(name)}
                        onChange={() => toggleSelection(name, selectedRoutines, setSelectedRoutines)}
                        label={name}
                        disabled={!includeRoutines}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className={cn('mb-3.5 rounded-lg border p-3', theme === 'dark' ? 'border-[#374151] bg-[#1f2937]' : 'border-[#d8e1eb] bg-[#f8fbff]')}>
              <h3 className={cn('m-0 mb-2.5 text-sm', theme === 'dark' ? 'text-[#e5e7eb]' : 'text-[#1f2d3d]')}>{t('backupDialog.optionsTitle')}</h3>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 max-[900px]:grid-cols-1">
                <Checkbox checked={includeStructure} onChange={(e) => setIncludeStructure((e.target as HTMLInputElement).checked)} label={t('backupDialog.includeStructure')} />
                <Checkbox checked={includeData} onChange={(e) => setIncludeData((e.target as HTMLInputElement).checked)} label={t('backupDialog.includeData')} />
                <Checkbox checked={includeViews} onChange={(e) => setIncludeViews((e.target as HTMLInputElement).checked)} label={t('backupDialog.includeViews')} />
                <Checkbox checked={includeRoutines} onChange={(e) => setIncludeRoutines((e.target as HTMLInputElement).checked)} label={t('backupDialog.includeRoutines')} />
                <Checkbox checked={includeTriggers} onChange={(e) => setIncludeTriggers((e.target as HTMLInputElement).checked)} label={t('backupDialog.includeTriggers')} />
                <Checkbox checked={addDropTable} onChange={(e) => setAddDropTable((e.target as HTMLInputElement).checked)} label={t('backupDialog.addDrop')} />
                <Checkbox checked={useTransaction} onChange={(e) => setUseTransaction((e.target as HTMLInputElement).checked)} label={t('backupDialog.transaction')} />
                <Checkbox checked={compressOutput} onChange={(e) => setCompressOutput((e.target as HTMLInputElement).checked)} label={t('backupDialog.compress')} />
              </div>

              <div className="flex flex-wrap gap-4">
                <FormGroup label={t('backupDialog.compressionLevel')} inline>
                  <HTMLSelect
                    value={compressionLevel}
                    onChange={(e) => setCompressionLevel(Number(e.target.value))}
                    disabled={!compressOutput}
                    options={Array.from({ length: 10 }, (_, i) => ({ label: `${i}`, value: i }))}
                  />
                </FormGroup>
                <FormGroup label={t('backupDialog.batchSize')} inline>
                  <InputGroup
                    value={String(insertBatchSize)}
                    onChange={(e) => setInsertBatchSize(Math.max(1, Number(e.target.value) || 1))}
                  />
                </FormGroup>
              </div>
            </section>

            <section className={cn('mb-3.5 rounded-lg border p-3', theme === 'dark' ? 'border-[#374151] bg-[#1f2937]' : 'border-[#d8e1eb] bg-[#f8fbff]')}>
              <h3 className={cn('m-0 mb-2.5 text-sm', theme === 'dark' ? 'text-[#e5e7eb]' : 'text-[#1f2d3d]')}>{t('backupDialog.logs')}</h3>
              <div className={cn(
                "min-h-[180px] max-h-[320px] overflow-auto whitespace-pre-wrap rounded-md border p-2 font-['Consolas','Courier_New',monospace] text-xs",
                theme === 'dark' ? 'border-[#374151] bg-[#111827] text-[#d1d5db]' : 'border-[#d8e1eb] bg-white',
              )}>{logs.length > 0 ? logs.join('\n') : t('backupDialog.noLogs')}</div>
            </section>
          </>
        )}
      </div>

      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <span className={cn('mr-auto text-xs', theme === 'dark' ? 'text-[#9ca3af]' : 'text-[#5f6b7c]')}>{statusText}</span>
          <Divider />
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            intent={Intent.PRIMARY}
            loading={isBusy}
            onClick={runBackup}
            disabled={!connectionProfile || !targetDb}
          >
            {t('backupDialog.start')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
