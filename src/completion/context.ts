// completion/context.ts —— 上下文感知补全：缓存、语句解析、建议生成

import type * as monaco from 'monaco-editor';
import { useMetadataStore } from '@/stores';
import type { ConnectionProfile, MetadataRecord } from '@/types';

// ─── 类型定义 ───

export interface CompletionContext {
  profile: ConnectionProfile;
  database?: string;
}

export interface SQLMetadataChangedDetail {
  source?: string;
  profile?: ConnectionProfile;
  database?: string;
  databases?: string[];
  invalidateDatabasesList?: boolean;
  clearAll?: boolean;
}

export interface TableRef {
  database?: string;
  table: string;
}

interface StatementContext {
  clause: 'select' | 'from' | 'groupBy' | 'generic';
  statementSql: string;
  beforeCursorSql: string;
  tableRefs: TableRef[];
  aliasMap: Map<string, TableRef>;
  selectedFields: string[];
  hasSelectStar: boolean;
  cteNames: Set<string>;
  cteFieldMap: Map<string, string[]>;
  localRelationNames: Set<string>;
}

interface DotCompletionContext {
  qualifierParts: string[];
}

interface StatementWindow {
  statementSql: string;
  beforeCursorSql: string;
}

// ─── 缓存状态 ───

const modelCompletionContext = new Map<string, CompletionContext>();
const modelContextDisposeListeners = new Map<string, monaco.IDisposable>();

// ─── 上下文管理 ───

export function getCompletionContextForModel(model: monaco.editor.ITextModel): CompletionContext | null {
  return modelCompletionContext.get(model.uri.toString()) || null;
}

export function setCompletionContextForModel(model: monaco.editor.ITextModel | null, context: CompletionContext | null): void {
  if (!model) return;

  const modelKey = model.uri.toString();
  if (context) {
    modelCompletionContext.set(modelKey, context);

    if (!modelContextDisposeListeners.has(modelKey)) {
      const disposeListener = model.onWillDispose(() => {
        modelCompletionContext.delete(modelKey);
        const listener = modelContextDisposeListeners.get(modelKey);
        listener?.dispose();
        modelContextDisposeListeners.delete(modelKey);
      });
      modelContextDisposeListeners.set(modelKey, disposeListener);
    }
    return;
  }

  modelCompletionContext.delete(modelKey);
  const listener = modelContextDisposeListeners.get(modelKey);
  listener?.dispose();
  modelContextDisposeListeners.delete(modelKey);
}

// ─── 缓存失效 ───

export function invalidateSQLCompletionMetadataCache(detail?: SQLMetadataChangedDetail): void {
  if (!detail || detail.clearAll) {
    clearSQLCompletionMetadataCache();
    return;
  }

  const profile = detail.profile;
  if (!profile) {
    clearSQLCompletionMetadataCache();
    return;
  }

  const store = useMetadataStore.getState();
  if (detail.invalidateDatabasesList) {
    // 数据库列表属于 profile 级缓存，失效 profile 作用域即可覆盖
    store.invalidate(profile);
  }

  const databases = new Set<string>();
  if (typeof detail.database === 'string' && detail.database.trim()) {
    databases.add(detail.database.trim());
  }
  if (Array.isArray(detail.databases)) {
    detail.databases.forEach((db) => {
      if (typeof db === 'string' && db.trim()) {
        databases.add(db.trim());
      }
    });
  }

  if (databases.size > 0) {
    databases.forEach((db) => store.invalidate(profile, db));
  }
}

export function clearSQLCompletionMetadataCache(): void {
  useMetadataStore.getState().invalidateAll();
}

// ─── 元数据加载 ───

function parseColumnNames(rows: MetadataRecord[]): string[] {
  return rows
    .map((row) => row.COLUMN_NAME)
    .filter((name): name is string => typeof name === 'string' && name.length > 0);
}

export async function loadDatabasesForContext(context: CompletionContext): Promise<string[]> {
  return useMetadataStore.getState().fetchDatabases(context.profile);
}

export async function loadTablesForContext(context: CompletionContext): Promise<string[]> {
  if (!context.database) return [];
  return useMetadataStore.getState().fetchTables(context.profile, context.database);
}

export async function loadTablesForDatabase(context: CompletionContext, database: string): Promise<string[]> {
  if (!database) return [];
  return useMetadataStore.getState().fetchTables(context.profile, database);
}

export async function loadColumnsForTable(
  context: CompletionContext,
  tableRef: TableRef
): Promise<string[]> {
  const targetDatabase = tableRef.database || context.database;
  if (!targetDatabase || !tableRef.table) return [];
  const rows = await useMetadataStore.getState().fetchColumns(
    context.profile,
    targetDatabase,
    tableRef.table,
  );
  return parseColumnNames(rows);
}

// ─── 标识符解析工具 ───

function normalizePart(part: string): string {
  const trimmed = part.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('`') && trimmed.endsWith('`') && trimmed.length >= 2) {
    return trimmed.slice(1, -1).replace(/``/g, '`').trim();
  }

  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1).replace(/""/g, '"').trim();
  }

  return trimmed;
}

function splitQualifiedIdentifier(input: string): string[] {
  const result: string[] = [];
  let current = '';
  let inBacktick = false;
  let inDoubleQuote = false;

  for (let index = 0; index < input.length; index += 1) {
    const ch = input[index];

    if (ch === '`' && !inDoubleQuote) {
      inBacktick = !inBacktick;
      current += ch;
      continue;
    }

    if (ch === '"' && !inBacktick) {
      inDoubleQuote = !inDoubleQuote;
      current += ch;
      continue;
    }

    if (ch === '.' && !inBacktick && !inDoubleQuote) {
      result.push(normalizePart(current));
      current = '';
      continue;
    }

    current += ch;
  }

  if (current.length > 0) {
    result.push(normalizePart(current));
  }

  return result.filter((part) => part.length > 0);
}

function parseTableRef(raw: string): TableRef | null {
  const parts = splitQualifiedIdentifier(raw);
  if (parts.length === 0) return null;

  if (parts.length === 1) {
    return { table: parts[0] };
  }

  return {
    database: parts[parts.length - 2],
    table: parts[parts.length - 1],
  };
}

function tableRefKey(tableRef: TableRef): string {
  return `${(tableRef.database || '').toLowerCase()}|${tableRef.table.toLowerCase()}`;
}

function quoteIdentifier(name: string): string {
  return `\`${name.replace(/`/g, '``')}\``;
}

function buildQualifiedTableName(tableRef: TableRef): string {
  if (tableRef.database) {
    return `${quoteIdentifier(tableRef.database)}.${quoteIdentifier(tableRef.table)}`;
  }
  return quoteIdentifier(tableRef.table);
}

function normalizeIdentifier(identifier: string): string {
  const parts = splitQualifiedIdentifier(identifier);
  if (parts.length === 0) return '';
  return parts[parts.length - 1];
}

// ─── 语句解析 ───

function extractStatementWindow(fullSql: string, cursorOffset: number): StatementWindow {
  let start = 0;
  for (let index = cursorOffset - 1; index >= 0; index -= 1) {
    if (fullSql[index] === ';') {
      start = index + 1;
      break;
    }
  }

  let end = fullSql.length;
  for (let index = cursorOffset; index < fullSql.length; index += 1) {
    if (fullSql[index] === ';') {
      end = index;
      break;
    }
  }

  const statementSql = fullSql.slice(start, end);
  const statementCursorOffset = Math.max(0, Math.min(statementSql.length, cursorOffset - start));
  const beforeCursorSql = statementSql.slice(0, statementCursorOffset);

  return {
    statementSql,
    beforeCursorSql,
  };
}

function splitTopLevelByComma(input: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;

  for (let index = 0; index < input.length; index += 1) {
    const ch = input[index];

    if (ch === '\\') {
      current += ch;
      if (index + 1 < input.length) {
        index += 1;
        current += input[index];
      }
      continue;
    }

    if (!inDoubleQuote && !inBacktick && ch === '\'') {
      inSingleQuote = !inSingleQuote;
      current += ch;
      continue;
    }

    if (!inSingleQuote && !inBacktick && ch === '"') {
      inDoubleQuote = !inDoubleQuote;
      current += ch;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && ch === '`') {
      inBacktick = !inBacktick;
      current += ch;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && !inBacktick) {
      if (ch === '(') depth += 1;
      if (ch === ')' && depth > 0) depth -= 1;

      if (ch === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
        continue;
      }
    }

    current += ch;
  }

  if (current.trim().length > 0) {
    parts.push(current.trim());
  }

  return parts;
}

function extractSelectedFields(statementSql: string): { fields: string[]; hasStar: boolean } {
  const match = statementSql.match(/\bselect\b([\s\S]*?)(\bfrom\b|$)/i);
  if (!match) {
    return { fields: [], hasStar: false };
  }

  const selectList = match[1] || '';
  const hasStar = /(^|\s|,)\*(\s|,|$)/.test(selectList) || /\w+\.\*/.test(selectList);
  if (hasStar) {
    return { fields: [], hasStar: true };
  }

  const fields = splitTopLevelByComma(selectList)
    .map((segment) => {
      const asMatch = segment.match(/\bas\s+([`"\w$]+)$/i);
      if (asMatch) {
        return normalizeIdentifier(asMatch[1]);
      }

      const simpleAlias = segment.match(/([`"\w$]+)$/);
      const core = simpleAlias ? simpleAlias[1] : segment;
      return normalizeIdentifier(core);
    })
    .filter((field) => field.length > 0);

  return { fields, hasStar };
}

function extractCteNames(statementSql: string): Set<string> {
  const cteNames = new Set<string>();
  const withMatch = statementSql.match(/^\s*with\s+([\s\S]+)/i);
  if (!withMatch) return cteNames;

  const regex = /([`"\w$]+)\s+as\s*\(/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(statementSql)) !== null) {
    const cteName = normalizeIdentifier(match[1]);
    if (cteName) {
      cteNames.add(cteName.toLowerCase());
    }
  }

  return cteNames;
}

function extractCteFieldMap(statementSql: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const regex = /([`"\w$]+)\s+as\s*\(\s*select\s+([\s\S]*?)\s+from[\s\S]*?\)/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(statementSql)) !== null) {
    const cteName = normalizeIdentifier(match[1]).toLowerCase();
    const selectList = match[2] || '';
    const fields = splitTopLevelByComma(selectList)
      .map((segment) => {
        const asMatch = segment.match(/\bas\s+([`"\w$]+)$/i);
        if (asMatch) return normalizeIdentifier(asMatch[1]);
        const tail = segment.match(/([`"\w$]+)$/);
        return normalizeIdentifier(tail ? tail[1] : segment);
      })
      .filter((field) => field.length > 0);

    if (cteName && fields.length > 0) {
      map.set(cteName, fields);
    }
  }

  return map;
}

function extractDerivedTableAliases(statementSql: string): Set<string> {
  const aliases = new Set<string>();
  const regex = /\b(?:from|join)\s*\([\s\S]*?\)\s*(?:as\s+)?([`"\w$]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(statementSql)) !== null) {
    const alias = normalizeIdentifier(match[1]);
    if (alias) aliases.add(alias.toLowerCase());
  }
  return aliases;
}

function extractTableAliasMap(statementSql: string): Map<string, TableRef> {
  const aliasMap = new Map<string, TableRef>();
  const regex = /\b(?:from|join|update|into)\s+([^\s,()]+)(?:\s+(?:as\s+)?([`"\w$]+))?/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(statementSql)) !== null) {
    const tableRef = parseTableRef(match[1] || '');
    if (!tableRef) continue;
    const rawAlias = normalizeIdentifier(match[2] || '');

    aliasMap.set(tableRef.table.toLowerCase(), tableRef);
    if (rawAlias) {
      aliasMap.set(rawAlias.toLowerCase(), tableRef);
    }
  }

  return aliasMap;
}

function collectStatementTables(aliasMap: Map<string, TableRef>): TableRef[] {
  const values = new Map<string, TableRef>();
  aliasMap.forEach((tableRef) => {
    values.set(tableRefKey(tableRef), tableRef);
  });
  return Array.from(values.values());
}

function detectClauseContext(beforeCursorSql: string): StatementContext['clause'] {
  const normalized = beforeCursorSql.toLowerCase();
  if (/\bgroup\s+by\s+[^;]*$/i.test(normalized)) return 'groupBy';
  if (/\b(from|join|update|into|table|describe|desc|truncate)\s+[^;]*$/i.test(normalized)) return 'from';
  if (/\bselect\b[\s\S]*$/i.test(normalized) && !/\bfrom\b/i.test(normalized)) return 'select';
  return 'generic';
}

function extractDotCompletionContext(beforeCursorSql: string): DotCompletionContext | null {
  const trimmedRight = beforeCursorSql.replace(/\s+$/, '');
  if (!trimmedRight.endsWith('.')) return null;

  const source = trimmedRight.slice(0, -1);
  let index = source.length - 1;
  while (index >= 0) {
    const ch = source[index];
    const isBreak = /[\s,;()+\-*/=%<>!]/.test(ch);
    if (isBreak) break;
    index -= 1;
  }

  const token = source.slice(index + 1);
  const parts = splitQualifiedIdentifier(token);
  if (parts.length === 0) return null;

  return { qualifierParts: parts };
}

export function buildStatementContext(statementSql: string, beforeCursorSql: string): StatementContext {
  const aliasMap = extractTableAliasMap(statementSql);
  const tableRefs = collectStatementTables(aliasMap);
  const selectedFieldInfo = extractSelectedFields(statementSql);
  const cteNames = extractCteNames(statementSql);
  const cteFieldMap = extractCteFieldMap(statementSql);
  const derivedAliases = extractDerivedTableAliases(statementSql);
  const localRelationNames = new Set<string>([...cteNames, ...derivedAliases]);

  return {
    clause: detectClauseContext(beforeCursorSql),
    statementSql,
    beforeCursorSql,
    tableRefs,
    aliasMap,
    selectedFields: selectedFieldInfo.fields,
    hasSelectStar: selectedFieldInfo.hasStar,
    cteNames,
    cteFieldMap,
    localRelationNames,
  };
}

export function extractStatementWindowForExport(fullSql: string, cursorOffset: number): StatementWindow {
  return extractStatementWindow(fullSql, cursorOffset);
}

export function extractDotCompletionContextForExport(beforeCursorSql: string): DotCompletionContext | null {
  return extractDotCompletionContext(beforeCursorSql);
}

// ─── 建议创建 ───

export function createTableSuggestions(
  monaco: typeof import('monaco-editor'),
  tables: string[],
  range: monaco.IRange,
  priority: number,
  database?: string,
  withDatabasePrefix: boolean = false
): monaco.languages.CompletionItem[] {
  return tables.map((table) => ({
    label: withDatabasePrefix && database ? `${database}.${table}` : table,
    kind: monaco.languages.CompletionItemKind.Class,
    insertText: withDatabasePrefix && database
      ? `${quoteIdentifier(database)}.${quoteIdentifier(table)}`
      : quoteIdentifier(table),
    detail: database ? `Table (${database})` : 'Table',
    range,
    sortText: `${String(priority).padStart(2, '0')}_table_${(database || '').toLowerCase()}_${table.toLowerCase()}`,
  }));
}

export function createDatabaseSuggestions(
  monaco: typeof import('monaco-editor'),
  databases: string[],
  range: monaco.IRange,
  priority: number,
  appendDot: boolean
): monaco.languages.CompletionItem[] {
  return databases.map((database) => ({
    label: database,
    kind: monaco.languages.CompletionItemKind.Module,
    insertText: appendDot ? `${quoteIdentifier(database)}.` : quoteIdentifier(database),
    detail: 'Database',
    range,
    sortText: `${String(priority).padStart(2, '0')}_db_${database.toLowerCase()}`,
  }));
}

export function createColumnSuggestions(
  monaco: typeof import('monaco-editor'),
  tableRef: TableRef,
  columns: string[],
  range: monaco.IRange,
  useQualifiedName: boolean,
  priority: number
): monaco.languages.CompletionItem[] {
  const tableDisplay = tableRef.database ? `${tableRef.database}.${tableRef.table}` : tableRef.table;
  return columns.map((column) => ({
    label: column,
    kind: monaco.languages.CompletionItemKind.Field,
    insertText: useQualifiedName
      ? `${buildQualifiedTableName(tableRef)}.${quoteIdentifier(column)}`
      : quoteIdentifier(column),
    detail: `Column (${tableDisplay})`,
    range,
    sortText: `${String(priority).padStart(2, '0')}_col_${tableDisplay.toLowerCase()}_${column.toLowerCase()}`,
  }));
}

export function createSelectedFieldSuggestions(
  monaco: typeof import('monaco-editor'),
  selectedFields: string[],
  range: monaco.IRange,
  priority: number
): monaco.languages.CompletionItem[] {
  return selectedFields.map((field) => ({
    label: field,
    kind: monaco.languages.CompletionItemKind.Field,
    insertText: field,
    detail: 'Selected field',
    range,
    sortText: `${String(priority).padStart(2, '0')}_selected_${field.toLowerCase()}`,
  }));
}

export function createLocalRelationSuggestions(
  monaco: typeof import('monaco-editor'),
  names: string[],
  range: monaco.IRange,
  priority: number
): monaco.languages.CompletionItem[] {
  return names.map((name) => ({
    label: name,
    kind: monaco.languages.CompletionItemKind.Variable,
    insertText: quoteIdentifier(name),
    detail: 'CTE/Derived relation',
    range,
    sortText: `${String(priority).padStart(2, '0')}_local_${name.toLowerCase()}`,
  }));
}

export function dedupeSuggestions(
  suggestions: monaco.languages.CompletionItem[]
): monaco.languages.CompletionItem[] {
  const seen = new Set<string>();
  const result: monaco.languages.CompletionItem[] = [];

  suggestions.forEach((item) => {
    const label = typeof item.label === 'string' ? item.label : item.label.label;
    const key = `${label}:${item.kind ?? ''}:${item.insertText}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(item);
  });

  return result;
}
