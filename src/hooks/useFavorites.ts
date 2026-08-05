import { useState, useCallback, useEffect } from 'react';
import { favoritesApi } from '@/api';
import type { FavoriteItem, FavoriteType } from '../types';

const FAVORITES_UPDATED_EVENT = 'dbw:favorites-updated';

const notifyFavoritesUpdated = () => {
  window.dispatchEvent(new CustomEvent(FAVORITES_UPDATED_EVENT));
};

interface UseFavoritesReturn {
  favorites: FavoriteItem[];
  loading: boolean;
  error: string | null;
  getAll: () => Promise<void>;
  getByType: (type: FavoriteType) => Promise<void>;
  search: (keyword: string) => Promise<void>;
  get: (id: string) => Promise<FavoriteItem | null>;
  add: (item: Omit<FavoriteItem, 'id'>) => Promise<FavoriteItem>;
  update: (item: FavoriteItem) => Promise<void>;
  remove: (id: string) => Promise<void>;
  recordUsage: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  total: () => Promise<number>;
  stats: () => Promise<string>;
}

export function useFavorites(): UseFavoritesReturn {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await favoritesApi.getAll();
      setFavorites(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get favorites');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleFavoritesUpdated = () => {
      void getAll();
    };
    window.addEventListener(FAVORITES_UPDATED_EVENT, handleFavoritesUpdated);
    return () => {
      window.removeEventListener(FAVORITES_UPDATED_EVENT, handleFavoritesUpdated);
    };
  }, [getAll]);

  const getByType = useCallback(async (type: FavoriteType) => {
    setLoading(true);
    setError(null);
    try {
      const result = await favoritesApi.getByType(type);
      setFavorites(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get favorites by type');
    } finally {
      setLoading(false);
    }
  }, []);

  const search = useCallback(async (keyword: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await favoritesApi.search(keyword);
      setFavorites(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search favorites');
    } finally {
      setLoading(false);
    }
  }, []);

  const get = useCallback(async (id: string): Promise<FavoriteItem | null> => {
    setError(null);
    try {
      return await favoritesApi.get(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get favorite');
      return null;
    }
  }, []);

  const add = useCallback(async (item: Omit<FavoriteItem, 'id'>): Promise<FavoriteItem> => {
    setLoading(true);
    setError(null);
    try {
      const result = await favoritesApi.add(item as FavoriteItem);
      notifyFavoritesUpdated();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add favorite');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const update = useCallback(async (item: FavoriteItem): Promise<void> => {
    if (!item.id) {
      setError('Cannot update favorite without id');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await favoritesApi.update(item.id, item);
      notifyFavoritesUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update favorite');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const remove = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await favoritesApi.remove(id);
      notifyFavoritesUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove favorite');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const recordUsage = useCallback(async (id: string): Promise<void> => {
    setError(null);
    try {
      await favoritesApi.recordUsage(id);
      notifyFavoritesUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record usage');
    }
  }, []);

  const clear = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await favoritesApi.clear();
      notifyFavoritesUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear favorites');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const total = useCallback(async (): Promise<number> => {
    setError(null);
    try {
      return await favoritesApi.total();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get total count');
      return 0;
    }
  }, []);

  const stats = useCallback(async (): Promise<string> => {
    setError(null);
    try {
      return await favoritesApi.stats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get stats');
      return '';
    }
  }, []);

  return {
    favorites,
    loading,
    error,
    getAll,
    getByType,
    search,
    get,
    add,
    update,
    remove,
    recordUsage,
    clear,
    total,
    stats,
  };
}
