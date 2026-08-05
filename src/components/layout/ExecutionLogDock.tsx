import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Tooltip } from '@blueprintjs/core';
import { ChevronLeft, ChevronRight, ChevronsDown, PanelBottomClose, Radio, RadioTower, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { useExecutionLogStore } from '@/stores';
import { useAppStore } from '@/stores/appStore';
import type { ExecutionLogItem } from '@/types/app';

interface ExecutionLogDockProps {
  visible: boolean;
  onToggle: () => void;
  height: number;
  onHeightChange: (height: number) => void;
}

const MIN_DOCK_HEIGHT = 180;
const MAX_DOCK_HEIGHT = 620;

const clampDockHeight = (next: number): number => {
  const viewportMax = Math.max(MIN_DOCK_HEIGHT, Math.floor(window.innerHeight * 0.72));
  return Math.min(Math.max(next, MIN_DOCK_HEIGHT), Math.min(MAX_DOCK_HEIGHT, viewportMax));
};

const formatLogTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const base = date.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return `${base}.${String(date.getMilliseconds()).padStart(3, '0')}`;
};

export const ExecutionLogDock: React.FC<ExecutionLogDockProps> = ({
  visible,
  onToggle,
  height,
  onHeightChange,
}) => {
  const { t } = useTranslation();
  const { theme } = useAppStore();
  const isDark = theme === 'dark';

  const clearLogs = useExecutionLogStore((state) => state.clearLogs);
  const logPages = useExecutionLogStore((state) => state.logPages);
  const totalLogs = useExecutionLogStore((state) => state.totalLogs);
  const activePage = useExecutionLogStore((state) => state.activePage);
  const pageSize = useExecutionLogStore((state) => state.pageSize);
  const setActivePage = useExecutionLogStore((state) => state.setActivePage);

  const [autoFollow, setAutoFollow] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartYRef = useRef(0);
  const resizeStartHeightRef = useRef(height);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToLatest = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
  }, []);

  const totalPages = Math.max(logPages.length, 1);
  const logs = useMemo(() => {
    const page = Math.min(Math.max(activePage, 1), totalPages);
    return logPages[page - 1] ?? [];
  }, [activePage, totalPages, logPages]);

  useEffect(() => {
    if (!visible || !autoFollow) {
      return;
    }
    scrollToLatest();
  }, [logs.length, activePage, visible, autoFollow, scrollToLatest]);

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const onMouseMove = (event: MouseEvent) => {
      const deltaY = event.clientY - resizeStartYRef.current;
      const nextHeight = clampDockHeight(resizeStartHeightRef.current - deltaY);
      onHeightChange(nextHeight);
    };

    const onMouseUp = () => {
      setIsResizing(false);
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizing, onHeightChange]);

  const handleResizeStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!visible) {
      return;
    }
    event.preventDefault();
    resizeStartYRef.current = event.clientY;
    resizeStartHeightRef.current = height;
    setIsResizing(true);
  }, [visible, height]);

  const handleJumpLatest = useCallback(() => {
    setAutoFollow(true);
    setActivePage(totalPages);
    requestAnimationFrame(scrollToLatest);
  }, [setActivePage, totalPages, scrollToLatest]);

  const getLogLineBorderColor = (level: ExecutionLogItem['level']): string => {
    switch (level) {
      case 'INFO':
        return 'rgba(88,214,141,0.45)';
      case 'WARN':
        return 'rgba(246,193,119,0.5)';
      case 'ERROR':
        return 'rgba(245,139,139,0.56)';
      default:
        return 'transparent';
    }
  };

  const getLogLineBg = (level: ExecutionLogItem['level']): string | undefined => {
    switch (level) {
      case 'WARN':
        return isDark ? 'rgba(245,178,89,0.08)' : 'rgba(189,140,56,0.12)';
      case 'ERROR':
        return isDark ? 'rgba(245,139,139,0.1)' : 'rgba(188,66,66,0.09)';
      default:
        return undefined;
    }
  };

  const getLevelColor = (level: ExecutionLogItem['level']): string => {
    if (isDark) {
      switch (level) {
        case 'INFO':
          return '#58d68d';
        case 'WARN':
          return '#f6c177';
        case 'ERROR':
          return '#f58b8b';
      }
    } else {
      switch (level) {
        case 'INFO':
          return '#156f2c';
        case 'WARN':
          return '#8a5602';
        case 'ERROR':
          return '#aa2e2e';
      }
    }
    return isDark ? '#9cecb0' : '#1f7431';
  };

  const dividerColor = isDark ? '#3e3e42' : '#e0e0e0';
  const listBg = isDark
    ? 'radial-gradient(circle at 100% 0, rgba(20, 80, 44, 0.38), transparent 40%), linear-gradient(180deg, #0f1412 0%, #111a16 100%)'
    : 'radial-gradient(circle at 100% 0, rgba(118, 173, 129, 0.18), transparent 40%), linear-gradient(180deg, #f7fff9 0%, #eef7f0 100%)';
  const listTextColor = isDark ? '#d7f5dd' : '#214528';
  const timeColor = isDark ? 'rgba(129,200,140,0.8)' : 'rgba(39,95,51,0.7)';

  return (
    <div
      className={cn(
        'flex-shrink-0 flex flex-col overflow-hidden transition-[height,border-color] duration-[180ms] ease-out',
        isResizing && 'transition-none',
        !visible && 'h-0'
      )}
      style={{
        height: visible ? `${height}px` : 0,
        borderTopWidth: '1px',
        borderTopStyle: 'solid',
        borderTopColor: visible ? dividerColor : 'transparent',
        backgroundColor: 'var(--bp5-app-background-color)',
        color: 'var(--bp5-text-color)',
      }}
    >
      {visible && (
        <>
          <div
            className="group h-2 flex-shrink-0 flex items-center justify-center cursor-row-resize bg-transparent"
            onMouseDown={handleResizeStart}
          >
            <div
              className={cn(
                'w-[42px] h-[2px] rounded-sm transition-all duration-150',
                isResizing
                  ? 'bg-[#007acc] opacity-[0.95]'
                  : 'bg-[var(--bp5-divider-black)] opacity-[0.55] group-hover:bg-[#007acc] group-hover:opacity-[0.95]'
              )}
            />
          </div>

          <div
            className="h-[34px] flex-shrink-0 flex items-center justify-between px-2"
            style={{ borderBottom: `1px solid ${dividerColor}` }}
          >
            <div className="text-xs font-semibold" style={{ color: 'var(--bp5-text-color-muted)' }}>
              {t('sidebar.executionLog.title')}
            </div>
            <div className="flex items-center gap-0.5">
              <Tooltip
                content={autoFollow ? t('sidebar.executionLog.autoFollowOn') : t('sidebar.executionLog.autoFollowOff')}
              >
                <Button
                  minimal
                  small
                  className={cn('!min-w-[24px] !min-h-[24px]', autoFollow && '!text-[#007acc]')}
                  onClick={() => {
                    setAutoFollow((value) => {
                      const next = !value;
                      if (next) {
                        setActivePage(totalPages);
                        requestAnimationFrame(scrollToLatest);
                      }
                      return next;
                    });
                  }}
                >
                  {autoFollow ? <RadioTower size={14} /> : <Radio size={14} />}
                </Button>
              </Tooltip>
              <Tooltip content={t('sidebar.executionLog.jumpLatest')}>
                <Button minimal small className="!min-w-[24px] !min-h-[24px]" onClick={handleJumpLatest}>
                  <ChevronsDown size={14} />
                </Button>
              </Tooltip>
              <Tooltip content={t('sidebar.executionLog.clear')}>
                <Button minimal small className="!min-w-[24px] !min-h-[24px]" onClick={clearLogs}>
                  <Trash2 size={14} />
                </Button>
              </Tooltip>
              <Tooltip content={t('sidebar.executionLog.hide')}>
                <Button minimal small className="!min-w-[24px] !min-h-[24px]" onClick={onToggle}>
                  <PanelBottomClose size={14} />
                </Button>
              </Tooltip>
            </div>
          </div>

          {totalLogs === 0 ? (
            <div
              className="h-full flex flex-col items-center justify-center gap-2 text-center p-4"
              style={{ color: 'var(--bp5-text-color-muted)' }}
            >
              <div className="text-[13px]">{t('sidebar.executionLog.emptyTitle')}</div>
              <div className="text-xs">{t('sidebar.executionLog.emptyHint')}</div>
            </div>
          ) : (
            <div className="h-full flex flex-col min-h-0">
              <div
                className="flex-1 min-h-0 overflow-auto p-[10px_10px_6px] font-mono text-xs leading-[1.6]"
                style={{ color: listTextColor, background: listBg }}
                role="log"
                aria-live="polite"
              >
                {logs.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-2 mb-[5px] py-[3px] px-1 rounded-[4px] whitespace-pre-wrap break-words border-l-2"
                    style={{
                      borderLeftColor: getLogLineBorderColor(item.level),
                      backgroundColor: getLogLineBg(item.level),
                    }}
                  >
                    <span className="flex-shrink-0" style={{ color: timeColor }}>
                      [{formatLogTime(item.timestamp)}]
                    </span>
                    <span
                      className="flex-shrink-0 tracking-[0.3px]"
                      style={{ color: getLevelColor(item.level) }}
                    >
                      [{item.level}]
                    </span>
                    <span className="flex-1 min-w-0">{item.message}</span>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <div
                className="h-[34px] flex-shrink-0 flex items-center justify-between px-2 font-mono text-[11px]"
                style={{
                  borderTop: `1px solid ${isDark ? 'rgba(118,156,124,0.25)' : 'rgba(89,135,99,0.24)'}`,
                  background: isDark ? 'rgba(9,13,10,0.3)' : 'rgba(235,245,237,0.8)',
                }}
              >
                <div
                  className="whitespace-nowrap overflow-hidden text-ellipsis"
                  style={{ color: 'var(--bp5-text-color-muted)' }}
                >
                  {t('sidebar.executionLog.pageInfo', {
                    current: activePage,
                    total: totalPages,
                    pageSize,
                    totalLogs,
                  })}
                </div>
                <div className="flex items-center gap-0.5">
                  <Button
                    minimal
                    small
                    disabled={activePage <= 1}
                    onClick={() => {
                      setAutoFollow(false);
                      setActivePage(activePage - 1);
                    }}
                    className="!min-w-[24px] !min-h-[24px]"
                  >
                    <ChevronLeft size={14} />
                  </Button>
                  <Button
                    minimal
                    small
                    disabled={activePage >= totalPages}
                    onClick={() => {
                      setAutoFollow(false);
                      setActivePage(activePage + 1);
                    }}
                    className="!min-w-[24px] !min-h-[24px]"
                  >
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
