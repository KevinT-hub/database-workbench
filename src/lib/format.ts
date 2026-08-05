// lib/format.ts —— 纯格式化工具（无 React/Tauri 依赖）
// 从 resultViewShared / UpdateDialog / DatabaseObjectTab 等内联实现收敛而来。

export const formatBytes = (bytes?: number): string => {
  if (bytes === undefined || bytes === null) return '-';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const formatSeconds = (seconds?: number): string => {
  if (seconds === undefined || Number.isNaN(seconds)) {
    return '0.000';
  }
  return Math.max(0, seconds).toFixed(3);
};

export const formatDateTime = (iso?: string): string => {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
};

export const formatReleaseDate = (raw: string): string => {
  const timestamp = Date.parse(raw);
  if (Number.isNaN(timestamp)) {
    return raw;
  }
  return new Date(timestamp).toLocaleDateString();
};

export const formatCellValue = (value: unknown): string => {
  if (value === null || value === undefined) return '(NULL)';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};
