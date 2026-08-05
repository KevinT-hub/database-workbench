// lib/sql.ts —— SQL 字符串纯函数（无 React/Tauri 依赖）
// 从 useQueryExecution / resultViewShared / data-browser / usePreviewCommitAssociations 内联实现收敛。

const METADATA_MUTATION_SQL_PATTERN = /^\s*(create|alter|drop|truncate|rename)\b/i;
const DATABASE_LIST_MUTATION_SQL_PATTERN = /^\s*(create|drop)\s+database\b/i;
const QUALIFIED_DB_BACKTICK_PATTERN = /`([^`]+)`\s*\.\s*`[^`]+`/g;
const QUALIFIED_DB_PLAIN_PATTERN = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*`?[A-Za-z_][A-Za-z0-9_]*`?/g;

export const stripLeadingSqlComments = (sqlText: string): string => {
  let remaining = sqlText;

  while (remaining.length > 0) {
    remaining = remaining.replace(/^\s+/, '');

    if (remaining.startsWith('--')) {
      const lineEnd = remaining.indexOf('\n');
      remaining = lineEnd >= 0 ? remaining.slice(lineEnd + 1) : '';
      continue;
    }

    if (remaining.startsWith('#')) {
      const lineEnd = remaining.indexOf('\n');
      remaining = lineEnd >= 0 ? remaining.slice(lineEnd + 1) : '';
      continue;
    }

    if (remaining.startsWith('/*')) {
      const end = remaining.indexOf('*/');
      remaining = end >= 0 ? remaining.slice(end + 2) : '';
      continue;
    }

    break;
  }

  return remaining;
};

export const isLikelySingleStatementSql = (sql: string): boolean => {
  const normalized = sql.trim().replace(/;\s*$/, '');
  if (!normalized) {
    return false;
  }
  return !normalized.includes(';');
};

export const isQuerySqlLike = (sql: string): boolean => {
  const trimmed = sql.trim().toLowerCase();
  return trimmed.startsWith('select')
    || trimmed.startsWith('show')
    || trimmed.startsWith('describe')
    || trimmed.startsWith('desc')
    || trimmed.startsWith('explain')
    || trimmed.startsWith('with');
};

export const extractUseDatabaseFromStatement = (statement: string): string | undefined => {
  const trimmed = stripLeadingSqlComments(statement).trim().replace(/;+$/, '');
  const match = trimmed.match(/^use\s+(.+)$/i);
  if (!match) return undefined;

  const rawName = match[1].trim();
  if (!rawName) return undefined;

  if (rawName.startsWith('`') && rawName.endsWith('`')) {
    return rawName.slice(1, -1).replace(/``/g, '`').trim() || undefined;
  }

  return rawName.replace(/^['"]|['"]$/g, '').trim() || undefined;
};

export const isMetadataMutatingSql = (sql: string): boolean => {
  const normalized = sql.trim().replace(/;+\s*$/, '');
  if (!normalized) {
    return false;
  }
  return METADATA_MUTATION_SQL_PATTERN.test(normalized);
};

export const isDatabaseListMutatingSql = (sql: string): boolean => {
  const normalized = sql.trim().replace(/;+\s*$/, '');
  if (!normalized) {
    return false;
  }
  return DATABASE_LIST_MUTATION_SQL_PATTERN.test(normalized);
};

export const extractAffectedDatabasesFromDdl = (
  sql: string,
  fallbackDatabase?: string,
): string[] => {
  const result = new Set<string>();

  if (fallbackDatabase?.trim()) {
    result.add(fallbackDatabase.trim());
  }

  for (const match of sql.matchAll(QUALIFIED_DB_BACKTICK_PATTERN)) {
    const dbName = match[1]?.trim();
    if (dbName) result.add(dbName);
  }

  for (const match of sql.matchAll(QUALIFIED_DB_PLAIN_PATTERN)) {
    const dbName = match[1]?.trim();
    if (!dbName) continue;
    if (['new', 'old'].includes(dbName.toLowerCase())) continue;
    result.add(dbName);
  }

  return Array.from(result);
};

export const normalizeSqlForMessage = (sql: string): string => {
  return sql.trim().replace(/[;\s]+$/, '');
};

export const getSqlKeyword = (sql: string): string => {
  const stripped = sql
    .replace(/^\s*(?:--.*(?:\r?\n|$)|#.*(?:\r?\n|$)|\/\*[\s\S]*?\*\/\s*)*/g, '')
    .trim()
    .toLowerCase();
  const keyword = stripped.match(/^([a-z]+)/)?.[1];
  return keyword || '';
};

export const escapeSqlValue = (value: unknown, _typeName?: string): string => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  const strValue = String(value);
  const escaped = strValue.replace(/'/g, "''");
  return `'${escaped}'`;
};

export const escapeIdentifier = (name: string): string => {
  return `\`${name.replace(/`/g, '``')}\``;
};
