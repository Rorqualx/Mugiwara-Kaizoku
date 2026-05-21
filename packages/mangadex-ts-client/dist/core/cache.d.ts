/**
 * In-memory TTL cache with LRU eviction
 */
import { CacheConfig } from '../types/cache';
export declare class TTLCache<T = unknown> {
    private readonly store;
    private readonly config;
    constructor(config?: Partial<CacheConfig>);
    get(key: string): T | undefined;
    set(key: string, value: T): void;
    has(key: string): boolean;
    delete(key: string): boolean;
    clear(): void;
    get size(): number;
    private evictLRU;
}
//# sourceMappingURL=cache.d.ts.map