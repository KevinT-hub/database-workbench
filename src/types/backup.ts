// 备份/还原类型

import type { ConnectionProfile } from './connection';

export interface BackupOptions {
  includeStructure?: boolean;
  includeData: boolean;
  includeViews: boolean;
  includeRoutines: boolean;
  includeTriggers?: boolean;
  addDropTable: boolean;
  useTransaction?: boolean;
  compressOutput?: boolean;
  compressionLevel?: number;
  insertBatchSize?: number;
}

export interface BackupRequest {
  conn: ConnectionProfile;
  schema: string;
  outputPath: string;
  // Legacy field kept for compatibility with old tab UI.
  mysqldumpPath?: string;
  selectedTables?: string[];
  selectedViews?: string[];
  selectedRoutines?: string[];
  options: BackupOptions;
}

export interface RestoreRequest {
  conn: ConnectionProfile;
  targetSchema: string;
  // Legacy field kept for compatibility with old tab UI.
  mysqlPath?: string;
  inputPath: string;
  createSchema: boolean;
  continueOnError?: boolean;
  useTransaction?: boolean;
}

export interface ScheduleRequest {
  scheduleId: string;
  cron: string;
  backup: BackupRequest;
}

export interface BackupResult {
  outputPath: string;
  durationMs: number;
}

export interface RestoreResult {
  durationMs: number;
  statementsExecuted: number;
  errorCount: number;
}
