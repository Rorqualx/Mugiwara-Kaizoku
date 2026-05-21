/**
 * WebSocket Cluster Manager
 *
 * Handles cluster operations, statistics, heartbeat, and graceful shutdown.
 *
 * Extracted from: websocketService.ts
 */

import { WebSocket } from 'ws';

import { presenceService } from '@/server/api/services/PresenceService';
import { prisma } from '@/server/db';
import type { DistributedMessageRouter } from '@/server/realtime/DistributedMessageRouter';
import type {
  WebSocketClient,
  WebSocketEvent,
  WebSocketMessage,
} from '@/types/api/v1/websocket';
import { logger } from '@/utils/logger';

import type { WebSocketServer } from 'ws';

/**
 * Dependencies required by ClusterManager
 */
export interface ClusterManagerDeps {
  serverId: string;
  clients: Map<string, WebSocketClient>;
  router: DistributedMessageRouter | null;
  wss: WebSocketServer | null;
  messageHistory: Map<string, WebSocketEvent[]>;
  sendToClient: (client: WebSocketClient, message: WebSocketMessage | WebSocketEvent) => void;
  cleanupDisconnectedClient: (client: WebSocketClient) => Promise<void>;
  handleDisconnect: (client: WebSocketClient) => void;
}

/**
 * Statistics returned by getStats
 */
export interface WebSocketStats {
  totalClients: number;
  totalChannels: number;
  totalServers: number;
  localClients: number;
  clientsByChannel: Record<string, number>;
  averageSubscriptionsPerClient: number;
  presenceStats: {
    totalOnlineUsers: number;
    totalAwayUsers: number;
  };
}

/**
 * Cluster server information
 */
export interface ClusterServerInfo {
  serverId: string;
  hostname: string;
  port: number;
  connectionCount: number;
  status: string;
}

/**
 * ClusterManager handles cluster operations, statistics, heartbeat, and graceful shutdown.
 */
export class ClusterManager {
  private serverId: string;
  private status: 'active' | 'draining' | 'stopped' = 'stopped';
  private shutdownGracePeriodMs = 30000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private deps: ClusterManagerDeps;

  constructor(deps: ClusterManagerDeps) {
    this.serverId = deps.serverId;
    this.deps = deps;
  }

  /**
   * Set server status to active
   */
  public setActive(): void {
    this.status = 'active';
  }

  /**
   * Start heartbeat interval
   */
  public startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 60000; // 60 seconds
      for (const [_clientId, client] of this.deps.clients) {
        // Check if client is alive
        if (now - client.lastActivity.getTime() > timeout) {
          // Terminate inactive connection
          (client.socket as WebSocket).terminate();
          this.deps.handleDisconnect(client);
        } else {
          // Send ping
          (client.socket as WebSocket).ping();
        }
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop heartbeat interval
   */
  public stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Get connection statistics (database-backed)
   */
  public async getStats(): Promise<WebSocketStats> {
    try {
      // Get connection stats
      const connectionStats = await prisma.$queryRaw<
        Array<{ total_connections: bigint; local_connections: bigint; total_servers: bigint }>
      >`
        SELECT
          COUNT(DISTINCT connection_id) as total_connections,
          COUNT(DISTINCT connection_id) FILTER (WHERE server_id = ${this.serverId}) as local_connections,
          COUNT(DISTINCT server_id) as total_servers
        FROM websocket_connections
        WHERE last_activity > NOW() - INTERVAL '2 minutes'
      `;

      // Get channel stats
      const channelStats = await prisma.$queryRaw<
        Array<{ channel: string; subscriber_count: bigint }>
      >`
        SELECT
          cs.channel,
          COUNT(DISTINCT cs.connection_id) as subscriber_count
        FROM channel_subscriptions cs
        INNER JOIN websocket_connections wc ON wc.connection_id = cs.connection_id
        WHERE wc.last_activity > NOW() - INTERVAL '2 minutes'
        GROUP BY cs.channel
      `;

      // Get subscription count
      const subscriptionCount = await prisma.$queryRaw<Array<{ total: bigint }>>`
        SELECT COUNT(*) as total
        FROM channel_subscriptions cs
        INNER JOIN websocket_connections wc ON wc.connection_id = cs.connection_id
        WHERE wc.last_activity > NOW() - INTERVAL '2 minutes'
      `;

      // Get presence stats
      const presenceStats = await presenceService.getStats();

      const totalClients = Number(connectionStats[0]?.total_connections ?? 0);
      const totalSubscriptions = Number(subscriptionCount[0]?.total ?? 0);

      const clientsByChannel: Record<string, number> = {};
      for (const stat of channelStats) {
        clientsByChannel[stat.channel] = Number(stat.subscriber_count);
      }

      return {
        totalClients,
        totalChannels: channelStats.length,
        totalServers: Number(connectionStats[0]?.total_servers ?? 1),
        localClients: Number(connectionStats[0]?.local_connections ?? 0),
        clientsByChannel,
        averageSubscriptionsPerClient: totalClients > 0 ? totalSubscriptions / totalClients : 0,
        presenceStats: {
          totalOnlineUsers: presenceStats.totalOnlineUsers,
          totalAwayUsers: presenceStats.totalAwayUsers,
        },
      };
    } catch (error: unknown) {
      logger.error('Failed to get WebSocket stats:', error);

      return {
        totalClients: this.deps.clients.size,
        totalChannels: 0,
        totalServers: 1,
        localClients: this.deps.clients.size,
        clientsByChannel: {},
        averageSubscriptionsPerClient: 0,
        presenceStats: {
          totalOnlineUsers: 0,
          totalAwayUsers: 0,
        },
      };
    }
  }

  /**
   * Initiate graceful shutdown
   *
   * Marks server as draining, notifies clients, waits for grace period,
   * then closes all connections
   */
  public async shutdown(): Promise<void> {
    logger.info('Initiating graceful WebSocket shutdown', {
      serverId: this.serverId,
      activeConnections: this.deps.clients.size,
      gracePeriodMs: this.shutdownGracePeriodMs,
    });

    // Mark server as draining
    this.status = 'draining';

    // Update server status in database
    if (this.deps.router) {
      try {
        await prisma.$executeRaw`
          UPDATE websocket_servers
          SET status = 'draining'
          WHERE server_id = ${this.serverId}
        `;
      } catch (error: unknown) {
        logger.error('Failed to update server status to draining:', error);
      }
    }

    // Notify all clients about impending shutdown
    const shutdownNotice: WebSocketEvent = {
      id: generateEventId(),
      type: 'server:draining',
      data: {
        serverId: this.serverId,
        gracePeriodMs: this.shutdownGracePeriodMs,
        message: 'Server is shutting down. Please reconnect shortly.',
      },
      timestamp: new Date().toISOString(),
    };

    for (const client of this.deps.clients.values()) {
      this.deps.sendToClient(client, shutdownNotice);
    }

    // Wait for grace period
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, this.shutdownGracePeriodMs);
    });

    // Clear heartbeat
    this.stopHeartbeat();

    // Close all connections and cleanup in parallel
    const clientArray = Array.from(this.deps.clients.values());

    // Close all sockets first (synchronous)
    for (const client of clientArray) {
      try {
        (client.socket as WebSocket).close(1001, 'Server going away');
      } catch (error: unknown) {
        logger.error('Error closing client socket during shutdown:', {
          error,
          connectionId: client.id,
        });
      }
    }

    // Then cleanup all clients in parallel
    const cleanupResults = await Promise.allSettled(
      clientArray.map(client => this.deps.cleanupDisconnectedClient(client))
    );

    // Log any cleanup failures
    cleanupResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error('Error cleaning up client during shutdown:', {
          error: result.reason as unknown,
          connectionId: clientArray[index]?.id,
        });
      }
    });

    // Close WebSocket server
    if (this.deps.wss) {
      this.deps.wss.close();
    }

    // Stop distributed message router
    if (this.deps.router) {
      await this.deps.router.stop();
    }

    // Clear local data
    this.deps.clients.clear();
    this.deps.messageHistory.clear();

    this.status = 'stopped';

    logger.info('WebSocket service shutdown complete', {
      serverId: this.serverId,
    });
  }

  /**
   * Get server ID
   */
  public getServerId(): string {
    return this.serverId;
  }

  /**
   * Get server status
   */
  public getStatus(): 'active' | 'draining' | 'stopped' {
    return this.status;
  }

  /**
   * Check if this server is the cluster leader
   */
  public isClusterLeader(): boolean {
    return this.deps.router?.isClusterLeader() ?? false;
  }

  /**
   * Get active servers in the cluster
   */
  public async getClusterServers(): Promise<ClusterServerInfo[]> {
    if (!this.deps.router) {
      return [];
    }

    return this.deps.router.getActiveServers();
  }
}

/**
 * Generate unique event ID
 */
export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate unique client ID
 */
export function generateClientId(): string {
  return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
