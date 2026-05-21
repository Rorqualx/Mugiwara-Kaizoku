/**
 * Type definitions for FandomProvider
 *
 * Contains specialized types used for transforming Fandom API responses
 * into standardized SearchResult format.
 */

import type { SearchResult } from '@/types/search.types';

/**
 * Extended search result with optional metadata properties
 */
export interface ExtendedSearchResult {
  id?: string;
  title?: string;
  alternativeTitles?: string[];
  author?: string;
  artist?: string;
  authors?: string[];
  artists?: string[];
  publisher?: string;
  magazine?: string;
  demographic?: string;
  published?: string;
  genres?: string[];
  chapters?: number | string;
  volumes?: number | string;
  volumesListUrl?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Extended metadata with enhanced properties from Fandom API
 */
export interface ExtendedMetadata {
  description?: string;
  synopsis?: string;
  coverImage?: string;
  gallery?: string[];
  status?: string;
  format?: string;
  published?: string;
  startDate?: string;
  endDate?: string;
  author?: string;
  artist?: string;
  authors?: string[];
  artists?: string[];
  alternativeTitles?: string[];
  volumes?: string | number;
  chapters?: string | number;
  volumesListUrl?: string;
  publisher?: string;
  magazine?: string;
  demographic?: string;
  genres?: string[];
}

/**
 * Base result type for manga transformation
 */
export interface BaseResultType {
  id: string;
  title: string;
  alternativeTitles: string[];
  description: string;
  coverImage: string;
  status: string;
  format: string;
  genres: string[];
  provider: string;
  providerUrl: string;
  wikiUrl: string;
  url: string;
  metadata: {
    wiki: string;
    wikiKey: string;
    publisher: string | undefined;
    magazine: string | undefined;
    gallery: string[];
    demographic: string | undefined;
    description: string | undefined;
    synopsis: string | undefined;
    author: string | undefined;
    authors: string[];
    characterCount: number | undefined;
  };
  author?: string;
  year?: number;
  chapters?: number;
  volumes?: number;
}

/**
 * Parameters for building search result metadata
 */
export interface BuildMetadataParams {
  wikiKey: string;
  wikiName: string;
  synopsis: string;
  description: string;
  volumes: number | null;
  chapters: number | null;
  authorArtistArrays: { authors: string[]; artists: string[] };
  meta: ExtendedMetadata | undefined;
  resultAny: ExtendedSearchResult;
}

/**
 * Type guard for SearchResult
 */
export function isSearchResult(value: unknown): value is SearchResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    'id' in candidate &&
    'title' in candidate &&
    typeof candidate['id'] === 'string' &&
    typeof candidate['title'] === 'string'
  );
}
