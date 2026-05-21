/**
 * Pattern Learning WebSocket Module
 *
 * Real-time communication for pattern learning functionality.
 *
 * Extracted from: usePatternLearning.ts (lines 401-500)
 */

import { useState, useEffect, useRef, useCallback } from 'react';

import { logger } from '@/utils/logger';

import { WebSocketMessage, processWebSocketMessage } from './utils';

// ============================================================================
// WebSocket Hook
// ============================================================================

interface UsePatternLearningWebSocketOptions {
  enabled?: boolean;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

/**
 * Hook for managing WebSocket connection for pattern learning
 */
export function usePatternLearningWebSocket({
  enabled = true,
  onMessage,
  onError,
  onConnect,
  onDisconnect
}: UsePatternLearningWebSocketOptions = {}): {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  sendMessage: (message: WebSocketMessage) => boolean;
  disconnect: () => void;
  reconnect: () => void;
} {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // PERFORMANCE FIX: Track reconnect attempts to prevent infinite reconnection loops
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 3;

  // WebSocket URL construction
  const getWebSocketUrl = useCallback((): string => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/api/pattern-recognition/ws`;
  }, []);

  // Handle incoming messages
  const handleMessage = useCallback((event: MessageEvent): void => {
    try {
      const eventData = event.data as string;
      const data: unknown = JSON.parse(eventData) as unknown;
      const message = processWebSocketMessage(data);
      
      if (message) {
        setLastMessage(message);
        onMessage?.(message);
      }
    } catch (error) {
      logger.error('Error processing WebSocket message:', String(error));
      // Type-safe error handling: ensure we always pass an Error instance
      const errorToPass = error instanceof Error ? error : new Error('Failed to process WebSocket message');
      onError?.(errorToPass);
    }
  }, [onMessage, onError]);

  // Handle connection errors
  const handleError = useCallback((error: Event): void => {
    const errorType = String(error.type);
    logger.error(`WebSocket error: ${errorType}`);
    setConnectionStatus('error');
    onError?.(new Error(`WebSocket connection error: ${errorType}`));
  }, [onError]);

  // Handle connection open
  const handleOpen = useCallback((): void => {
    logger.info('WebSocket connected');
    setIsConnected(true);
    setConnectionStatus('connected');
    reconnectAttemptsRef.current = 0; // Reset reconnect counter on successful connection
    onConnect?.();
  }, [onConnect]);

  // Handle connection close
  // PERFORMANCE FIX: Added max reconnect attempts to prevent infinite reconnection loops
  const handleClose = useCallback((event: CloseEvent): void => {
    logger.info(`WebSocket disconnected: ${event.code} ${event.reason}`);
    setIsConnected(false);
    setConnectionStatus('disconnected');
    onDisconnect?.();

    // Attempt reconnection for non-normal closures (with max attempts limit)
    if (event.code !== 1000 && enabled && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttemptsRef.current++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000); // Exponential backoff, max 10s
      logger.info(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);

      reconnectTimeoutRef.current = setTimeout(() => {
        // Use a fresh connection instead of the callback to avoid circular dependency
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          return;
        }

        try {
          setConnectionStatus('connecting');
          const url = getWebSocketUrl();
          const newWs = new WebSocket(url);

          newWs.onopen = () => {
            logger.info('WebSocket reconnected');
            setIsConnected(true);
            setConnectionStatus('connected');
            reconnectAttemptsRef.current = 0; // Reset on successful reconnect
            onConnect?.();
          };

          newWs.onmessage = handleMessage;
          newWs.onerror = handleError;
          newWs.onclose = handleClose;

          wsRef.current = newWs;
        } catch (error) {
          logger.error(`Failed to create WebSocket connection: ${String(error)}`);
          setConnectionStatus('error');
          onError?.(error instanceof Error ? error : new Error('Failed to create WebSocket connection'));
        }
      }, delay);
    } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      logger.warn(`WebSocket reconnection failed after ${MAX_RECONNECT_ATTEMPTS} attempts. Giving up.`);
      setConnectionStatus('error');
      onError?.(new Error(`WebSocket connection failed after ${MAX_RECONNECT_ATTEMPTS} reconnection attempts`));
    }
  }, [enabled, onDisconnect, getWebSocketUrl, handleMessage, handleError, onError, onConnect]);

  // Connect to WebSocket
  const connectWebSocket = useCallback((): void => {
    if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      setConnectionStatus('connecting');
      const url = getWebSocketUrl();
      const newWs = new WebSocket(url);
      
      newWs.onopen = handleOpen;
      newWs.onmessage = handleMessage;
      newWs.onerror = handleError;
      newWs.onclose = handleClose;
      
      wsRef.current = newWs;
    } catch (error) {
      logger.error(`Failed to create WebSocket connection: ${String(error)}`);
      setConnectionStatus('error');
      onError?.(error instanceof Error ? error : new Error('Failed to create WebSocket connection'));
    }
  }, [enabled, getWebSocketUrl, handleOpen, handleMessage, handleError, handleClose, onError]);

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback((): void => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setIsConnected(false);
    setConnectionStatus('disconnected');
    reconnectAttemptsRef.current = 0; // Reset reconnect counter on manual disconnect
  }, []);

  // Send message through WebSocket
  const sendMessage = useCallback((message: WebSocketMessage): boolean => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
        return true;
      } catch (error) {
        logger.error(`Failed to send WebSocket message: ${String(error)}`);
        onError?.(error instanceof Error ? error : new Error('Failed to send WebSocket message'));
        return false;
      }
    }
    return false;
  }, [onError]);

  // Effect to manage WebSocket connection
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

  return {
    isConnected,
    lastMessage,
    connectionStatus,
    sendMessage,
    disconnect: disconnectWebSocket,
    reconnect: connectWebSocket
  };
}

// ============================================================================
// Specialized WebSocket Hooks
// ============================================================================

/**
 * Hook for pattern training progress updates
 */
export function usePatternTrainingProgress(): {
  progress: number;
  currentPattern: string;
  status: 'idle' | 'training' | 'completed' | 'error';
  lastMessage: WebSocketMessage | null;
} {
  const [progress, setProgress] = useState<number>(0);
  const [currentPattern, setCurrentPattern] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'training' | 'completed' | 'error'>('idle');

  const { lastMessage } = usePatternLearningWebSocket({
    onMessage: (message) => {
      switch (message.type) {
        case 'training_started':
          setStatus('training');
          setProgress(0);
          break;
        
        case 'training_progress':
          if (message.progress !== undefined) {
            setProgress(message.progress);
          }
          if (message.pattern) {
            setCurrentPattern(message.pattern);
          }
          break;
        
        case 'training_completed':
          setStatus('completed');
          setProgress(100);
          break;
        
        case 'training_error':
          setStatus('error');
          break;
        
        default:
          break;
      }
    }
  });

  return {
    progress,
    currentPattern,
    status,
    lastMessage
  };
}

/**
 * Hook for pattern suggestion updates
 */
export function usePatternSuggestionUpdates(): {
  suggestions: WebSocketMessage[];
  lastMessage: WebSocketMessage | null;
  clearSuggestions: () => void;
} {
  const [suggestions, setSuggestions] = useState<WebSocketMessage[]>([]);

  const { lastMessage } = usePatternLearningWebSocket({
    onMessage: (message) => {
      if (message.type === 'pattern_suggestion') {
        setSuggestions(prev => [...prev, message]);
      }
    }
  });

  const clearSuggestions = useCallback((): void => {
    setSuggestions([]);
  }, []);

  return {
    suggestions,
    lastMessage,
    clearSuggestions
  };
}

/**
 * Hook for pattern confidence updates
 */
export function usePatternConfidenceUpdates(): {
  confidenceUpdates: Map<string, number>;
  getConfidence: (patternId: string) => number | undefined;
  clearConfidence: (patternId: string) => void;
  lastMessage: WebSocketMessage | null;
} {
  const [confidenceUpdates, setConfidenceUpdates] = useState<Map<string, number>>(new Map());

  const { lastMessage } = usePatternLearningWebSocket({
    onMessage: (message) => {
      if (message.type === 'confidence_update' && message.patternId && message.progress !== undefined) {
        setConfidenceUpdates(prev => new Map(prev).set(message.patternId as string, message.progress as number));
      }
    }
  });

  const getConfidence = useCallback((patternId: string): number | undefined => {
    return confidenceUpdates.get(patternId);
  }, [confidenceUpdates]);

  const clearConfidence = useCallback((patternId: string): void => {
    setConfidenceUpdates(prev => {
      const newMap = new Map(prev);
      newMap.delete(patternId);
      return newMap;
    });
  }, []);

  return {
    confidenceUpdates,
    getConfidence,
    clearConfidence,
    lastMessage
  };
}
