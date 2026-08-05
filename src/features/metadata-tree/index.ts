// features/metadata-tree/index.ts —— 公开 API 边界
export { MetadataTree } from './components/MetadataTree';
// 系统库集合常量：状态栏等跨 feature 消费方按公开 API 边界引用（判断数据库是否为系统库）
export { SYSTEM_DATABASES } from './treeUtils';
