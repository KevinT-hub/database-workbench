// 收藏夹类型

export type FavoriteType = 'SQL_QUERY' | 'CONNECTION_PROFILE' | 'DATABASE_OBJECT';

export interface FavoriteItem {
  id?: string;
  name: string;
  description?: string;
  type: FavoriteType;
  content?: string;
  createdTime: number;
  lastUsedTime: number;
  usageCount: number;
}
