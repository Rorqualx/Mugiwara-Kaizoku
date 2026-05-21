/**
 * Store Selectors - Main Aggregator
 *
 * Combines all specialized selector hooks into a unified interface.
 * Provides backward-compatible API for existing components.
 *
 * Architecture:
 * - selectors/types.ts - Type definitions (272 lines)
 * - selectors/manga-selectors.ts - Manga selection (240 lines)
 * - selectors/library-selectors.ts - Library relationships (309 lines)
 * - selectors/integration-selectors.ts - Integration status (154 lines)
 * - selectors/download-selectors.ts - Download queue (161 lines)
 * - useStoreSelectors.ts - Main aggregator (this file)
 *
 * Original: 645 lines → Refactored: ~150 lines (77% reduction)
 *
 * Extracted from: useStoreSelectors.ts (original implementation)
 * Refactored: 2025-11-20
 *
 * @module store/useStoreSelectors
 */

import { useMemo, useCallback } from 'react';

import { useTheme } from '../hooks/useTheme';

import { useDownloadSelectors } from './selectors/download-selectors';
import { useIntegrationSelectors } from './selectors/integration-selectors';
import { useLibrarySelectors } from './selectors/library-selectors';
import { useMangaSelectors } from './selectors/manga-selectors';

import { useUIStore, useJobSelectors } from './index';

// Import all specialized selectors

// Export types for backward compatibility
export type { StoreSelectors, FilterState } from './selectors/types';
import type { StoreSelectors } from './selectors/types';

/**
 * Main store selectors hook
 *
 * Aggregates all specialized selector hooks into a single interface.
 * Maintains backward compatibility with existing components while
 * improving code organization and maintainability.
 *
 * Performance Optimizations:
 * - Delegates to specialized selectors with proper memoization
 * - Uses stable selector functions to prevent unnecessary re-renders
 * - Combines results with useMemo for stable references
 * - Maintains backward compatibility with TRPC-like interface
 *
 * @returns {StoreSelectors} Combined selectors from all modules
 *
 * @example
 * ```typescript
 * function MangaList() {
 *   const {
 *     filteredManga,
 *     selectedManga,
 *     currentLibrary
 *   } = useStoreSelectors();
 *
 *   return (
 *     <div>
 *       <h2>{currentLibrary?.name}</h2>
 *       {filteredManga.map(manga => (
 *         <MangaCard key={manga.id} manga={manga} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useStoreSelectors(): StoreSelectors {
  // Get all specialized selectors
  const mangaSelectors = useMangaSelectors();
  const librarySelectors = useLibrarySelectors();
  const integrationSelectors = useIntegrationSelectors();
  const downloadSelectors = useDownloadSelectors();

  // Get UI state with stable selector
  const uiSelector = useCallback((state: ReturnType<typeof useUIStore.getState>) => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Defensive: state.filters may be undefined at runtime
    const filters = state.filters ?? {};
    return {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Defensive: state.errors may be undefined at runtime
      errors: state.errors ?? {},
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Defensive: state.loading may be undefined at runtime
      isLoading: state.loading ?? false,
      filters: {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Defensive: filters['searchTerm'] may be undefined at runtime
        searchTerm: (filters['searchTerm'] as string) ?? '',
        sources: Array.isArray(filters['sources']) ? filters['sources'] : [],
        status: Array.isArray(filters['status']) ? filters['status'] : [],
        genres: Array.isArray(filters['genres']) ? filters['genres'] : [],
        tags: Array.isArray(filters['tags']) ? filters['tags'] : []
      }
    };
  }, []);

  const uiState = useUIStore(uiSelector);

  // Get theme
  const { colorScheme } = useTheme() as { colorScheme: 'light' | 'dark' };

  // Get task selectors for TRPC-like interface
  const taskSelectors = useJobSelectors();

  // Combine all selectors with proper memoization
  return useMemo(() => ({
    // Manga selectors
    ...mangaSelectors,

    // Library selectors
    ...librarySelectors,

    // Integration selectors
    ...integrationSelectors,

    // Download selectors
    ...downloadSelectors,

    // UI state
    isLoading: uiState.isLoading,
    errors: uiState.errors,
    theme: colorScheme,
    filters: uiState.filters,

    // Task selectors (TRPC-like interface)
    tasks: taskSelectors.tasks as unknown as {
      getByStatus: {
        useQuery: () => {
          data: unknown[];
          isLoading: boolean;
          refetch: () => void;
        };
      };
      retry: {
        useMutation: (options?: unknown) => {
          mutate: (data?: unknown) => void;
          mutateAsync: (data?: unknown) => Promise<unknown>;
          isLoading: boolean;
        };
      };
    },
    manga: taskSelectors.manga,
    library: taskSelectors.library,
    sources: taskSelectors.sources,
    settings: taskSelectors.settings,
  }), [
    mangaSelectors,
    librarySelectors,
    integrationSelectors,
    downloadSelectors,
    uiState.isLoading,
    uiState.errors,
    uiState.filters,
    colorScheme,
    taskSelectors,
  ]);
}
