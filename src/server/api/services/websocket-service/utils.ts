/**
 * WebSocket Service Utilities
 *
 * Shared schemas, types, and utilities for WebSocket service modules.
 *
 * Extracted from: websocketService.ts (lines 43-58)
 *
 * @module server/api/services/websocket-service/utils
 */

import { z } from 'zod';

// ============================================================================
// Type Re-exports
// ============================================================================

/**
 * Re-export core WebSocket types for convenience
 */
export type {
  WebSocketMessage,
  WebSocketEvent,
  WebSocketClient,
  WebSocketClientOptions,
  WebSocketEventHandler,
  WebSocketEventMap,
  SubscriptionOptions,
  PresenceData,
  AuthMessage,
  SubscribeMessage as SubscribeMessageType,
  EventMessage,
  DownloadProgressMessage,
  TaskUpdateMessage,
  ErrorMessage,
} from '@/types/api/v1/websocket';

export {
  WebSocketMessageType,
  WebSocketState,
  CHANNEL_PATTERNS,
  WS_EVENT_TYPES,
} from '@/types/api/v1/websocket';

/**
 * Re-export WebSocket error types and utilities
 */
export {
  WebSocketError,
  WebSocketAuthError,
  WebSocketInvalidApiKeyError,
  WebSocketMissingApiKeyError,
  WebSocketInvalidSessionError,
  WebSocketUnauthorizedError,
  WebSocketRateLimitError,
  WebSocketChannelError,
  WebSocketInvalidChannelError,
  WebSocketChannelNotFoundError,
  WebSocketChannelAccessDeniedError,
  WebSocketAlreadySubscribedError,
  WebSocketNotSubscribedError,
  WebSocketMessageError,
  WebSocketInvalidMessageError,
  WebSocketMessageTooLargeError,
  WebSocketInvalidPayloadError,
  WebSocketRoutingError,
  WebSocketNoActiveServersError,
  WebSocketMessageRoutingFailedError,
  WebSocketConnectionError,
  WebSocketConnectionLimitError,
  WebSocketServerDrainingError,
  WebSocketConnectionTimedOutError,
  WebSocketDatabaseError,
  WebSocketConnectionPersistenceError,
  WebSocketSubscriptionPersistenceError,
  WebSocketValidationError,
  WebSocketErrorFactory,
  isWebSocketError,
  isRateLimitError,
  isAuthError,
  isChannelError,
  isRetryable,
} from '@/types/websocket-errors';

// ============================================================================
// Message Schemas
// ============================================================================

/**
 * Schema for subscribe messages
 * Validates channel subscription requests with optional history retrieval
 */
export const subscribeSchema = z.object({
  type: z.literal('subscribe'),
  channels: z.array(z.string()),
  options: z.object({
    includeHistory: z.boolean().optional(),
    historyLimit: z.number().optional(),
  }).optional(),
});

/**
 * Schema for unsubscribe messages
 * Validates channel unsubscription requests
 */
export const unsubscribeSchema = z.object({
  type: z.literal('unsubscribe'),
  channels: z.array(z.string()),
});

/**
 * Generic WebSocket message schema for initial validation
 * Used for parsing unknown incoming messages before type-specific validation
 */
export const WebSocketMessageSchema = z.record(z.unknown());

// ============================================================================
// Schema Type Exports
// ============================================================================

/**
 * Inferred type for subscribe messages
 */
export type SubscribeMessage = z.infer<typeof subscribeSchema>;

/**
 * Inferred type for unsubscribe messages
 */
export type UnsubscribeMessage = z.infer<typeof unsubscribeSchema>;

/**
 * Inferred type for generic WebSocket messages
 */
export type ParsedWebSocketMessage = z.infer<typeof WebSocketMessageSchema>;
