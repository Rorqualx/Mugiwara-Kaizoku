/**
 * Message parsing and channel routing for the unified WebSocket hook.
 *
 * @module hooks/unified-websocket/message-dispatch
 */
import type { WebSocketEvent, WebSocketMessage } from '@/types/api/v1/websocket';
import { logger } from '@/utils/logger';

/** Channel name (or `prefix:*` pattern) to the callbacks subscribed to it. */
export type SubscriptionMap = Map<string, Set<(event: WebSocketEvent) => void>>;

/** Calls every callback, isolating failures so one bad subscriber cannot starve the rest. */
function notify(
  callbacks: Set<(event: WebSocketEvent) => void>,
  event: WebSocketEvent,
  context: Record<string, unknown>,
): void {
  callbacks.forEach((callback) => {
    try {
      callback(event);
    } catch (error) {
      logger.error('WebSocket: Subscription callback error', { error, ...context });
    }
  });
}

/**
 * Parses one raw WebSocket frame and delivers it.
 *
 * `onMessage` receives every well-formed message; channel subscribers receive
 * messages for their channel, plus wildcard subscribers whose pattern
 * (e.g. `jobs:*`) matches it.
 */
export function dispatchWebSocketMessage(
  rawFrame: unknown,
  subscriptions: SubscriptionMap,
  onMessage: ((message: WebSocketMessage) => void) | undefined,
): void {
  try {
    const rawData: unknown = JSON.parse(rawFrame as string);

    if (!rawData || typeof rawData !== 'object') {
      logger.warn('WebSocket: Invalid message format', { data: rawData });
      return;
    }

    const message = rawData as WebSocketMessage;
    onMessage?.(message);

    if (!('channel' in message) || typeof (message as WebSocketEvent).channel !== 'string') {
      return;
    }
    const wsEvent = message as WebSocketEvent;
    const channel = wsEvent.channel ?? '';

    // Direct channel match
    const channelSubscribers = subscriptions.get(channel);
    if (channelSubscribers) {
      notify(channelSubscribers, wsEvent, { channel });
    }

    // Wildcard channel matches (e.g., "jobs:*" matches "jobs:123")
    subscriptions.forEach((callbacks, pattern) => {
      if (pattern.endsWith(':*') && channel.startsWith(pattern.slice(0, -1))) {
        notify(callbacks, wsEvent, { pattern });
      }
    });
  } catch (error) {
    logger.error('WebSocket: Failed to parse message', { error });
  }
}
