/**
 * Search Router Utilities Module
 *
 * Shared helper functions, type definitions, and validation schemas
 * used across all search modules.
 *
 * Includes deduplication helpers to eliminate ~220 lines of repeated code.
 *
 * Extracted from: search.ts (lines 1-98 + new helpers)
 */

import { SortCriteria, SortOrder } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { hotCacheProvider } from '@/server/cache/HotDataCacheProvider';
import { cacheProvider } from '@/server/cache/UnifiedCacheProvider';
import type { SearchOptions } from '@/types/search.types';
import { safeStringOrUndefined } from '@/utils/error-handling';
import { logger } from '@/utils/logging';
import { isObject, hasProperty } from '@/utils/type-guards';


// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Input type for search procedures
 * With exactOptionalPropertyTypes: true, optional properties must include | undefined
 * Contains only the fields needed for extractSearchOptions
 */
export interface SearchInput {
  limit?: number | undefined;
  offset?: number | undefined;
  sortBy?: SortCriteria | string | undefined;
  sortOrder?: SortOrder | string | undefined;
  includeAdult?: boolean | undefined;
}

/**
 * Options for cached search execution
 */
export interface CachedSearchOptions<T> {
  cacheKey: string;
  query: string;
  tags: string[];
  apiCall: () => Promise<T>;
}

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Create enum validation schema for SortCriteria
 */
export const sortCriteriaSchema = z.enum(Object.values(SortCriteria) as [
  string,
  ...string[]
]);

/**
 * Create enum validation schema for SortOrder
 */
export const sortOrderSchema = z.enum(Object.values(SortOrder) as [
  string,
  ...string[]
]);

// ============================================================================
// Helper Functions - Existing
// ============================================================================

/**
 * Safely gets a property value from an unknown object
 *
 * @param obj - Object to get property from
 * @param prop - Property name
 * @returns Property value or undefined
 */
export function safeGet(obj: unknown, prop: string): unknown {
  if (!isObject(obj) || !hasProperty(obj, prop)) {
    return undefined;
  }
  return obj[prop];
}

/**
 * Get display name for a provider
 *
 * @param providerId - Provider ID
 * @returns Display name for the provider
 */
export function getProviderDisplayName(providerId: string): string {
  const displayNames: Record<string, string> = {
    'ANILIST': 'AniList',
    'anilist': 'AniList',
    'COMICVINE': 'ComicVine',
    'comicvine': 'ComicVine',
    'FANDOM': 'Fandom',
    'fandom': 'Fandom',
    'WIKIPEDIA': 'Wikipedia',
    'wikipedia': 'Wikipedia',
    'PROWLARR': 'Prowlarr',
    'prowlarr': 'Prowlarr',
    'MANGADEX': 'MangaDex',
    'mangadex': 'MangaDex'
  };
  return displayNames[providerId] ?? providerId;
}

/**
 * Generate a cache key for search queries
 * Includes all search parameters to ensure correct cache hits
 *
 * @param provider - Provider ID or 'all' for multi-provider searches
 * @param query - Search query string
 * @param options - Search options (limit, page, sort, etc.)
 * @returns Cache key string
 */
export function generateSearchCacheKey(provider: string, query: string, options: SearchOptions): string {
  // Normalize query to lowercase for case-insensitive caching
  const normalizedQuery = query.toLowerCase().trim();
  // Build cache key with all relevant parameters
  const keyParts = [
    `search`,
    provider,
    normalizedQuery,
    options.limit ?? 'default',
    options.page ?? '1',
    options.sort ?? 'none',
    options.order ?? 'none',
    options.includeAdult ? 'adult' : 'safe'
  ];
  return keyParts.join(':');
}

// ============================================================================
// Helper Functions - NEW Deduplication Helpers
// ============================================================================

/**
 * Extract and normalize search options from input
 * Eliminates duplication across 4 search procedures
 *
 * @param input - Raw search input with optional parameters (accepts extra properties)
 * @returns Normalized SearchOptions object
 */
export function extractSearchOptions(input: Partial<SearchInput> & Record<string, unknown>): SearchOptions {
  const options: SearchOptions = {};
  if (input.limit !== undefined) options.limit = input.limit as number;
  if (input.offset !== undefined) {
    options.page = Math.floor((input.offset as number) / ((input.limit as number | undefined) ?? 10)) + 1;
  }
  if (input.sortBy !== undefined) options.sort = input.sortBy as SortCriteria;
  if (input.sortOrder !== undefined) options.order = input.sortOrder as SortOrder;
  if (input.includeAdult !== undefined) options.includeAdult = input.includeAdult as boolean;
  return options;
}

/**
 * Execute search with two-tier cache (hot + regular)
 * Eliminates cache pattern duplication across 4 procedures
 *
 * Uses hot cache (fast, database-backed) with fallback to regular cache (persistent).
 * Note: The tRPC middleware also caches at the procedure level using ctx.req.query.input
 * as part of the cache key, ensuring different queries get different cached responses.
 *
 * @param options - Cache execution options
 * @returns Search results from cache or API
 */
export async function executeCachedSearch<T>(
  options: CachedSearchOptions<T>
): Promise<T> {
  const { cacheKey, query, tags, apiCall } = options;

  // Try hot cache first (fastest, database UNLOGGED table)
  const hotCached = await hotCacheProvider.getHot<T>('search', cacheKey);
  if (hotCached) {
    logger.debug(`Hot cache hit for search: ${query}`);
    return hotCached;
  }

  // Try regular cache (persistent, slower)
  const cached = await cacheProvider.get(cacheKey);
  if (cached) {
    logger.debug(`Cache hit for search: ${query}`);
    // Promote to hot cache for subsequent requests
    void hotCacheProvider.setHot('search', cacheKey, cached, { ttl: 60, tags }); // 60 second hot cache
    return cached as T;
  }

  // Cache miss - call API
  logger.debug(`Cache miss for search: ${query}`);
  const results = await apiCall();

  // Store in both caches
  void hotCacheProvider.setHot('search', cacheKey, results, { ttl: 60, tags }); // 60 second hot cache
  await cacheProvider.set(cacheKey, results, { ttl: 300, tags }); // 5 minute persistent cache

  return results;
}

/**
 * Standardized error handling for search procedures
 * Eliminates error handling duplication
 *
 * @param error - Error object or unknown error
 * @param procedureName - Name of the procedure that failed
 * @throws TRPCError with standardized error message
 */
export function handleSearchError(error: unknown, procedureName: string): never {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error(`Error in search.${procedureName}:`, safeStringOrUndefined(errorMessage) ?? 'Unknown error');
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: `Search failed: ${errorMessage}`,
  });
}
