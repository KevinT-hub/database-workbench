import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Button,
  InputGroup,
  Spinner,
  HTMLSelect,
  Checkbox,
  Dialog,
  Classes,
  Callout,
  Intent,
  Tabs,
  Tab,
  TextArea,
} from '@blueprintjs/core';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useTranslation } from 'react-i18next';
import type { ConnectionProfile, RoutineParamInfo, QueryResultData } from '@/types';
import { useAppStore, useMetadataStore } from '@/stores';
import {
  registerSQLCompletionProvider,
  updateCompletionProviderState,
  notifySQLMetadataChanged,
  setSQLCompletionContextForEditor,
  clearSQLCompletionContextForEditor,
} from '@/completion';
import { registerEditor, unregisterEditor, getEditorSettings, applySettingsToAllEditors } from '@/lib/editorSettings';
import { useFunctionPool } from './useFunctionPool';
import { useFunctionDesignerActions } from './useFunctionDesignerActions';
import { useFunctionExecutor } from './useFunctionExecutor';
import { cn } from '@/lib/cn';

interface FunctionDesignerTabProps {
  tabId: string;
  connectionProfile: ConnectionProfile;
  database: string;
  functionName?: string;
  functionType?: 'FUNCTION' | 'PROCEDURE';
  autoExecute?: boolean;
}

const RefreshIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
    <path d="M14 8A6 6 0 1 1 8 2v2a4 4 0 1 0 4 4h-2l3-3 3 3h-2z" />
  </svg>
);

const SaveIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
    <path d="M2 2v12h12V5l-3-3H2zm2 0h6v4h4v8H4V2z" />
  </svg>
);

const PlayIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
    <polygon points="4,2 14,8 4,14" />
  </svg>
);

export const FunctionDesignerTab: React.FC<FunctionDesignerTabProps> = ({
  tabId: _tabId,
  connectionProfile,
  database,
  functionName: initialFunctionName,
  functionType: initialFunctionType = 'FUNCTION',
  autoExecute = false,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initialFunctionName || '');
  const [type, setType] = useState<'FUNCTION' | 'PROCEDURE'>(initialFunctionType);
  const [returnType, setReturnType] = useState('INT');
  const [isDeterministic, setIsDeterministic] = useState(false);
  const [comment, setComment] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState(t('functionTab.status.ready'));
  const [isNew, setIsNew] = useState(!initialFunctionName);
  const [savedName, setSavedName] = useState<string | null>(initialFunctionName || null);
  
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false);
  const [executeParams, setExecuteParams] = useState<RoutineParamInfo[]>([]);
  const [executeParamValues, setExecuteParamValues] = useState<Record<string, string>>({});
  const [executeResults, setExecuteResults] = useState<QueryResultData[]>([]);
  const [executeMessage, setExecuteMessage] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeResultTab, setActiveResultTab] = useState<string>('message');
  const [activeResultSetIndex, setActiveResultSetIndex] = useState<number>(0);
  
  const { poolId, connId } = useFunctionPool(connectionProfile);
  const { dropRoutine, executeRoutineSql } = useFunctionDesignerActions({ connectionProfile, database });
  const { runRoutine } = useFunctionExecutor({ poolId, connId, savedName, type, database });

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const { theme } = useAppStore();

  const generateTemplate = useCallback((funcName: string, funcType: 'FUNCTION' | 'PROCEDURE', retType: string, deterministic: boolean, funcComment: string) => {
    const escapedName = funcName || (funcType === 'FUNCTION' ? '<function_name>' : '<procedure_name>');
    const commentClause = funcComment ? ` COMMENT '${funcComment.replace(/'/g, "''")}'` : '';
    const deterministicClause = deterministic ? 'DETERMINISTIC' : 'NOT DETERMINISTIC';
    
    if (funcType === 'FUNCTION') {
      return `DELIMITER //

CREATE FUNCTION \`${database}\`.\`${escapedName}\`(
    param1 ${retType},
    param2 VARCHAR(255)
)
RETURNS ${retType}
${deterministicClause}
${commentClause}
BEGIN
    DECLARE result ${retType};
    
    ${t('functionTab.template.functionComment')}
    SET result = param1 + 1;
    
    RETURN result;
END //

DELIMITER ;`;
    } else {
      // 存储过程不需要 DETERMINISTIC 子句
      return `DELIMITER //

CREATE PROCEDURE \`${database}\`.\`${escapedName}\`(
    IN param1 INT,
    IN param2 VARCHAR(255),
    OUT result VARCHAR(255)
)
${commentClause}
BEGIN
    ${t('functionTab.template.procedureComment')}
    SET result = CONCAT('Processed: ', param2);
    
END //

DELIMITER ;`;
    }
  }, [database, t]);

  const syncRoutineNameInCode = useCallback((sqlCode: string, routineName: string) => {
    if (!sqlCode) return sqlCode;

    const fallbackName = type === 'FUNCTION' ? '<function_name>' : '<procedure_name>';
    const targetName = routineName.trim() || fallbackName;
    const escapedTargetName = targetName.replace(/`/g, '``');

    const placeholderRegex = /<function_name>|<procedure_name>/g;
    if (placeholderRegex.test(sqlCode)) {
      return sqlCode.replace(placeholderRegex, targetName);
    }

    const createHeaderRegex = /(CREATE\s+(?:DEFINER\s*=\s*`[^`]+`@`[^`]+`\s+)?(?:FUNCTION|PROCEDURE)\s+)(`[^`]+`\.)?`[^`]*`/i;
    if (createHeaderRegex.test(sqlCode)) {
      return sqlCode.replace(createHeaderRegex, (_, prefix: string, schemaPart: string | undefined) => {
        const targetSchemaPart = schemaPart ?? `\`${database}\`.`;
        return `${prefix}${targetSchemaPart}\`${escapedTargetName}\``;
      });
    }

    return sqlCode;
  }, [database, type]);

  const syncRoutineCommentInCode = useCallback((sqlCode: string, routineComment: string) => {
    if (!sqlCode) return sqlCode;

    const normalizedComment = routineComment.trim();
    const escapedComment = normalizedComment.replace(/'/g, "''");
    const nextClause = normalizedComment ? `\nCOMMENT '${escapedComment}'` : '';
    const commentClauseRegex = /\n\s*COMMENT\s+'(?:''|[^'])*'/i;

    if (commentClauseRegex.test(sqlCode)) {
      return sqlCode.replace(commentClauseRegex, nextClause);
    }

    if (!normalizedComment) {
      return sqlCode;
    }

    if (/\n\s*BEGIN\b/i.test(sqlCode)) {
      return sqlCode.replace(/\n\s*BEGIN\b/i, `${nextClause}\nBEGIN`);
    }

    return sqlCode;
  }, []);

  const syncFunctionReturnTypeInCode = useCallback((sqlCode: string, routineReturnType: string) => {
    if (!sqlCode || type !== 'FUNCTION') return sqlCode;

    const normalizedReturnType = routineReturnType.trim();
    if (!normalizedReturnType) {
      return sqlCode;
    }

    const returnsClauseRegex = /(\n\s*RETURNS\s+)([^\n]+)/i;
    if (returnsClauseRegex.test(sqlCode)) {
      return sqlCode.replace(returnsClauseRegex, `$1${normalizedReturnType}`);
    }

    const insertionClause = `\nRETURNS ${normalizedReturnType}`;
    const afterParamsRegex = /(\n\s*\)\s*)/;
    if (afterParamsRegex.test(sqlCode)) {
      return sqlCode.replace(afterParamsRegex, `$1${insertionClause}`);
    }

    return sqlCode;
  }, [type]);

  const syncFunctionDeterministicInCode = useCallback((sqlCode: string, deterministic: boolean) => {
    if (!sqlCode || type !== 'FUNCTION') return sqlCode;

    const targetClause = deterministic ? 'DETERMINISTIC' : 'NOT DETERMINISTIC';
    const deterministicClauseRegex = /\n\s*(?:NOT\s+)?DETERMINISTIC\b/i;

    if (deterministicClauseRegex.test(sqlCode)) {
      return sqlCode.replace(deterministicClauseRegex, `\n${targetClause}`);
    }

    if (/\n\s*RETURNS\b/i.test(sqlCode)) {
      return sqlCode.replace(/(\n\s*RETURNS\s+[^\n]+)(?=\n)/i, `$1\n${targetClause}`);
    }

    if (/\n\s*BEGIN\b/i.test(sqlCode)) {
      return sqlCode.replace(/\n\s*BEGIN\b/i, `\n${targetClause}\nBEGIN`);
    }

    return sqlCode;
  }, [type]);

  const loadFunction = useCallback(async () => {
    if (!connectionProfile || !database || !initialFunctionName) return;

    setIsLoading(true);
    setError(null);
    setStatusMessage(t('functionTab.status.loading'));

    try {
      const ddl = await useMetadataStore.getState().getFunctionDdl(connectionProfile, database, initialFunctionName, initialFunctionType);
      if (ddl) {
        setCode(ddl);
        
        const commentMatch = ddl.match(/COMMENT\s+'([^']*)'/i);
        if (commentMatch) {
          setComment(commentMatch[1].replace(/''/g, "'"));
        }
        
        setIsDeterministic(ddl.toUpperCase().includes('DETERMINISTIC') && !ddl.toUpperCase().includes('NOT DETERMINISTIC'));
        
        if (initialFunctionType === 'FUNCTION') {
          const returnsMatch = ddl.match(/RETURNS\s+(\w+(?:\([^)]+\))?)/i);
          if (returnsMatch) {
            setReturnType(returnsMatch[1]);
          }
        }
        
        setStatusMessage(t('functionTab.status.loadComplete'));
      } else {
        setError(t('functionTab.errors.loadFailed', { type: initialFunctionType === 'FUNCTION' ? t('functionTab.types.function') : t('functionTab.types.procedure') }));
        setStatusMessage(t('functionTab.status.loadFailed'));
      }
    } catch (err) {
      setError(t('functionTab.errors.loadError', { type: initialFunctionType === 'FUNCTION' ? t('functionTab.types.function') : t('functionTab.types.procedure'), error: err }));
      setStatusMessage(t('functionTab.status.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [connectionProfile, database, initialFunctionName, initialFunctionType, t]);

  // 初始加载时生成模板（仅执行一次）
  useEffect(() => {
    if (initialFunctionName) {
      loadFunction();
    } else {
      // 新建模式：只生成一次初始模板
      setCode(generateTemplate('', type, returnType, isDeterministic, comment));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFunctionName]);

  // 名称变化时，同步更新 CREATE 头部中的对象名
  useEffect(() => {
    setCode((previousCode) => {
      const newCode = syncRoutineNameInCode(previousCode, name);
      return newCode === previousCode ? previousCode : newCode;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, type, syncRoutineNameInCode]);

  // 注释变化时，同步更新 SQL 中的 COMMENT 子句
  useEffect(() => {
    setCode((previousCode) => {
      const newCode = syncRoutineCommentInCode(previousCode, comment);
      return newCode === previousCode ? previousCode : newCode;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comment, syncRoutineCommentInCode]);

  // 返回类型变化时，同步更新 SQL 中的 RETURNS 子句
  useEffect(() => {
    if (type !== 'FUNCTION') return;

    setCode((previousCode) => {
      const newCode = syncFunctionReturnTypeInCode(previousCode, returnType);
      return newCode === previousCode ? previousCode : newCode;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returnType, type, syncFunctionReturnTypeInCode]);

  // 确定性变化时，同步更新 SQL 中的 DETERMINISTIC 子句
  useEffect(() => {
    if (type !== 'FUNCTION') return;

    setCode((previousCode) => {
      const newCode = syncFunctionDeterministicInCode(previousCode, isDeterministic);
      return newCode === previousCode ? previousCode : newCode;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDeterministic, type, syncFunctionDeterministicInCode]);

  useEffect(() => {
    if (autoExecute && savedName && !isNew) {
      handleExecute();
    }
  }, [autoExecute, savedName, isNew]);

  const [editorSettings, setEditorSettings] = useState(getEditorSettings());

  const handleEditorMount = useCallback((
    editorInstance: editor.IStandaloneCodeEditor,
    monaco: typeof import('monaco-editor'),
  ) => {
    editorRef.current = editorInstance;
    // 注册编辑器到全局管理器
    registerEditor(editorInstance, monaco);
    // 启用自动补全（包含存储过程/函数特有关键字）
    if (editorSettings.editorAutoComplete) {
      registerSQLCompletionProvider(monaco, true);
    }
    setSQLCompletionContextForEditor(editorInstance, { profile: connectionProfile, database });

    return () => {
      clearSQLCompletionContextForEditor(editorInstance);
      unregisterEditor(editorInstance);
    };
  }, [connectionProfile, database, editorSettings.editorAutoComplete]);

  // 监听设置变更事件，即时响应所有设置
  useEffect(() => {
    const handleSettingsChanged = () => {
      const newSettings = getEditorSettings();
      setEditorSettings(newSettings);
      // 应用设置到所有编辑器
      applySettingsToAllEditors();
      // 更新自动补全状态
      updateCompletionProviderState();
    };

    window.addEventListener('dbw:settings-changed', handleSettingsChanged as EventListener);
    return () => {
      window.removeEventListener('dbw:settings-changed', handleSettingsChanged as EventListener);
    };
  }, []);

  const handleCodeChange = useCallback((newValue: string | undefined) => {
    if (newValue !== undefined) {
      setCode(newValue);
      setError(null);
      setSuccess(null);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setError(t('functionTab.errors.enterName', { type: type === 'FUNCTION' ? t('functionTab.types.function') : t('functionTab.types.procedure') }));
      return;
    }

    if (!code.trim()) {
      setError(t('functionTab.errors.enterCode', { type: type === 'FUNCTION' ? t('functionTab.types.function') : t('functionTab.types.procedure') }));
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    setStatusMessage(t('functionTab.status.saving'));

    try {
      let finalCode = code;
      if (isNew) {
        finalCode = code.replace(/<function_name>|<procedure_name>/g, name);
      }

      // 修改已有对象时先 DROP（单独一次调用，确保 DROP 成功后再 CREATE）
      // 使用全限定名 `db`.`name`，避免依赖当前数据库上下文
      if (!isNew && savedName) {
        await dropRoutine(type, savedName);
      }

      // 一次性提交完整代码（含 DELIMITER 指令），后端 mysql_user::execute_sql
      // 使用 split_statements_mysql（DELIMITER 感知）正确切分 BEGIN...END 复合块，
      // 并在专用事务连接上执行（修复 1046）+ raw_sql（修复 prepared statement 1295）
      await executeRoutineSql(finalCode);

      setSuccess(t('functionTab.success.saved', { type: type === 'FUNCTION' ? t('functionTab.types.function') : t('functionTab.types.procedure') }));
      setStatusMessage(t('functionTab.status.saveSuccess'));
      setIsNew(false);
      setSavedName(name);
      notifySQLMetadataChanged({
        source: 'function-designer',
        profile: connectionProfile,
        databases: [database],
        routineType: type,
        routineName: name,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(t('functionTab.errors.saveError', { error: errMsg }));
      setStatusMessage(t('functionTab.status.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  }, [name, type, code, isNew, savedName, connectionProfile, database, t, dropRoutine, executeRoutineSql]);

  const handleExecute = useCallback(async () => {
    if (!savedName) {
      setError(t('functionTab.errors.executeSaveFirst'));
      return;
    }

    setExecuteDialogOpen(true);
    setIsExecuting(true);
    setExecuteResults([]);
    setExecuteMessage(null);
    setExecuteParamValues({});
    setActiveResultSetIndex(0);

    try {
      const params = await useMetadataStore.getState().getRoutineParams(connectionProfile, database, savedName);
      setExecuteParams(params);
      
      if (params.length === 0 && autoExecute) {
        await performExecute(params, {});
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setExecuteMessage(t('functionTab.errors.loadParamsFailed', { error: errMsg }));
    } finally {
      setIsExecuting(false);
    }
  }, [connectionProfile, database, savedName, autoExecute, t]);

  const performExecute = useCallback(async (params: RoutineParamInfo[], values: Record<string, string>) => {
    if (!poolId || !connId || !savedName) return;

    setIsExecuting(true);
    setExecuteResults([]);
    setExecuteMessage(null);
    setActiveResultSetIndex(0);

    try {
      const results = await runRoutine(params, values);

      setExecuteResults(results);
      
      if (results.length === 0) {
        setExecuteMessage(t('functionTab.execute.success', { count: 0 }));
      } else if (results.length === 1) {
        setExecuteMessage(t('functionTab.execute.success', { count: results[0].rows.length }));
      } else {
        const totalRows = results.reduce((sum, r) => sum + r.rows.length, 0);
        setExecuteMessage(t('functionTab.execute.multiResultSuccess', { 
          setCount: results.length, 
          totalRows 
        }));
      }
      setActiveResultTab('data');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setExecuteMessage(t('functionTab.execute.failed', { error: errMsg }));
      setActiveResultTab('message');
    } finally {
      setIsExecuting(false);
    }
  }, [poolId, connId, savedName, runRoutine, t]);

  const handleParamValueChange = useCallback((paramName: string, value: string) => {
    setExecuteParamValues(prev => ({ ...prev, [paramName]: value }));
  }, []);

  const getModeColor = (mode?: string): string => {
    switch (mode) {
      case 'IN': return '#28a745';
      case 'OUT': return '#dc3545';
      case 'INOUT': return '#fd7e14';
      case 'RETURN': return '#6f42c1';
      default: return '#6c757d';
    }
  };

  const handleRefresh = useCallback(() => {
    if (!isNew && savedName) {
      loadFunction();
    }
  }, [isNew, savedName, loadFunction]);

  if (isLoading) {
    return (
      <div className={cn('flex h-full flex-col items-center justify-center gap-3', theme === 'dark' ? 'text-[#a0a0a0]' : 'text-[#666]')}>
        <Spinner size={32} />
        <span>{t('functionTab.loading', { type: type === 'FUNCTION' ? t('functionTab.types.function') : t('functionTab.types.procedure') })}</span>
      </div>
    );
  }

  return (
    <div className={cn('flex h-full flex-col', theme === 'dark' ? 'bg-[#1e1e1e]' : 'bg-white')}>
      <div className={cn(
        'flex items-center gap-1 border-b px-3 py-2',
        theme === 'dark' ? 'border-[#3c3c3c] bg-[#252526]' : 'border-[#e0e0e0] bg-[#f8f9fa]',
      )}>
        <Button
          minimal
          small
          icon={<RefreshIcon size={14} />}
          onClick={handleRefresh}
          disabled={isNew}
          title={t('functionTab.toolbar.refresh')}
        >
          {t('functionTab.toolbar.refresh')}
        </Button>
        <Button
          minimal
          small
          icon="add"
          onClick={() => {
            setIsNew(true);
            setName('');
            setSavedName(null);
            setCode(generateTemplate('', type, returnType, isDeterministic, comment));
          }}
          title={t('functionTab.toolbar.new')}
        >
          {t('functionTab.toolbar.new')}
        </Button>
        {!isNew && savedName && (
          <Button
            minimal
            small
            icon={<PlayIcon size={14} />}
            onClick={handleExecute}
            title={t('functionTab.toolbar.execute')}
          >
            {t('functionTab.toolbar.execute')}
          </Button>
        )}
        <Button
          minimal
          small
          icon={<SaveIcon size={14} />}
          onClick={handleSave}
          loading={isSaving}
          intent="primary"
          title={t('functionTab.toolbar.save')}
        >
          {t('functionTab.toolbar.save')}
        </Button>
      </div>

      {error && (
        <Callout intent={Intent.DANGER} className="mx-3 my-2">
          {error}
        </Callout>
      )}

      {success && (
        <Callout intent={Intent.SUCCESS} className="mx-3 my-2">
          {success}
        </Callout>
      )}

      <div className="flex min-h-0 flex-1">
        <div className={cn(
          'w-[280px] min-w-[250px] overflow-y-auto border-r p-4',
          theme === 'dark' ? 'border-[#3c3c3c] bg-[#252526]' : 'border-[#e0e0e0] bg-[#fafafa]',
        )}>
          <div className="mb-4">
            <label className={cn('mb-1.5 block text-xs font-medium', theme === 'dark' ? 'text-[#a0a0a0]' : 'text-[#666]')}>{t('functionTab.properties.name')}</label>
            <InputGroup
              className="w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'FUNCTION' ? t('functionTab.properties.placeholders.functionName') : t('functionTab.properties.placeholders.procedureName')}
            />
          </div>

          <div className="mb-4">
            <label className={cn('mb-1.5 block text-xs font-medium', theme === 'dark' ? 'text-[#a0a0a0]' : 'text-[#666]')}>{t('functionTab.properties.type')}</label>
            <HTMLSelect
              className="w-full"
              value={type}
              onChange={(e) => {
                const newType = e.target.value as 'FUNCTION' | 'PROCEDURE';
                setType(newType);
                // 新建模式切换类型时重新生成模板，避免函数/存储过程语句混杂
                setCode(generateTemplate(name, newType, returnType, isDeterministic, comment));
              }}
              disabled={!isNew}
            >
              <option value="FUNCTION">{t('functionTab.types.function')}</option>
              <option value="PROCEDURE">{t('functionTab.types.procedure')}</option>
            </HTMLSelect>
          </div>

          {type === 'FUNCTION' && (
            <div className="mb-4">
              <label className={cn('mb-1.5 block text-xs font-medium', theme === 'dark' ? 'text-[#a0a0a0]' : 'text-[#666]')}>{t('functionTab.properties.returnType')}</label>
              <InputGroup
                className="w-full"
                value={returnType}
                onChange={(e) => setReturnType(e.target.value)}
                placeholder={t('functionTab.properties.placeholders.returnType')}
              />
            </div>
          )}

          {type === 'FUNCTION' && (
            <div className="mb-4">
              <label className={cn('mb-1.5 block text-xs font-medium', theme === 'dark' ? 'text-[#a0a0a0]' : 'text-[#666]')}>{t('functionTab.properties.deterministic')}</label>
              <Checkbox
                checked={isDeterministic}
                onChange={(e) => setIsDeterministic(e.target.checked)}
                label="DETERMINISTIC"
              />
            </div>
          )}

          <div className="mb-4">
            <label className={cn('mb-1.5 block text-xs font-medium', theme === 'dark' ? 'text-[#a0a0a0]' : 'text-[#666]')}>{t('functionTab.properties.comment')}</label>
            <TextArea
              className="w-full"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={type === 'FUNCTION' ? t('functionTab.properties.placeholders.functionComment') : t('functionTab.properties.placeholders.procedureComment')}
              rows={3}
              fill
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <label className={cn(
            'border-b px-3 py-2 text-xs font-medium',
            theme === 'dark' ? 'border-[#3c3c3c] text-[#a0a0a0]' : 'border-[#e0e0e0] text-[#666]',
          )}>{t('functionTab.editor.label')}</label>
          <div className="min-h-[300px] flex-1">
            <Editor
              height="100%"
              defaultLanguage="sql"
              value={code}
              onChange={handleCodeChange}
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: editorSettings.editorMinimap },
                lineNumbers: 'on',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                readOnly: isSaving,
                fontSize: editorSettings.editorFontSize,
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                lineHeight: 22,
                padding: { top: 10, bottom: 10 },
                automaticLayout: true,
                wordWrap: 'off',
                tabSize: editorSettings.editorTabSize,
                insertSpaces: true,
                folding: true,
                foldingHighlight: true,
                showFoldingControls: 'always',
                matchBrackets: 'always',
                autoIndent: 'full',
                formatOnPaste: true,
                formatOnType: false,
                suggestOnTriggerCharacters: true,
                quickSuggestions: {
                  other: true,
                  comments: false,
                  strings: false,
                },
                quickSuggestionsDelay: 180,
                wordBasedSuggestions: 'currentDocument',
                parameterHints: { enabled: true },
                hover: { enabled: true },
                contextmenu: true,
                smoothScrolling: true,
                cursorBlinking: 'blink',
                cursorSmoothCaretAnimation: 'explicit',
                selectionHighlight: true,
                occurrencesHighlight: 'singleFile',
                renderLineHighlight: 'all',
                renderWhitespace: 'selection',
                guides: {
                  bracketPairs: true,
                  indentation: true,
                },
              }}
              theme={theme === 'dark' ? 'vs-dark' : 'vs'}
            />
          </div>
        </div>
      </div>

      <div className={cn(
        'border-t px-3 py-1.5 text-xs',
        theme === 'dark' ? 'border-[#3c3c3c] bg-[#252526] text-[#a0a0a0]' : 'border-[#e0e0e0] bg-[#f0f0f0] text-[#666]',
      )}>
        <span>{statusMessage}</span>
      </div>

      <Dialog
        isOpen={executeDialogOpen}
        onClose={() => setExecuteDialogOpen(false)}
        title={t('functionTab.executeDialog.title', { type: type === 'FUNCTION' ? t('functionTab.types.function') : t('functionTab.types.procedure'), name: savedName })}
        className="!w-[700px] !max-w-[90vw]"
      >
        <div className={Classes.DIALOG_BODY}>
          <div className="mb-4">
            <label className="mb-2 block text-sm font-semibold">{t('functionTab.executeDialog.params')}</label>
            {isExecuting ? (
              <div className={cn('flex items-center gap-2 p-4', theme === 'dark' ? 'text-[#a0a0a0]' : 'text-[#666]')}>
                <Spinner size={24} />
                <span>{t('functionTab.executeDialog.loadingParams')}</span>
              </div>
            ) : executeParams.length === 0 ? (
              <div className={cn(
                'rounded p-3 italic',
                theme === 'dark' ? 'bg-[rgba(110,231,183,0.1)] text-[#6ee7b7]' : 'bg-[rgba(40,167,69,0.1)] text-[#28a745]',
              )}>
                {t('functionTab.executeDialog.noParams')}
              </div>
            ) : (
              <div className={cn(
                'flex max-h-[200px] flex-col gap-2 overflow-y-auto rounded p-2',
                theme === 'dark' ? 'bg-[#252526]' : 'bg-[#f8f9fa]',
              )}>
                {executeParams.map((param) => (
                  <div
                    key={param.name}
                    className={cn(
                      'grid grid-cols-[100px_60px_120px_1fr] items-center gap-2 rounded border px-2 py-1.5',
                      theme === 'dark' ? 'border-[#3c3c3c] bg-[#1e1e1e]' : 'border-[#e0e0e0] bg-white',
                    )}
                  >
                    <span className="text-[13px] font-medium">{param.name}</span>
                    <span 
                      className="text-[11px] font-semibold uppercase"
                      style={{ color: getModeColor(param.mode) }}
                    >
                      {param.mode || 'IN'}
                    </span>
                    <span className={cn('text-[11px]', theme === 'dark' ? 'text-[#a0a0a0]' : 'text-[#666]')}>{param.type}</span>
                    {param.mode !== 'OUT' && (
                      <InputGroup
                        value={executeParamValues[param.name] || ''}
                        onChange={(e) => handleParamValueChange(param.name, e.target.value)}
                        placeholder={t('functionTab.executeDialog.placeholder', { type: param.type })}
                        small
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-semibold">{t('functionTab.executeDialog.result')}</label>
            <Tabs
              id="execute-result-tabs"
              selectedTabId={activeResultTab}
              onChange={(id) => setActiveResultTab(id as string)}
            >
              <Tab
                id="message"
                title={t('functionTab.executeDialog.tabs.message')}
                panel={
                  <div className={cn(
                    "min-h-[100px] whitespace-pre-wrap rounded p-3 font-['JetBrains_Mono','Fira_Code','Consolas',monospace] text-[13px]",
                    theme === 'dark' ? 'bg-[#1e1e1e] text-[#f3f4f6]' : 'bg-[#f8f9fa] text-[#495057]',
                  )}>
                    {executeMessage || t('functionTab.executeDialog.defaultMessage')}
                  </div>
                }
              />
              <Tab
                id="data"
                title={t('functionTab.executeDialog.tabs.data')}
                panel={
                  <div className="max-h-[300px] overflow-auto">
                    {executeResults.length > 0 ? (
                      <>
                        {/* Result set selector for multiple result sets */}
                        {executeResults.length > 1 && (
                          <div className={cn(
                            'mb-2 flex items-center gap-2 rounded border px-3 py-2',
                            theme === 'dark' ? 'border-[#3c3c3c] bg-[#252526]' : 'border-[#e0e0e0] bg-[#f8f9fa]',
                          )}>
                            <label className={cn('whitespace-nowrap text-xs font-medium', theme === 'dark' ? 'text-[#a0a0a0]' : 'text-[#666]')}>{t('functionTab.executeDialog.resultSetSelector')}:</label>
                            <HTMLSelect
                              value={activeResultSetIndex}
                              onChange={(e) => setActiveResultSetIndex(Number(e.target.value))}
                              options={executeResults.map((result, index) => ({
                                value: index,
                                label: t('functionTab.executeDialog.resultSetLabel', { 
                                  index: index + 1, 
                                  count: result.rows.length 
                                }),
                              }))}
                            />
                          </div>
                        )}
                        {/* Display active result set */}
                        {executeResults[activeResultSetIndex] && executeResults[activeResultSetIndex].rows.length > 0 ? (
                          <table className="w-full border-collapse text-[13px]">
                            <thead>
                              <tr>
                                {executeResults[activeResultSetIndex].columns.map((col) => (
                                  <th
                                    key={col.name}
                                    className={cn(
                                      'sticky top-0 border-b px-3 py-2 text-left font-semibold',
                                      theme === 'dark' ? 'border-[#3c3c3c] bg-[#252526] text-[#f3f4f6]' : 'border-[#e0e0e0] bg-[#f8f9fa] text-[#495057]',
                                    )}
                                  >
                                    {col.label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {executeResults[activeResultSetIndex].rows.map((row, idx) => (
                                <tr
                                  key={idx}
                                  className={theme === 'dark' ? 'hover:bg-[#2a2d2e]' : 'hover:bg-[#f0f0f0]'}
                                >
                                  {(row as unknown[]).map((cell, cellIdx) => (
                                    <td
                                      key={cellIdx}
                                      className={cn(
                                        'border-b px-3 py-2 text-left',
                                        theme === 'dark' ? 'border-[#3c3c3c] text-[#f3f4f6]' : 'border-[#e0e0e0] text-[#495057]',
                                      )}
                                    >
                                      {cell?.toString() ?? 'NULL'}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className={cn('p-6 text-center', theme === 'dark' ? 'text-[#a0a0a0]' : 'text-[#666]')}>{t('functionTab.executeDialog.noData')}</div>
                        )}
                      </>
                    ) : (
                      <div className={cn('p-6 text-center', theme === 'dark' ? 'text-[#a0a0a0]' : 'text-[#666]')}>{t('functionTab.executeDialog.noData')}</div>
                    )}
                  </div>
                }
              />
            </Tabs>
          </div>
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button onClick={() => setExecuteDialogOpen(false)}>{t('functionTab.executeDialog.close')}</Button>
            <Button
              intent="primary"
              onClick={() => performExecute(executeParams, executeParamValues)}
              loading={isExecuting}
            >
              {t('functionTab.executeDialog.execute')}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

