// 菜单栏对话框集合：收藏夹/新建收藏/关于/快捷键/连接/选项/属性/
// 备份/还原/连接导出/确认对话框的统一挂载。

import React from 'react';
import { Dialog, Classes, Button, Checkbox } from '@blueprintjs/core';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog, AboutDialog, ShortcutsDialog, PropertiesDialog } from '@/features/dialogs';
import { FavoritesDialog, AddFavoriteDialog } from '@/features/favorites';
import { ConnectionDialog } from '@/features/connection';
import { OptionsDialog } from '@/features/options';
import { BackupDialog, RestoreDialog } from '@/features/backup';
import type { ConnectionProfile, FavoriteItem } from '@/types';
import type { MenuDialogsState } from './useMenuDialogs';

interface MenuDialogsProps {
  state: MenuDialogsState;
  connections: Array<{ profile: ConnectionProfile }>;
  connectionProfile?: ConnectionProfile;
  database?: string;
  onUseFavorite: (item: FavoriteItem) => void;
  onAddFavorite: (item: Omit<FavoriteItem, 'id'>) => void;
}

export const MenuDialogs: React.FC<MenuDialogsProps> = ({
  state,
  connections,
  connectionProfile,
  database,
  onUseFavorite,
  onAddFavorite,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <FavoritesDialog
        isOpen={state.isFavoritesDialogOpen}
        onClose={() => state.setIsFavoritesDialogOpen(false)}
        onUseFavorite={onUseFavorite}
      />

      <AddFavoriteDialog
        isOpen={state.isAddFavoriteDialogOpen}
        onClose={() => state.setIsAddFavoriteDialogOpen(false)}
        onSave={onAddFavorite}
      />

      <AboutDialog
        isOpen={state.isAboutDialogOpen}
        onClose={() => state.setIsAboutDialogOpen(false)}
      />

      <ShortcutsDialog
        isOpen={state.isShortcutsDialogOpen}
        onClose={() => state.setIsShortcutsDialogOpen(false)}
      />

      <ConnectionDialog
        isOpen={state.isConnectionDialogOpen}
        onClose={() => state.setIsConnectionDialogOpen(false)}
      />

      <OptionsDialog
        isOpen={state.isOptionsDialogOpen}
        onClose={() => state.setIsOptionsDialogOpen(false)}
      />

      <PropertiesDialog
        isOpen={state.isPropertiesDialogOpen}
        onClose={() => state.setIsPropertiesDialogOpen(false)}
      />

      <BackupDialog
        isOpen={state.isBackupDialogOpen}
        onClose={() => state.setIsBackupDialogOpen(false)}
        connectionProfile={connectionProfile}
        database={database}
      />

      <RestoreDialog
        isOpen={state.isRestoreDialogOpen}
        onClose={() => state.setIsRestoreDialogOpen(false)}
        connectionProfile={connectionProfile}
        initialDatabase={database}
      />

      <Dialog
        isOpen={state.isExportConnectionsDialogOpen}
        onClose={() => state.setIsExportConnectionsDialogOpen(false)}
        title={t('menu.tools.exportConnectionsSelectTitle')}
        icon="export"
      >
        <div className={Classes.DIALOG_BODY}>
          <p>{t('menu.tools.exportConnectionsSelectDescription')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
            {connections
              .map((conn) => conn.profile.name || '')
              .filter((name): name is string => Boolean(name))
              .map((name) => (
                <Checkbox
                  key={name}
                  checked={!!state.exportSelection[name]}
                  onChange={(event) => {
                    const checked = (event.target as HTMLInputElement).checked;
                    state.setExportSelection((prev) => ({ ...prev, [name]: checked }));
                  }}
                  label={name}
                />
              ))}
          </div>
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button onClick={() => state.setIsExportConnectionsDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button intent="primary" onClick={() => { void state.handleConfirmExportConnections(); }}>
              {t('menu.tools.exportConnections')}
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        isOpen={state.confirmDialogState.isOpen}
        onClose={state.closeConfirmDialog}
        onConfirm={state.handleConfirmDialogConfirm}
        onCancel={state.handleConfirmDialogCancel}
        title={state.confirmDialogState.title}
        message={state.confirmDialogState.message}
        intent={state.confirmDialogState.intent}
        confirmText={t('common.yes')}
        cancelText={t('common.no')}
      />
    </>
  );
};

