// 连接相关类型

export type DbType = 'MYSQL' | 'POSTGRESQL' | 'SQL_SERVER' | 'ORACLE' | 'SQLITE';

export interface ConnectionProfile {
  name?: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database?: string;
  // 扩展连接配置
  charset?: string;
  collation?: string;
  timeout?: number; // 空闲超时（wait_timeout），默认 28800 秒（8小时）
  connectionTimeout?: number; // 连接超时，默认 30 秒
  ssl?: boolean;
  sslMode?: 'disabled' | 'preferred' | 'required' | 'verify-ca' | 'verify-identity';
  sslCaPath?: string;
  sslCertPath?: string;
  sslKeyPath?: string;
}

export interface PoolStats {
  poolId: number;
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  maxSize: number;
  waitingThreads: number;
  /** 连接池生命周期统计（V2 审计新增） */
  totalPoolCreates: number;
  totalPoolReuses: number;
  totalConnAcquires: number;
  totalConnReleases: number;
}

export interface ConnectionProperties {
  connectionStatus: boolean;
  serverVersion?: string | null;
  currentDatabase?: string | null;
  connectionCharset?: string | null;
  waitTimeoutSeconds?: number | null;
  sslMode?: string | null;
  tableCount?: number | null;
  viewCount?: number | null;
  functionCount?: number | null;
  procedureCount?: number | null;
}

export interface ConnectionState {
  profile: ConnectionProfile;
  poolId?: number;
  isConnected: boolean;
  isConnecting: boolean;
  error?: string;
}
