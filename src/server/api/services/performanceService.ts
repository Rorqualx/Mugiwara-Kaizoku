/**
 * Performance Optimization Service
 * 
 * Provides caching, optimization, and performance monitoring
 */

import { createHash } from 'crypto';
import { EventEmitter } from 'events';

import { prisma } from '@/server/db';
import type {
  AsyncResult} from '@/utils/async-result';
import {
  createSuccessResult,
  createErrorResult,
  isError
} from '@/utils/async-result';
import { logger } from '@/utils/logger';

interface CacheEntry<T> {
  data: T;
  expires: number;
  hits: number;
  size: number;
  tags: string[];
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  itemCount: number;
}

interface PerformanceMetrics {
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  cacheHitRate: number;
}

export class PerformanceService extends EventEmitter {
  // Multi-layer cache
  private memoryCache: Map<string, CacheEntry<unknown>> = new Map();
  private cacheStats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    itemCount: 0,
  };
  
  // Performance tracking
  private responseTimes: number[] = [];
  private requestCounts: Map<number, number> = new Map(); // timestamp -> count
  private errorCounts: Map<number, number> = new Map();
  
  // Configuration
  private readonly maxCacheSize = 100 * 1024 * 1024; // 100MB
  private readonly maxCacheItems = 10000;
  private readonly defaultTTL = 300000; // 5 minutes
  private readonly cleanupInterval = 60000; // 1 minute
  
  // Optimization flags
  private compressionEnabled = true;
  private etagsEnabled = true;
  private connectionPooling = true;
  
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startCleanupTimer();
  }

  /**
   * Get item from cache
   */
  public async get<T>(
    key: string,
    fetcher?: () => Promise<T>,
    options?: {
      ttl?: number;
      tags?: string[];
      force?: boolean;
    }
  ): Promise<AsyncResult<T, Error>> {
    try {
      const cacheKey = this.generateCacheKey(key);
      
      // Check if force refresh
      if (options?.force) {
        this.memoryCache.delete(cacheKey);
      } else {
        // Try to get from cache
        const cached = this.memoryCache.get(cacheKey);
        if (cached && cached.expires > Date.now()) {
          cached.hits++;
          this.cacheStats.hits++;
          this.emit('cache:hit', { key, hits: cached.hits });
          return createSuccessResult(cached.data as T);
        }
      }
      
      // Cache miss
      this.cacheStats.misses++;
      this.emit('cache:miss', { key });
      
      // If no fetcher provided, return null
      if (!fetcher) {
        return createErrorResult(new Error('Cache miss and no fetcher provided'));
      }
      
      // Fetch data
      const startTime = Date.now();
      const data = await fetcher();
      const fetchTime = Date.now() - startTime;
      
      // Track response time
      this.trackResponseTime(fetchTime);

      // Store in cache
      const cacheOptions: { ttl?: number; tags?: string[] } = {
        ...(options?.ttl !== undefined ? { ttl: options.ttl } : {}),
        ...(options?.tags !== undefined ? { tags: options.tags } : {}),
      };
      await this.set(key, data, cacheOptions);
      
      return createSuccessResult(data);
    } catch (error: unknown) {
      return createErrorResult(
        error instanceof Error ? error : new Error('Failed to get from cache')
      );
    }
  }

  /**
   * Set item in cache
   */
  public async set<T>(
    key: string,
    data: T,
    options?: {
      ttl?: number;
      tags?: string[];
    }
  ): Promise<AsyncResult<void, Error>> {
    try {
      const cacheKey = this.generateCacheKey(key);
      const serialized = JSON.stringify(data);
      const size = Buffer.byteLength(serialized);
      
      // Check cache size limits
      if (this.memoryCache.size >= this.maxCacheItems) {
        await this.evictLRU();
      }
      
      if (this.cacheStats.size + size > this.maxCacheSize) {
        await this.evictBySize(size);
      }
      
      // Create cache entry
      const entry: CacheEntry<T> = {
        data,
        expires: Date.now() + (options?.ttl || this.defaultTTL),
        hits: 0,
        size,
        tags: options?.tags ?? [],
      };
      
      // Store in memory
      this.memoryCache.set(cacheKey, entry);
      this.cacheStats.size += size;
      this.cacheStats.itemCount++;
      
      this.emit('cache:set', { key, size, ttl: options?.ttl });
      
      return createSuccessResult(undefined);
    } catch (error: unknown) {
      return createErrorResult(
        error instanceof Error ? error : new Error('Failed to set cache')
      );
    }
  }

  /**
   * Invalidate cache by key or tags
   */
  public invalidate(
    keyOrTags: string | string[],
    byTags = false
  ): Promise<AsyncResult<number, Error>> {
    try {
      let invalidated = 0;

      if (byTags) {
        const tags = Array.isArray(keyOrTags) ? keyOrTags : [keyOrTags];

        for (const [key, entry] of this.memoryCache) {
          if (tags.some(tag => entry["tags"].includes(tag))) {
            this.memoryCache.delete(key);
            this.cacheStats.size -= entry.size;
            this.cacheStats.itemCount--;
            invalidated++;
          }
        }
      } else {
        const keys = Array.isArray(keyOrTags) ? keyOrTags : [keyOrTags];

        for (const key of keys) {
          const cacheKey = this.generateCacheKey(key);
          const entry = this.memoryCache.get(cacheKey);

          if (entry) {
            this.memoryCache.delete(cacheKey);
            this.cacheStats.size -= entry.size;
            this.cacheStats.itemCount--;
            invalidated++;
          }
        }
      }

      this.emit('cache:invalidate', { count: invalidated, byTags });

      return Promise.resolve(createSuccessResult(invalidated));
    } catch (error: unknown) {
      return Promise.resolve(createErrorResult(
        error instanceof Error ? error : new Error('Failed to invalidate cache')
      ));
    }
  }

  /**
   * Warm up cache with frequently accessed data
   */
  public async warmUp(): Promise<AsyncResult<void, Error>> {
    try {
      logger.info('Warming up cache...');
      
      // Get most popular manga
      const popularManga = await prisma.manga.findMany({
        where: { libraryStatus: 'ACTIVE' },
        orderBy: { updatedAt: 'desc' },
        take: 100,
        include: {
          Chapter: {
            take: 10,
            orderBy: { index: 'desc' },
          },
        },
      });
      
      // Cache popular manga in parallel for improved performance
      await Promise.all(
        popularManga.map(manga =>
          this.set(`manga:${manga["id"]}`, manga, {
            ttl: 3600000, // 1 hour
            tags: ['manga', `library:${manga.libraryId}`],
          })
        )
      );
      
      // Get active libraries
      const libraries = await prisma.library.findMany({
        include: {
          _count: {
            select: { Manga: true },
          },
        },
      });
      
      // Cache libraries in parallel for improved performance
      await Promise.all(
        libraries.map(library =>
          this.set(`library:${library["id"]}`, library, {
            ttl: 3600000,
            tags: ['library'],
          })
        )
      );
      
      logger.info(`Cache warmed up with ${this.cacheStats.itemCount} items`);
      
      return createSuccessResult(undefined);
    } catch (error: unknown) {
      return createErrorResult(
        error instanceof Error ? error : new Error('Failed to warm up cache')
      );
    }
  }

  /**
   * Optimize database queries
   */
  public optimizeQuery<T>(
    query: () => Promise<T>,
    options?: {
      cache?: boolean;
      cacheKey?: string;
      ttl?: number;
    }
  ): Promise<T> {
    // Add query optimization logic here
    // For now, just execute with optional caching
    if (options?.cache && options.cacheKey) {
      const getOptions: { ttl?: number } = {};
      if (options.ttl !== undefined) getOptions.ttl = options.ttl;
      return this.get(options.cacheKey, query, getOptions)
        .then(result => {
          if (result["status"] === 'success') return result.data;
          if (isError(result)) throw result.error;
          throw new Error('Cache fetch failed');
        });
    }
    
    return query();
  }

  /**
   * Get performance metrics
   */
  public getMetrics(): PerformanceMetrics {
    const now = Math.floor(Date.now() / 1000);
    const oneMinuteAgo = now - 60;
    
    // Calculate response time percentiles
    const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);
    
    // Calculate requests per second
    let totalRequests = 0;
    for (let i = oneMinuteAgo; i <= now; i++) {
      totalRequests += this.requestCounts.get(i) ?? 0;
    }
    const requestsPerSecond = totalRequests / 60;
    
    // Calculate error rate
    let totalErrors = 0;
    for (let i = oneMinuteAgo; i <= now; i++) {
      totalErrors += this.errorCounts.get(i) ?? 0;
    }
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
    
    // Calculate cache hit rate
    const totalCacheRequests = this.cacheStats.hits + this.cacheStats.misses;
    const cacheHitRate = totalCacheRequests > 0 
      ? (this.cacheStats.hits / totalCacheRequests) * 100 
      : 0;
    
    return {
      avgResponseTime: sortedTimes.length > 0 
        ? sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length 
        : 0,
      p95ResponseTime: sortedTimes[p95Index] ?? 0,
      p99ResponseTime: sortedTimes[p99Index] ?? 0,
      requestsPerSecond,
      errorRate,
      cacheHitRate,
    };
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): CacheStats & { hitRate: number } {
    const totalRequests = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = totalRequests > 0 
      ? (this.cacheStats.hits / totalRequests) * 100 
      : 0;
    
    return {
      ...this.cacheStats,
      hitRate,
    };
  }

  /**
   * Enable/disable optimizations
   */
  public setOptimizations(options: {
    compression?: boolean;
    etags?: boolean;
    connectionPooling?: boolean;
  }): void {
    if (options.compression !== undefined) {
      this.compressionEnabled = options.compression;
    }
    if (options.etags !== undefined) {
      this.etagsEnabled = options.etags;
    }
    if (options.connectionPooling !== undefined) {
      this.connectionPooling = options.connectionPooling;
    }
    
    this.emit('optimizations:changed', {
      compression: this.compressionEnabled,
      etags: this.etagsEnabled,
      connectionPooling: this.connectionPooling,
    });
  }

  /**
   * Generate ETag for data
   */
  public generateETag(data: unknown): string {
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    return createHash('md5').update(content).digest('hex');
  }

  /**
   * Check if ETag matches
   */
  public checkETag(etag: string | undefined, data: unknown): boolean {
    if (!etag || !this.etagsEnabled) return false;
    return etag === this.generateETag(data);
  }

  /**
   * Track response time
   */
  private trackResponseTime(time: number): void {
    this.responseTimes.push(time);
    
    // Keep only last 1000 response times
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }
    
    // Track request count
    const timestamp = Math.floor(Date.now() / 1000);
    this.requestCounts.set(timestamp, (this.requestCounts.get(timestamp) ?? 0) + 1);
  }

  /**
   * Track error
   */
  public trackError(): void {
    const timestamp = Math.floor(Date.now() / 1000);
    this.errorCounts.set(timestamp, (this.errorCounts.get(timestamp) ?? 0) + 1);
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(key: string): string {
    return createHash('md5').update(key).digest('hex');
  }

  /**
   * Evict least recently used items
   */
  private evictLRU(): Promise<void> {
    // Sort by hits (ascending) and evict least used
    const entries = Array.from(this.memoryCache.entries())
      .sort((a, b) => a[1].hits - b[1].hits);

    const toEvict = Math.ceil(entries.length * 0.1); // Evict 10%

    for (let i = 0; i < toEvict; i++) {
      const entryTuple = entries[i];
      if (!entryTuple) continue;
      const [key, entry] = entryTuple;
      this.memoryCache.delete(key);
      this.cacheStats.size -= entry.size;
      this.cacheStats.itemCount--;
      this.cacheStats.evictions++;
    }
    return Promise.resolve();
  }

  /**
   * Evict items to make space
   */
  private evictBySize(requiredSize: number): Promise<void> {
    const entries = Array.from(this.memoryCache.entries())
      .sort((a, b) => a[1].expires - b[1].expires); // Evict expiring soon

    let freedSize = 0;

    for (const [key, entry] of entries) {
      if (freedSize >= requiredSize) break;

      this.memoryCache.delete(key);
      this.cacheStats.size -= entry.size;
      this.cacheStats.itemCount--;
      this.cacheStats.evictions++;
      freedSize += entry.size;
    }
    return Promise.resolve();
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Clean up expired items and old metrics
   */
  private cleanup(): void {
    const now = Date.now();
    const nowTimestamp = Math.floor(now / 1000);
    
    // Clean expired cache entries
    for (const [key, entry] of this.memoryCache) {
      if (entry.expires < now) {
        this.memoryCache.delete(key);
        this.cacheStats.size -= entry.size;
        this.cacheStats.itemCount--;
      }
    }
    
    // Clean old request counts (keep last 5 minutes)
    const fiveMinutesAgo = nowTimestamp - 300;
    for (const [timestamp] of this.requestCounts) {
      if (timestamp < fiveMinutesAgo) {
        this.requestCounts.delete(timestamp);
      }
    }
    
    // Clean old error counts
    for (const [timestamp] of this.errorCounts) {
      if (timestamp < fiveMinutesAgo) {
        this.errorCounts.delete(timestamp);
      }
    }
  }

  /**
   * Shutdown service
   */
  public shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    this.memoryCache.clear();
    this.responseTimes = [];
    this.requestCounts.clear();
    this.errorCounts.clear();
  }
}

// Export singleton instance
export const performanceService = new PerformanceService();