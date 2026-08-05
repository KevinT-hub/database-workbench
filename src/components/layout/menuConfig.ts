import type { TFunction } from 'i18next';

// 菜单配置
export interface MenuItem {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  divider?: boolean;
  children?: MenuItem[];
  onClick?: () => void;
}

interface MenuConfig {
  label: string;
  items: MenuItem[];
}

// 获取菜单配置（支持 i18n）
export const getMenuConfig = (t: TFunction): MenuConfig[] => [
  {
    label: t('menu.file.title'),
    items: [
      { label: t('menu.file.newConnection'), shortcut: 'Ctrl+N' },
      { label: t('menu.file.newQuery'), shortcut: 'Ctrl+Q' },
      { label: t('menu.file.open'), shortcut: 'Ctrl+O' },
      { divider: true, label: '' },
      { label: t('menu.file.save'), shortcut: 'Ctrl+S' },
      { label: t('menu.file.saveAs'), shortcut: 'Ctrl+Alt+S' },
      { label: t('menu.file.invalidateCache') },
      { divider: true, label: '' },
      { label: t('menu.file.exit'), shortcut: 'Alt+F4' },
    ],
  },
  {
    label: t('menu.edit.title'),
    items: [
      { label: t('menu.edit.undo'), shortcut: 'Ctrl+Z' },
      { label: t('menu.edit.redo'), shortcut: 'Ctrl+Y' },
      { divider: true, label: '' },
      { label: t('menu.edit.cut'), shortcut: 'Ctrl+X' },
      { label: t('menu.edit.copy'), shortcut: 'Ctrl+C' },
      { label: t('menu.edit.paste'), shortcut: 'Ctrl+V' },
      { label: t('menu.edit.selectAll'), shortcut: 'Ctrl+A' },
    ],
  },
  {
    label: t('menu.view.title'),
    items: [
      { label: t('menu.view.refresh'), shortcut: 'F5' },
      { divider: true, label: '' },
      { label: t('menu.view.properties') },
      { divider: true, label: '' },
      { label: t('menu.view.toggleSidebar') },
      { label: t('menu.view.toggleStatusbar') },
    ],
  },
  {
    label: t('menu.favorites.title'),
    items: [
      { label: t('menu.favorites.add') },
      { label: t('menu.favorites.manage') },
      { divider: true, label: '' },
      { label: t('menu.favorites.sqlQueries') },
      { label: t('menu.favorites.connections') },
    ],
  },
  {
    label: t('menu.tools.title'),
    items: [
      { label: t('menu.tools.backup') },
      { label: t('menu.tools.restore') },
      { divider: true, label: '' },
      { label: t('menu.tools.importConnections') },
      { label: t('menu.tools.exportConnections') },
      { divider: true, label: '' },
      { label: t('menu.tools.options') },
    ],
  },
  {
    label: t('menu.window.title'),
    items: [
      { label: t('menu.window.maximize') },
      { label: t('menu.window.minimize') },
      { divider: true, label: '' },
      { label: t('menu.window.closeCurrentTab'), shortcut: 'Ctrl+W' },
      { label: t('menu.window.closeAllTabs') },
      { divider: true, label: '' },
      { label: t('menu.window.toggleTheme'), shortcut: 'Ctrl+Shift+L' },
    ],
  },
  {
    label: t('menu.help.title'),
    items: [
      { label: t('menu.help.mysqlDocs') },
      { label: t('menu.help.shortcuts') },
      { divider: true, label: '' },
      { label: t('menu.help.checkUpdate') },
      { divider: true, label: '' },
      { label: t('menu.help.about') },
    ],
  },
];
