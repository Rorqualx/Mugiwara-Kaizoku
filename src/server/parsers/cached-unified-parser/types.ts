/**
 * Type Definitions for Cached Unified Parser
 *
 * Shared type definitions and interfaces for cached parsing operations.
 * Extracted from: CachedUnifiedParser.ts
 */

import type { ParseOptions } from '../UnifiedMetadataParser';

/**
 * Extended parse options with caching support
 */
export interface CachedParseOptions extends ParseOptions {
  html?: string;
  url?: string;
  useCache?: boolean;
  cacheTTL?: number;
  cacheNamespace?: string;
  forceRefresh?: boolean;
  extractTables?: boolean;
  extractImages?: boolean;
  extractMetadata?: boolean;
  // Provider options
  provider?: string;
}

/**
 * Metrics for cache performance monitoring
 */
export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  avgParseTime: number;
  avgCacheTime: number;
  totalSize: number;
}

