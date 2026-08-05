// 表设计器“字段”Tab：字段表格 + 添加/插入/删除/主键/上移下移 + 类型选项区。

import React from 'react';
import { Button, InputGroup, HTMLSelect, Checkbox, FormGroup, Intent } from '@blueprintjs/core';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/stores';
import { cn } from '@/lib/cn';
import {
  INTEGER_DISPLAY_WIDTH_TYPES,
  MYSQL_CHARSETS,
  MYSQL_COLLATIONS,
  MYSQL_DATA_TYPES,
  getTypeParameterMode,
  isStringType,
  type FieldDefinition,
} from './designerTypes';

interface FieldsTabProps {
  fields: FieldDefinition[];
  selectedFieldId: string | null;
  onSelectField: (id: string) => void;
  onFieldChange: (id: string, key: keyof FieldDefinition, value: unknown) => void;
  onAddField: () => void;
  onInsertField: () => void;
  onDeleteField: () => void;
  onTogglePrimaryKey: () => void;
  onMoveField: (direction: -1 | 1) => void;
}

export const FieldsTab: React.FC<FieldsTabProps> = ({
  fields,
  selectedFieldId,
  onSelectField,
  onFieldChange,
  onAddField,
  onInsertField,
  onDeleteField,
  onTogglePrimaryKey,
  onMoveField,
}) => {
  const { t } = useTranslation();
  const { theme } = useAppStore();
  const selectedField = fields.find(f => f.id === selectedFieldId);
  const showCharsetCollation = selectedField && isStringType(selectedField.type);
  const showZerofillSection = selectedField ? INTEGER_DISPLAY_WIDTH_TYPES.has(selectedField.type.toUpperCase()) : false;
  const zerofillEnabled = selectedField ? Boolean(selectedField.length.trim()) : false;
  const showEnumValuesSection = selectedField ? ['ENUM', 'SET'].includes(selectedField.type.toUpperCase()) : false;

  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <div className={cn('mb-3 flex flex-shrink-0 items-center gap-2 border-b pb-3', theme === 'dark' ? 'border-[#3e3e42]' : 'border-[#e1e5e9]')}>
        <Button icon="add" text={t('designerTab.fields.addField')} onClick={onAddField} small />
        <Button icon="insert" text={t('designerTab.fields.insertField')} onClick={onInsertField} small disabled={!selectedFieldId} />
        <Button icon="trash" text={t('designerTab.fields.deleteField')} onClick={onDeleteField} small disabled={!selectedFieldId} intent={Intent.DANGER} />
        <div className={cn('mx-1 h-5 w-px', theme === 'dark' ? 'bg-[#3e3e42]' : 'bg-[#e1e5e9]')} />
        <Button icon="key" text={t('designerTab.fields.primaryKey')} onClick={onTogglePrimaryKey} small disabled={!selectedFieldId} />
        <div className={cn('mx-1 h-5 w-px', theme === 'dark' ? 'bg-[#3e3e42]' : 'bg-[#e1e5e9]')} />
        <Button icon="arrow-up" text={t('designerTab.fields.moveUp')} onClick={() => onMoveField(-1)} small disabled={!selectedFieldId} />
        <Button icon="arrow-down" text={t('designerTab.fields.moveDown')} onClick={() => onMoveField(1)} small disabled={!selectedFieldId} />
      </div>
      <div className={cn('min-h-0 flex-1 overflow-auto rounded border', theme === 'dark' ? 'border-[#374151] bg-[#252a31]' : 'border-[#e1e5e9] bg-white')}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th style={{ width: '30px' }} className={cn('sticky top-0 z-[1] whitespace-nowrap border-b px-2.5 py-2 text-left font-medium', theme === 'dark' ? 'border-[#374151] bg-[#1f2937] text-[#e5e7eb]' : 'border-[#e1e5e9] bg-[#f5f6f7] text-[#1c2127]')}>#</th>
              <th style={{ width: '140px' }} className={cn('sticky top-0 z-[1] whitespace-nowrap border-b px-2.5 py-2 text-left font-medium', theme === 'dark' ? 'border-[#374151] bg-[#1f2937] text-[#e5e7eb]' : 'border-[#e1e5e9] bg-[#f5f6f7] text-[#1c2127]')}>{t('designerTab.fields.columns.name')}</th>
              <th style={{ width: '100px' }} className={cn('sticky top-0 z-[1] whitespace-nowrap border-b px-2.5 py-2 text-left font-medium', theme === 'dark' ? 'border-[#374151] bg-[#1f2937] text-[#e5e7eb]' : 'border-[#e1e5e9] bg-[#f5f6f7] text-[#1c2127]')}>{t('designerTab.fields.columns.type')}</th>
              <th style={{ width: '70px' }} className={cn('sticky top-0 z-[1] whitespace-nowrap border-b px-2.5 py-2 text-left font-medium', theme === 'dark' ? 'border-[#374151] bg-[#1f2937] text-[#e5e7eb]' : 'border-[#e1e5e9] bg-[#f5f6f7] text-[#1c2127]')}>{t('designerTab.fields.columns.length')}</th>
              <th style={{ width: '60px' }} className={cn('sticky top-0 z-[1] whitespace-nowrap border-b px-2.5 py-2 text-left font-medium', theme === 'dark' ? 'border-[#374151] bg-[#1f2937] text-[#e5e7eb]' : 'border-[#e1e5e9] bg-[#f5f6f7] text-[#1c2127]')}>{t('designerTab.fields.columns.decimals')}</th>
              <th style={{ width: '50px' }} className={cn('sticky top-0 z-[1] whitespace-nowrap border-b px-2.5 py-2 text-left font-medium', theme === 'dark' ? 'border-[#374151] bg-[#1f2937] text-[#e5e7eb]' : 'border-[#e1e5e9] bg-[#f5f6f7] text-[#1c2127]')}>{t('designerTab.fields.columns.notNull')}</th>
              <th style={{ width: '50px' }} className={cn('sticky top-0 z-[1] whitespace-nowrap border-b px-2.5 py-2 text-left font-medium', theme === 'dark' ? 'border-[#374151] bg-[#1f2937] text-[#e5e7eb]' : 'border-[#e1e5e9] bg-[#f5f6f7] text-[#1c2127]')}>{t('designerTab.fields.columns.key')}</th>
              <th style={{ width: '50px' }} className={cn('sticky top-0 z-[1] whitespace-nowrap border-b px-2.5 py-2 text-left font-medium', theme === 'dark' ? 'border-[#374151] bg-[#1f2937] text-[#e5e7eb]' : 'border-[#e1e5e9] bg-[#f5f6f7] text-[#1c2127]')}>{t('designerTab.fields.columns.autoIncrement')}</th>
              <th style={{ width: '100px' }} className={cn('sticky top-0 z-[1] whitespace-nowrap border-b px-2.5 py-2 text-left font-medium', theme === 'dark' ? 'border-[#374151] bg-[#1f2937] text-[#e5e7eb]' : 'border-[#e1e5e9] bg-[#f5f6f7] text-[#1c2127]')}>{t('designerTab.fields.columns.default')}</th>
              <th style={{ width: '120px' }} className={cn('sticky top-0 z-[1] whitespace-nowrap border-b px-2.5 py-2 text-left font-medium', theme === 'dark' ? 'border-[#374151] bg-[#1f2937] text-[#e5e7eb]' : 'border-[#e1e5e9] bg-[#f5f6f7] text-[#1c2127]')}>{t('designerTab.fields.columns.comment')}</th>
            </tr>
          </thead>
          <tbody>
            {fields.filter(f => !f.isDeleted).map((field, index) => {
              const typeMode = getTypeParameterMode(field.type);
              const lengthDisabled = typeMode === 'none' || ['ENUM', 'SET'].includes(field.type.toUpperCase());
              const decimalsDisabled = typeMode !== 'double' || ['ENUM', 'SET'].includes(field.type.toUpperCase());

              return (
                <tr
                  key={field.id}
                  className={cn(
                    'cursor-pointer',
                    theme === 'dark'
                      ? cn(
                          'hover:bg-[rgba(66,153,225,0.1)]',
                          field.isNew && 'bg-[rgba(40,167,69,0.15)]',
                          field.isModified && 'bg-[rgba(255,193,7,0.15)]',
                          selectedFieldId === field.id && 'bg-[rgba(66,153,225,0.25)] hover:bg-[rgba(66,153,225,0.3)]',
                        )
                      : cn(
                          'hover:bg-[rgba(66,153,225,0.05)]',
                          field.isNew && 'bg-[rgba(40,167,69,0.08)]',
                          field.isModified && 'bg-[rgba(255,193,7,0.08)]',
                          selectedFieldId === field.id && 'bg-[rgba(66,153,225,0.15)] hover:bg-[rgba(66,153,225,0.2)]',
                        ),
                  )}
                  onClick={() => onSelectField(field.id)}
                >
                  <td className={cn('border-b px-2 py-1.5 align-middle', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>{index + 1}</td>
                  <td className={cn('border-b px-2 py-1.5 align-middle', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                    <InputGroup
                      small
                      className="w-full"
                      value={field.name}
                      onChange={(e) => onFieldChange(field.id, 'name', e.target.value)}
                      placeholder={t('designerTab.fields.placeholders.name')}
                    />
                  </td>
                  <td className={cn('border-b px-2 py-1.5 align-middle', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                    <HTMLSelect
                      className="w-full"
                      value={field.type.toUpperCase()}
                      onChange={(e) => onFieldChange(field.id, 'type', e.target.value)}
                      options={MYSQL_DATA_TYPES.map(type => ({ value: type, label: type }))}
                    />
                  </td>
                  <td className={cn('border-b px-2 py-1.5 align-middle', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                    <InputGroup
                      small
                      className="w-full"
                      value={field.length}
                      onChange={(e) => onFieldChange(field.id, 'length', e.target.value)}
                      placeholder={t('designerTab.fields.placeholders.length')}
                      disabled={lengthDisabled}
                    />
                  </td>
                  <td className={cn('border-b px-2 py-1.5 align-middle', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                    <InputGroup
                      small
                      className="w-full"
                      value={field.decimals}
                      onChange={(e) => onFieldChange(field.id, 'decimals', e.target.value)}
                      placeholder={t('designerTab.fields.placeholders.decimals')}
                      disabled={decimalsDisabled}
                    />
                  </td>
                  <td className={cn('border-b px-2 py-1.5 align-middle text-center', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                    <Checkbox
                      className="!m-0"
                      checked={!field.nullable}
                      onChange={(e) => onFieldChange(field.id, 'nullable', !(e.target as HTMLInputElement).checked)}
                    />
                  </td>
                  <td className={cn('border-b px-2 py-1.5 text-center align-middle', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                    {field.isPrimaryKey && <span className="text-sm">🔑1</span>}
                  </td>
                  <td className={cn('border-b px-2 py-1.5 align-middle text-center', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                    <Checkbox
                      className="!m-0"
                      checked={field.autoIncrement}
                      onChange={(e) => onFieldChange(field.id, 'autoIncrement', (e.target as HTMLInputElement).checked)}
                    />
                  </td>
                  <td className={cn('border-b px-2 py-1.5 align-middle', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                    <InputGroup
                      small
                      className="w-full"
                      value={field.defaultValue || ''}
                      onChange={(e) => onFieldChange(field.id, 'defaultValue', e.target.value || null)}
                      placeholder={t('designerTab.fields.placeholders.default')}
                    />
                  </td>
                  <td className={cn('border-b px-2 py-1.5 align-middle', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                    <InputGroup
                      small
                      className="w-full"
                      value={field.comment}
                      onChange={(e) => onFieldChange(field.id, 'comment', e.target.value)}
                      placeholder={t('designerTab.fields.placeholders.comment')}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showZerofillSection && selectedField && (
        <div className={cn('mt-3 flex-shrink-0 rounded border p-3', theme === 'dark' ? 'border-[#374151] bg-[#252a31]' : 'border-[#e1e5e9] bg-[#f5f6f7]')}>
          <div className={cn('mb-3 text-[13px] font-medium', theme === 'dark' ? 'text-[#f6f7f9]' : 'text-[#1c2127]')}>{t('designerTab.fields.zeroFillTitle')}</div>
          <div className="flex gap-4">
            <FormGroup label={t('designerTab.fields.zeroFill')} className="!mb-0 flex-1">
              <Checkbox
                checked={selectedField.zerofill}
                disabled={!zerofillEnabled}
                label={t('designerTab.fields.zeroFillHint')}
                onChange={(event) => {
                  const checked = (event.target as HTMLInputElement).checked;
                  onFieldChange(selectedField.id, 'zerofill', checked);
                  if (checked) {
                    onFieldChange(selectedField.id, 'unsigned', true);
                  }
                }}
              />
            </FormGroup>
          </div>
        </div>
      )}
      {showEnumValuesSection && selectedField && (
        <div className={cn('mt-3 flex-shrink-0 rounded border p-3', theme === 'dark' ? 'border-[#374151] bg-[#252a31]' : 'border-[#e1e5e9] bg-[#f5f6f7]')}>
          <div className={cn('mb-3 text-[13px] font-medium', theme === 'dark' ? 'text-[#f6f7f9]' : 'text-[#1c2127]')}>{t('designerTab.fields.enumValuesTitle')}</div>
          <FormGroup label={t('designerTab.fields.enumValues')}>
            <InputGroup
              value={selectedField.enumValues}
              onChange={(event) => onFieldChange(selectedField.id, 'enumValues', event.target.value)}
              placeholder={t('designerTab.fields.placeholders.enumValues')}
            />
          </FormGroup>
        </div>
      )}
      {showCharsetCollation && selectedField && (
        <div className={cn('mt-3 flex-shrink-0 rounded border p-3', theme === 'dark' ? 'border-[#374151] bg-[#252a31]' : 'border-[#e1e5e9] bg-[#f5f6f7]')}>
          <div className={cn('mb-3 text-[13px] font-medium', theme === 'dark' ? 'text-[#f6f7f9]' : 'text-[#1c2127]')}>{t('designerTab.fields.charsetCollation')}</div>
          <div className="flex gap-4">
            <FormGroup label={t('designerTab.fields.columns.charset')} className="!mb-0 flex-1">
              <HTMLSelect
                className="w-full"
                value={selectedField.charset || ''}
                onChange={(e) => {
                  const newCharset = e.target.value;
                  onFieldChange(selectedField.id, 'charset', newCharset);
                  if (newCharset && MYSQL_COLLATIONS[newCharset]) {
                    onFieldChange(selectedField.id, 'collation', MYSQL_COLLATIONS[newCharset][0]);
                  } else {
                    onFieldChange(selectedField.id, 'collation', '');
                  }
                }}
                options={[
                  { value: '', label: t('designerTab.fields.default') },
                  ...MYSQL_CHARSETS.map(c => ({ value: c, label: c }))
                ]}
              />
            </FormGroup>
            <FormGroup label={t('designerTab.fields.columns.collation')} className="!mb-0 flex-1">
              <HTMLSelect
                className="w-full"
                value={selectedField.collation || ''}
                onChange={(e) => onFieldChange(selectedField.id, 'collation', e.target.value)}
                options={[
                  { value: '', label: t('designerTab.fields.default') },
                  ...(selectedField.charset && MYSQL_COLLATIONS[selectedField.charset]
                    ? MYSQL_COLLATIONS[selectedField.charset].map(c => ({ value: c, label: c }))
                    : [])
                ]}
                disabled={!selectedField.charset}
              />
            </FormGroup>
          </div>
        </div>
      )}
    </div>
  );
};

