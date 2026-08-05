import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConnectionState } from '@/types';
import type { RealProperties } from './usePropertiesData';
import { PropertyItem, PropertyGroup } from './PropertyItems';

interface PanelProps {
  connection: ConnectionState;
  database?: string | null;
  realProperties: RealProperties | null;
}

/* ---------- GeneralPanel ---------- */
export const GeneralPanel: React.FC<PanelProps> = ({ connection, database, realProperties }) => {
  const { t } = useTranslation();
  const isConnected = realProperties?.connectionStatus ?? connection.isConnected;

  return (
    <div className="flex flex-col gap-6">
      <PropertyGroup title={t('propertiesDialog.groups.basicInfo')}>
        <PropertyItem label={t('propertiesDialog.labels.connectionName')} value={connection.profile.name} />
        <PropertyItem label={t('propertiesDialog.labels.connectionType')} value="MySQL" />
        <PropertyItem
          label={t('propertiesDialog.labels.currentStatus')}
          value={isConnected ? t('propertiesDialog.connected') : t('propertiesDialog.disconnected')}
        />
        <PropertyItem label={t('propertiesDialog.labels.currentDatabase')} value={database || t('propertiesDialog.notSelected')} />
      </PropertyGroup>

      <PropertyGroup title={t('propertiesDialog.groups.serverInfo')}>
        <PropertyItem label={t('propertiesDialog.labels.host')} value={connection.profile.host} />
        <PropertyItem label={t('propertiesDialog.labels.port')} value={connection.profile.port} />
        <PropertyItem label={t('propertiesDialog.labels.serverVersion')} value={realProperties?.serverVersion || t('propertiesDialog.unknown')} />
      </PropertyGroup>
    </div>
  );
};

/* ---------- ConnectionPanel ---------- */
interface ConnectionPanelProps {
  connection: ConnectionState;
  realProperties: RealProperties | null;
}

const getSslModeLabel = (value: string | null | undefined, t: (key: string) => string) => {
  if (!value) return t('propertiesDialog.unknown');
  const normalized = value.toLowerCase().replace(/_/g, '-');
  switch (normalized) {
    case 'disabled':
      return t('dialog.connection.sslModes.disabled');
    case 'preferred':
      return t('dialog.connection.sslModes.preferred');
    case 'required':
      return t('dialog.connection.sslModes.required');
    case 'verify-ca':
      return t('dialog.connection.sslModes.verify-ca');
    case 'verify-identity':
      return t('dialog.connection.sslModes.verify-identity');
    case 'enabled':
      return t('propertiesDialog.enabled');
    default:
      // 如果值看起来像 TLS cipher suite（包含 tls/sha/aes/gcm 等），说明后端返回了 cipher 而非 mode
      if (/tls|sha|aes|gcm|rsa|ecdsa/i.test(value)) {
        return t('propertiesDialog.enabled');
      }
      return value;
  }
};

export const ConnectionPanel: React.FC<ConnectionPanelProps> = ({ connection, realProperties }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      <PropertyGroup title={t('propertiesDialog.groups.connectionConfig')}>
        <PropertyItem label={t('propertiesDialog.labels.host')} value={connection.profile.host} />
        <PropertyItem label={t('propertiesDialog.labels.port')} value={connection.profile.port} />
        <PropertyItem label={t('propertiesDialog.labels.username')} value={connection.profile.username} />
        <PropertyItem label={t('propertiesDialog.labels.password')} value="hidden" isPassword isCopyable={false} />
        <PropertyItem label={t('propertiesDialog.labels.defaultDatabase')} value={connection.profile.database || t('propertiesDialog.notSet')} />
      </PropertyGroup>

      <PropertyGroup title={t('propertiesDialog.groups.connectionParams')}>
        <PropertyItem label={t('propertiesDialog.labels.charset')} value={realProperties?.charset || connection.profile.charset || t('propertiesDialog.unknown')} />
        <PropertyItem
          label={t('propertiesDialog.labels.connectionTimeout')}
          value={
            connection.profile.connectionTimeout != null
              ? `${connection.profile.connectionTimeout} ${t('propertiesDialog.seconds')}`
              : `30 ${t('propertiesDialog.seconds')}`
          }
        />
        <PropertyItem
          label={t('propertiesDialog.labels.timeout')}
          value={
            connection.profile.timeout != null
              ? `${connection.profile.timeout} ${t('propertiesDialog.seconds')}`
              : realProperties?.waitTimeoutSeconds != null
                ? `${realProperties.waitTimeoutSeconds} ${t('propertiesDialog.seconds')}`
                : `28800 ${t('propertiesDialog.seconds')}`
          }
        />
        <PropertyItem
          label={t('propertiesDialog.labels.sslMode')}
          value={getSslModeLabel(realProperties?.sslMode || connection.profile.sslMode, t)}
        />
      </PropertyGroup>
    </div>
  );
};

/* ---------- DatabasePanel ---------- */
export const DatabasePanel: React.FC<PanelProps> = ({ connection, database, realProperties }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      <PropertyGroup title={t('propertiesDialog.groups.databaseInfo')}>
        <PropertyItem label={t('propertiesDialog.labels.currentDatabase')} value={database || t('propertiesDialog.notSelected')} />
        <PropertyItem label={t('propertiesDialog.labels.databaseType')} value="MySQL" />
        <PropertyItem label={t('propertiesDialog.labels.charset')} value={realProperties?.charset || connection.profile.charset || t('propertiesDialog.unknown')} />
      </PropertyGroup>

      <PropertyGroup title={t('propertiesDialog.groups.statistics')}>
        <PropertyItem label={t('propertiesDialog.labels.tableCount')} value={realProperties?.tableCount ?? '-'} isCopyable={false} />
        <PropertyItem label={t('propertiesDialog.labels.viewCount')} value={realProperties?.viewCount ?? '-'} isCopyable={false} />
        <PropertyItem label={t('propertiesDialog.labels.procedureCount')} value={realProperties?.procedureCount ?? '-'} isCopyable={false} />
        <PropertyItem label={t('propertiesDialog.labels.functionCount')} value={realProperties?.functionCount ?? '-'} isCopyable={false} />
      </PropertyGroup>
    </div>
  );
};
