import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// V2: Per-namespace JSON files (see V2前端架构规范.md §7.4)
// Files are split by module for maintainability, but merged into a single
// 'translation' namespace for backward compatibility with existing t('xxx.yyy')
// calls. Future migration to t('ns:key') syntax can happen incrementally.
import commonZh from './locales/zh-CN/common.json';
import menuZh from './locales/zh-CN/menu.json';
import queryZh from './locales/zh-CN/query.json';
import designerZh from './locales/zh-CN/designer.json';
import dialogZh from './locales/zh-CN/dialog.json';
import treeZh from './locales/zh-CN/tree.json';
import settingsZh from './locales/zh-CN/settings.json';

import commonEn from './locales/en-US/common.json';
import menuEn from './locales/en-US/menu.json';
import queryEn from './locales/en-US/query.json';
import designerEn from './locales/en-US/designer.json';
import dialogEn from './locales/en-US/dialog.json';
import treeEn from './locales/en-US/tree.json';
import settingsEn from './locales/en-US/settings.json';

// Merge all namespace modules into a single translation object.
// Each namespace file is a plain object whose top-level keys are the original
// i18n section names (e.g. common.json -> { common: {...}, theme: {...}, ... }).
const zhCN = {
  ...commonZh,
  ...menuZh,
  ...queryZh,
  ...designerZh,
  ...dialogZh,
  ...treeZh,
  ...settingsZh,
};

const enUS = {
  ...commonEn,
  ...menuEn,
  ...queryEn,
  ...designerEn,
  ...dialogEn,
  ...treeEn,
  ...settingsEn,
};

// 从 localStorage 读取语言设置
const getStoredLanguage = () => {
  try {
    const settings = localStorage.getItem('dbw-settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      // 支持两种格式：语言代码 (zh-CN/en-US) 或语言名称 (简体中文/English)
      if (parsed.language === 'zh-CN' || parsed.language === '简体中文') return 'zh-CN';
      if (parsed.language === 'en-US' || parsed.language === 'English') return 'en-US';
    }
  } catch {
    // 忽略错误
  }
  return null;
};

const storedLanguage = getStoredLanguage();

i18n
  // 使用浏览器语言检测器
  .use(LanguageDetector)
  // 使用 react-i18next
  .use(initReactI18next)
  // 初始化配置
  .init({
    // 资源文件
    resources: {
      'zh-CN': {
        translation: zhCN,
      },
      'en-US': {
        translation: enUS,
      },
    },
    // 默认语言（如果没有存储的语言）
    fallbackLng: 'zh-CN',
    // 语言检测器配置
    detection: {
      // 检测顺序：先检查我们的设置，然后是 localStorage，最后是浏览器语言
      order: ['querystring', 'localStorage', 'navigator'],
      // 缓存到 localStorage 的键名
      lookupLocalStorage: 'i18nextLng',
      // 不缓存到 cookie
      caches: ['localStorage'],
    },
    // 插值配置
    interpolation: {
      // 不转义（React 会自动处理）
      escapeValue: false,
    },
    // 调试模式（开发时开启）
    debug: false,
  });

// 如果存储了语言设置，立即切换
if (storedLanguage) {
  i18n.changeLanguage(storedLanguage);
}


// 切换语言函数

// 获取当前语言显示名称
