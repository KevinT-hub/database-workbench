import React from 'react';
import { Button, Tooltip } from '@blueprintjs/core';
import { Search, PanelLeftClose, PanelLeftOpen, X, Database, TerminalSquare, SlidersHorizontal, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MetadataTree } from '@/features/metadata-tree';
import { useAppStore } from '../../stores';
import { cn } from '@/lib/cn';

interface SidebarProps {
  collapsed: boolean;
  width: number;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  width,
  onToggle,
}) => {
  const { theme, executionLogVisible, toggleExecutionLogVisible } = useAppStore();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = React.useState('');

  const handleOpenProperties = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent('dbw:open-properties-dialog'));
  }, []);

  const handleOpenOptions = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent('dbw:open-options-dialog'));
  }, []);

  return (
    <>
      <div
        className={cn(
          'flex w-8 flex-shrink-0 flex-col items-center border-r pt-2',
          theme === 'dark' ? 'border-[#3e3e42] bg-[#1e1e1e]' : 'border-[#e0e0e0] bg-[#f3f3f3]',
          `bp5-${theme}`,
        )}
        style={{ display: collapsed ? 'flex' : 'none' }}
      >
        <Tooltip content={t('sidebar.expandSidebar')} position="right">
          <Button
            minimal
            small
            className="!p-1 !min-w-6 !min-h-6"
            onClick={onToggle}
          >
            <PanelLeftOpen size={18} />
          </Button>
        </Tooltip>
      </div>

      <div
        className={cn(
          'flex flex-shrink-0 flex-row border-r transition-[width] duration-200',
          theme === 'dark' ? 'border-[#3e3e42] bg-[#1e1e1e]' : 'border-[#e0e0e0] bg-[#f3f3f3]',
          `bp5-${theme}`,
        )}
        style={{ width, display: collapsed ? 'none' : 'flex' }}
      >
        <div className={cn(
          'flex w-10 flex-shrink-0 flex-col items-center gap-1 border-r px-1 py-2',
          theme === 'dark' ? 'border-[#3e3e42]' : 'border-[#e0e0e0]',
        )}>
          <Tooltip content="数据源" position="right">
            <button
              className={cn(
                'flex h-[30px] w-[30px] items-center justify-center rounded-md border-none bg-transparent transition-all duration-150',
                theme === 'dark' ? 'text-[#858585]' : 'text-[#666666]',
                theme === 'dark'
                  ? 'bg-[#094771] text-[#f5f8fa] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]'
                  : 'bg-[#007acc] text-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]',
              )}
              type="button"
            >
              <Database size={16} />
            </button>
          </Tooltip>
          <Tooltip content={executionLogVisible ? t('sidebar.executionLog.hide') : t('sidebar.executionLog.show')} position="right">
            <button
              className={cn(
                'flex h-[30px] w-[30px] items-center justify-center rounded-md border-none bg-transparent transition-all duration-150',
                theme === 'dark' ? 'text-[#858585]' : 'text-[#666666]',
                executionLogVisible &&
                  (theme === 'dark'
                    ? 'bg-[#094771] text-[#f5f8fa] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]'
                    : 'bg-[#007acc] text-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]'),
                !executionLogVisible && (theme === 'dark' ? 'hover:bg-[#3e3e42] hover:text-[#cccccc]' : 'hover:bg-[#e8e8e8] hover:text-[#333333]'),
              )}
              onClick={toggleExecutionLogVisible}
              type="button"
            >
              <TerminalSquare size={16} />
            </button>
          </Tooltip>
          <div className={cn('mx-0 my-0.5 h-px w-[22px]', theme === 'dark' ? 'bg-[#3e3e42]' : 'bg-[#e0e0e0]')} />
          <Tooltip content="属性" position="right">
            <button
              className={cn(
                'flex h-[30px] w-[30px] items-center justify-center rounded-md border-none bg-transparent transition-all duration-150',
                theme === 'dark' ? 'text-[#858585] hover:bg-[#3e3e42] hover:text-[#cccccc]' : 'text-[#666666] hover:bg-[#e8e8e8] hover:text-[#333333]',
              )}
              onClick={handleOpenProperties}
              type="button"
            >
              <SlidersHorizontal size={16} />
            </button>
          </Tooltip>
          <Tooltip content="选项" position="right">
            <button
              className={cn(
                'flex h-[30px] w-[30px] items-center justify-center rounded-md border-none bg-transparent transition-all duration-150',
                theme === 'dark' ? 'text-[#858585] hover:bg-[#3e3e42] hover:text-[#cccccc]' : 'text-[#666666] hover:bg-[#e8e8e8] hover:text-[#333333]',
              )}
              onClick={handleOpenOptions}
              type="button"
            >
              <Settings2 size={16} />
            </button>
          </Tooltip>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className={cn('flex items-center gap-1 border-b p-2', theme === 'dark' ? 'border-[#3e3e42]' : 'border-[#e0e0e0]')}>
            <div className={cn(
              'flex h-8 flex-1 items-center gap-1.5 rounded-[3px] border px-2 transition-[border-color,box-shadow] duration-150 focus-within:border-[#007acc] focus-within:shadow-[0_0_0_1px_#007acc]',
              theme === 'dark' ? 'border-[#3e3e42] bg-[#1e1e1e]' : 'border-[#e0e0e0] bg-[#f3f3f3]',
            )}>
              <Search size={14} className={cn('shrink-0', theme === 'dark' ? 'text-[#858585]' : 'text-[#666666]')} />
              <input
                type="text"
                className={cn(
                  'flex-1 border-none bg-transparent p-0 text-[13px] outline-none',
                  theme === 'dark' ? 'text-[#cccccc] placeholder:text-[#858585]' : 'text-[#333333] placeholder:text-[#666666]',
                )}
                placeholder={t('sidebar.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                className={cn(
                  'flex shrink-0 cursor-pointer items-center justify-center rounded-[2px] border-none bg-transparent p-0.5 transition-colors duration-150',
                  theme === 'dark' ? 'text-[#858585] hover:bg-[#3e3e42] hover:text-[#cccccc]' : 'text-[#666666] hover:bg-[#e8e8e8] hover:text-[#333333]',
                )}
                  onClick={() => setSearchQuery('')}
                  type="button"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <Tooltip content={t('sidebar.collapseSidebar')}>
              <Button
                minimal
                small
            className="!p-1 !min-w-6 !min-h-6"
                onClick={onToggle}
              >
                <PanelLeftClose size={16} />
              </Button>
            </Tooltip>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div className="absolute inset-0 min-h-0">
              <MetadataTree searchQuery={searchQuery} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
