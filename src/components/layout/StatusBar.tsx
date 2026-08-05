import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Tooltip } from '@blueprintjs/core';
import { Moon, Sun, PanelLeft, Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore, useConnectionStore, useMetadataStore, useNotificationStore } from '../../stores';
import { useTraceTarget } from '@/hooks';
import { SYSTEM_DATABASES } from '@/features/metadata-tree';
import { MySqlConnectionIcon, DatabaseIcon } from '@/components/icons';
import { cn } from '@/lib/cn';

interface StatusBarProps {
  onToggleNotificationCenter: () => void;
  isNotificationCenterOpen: boolean;
}

// ─── 状态栏层级模型 ───
type StatusLevelKind = 'connection' | 'database';

interface StatusLevelItem {
  kind: StatusLevelKind;
  label: string;
  active: boolean;
}

// 层级图标渲染映射：与元数据树图标一致（未打开=灰、打开=绿/正常）
const levelIconRenderers: Record<StatusLevelKind, (active: boolean, label: string) => React.ReactNode> = {
  connection: (active) => <MySqlConnectionIcon active={active} size={16} />,
  database: (active, label) => (
    <DatabaseIcon opened={active} isSystemDb={SYSTEM_DATABASES.has(label.toLowerCase())} size={16} />
  ),
};

// 按痕迹推导当前层级图标链：连接存在才渲染；数据库仅在痕迹选中时追加
const buildLevelItems = (
  connection: ReturnType<typeof useTraceTarget>['connection'],
  connectionOpen: boolean,
  database: string | undefined,
  databaseOpened: boolean,
): StatusLevelItem[] => {
  const items: StatusLevelItem[] = [];
  if (!connection) return items;
  items.push({
    kind: 'connection',
    label: connection.name || `${connection.host}:${connection.port}`,
    active: connectionOpen,
  });
  if (database) {
    items.push({ kind: 'database', label: database, active: databaseOpened });
  }
  return items;
};

// ─── 逐级统计（文本规则） ───
// 连接层级（无痕迹 / 连接未打开）→ 全部连接总数；
// 连接已打开 → 该连接下数据库总数；选中数据库（无论是否展开）→ 当前数据库内表总数。
type StatsKind = 'connections' | 'databases' | 'tables';

const useStatusBarStats = () => {
  const connections = useConnectionStore((s) => s.connections);
  const trace = useTraceTarget();
  const { connection, connectionOpen, database } = trace;
  const [dbCount, setDbCount] = useState(0);
  const [tableCount, setTableCount] = useState(0);

  const statsKind = useMemo<StatsKind>(() => {
    if (!connection || !connectionOpen) return 'connections';
    if (!database) return 'databases';
    return 'tables';
  }, [connection, connectionOpen, database]);

  useEffect(() => {
    let cancelled = false;
    if (statsKind === 'databases' && connection) {
      // 连接已打开：该连接下数据库总数（metadataStore 缓存，树加载过则直接命中）
      useMetadataStore.getState()
        .fetchDatabases(connection)
        .then((dbs) => {
          if (!cancelled) setDbCount(dbs.length);
        })
        .catch(() => {
          if (!cancelled) setDbCount(0);
        });
    } else if (statsKind === 'tables' && connection && database) {
      // 选中数据库：当前数据库内表总数（删除表/数据库后 invalidate 会失效缓存自动重算）
      useMetadataStore.getState()
        .fetchTables(connection, database)
        .then((tables) => {
          if (!cancelled) setTableCount(tables.length);
        })
        .catch(() => {
          if (!cancelled) setTableCount(0);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [statsKind, connection, database]);

  const count =
    statsKind === 'connections' ? connections.length : statsKind === 'databases' ? dbCount : tableCount;
  return { statsKind, count };
};

export const StatusBar: React.FC<StatusBarProps> = ({
  onToggleNotificationCenter,
  isNotificationCenterOpen,
}) => {
  const { theme, toggleTheme, statusMessage, sidebarCollapsed, toggleSidebar } = useAppStore();
  const { markAllAsRead, getUnreadCount } = useNotificationStore();
  const { t } = useTranslation();

  const unreadCount = useMemo(() => getUnreadCount(), [getUnreadCount]);
  const { statsKind, count } = useStatusBarStats();
  const trace = useTraceTarget();
  const levelItems = buildLevelItems(
    trace.connection,
    trace.connectionOpen,
    trace.database,
    trace.databaseOpened,
  );

  // 当通知中心打开时，标记所有通知为已读
  useEffect(() => {
    if (isNotificationCenterOpen) {
      markAllAsRead();
    }
  }, [isNotificationCenterOpen, markAllAsRead]);

  const handleToggleNotificationCenter = useCallback(() => {
    onToggleNotificationCenter();
  }, [onToggleNotificationCenter]);

  const dividerClass = cn('h-4 w-px flex-shrink-0', theme === 'dark' ? 'bg-[#3e3e42]' : 'bg-[#e0e0e0]');

  return (
    <div className={cn('flex h-full items-center justify-between px-2 text-xs', `bp5-${theme}`)}>
      {/* 左侧：逐级统计数字 + 逐级图标链（随痕迹动态变化） */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="flex shrink-0 items-center whitespace-nowrap">
          {count} {t(`statusBar.${statsKind}`)}
        </span>

        <span className={dividerClass} />

        {/* 图标链：连接图标[连接名] > 数据库图标[数据库名]（未打开灰 / 打开绿） */}
        {levelItems.length > 0 ? (
          <span className="flex shrink-0 items-center gap-1.5">
            {levelItems.map((item, index) => (
              <React.Fragment key={`${item.kind}:${item.label}`}>
                {index > 0 && (
                  <span className={cn('text-[11px]', theme === 'dark' ? 'text-[#666666]' : 'text-[#999999]')}>
                    &gt;
                  </span>
                )}
                <span className="flex items-center gap-1">
                  {levelIconRenderers[item.kind](item.active, item.label)}
                  <span
                    className={cn(
                      'max-w-40 truncate',
                      item.active
                        ? theme === 'dark' ? 'text-[#cccccc]' : 'text-[#333333]'
                        : theme === 'dark' ? 'text-[#858585]' : 'text-[#999999]',
                    )}
                  >
                    {item.label}
                  </span>
                </span>
              </React.Fragment>
            ))}
          </span>
        ) : null}

        {/* 操作反馈消息（保存/连接/刷新等），保留在图标链后截断显示 */}
        {statusMessage && (
          <span className={cn('min-w-0 flex-1 truncate', theme === 'dark' ? 'text-[#858585]' : 'text-[#666666]')}>
            {statusMessage}
          </span>
        )}
      </div>

      {/* 右侧工具按钮（随状态栏高度增大） */}
      <div className="flex shrink-0 items-center gap-2">
        <Tooltip content={sidebarCollapsed ? t('statusBar.showSidebar') : t('statusBar.hideSidebar')}>
          <Button
            minimal
            small
            className={cn(
              '!p-1 !min-w-6 !min-h-6 transition-colors duration-150',
              theme === 'dark' ? '!text-[#858585] hover:!text-[#cccccc]' : '!text-[#666666] hover:!text-[#333333]',
            )}
            onClick={toggleSidebar}
          >
            <PanelLeft size={18} />
          </Button>
        </Tooltip>

        <Tooltip content={theme === 'dark' ? t('statusBar.switchToLight') : t('statusBar.switchToDark')}>
          <Button
            minimal
            small
            className={cn(
              '!p-1 !min-w-6 !min-h-6 transition-colors duration-150',
              theme === 'dark' ? '!text-[#858585] hover:!text-[#cccccc]' : '!text-[#666666] hover:!text-[#333333]',
            )}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </Button>
        </Tooltip>

        <Tooltip content={t('notification.title')}>
          <Button
            minimal
            small
            className={cn(
              'relative !p-1 !min-w-6 !min-h-6 transition-colors duration-150',
              theme === 'dark' ? '!text-[#858585] hover:!text-[#cccccc]' : '!text-[#666666] hover:!text-[#333333]',
              isNotificationCenterOpen && (theme === 'dark' ? '!bg-[#094771]' : '!bg-[#007acc]'),
            )}
            onClick={handleToggleNotificationCenter}
          >
            <div className="relative flex h-4 w-4 items-center justify-center">
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#f44336] px-1 text-[10px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
          </Button>
        </Tooltip>
      </div>
    </div>
  );
};
