import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore, useTabStore } from '../../stores';
import { ConnectionDialog } from '@/features/connection';
import { useTraceTarget, requireOpenConnection, requireOpenedDatabase, resolveQueryTrace } from '@/hooks';
import { cn } from '@/lib/cn';

// 工具栏按钮配置
interface ToolButton {
  id: string;
  label: string;
  iconType: 'connection' | 'query' | 'table' | 'view' | 'function' | 'backup' | 'restore' | 'refresh' | 'user';
  shortcut?: string;
  onClick: () => void;
}

// 绘制图标 - 64x64画布，缩放至40x40
const ToolbarIcon: React.FC<{ type: ToolButton['iconType']; size?: number }> = ({ type, size = 40 }) => {
  const renderIcon = () => {
    switch (type) {
      case 'connection':
        // 现代化连接图标：两个数据库圆柱体连接
        return (
          <svg width={size} height={size} viewBox="0 0 64 64">
            {/* 左侧小数据库 - 浅蓝色（远处的） */}
            <ellipse cx="18" cy="22" rx="10" ry="5" fill="#64B5F6"/>
            <rect x="8" y="22" width="20" height="16" fill="#64B5F6"/>
            <ellipse cx="18" cy="38" rx="10" ry="5" fill="#42A5F5"/>
            {/* 左侧数据库横线 */}
            <rect x="11" y="28" width="14" height="2" rx="1" fill="white" opacity="0.8"/>
            
            {/* 连接线 */}
            <rect x="26" y="30" width="8" height="4" fill="#90CAF9"/>
            
            {/* 右侧大数据库 - 深蓝色（当前的） */}
            <ellipse cx="46" cy="18" rx="14" ry="7" fill="#2196F3"/>
            <rect x="32" y="18" width="28" height="28" fill="#2196F3"/>
            <ellipse cx="46" cy="46" rx="14" ry="7" fill="#1976D2"/>
            {/* 右侧数据库横线 */}
            <rect x="36" y="28" width="20" height="3" rx="1" fill="white" opacity="0.9"/>
            <rect x="36" y="36" width="16" height="3" rx="1" fill="white" opacity="0.7"/>
          </svg>
        );
      
      case 'query':
        // 蓝色圆角矩形纸张 + 白色横线 + 绿色三角形
        return (
          <svg width={size} height={size} viewBox="0 0 64 64">
            {/* 蓝色纸张 */}
            <rect x="10" y="8" width="44" height="48" rx="8" fill="#2196F3" />
            {/* 白色横线 */}
            <rect x="18" y="18" width="28" height="4" fill="white" />
            <rect x="18" y="28" width="20" height="4" fill="white" />
            <rect x="18" y="38" width="28" height="4" fill="white" />
            {/* 绿色三角形播放按钮 */}
            <polygon points="40,40 58,52 40,64" fill="#4CAF50" />
          </svg>
        );
      
      case 'table':
        // 青色矩形表格 + 白色网格线
        return (
          <svg width={size} height={size} viewBox="0 0 64 64">
            {/* 青色背景 */}
            <rect x="8" y="12" width="48" height="40" fill="#00BCD4" />
            {/* 白色横线 */}
            <rect x="12" y="24" width="40" height="2" fill="white" />
            <rect x="12" y="36" width="40" height="2" fill="white" />
            {/* 白色竖线 */}
            <rect x="24" y="16" width="2" height="32" fill="white" />
            <rect x="40" y="16" width="2" height="32" fill="white" />
          </svg>
        );
      
      case 'view':
        // 青色圆角矩形 + 白色横线 + 深蓝色眼镜
        return (
          <svg width={size} height={size} viewBox="0 0 64 64">
            {/* 青色背景 */}
            <rect x="8" y="12" width="48" height="40" rx="4" fill="#00BCD4" />
            {/* 白色横线 */}
            <rect x="12" y="24" width="40" height="2" fill="white" />
            <rect x="12" y="36" width="40" height="2" fill="white" />
            {/* 深蓝色眼镜 */}
            <circle cx="23" cy="43" r="7" fill="none" stroke="#3F51B5" strokeWidth="4" />
            <circle cx="41" cy="43" r="7" fill="none" stroke="#3F51B5" strokeWidth="4" />
            <line x1="30" y1="43" x2="34" y2="43" stroke="#3F51B5" strokeWidth="4" />
          </svg>
        );
      
      case 'function':
        // 蓝色斜体f(x)文字
        return (
          <svg width={size} height={size} viewBox="0 0 64 64">
            <text 
              x="0" 
              y="44" 
              fill="#2196F3" 
              fontSize="34" 
              fontFamily="Serif" 
              fontStyle="normal" 
              fontWeight="bold"
            >
              f(x)
            </text>
          </svg>
        );

      case 'backup':
        // 紫色圆角矩形 + 白色横线 + 绿色向下箭头
        return (
          <svg width={size} height={size} viewBox="0 0 64 64">
            {/* 橙色数据库 */}
            <rect x="12" y="18" width="40" height="36" rx="6" fill="#9C27B0" />
            {/* 白色横线 */}
            <rect x="18" y="24" width="28" height="4" fill="white" />
            <rect x="18" y="32" width="28" height="4" fill="white" />
            {/* 绿色向上箭头 */}
            <polygon points="32,10 20,22 44,22" fill="#27AE60" />
            <rect x="28" y="22" width="8" height="10" fill="#27AE60" />
          </svg>
        );
      
      case 'restore':
        // 橙色圆角矩形 + 白色横线 + 绿色向上箭头
        return (
          <svg width={size} height={size} viewBox="0 0 64 64">
            {/* 紫色数据库 */}
            <rect x="12" y="10" width="40" height="36" rx="6" fill="#E67E22" />
            {/* 白色横线 */}
            <rect x="18" y="16" width="28" height="4" fill="white" />
            <rect x="18" y="24" width="28" height="4" fill="white" />
            {/* 绿色向下箭头 */}
            <polygon points="32,58 44,46 20,46" fill="#4CAF50" />
            <rect x="28" y="36" width="8" height="10" fill="#4CAF50" />
          </svg>
        );
      
      case 'refresh':
        // 橙色圆环 + 三角形箭头
        return (
          <svg width={size} height={size} viewBox="0 0 64 64">
            {/* 橙色圆环 */}
            <circle 
              cx="32" 
              cy="32" 
              r="20" 
              fill="none" 
              stroke="#FF9800" 
              strokeWidth="8" 
              strokeLinecap="round"
            />
            {/* 箭头三角形 */}
            <polygon points="42,12 58,22 42,32" fill="#FF9800" />
          </svg>
        );
      
      case 'user':
        // 紫色圆形头部 + 弧形身体
        return (
          <svg width={size} height={size} viewBox="0 0 64 64">
            {/* 头部 */}
            <circle cx="32" cy="20" r="10" fill="#9C27B0" />
            {/* 身体 - 使用path绘制弧形 */}
            <path 
              d="M 12 52 Q 12 34 32 34 Q 52 34 52 52" 
              fill="#9C27B0" 
            />
          </svg>
        );
      
      default:
        return null;
    }
  };

  return (
    <div style={{ width: size, height: size }}>
      {renderIcon()}
    </div>
  );
};

export const ToolBar: React.FC = () => {
  const { t } = useTranslation();
  const { theme, setStatusMessage } = useAppStore();
  const { addTab } = useTabStore();
  // 痕迹递推：根据元数据树痕迹（activeConnectionId/activeDatabase）递推当前所在
  // 连接与数据库，并内置「连接必须打开、数据库必须打开」的兜底判定。
  const trace = useTraceTarget();
  const [isConnectionDialogOpen, setIsConnectionDialogOpen] = useState(false);

  const handleGlobalRefresh = useCallback(() => {
    window.dispatchEvent(new CustomEvent('dbw:global-refresh', { detail: { source: 'toolbar' } }));
    setStatusMessage(t('status.loading'));
  }, [setStatusMessage, t]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F5') {
        event.preventDefault();
        handleGlobalRefresh();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleGlobalRefresh]);

  // 操作分组 - 新建连接、查询、刷新
  const operationButtons: ToolButton[] = [
    {
      id: 'connection',
      label: t('toolbar.connection'),
      iconType: 'connection',
      shortcut: 'Ctrl+N',
      onClick: () => {
        setIsConnectionDialogOpen(true);
      },
    },
    {
      id: 'query',
      label: t('toolbar.query'),
      iconType: 'query',
      shortcut: 'Ctrl+Q',
      onClick: () => {
        // 查询不要求连接和数据库（原有允许，不阻断）：仅预填「打开状态」的连接/数据库，
        // 连接已关闭时不把过期痕迹带入新查询页
        const resolved = resolveQueryTrace(trace);
        addTab({
          type: 'query',
          title: t('query.new'),
          connectionId: resolved.connection?.name,
          connectionProfile: resolved.connection,
          database: resolved.database,
        });
      },
    },
    {
      id: 'refresh',
      label: t('toolbar.refresh'),
      iconType: 'refresh',
      shortcut: 'F5',
      onClick: handleGlobalRefresh,
    },
  ];

  // 数据库对象分组 - 表、视图、函数、用户
  const objectButtons: ToolButton[] = [
    {
      id: 'table',
      label: t('toolbar.table'),
      iconType: 'table',
      onClick: () => {
        // 递推兜底：连接必须打开；数据库必须「选中且打开」（图标非灰）才可访问
        if (!requireOpenConnection(trace, t('database.tables'))) return;
        if (!requireOpenedDatabase(trace, t('database.tables'))) return;
        addTab({
          type: 'tableList',
          title: `${t('database.tables')} - ${trace.database}`,
          connectionId: trace.connection?.name,
          connectionProfile: trace.connection,
          database: trace.database,
          objectType: 'TABLE',
        });
      },
    },
    {
      id: 'view',
      label: t('toolbar.view'),
      iconType: 'view',
      onClick: () => {
        if (!requireOpenConnection(trace, t('database.views'))) return;
        if (!requireOpenedDatabase(trace, t('database.views'))) return;
        addTab({
          type: 'viewList',
          title: `${t('database.views')} - ${trace.database}`,
          connectionId: trace.connection?.name,
          connectionProfile: trace.connection,
          database: trace.database,
          objectType: 'VIEW',
        });
      },
    },
    {
      id: 'function',
      label: t('toolbar.function'),
      iconType: 'function',
      onClick: () => {
        if (!requireOpenConnection(trace, t('database.functions'))) return;
        if (!requireOpenedDatabase(trace, t('database.functions'))) return;
        addTab({
          type: 'functionList',
          title: `${t('database.functions')} - ${trace.database}`,
          connectionId: trace.connection?.name,
          connectionProfile: trace.connection,
          database: trace.database,
          objectType: 'FUNCTION',
        });
      },
    },
    {
      id: 'user',
      label: t('toolbar.user'),
      iconType: 'user',
      onClick: () => {
        // 用户管理仅依赖连接（不需要数据库字段）
        if (!requireOpenConnection(trace, t('database.users'))) return;
        addTab({
          type: 'userManager',
          title: t('database.users'),
          connectionId: trace.connection?.name,
          connectionProfile: trace.connection,
        });
      },
    },
  ];

  // 运维分组 - 备份、还原
  const maintenanceButtons: ToolButton[] = [
    {
      id: 'backup',
      label: t('toolbar.backup'),
      iconType: 'backup',
      onClick: () => {
        if (!requireOpenConnection(trace, t('database.backup'))) return;
        if (!requireOpenedDatabase(trace, t('database.backup'))) return;
        window.dispatchEvent(new CustomEvent('dbw:open-backup-dialog'));
      },
    },
    {
      id: 'restore',
      label: t('toolbar.restore'),
      iconType: 'restore',
      onClick: () => {
        // 还原仅依赖连接（不需要数据库字段）
        if (!requireOpenConnection(trace, t('database.restore'))) return;
        window.dispatchEvent(new CustomEvent('dbw:open-restore-dialog'));
      },
    },
  ];

  const renderButtonGroup = (buttons: ToolButton[], groupLabel: string) => (
    <div className="flex flex-col items-center px-1">
      <div className="flex h-16 items-center gap-1.5">
        {buttons.map((button) => (
          <button
            key={button.id}
            className={cn(
              'toolbar-btn flex h-[60px] min-w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded border border-transparent bg-none px-2 py-1',
              theme === 'dark' ? 'text-[#cccccc]' : 'text-[#333333]',
            )}
            onClick={button.onClick}
            title={`${button.label}${button.shortcut ? ` (${button.shortcut})` : ''}`}
          >
            <div className="flex h-10 w-10 items-center justify-center">
              <ToolbarIcon type={button.iconType} size={40} />
            </div>
            <span className="whitespace-nowrap text-[11px]">{button.label}</span>
          </button>
        ))}
      </div>
      <span className={cn('mt-0.5 whitespace-nowrap text-[11px]', theme === 'dark' ? 'text-[#858585]' : 'text-[#666666]')}>{groupLabel}</span>
    </div>
  );

  return (
    <>
      <div className={cn('flex h-full items-center', `bp5-${theme}`)}>
        <div className="flex h-full items-center">
          {renderButtonGroup(operationButtons, '操作')}
          <div className={cn('mx-1 h-[60px] w-px', theme === 'dark' ? 'bg-[#3e3e42]' : 'bg-[#e0e0e0]')} />
          {renderButtonGroup(objectButtons, '数据库对象')}
          <div className={cn('mx-1 h-[60px] w-px', theme === 'dark' ? 'bg-[#3e3e42]' : 'bg-[#e0e0e0]')} />
          {renderButtonGroup(maintenanceButtons, '运维')}
        </div>
      </div>
      
      <ConnectionDialog
        isOpen={isConnectionDialogOpen}
        onClose={() => setIsConnectionDialogOpen(false)}
      />
    </>
  );
};
