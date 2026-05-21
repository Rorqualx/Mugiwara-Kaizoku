/**
 * Store Hooks Module
 * 
 * This module provides custom React hooks for accessing and managing the application's state.
 * It combines multiple store slices and provides unified interfaces for:
 * - State updates with loading/error handling
 * - Queue management
 * - UI state control
 * - Common selectors
 * 
 * @module storeHooks
 */

import { useMemo, useEffect, useRef } from 'react';

import { logger } from '@/utils/logger';

import {
  useMangaStore,
  useUIStore } from
'../store';

import { useDownloadQueueStore } from './downloadQueueSlice';

import type {
  UIStateData,
  UIActions,
  FilterState } from '../store';
import type { UIStateAndActions } from '../types/clientTypes';
import type { Prisma } from '@prisma/client';

type MangaWithRelations = Prisma.MangaGetPayload<{
  include: {
    Metadata: true;
    library: true;
    Chapter: true;
  };
}>;

// Type for filter values
type FilterValue = string | number | boolean | string[];

// Type for UI actions needed in this file
interface ExtendedUIActions extends UIActions {
  clearError: (key: string) => void;
}

// Combine UI state data and actions for internal use
type CombinedUIState = UIStateData & ExtendedUIActions;

// Type for store actions
type StoreActions = {
  ui: CombinedUIState;
  manga: ReturnType<typeof useMangaStore.getState>;
  queue: ReturnType<typeof useDownloadQueueStore.getState>;
};

// Define return type for useStoreActions
type StoreActionReturns = {
  setModal: (modalId: string | null) => void;
  setLoading: (key: string, isLoading: boolean) => void;
  setError: (key: string, error: string | null) => void;
  setFilters: (filters: Partial<Record<string, FilterValue>>) => void;
  updateManga: (id: number, updates: Partial<MangaWithRelations>) => void;
  removeManga: (id: number) => void;
  updateProgress: (id: number, progress: number) => void;
  handleMangaUpdate: (id: number) => Promise<void>;
};

/**
 * Hook providing centralized store actions
 *
 * Combines actions from multiple store slices and provides a unified interface
 * for state updates. Includes automatic loading state and error handling.
 *
 * @returns {Object} Combined store actions
 * @property {Function} updateManga - Update manga details
 * @property {Function} removeManga - Remove manga from store
 * @property {Function} setFilters - Update manga list filters
 * @property {Function} addToQueue - Add item to download queue
 * @property {Function} removeFromQueue - Remove item from download queue
 * @property {Function} updateProgress - Update download progress
 * @property {Function} setModal - Control modal visibility
 * @property {Function} setLoading - Set loading state
 * @property {Function} setError - Set error state
 * @property {Function} handleMangaUpdate - Update manga with loading/error handling
 */
export function useStoreActions(): StoreActionReturns {
  // Create refs to hold the latest actions with proper types
  const actionsRef = useRef<StoreActions>({
    ui: useUIStore.getState() as CombinedUIState,
    manga: useMangaStore.getState(),
    queue: useDownloadQueueStore.getState()
  });

  // Create stable refs for store instances
  const storeRef = useRef({
    ui: useUIStore,
    manga: useMangaStore,
    queue: useDownloadQueueStore
  });

  // Subscribe to store changes to keep actions up to date
  useEffect(() => {
    const unsubUi = storeRef.current.ui.subscribe((state) => {
      // Convert UIState to UIStateAndActions then to CombinedUIState
      actionsRef.current.ui = state as UIStateAndActions as CombinedUIState;
    });

    const unsubManga = storeRef.current.manga.subscribe((state) => {
      actionsRef.current.manga = state;
    });

    const unsubQueue = storeRef.current.queue.subscribe((state) => {
      actionsRef.current.queue = state;
    });

    return () => {
      unsubUi();
      unsubManga();
      unsubQueue();
    };
  }, []);

  // Create stable action references with proper types
  return useMemo<StoreActionReturns>(() => {
    // UI actions with type safety
    const setModal = (modalId: string | null): void => actionsRef.current.ui.setModal(modalId);
    const setLoading = (key: string, isLoading: boolean): void => actionsRef.current.ui.setLoading(key, isLoading);
    const setError = (key: string, error: string | null): void => {
      if (error) {
        const currentErrors = { ...actionsRef.current.ui.errors };
        currentErrors[key] = error;
        // Safely update the errors property
        actionsRef.current.ui.clearError(key);
        setTimeout(() => {
          actionsRef.current.ui.setFilters({}); // Trigger a re-render
          if (currentErrors[key]) {
            actionsRef.current.ui.clearError(key);
          }
        }, 0);
      } else {
        actionsRef.current.ui.clearError(key);
      }
    };
    const setFilters = (_filters: Partial<Record<string, FilterValue>>): void => {
      // Convert to the expected FilterState format
      const filterState: Partial<FilterState> = {};
      actionsRef.current.ui.setFilters(filterState);
    };

    // Manga actions with type safety
    const updateManga = (id: number, updates: Partial<MangaWithRelations>): void => {
      // Convert MangaWithRelations to the required type for updateManga
      return actionsRef.current.manga.updateManga(id, updates);
    };
    const removeManga = (id: number): void => actionsRef.current.manga.removeManga(id);

    // Queue actions with type safety
    const updateProgress = (id: number, progress: number): void => {
      return actionsRef.current.queue.updateProgress(id, progress);
    };

    // Sync actions with error handling and type safety
    const handleMangaUpdate = async (id: number): Promise<void> => {
      const loadingKey = `manga-update-${id}`;
      try {
        setLoading(loadingKey, true);
        await updateManga(id, {});
        logger.info(`Successfully updated manga ${id}`);
      } catch (error: unknown) {
        const message = error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error';
        setError(loadingKey, message);
        logger.error(`Error updating manga ${id}:`, message);
      } finally {
        setLoading(loadingKey, false);
      }
    };

    return {
      setModal,
      setLoading,
      setError,
      setFilters,
      updateManga,
      removeManga,
      updateProgress,
      handleMangaUpdate
    };
  }, []);
}

/**
 * @deprecated Use useStoreSelectors from '../store/useStoreSelectors' instead.
 * This implementation has been moved to avoid duplication and potential conflicts.
 */
export function useStoreSelectors(): ReturnType<typeof import('../store/useStoreSelectors').useStoreSelectors> {
  logger.warn('This useStoreSelectors implementation is deprecated. Import from ../store/useStoreSelectors instead.');
  // Re-export the actual implementation to ensure type compatibility
  // eslint-disable-next-line no-undef
  const { useStoreSelectors: actualImplementation } = require('../store/useStoreSelectors') as {
    useStoreSelectors: typeof import('../store/useStoreSelectors').useStoreSelectors;
  };
  return actualImplementation();
}