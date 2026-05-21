/**
 * Rate Limiting Service
 *
 * PostgreSQL-backed rate limiting using sliding window algorithm.
 * No Redis required - uses UNLOGGED tables for performance.
 *
 * Features:
 * - Sliding window rate limiting
 * - Per-connection, per-user, and per-channel limits
 * - Atomic operations with PostgreSQL
 * - Automatic expiration cleanup
 *
 * @module server/api/services/RateLimitService
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number; // Seconds until rate limit resets
}

export enum RateLimitType {
  CONNECTION_MESSAGE = 'conn_msg',      // Messages per connection
  CONNECTION_SUBSCRIBE = 'conn_sub',    // Subscriptions per connection
  USER_CHANNEL = 'user_chan',           // Messages per user per channel
  CHANNEL_GLOBAL = 'chan_global',       // Total messages per channel
}

// ============================================================================
// Default Rate Limits
// ============================================================================

const DEFAULT_LIMITS: Record<RateLimitType, RateLimitConfig> = {
  [RateLimitType.CONNECTION_MESSAGE]: { limit: 100, windowSeconds: 60 },     // 100 msg/min per connection
  [RateLimitType.CONNECTION_SUBSCRIBE]: { limit: 10, windowSeconds: 60 },    // 10 sub/min per connection
  [RateLimitType.USER_CHANNEL]: { limit: 50, windowSeconds: 60 },           // 50 msg/min per user per channel
  [RateLimitType.CHANNEL_GLOBAL]: { limit: 1000, windowSeconds: 60 },       // 1000 msg/min per channel
};

// ============================================================================
// Rate Limit Service
// ============================================================================

export class RateLimitService {
  private static instance: RateLimitService;
  private cleanupInterval?: NodeJS.Timeout;

  // Circuit breaker state
  private consecutiveFailures = 0;
  private readonly maxFailures = 3;
  private circuitOpenUntil: Date | null = null;
  private readonly circuitResetMs = 30000; // 30 seconds

  // In-memory fallback for when circuit is open
  private inMemoryLimits = new Map<string, { count: number; resetAt: Date }>();

  // Result cache to avoid excessive DB queries for rapid message bursts
  // Key -> { result, cachedAt }
  private resultCache = new Map<string, { result: RateLimitResult; cachedAt: number }>();
  private readonly RESULT_CACHE_TTL_MS = 1000; // Cache results for 1 second

  // Request deduplication - pending requests for same key share one DB query
  private pendingRequests = new Map<string, Promise<RateLimitResult>>();

  private constructor() {
    // Start automatic cleanup of expired rate limits
    this.startCleanup();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): RateLimitService {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Singleton pattern
    if (!RateLimitService.instance) {
      RateLimitService.instance = new RateLimitService();
    }
    return RateLimitService.instance;
  }

  /**
   * Check if operation is within rate limit
   * Uses in-memory rate limiting for performance (no DB queries during normal operation)
   */
  public checkLimit(
    type: RateLimitType,
    identifier: string,
    customConfig?: Partial<RateLimitConfig>
  ): Promise<RateLimitResult> {
    const config = {
      ...DEFAULT_LIMITS[type],
      ...customConfig,
    };

    const key = this.buildKey(type, identifier);

    // Use in-memory rate limiting for all checks (fast, no DB queries)
    return Promise.resolve(this.checkInMemoryLimit(key, config));
  }

  /**
   * Execute the actual rate limit database query
   */
  private async executeRateLimitQuery(
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    try {
      // Use PostgreSQL function for atomic rate limit check
      const result = await prisma.$queryRaw<Array<{ allowed: boolean }>>`
        SELECT check_rate_limit(
          ${key}::TEXT,
          ${config.limit}::INTEGER,
          ${config.windowSeconds}::INTEGER
        ) as allowed
      `;

      const allowed = result[0]?.allowed ?? false;

      // Get current count from database
      const rateLimit = await prisma.$queryRaw<
        Array<{ count: number; window_start: Date; expiresAt: Date }>
      >`
        SELECT count, window_start, expires_at as "expiresAt"
        FROM rate_limits
        WHERE limit_key = ${key}
      `;

      const current = rateLimit[0];
      const count = current?.count ?? 0;
      const remaining = Math.max(0, config.limit - count);
      const resetAt = current?.expiresAt ?? new Date(Date.now() + config.windowSeconds * 1000);

      // Reset failure count on success
      this.consecutiveFailures = 0;

      const rateLimitResult: RateLimitResult = {
        allowed,
        limit: config.limit,
        remaining,
        resetAt,
        ...(allowed ? {} : { retryAfter: Math.ceil((resetAt.getTime() - Date.now()) / 1000) }),
      };

      // Cache the result to avoid excessive DB queries for rapid message bursts
      this.resultCache.set(key, { result: rateLimitResult, cachedAt: Date.now() });

      return rateLimitResult;
    } catch (error: unknown) {
      this.handleDbFailure(error, key, RateLimitType.CONNECTION_MESSAGE);

      // Fallback to in-memory rate limiting (more restrictive than fail-open)
      return this.checkInMemoryLimit(key, config);
    }
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitOpen(): boolean {
    if (!this.circuitOpenUntil) return false;
    if (this.circuitOpenUntil > new Date()) return true;

    // Circuit timeout expired - reset
    this.circuitOpenUntil = null;
    this.consecutiveFailures = 0;
    logger.info('Rate limit circuit breaker closed');
    return false;
  }

  /**
   * Handle database failure and update circuit breaker state
   */
  private handleDbFailure(error: unknown, key: string, type: RateLimitType): void {
    this.consecutiveFailures++;

    logger.error('Rate limit check failed:', {
      error,
      key,
      type,
      consecutiveFailures: this.consecutiveFailures,
    });

    if (this.consecutiveFailures >= this.maxFailures) {
      this.circuitOpenUntil = new Date(Date.now() + this.circuitResetMs);
      logger.error('Rate limit circuit breaker opened', {
        failures: this.consecutiveFailures,
        resetAt: this.circuitOpenUntil,
      });
    }
  }

  /**
   * In-memory rate limit check (fallback when DB unavailable)
   * More restrictive than fail-open to prevent DoS
   */
  private checkInMemoryLimit(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    let limit = this.inMemoryLimits.get(key);

    // Reset if expired or doesn't exist
    if (!limit || limit.resetAt.getTime() < now) {
      limit = { count: 0, resetAt: new Date(now + config.windowSeconds * 1000) };
      this.inMemoryLimits.set(key, limit);
    }

    limit.count++;
    const allowed = limit.count <= config.limit;

    return {
      allowed,
      limit: config.limit,
      remaining: Math.max(0, config.limit - limit.count),
      resetAt: limit.resetAt,
      ...(allowed ? {} : { retryAfter: Math.ceil((limit.resetAt.getTime() - now) / 1000) }),
    };
  }

  /**
   * Check connection message rate limit
   */
  public async checkConnectionMessages(connectionId: string): Promise<RateLimitResult> {
    return this.checkLimit(RateLimitType.CONNECTION_MESSAGE, connectionId);
  }

  /**
   * Check connection subscription rate limit
   */
  public async checkConnectionSubscriptions(connectionId: string): Promise<RateLimitResult> {
    return this.checkLimit(RateLimitType.CONNECTION_SUBSCRIBE, connectionId);
  }

  /**
   * Check user channel message rate limit
   */
  public async checkUserChannelMessages(
    userId: string,
    channel: string
  ): Promise<RateLimitResult> {
    return this.checkLimit(RateLimitType.USER_CHANNEL, `${userId}:${channel}`);
  }

  /**
   * Check global channel message rate limit
   */
  public async checkChannelMessages(channel: string): Promise<RateLimitResult> {
    return this.checkLimit(RateLimitType.CHANNEL_GLOBAL, channel);
  }

  /**
   * Check multiple rate limits at once
   * Returns false if ANY limit is exceeded
   */
  public async checkMultiple(
    checks: Array<{
      type: RateLimitType;
      identifier: string;
      config?: Partial<RateLimitConfig>;
    }>
  ): Promise<RateLimitResult> {
    const results = await Promise.all(
      checks.map((check) => this.checkLimit(check.type, check.identifier, check.config))
    );

    // Find the first failed check
    const failed = results.find((r) => !r.allowed);

    if (failed) {
      return failed;
    }

    // All checks passed - return the most restrictive limit
    const mostRestrictive = results.reduce((prev, curr) =>
      curr.remaining < prev.remaining ? curr : prev
    );

    return mostRestrictive;
  }

  /**
   * Reset rate limit for a specific key
   */
  public async resetLimit(type: RateLimitType, identifier: string): Promise<void> {
    const key = this.buildKey(type, identifier);

    try {
      await prisma.$executeRaw`
        DELETE FROM rate_limits
        WHERE limit_key = ${key}
      `;

      logger.debug('Rate limit reset', { key, type });
    } catch (error: unknown) {
      logger.error('Failed to reset rate limit:', {
        error,
        key,
        type,
      });
    }
  }

  /**
   * Get current usage for a rate limit
   */
  public async getUsage(
    type: RateLimitType,
    identifier: string
  ): Promise<{
    count: number;
    limit: number;
    remaining: number;
    resetAt: Date;
  } | null> {
    const key = this.buildKey(type, identifier);
    const config = DEFAULT_LIMITS[type];

    try {
      const result = await prisma.$queryRaw<
        Array<{ count: number; window_start: Date; expiresAt: Date }>
      >`
        SELECT count, window_start, expires_at as "expiresAt"
        FROM rate_limits
        WHERE limit_key = ${key}
      `;

      if (!result[0]) {
        return {
          count: 0,
          limit: config.limit,
          remaining: config.limit,
          resetAt: new Date(Date.now() + config.windowSeconds * 1000),
        };
      }

      const { count, expiresAt } = result[0];

      return {
        count,
        limit: config.limit,
        remaining: Math.max(0, config.limit - count),
        resetAt: expiresAt,
      };
    } catch (error: unknown) {
      logger.error('Failed to get rate limit usage:', {
        error,
        key,
        type,
      });
      return null;
    }
  }

  /**
   * Get statistics for all rate limits
   */
  public async getStats(): Promise<{
    total: number;
    active: number;
    expired: number;
  }> {
    try {
      const stats = await prisma.$queryRaw<
        Array<{ total: bigint; active: bigint; expired: bigint }>
      >`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE expires_at > NOW()) as active,
          COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired
        FROM rate_limits
      `;

      return {
        total: Number(stats[0]?.total ?? 0),
        active: Number(stats[0]?.active ?? 0),
        expired: Number(stats[0]?.expired ?? 0),
      };
    } catch (error: unknown) {
      logger.error('Failed to get rate limit stats:', error);
      return { total: 0, active: 0, expired: 0 };
    }
  }

  /**
   * Build rate limit key
   */
  private buildKey(type: RateLimitType, identifier: string): string {
    return `${type}:${identifier}`;
  }

  /**
   * Start automatic cleanup of expired rate limits
   */
  private startCleanup(): void {
    // Run cleanup every minute
    this.cleanupInterval = setInterval(() => {
      void this.cleanupExpired();
    }, 60 * 1000);

    logger.info('Rate limit cleanup started (interval: 60s)');
  }

  /**
   * Clean up expired rate limits
   */
  private async cleanupExpired(): Promise<void> {
    // Clean up expired result cache entries
    const now = Date.now();
    let cacheEntriesRemoved = 0;
    for (const [key, entry] of this.resultCache) {
      if (now - entry.cachedAt > this.RESULT_CACHE_TTL_MS * 10) {
        this.resultCache.delete(key);
        cacheEntriesRemoved++;
      }
    }

    try {
      const result = await prisma.$queryRaw<Array<{ cleanup_expired_rate_limits: number }>>`
        SELECT cleanup_expired_rate_limits() as cleanup_expired_rate_limits
      `;

      const deleted = result[0]?.cleanup_expired_rate_limits ?? 0;

      if (deleted > 0 || cacheEntriesRemoved > 0) {
        logger.debug(`Cleaned up ${deleted} expired rate limits, ${cacheEntriesRemoved} cache entries`);
      }
    } catch (error: unknown) {
      logger.error('Failed to cleanup expired rate limits:', error);
    }
  }

  /**
   * Stop cleanup interval
   */
  public stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      delete this.cleanupInterval;
      logger.info('Rate limit cleanup stopped');
    }
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const rateLimitService = RateLimitService.getInstance();
