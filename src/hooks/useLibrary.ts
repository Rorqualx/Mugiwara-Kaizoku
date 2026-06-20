import { useEffect } from 'react';

import { useRealTime } from '@/providers/RealTimeProvider';
import { useLibraryStore } from '@/store';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client/index';

import { useNotification } from './useNotification';

import type { Library, Manga } from '@prisma/client';

/**
 * Transformed library type from the query endpoint
 * Includes mangas array and count
 * Note: The query endpoint returns library data with base fields plus transformed manga data
 */
interface TransformedLibrary {
  id: number;
  name: string;
  path: string;
  ownerId: string;
  createdAt: Date;
  lastScanAt: Date | null;
  mangas: Array<Record<string, unknown> & { interval: string; id: number; title: string }>;
  mangaCount: number;
}

/**
 * Library data response type
 */
interface LibraryDataResponse {
  data?: TransformedLibrary[] | TransformedLibrary | null;
}

/**
 * Type for the return value of the useLibrary hook
 */
interface UseLibraryResult {
  /** List of available libraries */
  libraries: TransformedLibrary[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  isError: boolean;
  /** Error object if any */
  error: Error | null;
  /** Create a new library */
  createLibrary: (path: string) => Promise<Library>;
  /** Refresh the list of libraries */
  refetchLibraries: () => Promise<LibraryDataResponse>;
  /** Currently selected library */
  library?: TransformedLibrary;
  /** Manga in the selected library */
  manga: Manga[];
  /** Refresh the selected library */
  refreshLibrary: (libraryId?: string | number) => Promise<LibraryDataResponse>;
  /** Whether the hook is receiving real-time updates */
  isRealtime: boolean;
}

/**
 * Hook for managing manga libraries
 * 
 * This hook provides functionality for creating and managing manga libraries.
 * It handles library creation with proper error handling and notifications,
 * and provides access to the list of existing libraries.
 * 
 * @param libraryId Optional library ID to fetch a specific library
 * @returns Library management functions and state
 */
export function useLibrary(libraryId?: string | number): UseLibraryResult {
  // Initialize hooks
  const {
    showSuccess,
    showError
  } = useNotification();

  // Get WebSocket connection status for real-time updates
  const { isConnected, subscribe } = useRealTime();

  // Query libraries from tRPC with WebSocket-aware polling
  // When WebSocket is connected: no polling (real-time updates via subscription)
  // When WebSocket is disconnected: fallback to 30s polling
  const libraryQuery = trpc.library.query.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: isConnected ? false : 30000, // 30s fallback when disconnected
  });

  // Query a specific library if ID is provided - using the correct 'get' procedure
  // Always call the hook, but disable it when no ID is provided
  const libraryDetailQuery = trpc.library.get.useQuery({
    id: toNumberId(libraryId ?? 0)
  },
  // Provide a default value to satisfy type requirements
  {
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!libraryId, // Only run query if libraryId is available
    refetchInterval: isConnected ? false : 30000, // 30s fallback when disconnected
  });

  // Subscribe to library:updates channel for real-time updates
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe('library:updates', () => {
      logger.debug('useLibrary: Received library:updates event, refetching...');
      void libraryQuery.refetch();
      if (libraryId) {
        void libraryDetailQuery.refetch();
      }
    });

    return unsubscribe;
  }, [isConnected, subscribe, libraryId, libraryQuery, libraryDetailQuery]);

  useEffect(() => {
    if (libraryId) {
      logger.debug('useLibrary query state', {
        libraryId,
        status: libraryDetailQuery.status,
        hasData: !!libraryDetailQuery.data,
        isLoading: libraryDetailQuery.isLoading
      });
    }
  }, [libraryId, libraryDetailQuery]);

  // Setup mutation for creating libraries
  const createMutation = trpc.library.create.useMutation();

  // Update library store when data changes
  useEffect(() => {
    const {
      data
    } = libraryQuery;
    if (Array.isArray(data) && !libraryQuery.isError) {
      // Update the store with the libraries
      // Type assertion: The data from the query is already in the correct format
      const setLibraries = useLibraryStore.getState().setLibraries;
      setLibraries(data as unknown as TransformedLibrary[]);
      logger.debug(`useLibrary: Updated library store with ${data.length} libraries`);
    }
  }, [libraryQuery]);

  // Create a new library
  const createLibrary = async (path: string): Promise<Library> => {
    try {
      // Create the library via tRPC
      const result = await createMutation.mutateAsync({
        path,
        name: path
      });
      try {
        // Refetch libraries to update the store
        await libraryQuery.refetch();

        // Show success notification
        showSuccess({
          title: 'Library Created',
          message: `Created library at ${path}`
        });
      } catch (refetchError: unknown) {
        // Handle refetch errors
        showError({
          title: 'Creation Failed',
          message: refetchError instanceof Error ? refetchError.message : 'Failed to refresh library list'
        });
        throw refetchError;
      }

      // Return the result directly
      return result;
    } catch (error: unknown) {
      // Handle creation errors
      showError({
        title: 'Creation Failed',
        message: error instanceof Error ? error.message : 'Failed to create library'
      });
      throw error;
    }
  };

  // Get libraries from query
  // Type assertion: The query endpoint returns transformed libraries with base fields + mangas + mangaCount
  const safeLibraries: TransformedLibrary[] = Array.isArray(libraryQuery.data) ? (libraryQuery.data as unknown as TransformedLibrary[]) : [];

  // Define a type-safe refetch function that handles errors
  const refetchLibraries = async (): Promise<LibraryDataResponse> => {
    try {
      const result = await libraryQuery.refetch();
      if (result.data && Array.isArray(result.data)) {
        // Type assertion: The data from the query is already in the correct format
        const libraries = result.data as unknown as TransformedLibrary[];
        return {
          data: libraries
        };
      }
      return {
        data: null
      };
    } catch (error: unknown) {
      logger.error('Failed to refetch libraries:', error);
      return {
        data: null
      };
    }
  };

  // Get manga for a specific library
  // The library.get endpoint returns a library object with a mangas array
  const libraryManga: Manga[] = (() => {
    if (!libraryDetailQuery.data || libraryDetailQuery.isError) {
      return [];
    }
    const mangas = libraryDetailQuery.data.mangas;
    if (!Array.isArray(mangas)) {
      return [];
    }

    // Return the manga data directly from the API with type assertion
    return mangas as Manga[];
  })();

  // Get the library data
  // Cast to TransformedLibrary type to satisfy exactOptionalPropertyTypes
  const library = (libraryDetailQuery.data) as TransformedLibrary | undefined;

  // Define a refresh function for a specific library
  const refreshLibrary = async (targetLibraryId?: string | number): Promise<LibraryDataResponse> => {
    const idToRefresh = targetLibraryId || libraryId;
    if (idToRefresh) {
      try {
        const result = await libraryDetailQuery.refetch();
        // Type assertion: The get endpoint returns a transformed library
        const typedData = result.data ? (result.data as unknown as TransformedLibrary) : null;
        return {
          data: typedData
        };
      } catch (error: unknown) {
        logger.error(`Failed to refresh library ${idToRefresh}:`, error);
      }
    }
    return {
      data: null
    };
  };

  // Return hook data and functions
  return {
    // General library list and functions
    libraries: safeLibraries,
    isLoading: libraryQuery.isLoading || libraryDetailQuery.isLoading,
    isError: libraryQuery.isError || libraryDetailQuery.isError,
    error: libraryQuery.error
      ? new Error(libraryQuery.error instanceof Error ? libraryQuery.error.message : 'Failed to fetch libraries')
      : libraryDetailQuery.error
        ? new Error(libraryDetailQuery.error instanceof Error ? libraryDetailQuery.error.message : 'Failed to fetch library details')
        : null,
    createLibrary,
    refetchLibraries,
    // Specific library data if requested (use spread for exactOptionalPropertyTypes compliance)
    ...(library && { library }),
    manga: libraryManga,
    refreshLibrary,
    // Real-time status
    isRealtime: isConnected,
  };
}