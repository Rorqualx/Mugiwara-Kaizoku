/**
 * Type Adapters - Main Aggregator
 *
 * This module aggregates all type adapter functionality into a unified API.
 * Provides backward-compatible exports for existing code.
 *
 * Architecture:
 * - utils.ts - Foundation utilities (19 exports: 3 types, 1 enum, 15 functions)
 * - manga-search-result-adapter.ts - MangaSearchResult adapter (1 function)
 * - search-result-adapter.ts - SearchResult adapter (1 function)
 * - provider-data-extractor.ts - Provider-specific extraction (1 function)
 * - index.ts - Main aggregator & dispatcher (1 function + re-exports)
 *
 * Total: 23 exports across 5 modules
 * Original: 549 lines, 1 file → Refactored: 5 files (organized & maintainable)
 *
 * Complexity Fixes:
 * - adaptMangaSearchResult: 41 → <20 ✅
 * - adaptSearchResult: 29 → <20 ✅
 * - extractProviderData: 26 → <20 ✅ (refactored to provider-specific extractors)
 */

// ============================================================================
// Re-export Types and Utilities
// ============================================================================

export type {
  UnifiedSearchResult,
  ProviderSpecificData,
  PartialUnifiedMetadata,
} from './utils';

export { MangaFormat } from './utils';

// Re-export helper functions (for advanced use)
export {
  extractCoverUrl,
  extractDescription,
  extractAlternativeTitles,
  extractStatus,
  extractFormat,
  extractNumber,
  extractString,
  extractAuthors,
  extractArtists,
  extractGenres,
  extractTags,
  extractDate,
  parseDate,
  mapStatus,
  mapFormat,
} from './utils';

// ============================================================================
// Re-export Adapter Functions
// ============================================================================

export { adaptMangaSearchResult } from './manga-search-result-adapter';
export { adaptSearchResult } from './search-result-adapter';
export { extractProviderData } from './provider-data-extractor';

// ============================================================================
// Unified Adapter Dispatcher
// ============================================================================

import type { ExtendedMangaSearchResult, SearchResult } from '@/types/search.types';

import { adaptMangaSearchResult } from './manga-search-result-adapter';
import { adaptSearchResult } from './search-result-adapter';

import type { UnifiedSearchResult } from './utils';

/**
 * Adapt any search result type to UnifiedSearchResult
 *
 * This is the main entry point for type adaptation. It automatically
 * detects the result structure and uses the appropriate adapter.
 *
 * Detection Strategy:
 * 1. If already has provider/title/id fields → return as-is
 * 2. If has "metadata" field → use MangaSearchResult adapter
 * 3. If has "cover" or "description" fields → use SearchResult adapter
 * 4. Fallback → try MangaSearchResult adapter
 *
 * @param result - The search result to adapt (any supported type)
 * @param source - Optional provider source override
 * @returns Unified search result
 *
 * @example
 * ```typescript
 * // Auto-detection
 * const unified = adaptToUnifiedSearchResult(rawResult);
 *
 * // With provider override
 * const unified = adaptToUnifiedSearchResult(rawResult, 'anilist');
 * ```
 */
export function adaptToUnifiedSearchResult(
  result: unknown,
  source?: string
): UnifiedSearchResult {
  const resultObj = result as Record<string, unknown>;

  // If already has required fields, try to return as-is
  if (resultObj['provider'] && resultObj['title'] && resultObj['id']) {
    return result as UnifiedSearchResult;
  }

  // Check which adapter to use based on structure
  if (resultObj['metadata'] && typeof resultObj['metadata'] === 'object') {
    // Has metadata field - use MangaSearchResult adapter
    return adaptMangaSearchResult(
      result as ExtendedMangaSearchResult & Record<string, unknown>,
      source
    );
  } else if (
    (resultObj['cover'] ?? resultObj['coverImage']) ||
    resultObj['description'] !== undefined
  ) {
    // Has direct properties - use SearchResult adapter
    return adaptSearchResult(result as SearchResult & Record<string, unknown>, source);
  }

  // Fallback: try to adapt as MangaSearchResult
  return adaptMangaSearchResult(
    result as ExtendedMangaSearchResult & Record<string, unknown>,
    source
  );
}
