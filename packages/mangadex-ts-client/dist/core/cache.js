"use strict";
/**
 * In-memory TTL cache with LRU eviction
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TTLCache = void 0;
const cache_1 = require("../types/cache");
class TTLCache {
    store = new Map();
    config;
    constructor(config) {
        this.config = { ...cache_1.DEFAULT_CACHE_CONFIG, ...config };
    }
    get(key) {
        if (!this.config.enabled)
            return undefined;
        const entry = this.store.get(key);
        if (!entry)
            return undefined;
        // Check expiration
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }
        // Update LRU access time
        entry.lastAccessed = Date.now();
        return entry.value;
    }
    set(key, value) {
        if (!this.config.enabled)
            return;
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
    has(key) {
        const val = this.get(key); // triggers expiration check
        return val !== undefined;
    }
    delete(key) {
        return this.store.delete(key);
    }
    clear() {
        this.store.clear();
    }
    get size() {
        return this.store.size;
    }
    evictLRU() {
        let oldestKey;
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
exports.TTLCache = TTLCache;
//# sourceMappingURL=cache.js.map