/**
 * In-memory TTL cache with LRU eviction
 */

import { CacheConfig, CacheEntry, DEFAULT_CACHE_CONFIG } from '../types/cache';

export class TTLCache<T = unknown> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly config: CacheConfig;

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
  }

  get(key: string): T | undefined {
    if (!this.config.enabled) return undefined;

    const entry = this.store.get(key);
    if (!entry) return undefined;

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    // Update LRU access time
    entry.lastAccessed = Date.now();
    return entry.value;
  }

  set(key: string, value: T): void {
    if (!this.config.enabled) return;

    // Evict if at capacity
    if (this.store.size >= this.config.maxEntries && !this.store.has(key)) {
      this.evictLRU();
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.config.ttlMs,
      lastAccessed: Date.now(),
    });
  }

  has(key: string): boolean {
    const val = this.get(key); // triggers expiration check
    return val !== undefined;
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  private evictLRU(): void {
    let oldestKey: string | undefined;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.store) {
      // Also evict expired entries
      if (Date.now() > entry.expiresAt) {
        this.store.delete(key);
        return;
      }
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
    }
  }
}
