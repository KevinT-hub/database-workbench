// 只读 SQL 预览编辑器（SQL 预览 / DDL 共用）：注册全局编辑器管理，
// 字号/小地图跟随用户设置。

import React, { useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { registerEditor, unregisterEditor, getEditorSettings } from '@/lib/editorSettings';

interface ReadOnlySqlEditorProps {
  value: string;
  appTheme: 'light' | 'dark';
}

export const ReadOnlySqlEditor: React.FC<ReadOnlySqlEditorProps> = ({ value, appTheme }) => {
  const [editorSettings] = useState(getEditorSettings());

  const handleReadOnlyEditorMount = useCallback((
    editorInstance: editor.IStandaloneCodeEditor,
    monaco: typeof import('monaco-editor'),
  ) => {
    registerEditor(editorInstance, monaco);
    return () => {
      unregisterEditor(editorInstance);
    };
  }, []);

  return (
    <Editor
      height="100%"
      language="sql"
      value={value}
      theme={appTheme === 'dark' ? 'vs-dark' : 'light'}
      options={{
        readOnly: true,
        minimap: { enabled: editorSettings.editorMinimap },
        scrollBeyondLastLine: false,
        fontSize: editorSettings.editorFontSize,
        fontFamily: 'Consolas, Monaco, "Courier New", monospace',
        lineNumbers: 'on',
        renderWhitespace: 'selection',
        wordWrap: 'on',
        automaticLayout: true,
      }}
      onMount={handleReadOnlyEditorMount}
    />
  );
};

