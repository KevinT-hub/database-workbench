// 表设计器“外键”Tab：外键表格与增删。

import React from 'react';
import { Button, InputGroup, HTMLSelect, Intent } from '@blueprintjs/core';
import { useTranslation } from 'react-i18next';
import { FK_ACTIONS, type ForeignKeyDefinition } from './designerTypes';
import { useAppStore } from '@/stores';
import { cn } from '@/lib/cn';

interface ForeignKeysTabProps {
  foreignKeys: ForeignKeyDefinition[];
  selectedFkId: string | null;
  onSelectFk: (id: string) => void;
  onFkChange: (id: string, key: keyof ForeignKeyDefinition, value: unknown) => void;
  onAddForeignKey: () => void;
  onDeleteForeignKey: () => void;
}

export const ForeignKeysTab: React.FC<ForeignKeysTabProps> = ({
  foreignKeys,
  selectedFkId,
  onSelectFk,
  onFkChange,
  onAddForeignKey,
  onDeleteForeignKey,
}) => {
  const { t } = useTranslation();
  const { theme } = useAppStore();

  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <div className={cn('mb-3 flex flex-shrink-0 items-center gap-2 border-b pb-3', theme === 'dark' ? 'border-[#3e3e42]' : 'border-[#e1e5e9]')}>
        <Button icon="add" text={t('designerTab.foreignKeys.addForeignKey')} onClick={onAddForeignKey} small />
        <Button icon="trash" text={t('designerTab.foreignKeys.deleteForeignKey')} onClick={onDeleteForeignKey} small disabled={!selectedFkId} intent={Intent.DANGER} />
      </div>
      <div className={cn('min-h-0 flex-1 overflow-auto rounded border', theme === 'dark' ? 'border-[#374151] bg-[#252a31]' : 'border-[#e1e5e9] bg-white')}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {[
                { width: '40px', label: '#' },
                { width: '120px', label: t('designerTab.foreignKeys.columns.name') },
                { width: '120px', label: t('designerTab.foreignKeys.columns.fields') },
                { width: '120px', label: t('designerTab.foreignKeys.columns.refSchema') },
                { width: '120px', label: t('designerTab.foreignKeys.columns.refTable') },
                { width: '120px', label: t('designerTab.foreignKeys.columns.refFields') },
                { width: '100px', label: t('designerTab.foreignKeys.columns.onDelete') },
                { width: '100px', label: t('designerTab.foreignKeys.columns.onUpdate') },
              ].map((col) => (
                <th
                  key={col.width}
                  style={{ width: col.width }}
                  className={cn(
                    'sticky top-0 z-[1] whitespace-nowrap border-b px-2.5 py-2 text-left font-medium',
                    theme === 'dark' ? 'border-[#374151] bg-[#1f2937] text-[#e5e7eb]' : 'border-[#e1e5e9] bg-[#f5f6f7] text-[#1c2127]',
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {foreignKeys.filter(fk => !fk.isDeleted).map((fk, index) => (
              <tr
                key={fk.id}
                className={cn(
                  'cursor-pointer',
                  theme === 'dark'
                    ? cn(
                        'hover:bg-[rgba(66,153,225,0.1)]',
                        fk.isNew && 'bg-[rgba(40,167,69,0.15)]',
                        fk.isModified && 'bg-[rgba(255,193,7,0.15)]',
                        selectedFkId === fk.id && 'bg-[rgba(66,153,225,0.25)] hover:bg-[rgba(66,153,225,0.3)]',
                      )
                    : cn(
                        'hover:bg-[rgba(66,153,225,0.05)]',
                        fk.isNew && 'bg-[rgba(40,167,69,0.08)]',
                        fk.isModified && 'bg-[rgba(255,193,7,0.08)]',
                        selectedFkId === fk.id && 'bg-[rgba(66,153,225,0.15)] hover:bg-[rgba(66,153,225,0.2)]',
                      ),
                )}
                onClick={() => onSelectFk(fk.id)}
              >
                <td className={cn('border-b px-2 py-1.5 align-middle', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>{index + 1}</td>
                <td className={cn('border-b px-2 py-1.5 align-middle', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                  <InputGroup
                    small
                    className="w-full"
                    value={fk.name}
                    onChange={(e) => onFkChange(fk.id, 'name', e.target.value)}
                    placeholder={t('designerTab.foreignKeys.placeholders.name')}
                  />
                </td>
                <td className={cn('border-b px-2 py-1.5 align-middle', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                  <InputGroup
                    small
                    className="w-full"
                    value={fk.fields}
                    onChange={(e) => onFkChange(fk.id, 'fields', e.target.value)}
                    placeholder={t('designerTab.foreignKeys.placeholders.fields')}
                  />
                </td>
                <td className={cn('border-b px-2 py-1.5 align-middle', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                  <InputGroup
                    small
                    className="w-full"
                    value={fk.refSchema}
                    onChange={(e) => onFkChange(fk.id, 'refSchema', e.target.value)}
                    placeholder={t('designerTab.foreignKeys.placeholders.refSchema')}
                  />
                </td>
                <td className={cn('border-b px-2 py-1.5 align-middle', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                  <InputGroup
                    small
                    className="w-full"
                    value={fk.refTable}
                    onChange={(e) => onFkChange(fk.id, 'refTable', e.target.value)}
                    placeholder={t('designerTab.foreignKeys.placeholders.refTable')}
                  />
                </td>
                <td className={cn('border-b px-2 py-1.5 align-middle', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                  <InputGroup
                    small
                    className="w-full"
                    value={fk.refFields}
                    onChange={(e) => onFkChange(fk.id, 'refFields', e.target.value)}
                    placeholder={t('designerTab.foreignKeys.placeholders.refFields')}
                  />
                </td>
                <td className={cn('border-b px-2 py-1.5 align-middle', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                  <HTMLSelect
                    className="w-full"
                    value={fk.onDelete}
                    onChange={(e) => onFkChange(fk.id, 'onDelete', e.target.value)}
                    options={FK_ACTIONS.map(a => ({ value: a, label: a }))}
                  />
                </td>
                <td className={cn('border-b px-2 py-1.5 align-middle', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                  <HTMLSelect
                    className="w-full"
                    value={fk.onUpdate}
                    onChange={(e) => onFkChange(fk.id, 'onUpdate', e.target.value)}
                    options={FK_ACTIONS.map(a => ({ value: a, label: a }))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {foreignKeys.filter(fk => !fk.isDeleted).length === 0 && (
          <div className={cn('flex items-center justify-center p-10 text-sm', theme === 'dark' ? 'text-[#abb3bf]' : 'text-[#5f6b7c]')}>{t('designerTab.foreignKeys.noForeignKeys')}</div>
        )}
      </div>
    </div>
  );
};

