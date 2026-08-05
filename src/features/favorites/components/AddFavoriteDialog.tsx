import React, { useState } from 'react';
import {
  Dialog,
  Classes,
  Button,
  InputGroup,
  Intent,
  HTMLSelect,
  Icon,
} from '@blueprintjs/core';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { useFavoritesForm } from '../useFavoritesForm';
import type { FavoriteItem, FavoriteType } from '@/types';
import type { DatabaseObjectOpenMode, DatabaseObjectType } from '@/features/favorites';

interface AddFavoriteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Omit<FavoriteItem, 'id'>) => Promise<void> | void;
  editItem?: FavoriteItem;
  defaultType?: FavoriteType;
}

export const AddFavoriteDialog: React.FC<AddFavoriteDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  editItem,
  defaultType = 'SQL_QUERY',
}) => {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);

  const form = useFavoritesForm({ editItem, defaultType, isOpen });

  const pickSqlFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'SQL', extensions: ['sql'] }],
    });
    if (!selected || typeof selected !== 'string') return;
    try {
      const content = await readTextFile(selected);
      form.handleSetSqlText(content);
      form.setSqlFilePath(selected);
    } catch {
      // ignore
    }
  };

  const pickConnectionJsonFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (!selected || typeof selected !== 'string') return;
    form.setConnectionFilePath(selected);
  };

  const handleSave = async () => {
    if (!form.canSave) return;
    setIsSaving(true);
    try {
      await onSave({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
        content: form.buildFavoriteContent(),
        createdTime: editItem?.createdTime || Date.now(),
        lastUsedTime: editItem?.lastUsedTime || Date.now(),
        usageCount: editItem?.usageCount || 0,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const labelClass = cn(
    'flex items-center gap-1.5 text-sm font-medium',
    'text-[#182026] [html.bp6-dark_&]:text-[#f5f8fa]'
  );

  const textareaClass = cn(
    'w-full min-h-[120px] p-3 border rounded-md font-mono text-[13px] leading-relaxed resize-y transition-colors duration-200 focus:outline-none',
    'bg-white border-[#ced9e0] placeholder:text-[#a7b6c2]',
    'focus:border-[#2196f3] focus:shadow-[0_0_0_2px_rgba(33,150,243,0.2)]',
    '[html.bp6-dark_&]:bg-[#293742] [html.bp6-dark_&]:border-[#394b59] [html.bp6-dark_&]:text-[#f5f8fa]'
  );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={editItem ? t('dialog.favorites.editTitle') : t('dialog.favorites.addTitle')}
      icon={editItem ? 'edit' : 'star'}
      style={{ width: editItem ? 520 : 620 }}
    >
      <div className={cn(Classes.DIALOG_BODY, '!p-6')}>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className={labelClass}>
              <Icon icon="label" size={14} className="text-[#5c7080]" />
              {t('dialog.favorites.nameLabel')} <span className="text-red-600 ml-0.5">*</span>
            </label>
            <InputGroup
              placeholder={t('dialog.favorites.namePlaceholder')}
              value={form.name}
              onChange={(e) => form.setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className={labelClass}>
              <Icon icon="tag" size={14} className="text-[#5c7080]" />
              {t('dialog.favorites.typeLabel')}
            </label>
            <HTMLSelect
              value={form.type}
              onChange={(e) => form.setType(e.target.value as FavoriteType)}
            >
              <option value="SQL_QUERY">{t('dialog.favorites.sqlQuery')}</option>
              <option value="CONNECTION_PROFILE">{t('dialog.favorites.connectionProfile')}</option>
              <option value="DATABASE_OBJECT">{t('dialog.favorites.databaseObject')}</option>
            </HTMLSelect>
          </div>

          <div className="flex flex-col gap-2">
            <label className={labelClass}>
              <Icon icon="annotation" size={14} className="text-[#5c7080]" />
              {t('dialog.favorites.descriptionLabel')}
            </label>
            <InputGroup
              placeholder={t('dialog.favorites.descriptionPlaceholder')}
              value={form.description}
              onChange={(e) => form.setDescription(e.target.value)}
            />
          </div>

          {form.type === 'SQL_QUERY' && (
            <>
              <div className="flex flex-col gap-2">
                <label className={labelClass}>
                  <Icon icon="document-open" size={14} className="text-[#5c7080]" />
                  {t('dialog.favorites.sqlFileLabel')}
                </label>
                <div className="flex gap-2">
                  <InputGroup
                    className="flex-1"
                    placeholder={t('dialog.favorites.sqlFilePlaceholder')}
                    value={form.sqlFilePath}
                    onChange={(e) => form.setSqlFilePath(e.target.value)}
                  />
                  <Button icon="folder-open" onClick={() => { void pickSqlFile(); }}>
                    {t('dialog.favorites.selectFile')}
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelClass}>
                  <Icon icon="code" size={14} className="text-[#5c7080]" />
                  {t('dialog.favorites.contentLabel')}
                </label>
                <textarea
                  placeholder={t('dialog.favorites.sqlPlaceholder')}
                  value={form.sqlText}
                  onChange={(e) => form.handleSetSqlText(e.target.value)}
                  className={textareaClass}
                  rows={8}
                />
              </div>
            </>
          )}

          {form.type === 'CONNECTION_PROFILE' && (
            <>
              <div className="flex flex-col gap-2">
                <label className={labelClass}>
                  <Icon icon="folder-open" size={14} className="text-[#5c7080]" />
                  {t('dialog.favorites.connectionJsonLabel')}
                </label>
                <div className="flex gap-2">
                  <InputGroup
                    className="flex-1"
                    placeholder={t('dialog.favorites.connectionJsonPlaceholder')}
                    value={form.connectionFilePath}
                    onChange={(e) => form.setConnectionFilePath(e.target.value)}
                  />
                  <Button icon="folder-open" onClick={() => { void pickConnectionJsonFile(); }}>
                    {t('dialog.favorites.selectFile')}
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className={labelClass}>
                  <Icon icon="search-template" size={14} className="text-[#5c7080]" />
                  {t('dialog.favorites.connectionProfileNameLabel')}
                </label>
                <InputGroup
                  placeholder={t('dialog.favorites.connectionProfileNamePlaceholder')}
                  value={form.connectionProfileName}
                  onChange={(e) => form.setConnectionProfileName(e.target.value)}
                />
              </div>
            </>
          )}

          {form.type === 'DATABASE_OBJECT' && (
            <>
              <div className="flex flex-col gap-2">
                <label className={labelClass}>
                  <Icon icon="database" size={14} className="text-[#5c7080]" />
                  {t('dialog.favorites.objectConnectionNameLabel')}
                </label>
                <HTMLSelect
                  value={form.objectConnectionName}
                  onChange={(e) => {
                    form.setObjectConnectionName(e.target.value);
                    form.setObjectDatabase('');
                    form.setObjectName('');
                  }}
                >
                  <option value="">{t('dialog.favorites.selectConnectionName')}</option>
                  {form.connectionNameOptions.map((connName) => (
                    <option key={connName} value={connName}>{connName}</option>
                  ))}
                </HTMLSelect>
              </div>

              <div className="flex flex-col gap-2">
                <label className={labelClass}>
                  <Icon icon="folder-open" size={14} className="text-[#5c7080]" />
                  {t('dialog.favorites.objectDatabaseLabel')}
                </label>
                <HTMLSelect
                  value={form.objectDatabase}
                  onChange={(e) => {
                    form.setObjectDatabase(e.target.value);
                    form.setObjectName('');
                  }}
                  disabled={!form.objectConnectionName || form.loadingDatabases}
                >
                  <option value="">{form.loadingDatabases ? t('common.loading') : t('dialog.favorites.selectDatabase')}</option>
                  {form.databaseOptions.map((databaseName) => (
                    <option key={databaseName} value={databaseName}>{databaseName}</option>
                  ))}
                </HTMLSelect>
              </div>

              <div className="flex flex-col gap-2">
                <label className={labelClass}>
                  <Icon icon="cube" size={14} className="text-[#5c7080]" />
                  {t('dialog.favorites.objectTypeLabel')}
                </label>
                <HTMLSelect
                  value={form.objectType}
                  onChange={(e) => form.setObjectType(e.target.value as DatabaseObjectType)}
                >
                  <option value="TABLE">{t('dialog.favorites.objectTypeTable')}</option>
                  <option value="VIEW">{t('dialog.favorites.objectTypeView')}</option>
                  <option value="FUNCTION">{t('dialog.favorites.objectTypeFunction')}</option>
                </HTMLSelect>
              </div>

              <div className="flex flex-col gap-2">
                <label className={labelClass}>
                  <Icon icon="tag" size={14} className="text-[#5c7080]" />
                  {t('dialog.favorites.objectNameLabel')}
                </label>
                <HTMLSelect
                  value={form.objectName}
                  onChange={(e) => form.setObjectName(e.target.value)}
                  disabled={!form.objectDatabase || form.loadingObjects}
                >
                  <option value="">{form.loadingObjects ? t('common.loading') : t('dialog.favorites.selectObjectName')}</option>
                  {form.objectOptions.map((dbObjectName) => (
                    <option key={dbObjectName} value={dbObjectName}>{dbObjectName}</option>
                  ))}
                </HTMLSelect>
              </div>

              <div className="flex flex-col gap-2">
                <label className={labelClass}>
                  <Icon icon="application" size={14} className="text-[#5c7080]" />
                  {t('dialog.favorites.openModeLabel')}
                </label>
                <HTMLSelect
                  value={form.objectOpenMode}
                  onChange={(e) => form.setObjectOpenMode(e.target.value as DatabaseObjectOpenMode)}
                >
                  <option value="LIST">{t('dialog.favorites.openModeList')}</option>
                  <option value="DATA">{t('dialog.favorites.openModeData')}</option>
                  <option value="DESIGNER">{t('dialog.favorites.openModeDesigner')}</option>
                </HTMLSelect>
              </div>

              <div className="flex flex-col gap-2">
                <label className={labelClass}>
                  <Icon icon="path-search" size={14} className="text-[#5c7080]" />
                  {t('dialog.favorites.objectPathLabel')}
                </label>
                <InputGroup value={form.generatedObjectPath} readOnly />
              </div>
            </>
          )}
        </div>
      </div>

      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button intent={Intent.PRIMARY} onClick={handleSave} disabled={!form.canSave} loading={isSaving}>
            {editItem ? t('common.save') : t('common.create')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
