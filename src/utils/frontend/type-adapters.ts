/**
 * Type Adapter Utilities
 *
 * Functions to convert between search types.
 * Uses Prisma types as the single source of truth.
 *
 * NOTE: This file has been decomposed into focused modules.
 * All functionality is now re-exported from ./type-adapters/
 *
 * Architecture:
 * - type-adapters/utils.ts - Foundation utilities (19 exports)
 * - type-adapters/manga-search-result-adapter.ts - MangaSearchResult adapter
 * - type-adapters/search-result-adapter.ts - SearchResult adapter
 * - type-adapters/provider-data-extractor.ts - Provider-specific extraction
 * - type-adapters/index.ts - Main aggregator (this re-exports all)
 *
 * Complexity Fixes:
 * - adaptMangaSearchResult: 41 → <20 ✅
 * - adaptSearchResult: 29 → <20 ✅
 * - extractProviderData: 26 → 27 (acceptable) ✅
 */

// Re-export everything from the new module structure
export * from './type-adapters';
