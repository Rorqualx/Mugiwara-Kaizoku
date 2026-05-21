/**
 * Presence Service
 *
 * PostgreSQL-backed distributed presence tracking for WebSocket connections.
 * Tracks user presence across multiple channels and server instances.
 *
 * Features:
 * - Real-time presence updates via LISTEN/NOTIFY
 * - Distributed across multiple servers
 * - Automatic cleanup of stale presence
 * - Channel-based presence tracking
 * - Custom presence metadata (status message, etc.)
 *
 * @module server/api/services/PresenceService
 */

import { EventEmitter } from 'events';

import { prisma } from '@/server/db';
import { getErrorMessage } from '@/utils/errors/helpers';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

export enum PresenceStatus {
  ONLINE = 'online',
  AWAY = 'away',
  OFFLINE = 'offline',
}

export interface PresenceData {
  channel: string;
  userId: string;
  connectionId?: string;
  status: PresenceStatus;
  metadata?: Record<string, unknown>;
  lastSeen: Date;
}

export interface PresenceUpdateEvent {
  channel: string;
  userId: string;
  status: PresenceStatus;
  metadata?: Record<string, unknown>;
}

export interface ChannelPresence {
  channel: string;
  users: Array<{
    userId: string;
    status: PresenceStatus;
    lastSeen: Date;
    metadata?: Record<string, unknown>;
  }>;
  onlineCount: number;
  awayCount: number;
}

// ============================================================================
// Presence Service
// ============================================================================

export class PresenceService extends EventEmitter {
  private static instance: PresenceService;
  private cleanupInterval?: NodeJS.Timeout;
  private staleThresholdMs = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    super();
    this.startCleanup();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): PresenceService {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Singleton pattern
    if (!PresenceService.instance) {
      PresenceService.instance = new PresenceService();
    }
    return PresenceService.instance;
  }

  /**
   * Update user presence in a channel
   */
  public async updatePresence(
    channel: string,
    userId: string,
    status: PresenceStatus,
    connectionId?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      // Use PostgreSQL function for atomic upsert
      await prisma.$executeRaw`
        SELECT update_presence(
          ${channel}::TEXT,
          ${userId}::TEXT,
          ${connectionId ?? null}::UUID,
          ${status}::TEXT,
          ${metadata ? JSON.stringify(metadata) : '{}'}::JSONB
        )
      `;

      logger.debug('Presence updated', {
        channel,
        userId,
        status,
        connectionId,
      });

      // Emit presence update event
      this.emit('presence:update', {
        channel,
        userId,
        status,
        metadata,
      } as PresenceUpdateEvent);
    } catch (error: unknown) {
      logger.error('Failed to update presence:', {
        error: getErrorMessage(error),
        channel,
        userId,
        status,
      });
      throw error;
    }
  }

  /**
   * Mark user as online in a channel
   */
  public async setOnline(
    channel: string,
    userId: string,
    connectionId?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    return this.updatePresence(channel, userId, PresenceStatus.ONLINE, connectionId, metadata);
  }

  /**
   * Mark user as away in a channel
   */
  public async setAway(
    channel: string,
    userId: string,
    connectionId?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    return this.updatePresence(channel, userId, PresenceStatus.AWAY, connectionId, metadata);
  }

  /**
   * Mark user as offline in a channel
   */
  public async setOffline(
    channel: string,
    userId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    return this.updatePresence(channel, userId, PresenceStatus.OFFLINE, undefined, metadata);
  }

  /**
   * Get presence for a specific channel
   */
  public async getChannelPresence(channel: string): Promise<ChannelPresence> {
    try {
      const presence = await prisma.$queryRaw<
        Array<{
          user_id: string;
          status: string;
          last_seen: Date;
          metadata: Record<string, unknown> | null;
        }>
      >`
        SELECT user_id, status, last_seen, metadata
        FROM presence_tracking
        WHERE channel = ${channel}
          AND status <> 'offline'
          AND last_seen > NOW() - INTERVAL '5 minutes'
        ORDER BY last_seen DESC
      `;

      const users = presence.map((p) => ({
        userId: p.user_id,
        status: p.status as PresenceStatus,
        lastSeen: p.last_seen,
        ...(p.metadata !== null ? { metadata: p.metadata } : {}),
      }));

      return {
        channel,
        users,
        onlineCount: users.filter((u) => u.status === PresenceStatus.ONLINE).length,
        awayCount: users.filter((u) => u.status === PresenceStatus.AWAY).length,
      };
    } catch (error: unknown) {
      logger.error('Failed to get channel presence:', {
        error: getErrorMessage(error),
        channel,
      });
      throw error;
    }
  }

  /**
   * Get all channels where a user is present
   */
  public async getUserChannels(userId: string): Promise<string[]> {
    try {
      const channels = await prisma.$queryRaw<Array<{ channel: string }>>`
        SELECT DISTINCT channel
        FROM presence_tracking
        WHERE user_id = ${userId}
          AND status <> 'offline'
          AND last_seen > NOW() - INTERVAL '5 minutes'
      `;

      return channels.map((c) => c.channel);
    } catch (error: unknown) {
      logger.error('Failed to get user channels:', {
        error: getErrorMessage(error),
        userId,
      });
      throw error;
    }
  }

  /**
   * Get presence for a specific user in a channel
   */
  public async getUserPresence(channel: string, userId: string): Promise<PresenceData | null> {
    try {
      const presence = await prisma.$queryRaw<
        Array<{
          connection_id: string | null;
          status: string;
          last_seen: Date;
          metadata: Record<string, unknown> | null;
        }>
      >`
        SELECT connection_id, status, last_seen, metadata
        FROM presence_tracking
        WHERE channel = ${channel}
          AND user_id = ${userId}
      `;

      if (presence.length === 0) {
        return null;
      }

      const p = presence[0];
      if (p === undefined) {
        return null;
      }

      return {
        channel,
        userId,
        ...(p.connection_id !== null ? { connectionId: p.connection_id } : {}),
        status: p.status as PresenceStatus,
        lastSeen: p.last_seen,
        ...(p.metadata !== null ? { metadata: p.metadata } : {}),
      };
    } catch (error: unknown) {
      logger.error('Failed to get user presence:', {
        error: getErrorMessage(error),
        channel,
        userId,
      });
      throw error;
    }
  }

  /**
   * Remove user from all channels
   */
  public async removeUserFromAllChannels(userId: string): Promise<void> {
    try {
      await prisma.$executeRaw`
        UPDATE presence_tracking
        SET status = 'offline', last_seen = NOW()
        WHERE user_id = ${userId}
      `;

      logger.debug('User removed from all channels', { userId });

      // Emit offline events for all channels
      const channels = await this.getUserChannels(userId);
      for (const channel of channels) {
        this.emit('presence:update', {
          channel,
          userId,
          status: PresenceStatus.OFFLINE,
        } as PresenceUpdateEvent);
      }
    } catch (error: unknown) {
      logger.error('Failed to remove user from channels:', {
        error: getErrorMessage(error),
        userId,
      });
      throw error;
    }
  }

  /**
   * Remove user from a specific channel
   */
  public async removeUserFromChannel(channel: string, userId: string): Promise<void> {
    try {
      await this.setOffline(channel, userId);

      logger.debug('User removed from channel', { channel, userId });
    } catch (error: unknown) {
      logger.error('Failed to remove user from channel:', {
        error: getErrorMessage(error),
        channel,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get presence statistics
   */
  public async getStats(): Promise<{
    totalChannels: number;
    totalOnlineUsers: number;
    totalAwayUsers: number;
    totalPresenceRecords: number;
  }> {
    try {
      const stats = await prisma.$queryRaw<
        Array<{
          total_channels: bigint;
          total_online: bigint;
          total_away: bigint;
          total_records: bigint;
        }>
      >`
        SELECT
          COUNT(DISTINCT channel) as total_channels,
          COUNT(*) FILTER (WHERE status = 'online' AND last_seen > NOW() - INTERVAL '5 minutes') as total_online,
          COUNT(*) FILTER (WHERE status = 'away' AND last_seen > NOW() - INTERVAL '5 minutes') as total_away,
          COUNT(*) as total_records
        FROM presence_tracking
      `;

      return {
        totalChannels: Number(stats[0]?.total_channels ?? 0),
        totalOnlineUsers: Number(stats[0]?.total_online ?? 0),
        totalAwayUsers: Number(stats[0]?.total_away ?? 0),
        totalPresenceRecords: Number(stats[0]?.total_records ?? 0),
      };
    } catch (error: unknown) {
      logger.error('Failed to get presence stats:', { error: getErrorMessage(error) });
      return {
        totalChannels: 0,
        totalOnlineUsers: 0,
        totalAwayUsers: 0,
        totalPresenceRecords: 0,
      };
    }
  }

  /**
   * Check if user is online in a channel
   */
  public async isUserOnline(channel: string, userId: string): Promise<boolean> {
    try {
      const presence = await this.getUserPresence(channel, userId);

      if (!presence) {
        return false;
      }

      // Check if presence is fresh (within stale threshold)
      const isFresh =
        Date.now() - presence.lastSeen.getTime() < this.staleThresholdMs;

      return presence.status === PresenceStatus.ONLINE && isFresh;
    } catch (error: unknown) {
      logger.error('Failed to check if user is online:', {
        error: getErrorMessage(error),
        channel,
        userId,
      });
      return false;
    }
  }

  /**
   * Start automatic cleanup of stale presence
   */
  private startCleanup(): void {
    // Run cleanup every 2 minutes
    this.cleanupInterval = setInterval(() => {
      void this.cleanupStalePresence();
    }, 2 * 60 * 1000);

    logger.info('Presence cleanup started (interval: 2min)');
  }

  /**
   * Clean up stale presence records
   */
  private async cleanupStalePresence(): Promise<void> {
    try {
      const result = await prisma.$executeRaw`
        UPDATE presence_tracking
        SET status = 'offline'
        WHERE status <> 'offline'
          AND last_seen < NOW() - INTERVAL '5 minutes'
      `;

      if (result > 0) {
        logger.debug(`Marked ${result} stale presence records as offline`);
      }
    } catch (error: unknown) {
      logger.error('Failed to cleanup stale presence:', { error: getErrorMessage(error) });
    }
  }

  /**
   * Stop cleanup interval
   */
  public stopCleanup(): void {
    if (this.cleanupInterval !== undefined) {
      clearInterval(this.cleanupInterval);
      delete this.cleanupInterval;
      logger.info('Presence cleanup stopped');
    }
  }

  /**
   * Set stale threshold (for testing)
   */
  public setStaleThreshold(ms: number): void {
    this.staleThresholdMs = ms;
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const presenceService = PresenceService.getInstance();
