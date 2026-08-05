import React, { useCallback, useState, useRef, useEffect } from 'react';
import { FocusStyleManager } from '@blueprintjs/core';
import { MenuBar } from './MenuBar';
import { ToolBar } from './ToolBar';
import { StatusBar } from './StatusBar';
import { Sidebar } from './Sidebar';
import { TabContainer } from './TabContainer';
import { Resizer } from './Resizer';
import { RightQuickBar } from './RightQuickBar';
import { ExecutionLogDock } from './ExecutionLogDock';
import { NotificationCenter } from '../NotificationCenter';
import { useAppStore } from '../../stores';
import { cn } from '@/lib/cn';

// 禁用Blueprint的焦点轮廓样式（更适合桌面应用）
FocusStyleManager.onlyShowFocusOnTabs();

// 侧边栏宽度限制
const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 600;

export const MainLayout: React.FC = () => {
  const {
    theme,
    sidebarCollapsed,
    sidebarWidth,
    statusBarVisible,
    executionLogVisible,
    toggleExecutionLogVisible,
    toggleSidebar,
    setSidebarWidth,
  } = useAppStore();
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [executionLogHeight, setExecutionLogHeight] = useState(280);
  const notificationButtonRef = useRef<HTMLDivElement>(null);

  const handleResize = useCallback((delta: number) => {
    setSidebarWidth(Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, sidebarWidth + delta)));
  }, [sidebarWidth, setSidebarWidth]);

  const handleToggleNotificationCenter = useCallback(() => {
    setIsNotificationCenterOpen((prev) => !prev);
  }, []);

  const handleCloseNotificationCenter = useCallback(() => {
    setIsNotificationCenterOpen(false);
  }, []);

  // 点击外部区域关闭通知中心
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isNotificationCenterOpen &&
        notificationButtonRef.current &&
        !notificationButtonRef.current.contains(event.target as Node)
      ) {
        // 检查点击的是否是通知中心面板内部
        const notificationPanel = document.querySelector('.notification-center-panel');
        if (notificationPanel && !notificationPanel.contains(event.target as Node)) {
          setIsNotificationCenterOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotificationCenterOpen]);

  return (
    <div
      className={cn(
        'flex h-screen w-screen flex-col overflow-hidden',
        theme === 'dark' ? 'bg-[#1e1e1e] text-[#cccccc]' : 'bg-[#f3f3f3] text-[#333333]',
        `bp5-${theme}`,
      )}
      data-theme={theme}
    >
      {/* 顶部菜单栏 - 30px */}
      <div className={cn('h-[30px] flex-shrink-0 border-b', theme === 'dark' ? 'border-[#3e3e42]' : 'border-[#e0e0e0]')}>
        <MenuBar />
      </div>

      {/* 工具栏 - 48px (比菜单栏大) */}
      <div className={cn('h-[84px] flex-shrink-0 border-b px-2 py-1', theme === 'dark' ? 'border-[#3e3e42]' : 'border-[#e0e0e0]')}>
        <ToolBar />
      </div>

      {/* 主内容区 */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* 左侧可折叠边栏 */}
        <Sidebar
          collapsed={sidebarCollapsed}
          width={sidebarWidth}
          onToggle={toggleSidebar}
        />

        {/* 可拖动分隔条 */}
        {!sidebarCollapsed && (
          <Resizer onResize={handleResize} />
        )}

        {/* 右侧标签页区域 */}
        <div className={cn('min-w-0 flex-1 overflow-hidden', theme === 'dark' ? 'bg-[#1e1e1e]' : 'bg-[#f3f3f3]')}>
          <TabContainer />
        </div>

        {/* 右侧快捷栏 */}
        <RightQuickBar />
      </div>

      <ExecutionLogDock
        visible={executionLogVisible}
        onToggle={toggleExecutionLogVisible}
        height={executionLogHeight}
        onHeightChange={setExecutionLogHeight}
      />

      {/* 底部状态栏 - 32px（V2 底部导航状态栏：容纳元数据树层级图标） */}
      {statusBarVisible && (
        <div className={cn('h-8 flex-shrink-0 border-t', theme === 'dark' ? 'border-[#3e3e42]' : 'border-[#e0e0e0]')} ref={notificationButtonRef}>
          <StatusBar
            onToggleNotificationCenter={handleToggleNotificationCenter}
            isNotificationCenterOpen={isNotificationCenterOpen}
          />
        </div>
      )}

      {/* 通知中心面板 */}
      <NotificationCenter
        isOpen={isNotificationCenterOpen}
        onClose={handleCloseNotificationCenter}
      />
    </div>
  );
};
