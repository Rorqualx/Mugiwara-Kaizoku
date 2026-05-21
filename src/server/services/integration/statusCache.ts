/**
 * Integration Status Cache Service
 *
 * Provides in-memory caching for integration connection statuses to avoid
 * expensive external API calls on every page load.
 *
 * Features:
 * - In-memory cache with configurable TTL
 * - Automatic cache expiration
 * - Manual refresh capability
 * - Thread-safe singleton pattern
 */

import type { IntegrationType } from '@/types/integration';
import { logger } from '@/utils/logger';

/**
 * Cached status for an individual integration
 */
export interface CachedIntegrationStatus {
  enabled: boolean;
  configured: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'error' | 'not-configured' | 'unknown';
  connectionError?: string | null;
  lastChecked: Date | null;
  /** Extra data specific to each integration */
  extra?: Record<string, unknown>;
}

/**
 * Cache entry with timestamp
 */
interface CacheEntry {
  status: CachedIntegrationStatus;
  cachedAt: Date;
}

/**
 * Default cache TTL in milliseconds (5 minutes)
 */
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Reduced timeout for status checks (3 seconds instead of 10)
 */
export const STATUS_CHECK_TIMEOUT_MS = 3000;

/**
 * Integration Status Cache Service
 */
class IntegrationStatusCacheService {
  private cache: Map<IntegrationType, CacheEntry> = new Map();
  private cacheTTL: number;

  constructor(cacheTTLMs: number = DEFAULT_CACHE_TTL_MS) {
    this.cacheTTL = cacheTTLMs;
  }

  /**
   * Get cached status for an integration
   * Returns null if cache is expired or doesn't exist
   */
  get(type: IntegrationType): CachedIntegrationStatus | null {
    const entry = this.cache.get(type);

    if (!entry) {
      return null;
    }

    // Check if cache is expired
    const now = new Date();
    const age = now.getTime() - entry.cachedAt.getTime();

    if (age > this.cacheTTL) {
      logger.debug(`Cache expired for ${type} integration (age: ${age}ms)`);
      this.cache.delete(type);
      return null;
    }

    return entry.status;
  }

  /**
   * Get all cached statuses
   * Returns only non-expired entries
   */
  getAll(): Record<IntegrationType, CachedIntegrationStatus | null> {
    return {
      komga: this.get('komga'),
      kavita: this.get('kavita'),
      telegram: this.get('telegram'),
      apprise: this.get('apprise')
    };
  }

  /**
   * Set cached status for an integration
   */
  set(type: IntegrationType, status: CachedIntegrationStatus): void {
    this.cache.set(type, {
      status,
      cachedAt: new Date()
    });
    logger.debug(`Cached status for ${type} integration`, {
      connectionStatus: status.connectionStatus,
      enabled: status.enabled
    });
  }

  /**
   * Clear cache for a specific integration
   */
  clear(type: IntegrationType): void {
    this.cache.delete(type);
    logger.debug(`Cleared cache for ${type} integration`);
  }

  /**
   * Clear all cached statuses
   */
  clearAll(): void {
    this.cache.clear();
    logger.debug('Cleared all integration status cache');
  }

  /**
   * Check if cache exists and is valid for an integration
   */
  has(type: IntegrationType): boolean {
    return this.get(type) !== null;
  }

  /**
   * Get cache age in milliseconds (or null if not cached)
   */
  getAge(type: IntegrationType): number | null {
    const entry = this.cache.get(type);
    if (!entry) return null;

    return new Date().getTime() - entry.cachedAt.getTime();
  }

  /**
   * Update cache TTL
   */
  setTTL(ttlMs: number): void {
    this.cacheTTL = ttlMs;
  }
}

// Singleton instance
let instance: IntegrationStatusCacheService | null = null;

/**
 * Get the integration status cache service singleton
 */
export function getIntegrationStatusCache(): IntegrationStatusCacheService {
  instance ??= new IntegrationStatusCacheService();
  return instance;
}

/**
 * Create a default/unknown status for an integration
 */
export function createDefaultStatus(
  enabled: boolean,
  configured: boolean
): CachedIntegrationStatus {
  return {
    enabled,
    configured,
    connectionStatus: configured ? 'unknown' : 'not-configured',
    connectionError: null,
    lastChecked: null
  };
}

/**
 * Create a status from a successful connection test
 */
export function createConnectedStatus(
  enabled: boolean,
  extra?: Record<string, unknown>
): CachedIntegrationStatus {
  return {
    enabled,
    configured: true,
    connectionStatus: 'connected',
    connectionError: null,
    lastChecked: new Date(),
    ...(extra ? { extra } : {})
  };
}

/**
 * Create a status from a failed connection test
 */
export function createDisconnectedStatus(
  enabled: boolean,
  error?: string
): CachedIntegrationStatus {
  return {
    enabled,
    configured: true,
    connectionStatus: 'disconnected',
    connectionError: error ?? 'Unable to connect to server',
    lastChecked: new Date()
  };
}

/**
 * Create a status from an error during connection test
 */
export function createErrorStatus(
  enabled: boolean,
  error: string
): CachedIntegrationStatus {
  return {
    enabled,
    configured: true,
    connectionStatus: 'error',
    connectionError: error,
    lastChecked: new Date()
  };
}
