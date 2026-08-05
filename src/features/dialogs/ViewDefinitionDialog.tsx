import { useEffect, useState, useCallback, useRef } from 'react';
import { Dialog, Classes, Spinner, Callout, Button } from '@blueprintjs/core';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import type { ConnectionProfile } from '@/types';
import { useAppStore } from '@/stores';
import { registerEditor, unregisterEditor, getEditorSettings, applySettingsToAllEditors } from '@/lib/editorSettings';
import { useViewDefinition } from './useViewDefinition';

interface ViewDefinitionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  connectionProfile: ConnectionProfile;
  database: string;
  viewName: string;
}

export const ViewDefinitionDialog: React.FC<ViewDefinitionDialogProps> = ({
  isOpen,
  onClose,
  connectionProfile,
  database,
  viewName,
}) => {
  const { ddl, isLoading, error, fetchViewDefinition } = useViewDefinition();
  const { theme } = useAppStore();
  const [editorSettings, setEditorSettings] = useState(getEditorSettings());
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  // 监听设置变更事件
  useEffect(() => {
    const handleSettingsChanged = () => {
      const newSettings = getEditorSettings();
      setEditorSettings(newSettings);
      // 应用设置到所有编辑器
      applySettingsToAllEditors();
    };

    window.addEventListener('dbw:settings-changed', handleSettingsChanged as EventListener);
    return () => {
      window.removeEventListener('dbw:settings-changed', handleSettingsChanged as EventListener);
    };
  }, []);

  const handleEditorMount = useCallback((
    editorInstance: editor.IStandaloneCodeEditor,
    monaco: typeof import('monaco-editor'),
  ) => {
    editorRef.current = editorInstance;
    // 注册只读编辑器
    registerEditor(editorInstance, monaco);
    return () => {
      unregisterEditor(editorInstance);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchViewDefinition(connectionProfile, database, viewName);
    } else {
      // 关闭时由下次打开时的 fetch 重置状态
    }
  }, [isOpen, connectionProfile, database, viewName, fetchViewDefinition]);

  const editorTheme = theme === 'dark' ? 'vs-dark' : 'vs';

  const renderContent = () => {
    if (isLoading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
          <Spinner intent="primary" size={50} />
        </div>
      );
    }

    if (error) {
      return (
        <Callout intent="danger" title="加载失败">
          {error}
        </Callout>
      );
    }

    return (
      <div style={{ height: '400px', border: '1px solid #ddd', borderRadius: '4px' }}>
        <Editor
          height="100%"
          defaultLanguage="sql"
          value={ddl}
          onMount={handleEditorMount}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            fontSize: editorSettings.editorFontSize,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            lineHeight: 20,
            wordWrap: 'on',
            automaticLayout: true,
            folding: true,
            renderLineHighlight: 'all',
            contextmenu: false,
          }}
          theme={editorTheme}
        />
      </div>
    );
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`视图定义: ${viewName}`}
      icon="code-block"
      style={{ width: '700px' }}
    >
      <div className={Classes.DIALOG_BODY}>
        <Callout intent="primary" style={{ marginBottom: '15px' }}>
          <strong>数据库:</strong> {database} &nbsp;|&nbsp; <strong>视图:</strong> {viewName}
        </Callout>
        {renderContent()}
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button onClick={onClose}>关闭</Button>
        </div>
      </div>
    </Dialog>
  );
};
