import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  Classes,
  Button,
  InputGroup,
  Spinner,
  Intent,
  Tag,
  Icon,
  NonIdealState,
  Card,
  Elevation,
  HTMLSelect,
  Divider,
} from '@blueprintjs/core';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { useFavorites } from '@/hooks/useFavorites';
import { AddFavoriteDialog } from './AddFavoriteDialog';
import type { FavoriteItem, FavoriteType } from '@/types';
import type { IconName } from '@blueprintjs/icons';

interface FavoritesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUseFavorite?: (item: FavoriteItem) => void;
}

export const FavoritesDialog: React.FC<FavoritesDialogProps> = ({
  isOpen,
  onClose,
  onUseFavorite,
}) => {
  const { t } = useTranslation();
  const { favorites, loading, error, getAll, add, update, remove } = useFavorites();

  const [searchKeyword, setSearchKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [editingItem, setEditingItem] = useState<FavoriteItem | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addDefaultType, setAddDefaultType] = useState<FavoriteType>('SQL_QUERY');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const TYPE_OPTIONS = [
    { label: t('dialog.favorites.allTypes'), value: 'ALL' },
    { label: t('dialog.favorites.sqlQuery'), value: 'SQL_QUERY' },
    { label: t('dialog.favorites.connectionProfile'), value: 'CONNECTION_PROFILE' },
    { label: t('dialog.favorites.databaseObject'), value: 'DATABASE_OBJECT' },
  ];

  const TYPE_CONFIG: Record<FavoriteType, { label: string; icon: IconName; color: string }> = {
    SQL_QUERY: { label: t('dialog.favorites.sqlQueryShort'), icon: 'code', color: '#2196F3' },
    CONNECTION_PROFILE: { label: t('dialog.favorites.connectionShort'), icon: 'database', color: '#4CAF50' },
    DATABASE_OBJECT: { label: t('dialog.favorites.objectShort'), icon: 'cube', color: '#FF9800' },
  };

  useEffect(() => {
    if (isOpen) getAll();
  }, [isOpen, getAll]);

  const filteredFavorites = useMemo(() => {
    let filtered = favorites;
    if (typeFilter !== 'ALL') {
      filtered = filtered.filter((item) => item.type === typeFilter);
    }
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(keyword) ||
          item.description?.toLowerCase().includes(keyword)
      );
    }
    return filtered.sort((a, b) => b.lastUsedTime - a.lastUsedTime);
  }, [favorites, searchKeyword, typeFilter]);

  const handleExport = () => {
    const dataStr = JSON.stringify(filteredFavorites, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `favorites_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const imported = JSON.parse(text) as Omit<FavoriteItem, 'id'>[];
        for (const item of imported) {
          await add(item);
        }
        await getAll();
      } catch (err) {
        console.error(t('dialog.favorites.importFailed'), err);
      }
    };
    input.click();
  };

  const handleAdd = () => {
    setEditingItem(null);
    setAddDefaultType(typeFilter === 'ALL' ? 'SQL_QUERY' : (typeFilter as FavoriteType));
    setIsAddDialogOpen(true);
  };

  const handleEdit = (item: FavoriteItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItem(item);
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (item: FavoriteItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const itemId = item.id;
    if (!itemId) return;
    if (deleteConfirmId === itemId) {
      await remove(itemId);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(itemId);
      setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  };

  const handleRowClick = (item: FavoriteItem) => {
    onUseFavorite?.(item);
    onClose();
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      return t('dialog.favorites.today', {
        time: date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      });
    }
    if (diffDays === 1) return t('dialog.favorites.yesterday');
    if (diffDays < 7) return t('dialog.favorites.daysAgo', { days: diffDays });
    return date.toLocaleDateString('zh-CN');
  };

  const getTypeTag = (type: FavoriteType) => {
    const config = TYPE_CONFIG[type];
    return (
      <Tag minimal style={{ color: config.color, backgroundColor: `${config.color}20` }}>
        <Icon icon={config.icon} size={12} style={{ marginRight: 4 }} />
        {config.label}
      </Tag>
    );
  };

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title={t('dialog.favorites.title')}
        icon="star"
        className="favorites-dialog"
        style={{ width: 800, maxWidth: '90vw', minHeight: 500 }}
      >
        <div className={cn(Classes.DIALOG_BODY, '!p-0 flex flex-col min-h-[400px]')}>
          {/* 工具栏 */}
          <div
            className={cn(
              'flex items-center justify-between px-5 py-4 gap-4',
              'bg-[#f8f9fa] border-b border-[#e1e8ed]',
              '[html.bp6-dark_&]:bg-[#293742] [html.bp6-dark_&]:border-[#394b59]'
            )}
          >
            <div className="flex items-center gap-3 flex-1">
              <InputGroup
                leftIcon="search"
                placeholder={t('dialog.favorites.searchPlaceholder')}
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="flex-1 max-w-[300px]"
              />
              <HTMLSelect
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-[140px]"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </HTMLSelect>
            </div>
            <div className="flex items-center gap-2">
              <Button icon="export" minimal onClick={handleExport} title={t('dialog.favorites.export')}>
                {t('dialog.favorites.export')}
              </Button>
              <Button icon="import" minimal onClick={handleImport} title={t('dialog.favorites.import')}>
                {t('dialog.favorites.import')}
              </Button>
              <Divider />
              <Button icon="add" intent={Intent.PRIMARY} onClick={handleAdd}>
                {t('dialog.favorites.addFavorite')}
              </Button>
            </div>
          </div>

          {/* 内容区域 */}
          <div
            className={cn(
              'flex-1 overflow-y-auto px-5 py-4',
              'bg-white [html.bp6-dark_&]:bg-[#30404d]'
            )}
          >
            {loading ? (
              <div className="flex flex-col items-center justify-center py-[60px] px-5 text-[#5c7080]">
                <Spinner size={40} />
                <p className="mt-4 text-sm">{t('common.loading')}</p>
              </div>
            ) : error ? (
              <NonIdealState icon="error" title={t('error.error')} description={error} />
            ) : filteredFavorites.length === 0 ? (
              <NonIdealState
                icon="star-empty"
                title={
                  searchKeyword || typeFilter !== 'ALL'
                    ? t('dialog.favorites.noResults')
                    : t('dialog.favorites.empty')
                }
                description={
                  searchKeyword || typeFilter !== 'ALL'
                    ? t('dialog.favorites.adjustSearch')
                    : t('dialog.favorites.createFirst')
                }
                action={
                  <Button
                    icon="add"
                    intent={Intent.PRIMARY}
                    onClick={handleAdd}
                    text={t('dialog.favorites.addFavorite')}
                  />
                }
              />
            ) : (
              <div className="flex flex-col gap-3">
                {filteredFavorites.map((item, index) => (
                  <Card
                    key={item.id ?? `fav-${index}`}
                    className={cn(
                      'p-4 rounded-lg cursor-pointer border transition-all duration-200 ease-in-out',
                      'border-transparent hover:shadow-[0_2px_8px_rgba(0,0,0,0.1)] hover:border-[#e1e8ed]',
                      'group',
                      editingItem?.id === item.id && 'border-[#2196f3] bg-[#f0f7ff]'
                    )}
                    elevation={Elevation.ONE}
                    onClick={() => handleRowClick(item)}
                    interactive
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <Icon
                          icon={TYPE_CONFIG[item.type].icon}
                          size={16}
                          color={TYPE_CONFIG[item.type].color}
                        />
                        <span
                          className={cn(
                            'font-semibold text-[15px] truncate',
                            'text-[#182026] [html.bp6-dark_&]:text-[#f5f8fa]'
                          )}
                        >
                          {item.name}
                        </span>
                        {getTypeTag(item.type)}
                      </div>
                      <div className="flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <Button
                          icon="edit"
                          minimal
                          small
                          onClick={(e) => handleEdit(item, e)}
                          title={t('common.edit')}
                        />
                        <Button
                          icon={deleteConfirmId === item.id ? 'tick' : 'trash'}
                          minimal
                          small
                          intent={deleteConfirmId === item.id ? Intent.DANGER : undefined}
                          onClick={(e) => handleDelete(item, e)}
                          title={
                            deleteConfirmId === item.id ? t('common.confirm') : t('common.delete')
                          }
                        />
                      </div>
                    </div>
                    {item.description && (
                      <div
                        className={cn(
                          'text-[13px] mb-3 leading-relaxed overflow-hidden text-ellipsis line-clamp-2',
                          'text-[#5c7080] [html.bp6-dark_&]:text-[#a7b6c2]'
                        )}
                      >
                        {item.description}
                      </div>
                    )}
                    <div
                      className={cn(
                        'flex items-center gap-4 text-xs',
                        'text-[#8a9ba8] [html.bp6-dark_&]:text-[#5c7080]'
                      )}
                    >
                      <span className="flex items-center gap-1">
                        <Icon icon="play" size={12} />
                        {t('dialog.favorites.usedCount', { count: item.usageCount })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon icon="time" size={12} />
                        {formatDate(item.lastUsedTime)}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* 底部统计 */}
          {!loading && !error && favorites.length > 0 && (
            <div
              className={cn(
                'px-5 py-3 border-t text-[13px]',
                'bg-[#f8f9fa] border-[#e1e8ed] text-[#5c7080]',
                '[html.bp6-dark_&]:bg-[#293742] [html.bp6-dark_&]:border-[#394b59]'
              )}
            >
              <span>
                {t('dialog.favorites.totalCount', { count: favorites.length })}
                {(searchKeyword || typeFilter !== 'ALL') && (
                  <>, {t('dialog.favorites.showingCount', { count: filteredFavorites.length })}</>
                )}
              </span>
            </div>
          )}
        </div>

        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button onClick={onClose}>{t('common.close')}</Button>
          </div>
        </div>
      </Dialog>

      <AddFavoriteDialog
        isOpen={isAddDialogOpen}
        onClose={() => {
          setIsAddDialogOpen(false);
          setEditingItem(null);
        }}
        onSave={async (item) => {
          if (editingItem?.id) {
            await update({ ...item, id: editingItem.id });
          } else {
            await add(item);
          }
          await getAll();
        }}
        editItem={editingItem || undefined}
        defaultType={addDefaultType}
      />
    </>
  );
};
