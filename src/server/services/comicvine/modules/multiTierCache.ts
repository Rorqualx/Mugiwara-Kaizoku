/**
 * Multi-Tier Caching System for ComicVine API
 *
 * MIGRATED: Now uses UnifiedCacheProvider with Redis-like PostgreSQL
 * for improved performance and unified caching strategy.
 *
 * Implements a multi-tier caching strategy:
 * - L1: In-memory cache (fastest, limited size)
 * - L2: PostgreSQL UNLOGGED table (persistent, high-performance)
 * - L3: Hot data cache (frequently accessed items)
 *
 * Also includes request deduplication to prevent concurrent identical requests.
 */

import { cacheProvider, type UnifiedCacheProvider } from '@/server/cache/UnifiedCacheProvider';
import { logger } from '@/utils/logger';

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    hits: number;
    size: number;
    etag?: string;
}

/**
 * Cache tier statistics
 */
interface TierStats {
    hits: number;
    misses: number;
    evictions: number;
    size: number;
    entries: number;
}

/**
 * Multi-tier cache configuration
 */
export interface MultiTierCacheConfig {
    // L1 Memory cache
    l1MaxSize?: number; // Max entries in memory
    l1TtlMs?: number; // TTL in milliseconds

    // L2 Persistent cache (now PostgreSQL)
    l2Enabled?: boolean;
    l2TtlMs?: number;
    l2Namespace?: string;

    // L3 Hot data cache
    l3Enabled?: boolean;
    l3TtlMs?: number;

    // Deduplication
    deduplicationEnabled?: boolean;
    deduplicationWindowMs?: number;

    /** Optional cache provider for pool isolation (defaults to main singleton) */
    l2Provider?: UnifiedCacheProvider;
}

/**
 * Request deduplication entry
 */
interface DeduplicationEntry<T> {
    promise: Promise<T>;
    timestamp: number;
    subscribers: number;
}

/**
 * Multi-Tier Cache Implementation
 * Now backed by UnifiedCacheProvider for L2/L3
 */
export class MultiTierCache<T = unknown> {
    // L1: In-memory cache (kept for ultra-fast access)
    private l1Cache: Map<string, CacheEntry<T>>;

    // L2 provider (configurable for pool isolation)
    private readonly l2Provider: UnifiedCacheProvider;

    // Configuration
    private readonly L1_MAX_SIZE: number;
    private readonly L1_TTL_MS: number;
    private readonly L2_ENABLED: boolean;
    private readonly L2_TTL_MS: number;
    private readonly L2_NAMESPACE: string;
    private readonly L3_ENABLED: boolean;
    private readonly L3_TTL_MS: number;

    // Deduplication
    private readonly DEDUP_ENABLED: boolean;
    private readonly DEDUP_WINDOW_MS: number;
    private pendingRequests: Map<string, DeduplicationEntry<T>>;

    // Statistics
    private stats: {
        l1: TierStats;
        l2: TierStats;
        l3: TierStats;
        deduplication: {
            prevented: number;
            active: number;
        };
    };

    constructor(config: MultiTierCacheConfig = {}) {
        // Use injected provider or fall back to global singleton
        this.l2Provider = config.l2Provider ?? cacheProvider;

        // Initialize configuration
        this.L1_MAX_SIZE = config.l1MaxSize ?? 100;
        this.L1_TTL_MS = config.l1TtlMs ?? 300000; // 5 minutes

        this.L2_ENABLED = config.l2Enabled !== false;
        this.L2_TTL_MS = config.l2TtlMs ?? 3600000; // 1 hour
        this.L2_NAMESPACE = config.l2Namespace ?? 'comicvine';

        this.L3_ENABLED = config.l3Enabled !== false;
        this.L3_TTL_MS = config.l3TtlMs ?? 86400000; // 24 hours

        this.DEDUP_ENABLED = config.deduplicationEnabled !== false;
        this.DEDUP_WINDOW_MS = config.deduplicationWindowMs ?? 5000; // 5 seconds

        // Initialize caches
        this.l1Cache = new Map();

        // Initialize deduplication
        this.pendingRequests = new Map();

        // Initialize statistics
        this.stats = {
            l1: { hits: 0, misses: 0, evictions: 0, size: 0, entries: 0 },
            l2: { hits: 0, misses: 0, evictions: 0, size: 0, entries: 0 },
            l3: { hits: 0, misses: 0, evictions: 0, size: 0, entries: 0 },
            deduplication: { prevented: 0, active: 0 }
        };

        logger.info('Multi-tier cache initialized with UnifiedCacheProvider', {
            l1MaxSize: this.L1_MAX_SIZE,
            l2Enabled: this.L2_ENABLED,
            l3Enabled: this.L3_ENABLED,
            dedupEnabled: this.DEDUP_ENABLED
        });
    }

    /**
     * Get value from cache with multi-tier lookup
     */
    public async get(key: string): Promise<T | undefined> {
        // Check L1 (memory)
        const l1Result = this.getFromL1(key);
        if (l1Result !== undefined) {
            return l1Result;
        }

        // Check L2 (PostgreSQL cache)
        if (this.L2_ENABLED) {
            const l2Result = await this.getFromL2(key);
            if (l2Result !== undefined) {
                // Promote to L1
                this.setInL1(key, l2Result);
                return l2Result;
            }
        }

        // Check L3 (Hot data cache)
        if (this.L3_ENABLED) {
            const l3Result = await this.getFromL3(key);
            if (l3Result !== undefined) {
                // Promote to L1 and L2
                this.setInL1(key, l3Result);
                if (this.L2_ENABLED) {
                    await this.setInL2(key, l3Result);
                }
                return l3Result;
            }
        }

        return undefined;
    }

    /**
     * Set value in cache across all tiers
     */
    public async set(key: string, value: T): Promise<void> {
        // Always set in L1
        this.setInL1(key, value);

        // Set in L2 if enabled
        if (this.L2_ENABLED) {
            await this.setInL2(key, value);
        }

        // Set in L3 if it's frequently accessed (heat score > threshold)
        if (this.L3_ENABLED) {
            const heatScore = await this.getHeatScore(key);
            if (heatScore > 0.5) {
                await this.setInL3(key, value);
            }
        }
    }

    /**
     * Get or fetch with deduplication
     */
    public async getOrFetch(
        key: string,
        fetchFn: () => Promise<T>
    ): Promise<T> {
        // Check cache first
        const cached = await this.get(key);
        if (cached !== undefined) {
            return cached;
        }

        // Check for pending request (deduplication)
        if (this.DEDUP_ENABLED) {
            const pending = this.pendingRequests.get(key);
            if (pending && Date.now() - pending.timestamp < this.DEDUP_WINDOW_MS) {
                pending.subscribers++;
                this.stats.deduplication.prevented++;
                logger.debug(`Request deduplicated for key: ${key}`);
                return pending.promise;
            }
        }

        // Create new fetch promise
        const fetchPromise = fetchFn().then(
            async (result) => {
                // Cache the result
                await this.set(key, result);
                return result;
            },
            (error) => {
                // Remove from pending on error
                this.pendingRequests.delete(key);
                throw error;
            }
        );

        // Store as pending
        if (this.DEDUP_ENABLED) {
            this.pendingRequests.set(key, {
                promise: fetchPromise,
                timestamp: Date.now(),
                subscribers: 1
            });
            this.stats.deduplication.active++;

            // Clean up after completion
            void fetchPromise.finally(() => {
                setTimeout(() => {
                    this.pendingRequests.delete(key);
                    this.stats.deduplication.active--;
                }, this.DEDUP_WINDOW_MS);
            });
        }

        return fetchPromise;
    }

    /**
     * Clear cache (all tiers or specific key)
     */
    public async clear(key?: string): Promise<void> {
        if (key) {
            // Clear specific key
            this.l1Cache.delete(key);
            if (this.L2_ENABLED) {
                await this.l2Provider.del(key, this.L2_NAMESPACE);
            }
            if (this.L3_ENABLED) {
                await this.clearFromL3(key);
            }
        } else {
            // Clear all
            this.l1Cache.clear();
            if (this.L2_ENABLED) {
                await this.l2Provider.clear({ namespace: this.L2_NAMESPACE });
            }
            if (this.L3_ENABLED) {
                await this.l2Provider.clear({ namespace: 'comicvine_hot' });
            }
        }
    }

    /**
     * Get cache statistics
     */
    public getStats(): typeof this.stats {
        this.stats.l1.entries = this.l1Cache.size;
        this.stats.l1.size = Array.from(this.l1Cache.values())
            .reduce((sum, entry) => sum + entry.size, 0);
        return { ...this.stats };
    }

    // ============================================================================
    // L1 (Memory) Cache Operations
    // ============================================================================

    private getFromL1(key: string): T | undefined {
        const entry = this.l1Cache.get(key);
        if (entry) {
            // Check TTL
            if (Date.now() - entry.timestamp > this.L1_TTL_MS) {
                this.l1Cache.delete(key);
                return undefined;
            }
            entry.hits++;
            this.stats.l1.hits++;
            logger.debug(`L1 cache hit for key: ${key}`);
            return entry.data;
        }
        this.stats.l1.misses++;
        return undefined;
    }

    private setInL1(key: string, value: T): void {
        // Evict if necessary
        if (this.l1Cache.size >= this.L1_MAX_SIZE) {
            this.evictFromL1();
        }

        const size = JSON.stringify(value).length;
        this.l1Cache.set(key, {
            data: value,
            timestamp: Date.now(),
            hits: 0,
            size
        });
    }

    private evictFromL1(): void {
        // Simple LRU: Remove oldest entry
        const firstKey = this.l1Cache.keys().next().value;
        if (firstKey) {
            this.l1Cache.delete(firstKey);
            this.stats.l1.evictions++;
        }
    }

    // ============================================================================
    // L2 (PostgreSQL) Cache Operations
    // ============================================================================

    private async getFromL2(key: string): Promise<T | undefined> {
        try {
            const result = await this.l2Provider.get<T>(key, this.L2_NAMESPACE, { skipAccessTracking: true });
            if (result !== null) {
                this.stats.l2.hits++;
                logger.debug(`L2 cache hit for key: ${key}`);
                return result;
            }
        } catch (error) {
            logger.error('L2 cache get error:', error);
        }
        this.stats.l2.misses++;
        return undefined;
    }

    private async setInL2(key: string, value: T): Promise<void> {
        try {
            await this.l2Provider.set(key, value, {
                ttl: Math.floor(this.L2_TTL_MS / 1000),
                namespace: this.L2_NAMESPACE,
                tags: ['comicvine']
            });
        } catch (error) {
            logger.error('L2 cache set error:', error);
        }
    }

    // ============================================================================
    // L3 (Hot Data) Cache Operations
    // ============================================================================

    private async getFromL3(key: string): Promise<T | undefined> {
        try {
            // Use hot data cache with heat score tracking
            const result = await this.l2Provider.hget(`hot:${this.L2_NAMESPACE}`, key);
            if (result) {
                this.stats.l3.hits++;
                logger.debug(`L3 cache hit for key: ${key}`);

                // Update heat score
                await this.l2Provider.incr(`heat:${key}`);

                return result as T;
            }
        } catch (error) {
            logger.error('L3 cache get error:', error);
        }
        this.stats.l3.misses++;
        return undefined;
    }

    private async setInL3(key: string, value: T): Promise<void> {
        try {
            // Store in hot data cache
            await this.l2Provider.hset(`hot:${this.L2_NAMESPACE}`, key, value);

            // Initialize heat score
            await this.l2Provider.set(`heat:${key}`, 1, {
                ttl: Math.floor(this.L3_TTL_MS / 1000),
                namespace: 'heat_scores'
            });
        } catch (error) {
            logger.error('L3 cache set error:', error);
        }
    }

    private async clearFromL3(key: string): Promise<void> {
        try {
            await this.l2Provider.hset(`hot:${this.L2_NAMESPACE}`, key, null);
            await cacheProvider.del(`heat:${key}`, 'heat_scores');
        } catch (error) {
            logger.error('L3 cache clear error:', error);
        }
    }

    private async getHeatScore(key: string): Promise<number> {
        try {
            const score = await this.l2Provider.get<number>(`heat:${key}`, 'heat_scores');
            return score ?? 0;
        } catch (_error) {
            return 0;
        }
    }

    /**
     * Batch get values from cache. Checks L1 for all keys, then does a single
     * batched L2 query for misses. Returns a Map of key -> value for hits.
     */
    public async getMany(keys: string[]): Promise<Map<string, T>> {
        const resultMap = new Map<string, T>();
        const l2MissKeys: string[] = [];

        // Check L1 for all keys first
        for (const key of keys) {
            const l1Result = this.getFromL1(key);
            if (l1Result !== undefined) {
                resultMap.set(key, l1Result);
            } else {
                l2MissKeys.push(key);
            }
        }

        // Batch L2 lookup for L1 misses (single DB query via getMany)
        if (this.L2_ENABLED && l2MissKeys.length > 0) {
            try {
                const l2Hits = await this.l2Provider.getMany<T>(l2MissKeys, this.L2_NAMESPACE);
                for (const [key, value] of l2Hits) {
                    resultMap.set(key, value);
                    this.setInL1(key, value); // Promote to L1
                    this.stats.l2.hits++;
                }
                this.stats.l2.misses += l2MissKeys.length - l2Hits.size;
            } catch (error) {
                logger.error('L2 batch cache get error:', error);
                this.stats.l2.misses += l2MissKeys.length;
            }
        }

        return resultMap;
    }

    /**
     * Warm cache with predicted data
     */
    public async warmCache(predictions: Array<{ key: string; value: T }>): Promise<void> {
        logger.info(`Warming cache with ${predictions.length} entries`);

        // Parallel cache warming - independent operations
        await Promise.all(
            predictions.map(({ key, value }) => this.set(key, value))
        );
    }
}