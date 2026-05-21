/**
 * Distributed Message Router - Server Registry Module
 *
 * Manages server registration, status updates, and active server queries.
 * Tracks server health via heartbeat timestamps and active connection counts.
 *
 * Extracted from: DistributedMessageRouter.ts (lines 259-305, 557-590)
 *
 * @module server/realtime/distributed-message-router/server-registry
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import type { ServerInfo } from './types';

// ============================================================================
// Server Registration
// ============================================================================

/**
 * Register this server in the database
 *
 * Inserts or updates server entry with current connection details.
 * Uses UPSERT to handle restarts gracefully.
 *
 * @param serverId - Unique server identifier
 * @param hostname - Server hostname
 * @param port - Server port
 * @throws Error if database operation fails
 */
export async function registerServer(
  serverId: string,
  hostname: string,
  port: number
): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO websocket_servers (server_id, hostname, port, started_at, last_heartbeat, status)
      VALUES (
        ${serverId}::TEXT,
        ${hostname}::TEXT,
        ${port}::INTEGER,
        NOW(),
        NOW(),
        'active'::TEXT
      )
      ON CONFLICT (server_id) DO UPDATE SET
        hostname = ${hostname}::TEXT,
        port = ${port}::INTEGER,
        started_at = NOW(),
        last_heartbeat = NOW(),
        status = 'active'::TEXT
    `;

    logger.info('Server registered', { serverId });
  } catch (error: unknown) {
    logger.error('Failed to register server:', error);
    throw error;
  }
}

/**
 * Update server status
 *
 * Updates server status and refreshes heartbeat timestamp.
 *
 * @param serverId - Server ID
 * @param status - New server status ('active' | 'draining' | 'stopped')
 */
export async function updateServerStatus(
  serverId: string,
  status: 'active' | 'draining' | 'stopped'
): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE websocket_servers
      SET status = ${status}::TEXT, last_heartbeat = NOW()
      WHERE server_id = ${serverId}
    `;
  } catch (error: unknown) {
    logger.error('Failed to update server status:', {
      error,
      status,
    });
  }
}

// ============================================================================
// Server Queries
// ============================================================================

/**
 * Get active servers
 *
 * Returns all servers that:
 * - Have status 'active'
 * - Have sent heartbeat in last minute
 *
 * Results ordered by connection_count ASC (for load balancing).
 *
 * @returns Array of active server information
 */
export async function getActiveServers(): Promise<ServerInfo[]> {
  try {
    const servers = await prisma.$queryRaw<
      Array<{
        server_id: string;
        hostname: string;
        port: number;
        connection_count: number;
        status: string;
        started_at: Date;
        last_heartbeat: Date;
      }>
    >`
      SELECT server_id, hostname, port, connection_count, status, started_at, last_heartbeat
      FROM websocket_servers
      WHERE status = 'active'
        AND last_heartbeat > NOW() - INTERVAL '1 minute'
      ORDER BY connection_count ASC
    `;

    return servers.map((s) => ({
      serverId: s.server_id,
      hostname: s.hostname,
      port: s.port,
      connectionCount: s.connection_count,
      status: s.status as 'active' | 'draining' | 'stopped',
      startedAt: s.started_at,
      lastHeartbeat: s.last_heartbeat,
    }));
  } catch (error: unknown) {
    logger.error('Failed to get active servers:', error);
    return [];
  }
}
