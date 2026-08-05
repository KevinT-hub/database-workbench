// 应用全局类型

export type Theme = 'light' | 'dark';


// 执行日志
export type ExecutionLogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface ExecutionLogItem {
  id: string;
  level: ExecutionLogLevel;
  message: string;
  timestamp: number;
}

export interface ExecutionLogPayload {
  /** 与后端 services/session_log.rs::ExecutionLogEntry 序列化字段一致（camelCase） */
  timestampMs: number;
  poolId: number;
  connId: number;
  sql: string;
  durationMs: number;
  affectedRows: number;
  isWrite: boolean;
}
