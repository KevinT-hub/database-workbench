import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Button,
  Spinner,
  Alert,
} from '@blueprintjs/core';
import { useTranslation } from 'react-i18next';
import type { ConnectionProfile, UserSummary } from '@/types';
import { useUserActions } from '../useUserActions';
import { useAppStore } from '@/stores';
import { cn } from '@/lib/cn';

interface ColumnDef {
  key: string;
  title: string;
  width: number;
  minWidth: number;
  render: (user: UserSummary) => React.ReactNode;
}

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

interface UserTabProps {
  tabId: string;
  connectionProfile: ConnectionProfile;
  onOpenUserEditor?: (username: string, host: string) => void;
}

const RefreshIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
    <path d="M14 8A6 6 0 1 1 8 2v2a4 4 0 1 0 4 4h-2l3-3 3 3h-2z" />
  </svg>
);

const AddIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const EditIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
    <path d="M2 12l1 1 9-9-1-1-9 9zM12 2l2 2-1 1-2-2 1-1z" />
  </svg>
);

const DeleteIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
    <path d="M4 4v10h8V4H4zm2 0V2h4v2h2v1H4V4h2zm1 2v6h1V6H7zm2 0v6h1V6H9z" />
  </svg>
);

const SearchIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
    <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M9 9l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const UserIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="#9C27B0" className={className}>
    <circle cx="8" cy="5" r="3" />
    <path d="M2 14c0-3 3-5 6-5s6 2 6 5" fill="none" stroke="#9C27B0" strokeWidth="2" />
  </svg>
);

export const UserTab: React.FC<UserTabProps> = ({
  tabId: _tabId,
  connectionProfile,
  onOpenUserEditor,
}) => {
  const { t } = useTranslation();
  const { theme } = useAppStore();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserSummary | null>(null);

  const getInitialColumns = (): ColumnDef[] => [
    {
      key: 'username',
      title: t('userTab.username'),
      width: 200,
      minWidth: 120,
      render: (user) => (
        <div className="flex items-center gap-2 font-medium">
          <UserIcon size={16} className="shrink-0" />
          <span>{user.username}</span>
        </div>
      ),
    },
    {
      key: 'host',
      title: t('userTab.host'),
      width: 150,
      minWidth: 100,
      render: (user) => user.host,
    },
    {
      key: 'plugin',
      title: t('userTab.plugin'),
      width: 180,
      minWidth: 120,
      render: (user) => user.plugin || '-',
    },
    {
      key: 'status',
      title: t('userTab.status'),
      width: 120,
      minWidth: 100,
      render: (user) => user.status,
    },
  ];

  const [columns, setColumns] = useState<ColumnDef[]>(getInitialColumns());
  const { getAllUsers, dropUser } = useUserActions();

  // Reset columns when language changes
  useEffect(() => {
    setColumns(getInitialColumns());
  }, [t]);

  const handleColumnResize = useCallback((key: string, newWidth: number) => {
    setColumns((prev) =>
      prev.map((col) => (col.key === key ? { ...col, width: newWidth } : col))
    );
  }, []);

  const fetchUsers = useCallback(async () => {
    if (!connectionProfile) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await getAllUsers(connectionProfile);
      setUsers(data);

      // 刷新后检查当前选中的用户是否还存在，如果不存在则清除选中状态
      setSelectedUser((prevSelected) => {
        if (prevSelected) {
          const stillExists = data.some(
            (user) => user.username === prevSelected.username && user.host === prevSelected.host
          );
          return stillExists ? prevSelected : null;
        }
        return null;
      });
    } catch (err) {
      setError(t('userTab.loadFailed', { error: err }));
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [connectionProfile, getAllUsers, t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRefresh = useCallback(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleNew = useCallback(() => {
    onOpenUserEditor?.('', '');
  }, [onOpenUserEditor]);

  const handleEdit = useCallback((user: UserSummary) => {
    onOpenUserEditor?.(user.username, user.host);
  }, [onOpenUserEditor]);

  const handleDelete = useCallback((user: UserSummary) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!userToDelete) return;

    try {
      await dropUser(connectionProfile, userToDelete.username, userToDelete.host);
      setDeleteDialogOpen(false);

      // 如果被删除的用户是当前选中的用户，清除选中状态
      if (selectedUser?.username === userToDelete.username && selectedUser?.host === userToDelete.host) {
        setSelectedUser(null);
      }

      setUserToDelete(null);
      fetchUsers();
    } catch (err) {
      setError(t('userTab.deleteFailed', { error: err }));
    }
  }, [userToDelete, connectionProfile, fetchUsers, selectedUser, t]);

  const handleDoubleClick = useCallback((user: UserSummary) => {
    onOpenUserEditor?.(user.username, user.host);
  }, [onOpenUserEditor]);

  const filteredUsers = users.filter((user) => {
    if (!searchText) return true;
    return (
      user.username.toLowerCase().includes(searchText.toLowerCase()) ||
      user.host.toLowerCase().includes(searchText.toLowerCase())
    );
  });

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
              placeholder={t('userTab.searchPlaceholder')}
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

          <div className={cn('ml-1 flex items-center text-xs', theme === 'dark' ? 'text-[#abb3bf]' : 'text-[#5f6b7c]')}>
            <span className="whitespace-nowrap">
              {t('userTab.totalCount', { count: filteredUsers.length })}
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

            <Button
              minimal
              small
              icon={<AddIcon size={14} />}
              onClick={handleNew}
              title={t('userTab.newUser')}
            >
              {t('common.create')}
            </Button>

            {selectedUser && (
              <>
                <Button
                  minimal
                  small
                  icon={<EditIcon size={14} />}
                  onClick={() => handleEdit(selectedUser)}
                  title={t('common.edit')}
                >
                  {t('common.edit')}
                </Button>
                <Button
                  minimal
                  small
                  icon={<DeleteIcon size={14} />}
                  intent="danger"
                  onClick={() => handleDelete(selectedUser)}
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
            <span>{t('userTab.loading')}</span>
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

        {!isLoading && !error && filteredUsers.length === 0 && (
          <div className={cn('flex h-full items-center justify-center text-sm', theme === 'dark' ? 'text-[#abb3bf]' : 'text-[#5f6b7c]')}>
            <span>{t('userTab.empty')}</span>
          </div>
        )}

        {!isLoading && !error && filteredUsers.length > 0 && (
          <div className="user-table-wrapper min-h-0 flex-1 overflow-auto p-2">
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
                {filteredUsers.map((user) => (
                  <tr
                    key={`${user.username}@${user.host}`}
                    className={cn(
                      'cursor-pointer transition-colors duration-100',
                      selectedUser?.username === user.username && selectedUser?.host === user.host
                        ? theme === 'dark'
                          ? 'bg-[#1d4ed8] text-white'
                          : 'bg-[#2d72d2] text-white'
                        : theme === 'dark'
                          ? 'bg-[#252a31] text-[#f6f7f9] hover:bg-[rgba(143,153,168,0.15)]'
                          : 'bg-[#f5f6f7] text-[#1c2127] hover:bg-[rgba(143,153,168,0.15)]',
                    )}
                    onClick={() => setSelectedUser(user)}
                    onDoubleClick={() => handleDoubleClick(user)}
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
                        {col.render(user)}
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
          setUserToDelete(null);
        }}
        onConfirm={confirmDelete}
      >
        <p>
          {t('userTab.deleteConfirm', { username: userToDelete?.username, host: userToDelete?.host })}
        </p>
        <p>{t('userTab.deleteWarning')}</p>
      </Alert>
    </div>
  );
};

