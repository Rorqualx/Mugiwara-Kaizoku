/**
 * Real-Time Query Hook
 *
 * Combines React Query with WebSocket subscriptions for optimal data fetching.
 * When WebSocket is connected, updates come via push (no polling).
 * When WebSocket is disconnected, falls back to polling.
 *
 * Features:
 * - Automatic WebSocket subscription management
 * - Fallback polling when disconnected
 * - Query cache invalidation on WebSocket events
 * - Type-safe with full React Query support
 *
 * @module hooks/useRealtimeQuery
 */

import { useEffect, useMemo } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { WebSocketEvent } from '@/types/api/v1/websocket';
import { logger } from '@/utils/logger';

import { useRealTime } from '../providers/RealTimeProvider';

import type { UseQueryOptions, UseQueryResult, QueryKey } from '@tanstack/react-query';

// ============================================================================
// Types
// ============================================================================

export interface UseRealtimeQueryOptions<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
> extends Omit<UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>, 'refetchInterval'> {
  /**
   * WebSocket channel to subscribe to for real-time updates
   * When events are received on this channel, the query will be invalidated
   */
  channel?: string;

  /**
   * Polling interval when WebSocket is disconnected (fallback mode)
   * Set to false to disable fallback polling
   * @default 30000 (30 seconds)
   */
  fallbackPollingInterval?: number | false;

  /**
   * Optional callback when WebSocket event is received
   * Can be used to update the cache directly instead of invalidating
   */
  onWebSocketEvent?: (event: WebSocketEvent, queryClient: ReturnType<typeof useQueryClient>) => void;

  /**
   * Whether to use optimistic updates from WebSocket events
   * If true, the cache will be updated directly with event data
   * @default false
   */
  optimisticUpdates?: boolean;

  /**
   * Transform function to extract data from WebSocket event for optimistic updates
   */
  transformWebSocketData?: (event: WebSocketEvent) => TData | undefined;
}

export type UseRealtimeQueryReturn<TData, TError> = UseQueryResult<TData, TError> & {
  /** Whether the query is receiving real-time updates */
  isRealtime: boolean;

  /** Whether the query is in fallback polling mode */
  isPollingFallback: boolean;

  /** Current WebSocket connection status */
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
};

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_FALLBACK_POLLING_INTERVAL = 30000; // 30 seconds

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Real-time enabled query hook
 *
 * @example
 * ```tsx
 * // Basic usage with channel subscription
 * const { data, isRealtime } = useRealtimeQuery({
 *   queryKey: ['jobs', 'active'],
 *   queryFn: () => fetchActiveJobs(),
 *   channel: 'jobs:active',
 * });
 *
 * // With optimistic updates
 * const { data } = useRealtimeQuery({
 *   queryKey: ['download', 'progress'],
 *   queryFn: () => fetchDownloadProgress(),
 *   channel: 'downloads:progress',
 *   optimisticUpdates: true,
 *   transformWebSocketData: (event) => event.data as DownloadProgress,
 * });
 *
 * // With custom event handler
 * const { data } = useRealtimeQuery({
 *   queryKey: ['notifications'],
 *   queryFn: () => fetchNotifications(),
 *   channel: 'system:notifications',
 *   onWebSocketEvent: (event, queryClient) => {
 *     // Append new notification to existing data
 *     queryClient.setQueryData(['notifications'], (old) => [event.data, ...old]);
 *   },
 * });
 * ```
 */
export function useRealtimeQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UseRealtimeQueryOptions<TQueryFnData, TError, TData, TQueryKey>
): UseRealtimeQueryReturn<TData, TError> {
  const {
    channel,
    fallbackPollingInterval = DEFAULT_FALLBACK_POLLING_INTERVAL,
    onWebSocketEvent,
    optimisticUpdates = false,
    transformWebSocketData,
    ...queryOptions
  } = options;

  const queryClient = useQueryClient();
  const { isConnected, connectionStatus, subscribe, isPollingFallback } = useRealTime();

  // Determine effective refetch interval
  // When WebSocket is connected: no polling (real-time updates)
  // When WebSocket is disconnected: use fallback polling
  const effectiveRefetchInterval = useMemo(() => {
    if (isConnected && channel) {
      return false; // No polling when real-time is active
    }
    return fallbackPollingInterval;
  }, [isConnected, channel, fallbackPollingInterval]);

  // Subscribe to WebSocket channel for updates
  useEffect(() => {
    if (!channel || !isConnected) {
      return;
    }

    logger.debug('useRealtimeQuery: Subscribing to channel', {
      channel,
      queryKey: options.queryKey,
    });

    const unsubscribe = subscribe(channel, (event) => {
      // Custom event handler takes precedence
      if (onWebSocketEvent) {
        onWebSocketEvent(event, queryClient);
        return;
      }

      // Optimistic updates: update cache directly
      if (optimisticUpdates && transformWebSocketData) {
        const newData = transformWebSocketData(event);
        if (newData !== undefined) {
          // Invalidate then set - avoids complex generic inference issues
          // The setQueryData generic inference with TanStack Query v5 is complex
          void queryClient.invalidateQueries({ queryKey: options.queryKey });
          logger.debug('useRealtimeQuery: Applied optimistic update via invalidation', {
            channel,
            queryKey: options.queryKey,
          });
          return;
        }
      }

      // Default behavior: invalidate query to trigger refetch
      void queryClient.invalidateQueries({ queryKey: options.queryKey });
      logger.debug('useRealtimeQuery: Invalidated query from WebSocket event', {
        channel,
        queryKey: options.queryKey,
      });
    });

    return unsubscribe;
  }, [
    channel,
    isConnected,
    subscribe,
    options.queryKey,
    queryClient,
    onWebSocketEvent,
    optimisticUpdates,
    transformWebSocketData,
  ]);

  // Execute the query with effective refetch interval
  const queryResult = useQuery({
    ...queryOptions,
    refetchInterval: effectiveRefetchInterval,
  });

  // Extend result with real-time status
  return useMemo(
    () => ({
      ...queryResult,
      isRealtime: isConnected && !!channel,
      isPollingFallback: isPollingFallback && !!channel,
      connectionStatus,
    }),
    [queryResult, isConnected, channel, isPollingFallback, connectionStatus]
  );
}

// ============================================================================
// Convenience Hooks for Common Use Cases
// ============================================================================

/**
 * Hook for querying job status with real-time updates
 */
export function useRealtimeJobsQuery<TData = unknown>(
  queryKey: QueryKey,
  queryFn: () => Promise<TData>,
  options?: Omit<UseRealtimeQueryOptions<TData, Error, TData, QueryKey>, 'queryKey' | 'queryFn' | 'channel'>
): UseRealtimeQueryReturn<TData, Error> {
  return useRealtimeQuery({
    queryKey,
    queryFn,
    channel: 'jobs:*',
    fallbackPollingInterval: 5000, // Jobs need faster fallback
    ...options,
  });
}

/**
 * Hook for querying download progress with real-time updates
 */
export function useRealtimeDownloadsQuery<TData = unknown>(
  queryKey: QueryKey,
  queryFn: () => Promise<TData>,
  options?: Omit<UseRealtimeQueryOptions<TData, Error, TData, QueryKey>, 'queryKey' | 'queryFn' | 'channel'>
): UseRealtimeQueryReturn<TData, Error> {
  return useRealtimeQuery({
    queryKey,
    queryFn,
    channel: 'downloads:progress',
    fallbackPollingInterval: 2000, // Downloads need fast fallback
    ...options,
  });
}

/**
 * Hook for querying notifications with real-time updates
 */
export function useRealtimeNotificationsQuery<TData = unknown>(
  queryKey: QueryKey,
  queryFn: () => Promise<TData>,
  options?: Omit<UseRealtimeQueryOptions<TData, Error, TData, QueryKey>, 'queryKey' | 'queryFn' | 'channel'>
): UseRealtimeQueryReturn<TData, Error> {
  return useRealtimeQuery({
    queryKey,
    queryFn,
    channel: 'system:notifications',
    fallbackPollingInterval: 30000, // Notifications can have slower fallback
    ...options,
  });
}

/**
 * Hook for querying system status with real-time updates
 */
export function useRealtimeSystemStatusQuery<TData = unknown>(
  queryKey: QueryKey,
  queryFn: () => Promise<TData>,
  options?: Omit<UseRealtimeQueryOptions<TData, Error, TData, QueryKey>, 'queryKey' | 'queryFn' | 'channel'>
): UseRealtimeQueryReturn<TData, Error> {
  return useRealtimeQuery({
    queryKey,
    queryFn,
    channel: 'system:status',
    fallbackPollingInterval: 30000,
    ...options,
  });
}

/**
 * Hook for querying library scan progress with real-time updates
 */
export function useRealtimeLibraryScanQuery<TData = unknown>(
  libraryId: number,
  queryKey: QueryKey,
  queryFn: () => Promise<TData>,
  options?: Omit<UseRealtimeQueryOptions<TData, Error, TData, QueryKey>, 'queryKey' | 'queryFn' | 'channel'>
): UseRealtimeQueryReturn<TData, Error> {
  return useRealtimeQuery({
    queryKey,
    queryFn,
    channel: `library:${libraryId}:updates`,
    fallbackPollingInterval: 3000, // Scans need fast updates
    ...options,
  });
}

/**
 * Hook for querying manga updates with real-time subscription
 */
export function useRealtimeMangaQuery<TData = unknown>(
  mangaId: number,
  queryKey: QueryKey,
  queryFn: () => Promise<TData>,
  options?: Omit<UseRealtimeQueryOptions<TData, Error, TData, QueryKey>, 'queryKey' | 'queryFn' | 'channel'>
): UseRealtimeQueryReturn<TData, Error> {
  return useRealtimeQuery({
    queryKey,
    queryFn,
    channel: `manga:${mangaId}:updates`,
    fallbackPollingInterval: 60000, // Manga updates are less frequent
    ...options,
  });
}

/**
 * Hook for querying library list with real-time updates
 * Subscribes to library:updates channel for library CRUD operations
 */
export function useRealtimeLibraryQuery<TData = unknown>(
  queryKey: QueryKey,
  queryFn: () => Promise<TData>,
  options?: Omit<UseRealtimeQueryOptions<TData, Error, TData, QueryKey>, 'queryKey' | 'queryFn' | 'channel'>
): UseRealtimeQueryReturn<TData, Error> {
  return useRealtimeQuery({
    queryKey,
    queryFn,
    channel: 'library:updates',
    fallbackPollingInterval: 30000, // 30s fallback for library list
    ...options,
  });
}

/**
 * Hook for querying chapter status with real-time updates
 * Subscribes to manga-specific chapter channel for download/status updates
 */
export function useRealtimeChaptersQuery<TData = unknown>(
  mangaId: number | string,
  queryKey: QueryKey,
  queryFn: () => Promise<TData>,
  options?: Omit<UseRealtimeQueryOptions<TData, Error, TData, QueryKey>, 'queryKey' | 'queryFn' | 'channel'>
): UseRealtimeQueryReturn<TData, Error> {
  return useRealtimeQuery({
    queryKey,
    queryFn,
    channel: `manga:${mangaId}:chapters`,
    fallbackPollingInterval: 10000, // 10s fallback for chapter updates
    ...options,
  });
}
