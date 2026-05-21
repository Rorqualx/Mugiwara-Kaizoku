import { logger } from '../utils/logger';

/**
 * Enhanced Metadata Cache
 *
 * Multi-layer caching system for provider metadata with TTL and size limits.
 * Provides memory caching with localStorage persistence for session recovery.
 */
interface CacheEntry {
  data: unknown;
  timestamp: number;
  size: number;
}
interface CacheConfig {
  maxSizeMB?: number;
  ttl?: {
    fandom?: number;
    comicvine?: number;
    anilist?: number;
    wikipedia?: number;
    raw?: number;
  };
}
interface StoredCacheData {
  data: unknown;
  timestamp: number;
}
export enum EnrichmentLevel {
  FULL = 'full', // All enhanced data
  PARTIAL = 'partial', // Some enhanced data
  BASIC = 'basic' // Only search result data
  ,}
export class EnhancedMetadataCache {
  private cache: Map<string, CacheEntry> = new Map();
  private currentSize = 0;
  // Default configuration
  private readonly maxSize: number;
  private readonly ttl: Record<string, number>;
  constructor(config: CacheConfig = {}) {
    this.maxSize = (config.maxSizeMB ?? 50) * 1024 * 1024; // Default 50MB
    // Default TTLs for each provider (in milliseconds)
    this.ttl = {
      fandom: config.ttl?.fandom ?? 3600000, // 1 hour
      comicvine: config.ttl?.comicvine ?? 86400000, // 24 hours
      anilist: config.ttl?.anilist ?? 1800000, // 30 minutes
      wikipedia: config.ttl?.wikipedia ?? 7200000, // 2 hours
      raw: config.ttl?.raw ?? 86400000, // 24 hours
      ...config.ttl
    };
    // Try to recover from localStorage on initialization
    this.recoverAllFromStorage();
  }
  /**
   * Store metadata in cache
   */
  set(provider: string, id: string, data: unknown, enrichmentLevel?: EnrichmentLevel): void {
    const key = this.getCacheKey(provider, id);
    // Only spread if data is an object
    const dataWithMeta = typeof data === 'object' && data !== null
      ? {
          ...(data as Record<string, unknown>),
          _enrichmentLevel: enrichmentLevel ?? EnrichmentLevel.BASIC
        }
      : {
          value: data,
          _enrichmentLevel: enrichmentLevel ?? EnrichmentLevel.BASIC
        };
    const dataStr = JSON.stringify(dataWithMeta);
    const size = new Blob([dataStr]).size;
    // Evict old entries if size limit would be exceeded
    if (this.currentSize + size > this.maxSize) {
      this.evictOldest(size);
    }
    // Remove old entry if exists
    const existingEntry = this.cache.get(key);
    if (existingEntry) {
      this.currentSize -= existingEntry.size;
    }
    // Add new entry
    this.cache.set(key, {
      data: dataWithMeta,
      timestamp: Date.now(),
      size
    });
    this.currentSize += size;
    // Persist to localStorage for session recovery
    this.persistToStorage(key, dataWithMeta);
  }
  /**
   * Retrieve metadata from cache
   */
  get(provider: string, id: string): unknown | null {
    const key = this.getCacheKey(provider, id);
    const entry = this.cache.get(key);
    if (!entry) {
      // Try to recover from localStorage
      return this.recoverFromStorage(key, provider);
    }
    // Check TTL
    const age = Date.now() - entry.timestamp;
    const providerTtl = this.ttl[provider] ?? 3600000; // Default 1 hour
    if (age > providerTtl) {
      // Entry expired
      this.remove(provider, id);
      return null;
    }
    return entry.data;
  }
  /**
   * Check if cache has valid entry
   */
  has(provider: string, id: string): boolean {
    return this.get(provider, id) !== null;
  }
  /**
   * Remove specific entry
   */
  remove(provider: string, id: string): void {
    const key = this.getCacheKey(provider, id);
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSize -= entry.size;
      this.cache.delete(key);
      this.removeFromStorage(key);
    }
  }
  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
    this.clearStorage();
  }
  /**
   * Get cache statistics
   */
  getStats(): {
    entries: number;
    sizeBytes: number;
    sizeMB: number;
    hitRate: number;
    providers: Record<string, number>;
  } {
    const providers: Record<string, number> = {};
    for (const key of this.cache.keys()) {
      const [provider] = key.split(':');
      if (provider) {
        providers[provider] = (providers[provider] ?? 0) + 1;
      }
    }
    return {
      entries: this.cache.size,
      sizeBytes: this.currentSize,
      sizeMB: this.currentSize / (1024 * 1024),
      hitRate: this.calculateHitRate(),
      providers
    };
  }
  /**
   * Get enrichment level for cached entry
   */
  getEnrichmentLevel(provider: string, id: string): EnrichmentLevel | null {
    const data = this.get(provider, id);
    if (typeof data === 'object' && data !== null && '_enrichmentLevel' in data) {
      const dataRecord = data as Record<string, unknown>;
      const enrichmentLevel = dataRecord['_enrichmentLevel'];
      if (typeof enrichmentLevel === 'string' && Object.values(EnrichmentLevel).includes(enrichmentLevel as EnrichmentLevel)) {
        return enrichmentLevel as EnrichmentLevel;
      }
    }
    return null;
  }
  // Private methods
  private getCacheKey(provider: string, id: string): string {
    return `${provider}:${id}`;
  }
  private evictOldest(requiredSpace: number): void {
    const entries = Array.from(this.cache.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    );
    let freedSpace = 0;
    const toRemove: string[] = [];
    // Remove entries until we have enough space
    for (const [key, entry] of entries) {
      if (freedSpace >= requiredSpace) {
        break;
      }
      toRemove.push(key);
      freedSpace += entry.size;
    }
    // Remove selected entries
    for (const key of toRemove) {
      const entry = this.cache.get(key);
      if (entry) {
        this.cache.delete(key);
        this.currentSize -= entry.size;
        this.removeFromStorage(key);
      }
    }
  }
  private persistToStorage(key: string, data: unknown): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      // Use compression for localStorage
      const compressed = this.compress({
        data,
        timestamp: Date.now()
      });
      localStorage.setItem(`metadata-cache:${key}`, compressed);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      logger.warn('Failed to persist cache to localStorage:', errorMessage);
      // Try to clear old entries
      this.cleanupStorage();
    }
  }
  private recoverFromStorage(key: string, provider: string): unknown | null {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      const compressed = localStorage.getItem(`metadata-cache:${key}`);
      if (!compressed) {
        return null;
      }
      const decompressed = this.decompress(compressed);
      if (!decompressed || typeof decompressed !== 'object' || !('data' in decompressed) || !('timestamp' in decompressed)) {
        return null;
      }
      const storedData = decompressed as StoredCacheData;
      const data = storedData.data;
      const timestamp = storedData.timestamp;
      // Check if still valid
      const age = Date.now() - timestamp;
      const providerTtl = this.ttl[provider] ?? 3600000;
      if (age > providerTtl) {
        localStorage.removeItem(`metadata-cache:${key}`);
        return null;
      }
      // Re-add to memory cache
      const dataStr = JSON.stringify(data);
      const size = new Blob([dataStr]).size;
      this.cache.set(key, {
        data,
        timestamp,
        size
      });
      this.currentSize += size;
      return data;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      logger.warn('Failed to recover from localStorage:', errorMessage);
      return null;
    }
  }
  private recoverAllFromStorage(): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const keys = Object.keys(localStorage).filter((k) =>
        k.startsWith('metadata-cache:')
      );
      for (const storageKey of keys) {
        const cacheKey = storageKey.replace('metadata-cache:', '');
        const [provider] = cacheKey.split(':');
        // Try to recover this entry
        if (provider) {
          this.recoverFromStorage(cacheKey, provider);
        }
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      logger.warn('Failed to recover cache from localStorage:', errorMessage);
    }
  }
  private removeFromStorage(key: string): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      localStorage.removeItem(`metadata-cache:${key}`);
    } catch {
      // Silently fail on removal errors
    }
  }
  private clearStorage(): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const keys = Object.keys(localStorage).filter((k) =>
        k.startsWith('metadata-cache:')
      );
      for (const key of keys) {
        localStorage.removeItem(key);
      }
    } catch {
      // Silently fail on clear errors
    }
  }
  private cleanupStorage(): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const keys = Object.keys(localStorage)
        .filter((k) => k.startsWith('metadata-cache:'))
        .map((k) => ({
          key: k,
          timestamp: this.getStorageTimestamp(k)
        }))
        .sort((a, b) => a.timestamp - b.timestamp);
      // Remove oldest 20%
      const toRemove = Math.ceil(keys.length * 0.2);
      for (let i = 0; i < toRemove; i++) {
        const keyObj = keys[i];
        if (keyObj !== undefined) {
          localStorage.removeItem(keyObj.key);
        }
      }
    } catch {
      // Silently fail on cleanup errors
    }
  }
  private getStorageTimestamp(key: string): number {
    try {
      const compressed = localStorage.getItem(key);
      if (!compressed) {
        return 0;
      }
      const decompressed = this.decompress(compressed);
      if (decompressed && typeof decompressed === 'object' && 'timestamp' in decompressed) {
        const storedData = decompressed as StoredCacheData;
        return storedData.timestamp;
      }
      return 0;
    } catch {
      return 0;
    }
  }
  // Simple compression using base64 encoding (can be replaced with LZ-string)
  private compress(data: unknown): string {
    const str = JSON.stringify(data);
    // For now, just use base64. In production, use LZ-string
    // eslint-disable-next-line no-undef
    return btoa(encodeURIComponent(str));
  }
  private decompress(compressed: string): unknown {
    // For now, just use base64. In production, use LZ-string
    // eslint-disable-next-line no-undef
    const str = decodeURIComponent(atob(compressed));
    return JSON.parse(str);
  }
  private calculateHitRate(): number {
    // This would need actual hit/miss tracking in production
    // For now, return a placeholder
    return 0;
  }
}
// Export singleton instance
export const metadataCache = new EnhancedMetadataCache();