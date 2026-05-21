/**
 * Pattern Cache
 * 
 * High-performance caching system for pattern recognition results.
 * Uses LRU eviction and TTL expiration for optimal memory usage.
 */

import crypto from 'crypto';

import type { CacheEntry, PatternMatch, PerformanceConfig } from '../types';

export class PatternCache {
  private cache: Map<string, CacheEntry> = new Map();
  private accessOrder: string[] = [];
  private config: PerformanceConfig;
  private totalHits = 0;
  private totalMisses = 0;

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      maxMemoryMB: 2048, // Increased from 500MB to 2GB
      maxCacheSize: 5000, // Increased from 1000 to 5000 patterns
      cacheTTL: 3600000, // 1 hour
      parallelProcessing: true,
      batchSize: 32,
      ...config
    };
  }

  /**
   * Initialize cache
   */
  initialize(): Promise<void> {
    // Load persistent cache if available
    // For now, start with empty cache
    this.cache.clear();
    this.accessOrder = [];
    return Promise.resolve();
  }

  /**
   * Get item from cache
   */
  get(html: string): Promise<{ matches: PatternMatch[], confidence: number } | null> {
    const key = this.generateKey(html);
    const entry = this.cache.get(key);

    if (!entry) {
      this.totalMisses++;
      return Promise.resolve(null);
    }

    // Check TTL
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.totalMisses++;
      return Promise.resolve(null);
    }

    // Update access order (LRU)
    this.updateAccessOrder(key);
    entry.hits++;

    this.totalHits++;
    return Promise.resolve(entry.value as { matches: PatternMatch[], confidence: number });
  }

  /**
   * Set item in cache
   */
  set(html: string, value: { matches: PatternMatch[], confidence: number }): Promise<void> {
    const key = this.generateKey(html);

    // Check cache size
    if (this.cache.size >= this.config.maxCacheSize) {
      this.evictLRU();
    }

    // Check memory usage
    if (this.getMemoryUsage() > this.config.maxMemoryMB) {
      this.evictOldest();
    }

    // Create entry
    const entry: CacheEntry = {
      key,
      value,
      features: value.matches[0]?.features ?? ({} as CacheEntry['features']),
      pattern: value.matches[0]?.pattern ?? ({} as CacheEntry['pattern']),
      timestamp: new Date(),
      hits: 0,
      ttl: this.config.cacheTTL
    };

    this.cache.set(key, entry);
    this.accessOrder.push(key);
    return Promise.resolve();
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.totalHits = 0;
    this.totalMisses = 0;
  }

  /**
   * Generate cache key from HTML
   */
  private generateKey(html: string): string {
    return crypto.createHash('md5').update(html).digest('hex');
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    const age = Date.now() - entry.timestamp.getTime();
    return age > entry.ttl;
  }

  /**
   * Update access order for LRU
   */
  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  /**
   * Remove key from access order
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index >= 0) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Evict least recently used item
   */
  private evictLRU(): void {
    if (this.accessOrder.length === 0) return;

    const lruKey = this.accessOrder.shift();
    if (lruKey !== undefined) {
      this.cache.delete(lruKey);
    }
  }

  /**
   * Evict oldest items
   */
  private evictOldest(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());
    
    // Remove oldest 10%
    const toRemove = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < toRemove; i++) {
      const entry = entries[i];
      if (entry) {
        const [key] = entry;
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
      }
    }
  }

  /**
   * Get memory usage estimate
   */
  private getMemoryUsage(): number {
    // Rough estimate: assume each entry is ~10KB
    return (this.cache.size * 10) / 1024; // MB
  }

  /**
   * Get cache statistics
   */
  getStatistics(): {
    size: number,
    hits: number,
    misses: number,
    hitRate: number,
    memoryUsageMB: number
  } {
    return {
      size: this.cache.size,
      hits: this.totalHits,
      misses: this.totalMisses,
      hitRate: this.totalHits / (this.totalHits + this.totalMisses) || 0,
      memoryUsageMB: this.getMemoryUsage()
    };
  }

  /**
   * Prune expired entries
   */
  pruneExpired(): void {
    const now = Date.now();
    const toDelete: string[] = [];
    
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp.getTime() > entry.ttl) {
        toDelete.push(key);
      }
    }
    
    for (const key of toDelete) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
    }
  }

  /**
   * Warm cache with common patterns
   */
  async warmCache(patterns: Array<{ html: string, matches: PatternMatch[], confidence: number }>): Promise<void> {
    // Process all patterns in parallel to avoid no-await-in-loop
    await Promise.all(
      patterns.map(item => this.set(item.html, { matches: item.matches, confidence: item.confidence }))
    );
  }
}