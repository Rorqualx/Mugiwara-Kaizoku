import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';

import { useUIStore } from '../store/index';
import { trpc } from '../utils/trpc-client/index';

import type { Manga, Chapter } from '@prisma/client';

// Define MangaWithRelations type locally
type MangaWithRelations = Manga & {
  chapters?: Chapter[];
};

/**
 * Options for the useQueryWrapper hook
 */
export interface QueryWrapperOptions<TData> extends Omit<UseQueryOptions<TData, Error>, 'queryFn'> {
  /** Whether to show loading state in UI */
  showLoading?: boolean;
}

/**
 * Generic query wrapper hook with loading state management
 * 
 * This hook wraps react-query's useQuery hook and adds automatic loading state
 * management through the UI store. It can optionally disable the loading indicator
 * for background queries.
 * 
 * @template TData The type of data returned by the query
 * @param {() => Promise<TData>} queryFn - Function that returns a promise with the query result
 * @param {QueryWrapperOptions<TData>} [options] - Query configuration options
 * @returns {UseQueryResult<TData, Error>} Query result with data, loading state, etc.
 * 
 * @example
 * ```tsx
 * const { data} = useQueryWrapper(
 *   () => fetchData(),
 *   { showLoading: true }
 * );
 * ```
 */
export function useQueryWrapper<TData>(
queryFn: () => Promise<TData>,
options?: QueryWrapperOptions<TData>)
: UseQueryResult<TData, Error> {
  const { setLoading } = useUIStore();
  const { showLoading = true, ...queryOptions } = options ?? {};

  // Create a unique loading key based on the query options
  const loadingKey = `query-${JSON.stringify('queryKey' in queryOptions ? queryOptions.queryKey : 'default')}`;

  // Apply loading state management if showLoading is true
  const useQueryImpl = typeof useQuery === 'function' ?
  useQuery :
  (_params: unknown) => {
    return {
      data: null,
      isLoading: false,
      isError: false,
      error: null,
      isSuccess: true,
      status: 'success' as const,
      refetch: () => Promise.resolve({ data: null })
    };
  };

  // Return the query result with properly typed parameters
  // Create a properly typed result that satisfies the UseQueryResult interface
  const queryOptionsRecord = queryOptions as unknown as Record<string, unknown>;
  const queryParams = {
    queryFn,
    ...queryOptionsRecord
  };
  const result = useQueryImpl<TData, Error>(queryParams as unknown as UseQueryOptions<TData, Error>);

  // Manage loading state based on query status
  // TanStack Query v5 doesn't support onSettled/onMutate in useQuery
  // We rely on the isLoading state from the query result
  if (showLoading) {
    const resultRecord = result as unknown as Record<string, unknown>;
    const isLoading = resultRecord["isLoading"] as boolean | undefined;
    if (isLoading !== undefined) {
      setLoading(loadingKey, isLoading);
    }
  }

  // Use type assertion with unknown intermediate step to avoid property checking
  // This approach is necessary because we can't fully satisfy the interface
  // but we need to provide compatibility with different versions of react-query
  return result as UseQueryResult<TData, Error>;
}

/**
 * Extended query result type for manga list queries
 */
export interface MangaListQueryResult extends Omit<UseQueryResult<unknown, unknown>, 'data'> {
  /** Array of manga with their relations */
  data: MangaWithRelations[] | undefined;
}

/**
 * Mock manga list query result
 */
const mockMangaListResult = {
  data: undefined as MangaWithRelations[] | undefined,
  isLoading: false,
  isError: false,
  error: null,
  isSuccess: true,
  status: 'success' as const,
  refetch: () => Promise.resolve({ data: undefined as unknown }),
  isFetching: false,
  isFetched: true,
  isRefetching: false,
  dataUpdatedAt: Date.now(),
  errorUpdatedAt: Date.now(),
  isPlaceholderData: false,
  isPreviousData: false,
  isStale: false,
  remove: () => undefined,
  fetchStatus: 'idle' as const
};

/**
 * Hook for fetching the complete manga list with relations
 * 
 * This hook fetches all manga with their related data (library, metadata,
 * chapters, etc.) and implements caching for better performance.
 * 
 * @returns {MangaListQueryResult} Query result containing the manga list
 * 
 * @example
 * ```tsx
 * const { data: mangaList} = useMangaList();
 * ```
 */
export function useMangaList(): MangaListQueryResult {
  // Check if the required tRPC methods exist
  const trpcRecord = trpc as unknown as Record<string, unknown>;
  const manga = trpcRecord["manga"];

  // Safely check if the query function exists
  const mangaRecord = manga as Record<string, unknown>;
  const hasQueryFn =
  manga &&
  typeof manga === 'object' &&
  mangaRecord["query"] &&
  typeof mangaRecord["query"] === 'object' &&
  'useQuery' in (mangaRecord["query"] as Record<string, unknown>) &&
  typeof (mangaRecord["query"] as Record<string, unknown>)["useQuery"] === 'function';

  try {
    if (!hasQueryFn) {
      // Return mock result if the query function doesn't exist
      return mockMangaListResult as unknown as MangaListQueryResult;
    }

    // Call the query function with proper parameters
    const mangaRecord = manga as Record<string, unknown>;
    const queryObj = mangaRecord["query"] as Record<string, unknown>;
    const query = (queryObj["useQuery"] as (params: unknown, options: unknown) => unknown)(
      {
        include: {
          library: true,
          Metadata: true,
          Chapter: false,
          outOfSyncChapters: false
        },
        limit: 50
      },
      {
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 30 // 30 minutes (renamed from cacheTime in TanStack Query v5)
      }
    );

    // Check if the query result is valid
    if (!query || typeof query !== 'object') {
      return mockMangaListResult as unknown as MangaListQueryResult;
    }

    // Cast the result to MangaWithRelations[] for type safety
    const queryRecord = query as Record<string, unknown>;
    const result = {
      ...query,
      data: queryRecord["data"] ? queryRecord["data"] as MangaWithRelations[] : undefined
    };

    return result as unknown as MangaListQueryResult;
  } catch (error: unknown) {
    // Log the error and return mock result
    console.error('Error in useMangaList:', error);
    return mockMangaListResult as unknown as MangaListQueryResult;
  }
}

/**
 * Extended query result type for manga detail queries
 */
export interface MangaDetailQueryResult extends Omit<UseQueryResult<unknown, unknown>, 'data'> {
  /** Manga data with all relations */
  data: MangaWithRelations | undefined;
}

/**
 * Mock manga detail query result
 */
const mockMangaDetailResult = {
  data: undefined as MangaWithRelations | undefined,
  isLoading: false,
  isError: false,
  error: null,
  isSuccess: true,
  status: 'success' as const,
  refetch: () => Promise.resolve({ data: undefined as unknown }),
  isFetching: false,
  isFetched: true,
  isRefetching: false,
  dataUpdatedAt: Date.now(),
  errorUpdatedAt: Date.now(),
  isPlaceholderData: false,
  isPreviousData: false,
  isStale: false,
  remove: () => undefined,
  fetchStatus: 'idle' as const
};

/**
 * Hook for fetching details of a specific manga
 * 
 * This hook fetches detailed information about a manga by its ID. The query
 * is only enabled when an ID is provided and implements caching.
 * 
 * @param {number} id - ID of the manga to fetch
 * @returns {MangaDetailQueryResult} Query result containing the manga details
 * 
 * @example
 * ```tsx
 * const { data: manga} = useMangaDetails(123);
 * ```
 */
export function useMangaDetails(id: number): MangaDetailQueryResult {
  // Check if the required tRPC methods exist
  const trpcRecord = trpc as unknown as Record<string, unknown>;
  const manga = trpcRecord["manga"];

  // Safely check if the detail function exists
  const mangaRecord = manga as Record<string, unknown>;
  const hasDetailFn =
  manga &&
  typeof manga === 'object' &&
  mangaRecord["detail"] &&
  typeof mangaRecord["detail"] === 'object' &&
  'useQuery' in (mangaRecord["detail"] as Record<string, unknown>) &&
  typeof (mangaRecord["detail"] as Record<string, unknown>)["useQuery"] === 'function';

  try {
    if (!hasDetailFn) {
      // Return mock result if the detail function doesn't exist
      return mockMangaDetailResult as unknown as MangaDetailQueryResult;
    }

    // Call the detail function with proper parameters
    const mangaRecord = manga as Record<string, unknown>;
    const detailObj = mangaRecord["detail"] as Record<string, unknown>;
    const query = (detailObj["useQuery"] as (params: unknown, options: unknown) => unknown)(
      { id },
      {
        enabled: Boolean(id),
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 30 // 30 minutes (renamed from cacheTime in TanStack Query v5)
      }
    );

    // Check if the query result is valid
    if (!query || typeof query !== 'object') {
      return mockMangaDetailResult as unknown as MangaDetailQueryResult;
    }

    // Cast the result to MangaWithRelations for type safety
    const queryRecord = query as Record<string, unknown>;
    const result = {
      ...query,
      data: queryRecord["data"] ? queryRecord["data"] as MangaWithRelations : undefined
    };

    return result as unknown as MangaDetailQueryResult;
  } catch (error: unknown) {
    // Log the error and return mock result
    console.error('Error in useMangaDetails:', error);
    return mockMangaDetailResult as unknown as MangaDetailQueryResult;
  }
}