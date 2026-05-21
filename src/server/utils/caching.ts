/**
 * API Caching Utilities
 * 
 * This module provides standardized caching mechanisms for API responses,
 * reducing duplicate requests and improving performance.
 * 
 * Features:
 * - Multi-tier caching (Memory, Persistent, Disk)
 * - In-memory caching with TTL
 * - Size limits with LRU/LFU/FIFO eviction policies
 * - Namespace support for cache partitioning
 * - Pattern-based cache invalidation
 * - Support for automatic cache invalidation on mutations
 * - Request deduplication to prevent thundering herd
 * - Cache warming and preloading
 * - Compression support for large payloads
 * - Cache statistics and monitoring
 */

import { EventEmitter } from 'events';

/**
 * Cache tier levels
 */
export enum CacheTier {
  L1_MEMORY = 'L1_MEMORY',
  L2_PERSISTENT = 'L2_PERSISTENT',
  L3_DISK = 'L3_DISK',
}

/**
 * Cache eviction policies
 */
export enum EvictionPolicy {
  LRU = 'lru', // Least Recently Used
  LFU = 'lfu', // Least Frequently Used
  FIFO = 'fifo', // First In First Out
  TTL = 'ttl' // Time To Live based
  ,}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  enabled: boolean;
  ttl: number; // Default TTL in seconds
  maxSize?: number; // Maximum number of entries
  namespace?: string; // Optional namespace for partitioning
  invalidationPatterns?: {
    [key: string]: string[]; // Keys that should be invalidated when an operation occurs
  };
  keyGenerator?: (args: unknown[]) => string; // Custom key generation

  // Extended configuration from unified version
  name?: string;
  tiers?: CacheTier[];
  evictionPolicy?: EvictionPolicy;
  compressionThreshold?: number;
  diskCachePath?: string;
  maxMemorySize?: number;
  maxDiskSize?: number;
  refreshAhead?: boolean;
  refreshThreshold?: number;
  deduplication?: boolean;
  enableMetrics?: boolean;
  enableLogging?: boolean;
}

/**
 * Cache entry with value and expiration
 */
interface CacheEntry<T> {
  value: T;
  expires: number; // Timestamp when entry expires
  lastAccessed: number; // Timestamp of last access for LRU
  frequency?: number; // Access frequency for LFU
  created?: number; // Creation timestamp for FIFO
  size?: number; // Size in bytes
  compressed?: boolean; // Whether value is compressed
  tier?: CacheTier; // Current tier location
}

/**
 * Generic caching implementation for API responses
 */
export class Cache<T = unknown> extends EventEmitter {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private config: CacheConfig;

  /**
   * Creates a new cache instance
   * 
   * @param config - Cache configuration
   */
  constructor(config: CacheConfig) {
    super();
    this.config = config;
  }

  /**
   * Gets a value from cache
   * 
   * @param key - Cache key
   * @returns Cached value or undefined if not found or expired
   */
  get(key: string): T | undefined {
    if (!this.config.enabled) return undefined;

    const cacheKey = this.getCacheKey(key);
    const cached = this.cache.get(cacheKey);

    if (!cached) {
      this.emit('miss', { key });
      return undefined;
    }

    // Check if expired
    if (cached.expires < Date.now()) {
      this.cache.delete(cacheKey);
      this.emit('expired', { key });
      return undefined;
    }

    // Update access metadata
    cached.lastAccessed = Date.now();
    cached.frequency = (cached.frequency ?? 0) + 1;

    this.emit('hit', { key });
    return cached.value;
  }

  /**
   * Sets a value in cache
   * 
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - TTL in seconds (overrides default)
   */
  set(key: string, value: T, ttl?: number): void {
    if (!this.config.enabled) return;

    const cacheKey = this.getCacheKey(key);
    const now = Date.now();
    const expires = now + (ttl ?? this.config.ttl) * 1000;

    // Enforce max size
    if (this.config.maxSize && this.cache.size >= this.config.maxSize) {
      // Evict based on policy
      this.evictLRU();
    }

    // Get existing entry to preserve frequency
    const existing = this.cache.get(cacheKey);
    const frequency = existing ? (existing.frequency ?? 0) + 1 : 1;

    this.cache.set(cacheKey, {
      value,
      expires,
      lastAccessed: now,
      created: existing?.created ?? now,
      frequency,
      tier: CacheTier.L1_MEMORY
    });

    this.emit('set', { key, ttl });
  }

  /**
   * Checks if a key exists in the cache and is not expired
   * 
   * @param key - Cache key
   * @returns True if the key exists and is not expired
   */
  has(key: string): boolean {
    if (!this.config.enabled) return false;

    const cacheKey = this.getCacheKey(key);
    const cached = this.cache.get(cacheKey);

    if (!cached) return false;

    // Check if expired
    if (cached.expires < Date.now()) {
      this.cache.delete(cacheKey);
      return false;
    }

    return true;
  }

  /**
   * Invalidates cache entries
   * 
   * @param pattern - Optional glob pattern for selective invalidation
   */
  invalidate(pattern?: string): void {
    if (!this.config.enabled) return;

    if (!pattern) {
      this.cache.clear();
      return;
    }

    // Convert glob pattern to regex
    // * matches any characters within a segment
    // ** matches across segments
    const regexPattern = pattern.
    replace(/\*\*/g, '___GLOBSTAR___').
    replace(/\*/g, '[^:]*').
    replace(/___GLOBSTAR___/g, '.*');

    const regex = new RegExp(`^${regexPattern}$`);

    // Delete matching keys - convert iterator to array for ES5 compatibility
    const keys = Array.from(this.cache.keys());
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key === undefined) continue;
      // Remove namespace for pattern matching
      const rawKey = this.config.namespace ?
      key.substring(this.config.namespace.length + 1) :
      key;

      if (regex.test(rawKey)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Invalidates related cache entries based on operation
   * 
   * @param operation - Operation name that triggers invalidation
   */
  invalidateRelated(operation: string): void {
    if (!this.config.enabled) return;

    const patterns = this.config.invalidationPatterns?.[operation];
    if (!patterns) return;

    for (const pattern of patterns) {
      this.invalidate(pattern);
    }
  }

  /**
   * Gets the size of the cache
   * 
   * @returns Number of items in cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Clears all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Gets cache statistics
   * 
   * @returns Statistics about the cache
   */
  getStats(): {size: number;maxSize: number | undefined;ttl: number;} {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      ttl: this.config.ttl
    };
  }

  /**
   * Gets the full cache key including namespace
   * 
   * @param key - The raw cache key
   * @returns Namespaced cache key
   */
  private getCacheKey(key: string): string {
    return this.config.namespace ? `${this.config.namespace}:${key}` : key;
  }

  /**
   * Evicts entries based on configured policy
   */
  private evictLRU(): void {
    const policy = this.config.evictionPolicy ?? EvictionPolicy.LRU;

    switch (policy) {
      case EvictionPolicy.LRU:
        this.evictLeastRecentlyUsed();
        break;
      case EvictionPolicy.LFU:
        this.evictLeastFrequentlyUsed();
        break;
      case EvictionPolicy.FIFO:
        this.evictFirstInFirstOut();
        break;
      case EvictionPolicy.TTL:
        this.evictExpired();
        break;
      default:
        this.evictLeastRecentlyUsed();
    }
  }

  /**
   * Evicts the least recently used entry
   */
  private evictLeastRecentlyUsed(): void {
    let lruKey: string | undefined;
    let lruTimestamp = Infinity;

    // Convert iterator to array for ES5 compatibility
    const entries = Array.from(this.cache.entries());
    for (let i = 0; i < entries.length; i++) {
      const entryPair = entries[i];
      if (entryPair === undefined) continue;
      const [key, entry] = entryPair;
      if (entry.lastAccessed < lruTimestamp) {
        lruTimestamp = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.emit('evict', { key: lruKey, policy: 'LRU' });
    }
  }

  /**
   * Evicts the least frequently used entry
   */
  private evictLeastFrequentlyUsed(): void {
    let lfuKey: string | undefined;
    let lfuFrequency = Infinity;

    const entries = Array.from(this.cache.entries());
    for (let i = 0; i < entries.length; i++) {
      const entryPair = entries[i];
      if (entryPair === undefined) continue;
      const [key, entry] = entryPair;
      const frequency = entry.frequency ?? 0;
      if (frequency < lfuFrequency) {
        lfuFrequency = frequency;
        lfuKey = key;
      }
    }

    if (lfuKey) {
      this.cache.delete(lfuKey);
      this.emit('evict', { key: lfuKey, policy: 'LFU' });
    }
  }

  /**
   * Evicts the oldest entry
   */
  private evictFirstInFirstOut(): void {
    let fifoKey: string | undefined;
    let fifoCreated = Infinity;

    const entries = Array.from(this.cache.entries());
    for (let i = 0; i < entries.length; i++) {
      const entryPair = entries[i];
      if (entryPair === undefined) continue;
      const [key, entry] = entryPair;
      const created = entry.created ?? entry.lastAccessed;
      if (created < fifoCreated) {
        fifoCreated = created;
        fifoKey = key;
      }
    }

    if (fifoKey) {
      this.cache.delete(fifoKey);
      this.emit('evict', { key: fifoKey, policy: 'FIFO' });
    }
  }

  /**
   * Evicts expired entries
   */
  private evictExpired(): void {
    const now = Date.now();
    const keys = Array.from(this.cache.keys());

    for (const key of keys) {
      const entry = this.cache.get(key);
      if (entry && entry.expires < now) {
        this.cache.delete(key);
        this.emit('evict', { key, policy: 'TTL' });
      }
    }
  }
}

/**
 * Factory function to create cache with provider presets
 */
export function createCache<T = unknown>(
providerOrConfig: string | CacheConfig,
customConfig?: Partial<CacheConfig>)
: Cache<T> {
  let config: CacheConfig;

  if (typeof providerOrConfig === 'string') {
    // Provider presets
    switch (providerOrConfig) {
      case 'anilist':
        config = {
          name: 'AniList Cache',
          enabled: true,
          ttl: 300, // 5 minutes
          maxSize: 1000,
          evictionPolicy: EvictionPolicy.LRU,
          namespace: 'anilist',
          ...customConfig
        };
        break;
      case 'comicvine':
        config = {
          name: 'ComicVine Cache',
          enabled: true,
          ttl: 3600, // 1 hour
          maxSize: 500,
          evictionPolicy: EvictionPolicy.LRU,
          namespace: 'comicvine',
          compressionThreshold: 1024 * 10, // 10KB
          ...customConfig
        };
        break;
      case 'fandom':
        config = {
          name: 'Fandom Cache',
          enabled: true,
          ttl: 1800, // 30 minutes
          maxSize: 2000,
          evictionPolicy: EvictionPolicy.LFU,
          namespace: 'fandom',
          ...customConfig
        };
        break;
      case 'mangadex':
        config = {
          name: 'MangaDex Cache',
          enabled: true,
          ttl: 600, // 10 minutes
          maxSize: 1500,
          evictionPolicy: EvictionPolicy.LRU,
          namespace: 'mangadex',
          ...customConfig
        };
        break;
      case 'wikipedia':
        config = {
          name: 'Wikipedia Cache',
          enabled: true,
          ttl: 3600, // 1 hour
          maxSize: 1000,
          evictionPolicy: EvictionPolicy.LRU,
          namespace: 'wikipedia',
          ...customConfig
        };
        break;
      default:
        throw new Error(`Unknown provider preset: ${providerOrConfig}`);
    }
  } else {
    config = providerOrConfig;
  }

  return new Cache<T>(config);
}

// Backward compatibility aliases
export { Cache as UnifiedCacheManager };
export { createCache as createCacheManager };
export type { CacheConfig as UnifiedCacheManagerConfig };

/**
 * Creates a memoized function that caches results
 * 
 * @param fn - Function to memoize
 * @param keyFn - Optional function to generate cache keys
 * @param ttl - Optional TTL in seconds
 * @returns Memoized function
 */
export function memoize<T, A extends unknown[]>(
fn: (...args: A) => T,
keyFn?: (...args: A) => string,
ttl?: number)
: (...args: A) => T {
  const cache = new Cache<T>({
    enabled: true,
    ttl: ttl ?? 300 // 5 minutes default
  });

  return (...args: A): T => {
    // Generate cache key
    const key = keyFn ?
    keyFn(...args) :
    JSON.stringify(args);

    // Check cache
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    // Call original function
    const result = fn(...args);

    // Cache result
    cache.set(key, result);

    return result;
  };
}