/**
 * Cache type definitions
 */
/** Cache configuration */
export interface CacheConfig {
    /** Time-to-live in milliseconds */
    ttlMs: number;
    /** Maximum number of cache entries */
    maxEntries: number;
    /** Whether caching is enabled */
    enabled: boolean;
}
/** Single cache entry */
export interface CacheEntry<T> {
    value: T;
    expiresAt: number;
    lastAccessed: number;
}
/** Default cache configuration */
export declare const DEFAULT_CACHE_CONFIG: CacheConfig;
//# sourceMappingURL=cache.d.ts.map