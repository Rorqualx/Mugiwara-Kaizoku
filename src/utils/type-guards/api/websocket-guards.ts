/**
 * WebSocket Type Guards
 *
 * Type guards for WebSocket messages and events
 */

import { isString, isNumber, isBoolean, isObject } from '../index';

/**
 * Check if value is a valid WebSocket message
 */
export function isWebSocketMessage(value: unknown): value is {
  type: string;
  data?: unknown;
  timestamp?: string;
} {
  return (
    isObject(value) &&
    'type' in value &&
    isString(value['type']) &&
    // data is optional and can be any type - no validation needed
    (!('timestamp' in value) || isString(value['timestamp']))
  );
}

/**
 * Check if value is a valid WebSocket event
 */
export function isWebSocketEvent(value: unknown): value is {
  event: string;
  payload?: unknown;
  id?: string;
} {
  return (
    isObject(value) &&
    'event' in value &&
    isString(value['event']) &&
    // payload is optional and can be any type - no validation needed
    (!('id' in value) || isString(value['id']))
  );
}

/**
 * Check if value is a valid WebSocket subscription
 */
export function isWebSocketSubscription(value: unknown): value is {
  channel: string;
  action: 'subscribe' | 'unsubscribe';
  filters?: Record<string, unknown>;
} {
  return (
    isObject(value) &&
    'channel' in value &&
    isString(value['channel']) &&
    'action' in value &&
    isString(value['action']) &&
    ['subscribe', 'unsubscribe'].includes(value['action']) &&
    (!('filters' in value) || isObject(value['filters']))
  );
}

/**
 * Check if value is a valid WebSocket connection status
 */
export function isWebSocketConnectionStatus(value: unknown): value is {
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  reason?: string;
  timestamp: string;
} {
  return (
    isObject(value) &&
    'status' in value &&
    isString(value['status']) &&
    ['connected', 'disconnected', 'connecting', 'error'].includes(value['status']) &&
    (!('reason' in value) || isString(value['reason'])) &&
    'timestamp' in value &&
    isString(value['timestamp'])
  );
}

/**
 * Check if value is a valid WebSocket error
 */
export function isWebSocketError(value: unknown): value is {
  error: string;
  code?: number;
  fatal?: boolean;
} {
  return (
    isObject(value) &&
    'error' in value &&
    isString(value['error']) &&
    (!('code' in value) || isNumber(value['code'])) &&
    (!('fatal' in value) || isBoolean(value['fatal']))
  );
}