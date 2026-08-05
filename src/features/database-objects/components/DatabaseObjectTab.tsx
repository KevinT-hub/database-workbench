import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Button,
  Spinner,
  Alert,
  OverlayToaster,
  Intent,
  Dialog,
  Classes,
  RadioGroup,
  Radio,
} from '@blueprintjs/core';
import { useTranslation } from 'react-i18next';
import {
  RefreshIcon,
  AddIcon,
  EditIcon,
  DeleteIcon,
  SearchIcon,
  OpenIcon,
  DefinitionIcon,
  PlayIcon,
} from '@/components/icons/DatabaseObjectIcons';
import { TableIcon, ViewIcon, FunctionIcon } from '@/components/icons/TreeIcons';
import { formatBytes } from '@/lib/format';
import type {
  ConnectionProfile,
  TableDetail,
  ViewDetail,
  FunctionDetail,
  ObjectType,
} from '@/types';
import { useAppStore, useMetadataStore } from '@/stores';
import { cn } from '@/lib/cn';

import type { Toaster } from '@blueprintjs/core';
import { useDatabaseObjectActions } from '../useDatabaseObjectActions';
let objectToaster: Toaster | null = null;
const getObjectToaster = async () => {
  if (!objectToaster) {
    objectToaster = await OverlayToaster.create({ position: 'top' });
  }
  return objectToaster;
};

interface DatabaseObjectTabProps {
  tabId: string;
  objectType: ObjectType;
  connectionProfile: ConnectionProfile;
  database: string;
  onOpenTableData?: (tableName: string) => void;
  onOpenViewData?: (viewName: string) => void;
  onViewDefinition?: (viewName: string) => void;
  onOpenViewDesigner?: (viewName: string) => void;
  onOpenFunctionDesigner?: (functionName: string, functionType?: 'FUNCTION' | 'PROCEDURE', autoExecute?: boolean) => void;
  onOpenDesigner?: (tableName?: string) => void;
}

type ObjectData = TableDetail | ViewDetail | FunctionDetail;

interface ColumnDef {
  key: string;
  title: string;
  width: number;
  minWidth: number;
  render: (obj: ObjectData) => React.ReactNode;
}

const formatNumber = (num?: number): string => {
  if (num === undefined || num === null) return '-';
  return num.toLocaleString();
};

// Resizable header component
interface ResizableHeaderProps {
  column: ColumnDef;
  onResize: (key: string, newWidth: number) => void;
}

const ResizableHeader: React.FC<ResizableHeaderProps> = ({ column, onResize }) => {
  const { theme } = useAppStore();
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(column.width);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = column.width;
    e.preventDefault();
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current;
      const newWidth = Math.max(column.minWidth, startWidthRef.current + delta);
      onResize(column.key, newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, column.key, column.minWidth, onResize]);

  return (
    <th
      className={cn(
        'relative overflow-hidden p-0 sticky top-0 z-[1] select-none border-b-2 text-left',
        theme === 'dark' ? 'border-[#3e3e42] bg-[#252a31] text-[#f6f7f9]' : 'border-[#e1e5e9] bg-[#f5f6f7] text-[#1c2127]',
      )}
      style={{ width: column.width, minWidth: column.minWidth }}
    >
      <div className="truncate px-3 py-2 font-semibold">{column.title}</div>
      <div
        className={cn(
          'absolute right-0 top-0 bottom-0 z-10 w-1.5 cursor-col-resize bg-transparent transition-colors duration-150 after:absolute after:right-0.5 after:top-1/4 after:bottom-1/4 after:w-px after:content-[\'\']',
          theme === 'dark' ? 'after:bg-[#3e3e42]' : 'after:bg-[#e1e5e9]',
          isResizing ? 'bg-[#2d72d2] after:bg-transparent' : 'hover:bg-[#2d72d2] hover:after:bg-transparent',
        )}
        onMouseDown={handleMouseDown}
      />
    </th>
  );
};

export const DatabaseObjectTab: React.FC<DatabaseObjectTabProps> = ({
  tabId: _tabId,
  objectType,
  connectionProfile,
  database,
  onOpenTableData,
  onOpenViewData,
  onViewDefinition,
  onOpenViewDesigner,
  onOpenFunctionDesigner,
  onOpenDesigner,
}) => {
  const { t } = useTranslation();
  const { theme } = useAppStore();
  const [objects, setObjects] = useState<ObjectData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [selectedObjectName, setSelectedObjectName] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [objectToDelete, setObjectToDelete] = useState<string | null>(null);
  const [newTypeDialogOpen, setNewTypeDialogOpen] = useState(false);
  const [selectedNewType, setSelectedNewType] = useState<'FUNCTION' | 'PROCEDURE'>('FUNCTION');
  const { dropObject } = useDatabaseObjectActions();

  const getObjectTypeKey = (type: ObjectType): string => {
    switch (type) {
      case 'TABLE':
        return 'table';
      case 'VIEW':
        return 'view';
      case 'FUNCTION':
        return 'function';
      default:
        return 'object';
    }
  };

  const getObjectIcon = (type: ObjectType) => {
    switch (type) {
      case 'TABLE':
        return <TableIcon size={16} className="shrink-0" />;
      case 'VIEW':
        return <ViewIcon size={16} className="shrink-0" />;
      case 'FUNCTION':
        return <FunctionIcon size={16} className="shrink-0" />;
      default:
        return null;
    }
  };

  // Define columns based on object type
  const getInitialColumns = (): ColumnDef[] => {
    switch (objectType) {
      case 'TABLE':
        return [
          {
            key: 'name',
            title: t('databaseObject.name'),
            width: 150,
            minWidth: 100,
            render: (obj) => (
              <div className="flex items-center gap-2 font-medium">
                {getObjectIcon('TABLE')}
                <span>{(obj as TableDetail).Name}</span>
              </div>
            ),
          },
          {
            key: 'rows',
            title: t('databaseObject.rows'),
            width: 80,
            minWidth: 60,
            render: (obj) => formatNumber((obj as TableDetail).Rows),
          },
          {
            key: 'dataLength',
            title: t('databaseObject.dataLength'),
            width: 100,
            minWidth: 80,
            render: (obj) => formatBytes((obj as TableDetail).DataLength),
          },
          {
            key: 'engine',
            title: t('databaseObject.engine'),
            width: 100,
            minWidth: 80,
            render: (obj) => (obj as TableDetail).Engine || '-',
          },
          {
            key: 'updateTime',
            title: t('databaseObject.updateTime'),
            width: 150,
            minWidth: 120,
            render: (obj) => (obj as TableDetail).UpdateTime || '-',
          },
          {
            key: 'comment',
            title: t('databaseObject.comment'),
            width: 200,
            minWidth: 100,
            render: (obj) => (obj as TableDetail).Comment || '-',
          },
        ];
      case 'VIEW':
        return [
          {
            key: 'name',
            title: t('databaseObject.name'),
            width: 200,
            minWidth: 150,
            render: (obj) => (
              <div className="flex items-center gap-2 font-medium">
                {getObjectIcon('VIEW')}
                <span>{(obj as ViewDetail).Name}</span>
              </div>
            ),
          },
          {
            key: 'updatable',
            title: t('databaseObject.updatable'),
            width: 80,
            minWidth: 60,
            render: (obj) => ((obj as ViewDetail).IsUpdatable === 'YES' ? t('common.yes') : t('common.no')),
          },
          {
            key: 'securityType',
            title: t('databaseObject.securityType'),
            width: 100,
            minWidth: 80,
            render: (obj) => (obj as ViewDetail).SecurityType || '-',
          },
          {
            key: 'definer',
            title: t('databaseObject.definer'),
            width: 150,
            minWidth: 120,
            render: (obj) => (obj as ViewDetail).Definer || '-',
          },
          {
            key: 'createTime',
            title: t('databaseObject.createTime'),
            width: 150,
            minWidth: 120,
            render: (obj) => (obj as ViewDetail).CreateTime || '-',
          },
          {
            key: 'updateTime',
            title: t('databaseObject.updateTime'),
            width: 150,
            minWidth: 120,
            render: (obj) => (obj as ViewDetail).UpdateTime || '-',
          },
        ];
      case 'FUNCTION':
        return [
          {
            key: 'name',
            title: t('databaseObject.name'),
            width: 150,
            minWidth: 100,
            render: (obj) => (
              <div className="flex items-center gap-2 font-medium">
                {getObjectIcon('FUNCTION')}
                <span>{(obj as FunctionDetail).Name}</span>
              </div>
            ),
          },
          {
            key: 'type',
            title: t('databaseObject.type'),
            width: 100,
            minWidth: 80,
            render: (obj) => ((obj as FunctionDetail).Type === 'PROCEDURE' ? t('databaseObject.procedure') : t('databaseObject.function')),
          },
          {
            key: 'returnType',
            title: t('databaseObject.returnType'),
            width: 120,
            minWidth: 80,
            render: (obj) => (obj as FunctionDetail).DataType || '-',
          },
          {
            key: 'deterministic',
            title: t('databaseObject.deterministic'),
            width: 80,
            minWidth: 60,
            render: (obj) => ((obj as FunctionDetail).IsDeterministic === 'YES' ? t('common.yes') : t('common.no')),
          },
          {
            key: 'securityType',
            title: t('databaseObject.securityType'),
            width: 100,
            minWidth: 80,
            render: (obj) => (obj as FunctionDetail).SecurityType || '-',
          },
          {
            key: 'definer',
            title: t('databaseObject.definer'),
            width: 150,
            minWidth: 120,
            render: (obj) => (obj as FunctionDetail).Definer || '-',
          },
          {
            key: 'createTime',
            title: t('databaseObject.createTime'),
            width: 150,
            minWidth: 120,
            render: (obj) => (obj as FunctionDetail).CreateTime || '-',
          },
          {
            key: 'updateTime',
            title: t('databaseObject.updateTime'),
            width: 150,
            minWidth: 120,
            render: (obj) => (obj as FunctionDetail).UpdateTime || '-',
          },
          {
            key: 'comment',
            title: t('databaseObject.comment'),
            width: 150,
            minWidth: 80,
            render: (obj) => (obj as FunctionDetail).Comment || '-',
          },
        ];
      default:
        return [];
    }
  };

  const [columns, setColumns] = useState<ColumnDef[]>(getInitialColumns());

  // Reset columns when object type changes
  useEffect(() => {
    setColumns(getInitialColumns());
  }, [objectType, t]);

  const handleColumnResize = useCallback((key: string, newWidth: number) => {
    setColumns((prev) =>
      prev.map((col) => (col.key === key ? { ...col, width: newWidth } : col))
    );
  }, []);

  const fetchObjects = useCallback(async () => {
    if (!connectionProfile || !database) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let data: ObjectData[];
      switch (objectType) {
        case 'TABLE':
          data = await useMetadataStore.getState().fetchTableDetails(connectionProfile, database);
          break;
        case 'VIEW':
          data = await useMetadataStore.getState().fetchViewDetails(connectionProfile, database);
          break;
        case 'FUNCTION':
          data = await useMetadataStore.getState().fetchFunctionDetails(connectionProfile, database);
          break;
        default:
          data = [];
      }
      setObjects(data);

      // 刷新后检查当前选中的对象是否还存在，如果不存在则清除选中状态
      setSelectedObjectName((prevSelected) => {
        if (prevSelected) {
          const stillExists = data.some((obj) => 'Name' in obj && obj.Name === prevSelected);
          return stillExists ? prevSelected : null;
        }
        return null;
      });
    } catch (err) {
      setError(t('databaseObject.loadFailed', { type: t(`databaseObject.${getObjectTypeKey(objectType)}`), error: err }));
      setObjects([]);
    } finally {
      setIsLoading(false);
    }
  }, [connectionProfile, database, objectType, t]);

  useEffect(() => {
    fetchObjects();
  }, [fetchObjects]);

  const handleRefresh = useCallback(() => {
    fetchObjects();
  }, [fetchObjects]);

  const handleNew = useCallback(() => {
    switch (objectType) {
      case 'TABLE':
        onOpenDesigner?.();
        break;
      case 'VIEW':
        onOpenViewDesigner?.('new_view');
        break;
      case 'FUNCTION':
        setNewTypeDialogOpen(true);
        break;
    }
  }, [objectType, onOpenDesigner, onOpenViewDesigner]);

  const handleNewTypeConfirm = useCallback(() => {
    setNewTypeDialogOpen(false);
    onOpenFunctionDesigner?.('', selectedNewType);
  }, [selectedNewType, onOpenFunctionDesigner]);

  const handleDesign = useCallback((name: string) => {
    switch (objectType) {
      case 'TABLE':
        onOpenDesigner?.(name);
        break;
      case 'VIEW':
        onOpenViewDesigner?.(name);
        break;
      case 'FUNCTION': {
        const func = objects.find((obj) => 'Name' in obj && obj.Name === name) as FunctionDetail | undefined;
        const funcType = func?.Type === 'PROCEDURE' ? 'PROCEDURE' : 'FUNCTION';
        onOpenFunctionDesigner?.(name, funcType);
        break;
      }
    }
  }, [objectType, onOpenDesigner, onOpenViewDesigner, onOpenFunctionDesigner, objects]);

  const handleDelete = useCallback((name: string) => {
    setObjectToDelete(name);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!objectToDelete) return;

    try {
      await dropObject({
        connectionProfile,
        database,
        objectType,
        objectName: objectToDelete,
        objects,
      });
      setDeleteDialogOpen(false);
      const deletedName = objectToDelete;
      setObjectToDelete(null);

      // 如果被删除的对象是当前选中的对象，清除选中状态
      if (selectedObjectName === deletedName) {
        setSelectedObjectName(null);
      }

      fetchObjects();
      (await getObjectToaster())?.show({
        message: t('databaseObject.deleteSuccess', { type: t(`databaseObject.${getObjectTypeKey(objectType)}`), name: deletedName }),
        intent: Intent.SUCCESS,
        timeout: 3000,
      });
    } catch (err) {
      setError(t('databaseObject.deleteFailed', { type: t(`databaseObject.${getObjectTypeKey(objectType)}`), error: err }));
    }
  }, [objectToDelete, objectType, connectionProfile, database, fetchObjects, objects, selectedObjectName, t, dropObject]);

  const handleDoubleClick = useCallback((obj: ObjectData) => {
    const name = 'Name' in obj ? obj.Name : '';
    switch (objectType) {
      case 'TABLE':
        onOpenTableData?.(name);
        break;
      case 'VIEW':
        onOpenViewData?.(name);
        break;
      case 'FUNCTION': {
        const func = obj as FunctionDetail;
        const funcType = func.Type === 'PROCEDURE' ? 'PROCEDURE' : 'FUNCTION';
        onOpenFunctionDesigner?.(name, funcType);
        break;
      }
    }
  }, [objectType, onOpenTableData, onOpenViewData, onOpenFunctionDesigner]);

  const filteredObjects = objects.filter((obj) => {
    if (!searchText) return true;
    const name = 'Name' in obj ? obj.Name : '';
    return name.toLowerCase().includes(searchText.toLowerCase());
  });

  const getObjectName = (obj: ObjectData): string => {
    return 'Name' in obj ? obj.Name : '';
  };

  return (
    <div className="flex h-full w-full min-h-0 flex-col overflow-hidden">
      <div className={cn(
        'flex flex-col flex-shrink-0 border-b px-2 py-1',
        theme === 'dark' ? 'border-[#3e3e42] bg-[#252a31]' : 'border-[#e1e5e9] bg-[#f5f6f7]',
      )}>
        <div className="flex items-center gap-3 py-0.5">
          <div className={cn(
            'relative flex h-7 w-[200px] items-center rounded-[3px] border px-2 transition-[border-color,box-shadow] duration-150 focus-within:border-[#2d72d2] focus-within:shadow-[0_0_0_1px_#2d72d2]',
            theme === 'dark' ? 'border-[#3e3e42] bg-[#252a31]' : 'border-[#e1e5e9] bg-white',
          )}>
            <SearchIcon size={14} className={cn('mr-1.5 shrink-0', theme === 'dark' ? 'text-[#abb3bf]' : 'text-[#5f6b7c]')} />
            <input
              type="text"
              className={cn(
                'h-full flex-1 border-none bg-transparent p-0 text-[13px] outline-none',
                theme === 'dark' ? 'text-[#f6f7f9] placeholder:text-[#abb3bf]' : 'text-[#1c2127] placeholder:text-[#5f6b7c]',
              )}
              placeholder={t('databaseObject.searchPlaceholder', { type: t(`databaseObject.${getObjectTypeKey(objectType)}`) })}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            {searchText && (
              <button
                className={cn(
                  'flex cursor-pointer items-center justify-center rounded-[2px] border-none bg-transparent p-0.5 transition-colors duration-150',
                  theme === 'dark'
                    ? 'text-[#abb3bf] hover:bg-[rgba(143,153,168,0.15)] hover:text-[#f6f7f9]'
                    : 'text-[#5f6b7c] hover:bg-[rgba(143,153,168,0.15)] hover:text-[#1c2127]',
                )}
                onClick={() => setSearchText('')}
              >
                <DeleteIcon size={12} />
              </button>
            )}
          </div>

          {/* 统计信息 - 放在搜索框旁边 */}
          <div className={cn('ml-1 flex items-center text-xs', theme === 'dark' ? 'text-[#abb3bf]' : 'text-[#5f6b7c]')}>
            <span className="whitespace-nowrap">
              {t('databaseObject.totalCount', { count: filteredObjects.length, type: t(`databaseObject.${getObjectTypeKey(objectType)}`) })}
            </span>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-1.5">
            <Button
              minimal
              small
              icon={<RefreshIcon size={14} />}
              onClick={handleRefresh}
              loading={isLoading}
              title={t('common.refresh')}
            >
              {t('common.refresh')}
            </Button>

            {objectType === 'VIEW' && selectedObjectName && (
              <Button
                minimal
                small
                icon={<OpenIcon size={14} />}
                onClick={() => onOpenViewData?.(selectedObjectName)}
                title={t('databaseObject.openView')}
              >
                {t('databaseObject.open')}
              </Button>
            )}

            {objectType === 'FUNCTION' && selectedObjectName && (
              <Button
                minimal
                small
                icon={<PlayIcon size={14} />}
                onClick={() => {
                  const func = objects.find((obj) => 'Name' in obj && obj.Name === selectedObjectName) as FunctionDetail | undefined;
                  const funcType = func?.Type === 'PROCEDURE' ? 'PROCEDURE' : 'FUNCTION';
                  onOpenFunctionDesigner?.(selectedObjectName, funcType, true);
                }}
                title={t('common.execute')}
              >
                {t('common.execute')}
              </Button>
            )}

            <Button
              minimal
              small
              icon={<AddIcon size={14} />}
              onClick={handleNew}
              title={t('databaseObject.new', { type: t(`databaseObject.${getObjectTypeKey(objectType)}`) })}
            >
              {t('common.create')}
            </Button>

            {selectedObjectName && (
              <>
                {objectType === 'TABLE' && (
                  <Button
                    minimal
                    small
                    icon={<OpenIcon size={14} />}
                    onClick={() => onOpenTableData?.(selectedObjectName)}
                    title={t('databaseObject.open')}
                  >
                    {t('databaseObject.open')}
                  </Button>
                )}
                <Button
                  minimal
                  small
                  icon={<EditIcon size={14} />}
                  onClick={() => handleDesign(selectedObjectName)}
                  title={t('common.edit')}
                >
                  {t('common.edit')}
                </Button>
                {objectType === 'VIEW' && (
                  <Button
                    minimal
                    small
                    icon={<DefinitionIcon size={14} />}
                    onClick={() => onViewDefinition?.(selectedObjectName)}
                    title={t('databaseObject.definition')}
                  >
                    {t('databaseObject.definition')}
                  </Button>
                )}
                <Button
                  minimal
                  small
                  icon={<DeleteIcon size={14} />}
                  intent="danger"
                  onClick={() => handleDelete(selectedObjectName)}
                  title={t('common.delete')}
                >
                  {t('common.delete')}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {isLoading && (
          <div className={cn('flex h-full flex-col items-center justify-center gap-3 text-sm', theme === 'dark' ? 'text-[#abb3bf]' : 'text-[#5f6b7c]')}>
            <Spinner size={32} />
            <span>{t('databaseObject.loading', { type: t(`databaseObject.${getObjectTypeKey(objectType)}`) })}</span>
          </div>
        )}

        {error && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-sm text-[#dc3545]">
            <span>{error}</span>
            <Button minimal small onClick={handleRefresh}>
              {t('common.retry')}
            </Button>
          </div>
        )}

        {!isLoading && !error && filteredObjects.length === 0 && (
          <div className={cn('flex h-full items-center justify-center text-sm', theme === 'dark' ? 'text-[#abb3bf]' : 'text-[#5f6b7c]')}>
            <span>{t('databaseObject.empty', { type: t(`databaseObject.${getObjectTypeKey(objectType)}`) })}</span>
          </div>
        )}

        {!isLoading && !error && filteredObjects.length > 0 && (
          <div className="database-object-table-wrapper min-h-0 flex-1 overflow-auto p-2">
            <table className="w-full table-fixed border-collapse font-['Microsoft_YaHei','Segoe_UI',sans-serif] text-[13px]">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <ResizableHeader
                      key={col.key}
                      column={col}
                      onResize={handleColumnResize}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredObjects.map((obj) => (
                  <tr
                    key={getObjectName(obj)}
                    className={cn(
                      'cursor-pointer transition-colors duration-100',
                      selectedObjectName === getObjectName(obj)
                        ? theme === 'dark'
                          ? 'bg-[#1d4ed8] text-white'
                          : 'bg-[#2d72d2] text-white'
                        : theme === 'dark'
                          ? 'bg-[#252a31] text-[#f6f7f9] hover:bg-[rgba(143,153,168,0.15)]'
                          : 'bg-[#f5f6f7] text-[#1c2127] hover:bg-[rgba(143,153,168,0.15)]',
                    )}
                    onClick={() => setSelectedObjectName(getObjectName(obj))}
                    onDoubleClick={() => handleDoubleClick(obj)}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'overflow-hidden text-ellipsis whitespace-nowrap border-b px-3 py-2 text-left',
                          theme === 'dark' ? 'border-[#3e3e42]' : 'border-[#e1e5e9]',
                        )}
                        style={{ width: col.width, minWidth: col.minWidth }}
                      >
                        {col.render(obj)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Alert
        isOpen={deleteDialogOpen}
        cancelButtonText={t('common.cancel')}
        confirmButtonText={t('common.delete')}
        icon={<DeleteIcon size={20} />}
        intent="danger"
        onCancel={() => {
          setDeleteDialogOpen(false);
          setObjectToDelete(null);
        }}
        onConfirm={confirmDelete}
      >
        <p>
          {t('databaseObject.deleteConfirm', { type: t(`databaseObject.${getObjectTypeKey(objectType)}`), name: objectToDelete })}
        </p>
        <p>{t('databaseObject.deleteWarning')}</p>
      </Alert>

      <Dialog
        isOpen={newTypeDialogOpen}
        onClose={() => setNewTypeDialogOpen(false)}
        title={t('databaseObject.newObject')}
        className="new-type-dialog"
      >
        <div className={Classes.DIALOG_BODY}>
          <p>{t('databaseObject.selectType')}</p>
          <RadioGroup
            selectedValue={selectedNewType}
            onChange={(e) => setSelectedNewType(e.currentTarget.value as 'FUNCTION' | 'PROCEDURE')}
          >
            <Radio label={t('databaseObject.function')} value="FUNCTION" />
            <Radio label={t('databaseObject.procedure')} value="PROCEDURE" />
          </RadioGroup>
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button onClick={() => setNewTypeDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button intent="primary" onClick={handleNewTypeConfirm}>
              {t('common.ok')}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
