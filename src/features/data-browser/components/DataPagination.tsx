// 数据浏览共享分页栏：行数信息 + 每页条数 + 页码跳转。

import React from 'react';
import { Button, HTMLSelect } from '@blueprintjs/core';
import { useAppStore } from '@/stores';
import { cn } from '@/lib/cn';

interface DataPaginationLabels {
  showingRows: (start: number, end: number, total: number) => string;
  pageSize: string;
  pageInfo: (page: number, totalPages: number) => string;
}

interface DataPaginationProps {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  offset: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  labels: DataPaginationLabels;
}

export const DataPagination: React.FC<DataPaginationProps> = ({
  page,
  pageSize,
  totalRows,
  totalPages,
  offset,
  onPageChange,
  onPageSizeChange,
  labels,
}) => {
  const { theme } = useAppStore();

  return (
    <div className={cn(
      'flex flex-shrink-0 items-center justify-between border-t px-3 py-2',
      theme === 'dark' ? 'border-[#374151] bg-[#1f2937]' : 'border-[#e1e5e9] bg-[#f8f9fa]',
    )}>
      <div className={cn('text-xs', theme === 'dark' ? 'text-[#e5e7eb]' : 'text-[#6c757d]')}>
        {labels.showingRows(offset + 1, Math.min(offset + pageSize, totalRows), totalRows)}
      </div>
      <div className="flex items-center gap-2">
        <span className={cn('text-xs', theme === 'dark' ? 'text-[#e5e7eb]' : 'text-[#6c757d]')}>{labels.pageSize}</span>
        <HTMLSelect
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          options={[
            { value: '50', label: '50' },
            { value: '100', label: '100' },
            { value: '200', label: '200' },
            { value: '500', label: '500' },
            { value: '1000', label: '1000' },
          ]}
        />
        <Button
          small
          minimal
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
        >
          {'<<'}
        </Button>
        <Button
          small
          minimal
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {'<'}
        </Button>
        <span className={cn('px-2 text-xs', theme === 'dark' ? 'text-[#e5e7eb]' : 'text-[#495057]')}>
          {labels.pageInfo(page, totalPages || 1)}
        </span>
        <Button
          small
          minimal
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {'>'}
        </Button>
        <Button
          small
          minimal
          disabled={page >= totalPages}
          onClick={() => onPageChange(totalPages)}
        >
          {'>>'}
        </Button>
      </div>
    </div>
  );
};

