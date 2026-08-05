// 表设计器“检查”Tab：检查约束表格与增删。

import React from 'react';
import { Button, InputGroup, Checkbox, Intent } from '@blueprintjs/core';
import { useTranslation } from 'react-i18next';
import type { CheckDefinition } from './designerTypes';
import { useAppStore } from '@/stores';
import { cn } from '@/lib/cn';

interface ChecksTabProps {
  checks: CheckDefinition[];
  selectedCheckId: string | null;
  onSelectCheck: (id: string) => void;
  onCheckChange: (id: string, key: keyof CheckDefinition, value: unknown) => void;
  onAddCheck: () => void;
  onDeleteCheck: () => void;
}

export const ChecksTab: React.FC<ChecksTabProps> = ({
  checks,
  selectedCheckId,
  onSelectCheck,
  onCheckChange,
  onAddCheck,
  onDeleteCheck,
}) => {
  const { t } = useTranslation();
  const { theme } = useAppStore();

  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <div className={cn('mb-3 flex flex-shrink-0 items-center gap-2 border-b pb-3', theme === 'dark' ? 'border-[#3e3e42]' : 'border-[#e1e5e9]')}>
        <Button icon="add" text={t('designerTab.checks.addCheck')} onClick={onAddCheck} small />
        <Button icon="trash" text={t('designerTab.checks.deleteCheck')} onClick={onDeleteCheck} small disabled={!selectedCheckId} intent={Intent.DANGER} />
      </div>
      <div className={cn('min-h-0 flex-1 overflow-auto rounded border', theme === 'dark' ? 'border-[#374151] bg-[#252a31]' : 'border-[#e1e5e9] bg-white')}>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {[
                { width: '40px', label: '#' },
                { width: '150px', label: t('designerTab.checks.columns.name') },
                { width: '400px', label: t('designerTab.checks.columns.clause') },
                { width: '100px', label: t('designerTab.checks.columns.notEnforced') },
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
            {checks.filter(c => !c.isDeleted).map((chk, index) => (
              <tr
                key={chk.id}
                className={cn(
                  'cursor-pointer',
                  theme === 'dark'
                    ? cn(
                        'hover:bg-[rgba(66,153,225,0.1)]',
                        chk.isNew && 'bg-[rgba(40,167,69,0.15)]',
                        chk.isModified && 'bg-[rgba(255,193,7,0.15)]',
                        selectedCheckId === chk.id && 'bg-[rgba(66,153,225,0.25)] hover:bg-[rgba(66,153,225,0.3)]',
                      )
                    : cn(
                        'hover:bg-[rgba(66,153,225,0.05)]',
                        chk.isNew && 'bg-[rgba(40,167,69,0.08)]',
                        chk.isModified && 'bg-[rgba(255,193,7,0.08)]',
                        selectedCheckId === chk.id && 'bg-[rgba(66,153,225,0.15)] hover:bg-[rgba(66,153,225,0.2)]',
                      ),
                )}
                onClick={() => onSelectCheck(chk.id)}
              >
                <td className={cn('border-b px-2 py-1.5 align-middle', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>{index + 1}</td>
                <td className={cn('border-b px-2 py-1.5 align-middle', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                  <InputGroup
                    small
                    className="w-full"
                    value={chk.name}
                    onChange={(e) => onCheckChange(chk.id, 'name', e.target.value)}
                    placeholder={t('designerTab.checks.placeholders.name')}
                  />
                </td>
                <td className={cn('border-b px-2 py-1.5 align-middle', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                  <InputGroup
                    small
                    className="w-full"
                    value={chk.clause}
                    onChange={(e) => onCheckChange(chk.id, 'clause', e.target.value)}
                    placeholder={t('designerTab.checks.placeholders.clause')}
                  />
                </td>
                <td className={cn('border-b px-2 py-1.5 align-middle text-center', theme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
                  <Checkbox
                    className="!m-0"
                    checked={chk.notEnforced}
                    onChange={(e) => onCheckChange(chk.id, 'notEnforced', (e.target as HTMLInputElement).checked)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {checks.filter(c => !c.isDeleted).length === 0 && (
          <div className={cn('flex items-center justify-center p-10 text-sm', theme === 'dark' ? 'text-[#abb3bf]' : 'text-[#5f6b7c]')}>{t('designerTab.checks.noChecks')}</div>
        )}
      </div>
    </div>
  );
};

