import { useCallback } from 'react';

import { useLocalStorage } from '@mantine/hooks';

import type { MangaWithRelations } from '../types/search.types';

/**
 * Configuration options for the persistence hook
 * 
 * @interface PersistenceOptions
 * @template T Type of data to persist
 * @property {string} key - Local storage key to store data under
 * @property {T} defaultValue - Default value if no data exists
 * @property {number} [version=1] - Version number for data schema
 */
export interface PersistenceOptions<T> {
  key: string;
  defaultValue: T;
  version?: number;
}

/**
 * Data structure stored in local storage
 */
export interface PersistenceData<T> {
  value: T;
  version: number;
  timestamp: number;
}

/**
 * Return type for the usePersistence hook
 */
export interface UsePersistenceResult<T> {
  data: T;
  updateData: (newValue: T) => void;
  clearData: () => void;
  version: number;
  timestamp: number;
}

/**
 * Hook for persisting data in local storage with versioning
 * 
 * This hook provides a way to store and retrieve data from local storage
 * with version tracking and timestamps. It's useful for caching data that
 * needs to be persisted across page reloads or browser sessions.
 * 
 * @template T Type of data to persist
 * @param {PersistenceOptions<T>} options - Configuration options
 * @returns {UsePersistenceResult<T>} Storage management functions and data
 * 
 * @example
 * ```tsx
 * const { data, updateData } = usePersistence({
 *   key: 'user-preferences',
 *   defaultValue: { theme: 'light' },
 *   version: 1
 * });
 * ```
 */
export function usePersistence<T>({ 
  key, 
  defaultValue, 
  version = 1 
}: PersistenceOptions<T>): UsePersistenceResult<T> {
  const [data, setData] = useLocalStorage<PersistenceData<T>>({
    key,
    defaultValue: {
      value: defaultValue,
      version,
      timestamp: Date.now()
    }
  });

  const updateData = useCallback((newValue: T): void => {
    setData({
      value: newValue,
      version,
      timestamp: Date.now()
    });
  }, [setData, version]);

  const clearData = useCallback((): void => {
    setData({
      value: defaultValue,
      version,
      timestamp: Date.now()
    });
  }, [setData, defaultValue, version]);

  return {
    data: data.value,
    updateData,
    clearData,
    version: data.version,
    timestamp: data.timestamp
  };
}

/**
 * Hook for caching manga data in local storage
 * 
 * This hook provides persistent storage for manga data, allowing quick access
 * to previously loaded manga without fetching from the server again.
 * 
 * @returns {UsePersistenceResult<MangaWithRelations[]>} Manga cache management functions
 * 
 * @example
 * ```tsx
 * const { data: cachedManga, updateData } = useMangaCache();
 * ```
 */
export function useMangaCache(): UsePersistenceResult<MangaWithRelations[]> {
  return usePersistence<MangaWithRelations[]>({
    key: 'manga-cache',
    defaultValue: [],
    version: 2
  });
}

/**
 * Hook for tracking recently viewed manga
 * 
 * This hook maintains a list of recently viewed manga IDs in local storage,
 * useful for implementing "recently viewed" functionality.
 * 
 * @returns {UsePersistenceResult<number[]>} Recent manga management functions
 * 
 * @example
 * ```tsx
 * const { data: recentIds, updateData } = useRecentManga();
 * ```
 */
export function useRecentManga(): UsePersistenceResult<number[]> {
  return usePersistence<number[]>({
    key: 'recent-manga',
    defaultValue: [],
    version: 1
  });
}
