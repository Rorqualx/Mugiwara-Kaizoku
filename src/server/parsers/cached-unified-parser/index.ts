/**
 * Cached Unified Parser - Main Aggregator
 *
 * This module aggregates all cached parser functionality into a single
 * unified export. Provides PostgreSQL caching for the UnifiedMetadataParser.
 *
 * Architecture:
 * - types.ts - Type definitions (CachedParseOptions, CacheMetrics)
 * - utils.ts - Shared utilities (isRecord, chunk, groupByNamespace)
 * - cached-parser.ts - Main CachedUnifiedParser class
 * - cache-management.ts - ParserCacheManager class
 */

// Re-export types
export type { CachedParseOptions, CacheMetrics } from './types';

// Re-export utilities
export { isRecord, chunk, groupByNamespace } from './utils';

// Re-export main parser class
export { CachedUnifiedParser } from './cached-parser';

// Re-export cache management
export { ParserCacheManager } from './cache-management';

// Lazy singleton instances to avoid circular dependency issues
import { ParserCacheManager } from './cache-management';
import { CachedUnifiedParser } from './cached-parser';

let _cachedParser: CachedUnifiedParser | undefined;
let _cacheManager: ParserCacheManager | undefined;

/**
 * Get the cached parser singleton instance (lazy initialization)
 */
export function getCachedParser(): CachedUnifiedParser {
  _cachedParser ??= new CachedUnifiedParser();
  return _cachedParser;
}

/**
 * Get the cache manager singleton instance (lazy initialization)
 */
export function getCacheManager(): ParserCacheManager {
  _cacheManager ??= new ParserCacheManager();
  return _cacheManager;
}

/**
 * Default cached parser instance (lazy getter for backward compatibility)
 */
export const cachedParser = {
  get instance(): CachedUnifiedParser {
    return getCachedParser();
  }
};

/**
 * Default cache manager instance (lazy getter for backward compatibility)
 */
export const cacheManager = {
  get instance(): ParserCacheManager {
    return getCacheManager();
  }
};
