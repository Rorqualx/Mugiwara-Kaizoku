/**
 * Search Core Router Types
 *
 * Type definitions for search core router modules.
 *
 * Extracted from: core.ts (lines 18-23)
 */

import type {
  SearchResult,
  ProviderErrorInfo,
  SearchResponseWithErrors,
  MangaSearchResult,
} from '@/types/search.types';

/**
 * Re-export types for internal use
 */
export type {
  SearchResult,
  ProviderErrorInfo,
  SearchResponseWithErrors,
  MangaSearchResult,
};

/**
 * First search result for debug logging
 */
export interface FirstResultDebugInfo {
  title?: string;
  description?: string;
  genres?: string[];
  authors?: unknown;
  artists?: unknown;
  volumes?: number | null;
  chapters?: number | null;
  metadata?: unknown;
  id?: string;
  [key: string]: unknown;
}
