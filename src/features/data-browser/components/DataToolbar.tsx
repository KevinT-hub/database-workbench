// 数据浏览共享工具栏：刷新/新增/删除/预览/撤销/提交 + 选中信息 +
// 导入导出格式选择。视图场景通过 readOnly / showImport / infoSlot 收敛差异。

import React from 'react';
import { Button, ButtonGroup, HTMLSelect, Intent, Position, Tooltip } from '@blueprintjs/core';
import type { ExportFormat } from '@/types';
import {
  RefreshIcon,
  AddRowIcon,
  DeleteRowIcon,
  SubmitIcon,
  WithdrawIcon,
  PreviewIcon,
  ExportCsvIcon,
  ImportIcon,
} from '@/components/icons/ActionIcons';
import { useAppStore } from '@/stores';
import { cn } from '@/lib/cn';

interface DataToolbarLabels {
  refreshTip: string;
  refresh: string;
  addRowTip: string;
  addRow: string;
  deleteRowTip: string;
  deleteRow: string;
  previewTip: string;
  preview: string;
  withdrawTip: string;
  withdraw: string;
  submitTip: string;
  submit: string;
  changesIndicator: (count: number) => React.ReactNode;
  rowsSelected: (count: number) => string;
  /** 仅在 showImport=true 时使用 */
  importTip?: string;
  /** 仅在 showImport=true 时使用 */
  import?: string;
  exportTip: string;
  export: string;
}

interface DataToolbarProps {
  /** 视图只读时隐藏编辑类动作（新增/删除/预览/撤销/提交） */
  readOnly?: boolean;
  /** 表页显示导入按钮；视图页不提供导入 */
  showImport: boolean;
  isLoading: boolean;
  hasChanges: boolean;
  dirtyCount: number;
  selectedCount: number;
  exportFormat: ExportFormat;
  formatOptions: { value: ExportFormat; label: string }[];
  onExportFormatChange: (format: ExportFormat) => void;
  onRefresh: () => void;
  onAddRow: () => void;
  onDeleteRow: () => void;
  onPreview: () => void;
  onWithdraw: () => void;
  onSubmit: () => void;
  onImport: () => void;
  onExport: () => void;
  exportDisabled: boolean;
  /** 视图页的“视图数据”提示插槽 */
  infoSlot?: React.ReactNode;
  labels: DataToolbarLabels;
}

export const DataToolbar: React.FC<DataToolbarProps> = ({
  readOnly = false,
  showImport,
  isLoading,
  hasChanges,
  dirtyCount,
  selectedCount,
  exportFormat,
  formatOptions,
  onExportFormatChange,
  onRefresh,
  onAddRow,
  onDeleteRow,
  onPreview,
  onWithdraw,
  onSubmit,
  onImport,
  onExport,
  exportDisabled,
  infoSlot,
  labels,
}) => {
  const { theme } = useAppStore();

  return (
    <div className={cn(
      'flex flex-shrink-0 items-center gap-3 border-b px-3 py-1.5',
      theme === 'dark' ? 'border-[#3e3e42] bg-[#252a31]' : 'border-[#e1e5e9] bg-[#f5f6f7]',
    )}>
      <ButtonGroup minimal>
        <Tooltip content={labels.refreshTip} position={Position.BOTTOM}>
          <Button
            small
            icon={<RefreshIcon />}
            onClick={onRefresh}
            disabled={isLoading}
          >
            {labels.refresh}
          </Button>
        </Tooltip>
        {!readOnly && (
          <>
            <Tooltip content={labels.addRowTip} position={Position.BOTTOM}>
              <Button
                small
                icon={<AddRowIcon />}
                onClick={onAddRow}
                disabled={isLoading}
              >
                {labels.addRow}
              </Button>
            </Tooltip>
            <Tooltip content={labels.deleteRowTip} position={Position.BOTTOM}>
              <Button
                small
                icon={<DeleteRowIcon />}
                onClick={onDeleteRow}
                disabled={isLoading || selectedCount === 0 || hasChanges}
                intent={selectedCount > 0 && !hasChanges ? Intent.DANGER : Intent.NONE}
              >
                {labels.deleteRow}
              </Button>
            </Tooltip>
            <Tooltip content={labels.previewTip} position={Position.BOTTOM}>
              <Button
                small
                icon={<PreviewIcon />}
                onClick={onPreview}
                disabled={isLoading || !hasChanges}
              >
                {labels.preview}
              </Button>
            </Tooltip>
            <Tooltip content={labels.withdrawTip} position={Position.BOTTOM}>
              <Button
                small
                icon={<WithdrawIcon />}
                onClick={onWithdraw}
                disabled={isLoading || !hasChanges}
              >
                {labels.withdraw}
              </Button>
            </Tooltip>
            <Tooltip content={labels.submitTip} position={Position.BOTTOM}>
              <Button
                small
                icon={<SubmitIcon />}
                onClick={onSubmit}
                disabled={isLoading || !hasChanges}
                intent={hasChanges ? Intent.PRIMARY : Intent.NONE}
              >
                {labels.submit}
              </Button>
            </Tooltip>
          </>
        )}
      </ButtonGroup>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        {hasChanges && !readOnly && (
          <span className="text-xs font-medium text-[#4299FF]">
            {labels.changesIndicator(dirtyCount)}
          </span>
        )}
        {selectedCount > 0 && (
          <span className={cn('text-xs', theme === 'dark' ? 'text-[#abb3bf]' : 'text-[#5f6b7c]')}>
            {labels.rowsSelected(selectedCount)}
          </span>
        )}
        {infoSlot}
      </div>

      {/* Format Selection and Import/Export - 放在最右侧 */}
      <div className="flex items-center gap-2">
        <HTMLSelect
          className="min-w-[60px]"
          value={exportFormat}
          onChange={(e) => onExportFormatChange(e.target.value as ExportFormat)}
          options={formatOptions}
          disabled={isLoading}
        />
        {showImport && (
          <Tooltip content={labels.importTip} position={Position.BOTTOM}>
            <Button
              icon={<ImportIcon />}
              onClick={onImport}
              disabled={isLoading || exportFormat === 'html' || exportFormat === 'sql'}
            >
              {labels.import}
            </Button>
          </Tooltip>
        )}
        <Tooltip content={labels.exportTip} position={Position.BOTTOM}>
          <Button
            icon={<ExportCsvIcon />}
            onClick={onExport}
            disabled={exportDisabled}
          >
            {labels.export}
          </Button>
        </Tooltip>
      </div>
    </div>
  );
};

