/**
 * WebSocket Subscription Manager
 *
 * Handles channel subscription lifecycle with parallel processing
 * for improved performance. All database operations and async checks
 * are performed in parallel using Promise.all to avoid ESLint
 * no-await-in-loop violations.
 *
 * Extracted from: websocketService.ts
 *
 * @module server/api/services/websocket-service/subscription-manager
 */

import { z } from 'zod';

import { presenceService } from '@/server/api/services/PresenceService';
import { rateLimitService } from '@/server/api/services/RateLimitService';
import { authorizationService } from '@/server/api/services/WebSocketAuthorizationService';
import { prisma } from '@/server/db';
import type { WebSocketClient, WebSocketEvent } from '@/types/api/v1/websocket';
import { WebSocketRateLimitError } from '@/types/websocket-errors';
import { logger } from '@/utils/logger';

// ============================================================================
// Schemas
// ============================================================================

export const subscribeSchema = z.object({
  type: z.literal('subscribe'),
  channels: z.array(z.string()),
  options: z
    .object({
      includeHistory: z.boolean().optional(),
      historyLimit: z.number().optional(),
    })
    .optional(),
});

export const unsubscribeSchema = z.object({
  type: z.literal('unsubscribe'),
  channels: z.array(z.string()),
});

// ============================================================================
// Types
// ============================================================================

export interface SubscriptionManagerDeps {
  serverId: string;
  sendToClient: (client: WebSocketClient, message: WebSocketEvent) => void;
  emit: (event: string, data: Record<string, unknown>) => void;
  getChannelHistory: (channel: string, limit?: number) => WebSocketEvent[];
}

// ============================================================================
// Subscription Manager Class
// ============================================================================

export class SubscriptionManager {
  private readonly serverId: string;
  private readonly sendToClient: (client: WebSocketClient, message: WebSocketEvent) => void;
  private readonly emit: (event: string, data: Record<string, unknown>) => void;
  private readonly getChannelHistory: (channel: string, limit?: number) => WebSocketEvent[];

  constructor(deps: SubscriptionManagerDeps) {
    this.serverId = deps.serverId;
    this.sendToClient = deps.sendToClient;
    this.emit = deps.emit;
    this.getChannelHistory = deps.getChannelHistory;
  }

  /**
   * Get local client IDs subscribed to a channel (from database)
   */
  public async getLocalSubscribers(channel: string): Promise<string[]> {
    try {
      const subscriptions = await prisma.$queryRaw<Array<{ connection_id: string }>>`
        SELECT cs.connection_id
        FROM channel_subscriptions cs
        INNER JOIN websocket_connections wc ON wc.connection_id = cs.connection_id
        WHERE cs.channel = ${channel}
          AND wc.server_id = ${this.serverId}
          AND wc.last_activity > NOW() - INTERVAL '2 minutes'
      `;

      return subscriptions.map((s) => s.connection_id);
    } catch (error: unknown) {
      logger.error('Failed to get local subscribers:', {
        error,
        channel,
      });
      return [];
    }
  }

  /**
   * Handle subscribe request with parallel processing
   *
   * Uses Promise.all for all async operations to avoid no-await-in-loop ESLint errors
   */
  public async handleSubscribe(
    client: WebSocketClient,
    message: z.infer<typeof subscribeSchema>
  ): Promise<void> {
    const { channels, options } = message;

    // Check subscription rate limit
    const rateLimitResult = await rateLimitService.checkConnectionSubscriptions(client.id);
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

    // Check permissions for all channels in a single batch query
    const permissionResults = await authorizationService.canSubscribeBatch(client, channels);

    // Separate allowed and denied channels
    const permittedChannels = channels.filter((ch) => permissionResults.get(ch) === true);
    const deniedChannels = channels.filter((ch) => permissionResults.get(ch) !== true);

    // Persist all subscriptions to database in parallel.
    // Broadcast delivery reads subscribers FROM the database (getLocalSubscribers),
    // so a channel whose persist failed must not be confirmed — the client would
    // believe it is subscribed but never receive a single event.
    const persistResults = await Promise.all(
      permittedChannels.map((channel) => this.persistSubscription(client.id, channel))
    );
    const allowedChannels = permittedChannels.filter((_, i) => persistResults[i]);
    const failedChannels = permittedChannels.filter((_, i) => !persistResults[i]);

    // Add to client subscriptions (local cache) - synchronous
    for (const channel of allowedChannels) {
      client.channels.add(channel);
    }

    // Handle history and presence in parallel
    await Promise.all(
      allowedChannels.map(async (channel) => {
        // Send history if requested (synchronous operation per channel)
        if (options?.includeHistory) {
          const history = this.getChannelHistory(channel, options.historyLimit);
          for (const event of history) {
            this.sendToClient(client, event);
          }
        }

        // Join presence if user is authenticated
        if (client.userId) {
          await presenceService.setOnline(channel, client.userId, client.id);
        }
      })
    );

    // Send subscription confirmation
    this.sendToClient(client, {
      id: `evt_${Date.now()}`,
      type: 'subscribed',
      data: {
        channels: allowedChannels,
        ...(deniedChannels.length > 0 && { denied: deniedChannels }),
        ...(failedChannels.length > 0 && { failed: failedChannels }),
      },
      timestamp: new Date().toISOString(),
    });

    // Emit subscription event
    this.emit('channel:subscribed', { connectionId: client.id, channels: allowedChannels });
  }

  /**
   * Persist subscription to database
   *
   * @returns false when the row could not be written — the caller must not
   * confirm the subscription, since broadcast delivery reads from this table.
   */
  public async persistSubscription(connectionId: string, channel: string): Promise<boolean> {
    try {
      await prisma.$executeRaw`
        INSERT INTO channel_subscriptions (connection_id, channel, subscribed_at)
        VALUES (${connectionId}::UUID, ${channel}::TEXT, NOW())
        ON CONFLICT (connection_id, channel) DO NOTHING
      `;

      logger.debug('Subscription persisted to database', {
        connectionId,
        channel,
      });
      return true;
    } catch (error: unknown) {
      logger.error('Failed to persist subscription:', {
        error,
        connectionId,
        channel,
      });
      return false;
    }
  }

  /**
   * Handle unsubscribe request with parallel processing
   *
   * Uses Promise.all for all async operations to avoid no-await-in-loop ESLint errors
   */
  public async handleUnsubscribe(
    client: WebSocketClient,
    message: z.infer<typeof unsubscribeSchema>
  ): Promise<void> {
    const { channels } = message;

    // Filter to only channels the client is actually subscribed to
    const requestedChannels = channels.filter((channel) => client.channels.has(channel));

    // Remove subscriptions from database. A channel whose DELETE failed stays
    // subscribed (DB row still drives broadcast delivery), so keep it in the
    // local cache and report it back instead of pretending it was removed.
    const removeResults = await Promise.all(
      requestedChannels.map((channel) => this.removeSubscription(client.id, channel))
    );
    const unsubscribedChannels = requestedChannels.filter((_, i) => removeResults[i]);
    const failedChannels = requestedChannels.filter((_, i) => !removeResults[i]);

    // Remove presence if user is authenticated
    const { userId } = client;
    if (userId) {
      await Promise.all(
        unsubscribedChannels.map((channel) => presenceService.setOffline(channel, userId))
      );
    }

    // Update local cache (synchronous)
    for (const channel of unsubscribedChannels) {
      client.channels.delete(channel);
    }

    // Send unsubscription confirmation
    this.sendToClient(client, {
      id: `evt_${Date.now()}`,
      type: 'unsubscribed',
      data: {
        channels: unsubscribedChannels,
        ...(failedChannels.length > 0 && { failed: failedChannels }),
      },
      timestamp: new Date().toISOString(),
    });

    // Emit unsubscription event
    this.emit('channel:unsubscribed', { connectionId: client.id, channels: unsubscribedChannels });
  }

  /**
   * Remove subscription from database
   *
   * @returns false when the row could not be deleted — the channel is still
   * live for broadcast delivery, so the caller must not confirm the unsubscribe.
   */
  public async removeSubscription(connectionId: string, channel: string): Promise<boolean> {
    try {
      await prisma.$executeRaw`
        DELETE FROM channel_subscriptions
        WHERE connection_id = ${connectionId}::UUID
          AND channel = ${channel}::TEXT
      `;

      logger.debug('Subscription removed from database', {
        connectionId,
        channel,
      });
      return true;
    } catch (error: unknown) {
      logger.error('Failed to remove subscription:', {
        error,
        connectionId,
        channel,
      });
      return false;
    }
  }
}
