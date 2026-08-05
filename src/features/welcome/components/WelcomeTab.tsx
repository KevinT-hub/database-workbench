import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '@blueprintjs/core';
import { useTranslation } from 'react-i18next';
import { useTabStore, useAppStore } from '@/stores';
import { useTraceTarget, resolveQueryTrace } from '@/hooks';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import logoImage from '@/assets/Database Workbench.png';
import { cn } from '@/lib/cn';

// 最近文件项
interface RecentFile {
  path: string;
  name: string;
  lastOpened: number;
}

export const WelcomeTab: React.FC = () => {
  const { theme, setStatusMessage } = useAppStore();
  const { t, i18n } = useTranslation();
  const { addTab } = useTabStore();
  // 痕迹递推统一入口：查询类动作只预填「打开状态」的连接/数据库
  const trace = useTraceTarget();
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

  // 加载最近文件
  const loadRecentFiles = useCallback(() => {
    const saved = localStorage.getItem('dbw-recent-files');
    if (saved) {
      try {
        const files = JSON.parse(saved);
        setRecentFiles(files.slice(0, 6));
      } catch {
        // 忽略解析错误
      }
    }
  }, []);

  // 初始加载和监听更新
  useEffect(() => {
    loadRecentFiles();
    // 监听最近文件更新事件
    const handleRecentFilesUpdated = () => {
      loadRecentFiles();
    };
    window.addEventListener('dbw:recent-files-updated', handleRecentFilesUpdated);
    return () => {
      window.removeEventListener('dbw:recent-files-updated', handleRecentFilesUpdated);
    };
  }, [loadRecentFiles]);

  // 新建连接
  const handleNewConnection = () => {
    window.dispatchEvent(new CustomEvent('dbw:new-connection'));
    setStatusMessage(t('welcomeTab.status.openNewConnection'));
  };

  // 新建查询
  const handleNewQuery = () => {
    // 查询不要求连接和数据库（不阻断）：统一痕迹预填（仅预填打开状态）
    const resolved = resolveQueryTrace(trace);
    addTab({
      type: 'query',
      title: t('welcomeTab.newQuery'),
      isModified: false,
      connectionId: resolved.connection?.name,
      connectionProfile: resolved.connection,
      database: resolved.database,
    });
    setStatusMessage(t('welcomeTab.status.newQuery'));
  };

  // 打开SQL文件
  const handleOpenFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: t('welcomeTab.sqlFiles'), extensions: ['sql'] },
          { name: t('welcomeTab.allFiles'), extensions: ['*'] },
        ],
      });
      if (selected && typeof selected === 'string') {
        const content = await readTextFile(selected);
        const fileName = selected.split(/[/\\]/).pop() || t('welcomeTab.untitled');

        // 打开 SQL 文件同查询：不阻断，统一痕迹预填（仅预填打开状态）
        const resolved = resolveQueryTrace(trace);
        addTab({
          type: 'query',
          title: fileName,
          isModified: false,
          sqlContent: content,
          sqlFilePath: selected,
          connectionId: resolved.connection?.name,
          connectionProfile: resolved.connection,
          database: resolved.database,
        });
        setStatusMessage(t('welcomeTab.status.openFile', { name: fileName }));
        addToRecentFiles(selected, fileName);
      }
    } catch (error) {
      setStatusMessage(t('welcomeTab.status.openFileFailed', { error: String(error) }));
    }
  };

  // 添加到最近文件
  const addToRecentFiles = (path: string, name: string) => {
    const newFile: RecentFile = {
      path,
      name,
      lastOpened: Date.now(),
    };
    setRecentFiles(prev => {
      const filtered = prev.filter(f => f.path !== path);
      const updated = [newFile, ...filtered].slice(0, 8);
      localStorage.setItem('dbw-recent-files', JSON.stringify(updated));
      return updated.slice(0, 6);
    });
  };

  // 打开最近文件
  const handleOpenRecentFile = async (file: RecentFile) => {
    try {
      const content = await readTextFile(file.path);
      // 同查询：统一痕迹预填（仅预填打开状态）
      const resolved = resolveQueryTrace(trace);
      addTab({
        type: 'query',
        title: file.name,
        isModified: false,
        sqlContent: content,
        sqlFilePath: file.path,
        connectionId: resolved.connection?.name,
        connectionProfile: resolved.connection,
        database: resolved.database,
      });
      setStatusMessage(t('welcomeTab.status.openFile', { name: file.name }));
      addToRecentFiles(file.path, file.name);
    } catch (error) {
      setStatusMessage(t('welcomeTab.status.openFileFailed', { error: String(error) }));
    }
  };

  // 清除最近文件
  const handleClearRecentFiles = () => {
    localStorage.removeItem('dbw-recent-files');
    setRecentFiles([]);
    setStatusMessage(t('welcomeTab.status.clearRecentFiles'));
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return t('welcomeTab.time.justNow');
    if (diff < 3600000) return t('welcomeTab.time.minutesAgo', { minutes: Math.floor(diff / 60000) });
    if (diff < 86400000) return t('welcomeTab.time.hoursAgo', { hours: Math.floor(diff / 3600000) });
    if (diff < 604800000) return t('welcomeTab.time.daysAgo', { days: Math.floor(diff / 86400000) });

    return date.toLocaleDateString(i18n.language === 'zh-CN' ? 'zh-CN' : 'en-US');
  };

  return (
    <div className={cn('w-full h-full overflow-auto', theme === 'dark' ? 'bg-[#1e1e1e]' : 'bg-[#f8f9fa]', `bp5-${theme}`)}>
      <div className="mx-auto flex h-full max-w-[1200px] items-center gap-20 px-12 max-[900px]:flex-col max-[900px]:items-start max-[900px]:gap-12 max-[900px]:px-6 max-[900px]:py-12">
        {/* 左侧：Logo 和标题 */}
        <div className="flex w-[300px] shrink-0 items-center justify-center max-[900px]:w-full max-[900px]:flex-none">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className={cn(
              'mb-2 flex h-[128px] w-[128px] items-center justify-center rounded-[24px] bg-gradient-to-br from-[#007acc] to-[#005a9e]',
              theme === 'dark'
                ? 'shadow-[0_8px_32px_rgba(0,122,204,0.35)]'
                : 'shadow-[0_8px_32px_rgba(0,122,204,0.25)]',
            )}>
              <img src={logoImage} alt="Database Workbench" className="h-[70%] w-[70%] object-contain brightness-0 invert" />
            </div>
            <h1 className="m-0 text-[28px] font-semibold tracking-[-0.5px] text-app-text">Database Workbench</h1>
            <p className="m-0 text-sm text-app-text opacity-70">{t('welcomeTab.subtitle')}</p>
          </div>
        </div>

        {/* 右侧：开始和最近 */}
        <div className="flex max-w-[500px] flex-1 flex-col gap-10 max-[900px]:w-full max-[900px]:max-w-none">
          {/* 开始区域 */}
          <div className="flex flex-col gap-3">
            <h2 className="m-0 text-[13px] font-semibold uppercase tracking-[0.5px] text-app-text opacity-70">
              {t('welcomeTab.startSection')}
            </h2>
            <div className="flex flex-col gap-0.5">
              <div
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-app-text transition-all duration-150',
                  theme === 'dark' ? 'hover:bg-[#2a2d2e]' : 'hover:bg-[#e8e8e8]',
                )}
                onClick={handleNewConnection}
              >
                <Icon icon="data-connection" size={16} className="!grow !basis-0 text-[#007acc]" />
                <span className="flex-1 text-sm">{t('welcomeTab.newConnection')}</span>
                <span className="grow basis-0 shrink-0 font-['SF_Mono','Monaco','Cascadia_Code',monospace] text-sm text-app-text opacity-70">Ctrl+N</span>
              </div>
              <div
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-app-text transition-all duration-150',
                  theme === 'dark' ? 'hover:bg-[#2a2d2e]' : 'hover:bg-[#e8e8e8]',
                )}
                onClick={handleNewQuery}
              >
                <Icon icon="code" size={16} className="!grow !basis-0 text-[#007acc]" />
                <span className="flex-1 text-sm">{t('welcomeTab.newQuery')}</span>
                <span className="grow basis-0 shrink-0 font-['SF_Mono','Monaco','Cascadia_Code',monospace] text-sm text-app-text opacity-70">Ctrl+Q</span>
              </div>
              <div
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-app-text transition-all duration-150',
                  theme === 'dark' ? 'hover:bg-[#2a2d2e]' : 'hover:bg-[#e8e8e8]',
                )}
                onClick={handleOpenFile}
              >
                <Icon icon="document-open" size={16} className="!grow !basis-0 text-[#007acc]" />
                <span className="flex-1 text-sm">{t('welcomeTab.openSqlFile')}</span>
                <span className="grow basis-0 shrink-0 font-['SF_Mono','Monaco','Cascadia_Code',monospace] text-sm text-app-text opacity-70">Ctrl+O</span>
              </div>
            </div>
          </div>

          {/* 最近文件区域 */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="m-0 text-[13px] font-semibold uppercase tracking-[0.5px] text-app-text opacity-70">
                {t('welcomeTab.recentSection')}
              </h2>
              {recentFiles.length > 0 && (
                <button
                  className={cn(
                    'cursor-pointer rounded border-none bg-transparent px-1.5 py-0.5 text-xs text-[#007acc] transition-all duration-150 hover:underline',
                    theme === 'dark' ? 'hover:bg-[#2a2d2e]' : 'hover:bg-[#e8e8e8]',
                  )}
                  onClick={handleClearRecentFiles}
                >
                  {t('welcomeTab.clearRecentFiles')}
                </button>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              {recentFiles.length === 0 ? (
                <div className="px-3 py-4 text-sm italic text-app-text opacity-70">{t('welcomeTab.noRecentFiles')}</div>
              ) : (
                <div>
                  {recentFiles.map((file, index) => (
                    <div
                      key={index}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-app-text transition-all duration-150',
                        theme === 'dark' ? 'hover:bg-[#2a2d2e]' : 'hover:bg-[#e8e8e8]',
                      )}
                      onClick={() => handleOpenRecentFile(file)}
                      title={file.path}
                    >
                      <Icon icon="document" size={16} className="!grow !basis-0 text-[#007acc]" />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
                        <span className="truncate text-sm text-app-text">{file.name}</span>
                        <span className="truncate text-sm text-app-text opacity-70">{file.path}</span>
                      </div>
                      <span className="grow basis-0 shrink-0 whitespace-nowrap text-sm text-app-text opacity-70">
                        {formatTime(file.lastOpened)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
