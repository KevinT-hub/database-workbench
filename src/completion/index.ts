// completion/index.ts —— SQL 自动补全 barrel

// 公开 API（消费方通过 @/completion 导入）
export {
  registerSQLCompletionProvider,
  setSQLCompletionContextForEditor,
  clearSQLCompletionContextForEditor,
  notifySQLMetadataChanged,
  updateCompletionProviderState,
} from './provider';
