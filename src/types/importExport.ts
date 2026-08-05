// 导入导出类型

export interface ExportResult {
  success: boolean;
  rowsExported: number;
  filePath: string;
  durationMs: number;
  error?: string;
}

export interface ImportResult {
  success: boolean;
  rowsImported: number;
  durationMs: number;
  error?: string;
}

// 统一格式（V2 从 useTauri.ts 迁入）
export type ExportFormat = 'csv' | 'txt' | 'json' | 'html' | 'xml' | 'sql' | 'jsonl' | 'xlsx';
export type ImportFormat = 'csv' | 'txt' | 'json' | 'xml' | 'sql';
