/**
 * Channel subscriptions for the unified WebSocket.
 *
 * Keeps the listeners per channel and tells the server about changes in
 * batches (see subscription-outbox): only the first listener on a channel
 * subscribes it on the server, only the last one leaving unsubscribes it, and
 * a burst of changes goes out as one subscribe and one unsubscribe message.
 *
 * The channel set lives in a ref only: publishing it as React state
 * re-rendered the provider (and, through its context value, every realtime
 * consumer) on each first-subscribe / last-unsubscribe, which turned any
 * effect that resubscribed per render into a render loop.
 *
 * @module hooks/unified-websocket/use-channel-subscriptions
 */

import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';

import type { WebSocketEvent } from '@/types/api/v1/websocket';
import { logger } from '@/utils/logger';

import { SubscriptionOutbox } from './subscription-outbox';

import type { SubscriptionMap } from './message-dispatch';

/**
 * Channel changes are sent this long after the first one in a burst, so a page
 * mounting a dozen subscribers sends one message.
 */
const SUBSCRIPTION_FLUSH_MS = 50;

export interface ChannelSubscriptionsOptions {
  /** Whether the socket is open right now. */
  isOpen: () => boolean;
  sendSubscribeMessage: (channels: string[]) => void;
  sendUnsubscribeMessage: (channels: string[]) => void;
}

export interface ChannelSubscriptions {
  /** Listeners per channel; also the set to resubscribe on (re)connect. */
  subscriptionsRef: MutableRefObject<SubscriptionMap>;
  subscribe: (channel: string, callback: (event: WebSocketEvent) => void) => () => void;
  unsubscribe: (channel: string) => void;
  /** Drops unsent changes; call when a fresh connection resubscribes everything. */
  clearOutbox: () => void;
}

export function useChannelSubscriptions({
  isOpen,
  sendSubscribeMessage,
  sendUnsubscribeMessage,
}: ChannelSubscriptionsOptions): ChannelSubscriptions {
  const subscriptionsRef = useRef<SubscriptionMap>(new Map());
  const outboxRef = useRef(new SubscriptionOutbox());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // While disconnected the outbox is dropped: the connection's open handler
  // subscribes the whole active set.
  const flushOutbox = useCallback((): void => {
    flushTimerRef.current = null;
    if (!isOpen()) {
      outboxRef.current.clear();
      return;
    }
    const { subscribe: joined, unsubscribe: left } = outboxRef.current.take();
    sendSubscribeMessage(joined);
    sendUnsubscribeMessage(left);
  }, [isOpen, sendSubscribeMessage, sendUnsubscribeMessage]);

  const scheduleFlush = useCallback((): void => {
    flushTimerRef.current ??= setTimeout(flushOutbox, SUBSCRIPTION_FLUSH_MS);
  }, [flushOutbox]);

  const leaveChannel = useCallback((channel: string): void => {
    subscriptionsRef.current.delete(channel);
    outboxRef.current.leave(channel);
    scheduleFlush();
  }, [scheduleFlush]);

  const subscribe = useCallback((channel: string, callback: (event: WebSocketEvent) => void): () => void => {
    let callbacks = subscriptionsRef.current.get(channel);
    if (!callbacks) {
      callbacks = new Set();
      subscriptionsRef.current.set(channel, callbacks);
      outboxRef.current.join(channel);
      scheduleFlush();
    }
    callbacks.add(callback);
    logger.debug('WebSocket: Subscribed to channel', { channel });

    return () => {
      const channelCallbacks = subscriptionsRef.current.get(channel);
      if (channelCallbacks?.delete(callback) && channelCallbacks.size === 0) {
        leaveChannel(channel);
      }
      logger.debug('WebSocket: Unsubscribed from channel', { channel });
    };
  }, [scheduleFlush, leaveChannel]);

  const unsubscribe = useCallback((channel: string): void => {
    if (subscriptionsRef.current.has(channel)) leaveChannel(channel);
    logger.debug('WebSocket: Unsubscribed from channel', { channel });
  }, [leaveChannel]);

  const clearOutbox = useCallback((): void => { outboxRef.current.clear(); }, []);

  // A pending flush must not outlive the hook.
  useEffect(() => () => {
    if (flushTimerRef.current !== null) clearTimeout(flushTimerRef.current);
  }, []);

  return { subscriptionsRef, subscribe, unsubscribe, clearOutbox };
}
