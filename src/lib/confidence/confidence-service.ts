/**
 * Confidence Service
 *
 * Singleton service providing cached dynamic confidence calculations.
 * Handles caching with TTL and max size limits for performance.
 *
 * @module lib/confidence/confidence-service
 */

import { calculateDynamicConfidence } from './dynamic-confidence-calculator';
import { DEFAULT_SERVICE_CONFIG } from './types';

import type {
  FieldConfidenceContext,
  DynamicConfidenceResult,
  ConfidenceServiceConfig,
  CachedConfidenceEntry,
} from './types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Simple hash function for values
 */
function hashValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  if (typeof value === 'string') {
    return `s:${value.length}:${value.slice(0, 10)}:${value.slice(-10)}`;
  }

  if (typeof value === 'number') return `n:${value}`;
  if (typeof value === 'boolean') return `b:${value}`;

  if (Array.isArray(value)) {
    return `a:${value.length}:${JSON.stringify(value.slice(0, 3))}`;
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value).sort().slice(0, 5);
    return `o:${keys.join(',')}`;
  }

  return `u:${typeof value}`;
}

/**
 * Generate cache key from context
 */
function generateCacheKey(context: FieldConfidenceContext): string {
  const valueKey = hashValue(context.value);
  return `${context.field}:${context.provider}:${valueKey}`;
}

/**
 * Check if cached entry is still valid
 */
function isCacheValid(entry: CachedConfidenceEntry, ttl: number): boolean {
  return Date.now() - entry.timestamp < ttl;
}

/**
 * Remove expired entries from cache
 */
function removeExpiredEntries(
  cache: Map<string, CachedConfidenceEntry>,
  ttl: number
): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp >= ttl) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach(key => cache.delete(key));
}

/**
 * Remove oldest entries to fit max size
 */
function removeOldestEntries(
  cache: Map<string, CachedConfidenceEntry>,
  maxSize: number
): void {
  if (cache.size <= maxSize) return;

  const entries = [...cache.entries()]
    .sort((a, b) => a[1].timestamp - b[1].timestamp);

  const toRemove = entries.slice(0, cache.size - maxSize);
  toRemove.forEach(([key]) => cache.delete(key));
}

/**
 * Empty result for null/undefined values
 */
function getEmptyResult(): DynamicConfidenceResult {
  return {
    confidence: 0,
    signals: {
      fieldCompleteness: 0,
      contentQuality: 0,
      providerBase: 0,
      dataConsistency: 0,
      richDataScore: 0,
    },
  };
}

// ============================================================================
// Confidence Service Class
// ============================================================================

/**
 * Singleton service for confidence calculations with caching
 */
class ConfidenceService {
  private cache: Map<string, CachedConfidenceEntry>;
  private config: ConfidenceServiceConfig;

  constructor(config: ConfidenceServiceConfig = DEFAULT_SERVICE_CONFIG) {
    this.cache = new Map();
    this.config = config;
  }

  /**
   * Prune expired and excess cache entries
   */
  private pruneCache(): void {
    removeExpiredEntries(this.cache, this.config.cacheTTL);
    removeOldestEntries(this.cache, this.config.maxCacheSize);
  }

  /**
   * Calculate confidence with full result breakdown
   */
  calculate(context: FieldConfidenceContext): DynamicConfidenceResult {
    if (context.value === null || context.value === undefined) {
      return getEmptyResult();
    }

    const cacheKey = generateCacheKey(context);

    // Check cache (only when no allProviderData, as that affects consistency)
    if (!context.allProviderData) {
      const cached = this.cache.get(cacheKey);
      if (cached && isCacheValid(cached, this.config.cacheTTL)) {
        return cached.result;
      }
    }

    // Calculate new result
    const result = calculateDynamicConfidence(context, this.config.weights);

    // Cache result (only when no allProviderData)
    if (!context.allProviderData) {
      this.cache.set(cacheKey, { result, timestamp: Date.now() });

      // Periodic pruning at 110% capacity
      if (this.cache.size > this.config.maxCacheSize * 1.1) {
        this.pruneCache();
      }
    }

    return result;
  }

  /**
   * Get just the confidence number (backwards compatible)
   */
  getConfidence(field: string, value: unknown, provider: string): number {
    const context: FieldConfidenceContext = { field, value, provider };
    return this.calculate(context).confidence;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Update service configuration
   */
  updateConfig(newConfig: Partial<ConfidenceServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.weights) {
      this.config.weights = { ...this.config.weights, ...newConfig.weights };
    }
  }

  /**
   * Get current cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; ttl: number } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
      ttl: this.config.cacheTTL,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let serviceInstance: ConfidenceService | null = null;

/**
 * Get the singleton confidence service instance
 */
export function getConfidenceService(): ConfidenceService {
  serviceInstance ??= new ConfidenceService();
  return serviceInstance;
}

/**
 * Create a new confidence service with custom config (for testing)
 */
export function createConfidenceService(config?: ConfidenceServiceConfig): ConfidenceService {
  return new ConfidenceService(config);
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetConfidenceService(): void {
  serviceInstance = null;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Simple function to get confidence for a field value
 * Returns 0-100 score
 */
export function getFieldConfidence(field: string, value: unknown, provider: string): number {
  return getConfidenceService().getConfidence(field, value, provider);
}

/**
 * Calculate confidence with full breakdown
 */
export function calculateConfidence(context: FieldConfidenceContext): DynamicConfidenceResult {
  return getConfidenceService().calculate(context);
}
