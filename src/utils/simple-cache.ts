/**
 * Simple Cache Implementation
 * Provides basic in-memory caching functionality
 */

export interface CacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of items
  namespace?: string;
  invalidationPatterns?: {
    create?: string[];
    update?: string[];
    delete?: string[];
  };
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

export class SimpleCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>>;
  private config: CacheConfig;
  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      enabled: true,
      ttl: 5 * 60 * 1000, // 5 minutes default
      maxSize: 1000,
      namespace: 'default',
      ...config
    };
    this.cache = new Map();
  }

  get(key: string): T | undefined {
    if (!this.config.enabled) return undefined;
    const fullKey = this.getFullKey(key);
    const entry = this.cache.get(fullKey);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(fullKey);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T, ttl?: number): void {
    if (!this.config.enabled) return;
    const fullKey = this.getFullKey(key);
    const expiresAt = Date.now() + (ttl ?? this.config.ttl);
    // Check size limit
    if (this.config.maxSize && this.cache.size >= this.config.maxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(fullKey, {
      value,
      expiresAt,
      createdAt: Date.now()
    });
  }

  has(key: string): boolean {
    if (!this.config.enabled) return false;
    return this.get(key) !== undefined;
  }

  delete(key: string): boolean {
    if (!this.config.enabled) return false;
    const fullKey = this.getFullKey(key);
    return this.cache.delete(fullKey);
  }

  clear(): void {
    this.cache.clear();
  }

  invalidatePattern(pattern: string): void {
    if (!this.config.enabled) return;
    const regex = new RegExp(pattern);
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  private getFullKey(key: string): string {
    return this.config.namespace ? `${this.config.namespace}:${key}` : key;
  }

  // Utility methods
  size(): number {
    return this.cache.size;
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  values(): T[] {
    const values: T[] = [];
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now <= entry.expiresAt) {
        values.push(entry.value);
      } else {
        this.cache.delete(key);
      }
    }

    return values;
  }

  // Stats
  getStats(): { size: number; valid: number; expired: number; enabled: boolean; namespace: string | undefined } {
    let expired = 0;
    let valid = 0;
    const now = Date.now();
    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expired++;
      } else {
        valid++;
      }
    }

    return {
      size: this.cache.size,
      valid,
      expired,
      enabled: this.config.enabled,
      namespace: this.config.namespace
    };
  }
}

// Create default cache instance
export const defaultCache = new SimpleCache();
// Cache decorator with full type safety and immutability
export function cacheable<TArgs extends unknown[], TReturn>(
  ttl?: number
): (
  target: unknown,
  propertyKey: string,
  descriptor: TypedPropertyDescriptor<(...args: TArgs) => Promise<TReturn>>
) => TypedPropertyDescriptor<(...args: TArgs) => Promise<TReturn>> {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: TArgs) => Promise<TReturn>>
  ): TypedPropertyDescriptor<(...args: TArgs) => Promise<TReturn>> {
    // Type-safe access - TypedPropertyDescriptor ensures descriptor.value has correct type
    const originalMethod = descriptor.value;

    // Guard against undefined descriptor.value
    if (!originalMethod) {
      throw new Error(`Cannot decorate undefined method: ${propertyKey}`);
    }

    const cache = new SimpleCache<TReturn>({ ttl: ttl ?? 60000 });

    // Return new descriptor (immutable pattern) instead of mutating parameter
    return {
      ...descriptor,
      value: async function (this: unknown, ...args: TArgs): Promise<TReturn> {
        const cacheKey = `${propertyKey}:${JSON.stringify(args)}`;
        const cached = cache.get(cacheKey);

        if (cached !== undefined) {
          return cached;
        }

        // Type-safe call - result is guaranteed to be TReturn
        const result: TReturn = await originalMethod.call(this, ...args);
        cache.set(cacheKey, result);
        return result;
      }
    };
  };
}

// Named exports for compatibility
export const Cache = SimpleCache;
export const createCache = <T = unknown,>(config?: Partial<CacheConfig>): SimpleCache<T> => new SimpleCache<T>(config);
export default SimpleCache;