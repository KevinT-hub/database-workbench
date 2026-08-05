// api/favorites.ts —— 收藏夹命令

import { invoke } from './client';
import type {
  FavoriteItem,
  FavoriteType,
} from '../types/favorite';

export const favoritesApi = {
  getAll: (): Promise<FavoriteItem[]> =>
    invoke<FavoriteItem[]>('favorites_get_all'),

  getByType: (favoriteType: FavoriteType): Promise<FavoriteItem[]> =>
    invoke<FavoriteItem[]>('favorites_get_by_type', { favoriteType }),

  search: (query: string): Promise<FavoriteItem[]> =>
    invoke<FavoriteItem[]>('favorites_search', { query }),

  get: (id: string): Promise<FavoriteItem | null> =>
    invoke<FavoriteItem | null>('favorites_get', { id }),

  add: (item: FavoriteItem): Promise<FavoriteItem> =>
    invoke<FavoriteItem>('favorites_add', { item }),

  update: (id: string, item: FavoriteItem): Promise<boolean> =>
    invoke<boolean>('favorites_update', { id, item }),

  remove: (id: string): Promise<boolean> =>
    invoke<boolean>('favorites_remove', { id }),

  recordUsage: (id: string): Promise<boolean> =>
    invoke<boolean>('favorites_record_usage', { id }),

  clear: (): Promise<void> => invoke<void>('favorites_clear'),

  total: (): Promise<number> => invoke<number>('favorites_total'),

  stats: (): Promise<string> =>
    invoke<string>('favorites_stats'),
};
