import React from 'react';
import { Tooltip } from '@blueprintjs/core';
import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/stores';
import { cn } from '@/lib/cn';

interface QuickAction {
  id: 'favorites';
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

export const RightQuickBar: React.FC = () => {
  const { t } = useTranslation();
  const { theme } = useAppStore();

  const openFavorites = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent('dbw:open-favorites-dialog'));
  }, []);

  const actions: QuickAction[] = [
    {
      id: 'favorites',
      label: t('menu.favorites.title'),
      icon: <Star size={16} />,
      onClick: openFavorites,
    },
  ];

  return (
    <aside
      className={cn(
        'flex w-11 flex-shrink-0 flex-col items-center gap-1.5 border-l px-1 py-2',
        theme === 'dark' ? 'border-[#3e3e42] bg-[#1e1e1e]' : 'border-[#e0e0e0] bg-[#f3f3f3]',
      )}
      aria-label="常用功能"
    >
      {actions.map((action) => (
        <Tooltip key={action.id} content={action.label} position="left">
          <button
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-md border-none bg-transparent transition-all duration-150',
              theme === 'dark' ? 'text-[#858585] hover:bg-[#3e3e42] hover:text-[#cccccc]' : 'text-[#666666] hover:bg-[#e8e8e8] hover:text-[#333333]',
            )}
            type="button"
            onClick={action.onClick}
          >
            {action.icon}
          </button>
        </Tooltip>
      ))}
    </aside>
  );
};
