/**
 * Unified WebSocket Hook
 *
 * General-purpose WebSocket connection manager for real-time updates.
 *
 * IMPORTANT: This hook should only be used by RealTimeProvider to create
 * a single shared connection. Components should use `useRealTime()` from
 * the provider instead of calling this hook directly.
 *
 * Features:
 * - Single connection per client (via RealTimeProvider)
 * - Channel-based subscriptions
 * - Automatic reconnection with exponential backoff
 * - Stable connection detection (prevents reconnect loops)
 * - Connection state management
 * - Message type validation
 *
 * @module hooks/useUnifiedWebSocket
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import type {
  WebSocketMessage,
  WebSocketEvent,
} from '@/types/api/v1/websocket';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface WebSocketSubscription {
  channel: string;
  callback: (event: WebSocketEvent) => void;
}

export interface UseUnifiedWebSocketOptions {
  /** Enable/disable the WebSocket connection */
  enabled?: boolean;
  /** API key for authentication (required for server connection) */
  apiKey?: string | undefined;
  /** Called when connection is established */
  onConnect?: () => void;
  /** Called when connection is closed */
  onDisconnect?: (reason?: string) => void;
  /** Called on connection error */
  onError?: (error: Error) => void;
  /** Called when any message is received */
  onMessage?: (message: WebSocketMessage) => void;
}

export interface UseUnifiedWebSocketReturn {
  /** Whether the WebSocket is currently connected */
  isConnected: boolean;
  /** Current connection status */
  connectionStatus: ConnectionStatus;
  /** Subscribe to a channel, returns unsubscribe function */
  subscribe: (channel: string, callback: (event: WebSocketEvent) => void) => () => void;
  /** Unsubscribe from a channel */
  unsubscribe: (channel: string) => void;
  /** Send a message through the WebSocket */
  sendMessage: (message: Record<string, unknown>) => boolean;
  /** Manually disconnect */
  disconnect: () => void;
  /** Manually reconnect */
  reconnect: () => void;
  /** Get list of currently subscribed channels */
  subscribedChannels: string[];
}

// ============================================================================
// Constants
// ============================================================================

// Reconnection configuration
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 2000; // Start with 2 seconds
const MAX_RECONNECT_DELAY = 30000; // Cap at 30 seconds

// Minimum time connection must be open before we consider it "stable"
// and reset the reconnect counter. This prevents rapid reconnect loops
// when connections open but immediately close.
const MIN_STABLE_CONNECTION_MS = 5000;

// ============================================================================
// Hook Implementation
// ============================================================================

// eslint-disable-next-line max-lines-per-function -- WebSocket hook manages many connection states and event handlers
export function useUnifiedWebSocket({
  enabled = true,
  apiKey,
  onConnect,
  onDisconnect,
  onError,
  onMessage,
}: UseUnifiedWebSocketOptions = {}): UseUnifiedWebSocketReturn {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [subscribedChannels, setSubscribedChannels] = useState<string[]>([]);

  // Core refs - stable across renders
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const connectionOpenTimeRef = useRef<number | null>(null);
  const isManualDisconnectRef = useRef(false);
  const enabledRef = useRef(enabled);
  const apiKeyRef = useRef(apiKey);
  const isConnectedRef = useRef(isConnected); // Track isConnected in ref to avoid dependency loops

  // Keep enabled/apiKey/isConnected refs in sync
  enabledRef.current = enabled;
  apiKeyRef.current = apiKey;
  isConnectedRef.current = isConnected;

  // Store callbacks in refs to avoid triggering effect re-runs
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const onErrorRef = useRef(onError);
  const onMessageRef = useRef(onMessage);

  // Keep callback refs in sync
  onConnectRef.current = onConnect;
  onDisconnectRef.current = onDisconnect;
  onErrorRef.current = onError;
  onMessageRef.current = onMessage;

  // Subscription management
  const subscriptionsRef = useRef<Map<string, Set<(event: WebSocketEvent) => void>>>(new Map());
  const pendingSubscriptionsRef = useRef<Set<string>>(new Set());
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  // Track deferred timeout to cancel on unmount
  const deferredUpdateRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ============================================================================
  // WebSocket URL Construction
  // ============================================================================

  const getWebSocketUrl = useCallback((): string => {
    if (typeof window === 'undefined') {
      return '';
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const baseUrl = `${protocol}//${host}/api/v1/ws`;
    return apiKeyRef.current
      ? `${baseUrl}?apiKey=${encodeURIComponent(apiKeyRef.current)}`
      : baseUrl;
  }, []);

  // ============================================================================
  // Message Sending (defined early for use in handlers)
  // ============================================================================

  const sendSubscribeMessage = useCallback((channels: string[]): void => {
    if (wsRef.current?.readyState === WebSocket.OPEN && channels.length > 0) {
      const message = {
        type: 'subscribe',
        channels,
        timestamp: new Date().toISOString(),
      };
      try {
        wsRef.current.send(JSON.stringify(message));
        logger.debug('Sent subscribe message', { channels });
      } catch (error) {
        logger.error('Failed to send subscribe message', { error, channels });
      }
    }
  }, []);

  const sendUnsubscribeMessage = useCallback((channels: string[]): void => {
    if (wsRef.current?.readyState === WebSocket.OPEN && channels.length > 0) {
      const message = {
        type: 'unsubscribe',
        channels,
        timestamp: new Date().toISOString(),
      };
      try {
        wsRef.current.send(JSON.stringify(message));
        logger.debug('Sent unsubscribe message', { channels });
      } catch (error) {
        logger.error('Failed to send unsubscribe message', { error, channels });
      }
    }
  }, []);

  // ============================================================================
  // Connection Management (using refs to avoid dependencies)
  // ============================================================================

  // Forward declaration for reconnect logic
  const connectWebSocketRef = useRef<() => void>(() => {});

  const clearReconnectTimeout = useCallback((): void => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback((): void => {
    if (!enabledRef.current) return;
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      logger.warn(`WebSocket: Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`);
      setConnectionStatus('error');
      onErrorRef.current?.(new Error(`WebSocket connection failed after ${MAX_RECONNECT_ATTEMPTS} attempts`));
      return;
    }

    reconnectAttemptsRef.current++;
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current - 1),
      MAX_RECONNECT_DELAY
    );

    logger.info(`WebSocket: Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
    setConnectionStatus('connecting');

    clearReconnectTimeout();
    reconnectTimeoutRef.current = setTimeout(() => {
      connectWebSocketRef.current();
    }, delay);
  }, [clearReconnectTimeout]);

  const handleOpen = useCallback((): void => {
    connectionOpenTimeRef.current = Date.now();
    setIsConnected(true);
    setConnectionStatus('connected');
    logger.info('WebSocket: Connected');

    // Send pending subscriptions
    if (pendingSubscriptionsRef.current.size > 0) {
      const channels = Array.from(pendingSubscriptionsRef.current);
      sendSubscribeMessage(channels);
      pendingSubscriptionsRef.current.clear();
    }

    // Re-subscribe to active channels
    const activeChannels = Array.from(subscriptionsRef.current.keys());
    if (activeChannels.length > 0) {
      sendSubscribeMessage(activeChannels);
    }

    onConnectRef.current?.();
  }, [sendSubscribeMessage]);

  const handleMessage = useCallback((event: MessageEvent): void => {
    try {
      const rawData: unknown = JSON.parse(event.data as string);

      if (!rawData || typeof rawData !== 'object') {
        logger.warn('WebSocket: Invalid message format', { data: rawData });
        return;
      }

      const message = rawData as WebSocketMessage;
      onMessageRef.current?.(message);

      // Route to channel-specific subscribers
      if ('channel' in message && typeof (message as WebSocketEvent).channel === 'string') {
        const wsEvent = message as WebSocketEvent;
        const channel = wsEvent.channel ?? '';

        // Direct channel match
        const channelSubscribers = subscriptionsRef.current.get(channel);
        if (channelSubscribers) {
          channelSubscribers.forEach((callback) => {
            try {
              callback(wsEvent);
            } catch (error) {
              logger.error('WebSocket: Subscription callback error', { error, channel });
            }
          });
        }

        // Wildcard channel matches (e.g., "jobs:*" matches "jobs:123")
        subscriptionsRef.current.forEach((callbacks, pattern) => {
          if (pattern.endsWith(':*')) {
            const prefix = pattern.slice(0, -1);
            if (channel.startsWith(prefix)) {
              callbacks.forEach((callback) => {
                try {
                  callback(wsEvent);
                } catch (error) {
                  logger.error('WebSocket: Wildcard subscription callback error', { error, pattern });
                }
              });
            }
          }
        });
      }
    } catch (error) {
      logger.error('WebSocket: Failed to parse message', { error });
    }
  }, []);

  const handleError = useCallback((): void => {
    logger.warn('WebSocket: Connection error occurred');
    setConnectionStatus('error');
    onErrorRef.current?.(new Error('WebSocket connection error'));
  }, []);

  const handleClose = useCallback((event: CloseEvent): void => {
    // Use ref to avoid dependency on isConnected state (which would cause reconnection loops)
    const wasConnected = isConnectedRef.current;
    const connectionDuration = connectionOpenTimeRef.current
      ? Date.now() - connectionOpenTimeRef.current
      : 0;

    setIsConnected(false);
    wsRef.current = null;
    connectionOpenTimeRef.current = null;

    // Only reset reconnect attempts if connection was stable
    if (connectionDuration >= MIN_STABLE_CONNECTION_MS) {
      reconnectAttemptsRef.current = 0;
      logger.debug('WebSocket: Connection was stable, reset reconnect counter');
    }

    // Normal closure (code 1000) or manual disconnect - don't reconnect
    if (event.code === 1000 || isManualDisconnectRef.current) {
      logger.info(`WebSocket: Closed normally (code: ${event.code})`);
      setConnectionStatus('disconnected');
      isManualDisconnectRef.current = false;
      onDisconnectRef.current?.(event.reason);
      return;
    }

    // Abnormal closure - schedule reconnect
    logger.info(`WebSocket: Closed abnormally (code: ${event.code}, duration: ${connectionDuration}ms)`);

    if (wasConnected) {
      onDisconnectRef.current?.(event.reason);
    }

    scheduleReconnect();
  }, [scheduleReconnect]); // Removed isConnected - using ref instead

  const connectWebSocket = useCallback((): void => {
    // Don't connect if disabled or already connected/connecting
    if (!enabledRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

    const url = getWebSocketUrl();
    if (!url) return;

    try {
      // Clean up any existing connection
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }

      setConnectionStatus('connecting');
      logger.debug('WebSocket: Connecting...', { url: url.replace(/apiKey=[^&]+/, 'apiKey=***') });

      const ws = new WebSocket(url);

      ws.onopen = handleOpen;
      ws.onmessage = handleMessage;
      ws.onerror = handleError;
      ws.onclose = handleClose;

      wsRef.current = ws;
    } catch (error) {
      logger.error('WebSocket: Failed to create connection', { error });
      setConnectionStatus('error');
      onErrorRef.current?.(error instanceof Error ? error : new Error('Failed to create WebSocket'));
      scheduleReconnect();
    }
  }, [getWebSocketUrl, handleOpen, handleMessage, handleError, handleClose, scheduleReconnect]);

  // Update the ref so scheduleReconnect can call it
  connectWebSocketRef.current = connectWebSocket;

  const disconnectWebSocket = useCallback((): void => {
    isManualDisconnectRef.current = true;
    clearReconnectTimeout();
    reconnectAttemptsRef.current = 0;

    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;

      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, 'Manual disconnect');
      }
      wsRef.current = null;
    }

    setIsConnected(false);
    setConnectionStatus('disconnected');
    connectionOpenTimeRef.current = null;
  }, [clearReconnectTimeout]);

  // ============================================================================
  // Subscription Management
  // ============================================================================

  // Helper to safely update subscribed channels state with deferred execution
  // Uses setTimeout(0) to defer state update out of the cleanup phase, preventing infinite loops
  const updateSubscribedChannelsDeferred = useCallback((): void => {
    if (deferredUpdateRef.current !== null) {
      clearTimeout(deferredUpdateRef.current);
    }
    deferredUpdateRef.current = setTimeout(() => {
      deferredUpdateRef.current = null;
      if (isMountedRef.current) {
        setSubscribedChannels(Array.from(subscriptionsRef.current.keys()));
      }
    }, 0);
  }, []);

  const subscribe = useCallback((channel: string, callback: (event: WebSocketEvent) => void): () => void => {
    // Add to local subscriptions
    const isNewChannel = !subscriptionsRef.current.has(channel);
    if (isNewChannel) {
      subscriptionsRef.current.set(channel, new Set());
    }
    subscriptionsRef.current.get(channel)?.add(callback);

    // Only update state if we added a new channel (prevents re-render loops)
    // Use deferred update to avoid calling setState during render
    if (isNewChannel) {
      updateSubscribedChannelsDeferred();
    }

    // Send subscribe message if connected, otherwise queue
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      sendSubscribeMessage([channel]);
    } else {
      pendingSubscriptionsRef.current.add(channel);
    }

    logger.debug('WebSocket: Subscribed to channel', { channel });

    // Return unsubscribe function
    return () => {
      const channelCallbacks = subscriptionsRef.current.get(channel);
      if (channelCallbacks) {
        channelCallbacks.delete(callback);

        if (channelCallbacks.size === 0) {
          subscriptionsRef.current.delete(channel);
          sendUnsubscribeMessage([channel]);
          // Defer state update to avoid calling setState during cleanup
          updateSubscribedChannelsDeferred();
        }
      }
      logger.debug('WebSocket: Unsubscribed from channel', { channel });
    };
  }, [sendSubscribeMessage, sendUnsubscribeMessage, updateSubscribedChannelsDeferred]);

  const unsubscribe = useCallback((channel: string): void => {
    subscriptionsRef.current.delete(channel);
    pendingSubscriptionsRef.current.delete(channel);
    sendUnsubscribeMessage([channel]);
    updateSubscribedChannelsDeferred();
    logger.debug('WebSocket: Unsubscribed from channel', { channel });
  }, [sendUnsubscribeMessage, updateSubscribedChannelsDeferred]);

  // ============================================================================
  // Message Sending
  // ============================================================================

  const sendMessage = useCallback((message: Record<string, unknown>): boolean => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      wsRef.current.send(JSON.stringify({
        ...message,
        timestamp: new Date().toISOString(),
      }));
      return true;
    } catch (error) {
      logger.error('WebSocket: Failed to send message', { error });
      onErrorRef.current?.(error instanceof Error ? error : new Error('Failed to send message'));
      return false;
    }
  }, []);

  // ============================================================================
  // Mount/Unmount Tracking
  // ============================================================================

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (deferredUpdateRef.current !== null) {
        clearTimeout(deferredUpdateRef.current);
        deferredUpdateRef.current = null;
      }
    };
  }, []);

  // ============================================================================
  // Connection Lifecycle Effect
  // ============================================================================

  useEffect(() => {
    if (enabled) {
      connectWebSocket();
    } else {
      disconnectWebSocket();
    }

    return () => {
      disconnectWebSocket();
    };
  }, [enabled, connectWebSocket, disconnectWebSocket]);

  // ============================================================================
  // Return Value
  // ============================================================================

  return useMemo(() => ({
    isConnected,
    connectionStatus,
    subscribe,
    unsubscribe,
    sendMessage,
    disconnect: disconnectWebSocket,
    reconnect: connectWebSocket,
    subscribedChannels,
  }), [
    isConnected,
    connectionStatus,
    subscribe,
    unsubscribe,
    sendMessage,
    disconnectWebSocket,
    connectWebSocket,
    subscribedChannels,
  ]);
}

// ============================================================================
// DEPRECATED: Convenience Hooks
// ============================================================================
// These hooks are DEPRECATED and should not be used directly.
// Use `useRealTime()` from RealTimeProvider instead, which provides
// a single shared WebSocket connection for the entire application.
//
// Example migration:
//   BEFORE: const { isConnected } = useDownloadProgressSubscription(callback);
//   AFTER:  const { isConnected, subscribe } = useRealTime();
//           useEffect(() => subscribe('downloads:progress', callback), [subscribe, callback]);
// ============================================================================
