/**
 * Unified Cache Implementation
 * 
 * Consolidates all caching functionality into a single, efficient implementation
 * with TTL support, LRU eviction, and memory management.
 */

import { logger } from './logger';

export interface CacheOptions {
  maxSize?: number;
  ttl?: number; // Time to live in milliseconds
  onEvict?: (key: string, value: unknown) => void;
}

export interface CacheEntry<T> {
  value: T;
  expires: number;
  size: number;
  lastAccessed: number;
}

export class UnifiedCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private ttl: number;
  private currentSize: number;
  private onEvict?: (key: string, value: unknown) => void;

  constructor(options: CacheOptions = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize ?? 100;
    this.ttl = options.ttl ?? 5 * 60 * 1000; // 5 minutes default
    this.currentSize = 0;
    if (options.onEvict !== undefined) {
      this.onEvict = options.onEvict;
    }
  }

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expires) {
      this.delete(key);
      return null;
    }

    // Update last accessed time for LRU
    entry.lastAccessed = Date.now();
    
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, ttl?: number): void {
    const size = this.calculateSize(value);
    const expires = Date.now() + (ttl ?? this.ttl);

    // Check if we need to evict items
    if (this.currentSize + size > this.maxSize) {
      this.evictLRU(size);
    }

    const entry: CacheEntry<T> = {
      value,
      expires,
      size,
      lastAccessed: Date.now()
    };

    // Remove old entry if exists
    if (this.cache.has(key)) {
      const oldEntry = this.cache.get(key);
      if (oldEntry !== undefined) {
        this.currentSize -= oldEntry.size;
      }
    }

    this.cache.set(key, entry);
    this.currentSize += size;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expires) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (entry) {
      this.currentSize -= entry.size;
      
      if (this.onEvict) {
        this.onEvict(key, entry.value);
      }
      
      return this.cache.delete(key);
    }

    return false;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    const evictionCallback = this.onEvict;
    if (evictionCallback) {
      this.cache.forEach((entry, key) => {
        evictionCallback(key, entry.value);
      });
    }
    
    this.cache.clear();
    this.currentSize = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    entries: number;
    hitRate: number;
    memoryUsage: number;
  } {
    // Clean up expired entries
    this.cleanupExpired();

    return {
      size: this.currentSize,
      entries: this.cache.size,
      hitRate: 0, // Would need to track hits/misses
      memoryUsage: this.currentSize
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      if (now > entry.expires) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.delete(key));
  }

  /**
   * Evict least recently used items
   */
  private evictLRU(requiredSize: number): void {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    let freedSize = 0;
    
    for (const [key, entry] of entries) {
      if (this.currentSize - freedSize + requiredSize <= this.maxSize) {
        break;
      }
      
      freedSize += entry.size;
      this.delete(key);
    }
  }

  /**
   * Calculate approximate size of value
   */
  private calculateSize(value: unknown): number {
    if (typeof value === 'string') {
      return value.length * 2; // 2 bytes per char
    }
    
    if (typeof value === 'object' && value !== null) {
      try {
        return JSON.stringify(value).length * 2;
      } catch {
        return 1024; // Default 1KB for objects that can't be stringified
      }
    }

    return 8; // Default size for primitives
  }
}

/**
 * Global cache instances
 */
export const caches = {
  metadata: new UnifiedCache({ maxSize: 10 * 1024 * 1024, ttl: 10 * 60 * 1000 }), // 10MB, 10min
  api: new UnifiedCache({ maxSize: 5 * 1024 * 1024, ttl: 5 * 60 * 1000 }), // 5MB, 5min
  images: new UnifiedCache({ maxSize: 20 * 1024 * 1024, ttl: 30 * 60 * 1000 }), // 20MB, 30min
  search: new UnifiedCache({ maxSize: 2 * 1024 * 1024, ttl: 2 * 60 * 1000 }), // 2MB, 2min
  session: new UnifiedCache({ maxSize: 1024 * 1024, ttl: 60 * 60 * 1000 }), // 1MB, 1hr
};

/**
 * Cache decorator for class methods
 *
 * @example
 * class MyService {
 *   @cached(60000)
 *   async fetchData(id: number): Promise<Data> {
 *     return await api.getData(id);
 *   }
 * }
 */
export function cached<T extends (...args: unknown[]) => Promise<unknown>>(
  ttl?: number
): (
  target: unknown,
  propertyKey: string,
  descriptor: PropertyDescriptor
) => PropertyDescriptor {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    // Type guard: Ensure the descriptor has a value and it's a function
    const originalMethod = descriptor.value as T | undefined;

    if (typeof originalMethod !== 'function') {
      throw new TypeError(
        `@cached can only decorate methods. "${propertyKey}" is not a method.`
      );
    }

    // Create cache instance with proper generic type
    const cache = new UnifiedCache<Awaited<ReturnType<T>>>({
      ...(ttl !== undefined ? { ttl } : {}),
    });

    // Create new descriptor instead of mutating parameter
    const newDescriptor: PropertyDescriptor = {
      ...descriptor,
      value: async function (
        ...args: Parameters<T>
      ): Promise<Awaited<ReturnType<T>>> {
        const key = JSON.stringify(args);

        const cached = cache.get(key);
        if (cached !== null) {
          return cached;
        }

        // Call original method with proper typing
        const result = (await (originalMethod as T).apply(
          this,
          args
        )) as Awaited<ReturnType<T>>;
        cache.set(key, result);

        return result;
      },
    };

    return newDescriptor;
  };
}

/**
 * Memoize function results
 */
export function memoize<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options?: CacheOptions
): T {
  const cache = new UnifiedCache(options);

  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    
    const cached = cache.get(key);
    if (cached !== null) {
      return cached as ReturnType<T>;
    }

    const result = fn(...args);
    cache.set(key, result);
    
    return result;
  }) as T;
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
  Object.values(caches).forEach(cache => cache.clear());
  logger.info('All caches cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats(): Record<string, unknown> {
  const stats: Record<string, unknown> = {};

  Object.entries(caches).forEach(([name, cache]) => {
    stats[name] = cache.getStats();
  });

  return stats;
}

export default UnifiedCache;
