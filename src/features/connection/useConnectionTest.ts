// useConnectionTest.ts —— 连接测试 hook
//
// 收敛 ConnectionDialog 内联的测试状态与 poolApi.testConnection 调用，
// 组件不再直接 import api 模块（阶段 3：API 调用统一化）。

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { poolApi } from '@/api/pool';
import type { ConnectionProfile } from '@/types';

interface ConnectionTestResult {
  success: boolean;
  message: string;
}

export const useConnectionTest = () => {
  const { t } = useTranslation();
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  const handleTestConnection = useCallback(
    async (profile: ConnectionProfile) => {
      setIsTesting(true);
      setTestResult(null);

      try {
        const success = await poolApi.testConnection(profile);

        if (success) {
          setTestResult({ success: true, message: t('dialog.connection.testSuccess') });
        } else {
          setTestResult({ success: false, message: t('dialog.connection.testFailed') });
        }
      } catch (error) {
        setTestResult({ success: false, message: String(error) });
      } finally {
        setIsTesting(false);
      }
    },
    [t],
  );

  const resetTestResult = useCallback(() => {
    setTestResult(null);
  }, []);

  return {
    isTesting,
    testResult,
    handleTestConnection,
    resetTestResult,
  };
};
