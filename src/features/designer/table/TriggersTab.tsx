// 表设计器“触发器”Tab：触发器列表 + 定义编辑（Monaco 编辑器）。
// 编辑器编辑状态（isTriggerEditing / 草稿 / 设置）收敛在本组件内。

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Button, InputGroup, HTMLSelect, Checkbox, Intent } from '@blueprintjs/core';
import { useTranslation } from 'react-i18next';
import type { ConnectionProfile } from '@/types';
import {
  registerSQLCompletionProvider,
  updateCompletionProviderState,
  setSQLCompletionContextForEditor,
  clearSQLCompletionContextForEditor,
} from '@/completion';
import { registerEditor, unregisterEditor, getEditorSettings, applySettingsToAllEditors } from '@/lib/editorSettings';
import { cn } from '@/lib/cn';
import { TRIGGER_TIMINGS, type TriggerDefinition } from './designerTypes';

interface TriggersTabProps {
  triggers: TriggerDefinition[];
  selectedTriggerId: string | null;
  onSelectTrigger: (id: string) => void;
  onTriggerChange: (id: string, key: keyof TriggerDefinition, value: unknown) => void;
  onAddTrigger: () => void;
  onDeleteTrigger: () => void;
  connectionProfile: ConnectionProfile;
  database: string;
  appTheme: 'light' | 'dark';
}

const extractTriggerBody = (definition: string): string => {
  if (!definition) return '';
  const beginMatch = definition.match(/BEGIN\s*/i);
  const endMatch = definition.match(/\s*END\s*$/i);
  if (beginMatch && endMatch) {
    const start = definition.indexOf(beginMatch[0]) + beginMatch[0].length;
    const end = definition.lastIndexOf(endMatch[0]);
    return definition.substring(start, end).trim();
  }
  return definition;
};

export const TriggersTab: React.FC<TriggersTabProps> = ({
  triggers,
  selectedTriggerId,
  onSelectTrigger,
  onTriggerChange,
  onAddTrigger,
  onDeleteTrigger,
  connectionProfile,
  database,
  appTheme,
}) => {
  const { t } = useTranslation();
  const [isTriggerEditing, setIsTriggerEditing] = useState(false);
  const [editingTriggerDefinition, setEditingTriggerDefinition] = useState<string>('');
  const triggerEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [editorSettings, setEditorSettings] = useState(getEditorSettings());

  const selectedTrigger = triggers.find(trg => trg.id === selectedTriggerId);

  const handleTriggerEditorMount = useCallback((
    editorInstance: editor.IStandaloneCodeEditor,
    monaco: typeof import('monaco-editor'),
  ) => {
    triggerEditorRef.current = editorInstance;
    registerEditor(editorInstance, monaco);
    if (isTriggerEditing && editorSettings.editorAutoComplete) {
      registerSQLCompletionProvider(monaco, true);
    }
    setSQLCompletionContextForEditor(editorInstance, { profile: connectionProfile, database });

    return () => {
      clearSQLCompletionContextForEditor(editorInstance);
      unregisterEditor(editorInstance);
    };
  }, [connectionProfile, database, isTriggerEditing, editorSettings.editorAutoComplete]);

  useEffect(() => {
    const handleSettingsChanged = () => {
      const newSettings = getEditorSettings();
      setEditorSettings(newSettings);
      applySettingsToAllEditors();
      updateCompletionProviderState();
    };

    window.addEventListener('dbw:settings-changed', handleSettingsChanged as EventListener);
    return () => {
      window.removeEventListener('dbw:settings-changed', handleSettingsChanged as EventListener);
    };
  }, []);

  const handleStartTriggerEdit = () => {
    if (selectedTrigger) {
      setEditingTriggerDefinition(extractTriggerBody(selectedTrigger.definition));
    }
    setIsTriggerEditing(true);
  };

  const handleFinishTriggerEdit = () => {
    if (selectedTriggerId && editingTriggerDefinition !== undefined) {
      const originalBody = selectedTrigger ? extractTriggerBody(selectedTrigger.definition) : '';
      if (editingTriggerDefinition !== originalBody) {
        onTriggerChange(selectedTriggerId, 'definition', `BEGIN\n${editingTriggerDefinition}\nEND`);
      }
    }
    setIsTriggerEditing(false);
    setEditingTriggerDefinition('');
  };

  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <div className={cn('mb-3 flex flex-shrink-0 items-center gap-2 border-b pb-3', appTheme === 'dark' ? 'border-[#3e3e42]' : 'border-[#e1e5e9]')}>
        <Button icon="add" text={t('designerTab.triggers.addTrigger')} onClick={onAddTrigger} small />
        <Button icon="trash" text={t('designerTab.triggers.deleteTrigger')} onClick={onDeleteTrigger} small disabled={!selectedTriggerId} intent={Intent.DANGER} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className={cn('min-h-0 flex-1 overflow-auto rounded border', appTheme === 'dark' ? 'border-[#374151] bg-[#252a31]' : 'border-[#e1e5e9] bg-white')}>
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {[
                  { width: '40px', label: '#' },
                  { width: '150px', label: t('designerTab.triggers.columns.name') },
                  { width: '80px', label: t('designerTab.triggers.columns.timing') },
                  { width: '60px', label: t('designerTab.triggers.columns.insert') },
                  { width: '60px', label: t('designerTab.triggers.columns.update') },
                  { width: '60px', label: t('designerTab.triggers.columns.delete') },
                ].map((col) => (
                  <th
                    key={col.width}
                    style={{ width: col.width }}
                    className={cn(
                      'sticky top-0 z-[1] whitespace-nowrap border-b px-2.5 py-2 text-left font-medium',
                      appTheme === 'dark' ? 'border-[#374151] bg-[#1f2937] text-[#e5e7eb]' : 'border-[#e1e5e9] bg-[#f5f6f7] text-[#1c2127]',
                    )}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {triggers.filter(trg => !trg.isDeleted).map((trg, index) => (
                <tr
                  key={trg.id}
                  className={cn(
                    'cursor-pointer',
                    appTheme === 'dark'
                      ? cn(
                          'hover:bg-[rgba(66,153,225,0.1)]',
                          trg.isNew && 'bg-[rgba(40,167,69,0.15)]',
                          trg.isModified && 'bg-[rgba(255,193,7,0.15)]',
                          selectedTriggerId === trg.id && 'bg-[rgba(66,153,225,0.25)] hover:bg-[rgba(66,153,225,0.3)]',
                        )
                      : cn(
                          'hover:bg-[rgba(66,153,225,0.05)]',
                          trg.isNew && 'bg-[rgba(40,167,69,0.08)]',
                          trg.isModified && 'bg-[rgba(255,193,7,0.08)]',
                          selectedTriggerId === trg.id && 'bg-[rgba(66,153,225,0.15)] hover:bg-[rgba(66,153,225,0.2)]',
                        ),
                  )}
                  onClick={() => {
                    onSelectTrigger(trg.id);
                    setIsTriggerEditing(false);
                    setEditingTriggerDefinition('');
                  }}
                >
                  <td className={cn('border-b px-2 py-1.5 align-middle', appTheme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>{index + 1}</td>
                  <td className={cn('border-b px-2 py-1.5 align-middle', appTheme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                    <InputGroup
                      small
                      className="w-full"
                      value={trg.name}
                      onChange={(e) => onTriggerChange(trg.id, 'name', e.target.value)}
                      placeholder={t('designerTab.triggers.placeholders.name')}
                    />
                  </td>
                  <td className={cn('border-b px-2 py-1.5 align-middle', appTheme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                    <HTMLSelect
                      className="w-full"
                      value={trg.timing}
                      onChange={(e) => onTriggerChange(trg.id, 'timing', e.target.value)}
                      options={TRIGGER_TIMINGS.map(timing => ({ value: timing, label: timing }))}
                    />
                  </td>
                  <td className={cn('border-b px-2 py-1.5 align-middle', appTheme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                    <div className="flex h-full w-full items-center justify-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        className="!m-0"
                        checked={trg.insert}
                        onChange={(e) => onTriggerChange(trg.id, 'insert', (e.target as HTMLInputElement).checked)}
                      />
                    </div>
                  </td>
                  <td className={cn('border-b px-2 py-1.5 align-middle', appTheme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                    <div className="flex h-full w-full items-center justify-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        className="!m-0"
                        checked={trg.update}
                        onChange={(e) => onTriggerChange(trg.id, 'update', (e.target as HTMLInputElement).checked)}
                      />
                    </div>
                  </td>
                  <td className={cn('border-b px-2 py-1.5 align-middle', appTheme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                    <div className="flex h-full w-full items-center justify-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        className="!m-0"
                        checked={trg.delete}
                        onChange={(e) => onTriggerChange(trg.id, 'delete', (e.target as HTMLInputElement).checked)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {triggers.filter(trg => !trg.isDeleted).length === 0 && (
            <div className={cn('flex items-center justify-center p-10 text-sm', appTheme === 'dark' ? 'text-[#abb3bf]' : 'text-[#5f6b7c]')}>{t('designerTab.triggers.noTriggers')}</div>
          )}
        </div>
        <div className={cn('flex min-h-0 flex-1 flex-col border-t pt-3', appTheme === 'dark' ? 'border-[#3e3e42]' : 'border-[#e1e5e9]')}>
          <div className="mb-2 flex items-center justify-between">
            <div className={cn('text-[13px] font-medium', appTheme === 'dark' ? 'text-[#f6f7f9]' : 'text-[#1c2127]')}>{t('designerTab.triggers.definition')}</div>
            {selectedTriggerId && (
              <Button
                small
                intent={isTriggerEditing ? Intent.PRIMARY : Intent.NONE}
                onClick={isTriggerEditing ? handleFinishTriggerEdit : handleStartTriggerEdit}
              >
                {isTriggerEditing ? t('designerTab.triggers.done') : t('designerTab.triggers.edit')}
              </Button>
            )}
          </div>
          <div className={cn('min-h-0 flex-1 overflow-hidden rounded border', appTheme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
            <Editor
              height="100%"
              language="sql"
              value={isTriggerEditing ? editingTriggerDefinition : (selectedTrigger ? extractTriggerBody(selectedTrigger.definition) : '')}
              theme={appTheme === 'dark' ? 'vs-dark' : 'light'}
              options={{
                readOnly: !isTriggerEditing || !selectedTrigger,
                minimap: { enabled: editorSettings.editorMinimap },
                scrollBeyondLastLine: false,
                fontSize: editorSettings.editorFontSize,
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                lineNumbers: 'on',
                renderWhitespace: 'selection',
                wordWrap: 'on',
                automaticLayout: true,
                tabSize: editorSettings.editorTabSize,
                insertSpaces: true,
              }}
              onChange={(value) => isTriggerEditing && setEditingTriggerDefinition(value || '')}
              onMount={handleTriggerEditorMount}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

