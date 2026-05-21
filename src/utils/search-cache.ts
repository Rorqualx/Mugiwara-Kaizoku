/**
 * Simple search cache implementation
 */

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

class SearchCache {
  private cache: Map<string, CacheEntry> = new Map();
  private ttl: number = 5 * 60 * 1000; // 5 minutes default

  constructor(ttl?: number) {
    if (ttl !== undefined) this.ttl = ttl;
  }

  get(key: string): unknown | null {
    const entry = this.cache.get(key);
    if (entry === undefined) return null;

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: unknown): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry === undefined) return false;

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }
}

export const searchCache = new SearchCache();
export const getSearchCache = (): SearchCache => searchCache;
export default SearchCache;