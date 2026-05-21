/**
 * Distributed Message Router - Message Routing Module
 *
 * Handles routing messages to appropriate servers based on channel subscriptions.
 * Uses PostgreSQL for tracking routing entries and delivery status.
 *
 * CRITICAL FIX: Replaced sequential await-in-loop with Promise.all for parallel execution.
 *
 * Extracted from: DistributedMessageRouter.ts (lines 183-257)
 *
 * @module server/realtime/distributed-message-router/message-router
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import type { RouteTarget } from './types';

// ============================================================================
// Message Routing
// ============================================================================

/**
 * Route a message to the appropriate servers
 *
 * @param serverId - Current server ID (to exclude from routing)
 * @param channel - Message channel
 * @param payload - Message payload
 */
export async function routeMessage(
  serverId: string,
  channel: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    // Get target servers for this channel
    const targets = await getRouteTargets(channel);

    if (targets.length === 0) {
      logger.debug('No servers need to receive message', { channel });
      return;
    }

    // Insert routing entries for each target server (except self)
    const otherServers = targets.filter((t) => t.serverId !== serverId);

    if (otherServers.length === 0) {
      logger.debug('Message only for local server', { channel });
      return;
    }

    // FIX: Use Promise.all to execute inserts in parallel (not sequential loop)
    await Promise.all(
      otherServers.map((target) =>
        prisma.$executeRaw`
          INSERT INTO message_routing (target_server, channel, payload, published_at)
          VALUES (
            ${target.serverId}::TEXT,
            ${channel}::TEXT,
            ${JSON.stringify(payload)}::JSONB,
            NOW()
          )
        `
      )
    );

    logger.debug('Message routed to servers', {
      channel,
      targets: otherServers.map((t) => t.serverId),
    });
  } catch (error: unknown) {
    logger.error('Failed to route message:', {
      error,
      channel,
    });
    throw error;
  }
}

/**
 * Get route targets for a channel
 *
 * @param channel - Channel name
 * @returns Array of servers with active connections to the channel
 */
export async function getRouteTargets(channel: string): Promise<RouteTarget[]> {
  try {
    const targets = await prisma.$queryRaw<
      Array<{ server_id: string; connection_count: bigint }>
    >`
      SELECT
        wc.server_id,
        COUNT(*) as connection_count
      FROM websocket_connections wc
      INNER JOIN channel_subscriptions cs ON cs.connection_id = wc.connection_id
      WHERE cs.channel = ${channel}
        AND wc.last_activity > NOW() - INTERVAL '5 minutes'
      GROUP BY wc.server_id
    `;

    return targets.map((t) => ({
      serverId: t.server_id,
      connectionCount: Number(t.connection_count),
    }));
  } catch (error: unknown) {
    logger.error('Failed to get route targets:', {
      error,
      channel,
    });
    return [];
  }
}
