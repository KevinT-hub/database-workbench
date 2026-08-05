// 数据浏览（表/视图数据）共享纯工具：单元格格式化、SQL 转义、剪贴板、
// 导入导出文件名/过滤器、视图 Tab 标题/图标。

import type { ExportFormat } from '@/types';

// 保持既有导入路径兼容：通用工具已收敛到 lib/，此处仅透传导出。
export { formatCellValue } from '@/lib/format';
export { copyTextToClipboard } from '@/lib/dom';
export { escapeIdentifier, escapeSqlValue } from '@/lib/sql';

export const getFileExtension = (format: ExportFormat): string => {
  switch (format) {
    case 'csv': return 'csv';
    case 'txt': return 'txt';
    case 'json': return 'json';
    case 'html': return 'html';
    case 'xml': return 'xml';
    case 'sql': return 'sql';
    case 'jsonl': return 'jsonl';
    case 'xlsx': return 'xlsx';
    default: return 'csv';
  }
};

export const getFileFilter = (format: ExportFormat) => {
  const ext = getFileExtension(format);
  return [{ name: format.toUpperCase(), extensions: [ext] }];
};

/**
 * 构造“导出当前页”SQL：与数据页当前显示一致（含筛选与分页）。
 * 表/视图共用；后端 export_query_result 会重新执行该 SQL 并写出文件。
 */
export const buildCurrentPageSql = (
  database: string,
  objectName: string,
  filters: { where: string; groupBy: string; orderBy: string },
  offset: number,
  pageSize: number,
): string => {
  let sql = `SELECT * FROM \`${database}\`.\`${objectName}\``;
  if (filters.where.trim()) {
    sql += ` WHERE ${filters.where.trim()}`;
  }
  if (filters.groupBy.trim()) {
    sql += ` GROUP BY ${filters.groupBy.trim()}`;
  }
  if (filters.orderBy.trim()) {
    sql += ` ORDER BY ${filters.orderBy.trim()}`;
  }
  sql += ` LIMIT ${offset}, ${pageSize}`;
  return sql;
};
