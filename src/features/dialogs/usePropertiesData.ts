import { useState, useEffect } from 'react';
import { useConnectionStore } from '@/stores';
import { poolApi } from '@/api';

export interface RealProperties {
  connectionStatus: boolean;
  serverVersion: string | null;
  currentDatabase: string | null;
  charset: string | null;
  waitTimeoutSeconds: number | null;
  sslMode: string | null;
  tableCount: number | null;
  viewCount: number | null;
  functionCount: number | null;
  procedureCount: number | null;
}

export const usePropertiesData = (isOpen: boolean) => {
  const [realProperties, setRealProperties] = useState<RealProperties | null>(null);
  const [loading, setLoading] = useState(false);
  const { connections, activeConnectionId, activeDatabase } = useConnectionStore();

  const activeConnection = connections.find((c) => c.profile.name === activeConnectionId);

  useEffect(() => {
    let cancelled = false;

    const loadProperties = async () => {
      if (!isOpen || !activeConnection?.poolId) {
        setRealProperties(null);
        return;
      }

      setLoading(true);
      try {
        const result = await poolApi.getConnectionProperties(
          activeConnection.poolId,
          activeDatabase ?? activeConnection.profile.database ?? null,
        );

        if (cancelled) return;

        setRealProperties({
          connectionStatus: result.connectionStatus,
          serverVersion: result.serverVersion ?? null,
          currentDatabase: result.currentDatabase ?? null,
          charset: result.connectionCharset ?? null,
          waitTimeoutSeconds: result.waitTimeoutSeconds ?? null,
          sslMode: result.sslMode ?? null,
          tableCount: result.tableCount ?? null,
          viewCount: result.viewCount ?? null,
          functionCount: result.functionCount ?? null,
          procedureCount: result.procedureCount ?? null,
        });
      } catch {
        if (cancelled) return;
        setRealProperties(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadProperties();

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    activeConnection?.isConnected,
    activeConnection?.poolId,
    activeConnection?.profile.database,
    activeDatabase,
  ]);

  return {
    activeConnection,
    activeDatabase,
    realProperties,
    loading,
  };
};
