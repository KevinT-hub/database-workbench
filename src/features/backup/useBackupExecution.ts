// useBackupExecution.ts —— 备份执行状态机 hook
//
// 收敛 BackupDialog 内联的执行状态（busy/status/logs）与 backupApi.execute 调用，
// 组件不再直接 import api 模块（阶段 3：API 调用统一化）。

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { backupApi } from '@/api';
import type { BackupRequest } from '@/types';

export const useBackupExecution = () => {
  const { t, i18n } = useTranslation();
  const [isBusy, setIsBusy] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  const appendLog = useCallback(
    (line: string) => {
      const locale = i18n.language === 'zh-CN' ? 'zh-CN' : 'en-US';
      const timestamp = new Date().toLocaleTimeString(locale, { hour12: false });
      setLogs((prev) => [...prev, `[${timestamp}] ${line}`]);
    },
    [i18n.language],
  );

  const resetExecutionStatus = useCallback((readyText: string) => {
    setStatusText(readyText);
    setLogs([]);
  }, []);

  const executeBackup = useCallback(
    async (request: BackupRequest, outputPath: string) => {
      setIsBusy(true);
      setStatusText(t('backupDialog.running'));
      setLogs([]);
      appendLog(t('backupDialog.starting', { path: outputPath }));

      try {
        const result = await backupApi.execute(request);
        setStatusText(t('backupDialog.success'));
        appendLog(t('backupDialog.done', { time: result.durationMs }));
        appendLog(t('backupDialog.output', { path: result.outputPath }));
      } catch (error) {
        setStatusText(t('backupDialog.failed'));
        appendLog(t('backupDialog.error', { error: String(error) }));
      } finally {
        setIsBusy(false);
      }
    },
    [t, appendLog],
  );

  return {
    isBusy,
    statusText,
    logs,
    setStatusText,
    appendLog,
    resetExecutionStatus,
    executeBackup,
  };
};
