// 表设计器“索引”Tab：索引表格与增删。

import React from 'react';
import { Button, InputGroup, HTMLSelect, Intent } from '@blueprintjs/core';
import { useTranslation } from 'react-i18next';
import { INDEX_METHODS, INDEX_TYPES, type IndexDefinition } from './designerTypes';
import { useAppStore } from '@/stores';
import { cn } from '@/lib/cn';

interface IndexesTabProps {
  indexes: IndexDefinition[];
  selectedIndexId: string | null;
  onSelectIndex: (id: string) => void;
  onIndexChange: (id: string, key: keyof IndexDefinition, value: unknown) => void;
  onAddIndex: () => void;
  onDeleteIndex: () => void;
}

export const IndexesTab: React.FC<IndexesTabProps> = ({
  indexes,
  selectedIndexId,
  onSelectIndex,
  onIndexChange,
  onAddIndex,
  onDeleteIndex,
}) => {
  const { t } = useTranslation();
  const { theme } = useAppStore();

  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <div className={cn('mb-3 flex flex-shrink-0 items-center gap-2 border-b pb-3', theme === 'dark' ? 'border-[#3e3e42]' : 'border-[#e1e5e9]')}>
        <Button icon="add" text={t('designerTab.indexes.addIndex')} onClick={onAddIndex} small />
        <Button icon="trash" text={t('designerTab.indexes.deleteIndex')} onClick={onDeleteIndex} small disabled={!selectedIndexId} intent={Intent.DANGER} />
      </div>
      <div className={cn('min-h-0 flex-1 overflow-auto rounded border', theme === 'dark' ? 'border-[#374151] bg-[#252a31]' : 'border-[#e1e5e9] bg-white')}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {[
                { width: '40px', label: '#' },
                { width: '150px', label: t('designerTab.indexes.columns.name') },
                { width: '200px', label: t('designerTab.indexes.columns.fields') },
                { width: '120px', label: t('designerTab.indexes.columns.type') },
                { width: '100px', label: t('designerTab.indexes.columns.method') },
                { width: '200px', label: t('designerTab.indexes.columns.comment') },
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
            {indexes.filter(i => !i.isDeleted).map((idx, index) => (
              <tr
                key={idx.id}
                className={cn(
                  'cursor-pointer',
                  theme === 'dark'
                    ? cn(
                        'hover:bg-[rgba(66,153,225,0.1)]',
                        idx.isNew && 'bg-[rgba(40,167,69,0.15)]',
                        idx.isModified && 'bg-[rgba(255,193,7,0.15)]',
                        selectedIndexId === idx.id && 'bg-[rgba(66,153,225,0.25)] hover:bg-[rgba(66,153,225,0.3)]',
                      )
                    : cn(
                        'hover:bg-[rgba(66,153,225,0.05)]',
                        idx.isNew && 'bg-[rgba(40,167,69,0.08)]',
                        idx.isModified && 'bg-[rgba(255,193,7,0.08)]',
                        selectedIndexId === idx.id && 'bg-[rgba(66,153,225,0.15)] hover:bg-[rgba(66,153,225,0.2)]',
                      ),
                )}
                onClick={() => onSelectIndex(idx.id)}
              >
                <td className={cn('border-b px-2 py-1.5 align-middle', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>{index + 1}</td>
                <td className={cn('border-b px-2 py-1.5 align-middle', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                  <InputGroup
                    small
                    className="w-full"
                    value={idx.name}
                    onChange={(e) => onIndexChange(idx.id, 'name', e.target.value)}
                    placeholder={t('designerTab.indexes.placeholders.name')}
                  />
                </td>
                <td className={cn('border-b px-2 py-1.5 align-middle', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                  <InputGroup
                    small
                    className="w-full"
                    value={idx.fields}
                    onChange={(e) => onIndexChange(idx.id, 'fields', e.target.value)}
                    placeholder={t('designerTab.indexes.placeholders.fields')}
                  />
                </td>
                <td className={cn('border-b px-2 py-1.5 align-middle', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                  <HTMLSelect
                    className="w-full"
                    value={idx.type}
                    onChange={(e) => onIndexChange(idx.id, 'type', e.target.value)}
                    options={INDEX_TYPES.map(type => ({ value: type, label: type }))}
                  />
                </td>
                <td className={cn('border-b px-2 py-1.5 align-middle', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                  <HTMLSelect
                    className="w-full"
                    value={idx.method}
                    onChange={(e) => onIndexChange(idx.id, 'method', e.target.value)}
                    options={INDEX_METHODS.map(m => ({ value: m, label: m }))}
                  />
                </td>
                <td className={cn('border-b px-2 py-1.5 align-middle', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                  <InputGroup
                    small
                    className="w-full"
                    value={idx.comment}
                    onChange={(e) => onIndexChange(idx.id, 'comment', e.target.value)}
                    placeholder={t('designerTab.indexes.placeholders.comment')}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {indexes.filter(i => !i.isDeleted).length === 0 && (
          <div className={cn('flex items-center justify-center p-10 text-sm', theme === 'dark' ? 'text-[#abb3bf]' : 'text-[#5f6b7c]')}>{t('designerTab.indexes.noIndexes')}</div>
        )}
      </div>
    </div>
  );
};

