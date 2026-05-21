/**
 * API Cache Service
 * 
 * Provides caching functionality for API responses
 */

interface CacheConfig {
  ttl: number;      // Time to live in milliseconds
  maxSize: number;  // Max cache size in MB
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
  size: number; // Size in bytes
}

/**
 * ApiCache class
 * 
 * Implements LRU cache with TTL for API responses
 */
export class ApiCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly config: CacheConfig;
  private currentSize: number = 0;

  constructor(config: CacheConfig) {
    this.config = config;
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return null;
    }
    
    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const valueStr = JSON.stringify(value);
    const size = Buffer.byteLength(valueStr, 'utf8');
    const maxSizeBytes = this.config.maxSize * 1024 * 1024; // Convert MB to bytes
    
    // Check if value is too large
    if (size > maxSizeBytes) {
      return;
    }
    
    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.delete(key);
    }
    
    // Evict entries if needed
    while (this.currentSize + size > maxSizeBytes && this.cache.size > 0) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.delete(firstKey);
      }
    }
    
    // Add new entry
    const entry: CacheEntry = {
      value,
      expiresAt: Date.now() + (ttl ?? this.config.ttl),
      size,
    };
    
    this.cache.set(key, entry);
    this.currentSize += size;
  }

  /**
   * Delete entry from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    this.currentSize -= entry.size;
    return this.cache.delete(key);
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    entries: number;
    sizeBytes: number;
    sizeMB: number;
    maxSizeMB: number;
    utilization: number;
  } {
    return {
      entries: this.cache.size,
      sizeBytes: this.currentSize,
      sizeMB: this.currentSize / (1024 * 1024),
      maxSizeMB: this.config.maxSize,
      utilization: (this.currentSize / (this.config.maxSize * 1024 * 1024)) * 100,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.delete(key);
      }
    }
  }
}