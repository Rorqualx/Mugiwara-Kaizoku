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

import { dispatchWebSocketMessage } from './unified-websocket/message-dispatch';
import { useChannelSubscriptions } from './unified-websocket/use-channel-subscriptions';

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
}

// ============================================================================
// Constants
// ============================================================================

// Reconnection configuration. Backoff doubles from the initial delay up to the
// cap and then keeps retrying at the cap for as long as the hook is enabled:
// a server restart or a laptop sleep longer than the backoff ramp must not
// leave the tab on polling until a full reload.
const BACKOFF_RAMP_ATTEMPTS = 5; // After this many failures the status reads 'error'
const INITIAL_RECONNECT_DELAY = 2000; // Start with 2 seconds
const MAX_RECONNECT_DELAY = 30000; // Cap at 30 seconds

// Minimum time connection must be open before we consider it "stable"
// and reset the reconnect counter. This prevents rapid reconnect loops
// when connections open but immediately close.
const MIN_STABLE_CONNECTION_MS = 5000;

// ============================================================================
// Hook Implementation
// ============================================================================

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

  const isOpen = useCallback((): boolean => wsRef.current?.readyState === WebSocket.OPEN, []);
  const { subscriptionsRef, subscribe, unsubscribe, clearOutbox } = useChannelSubscriptions({
    isOpen,
    sendSubscribeMessage,
    sendUnsubscribeMessage,
  });

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

    reconnectAttemptsRef.current++;
    const attempt = reconnectAttemptsRef.current;
    // Past the ramp the delay stays at the cap; clamp the exponent so a tab
    // left open for days cannot overflow it.
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, Math.min(attempt - 1, BACKOFF_RAMP_ATTEMPTS)),
      MAX_RECONNECT_DELAY
    );

    if (attempt > BACKOFF_RAMP_ATTEMPTS) {
      // Still retrying, but report 'error' so screens use their polling
      // fallback in the meantime. Notify once, when the ramp is first exceeded.
      setConnectionStatus('error');
      if (attempt === BACKOFF_RAMP_ATTEMPTS + 1) {
        logger.warn(`WebSocket: still disconnected after ${BACKOFF_RAMP_ATTEMPTS} attempts, retrying every ${MAX_RECONNECT_DELAY}ms`);
        onErrorRef.current?.(new Error(`WebSocket connection failed after ${BACKOFF_RAMP_ATTEMPTS} attempts`));
      }
    } else {
      logger.info(`WebSocket: Reconnecting in ${delay}ms (attempt ${attempt})`);
      setConnectionStatus('connecting');
    }

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

    // A fresh connection has no subscriptions, so one frame for the whole
    // active set replaces whatever the outbox held.
    clearOutbox();
    const activeChannels = Array.from(subscriptionsRef.current.keys());
    if (activeChannels.length > 0) {
      sendSubscribeMessage(activeChannels);
    }

    onConnectRef.current?.();
  }, [sendSubscribeMessage, clearOutbox, subscriptionsRef]);

  const handleMessage = useCallback((event: MessageEvent): void => {
    dispatchWebSocketMessage(event.data, subscriptionsRef.current, onMessageRef.current);
  }, [subscriptionsRef]);

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

  // Reconnect at once when the network returns or the tab is shown again,
  // instead of waiting out the current backoff delay (browsers also throttle
  // timers in hidden tabs, so the scheduled retry can be far in the future).
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const reconnectNow = (): void => {
      if (document.visibilityState === 'hidden') return;
      const state = wsRef.current?.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;
      clearReconnectTimeout();
      reconnectAttemptsRef.current = 0;
      connectWebSocket();
    };

    window.addEventListener('online', reconnectNow);
    document.addEventListener('visibilitychange', reconnectNow);
    return () => {
      window.removeEventListener('online', reconnectNow);
      document.removeEventListener('visibilitychange', reconnectNow);
    };
  }, [enabled, connectWebSocket, clearReconnectTimeout]);

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
  }), [
    isConnected,
    connectionStatus,
    subscribe,
    unsubscribe,
    sendMessage,
    disconnectWebSocket,
    connectWebSocket,
  ]);
}
