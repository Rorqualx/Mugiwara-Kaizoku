/**
 * Distributed Message Router - Main Orchestrator
 *
 * Routes WebSocket messages across multiple server instances using PostgreSQL
 * LISTEN/NOTIFY for real-time cross-server communication.
 *
 * Architecture:
 * - distributed-message-router/types.ts - Type definitions (4 exports)
 * - distributed-message-router/leader-election.ts - Leader election (3 functions)
 * - distributed-message-router/heartbeat-manager.ts - Heartbeat/cleanup (2 functions)
 * - Inline: Message routing, notification handling, server registry
 *
 * Features:
 * - Server-to-server message routing
 * - Leader election using PostgreSQL advisory locks
 * - Health monitoring of peer servers
 * - Message delivery tracking and retry
 * - Automatic failover on server failure
 *
 * Original file: 617 lines → Refactored: Orchestrator pattern
 *
 * @module server/realtime/DistributedMessageRouter
 */

import { EventEmitter } from 'events';

import { Client } from 'pg';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

// Import extracted modules
import {
  sendHeartbeat as sendHeartbeatUpdate,
  runCleanup as performCleanup,
} from './distributed-message-router/heartbeat-manager';
import {
  tryBecomeLeader as tryAcquireLeaderLock,
  tryMaintainLeaderLock,
  releaseLeaderLock as unlockLeaderLock,
} from './distributed-message-router/leader-election';
import { RoutedMessageNotificationSchema } from './distributed-message-router/types';

import type { ServerInfo, RouteTarget } from './distributed-message-router/types';

// ============================================================================
// Constants
// ============================================================================

const LEADER_LOCK_ID = 42069; // Arbitrary lock ID for leader election
const HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds
const CLEANUP_INTERVAL_MS = 60 * 1000; // 60 seconds

// ============================================================================
// Distributed Message Router Class
// ============================================================================

export class DistributedMessageRouter extends EventEmitter {
  private static instance: DistributedMessageRouter;
  private serverId: string;
  private hostname: string;
  private port: number;
  private notificationClient?: Client;
  private notificationHandler: ((msg: { channel: string; payload?: string }) => void) | null = null;
  private isRunning = false;
  private heartbeatInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private isLeader = false;

  private constructor(serverId: string, hostname: string, port: number) {
    super();
    this.serverId = serverId;
    this.hostname = hostname;
    this.port = port;
  }

  /**
   * Initialize singleton instance
   */
  public static initialize(serverId: string, hostname: string, port: number): DistributedMessageRouter {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Singleton pattern
    if (!DistributedMessageRouter.instance) {
      DistributedMessageRouter.instance = new DistributedMessageRouter(serverId, hostname, port);
    }
    return DistributedMessageRouter.instance;
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DistributedMessageRouter | null {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Singleton pattern requires checking undefined instance
    return DistributedMessageRouter.instance ?? null;
  }

  /**
   * Start the message router
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('DistributedMessageRouter already running');
      return;
    }

    try {
      // Register this server
      await this.registerServer();

      // Set up LISTEN/NOTIFY for cross-server messaging
      await this.setupNotifications();

      // Start heartbeat
      this.startHeartbeat();

      // Start cleanup process
      this.startCleanup();

      // Attempt leader election
      this.isLeader = await tryAcquireLeaderLock(LEADER_LOCK_ID, this.serverId);
      if (this.isLeader) {
        this.emit('leader:elected');
      }

      this.isRunning = true;
      logger.info('DistributedMessageRouter started', {
        serverId: this.serverId,
        hostname: this.hostname,
        port: this.port,
        isLeader: this.isLeader,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to start DistributedMessageRouter', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Stop the message router
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Stop heartbeat
      if (this.heartbeatInterval !== undefined) {
        clearInterval(this.heartbeatInterval);
        delete this.heartbeatInterval;
      }

      // Stop cleanup
      if (this.cleanupInterval !== undefined) {
        clearInterval(this.cleanupInterval);
        delete this.cleanupInterval;
      }

      // Release leader lock if held
      if (this.isLeader) {
        await unlockLeaderLock(LEADER_LOCK_ID, this.serverId);
        this.isLeader = false;
      }

      // Mark server as stopped
      await this.updateServerStatus('stopped');

      // Remove notification handler before closing client
      if (this.notificationClient !== undefined) {
        if (this.notificationHandler) {
          (this.notificationClient as unknown as EventEmitter).removeListener('notification', this.notificationHandler);
          this.notificationHandler = null;
        }
        await this.notificationClient.end();
        delete this.notificationClient;
      }

      this.isRunning = false;
      logger.info('DistributedMessageRouter stopped', { serverId: this.serverId });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error stopping DistributedMessageRouter', { error: errorMessage });
    }
  }

  /**
   * Route a message to the appropriate servers
   */
  public async routeMessage(channel: string, payload: Record<string, unknown>): Promise<void> {
    try {
      // Get target servers for this channel
      const targets = await this.getRouteTargets(channel);

      if (targets.length === 0) {
        logger.debug('No servers need to receive message', { channel });
        return;
      }

      // Insert routing entries for each target server (except self)
      const otherServers = targets.filter((t) => t.serverId !== this.serverId);

      if (otherServers.length === 0) {
        logger.debug('Message only for local server', { channel });
        return;
      }

      // Insert all routing entries in parallel (fixes no-await-in-loop)
      await Promise.all(
        otherServers.map(async (target) => {
          await prisma.$executeRaw`
            INSERT INTO message_routing (target_server, channel, payload, published_at)
            VALUES (
              ${target.serverId}::TEXT,
              ${channel}::TEXT,
              ${JSON.stringify(payload)}::JSONB,
              NOW()
            )
          `;
        })
      );

      logger.debug('Message routed to servers', {
        channel,
        targets: otherServers.map((t) => t.serverId),
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to route message', {
        error: errorMessage,
        channel,
      });
      throw error;
    }
  }

  /**
   * Get active servers
   */
  public async getActiveServers(): Promise<ServerInfo[]> {
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to get active servers', { error: errorMessage });
      return [];
    }
  }

  /**
   * Get server ID
   */
  public getServerId(): string {
    return this.serverId;
  }

  /**
   * Check if this server is the leader
   */
  public isClusterLeader(): boolean {
    return this.isLeader;
  }

  // ==========================================================================
  // Private Methods - Message Routing
  // ==========================================================================

  /**
   * Get route targets for a channel
   */
  private async getRouteTargets(channel: string): Promise<RouteTarget[]> {
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to get route targets', {
        error: errorMessage,
        channel,
      });
      return [];
    }
  }

  // ==========================================================================
  // Private Methods - Server Registry
  // ==========================================================================

  /**
   * Register this server in the database
   */
  private async registerServer(): Promise<void> {
    try {
      await prisma.$executeRaw`
        INSERT INTO websocket_servers (server_id, hostname, port, started_at, last_heartbeat, status)
        VALUES (
          ${this.serverId}::TEXT,
          ${this.hostname}::TEXT,
          ${this.port}::INTEGER,
          NOW(),
          NOW(),
          'active'::TEXT
        )
        ON CONFLICT (server_id) DO UPDATE SET
          hostname = ${this.hostname}::TEXT,
          port = ${this.port}::INTEGER,
          started_at = NOW(),
          last_heartbeat = NOW(),
          status = 'active'::TEXT
      `;

      logger.info('Server registered', { serverId: this.serverId });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to register server', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Update server status
   */
  private async updateServerStatus(status: 'active' | 'draining' | 'stopped'): Promise<void> {
    try {
      await prisma.$executeRaw`
        UPDATE websocket_servers
        SET status = ${status}::TEXT, last_heartbeat = NOW()
        WHERE server_id = ${this.serverId}
      `;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to update server status', {
        error: errorMessage,
        status,
      });
    }
  }

  // ==========================================================================
  // Private Methods - Notification Handling
  // ==========================================================================

  /**
   * Set up LISTEN/NOTIFY for cross-server messaging
   */
  private async setupNotifications(): Promise<void> {
    try {
      this.notificationClient = new Client({
        connectionString: process.env["DATABASE_URL"],
      });

      await this.notificationClient.connect();

      // Listen to this server's routing channel
      const channelName = `message_routing_${this.serverId}`;
      await this.notificationClient.query(`LISTEN "${channelName}"`);

      // Store named handler so it can be removed in stop()
      const handler = (msg: { channel: string; payload?: string }): void => {
        if (msg.channel === channelName) {
          void this.handleRoutedMessage(msg.payload ?? '{}');
        }
      };
      this.notificationHandler = handler;
      // pg Client extends EventEmitter but doesn't type 'notification' event — cast to access it
      (this.notificationClient as unknown as EventEmitter).on('notification', handler);

      logger.info('Notification listener set up', { channel: channelName });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to setup notifications', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Handle a routed message notification
   */
  private async handleRoutedMessage(payload: string): Promise<void> {
    try {
      const parsed: unknown = JSON.parse(payload);
      const result = RoutedMessageNotificationSchema.safeParse(parsed);

      if (!result.success) {
        logger.error('Invalid routed message notification format:', result.error);
        return;
      }

      const data = result.data;

      // Fetch the message from the routing table
      const messages = await prisma.$queryRaw<
        Array<{
          id: number;
          channel: string;
          payload: Record<string, unknown>;
          delivery_attempts: number;
        }>
      >`
        SELECT id, channel, payload, delivery_attempts
        FROM message_routing
        WHERE id = ${data.id}
          AND target_server = ${this.serverId}
          AND NOT delivered
      `;

      if (messages.length === 0) {
        return;
      }

      const message = messages[0];

      if (message === undefined) {
        return;
      }

      // Emit event for local delivery
      this.emit('message', {
        channel: message.channel,
        payload: message.payload,
      });

      // Mark as delivered
      await this.markMessageDelivered(message.id);

      logger.debug('Routed message delivered', {
        id: message.id,
        channel: message.channel,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to handle routed message', {
        error: errorMessage,
        payload: payload.substring(0, 100), // Truncate for logging
      });
    }
  }

  /**
   * Mark a message as delivered
   */
  private async markMessageDelivered(messageId: number): Promise<void> {
    try {
      await prisma.$executeRaw`
        UPDATE message_routing
        SET delivered = TRUE, last_attempt_at = NOW()
        WHERE id = ${messageId}
      `;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to mark message as delivered', {
        error: errorMessage,
        messageId,
      });
    }
  }

  // ==========================================================================
  // Private Methods - Heartbeat & Cleanup
  // ==========================================================================

  /**
   * Start heartbeat interval
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      void this.sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    logger.info('Heartbeat started (interval: 30s)');
  }

  /**
   * Send heartbeat
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      await sendHeartbeatUpdate(this.serverId);

      // Try to maintain leader status
      if (this.isLeader) {
        const stillLeader = await tryMaintainLeaderLock(LEADER_LOCK_ID);
        if (!stillLeader) {
          logger.warn('Lost leader status');
          this.isLeader = false;
        }
      } else {
        // Try to become leader if not already
        const becameLeader = await tryAcquireLeaderLock(LEADER_LOCK_ID, this.serverId);
        if (becameLeader) {
          this.isLeader = true;
          this.emit('leader:elected');
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to send heartbeat', { error: errorMessage });
    }
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      if (this.isLeader) {
        void performCleanup();
      }
    }, CLEANUP_INTERVAL_MS);

    logger.info('Cleanup interval started (interval: 60s)');
  }
}

// ============================================================================
// Export for external initialization
// ============================================================================

export function initializeRouter(serverId: string, hostname: string, port: number): DistributedMessageRouter {
  return DistributedMessageRouter.initialize(serverId, hostname, port);
}

export function getRouter(): DistributedMessageRouter | null {
  return DistributedMessageRouter.getInstance();
}

// Re-export types for convenience
export type { ServerInfo, RouteTarget, MessageRoute } from './distributed-message-router/types';
