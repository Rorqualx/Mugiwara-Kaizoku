/**
 * Distributed Message Router - Heartbeat & Cleanup Module
 *
 * Manages server heartbeats and cleanup operations.
 * Cleanup tasks are only performed by the cluster leader.
 *
 * Extracted from: DistributedMessageRouter.ts (lines 417-493)
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

// ============================================================================
// Heartbeat Management
// ============================================================================

/**
 * Send heartbeat to update server's last_heartbeat timestamp
 *
 * Updates the websocket_servers table to record that this server
 * is still active and responsive.
 *
 * @param serverId - Current server ID
 * @returns Promise that resolves when heartbeat is sent
 */
export async function sendHeartbeat(serverId: string): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE websocket_servers
      SET last_heartbeat = NOW()
      WHERE server_id = ${serverId}
    `;
  } catch (error: unknown) {
    logger.error('Failed to send heartbeat:', error);
  }
}

// ============================================================================
// Cleanup Operations (Leader Only)
// ============================================================================

/**
 * Run cleanup tasks (leader only)
 *
 * Performs two cleanup operations:
 * 1. Marks servers as 'stopped' if heartbeat is stale (> 2 minutes)
 * 2. Deletes expired/delivered messages from routing table
 *
 * This function should only be called by the cluster leader.
 *
 * @returns Promise that resolves when cleanup is complete
 */
export async function runCleanup(): Promise<void> {
  try {
    // Clean up stale servers
    await prisma.$executeRaw`
      UPDATE websocket_servers
      SET status = 'stopped'
      WHERE last_heartbeat < NOW() - INTERVAL '2 minutes'
        AND status <> 'stopped'
    `;

    // Clean up expired/delivered messages
    const result = await prisma.$queryRaw<Array<{ cleanup_expired_messages: number }>>`
      SELECT cleanup_expired_messages() as cleanup_expired_messages
    `;

    const cleaned = result[0]?.cleanup_expired_messages ?? 0;
    if (cleaned > 0) {
      logger.debug(`Cleaned up ${cleaned} expired messages`);
    }
  } catch (error: unknown) {
    logger.error('Failed to run cleanup:', error);
  }
}
