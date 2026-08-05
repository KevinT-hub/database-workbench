// 表设计器“SQL 预览”Tab：只读展示生成的 SQL。

import React from 'react';
import { ReadOnlySqlEditor } from './ReadOnlySqlEditor';
import { cn } from '@/lib/cn';

interface SqlPreviewTabProps {
  generatedSql: string;
  appTheme: 'light' | 'dark';
}

export const SqlPreviewTab: React.FC<SqlPreviewTabProps> = ({ generatedSql, appTheme }) => {
  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <div className={cn('min-h-0 flex-1 overflow-hidden rounded border', appTheme === 'dark' ? 'border-[#374151]' : 'border-[#e1e5e9]')}>
        <ReadOnlySqlEditor value={generatedSql} appTheme={appTheme} />
      </div>
    </div>
  );
};

