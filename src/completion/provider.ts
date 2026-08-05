// completion/provider.ts —— Monaco CompletionItemProvider 注册

import type * as monaco from 'monaco-editor';
import { getMonacoInstance, getEditorSettings } from '@/lib/editorSettings';

import { SQL_KEYWORDS, SQL_DATA_TYPES, ROUTINE_KEYWORDS } from './keywords';
import { SQL_FUNCTIONS } from './functions';
import {
  type CompletionContext,
  type SQLMetadataChangedDetail,
  type TableRef,
  getCompletionContextForModel,
  setCompletionContextForModel,
  clearSQLCompletionMetadataCache,
  invalidateSQLCompletionMetadataCache,
  loadDatabasesForContext,
  loadTablesForContext,
  loadTablesForDatabase,
  loadColumnsForTable,
  buildStatementContext,
  extractStatementWindowForExport,
  extractDotCompletionContextForExport,
  createTableSuggestions,
  createDatabaseSuggestions,
  createColumnSuggestions,
  createSelectedFieldSuggestions,
  createLocalRelationSuggestions,
  dedupeSuggestions,
} from './context';

// 透传 context.ts 中的缓存清理函数，供 barrel 导出

let completionProviderDisposable: monaco.IDisposable | null = null;
let enableRoutineKeywordsFlag: boolean = false;

/**
 * 注册 SQL 自动补全提供程序
 */
export function registerSQLCompletionProvider(
  monaco: typeof import('monaco-editor'),
  enableRoutineKeywords: boolean = false
): void {
  // 保存配置
  enableRoutineKeywordsFlag = enableRoutineKeywords;

  // 如果已经注册，先注销
  unregisterSQLCompletionProvider();

  completionProviderDisposable = monaco.languages.registerCompletionItemProvider('sql', {
    triggerCharacters: ['.', ' ', '(', ','],
    provideCompletionItems: async (model, position) => {
      const context = getCompletionContextForModel(model);
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: monaco.languages.CompletionItem[] = [];

      const fullSql = model.getValue();
      const cursorOffset = model.getOffsetAt(position);
      const statementWindow = extractStatementWindowForExport(fullSql, cursorOffset);
      const statementContext = buildStatementContext(
        statementWindow.statementSql,
        statementWindow.beforeCursorSql,
      );
      const dotContext = extractDotCompletionContextForExport(statementWindow.beforeCursorSql);

      const keywordPriority = statementContext.clause === 'from' ? 40 : statementContext.clause === 'select' ? 30 : statementContext.clause === 'groupBy' ? 28 : 20;
      const functionPriority = statementContext.clause === 'select' ? 14 : 24;
      const dataTypePriority = statementContext.clause === 'from' ? 45 : 26;

      // 添加关键字补全
      SQL_KEYWORDS.forEach((keyword) => {
        suggestions.push({
          label: keyword,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: keyword + ' ',
          range,
          sortText: `${String(keywordPriority).padStart(2, '0')}_keyword_${keyword.toLowerCase()}`,
        });
      });

      // 添加函数补全
      SQL_FUNCTIONS.forEach((func) => {
        suggestions.push({
          label: {
            label: func.name + '()',
            description: func.desc,
          },
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: func.snippet,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: func.desc,
          range,
          sortText: `${String(functionPriority).padStart(2, '0')}_func_${func.name.toLowerCase()}`,
        });
      });

      // 添加数据类型补全
      SQL_DATA_TYPES.forEach((type) => {
        suggestions.push({
          label: type,
          kind: monaco.languages.CompletionItemKind.TypeParameter,
          insertText: type,
          range,
          sortText: `${String(dataTypePriority).padStart(2, '0')}_type_${type.toLowerCase()}`,
        });
      });

      // 添加存储过程/函数关键字（可选）
      if (enableRoutineKeywordsFlag) {
        ROUTINE_KEYWORDS.forEach((keyword) => {
          suggestions.push({
            label: keyword,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: keyword + ' ',
            range,
            sortText: `34_routine_${keyword.toLowerCase()}`,
          });
        });
      }

      if (context?.database) {
        try {
          if (dotContext) {
            const parts = dotContext.qualifierParts;

            if (parts.length >= 2) {
              const tableRef: TableRef = {
                database: parts[parts.length - 2],
                table: parts[parts.length - 1],
              };
              const columns = await loadColumnsForTable(context, tableRef);
              suggestions.push(...createColumnSuggestions(monaco, tableRef, columns, range, false, 2));
            } else {
              const qualifier = parts[0];
              const aliasRef = statementContext.aliasMap.get(qualifier.toLowerCase());

              if (aliasRef) {
                const qualifierKey = qualifier.toLowerCase();
                if (statementContext.cteFieldMap.has(qualifierKey)) {
                  const cteFields = statementContext.cteFieldMap.get(qualifierKey) || [];
                  const cteTableRef: TableRef = { table: qualifier };
                  suggestions.push(...createColumnSuggestions(monaco, cteTableRef, cteFields, range, false, 1));
                } else if (!statementContext.localRelationNames.has(aliasRef.table.toLowerCase())) {
                  const columns = await loadColumnsForTable(context, aliasRef);
                  suggestions.push(...createColumnSuggestions(monaco, aliasRef, columns, range, false, 2));
                }
              } else {
                const tablesInQualifierDb = await loadTablesForDatabase(context, qualifier);
                if (tablesInQualifierDb.length > 0) {
                  suggestions.push(
                    ...createTableSuggestions(monaco, tablesInQualifierDb, range, 3, qualifier, false)
                  );
                }
              }
            }
          } else {
            if (statementContext.localRelationNames.size > 0) {
              const localNames = Array.from(statementContext.localRelationNames);
              const localPriority = statementContext.clause === 'from' ? 2 : 9;
              suggestions.push(...createLocalRelationSuggestions(monaco, localNames, range, localPriority));
            }

            if (statementContext.clause === 'from') {
              const tables = await loadTablesForContext(context);
              suggestions.push(...createTableSuggestions(monaco, tables, range, 4));

              const databases = await loadDatabasesForContext(context);
              suggestions.push(...createDatabaseSuggestions(monaco, databases, range, 6, true));
            }

            if (statementContext.clause === 'groupBy' && !statementContext.hasSelectStar && statementContext.selectedFields.length > 0) {
              suggestions.push(
                ...createSelectedFieldSuggestions(monaco, statementContext.selectedFields, range, 1)
              );
            }

            if (statementContext.tableRefs.length > 0) {
              const columnResults = await Promise.all(statementContext.tableRefs.map(async (tableRef) => {
                const tableKey = tableRef.table.toLowerCase();
                if (statementContext.cteFieldMap.has(tableKey)) {
                  return {
                    tableRef,
                    columns: statementContext.cteFieldMap.get(tableKey) || [],
                  };
                }

                if (statementContext.localRelationNames.has(tableKey)) {
                  return {
                    tableRef,
                    columns: [] as string[],
                  };
                }

                return {
                  tableRef,
                  columns: await loadColumnsForTable(context, tableRef),
                };
              }));

              const columnPriority = statementContext.clause === 'groupBy'
                ? 3
                : statementContext.clause === 'select'
                  ? 2
                  : 12;

              columnResults.forEach(({ tableRef, columns }) => {
                if (columns.length === 0) return;
                suggestions.push(...createColumnSuggestions(monaco, tableRef, columns, range, false, columnPriority));
              });
            }
          }
        } catch {
          // 忽略元数据查找失败，仍保留基础关键字 / 函数补全功能可用
        }
      }

      return { suggestions: dedupeSuggestions(suggestions) };
    },
  });
}

/**
 * 将 SQL 自动补全上下文绑定到指定编辑器实例
 */
export function setSQLCompletionContextForEditor(
  editorInstance: monaco.editor.IStandaloneCodeEditor,
  context: CompletionContext | null,
): void {
  setCompletionContextForModel(editorInstance.getModel(), context);
}

/**
 * 清理指定编辑器实例绑定的 SQL 自动补全上下文
 */
export function clearSQLCompletionContextForEditor(editorInstance: monaco.editor.IStandaloneCodeEditor): void {
  setCompletionContextForModel(editorInstance.getModel(), null);
}

/**
 * 通知 SQL 元数据发生变更，触发补全缓存按需失效
 */
export function notifySQLMetadataChanged(detail?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('dbw:metadata-changed', { detail }));
}

if (
  typeof window !== 'undefined' &&
  !(window as Window & { __dbwSqlCompletionCacheHooked?: boolean }).__dbwSqlCompletionCacheHooked
) {
  window.addEventListener('dbw:global-refresh', clearSQLCompletionMetadataCache);
  window.addEventListener('dbw:metadata-changed', ((event: Event) => {
    const detail = (event as CustomEvent<SQLMetadataChangedDetail>).detail;
    invalidateSQLCompletionMetadataCache(detail);
  }) as EventListener);
  (window as Window & { __dbwSqlCompletionCacheHooked?: boolean }).__dbwSqlCompletionCacheHooked = true;
}

/**
 * 注销 SQL 自动补全提供程序
 */
function unregisterSQLCompletionProvider(): void {
  if (completionProviderDisposable) {
    completionProviderDisposable.dispose();
    completionProviderDisposable = null;
  }
}

/**
 * 根据设置更新自动补全状态
 */
export function updateCompletionProviderState(): void {
  const monaco = getMonacoInstance();
  if (!monaco) return;

  const settings = getEditorSettings();
  const isRegistered = isCompletionProviderRegistered();

  if (settings.editorAutoComplete && !isRegistered) {
    // 开启自动补全
    registerSQLCompletionProvider(monaco, enableRoutineKeywordsFlag);
  } else if (!settings.editorAutoComplete && isRegistered) {
    // 关闭自动补全
    unregisterSQLCompletionProvider();
  }
}

/**
 * 检查自动补全是否已启用
 */
function isCompletionProviderRegistered(): boolean {
  return completionProviderDisposable !== null;
}