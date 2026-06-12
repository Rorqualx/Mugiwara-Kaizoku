/**
 * Cached Unified Metadata Parser
 *
 * This file re-exports from the decomposed cached-unified-parser directory
 * for backward compatibility with existing imports.
 *
 * @see ./cached-unified-parser/index.ts for the main implementation
 */

// Re-export everything from the decomposed modules
export type { CachedParseOptions, CacheMetrics } from './cached-unified-parser/types';

export { isRecord, chunk, groupByNamespace } from './cached-unified-parser/utils';

export { CachedUnifiedParser } from './cached-unified-parser/cached-parser';

export { ParserCacheManager } from './cached-unified-parser/cache-management';

// Re-export singleton instances and getter functions
export { cachedParser, cacheManager, getCachedParser, getCacheManager } from './cached-unified-parser';
