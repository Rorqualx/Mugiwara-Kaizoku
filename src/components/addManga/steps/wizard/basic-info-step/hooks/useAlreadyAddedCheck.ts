/**
 * useAlreadyAddedCheck Hook
 *
 * Checks if search results are already added to the library.
 * Provides distinction between "in current library" vs "in other library".
 *
 * @module components/addManga/steps/wizard/basic-info-step/hooks/useAlreadyAddedCheck
 */

import { useMemo } from 'react';

import { trpc } from '@/utils/trpc-client/index';

/**
 * Result item structure for already added check
 */
export interface AlreadyAddedResult {
  id: string;
  provider: string;
  alreadyAdded: boolean;
  inCurrentLibrary: boolean;
  inOtherLibrary: boolean;
  existingMangaId?: number | undefined;
  existingTitle?: string | undefined;
  libraryName?: string | undefined;
}

/**
 * Search result item with id and provider
 */
export interface SearchResultItem {
  id?: string;
  provider?: string;
  source?: string;
  sourceId?: string;
}

/**
 * Parameters for useAlreadyAddedCheck hook
 */
export interface UseAlreadyAddedCheckParams {
  /** Search results to check */
  results: SearchResultItem[];
  /** Current library ID for distinction */
  currentLibraryId?: number | undefined;
  /** Whether to enable the query */
  enabled?: boolean | undefined;
}

/**
 * Return type for useAlreadyAddedCheck hook
 */
export interface UseAlreadyAddedCheckReturn {
  /** Map for O(1) lookup by provider-id key */
  alreadyAddedMap: Map<string, AlreadyAddedResult>;
  /** Loading state */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
}

/**
 * Extracts id from a search result item
 */
function extractId(item: SearchResultItem): string {
  return item.id ?? item.sourceId ?? '';
}

/**
 * Extracts provider from a search result item
 */
function extractProvider(item: SearchResultItem): string {
  return item.provider ?? item.source ?? '';
}

/**
 * Custom hook for checking if search results are already added to library
 *
 * @param params - Hook parameters
 * @returns Map for O(1) lookup and loading state
 *
 * @example
 * ```tsx
 * const { alreadyAddedMap, isLoading } = useAlreadyAddedCheck({
 *   results: searchResults,
 *   currentLibraryId: 1
 * });
 *
 * // Check if a result is already added
 * const status = alreadyAddedMap.get(`${provider}-${id}`);
 * if (status?.inCurrentLibrary) {
 *   // Show "In This Library" badge
 * } else if (status?.inOtherLibrary) {
 *   // Show "In Other Library" badge
 * }
 * ```
 */
export function useAlreadyAddedCheck(
  params: UseAlreadyAddedCheckParams
): UseAlreadyAddedCheckReturn {
  const { results, currentLibraryId, enabled = true } = params;

  // Prepare input for the query - filter out items without valid id/provider
  const queryInput = useMemo(() => {
    const validResults = results
      .map((r) => ({
        id: extractId(r),
        provider: extractProvider(r),
      }))
      .filter((r) => r.id && r.provider);

    return {
      results: validResults,
      currentLibraryId,
    };
  }, [results, currentLibraryId]);

  // Query the backend
  const { data, isLoading, error } = trpc.metadata.checkAlreadyAdded.useQuery(queryInput, {
    enabled: enabled && queryInput.results.length > 0,
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: false,
  });

  // Build lookup map for O(1) access
  const alreadyAddedMap = useMemo(() => {
    const map = new Map<string, AlreadyAddedResult>();

    if (!data) {
      return map;
    }

    for (const result of data) {
      const key = `${result.provider}-${result.id}`;
      map.set(key, result);
    }

    return map;
  }, [data]);

  return {
    alreadyAddedMap,
    isLoading,
    error: error instanceof Error ? error : (error ? new Error(String(error)) : null),
  };
}
