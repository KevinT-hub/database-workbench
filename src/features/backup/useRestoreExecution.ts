// useRestoreExecution.ts —— 还原执行状态机 hook
//
// 收敛 RestoreDialog 内联的执行状态（busy/status/logs）与 backupApi.restore 调用，
// 组件不再直接 import api 模块（阶段 3：API 调用统一化）。

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { backupApi } from '@/api';
import type { RestoreRequest } from '@/types';

export const useRestoreExecution = () => {
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

  const executeRestore = useCallback(
    async (request: RestoreRequest) => {
      setIsBusy(true);
      setStatusText(t('restoreDialog.running'));
      setLogs([]);
      appendLog(t('restoreDialog.preparing'));
      appendLog(t('restoreDialog.script', { path: request.inputPath }));

      try {
        const result = await backupApi.restore(request);
        setStatusText(t('restoreDialog.success'));
        appendLog(t('restoreDialog.done', { time: result.durationMs }));
        appendLog(t('restoreDialog.statementsExecuted', { count: result.statementsExecuted }));
        appendLog(t('restoreDialog.errorCount', { count: result.errorCount }));
      } catch (error) {
        setStatusText(t('restoreDialog.failed'));
        appendLog(t('restoreDialog.error', { error: String(error) }));
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
    executeRestore,
  };
};
