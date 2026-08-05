// api/importExport.ts —— 导入/导出命令

import { invoke } from './client';
import type { ConnectionProfile } from '../types/connection';
import type {
  ExportResult,
  ImportResult,
  ExportFormat,
  ImportFormat,
} from '../types/importExport';

export const importApi = {
  fromCsv: (
    profile: ConnectionProfile,
    database: string,
    table: string,
    filePath: string,
  ): Promise<ImportResult> =>
    invoke<ImportResult>('import_from_csv', {
      profile,
      schema: database,
      table,
      inputPath: filePath,
    }),

  fromJson: (
    profile: ConnectionProfile,
    database: string,
    table: string,
    filePath: string,
  ): Promise<ImportResult> =>
    invoke<ImportResult>('import_from_json', {
      profile,
      schema: database,
      table,
      inputPath: filePath,
    }),

  fromJsonl: (
    profile: ConnectionProfile,
    database: string,
    table: string,
    filePath: string,
  ): Promise<ImportResult> =>
    invoke<ImportResult>('import_from_jsonl', {
      profile,
      schema: database,
      table,
      inputPath: filePath,
    }),

  // 统一格式导入
  importTable: (
    profile: ConnectionProfile,
    database: string,
    table: string,
    filePath: string,
    format: ImportFormat,
  ): Promise<ImportResult> =>
    invoke<ImportResult>('import_table', {
      profile,
      schema: database,
      table,
      inputPath: filePath,
      format,
    }),
};

export const exportApi = {
  toCsv: (
    profile: ConnectionProfile,
    database: string,
    table: string,
    filePath: string,
  ): Promise<ExportResult> =>
    invoke<ExportResult>('export_to_csv', {
      profile,
      schema: database,
      table,
      outputPath: filePath,
    }),

  toJsonl: (
    profile: ConnectionProfile,
    database: string,
    table: string,
    filePath: string,
  ): Promise<ExportResult> =>
    invoke<ExportResult>('export_to_jsonl', {
      profile,
      sql: `SELECT * FROM \`${database}\`.\`${table}\``,
      outputPath: filePath,
    }),

  // 统一格式导出
  exportTable: (
    profile: ConnectionProfile,
    database: string,
    table: string,
    filePath: string,
    format: ExportFormat,
  ): Promise<ExportResult> =>
    invoke<ExportResult>('export_table', {
      profile,
      schema: database,
      table,
      outputPath: filePath,
      format,
    }),

  // 导出查询结果（V2：后端重新执行 SQL）
  exportQueryResult: (
    profile: ConnectionProfile,
    sql: string,
    format: ExportFormat,
    outputPath: string,
    schema?: string,
    table?: string,
  ): Promise<ExportResult> =>
    invoke<ExportResult>('export_query_result', {
      profile,
      sql,
      format,
      outputPath,
      schema: schema ?? null,
      table: table ?? null,
    }),
};
