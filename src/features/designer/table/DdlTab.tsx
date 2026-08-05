// 表设计器“DDL”Tab：只读展示当前表的原始 DDL。

import React from 'react';
import { ReadOnlySqlEditor } from './ReadOnlySqlEditor';
import { cn } from '@/lib/cn';

interface DdlTabProps {
  ddl: string;
  appTheme: 'light' | 'dark';
}

export const DdlTab: React.FC<DdlTabProps> = ({ ddl, appTheme }) => {
  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <div className={cn('min-h-0 flex-1 overflow-hidden rounded border', appTheme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
        <ReadOnlySqlEditor value={ddl} appTheme={appTheme} />
      </div>
    </div>
  );
};

