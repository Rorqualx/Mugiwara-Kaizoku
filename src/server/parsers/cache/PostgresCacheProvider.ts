/**
 * PostgreSQL Cache Provider for Unified Metadata Parser
 *
 * MIGRATED: This file now uses the UnifiedCacheProvider
 * which provides Redis-like performance with UNLOGGED tables
 */

import { cacheProvider } from '@/server/cache/UnifiedCacheProvider';
import type { CacheOptions } from '@/server/cache/UnifiedCacheProvider';

// ============================================================================
// Type Definitions (kept for compatibility)
// ============================================================================

export interface CacheEntry {
  key: string;
  namespace: string;
  data: unknown;
  metadata?: Record<string, unknown>;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  hits: number;
  size: number;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  namespaces: Record<string, {
    entries: number;
    size: number;
    hits: number;
  }>;
}

// ============================================================================
// PostgreSQL Cache Provider - Now using UnifiedCacheProvider
// ============================================================================

export class PostgresCacheProvider {
  private defaultTTL: number;
  private defaultNamespace: string;

  constructor(
    _prisma?: unknown, // Ignored, using shared instance
    options: {
      defaultTTL?: number;
      defaultNamespace?: string;
      compressionThreshold?: number;
    } = {}
  ) {
    this.defaultTTL = options.defaultTTL ?? 86400; // 24 hours
    this.defaultNamespace = options.defaultNamespace ?? 'parser';
  }

  /**
   * Generate cache key from input parameters
   */
  generateKey(input: string | Record<string, unknown>): string {
    return cacheProvider.generateKey(input);
  }

  /**
   * Get cached data
   */
  get<T = unknown>(
    key: string,
    namespace?: string
  ): Promise<T | null> {
    return cacheProvider.get<T>(key, namespace ?? this.defaultNamespace);
  }

  /**
   * Set cached data
   */
  set<T = unknown>(
    key: string,
    data: T,
    options?: CacheOptions & { ttl?: number; namespace?: string }
  ): Promise<boolean> {
    const cacheOptions: CacheOptions = {
      ttl: options?.ttl ?? this.defaultTTL,
      namespace: options?.namespace ?? this.defaultNamespace,
      ...(options?.tags ? { tags: options.tags } : {}),
      ...(options?.compress !== undefined ? { compress: options.compress } : {})
    };

    return cacheProvider.set(key, data, cacheOptions);
  }

  /**
   * Delete cached data
   */
  delete(key: string, namespace?: string): Promise<boolean> {
    return cacheProvider.del(key, namespace ?? this.defaultNamespace).then(deleted => deleted > 0);
  }

  /**
   * Clear cache by namespace or pattern
   */
  clear(options?: { namespace?: string; pattern?: string }): Promise<number> {
    return cacheProvider.clear({
      ...(options?.namespace ? { namespace: options.namespace } : {})
    });
  }

  /**
   * Get cache statistics
   */
  getStats(): Promise<CacheStats> {
    return cacheProvider.getStats();
  }

  /**
   * Clean up expired entries
   */
  cleanup(): Promise<number> {
    return cacheProvider.clearExpired();
  }

  /**
   * Compress data (no longer needed, handled internally)
   */
  private compress(data: Buffer): Promise<Buffer> {
    // Compression is handled by PostgreSQL TOAST if needed
    return Promise.resolve(data) as Promise<Buffer>;
  }

  /**
   * Decompress data (no longer needed, handled internally)
   */
  private decompress(data: Buffer): Promise<Buffer> {
    // Decompression is handled by PostgreSQL TOAST if needed
    return Promise.resolve(data) as Promise<Buffer>;
  }
}

// ============================================================================
// Cacheable Interface
// ============================================================================

export interface Cacheable {
  getCacheKey(): string;
  getCacheTTL(): number;
  getCacheNamespace(): string;
}

// ============================================================================
// Export default instance
// ============================================================================

export default PostgresCacheProvider;