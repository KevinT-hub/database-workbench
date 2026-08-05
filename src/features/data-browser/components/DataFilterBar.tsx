// 数据浏览共享筛选栏：WHERE / GROUP BY / ORDER BY + 重置/确认。
// TableDataTab 与 ViewDataTab 共用的纯展示组件，文案由调用方注入。

import React from 'react';
import { Button, InputGroup, Intent } from '@blueprintjs/core';
import { useAppStore } from '@/stores';
import { cn } from '@/lib/cn';

interface DataFilterBarLabels {
  reset: string;
  confirm: string;
}

interface DataFilterBarProps {
  whereClauseInput: string;
  onWhereChange: (value: string) => void;
  groupByClauseInput: string;
  onGroupByChange: (value: string) => void;
  orderByClauseInput: string;
  onOrderByChange: (value: string) => void;
  onReset: () => void;
  onApply: () => void;
  disabled: boolean;
  labels: DataFilterBarLabels;
}

export const DataFilterBar: React.FC<DataFilterBarProps> = ({
  whereClauseInput,
  onWhereChange,
  groupByClauseInput,
  onGroupByChange,
  orderByClauseInput,
  onOrderByChange,
  onReset,
  onApply,
  disabled,
  labels,
}) => {
  const { theme } = useAppStore();

  return (
    <div className={cn(
      'flex flex-shrink-0 items-center justify-between border-b px-3 py-1.5',
      theme === 'dark' ? 'border-[#3e3e42] bg-[#252a31]' : 'border-[#e1e5e9] bg-[#f5f6f7]',
    )}>
      <div className="flex min-w-0 flex-1 items-center">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2 first:pl-0">
          <svg className={cn('shrink-0', theme === 'dark' ? 'text-[#abb3bf]' : 'text-[#5f6b7c]')} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          <span className={cn('shrink-0 whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.3px]', theme === 'dark' ? 'text-[#abb3bf]' : 'text-[#5f6b7c]')}>WHERE</span>
          <InputGroup
            small
            placeholder=""
            value={whereClauseInput}
            onChange={(e) => onWhereChange(e.target.value)}
            className="filter-input min-w-[60px] flex-1"
            disabled={disabled}
          />
        </div>
        <div className={cn('h-5 w-px shrink-0', theme === 'dark' ? 'bg-[#3e3e42]' : 'bg-[#e1e5e9]')} />
        <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2 first:pl-0">
          <svg className={cn('shrink-0', theme === 'dark' ? 'text-[#abb3bf]' : 'text-[#5f6b7c]')} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
          <span className={cn('shrink-0 whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.3px]', theme === 'dark' ? 'text-[#abb3bf]' : 'text-[#5f6b7c]')}>GROUP BY</span>
          <InputGroup
            small
            placeholder=""
            value={groupByClauseInput}
            onChange={(e) => onGroupByChange(e.target.value)}
            className="filter-input min-w-[60px] flex-1"
            disabled={disabled}
          />
        </div>
        <div className={cn('h-5 w-px shrink-0', theme === 'dark' ? 'bg-[#3e3e42]' : 'bg-[#e1e5e9]')} />
        <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2 first:pl-0">
          <svg className={cn('shrink-0', theme === 'dark' ? 'text-[#abb3bf]' : 'text-[#5f6b7c]')} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="13" y2="6"/>
            <line x1="4" y1="12" x2="11" y2="12"/>
            <line x1="4" y1="18" x2="11" y2="18"/>
            <polyline points="15 15 18 18 21 15"/>
            <line x1="18" y1="6" x2="18" y2="18"/>
          </svg>
          <span className={cn('shrink-0 whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.3px]', theme === 'dark' ? 'text-[#abb3bf]' : 'text-[#5f6b7c]')}>ORDER BY</span>
          <InputGroup
            small
            placeholder=""
            value={orderByClauseInput}
            onChange={(e) => onOrderByChange(e.target.value)}
            className="filter-input min-w-[60px] flex-1"
            disabled={disabled}
          />
        </div>
      </div>
      <div className={cn('ml-2 flex shrink-0 items-center gap-2 border-l pl-3', theme === 'dark' ? 'border-[#3e3e42]' : 'border-[#e1e5e9]')}>
        <Button
          small
          minimal
          onClick={onReset}
          disabled={disabled}
        >
          {labels.reset}
        </Button>
        <Button
          small
          intent={Intent.PRIMARY}
          onClick={onApply}
          disabled={disabled}
        >
          {labels.confirm}
        </Button>
      </div>
    </div>
  );
};

