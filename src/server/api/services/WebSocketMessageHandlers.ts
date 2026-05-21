/**
 * WebSocket Message Handlers
 *
 * Handles 'publish' and 'presence' message types for WebSocket connections.
 * Extracted from WebSocketService for better code organization and maintainability.
 *
 * Dependencies are injected via constructor to maintain testability
 * and avoid circular dependencies.
 *
 * @module server/api/services/WebSocketMessageHandlers
 */

import { z } from 'zod';

import { presenceService, PresenceStatus } from '@/server/api/services/PresenceService';
import { rateLimitService } from '@/server/api/services/RateLimitService';
import { authorizationService } from '@/server/api/services/WebSocketAuthorizationService';
import type { DistributedMessageRouter } from '@/server/realtime/DistributedMessageRouter';
import type {
  WebSocketMessage,
  WebSocketEvent,
  WebSocketClient,
} from '@/types/api/v1/websocket';
import {
  WebSocketChannelAccessDeniedError,
  WebSocketRateLimitError,
  WebSocketNotSubscribedError,
  WebSocketAuthError,
} from '@/types/websocket-errors';
import { logger } from '@/utils/logger';

// ============================================================================
// Schemas
// ============================================================================

export const publishSchema = z.object({
  type: z.literal('publish'),
  channel: z.string(),
  data: z.unknown(),
});

export const presenceSchema = z.object({
  type: z.literal('presence'),
  action: z.enum(['join', 'leave', 'update']),
  channel: z.string(),
  data: z.object({
    status: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }).optional(),
});

// ============================================================================
// Dependencies Interface
// ============================================================================

export interface WebSocketMessageHandlerDependencies {
  // State accessors (read-only)
  getRouter: () => DistributedMessageRouter | null;

  // Callbacks to main service
  broadcastToChannel: (channel: string, event: WebSocketEvent) => Promise<void>;
  emitEvent: (event: string, data: unknown) => void;
  sendToClient: (client: WebSocketClient, message: WebSocketMessage | WebSocketEvent) => void;
  addToHistory: (channel: string, event: WebSocketEvent) => void;
  generateEventId: () => string;
}

// ============================================================================
// WebSocket Message Handlers
// ============================================================================

export class WebSocketMessageHandlers {
  constructor(
    private readonly deps: WebSocketMessageHandlerDependencies
  ) {}

  /**
   * Handle publish request
   */
  public async handlePublish(
    client: WebSocketClient,
    message: z.infer<typeof publishSchema>
  ): Promise<void> {
    const { channel, data } = message;

    // Check permissions
    if (!await authorizationService.canPublish(client, channel)) {
      const error = new WebSocketChannelAccessDeniedError(channel);
      this.deps.sendToClient(client, {
        id: `evt_${Date.now()}`,
        type: 'error',
        data: error.toJSON(),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Check rate limits
    if (client.userId) {
      const userChannelLimit = await rateLimitService.checkUserChannelMessages(client.userId, channel);
      if (!userChannelLimit.allowed) {
        const error = new WebSocketRateLimitError(
          userChannelLimit.limit,
          userChannelLimit.remaining,
          userChannelLimit.resetAt
        );

        this.deps.sendToClient(client, {
          id: `evt_${Date.now()}`,
          type: 'error',
          data: error.toJSON(),
          timestamp: new Date().toISOString(),
        });

        return;
      }
    }

    // Check global channel rate limit
    const channelLimit = await rateLimitService.checkChannelMessages(channel);
    if (!channelLimit.allowed) {
      const error = new WebSocketRateLimitError(
        channelLimit.limit,
        channelLimit.remaining,
        channelLimit.resetAt,
        'Channel rate limit exceeded'
      );

      this.deps.sendToClient(client, {
        id: `evt_${Date.now()}`,
        type: 'error',
        data: error.toJSON(),
        timestamp: new Date().toISOString(),
      });

      return;
    }

    // Validate data is an object
    const eventData: Record<string, unknown> =
      typeof data === 'object' && data !== null && !Array.isArray(data)
        ? { ...(data as Record<string, unknown>), userId: client.userId }
        : { value: data, userId: client.userId };

    // Create event
    const event: WebSocketEvent = {
      id: this.deps.generateEventId(),
      type: 'message',
      channel,
      data: eventData,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to local clients
    await this.deps.broadcastToChannel(channel, event);

    // Route to other servers via distributed router
    const router = this.deps.getRouter();
    if (router) {
      await router.routeMessage(channel, eventData);
    }

    // Add to history
    this.deps.addToHistory(channel, event);

    // Send confirmation
    this.deps.sendToClient(client, {
      id: `evt_${Date.now()}`,
      type: 'published',
      data: { eventId: event.id, channel },
      timestamp: new Date().toISOString(),
    });

    // Emit publish event
    this.deps.emitEvent('message:published', { connectionId: client.id, channel, event });
  }

  /**
   * Handle presence update
   */
  public async handlePresence(
    client: WebSocketClient,
    message: z.infer<typeof presenceSchema>
  ): Promise<void> {
    const { action, channel, data } = message;

    // Check if subscribed to channel
    if (!client.channels.has(channel)) {
      const error = new WebSocketNotSubscribedError(channel);
      this.deps.sendToClient(client, {
        id: `evt_${Date.now()}`,
        type: 'error',
        data: error.toJSON(),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Check if user is authenticated
    if (!client.userId) {
      const error = new WebSocketAuthError('Authentication required for presence tracking');
      this.deps.sendToClient(client, {
        id: `evt_${Date.now()}`,
        type: 'error',
        data: error.toJSON(),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    try {
      switch (action) {
        case 'join':
          await presenceService.setOnline(
            channel,
            client.userId,
            client.id,
            data?.metadata
          );
          break;

        case 'leave':
          await presenceService.setOffline(channel, client.userId, data?.metadata);
          break;

        case 'update': {
          const status = data?.status as PresenceStatus | undefined;
          if (status === 'online') {
            await presenceService.setOnline(channel, client.userId, client.id, data?.metadata);
          } else if (status === 'away') {
            await presenceService.setAway(channel, client.userId, client.id, data?.metadata);
          } else if (status === 'offline') {
            await presenceService.setOffline(channel, client.userId, data?.metadata);
          } else {
            // Default to updating with existing status
            await presenceService.updatePresence(
              channel,
              client.userId,
              PresenceStatus.ONLINE,
              client.id,
              data?.metadata
            );
          }
          break;
        }

        default:
          logger.warn('Unknown presence action', { action, channel, userId: client.userId });
          break;
      }

      // Get updated presence and broadcast to channel
      const channelPresence = await presenceService.getChannelPresence(channel);

      await this.deps.broadcastToChannel(channel, {
        id: this.deps.generateEventId(),
        type: 'presence',
        channel,
        data: {
          users: channelPresence.users,
          onlineCount: channelPresence.onlineCount,
          awayCount: channelPresence.awayCount,
        },
        timestamp: new Date().toISOString(),
      });

      logger.debug('Presence updated', {
        connectionId: client.id,
        userId: client.userId,
        channel,
        action,
      });
    } catch (error: unknown) {
      logger.error('Failed to handle presence update:', {
        error,
        connectionId: client.id,
        userId: client.userId,
        channel,
        action,
      });
    }
  }
}
