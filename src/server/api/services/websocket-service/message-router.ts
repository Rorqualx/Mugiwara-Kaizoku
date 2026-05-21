/**
 * WebSocket Message Router
 *
 * Handles message routing, broadcasting, and history management.
 *
 * Extracted from: websocketService.ts
 *
 * @module server/api/services/websocket-service/message-router
 */

import { WebSocket } from 'ws';
import { z } from 'zod';

import { rateLimitService } from '@/server/api/services/RateLimitService';
import {
  WebSocketMessageHandlers,
  publishSchema,
  presenceSchema,
} from '@/server/api/services/WebSocketMessageHandlers';
import type { DistributedMessageRouter } from '@/server/realtime/DistributedMessageRouter';
import type {
  WebSocketMessage,
  WebSocketEvent,
  WebSocketClient,
} from '@/types/api/v1/websocket';
import {
  WebSocketRateLimitError,
  WebSocketInvalidMessageError,
  isWebSocketError,
} from '@/types/websocket-errors';
import { getErrorMessage } from '@/utils/errors/helpers';
import { logger } from '@/utils/logger';

// ============================================================================
// Message Schemas
// ============================================================================

export const subscribeSchema = z.object({
  type: z.literal('subscribe'),
  channels: z.array(z.string()),
  options: z.object({
    includeHistory: z.boolean().optional(),
    historyLimit: z.number().optional(),
  }).optional(),
});

export const unsubscribeSchema = z.object({
  type: z.literal('unsubscribe'),
  channels: z.array(z.string()),
});

// ============================================================================
// Dependencies Interface
// ============================================================================

export interface MessageRouterDeps {
  clients: Map<string, WebSocketClient>;
  getLocalSubscribers: (channel: string) => Promise<string[]>;
  generateEventId: () => string;
  handleSubscribe: (client: WebSocketClient, message: z.infer<typeof subscribeSchema>) => Promise<void>;
  handleUnsubscribe: (client: WebSocketClient, message: z.infer<typeof unsubscribeSchema>) => Promise<void>;
  updateConnectionActivity: (connectionId: string) => Promise<void>;
  getRouter: () => DistributedMessageRouter | null;
  emit: (event: string, data: unknown) => void;
}

// ============================================================================
// Message Router Class
// ============================================================================

export class MessageRouter {
  private clients: Map<string, WebSocketClient>;
  private messageHistory: Map<string, WebSocketEvent[]> = new Map();
  private readonly maxHistoryPerChannel = 100;
  private readonly maxHistoryAgeMs = 60 * 60 * 1000; // 1 hour TTL for message history
  private readonly maxChannels = 500; // Hard cap to prevent unbounded growth
  private channelAccessOrder: string[] = []; // LRU tracking
  private cleanupTimer: NodeJS.Timeout | null = null;
  private readonly cleanupIntervalMs = 5 * 60 * 1000; // Clean up every 5 minutes
  private messageHandlers: WebSocketMessageHandlers;
  private deps: MessageRouterDeps;

  constructor(deps: MessageRouterDeps) {
    this.clients = deps.clients;
    this.deps = deps;

    // Initialize message handlers with dependency injection
    this.messageHandlers = new WebSocketMessageHandlers({
      getRouter: deps.getRouter,
      broadcastToChannel: this.broadcastToChannel.bind(this),
      emitEvent: deps.emit,
      sendToClient: this.sendToClient.bind(this),
      addToHistory: this.addToHistory.bind(this),
      generateEventId: deps.generateEventId,
    });

    // Start periodic cleanup of empty/stale channels
    this.startHistoryCleanup();
  }

  /**
   * Handle incoming WebSocket message
   */
  public async handleMessage(client: WebSocketClient, data: Record<string, unknown>): Promise<void> {
    try {
      // Data is already parsed JSON from ws.on('message') handler
      const message = data;

      // Update last activity
      // eslint-disable-next-line no-param-reassign -- Intentional state update
      client.lastActivity = new Date();
      await this.deps.updateConnectionActivity(client.id);

      // Check rate limit for connection messages
      const rateLimitResult = await rateLimitService.checkConnectionMessages(client.id);
      if (!rateLimitResult.allowed) {
        const error = new WebSocketRateLimitError(
          rateLimitResult.limit,
          rateLimitResult.remaining,
          rateLimitResult.resetAt
        );

        this.sendToClient(client, {
          id: `evt_${Date.now()}`,
          type: 'error',
          data: error.toJSON(),
          timestamp: new Date().toISOString(),
        });

        return;
      }

      // Type guard for message.type using bracket notation
      if (typeof message['type'] !== 'string') {
        throw new WebSocketInvalidMessageError('Message type must be a string');
      }

      switch (message['type']) {
        case 'subscribe':
          await this.deps.handleSubscribe(client, subscribeSchema.parse(message));
          break;
        case 'unsubscribe':
          await this.deps.handleUnsubscribe(client, unsubscribeSchema.parse(message));
          break;
        case 'publish':
          await this.messageHandlers.handlePublish(client, publishSchema.parse(message));
          break;
        case 'presence':
          await this.messageHandlers.handlePresence(client, presenceSchema.parse(message));
          break;
        case 'ping':
          this.sendToClient(client, {
            id: `evt_${Date.now()}`,
            type: 'pong',
            data: {},
            timestamp: new Date().toISOString()
          });
          break;
        default: {
          const invalidError = new WebSocketInvalidMessageError('Unknown message type');
          this.sendToClient(client, {
            id: `evt_${Date.now()}`,
            type: 'error',
            data: invalidError.toJSON(),
            timestamp: new Date().toISOString(),
          });
          break;
        }
      }
    } catch (error: unknown) {
      logger.error('Error handling WebSocket message:', {
        error: getErrorMessage(error),
        connectionId: client.id,
        userId: client.userId,
        messageType: data['type'],
      });

      const errorMessage = isWebSocketError(error)
        ? error.toJSON()
        : { error: { message: error instanceof Error ? error.message : 'Invalid message format' } };

      this.sendToClient(client, {
        id: `evt_${Date.now()}`,
        type: 'error',
        data: errorMessage,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Handle routed message from another server
   */
  public async handleRoutedMessage(channel: string, payload: Record<string, unknown>): Promise<void> {
    try {
      // Get local clients subscribed to this channel
      const subscribers = await this.deps.getLocalSubscribers(channel);

      if (subscribers.length === 0) {
        return;
      }

      // Create event
      const event: WebSocketEvent = {
        id: this.deps.generateEventId(),
        type: 'message',
        channel,
        data: payload,
        timestamp: new Date().toISOString(),
      };

      // Broadcast to local clients
      for (const subscriberId of subscribers) {
        const client = this.clients.get(subscriberId);
        if (client) {
          this.sendToClient(client, event);
        }
      }

      logger.debug('Routed message delivered to local clients', {
        channel,
        subscriberCount: subscribers.length,
      });
    } catch (error: unknown) {
      logger.error('Failed to handle routed message:', {
        error: getErrorMessage(error),
        channel,
      });
    }
  }

  /**
   * Broadcast message to all clients in a channel (local only)
   *
   * Note: Use handlePublish for cross-server broadcasting via router
   */
  public async broadcastToChannel(channel: string, event: WebSocketEvent): Promise<void> {
    try {
      // Get local subscribers from database
      const subscribers = await this.deps.getLocalSubscribers(channel);

      if (subscribers.length === 0) {
        return;
      }

      // Send to each local client
      for (const subscriberId of subscribers) {
        const client = this.clients.get(subscriberId);
        if (client) {
          this.sendToClient(client, event);
        }
      }

      logger.debug('Message broadcasted to local clients', {
        channel,
        subscriberCount: subscribers.length,
      });
    } catch (error: unknown) {
      logger.error('Failed to broadcast to channel:', {
        error: getErrorMessage(error),
        channel,
      });
    }
  }

  /**
   * Send message to specific client
   */
  public sendToClient(client: WebSocketClient, message: WebSocketMessage | WebSocketEvent): void {
    if ((client.socket as WebSocket).readyState === WebSocket.OPEN) {
      (client.socket as WebSocket).send(JSON.stringify(message));
    }
  }

  /**
   * Add event to channel history with TTL-based cleanup and LRU eviction
   */
  public addToHistory(channel: string, event: WebSocketEvent): void {
    let history = this.messageHistory.get(channel);
    if (!history) {
      // Evict LRU channel if at capacity
      if (this.messageHistory.size >= this.maxChannels) {
        this.evictLruChannel();
      }
      history = [];
      this.messageHistory.set(channel, history);
    }

    // Update LRU access order
    this.touchChannel(channel);

    history.push(event);

    // Trim by count
    if (history.length > this.maxHistoryPerChannel) {
      history.shift();
    }

    // Trim by age - remove messages older than TTL
    const cutoff = Date.now() - this.maxHistoryAgeMs;
    const firstValidIndex = history.findIndex(
      (e) => new Date(e.timestamp).getTime() > cutoff
    );
    if (firstValidIndex > 0) {
      history.splice(0, firstValidIndex);
    }
  }

  /**
   * Get channel history
   */
  public getChannelHistory(channel: string, limit?: number): WebSocketEvent[] {
    const history = this.messageHistory.get(channel) ?? [];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Clear all message history and stop cleanup timer (used during shutdown)
   */
  public clearHistory(): void {
    this.messageHistory.clear();
    this.channelAccessOrder = [];
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Track channel access for LRU eviction
   */
  private touchChannel(channel: string): void {
    const idx = this.channelAccessOrder.indexOf(channel);
    if (idx !== -1) {
      this.channelAccessOrder.splice(idx, 1);
    }
    this.channelAccessOrder.push(channel);
  }

  /**
   * Evict the least recently used channel
   */
  private evictLruChannel(): void {
    const lruChannel = this.channelAccessOrder.shift();
    if (lruChannel) {
      this.messageHistory.delete(lruChannel);
      logger.debug('Evicted LRU channel from message history', { channel: lruChannel });
    }
  }

  /**
   * Start periodic cleanup that removes empty and expired channels
   */
  private startHistoryCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const cutoff = Date.now() - this.maxHistoryAgeMs;
      const channelsToRemove: string[] = [];

      for (const [channel, history] of this.messageHistory) {
        // Remove expired entries
        const firstValidIndex = history.findIndex(
          (e) => new Date(e.timestamp).getTime() > cutoff
        );
        if (firstValidIndex > 0) {
          history.splice(0, firstValidIndex);
        }

        // Mark empty channels for removal
        if (history.length === 0) {
          channelsToRemove.push(channel);
        }
      }

      // Remove empty channels
      for (const channel of channelsToRemove) {
        this.messageHistory.delete(channel);
        const idx = this.channelAccessOrder.indexOf(channel);
        if (idx !== -1) {
          this.channelAccessOrder.splice(idx, 1);
        }
      }

      if (channelsToRemove.length > 0) {
        logger.debug('Cleaned up empty message history channels', {
          removed: channelsToRemove.length,
          remaining: this.messageHistory.size,
        });
      }
    }, this.cleanupIntervalMs);
  }
}
