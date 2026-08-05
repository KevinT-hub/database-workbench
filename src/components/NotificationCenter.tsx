import React, { useCallback, useMemo } from 'react';
import { Button, Icon, Intent } from '@blueprintjs/core';
import type { IconName } from '@blueprintjs/icons';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotificationStore, type Notification } from '../stores';
import { useAppStore } from '@/stores';
import { cn } from '@/lib/cn';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const getIntentIcon = (intent: string): IconName => {
  switch (intent) {
    case 'success':
      return 'tick-circle';
    case 'warning':
      return 'warning-sign';
    case 'danger':
      return 'error';
    case 'primary':
    default:
      return 'info-sign';
  }
};

const getIntentColor = (intent: string): string => {
  switch (intent) {
    case 'success':
      return 'var(--bp5-intent-success)';
    case 'warning':
      return 'var(--bp5-intent-warning)';
    case 'danger':
      return 'var(--bp5-intent-danger)';
    case 'primary':
    default:
      return 'var(--bp5-intent-primary)';
  }
};

const formatTimeAgo = (timestamp: number, t: (key: string, options?: Record<string, unknown>) => string): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) {
    return t('notification.justNow');
  } else if (minutes < 60) {
    return t('notification.minutesAgo', { count: minutes });
  } else if (hours < 24) {
    return t('notification.hoursAgo', { count: hours });
  } else {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  }
};

const NotificationItem: React.FC<{
  notification: Notification;
  onRemove: (id: string) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}> = ({ notification, onRemove, t }) => {
  const { theme } = useAppStore();
  const handleRemove = useCallback(() => {
    onRemove(notification.id);
  }, [onRemove, notification.id]);

  return (
    <div className={cn('group flex items-start justify-between gap-3 border-b border-transparent px-4 py-2.5 transition-colors duration-150', theme === 'dark' ? 'hover:bg-[#3e3e42]' : 'hover:bg-[#e8e8e8]')}>
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <Icon
          icon={getIntentIcon(notification.intent)}
          size={16}
          color={getIntentColor(notification.intent)}
          className="mt-0.5 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className={cn('break-words text-[13px] leading-[1.4]', theme === 'dark' ? 'text-[#cccccc]' : 'text-[#333333]')}>{notification.message}</div>
          <div className={cn('mt-1 text-[11px]', theme === 'dark' ? 'text-[#858585]' : 'text-[#666666]')}>
            {formatTimeAgo(notification.timestamp, t)}
          </div>
        </div>
      </div>
      <Button
        minimal
        small
        icon="cross"
        className={cn(
          '!p-0.5 !min-w-5 !min-h-5 shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:!bg-[#f44336] hover:!text-white',
        )}
        onClick={handleRemove}
        aria-label={t('common.close')}
      />
    </div>
  );
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { theme } = useAppStore();
  const { notifications, removeNotification, clearAll, getUnreadCount } = useNotificationStore();

  const unreadCount = useMemo(() => getUnreadCount(), [getUnreadCount, notifications]);

  const handleClearAll = useCallback(() => {
    clearAll();
  }, [clearAll]);

  const handleRemove = useCallback((id: string) => {
    removeNotification(id);
  }, [removeNotification]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[1000]" onClick={onClose}>
      <div
        className={cn(
          'notification-center-panel',
          'pointer-events-auto fixed bottom-7 right-2 z-[1001] flex max-h-[480px] w-[360px] flex-col rounded-md border shadow-[0_4px_20px_rgba(0,0,0,0.3)]',
          theme === 'dark' ? 'border-[#3e3e42] bg-[#1e1e1e]' : 'border-[#e0e0e0] bg-[#f3f3f3]',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn('flex flex-shrink-0 items-center justify-between border-b px-4 py-3', theme === 'dark' ? 'border-[#3e3e42]' : 'border-[#e0e0e0]')}>
          <div className={cn('flex items-center gap-1.5 text-sm font-semibold', theme === 'dark' ? 'text-[#cccccc]' : 'text-[#333333]')}>
            {t('notification.title')}
            {unreadCount > 0 && (
              <span className={cn('font-normal', theme === 'dark' ? 'text-[#858585]' : 'text-[#666666]')}>({unreadCount})</span>
            )}
          </div>
          <Button
            minimal
            small
            className={cn(
              'flex !p-0.5 !min-w-5 !min-h-5 items-center justify-center transition-colors duration-150',
              theme === 'dark' ? '!text-[#858585] hover:!text-[#cccccc]' : '!text-[#666666] hover:!text-[#333333]',
            )}
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <ChevronDown size={16} />
          </Button>
        </div>

        <div className={cn('min-h-[120px] max-h-[360px] flex-1 overflow-y-auto')}>
          {notifications.length === 0 ? (
            <div className={cn('flex h-[200px] flex-col items-center justify-center gap-3', theme === 'dark' ? 'text-[#858585]' : 'text-[#666666]')}>
              <Icon icon="notifications" size={32} className="opacity-50" />
              <div className="text-[13px]">{t('notification.empty')}</div>
            </div>
          ) : (
            <div className="py-2">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRemove={handleRemove}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>

        {notifications.length > 0 && (
          <div className={cn('flex flex-shrink-0 justify-end border-t px-4 py-2', theme === 'dark' ? 'border-[#3e3e42]' : 'border-[#e0e0e0]')}>
            <Button
              minimal
              small
              intent={Intent.DANGER}
              onClick={handleClearAll}
            >
              {t('notification.clearAll')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
