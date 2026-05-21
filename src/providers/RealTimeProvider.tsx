/**
 * Real-Time Provider
 *
 * Provides unified real-time communication context for the application.
 * Manages a single WebSocket connection and coordinates subscriptions.
 *
 * Features:
 * - Single WebSocket connection shared across all components
 * - Channel-based subscription management
 * - Automatic fallback to polling when disconnected
 * - Connection state available to all consumers
 *
 * Usage:
 * ```tsx
 * // In a component
 * const { isConnected, subscribe } = useRealTime();
 *
 * useEffect(() => {
 *   return subscribe('downloads:progress', (event) => {
 *     // Handle download progress event
 *     setProgress(event.data.progress);
 *   });
 * }, [subscribe]);
 * ```
 *
 * @module providers/RealTimeProvider
 */

'use client';

import React, { createContext, useContext, useCallback, useMemo, useEffect, useRef } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

import type { WebSocketEvent } from '@/types/api/v1/websocket';
import { logger } from '@/utils/logger';

import {
  useUnifiedWebSocket,
  type ConnectionStatus,
} from '../hooks/useUnifiedWebSocket';


// ============================================================================
// Types
// ============================================================================

export interface RealTimeContextValue {
  /** Whether the WebSocket is currently connected */
  isConnected: boolean;

  /** Current connection status */
  connectionStatus: ConnectionStatus;

  /** Whether fallback polling is active (WebSocket disconnected) */
  isPollingFallback: boolean;

  /**
   * Subscribe to a channel
   * @param channel - Channel name (e.g., 'downloads:progress', 'jobs:*')
   * @param callback - Function called when events are received
   * @returns Unsubscribe function
   */
  subscribe: (channel: string, callback: (event: WebSocketEvent) => void) => () => void;

  /**
   * Unsubscribe from a channel
   * @param channel - Channel name to unsubscribe from
   */
  unsubscribe: (channel: string) => void;

  /**
   * Manually reconnect the WebSocket
   */
  reconnect: () => void;

  /**
   * Get list of currently subscribed channels
   */
  subscribedChannels: string[];

  /**
   * Invalidate a React Query cache entry when WebSocket event received
   * Useful for triggering refetch when server pushes update notification
   */
  invalidateOnEvent: (channel: string, queryKey: unknown[]) => () => void;
}

// ============================================================================
// Context
// ============================================================================

const RealTimeContext = createContext<RealTimeContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

interface RealTimeProviderProps {
  children: React.ReactNode;
  /** API key for WebSocket authentication (optional, may use session) */
  apiKey?: string;
  /** Disable WebSocket connection (useful for testing) */
  disabled?: boolean;
}

export function RealTimeProvider({
  children,
  apiKey,
  disabled = false,
}: RealTimeProviderProps): React.ReactElement {
  const queryClient = useQueryClient();
  /** Safety cap to prevent unbounded growth of the invalidation map */
  const MAX_INVALIDATION_CHANNELS = 200;
  const queryInvalidationMapRef = useRef<Map<string, Set<unknown[]>>>(new Map());

  // Check session status - only connect WebSocket when authenticated
  const { status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === 'authenticated';

  // Initialize unified WebSocket connection
  // Only enable when authenticated to avoid connection errors before login
  const {
    isConnected,
    connectionStatus,
    subscribe: wsSubscribe,
    unsubscribe: wsUnsubscribe,
    reconnect,
    subscribedChannels,
  } = useUnifiedWebSocket({
    enabled: !disabled && isAuthenticated,
    apiKey,
    onConnect: () => {
      logger.info('RealTimeProvider: WebSocket connected');
    },
    onDisconnect: (reason) => {
      logger.debug('RealTimeProvider: WebSocket disconnected', { reason });
    },
    onError: (error) => {
      // Only log as debug when not authenticated (expected behavior)
      if (!isAuthenticated) {
        logger.debug('RealTimeProvider: WebSocket error (not authenticated)', { message: error.message });
      } else {
        logger.warn('RealTimeProvider: WebSocket error', { message: error.message });
      }
    },
    onMessage: (message) => {
      // Handle query invalidation for channels
      if ('channel' in message && typeof (message as WebSocketEvent).channel === 'string') {
        const channel = (message as WebSocketEvent).channel;
        const queryKeys = queryInvalidationMapRef.current.get(channel ?? '');

        if (queryKeys && channel) {
          queryKeys.forEach((queryKey) => {
            logger.debug('RealTimeProvider: Invalidating query from WebSocket event', {
              channel,
              queryKey,
            });
            void queryClient.invalidateQueries({ queryKey });
          });
        }
      }
    },
  });

  // Determine if we're in fallback polling mode
  const isPollingFallback = !isConnected && connectionStatus !== 'connecting';

  // Log fallback state changes (only when authenticated to avoid noise)
  useEffect(() => {
    if (!isAuthenticated) return;

    if (isPollingFallback) {
      logger.info('RealTimeProvider: Falling back to polling mode');
    } else if (isConnected) {
      logger.info('RealTimeProvider: Real-time mode active');
    }
  }, [isPollingFallback, isConnected, isAuthenticated]);

  // Enhanced subscribe that wraps the WebSocket subscribe
  const subscribe = useCallback(
    (channel: string, callback: (event: WebSocketEvent) => void): (() => void) => {
      return wsSubscribe(channel, callback);
    },
    [wsSubscribe]
  );

  // Unsubscribe wrapper
  const unsubscribe = useCallback(
    (channel: string): void => {
      wsUnsubscribe(channel);
    },
    [wsUnsubscribe]
  );

  // Register a query key to be invalidated when a channel receives an event
  const invalidateOnEvent = useCallback(
    (channel: string, queryKey: unknown[]): (() => void) => {
      // Safety cap: prevent unbounded map growth — evict stale channels first
      if (
        !queryInvalidationMapRef.current.has(channel) &&
        queryInvalidationMapRef.current.size >= MAX_INVALIDATION_CHANNELS
      ) {
        // Evict channels with empty query key sets before giving up
        for (const [key, value] of queryInvalidationMapRef.current) {
          if (value.size === 0) {
            queryInvalidationMapRef.current.delete(key);
          }
        }
        // If still at cap after eviction, reject
        if (queryInvalidationMapRef.current.size >= MAX_INVALIDATION_CHANNELS) {
          logger.warn('RealTimeProvider: Query invalidation map at capacity, rejecting new channel', { channel });
          return () => {};
        }
      }

      // Add to invalidation map
      if (!queryInvalidationMapRef.current.has(channel)) {
        queryInvalidationMapRef.current.set(channel, new Set());
      }
      queryInvalidationMapRef.current.get(channel)?.add(queryKey);

      // Ensure we're subscribed to the channel
      const unsubscribeWs = wsSubscribe(channel, () => {
        // The actual invalidation happens in onMessage above
      });

      // Return cleanup function
      return () => {
        const queryKeys = queryInvalidationMapRef.current.get(channel);
        if (queryKeys) {
          queryKeys.delete(queryKey);
          if (queryKeys.size === 0) {
            queryInvalidationMapRef.current.delete(channel);
            unsubscribeWs();
          }
        }
      };
    },
    [wsSubscribe]
  );

  // Memoize context value
  const contextValue = useMemo<RealTimeContextValue>(
    () => ({
      isConnected,
      connectionStatus,
      isPollingFallback,
      subscribe,
      unsubscribe,
      reconnect,
      subscribedChannels,
      invalidateOnEvent,
    }),
    [
      isConnected,
      connectionStatus,
      isPollingFallback,
      subscribe,
      unsubscribe,
      reconnect,
      subscribedChannels,
      invalidateOnEvent,
    ]
  );

  return (
    <RealTimeContext.Provider value={contextValue}>
      {children}
    </RealTimeContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access the real-time context
 *
 * @throws Error if used outside of RealTimeProvider
 * @returns RealTimeContextValue
 *
 * @example
 * ```tsx
 * const { isConnected, subscribe } = useRealTime();
 *
 * useEffect(() => {
 *   if (!isConnected) return;
 *
 *   return subscribe('jobs:active', (event) => {
 *     // Handle job update event
 *     setJobStatus(event.data.status);
 *   });
 * }, [isConnected, subscribe]);
 * ```
 */
export function useRealTime(): RealTimeContextValue {
  const context = useContext(RealTimeContext);

  if (!context) {
    throw new Error('useRealTime must be used within a RealTimeProvider');
  }

  return context;
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * Hook that returns whether real-time updates are available
 * Useful for showing connection status indicators
 */
export function useRealTimeStatus(): {
  isConnected: boolean;
  isPollingFallback: boolean;
  connectionStatus: ConnectionStatus;
} {
  const { isConnected, isPollingFallback, connectionStatus } = useRealTime();
  return { isConnected, isPollingFallback, connectionStatus };
}

/**
 * Hook to subscribe to a channel with automatic cleanup
 *
 * @param channel - Channel to subscribe to
 * @param callback - Callback for events
 * @param deps - Additional dependencies for callback
 *
 * @example
 * ```tsx
 * useRealTimeSubscription('downloads:progress', (event) => {
 *   setProgress(event.data.progress);
 * }, [setProgress]);
 * ```
 */
export function useRealTimeSubscription(
  channel: string,
  callback: (event: WebSocketEvent) => void,
  deps: React.DependencyList = []
): { isConnected: boolean } {
  const { isConnected, subscribe } = useRealTime();

  useEffect(() => {
    const unsubscribe = subscribe(channel, callback);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, subscribe, ...deps]);

  return { isConnected };
}

/**
 * Hook to invalidate a query when a WebSocket event is received
 *
 * @param channel - Channel to listen to
 * @param queryKey - React Query key to invalidate
 *
 * @example
 * ```tsx
 * // Invalidate the jobs query when job updates are received
 * useRealTimeInvalidation('jobs:active', ['jobs', 'active']);
 * ```
 */
export function useRealTimeInvalidation(
  channel: string,
  queryKey: unknown[]
): { isConnected: boolean } {
  const { isConnected, invalidateOnEvent } = useRealTime();

  useEffect(() => {
    return invalidateOnEvent(channel, queryKey);
  }, [channel, queryKey, invalidateOnEvent]);

  return { isConnected };
}
