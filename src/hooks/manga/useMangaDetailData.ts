/**
 * Manga detail data: the manga query, its loading timeout and live updates.
 *
 * @module hooks/manga/useMangaDetailData
 */

import React from 'react';

import { useRouter } from 'next/router';

import { useRealTime } from '@/providers/RealTimeProvider';
import type { MangaWithRelations } from '@/types/search.types';
import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client';

// No chapter limit - manga like One Piece have 1000+ chapters
// When chapterLimit is 0 or undefined, the server returns all chapters
const DEFAULT_CHAPTER_LIMIT = 0;

/**
 * Hook for fetching manga data with loading state and timeout
 *
 * @param mangaId - The ID of the manga to fetch
 * @param _isLoading - Loading state from parent (not used in this implementation)
 * @returns Object containing manga data, loading timeout flag, refetch function, and auto-download config
 */
interface MangaDetailDataReturn {
  manga: MangaWithRelations | null;
  loadingTimeout: boolean;
  refetch: () => Promise<void>;
  autoDownloadConfig: null;
  /** True when the query is actively fetching data (initial load or refetch) */
  isQueryLoading: boolean;
  /** Whether real-time updates are active */
  isRealtime: boolean;
}

export function useMangaDetailData(mangaId: number | undefined, _isLoading: boolean): MangaDetailDataReturn {
  const [loadingTimeout, setLoadingTimeout] = React.useState(false);
  const _router = useRouter();

  // Get WebSocket connection status for real-time updates
  const { isConnected, subscribe } = useRealTime();

  // Fetch manga data using tRPC with WebSocket-aware polling
  // When WebSocket is connected: no polling (real-time updates via subscription)
  // When WebSocket is disconnected: fallback to 60s polling
  const mangaQuery = trpc.manga.get.useQuery(
    {
      id: mangaId ?? 0,
      chapterLimit: DEFAULT_CHAPTER_LIMIT
    },
    {
      enabled: mangaId !== undefined && mangaId > 0,
      retry: false,
      refetchOnWindowFocus: false,
      refetchInterval: isConnected ? false : 60000, // 60s fallback when disconnected
      // Allow client-side caching for 30s to avoid refetch when navigating back
      // Real-time WebSocket updates still trigger refetch immediately when data changes
      staleTime: 30_000, // Consider data fresh for 30 seconds
      gcTime: 300_000, // Keep unused data in cache for 5 minutes
    }
  );

  // Store refetch in ref to avoid dependency changes causing infinite loops
  const refetchRef = React.useRef(mangaQuery.refetch);
  React.useEffect(() => {
    refetchRef.current = mangaQuery.refetch;
  }, [mangaQuery.refetch]);

  // Subscribe to manga-specific WebSocket channel for real-time updates
  React.useEffect(() => {
    if (!isConnected || !mangaId) return;

    // Subscribe to manga updates (metadata, status changes)
    const unsubscribeManga = subscribe(`manga:${mangaId}:updates`, () => {
      logger.debug(`useMangaDetailData: Received manga:${mangaId}:updates event, refetching...`);
      void refetchRef.current();
    });

    // Subscribe to chapter updates (downloads, status changes)
    const unsubscribeChapters = subscribe(`manga:${mangaId}:chapters`, () => {
      logger.debug(`useMangaDetailData: Received manga:${mangaId}:chapters event, refetching...`);
      void refetchRef.current();
    });

    return () => {
      unsubscribeManga();
      unsubscribeChapters();
    };
  }, [isConnected, subscribe, mangaId]);

  // Set loading timeout after 20 seconds
  // This is a soft timeout - the query will continue loading
  // and eventually succeed, this just triggers the timeout UI state
  React.useEffect(() => {
    if (mangaQuery.isPending) {
      const timeout = setTimeout(() => {
        setLoadingTimeout(true);
        logger.debug(`Manga ${mangaId ?? 'unknown'} loading slow (>20s)`);
      }, 20000);

      return () => {
        clearTimeout(timeout);
      };
    } else {
      setLoadingTimeout(false);
    }
  }, [mangaQuery.isPending, mangaId]);

  // Only show loading on initial fetch (no cached data yet), not on background refetches.
  // Using isFetching here caused the page to unmount modals every 60s when polling was active.
  const hasValidMangaId = mangaId !== undefined && mangaId > 0;
  const isWaitingForData = !hasValidMangaId ||
    mangaQuery.isPending;

  return {
    // Return query data directly - the query key includes mangaId so each manga gets its own cache entry
    manga: mangaQuery.data ?? null,
    loadingTimeout,
    refetch: async (): Promise<void> => {
      await mangaQuery.refetch();
    },
    autoDownloadConfig: null, // TODO: Fetch auto-download config when available
    // Show loading when waiting for data
    isQueryLoading: isWaitingForData,
    // Real-time status
    isRealtime: isConnected,
  };
}
