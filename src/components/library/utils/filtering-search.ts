/**
 * Search Operations Module
 *
 * Handles field value extraction and search operations with regex support.
 *
 * Extracted from: filtering.ts (lines 97-147)
 */

import type { MangaWithMetadata, SearchField } from './filtering-utils';

// ============================================================================
// Helper Functions for Complexity Reduction
// ============================================================================

/**
 * Get title-related values for search
 */
function getTitleValues(manga: MangaWithMetadata): string[] {
  const titles = [manga.title];
  if (manga.Metadata?.synonyms) {
    titles.push(...manga.Metadata.synonyms);
  }
  return titles.filter(Boolean);
}

/**
 * Get all field values for comprehensive search
 */
function getAllFieldValues(manga: MangaWithMetadata): string[] {
  return [
    manga.title,
    ...(manga.Metadata?.synonyms ?? []),
    ...(manga.Metadata?.authors ?? []),
    ...(manga.Metadata?.artists ?? []),
    ...(manga.Metadata?.genres ?? []),
    ...(manga.Metadata?.tags ?? []),
  ].filter(Boolean);
}

/**
 * Perform regex search with fallback
 */
function performRegexSearch(query: string, values: string[]): boolean {
  try {
    const regex = new RegExp(query, 'i');
    return values.some(value => regex.test(value));
  } catch (_error: unknown) {
    // Invalid regex, fall back to normal search
    const lowerQuery = query.toLowerCase();
    return values.some(value => value.toLowerCase().includes(lowerQuery));
  }
}

/**
 * Perform normal case-insensitive search
 */
function performNormalSearch(query: string, values: string[]): boolean {
  const lowerQuery = query.toLowerCase();
  return values.some(value => value.toLowerCase().includes(lowerQuery));
}

// ============================================================================
// Main Search Functions
// ============================================================================

/**
 * Get field-specific values for search
 */
export function getFieldValues(manga: MangaWithMetadata, field: SearchField): string[] {
  switch (field) {
    case 'title':
      return getTitleValues(manga);
    case 'author':
      return manga.Metadata?.authors ?? [];
    case 'artist':
      return manga.Metadata?.artists ?? [];
    case 'genre':
      return manga.Metadata?.genres ?? [];
    case 'tag':
      return manga.Metadata?.tags ?? [];
    case 'all':
    default:
      return getAllFieldValues(manga);
  }
}

/**
 * Perform search with regex support
 */
export function performSearch(query: string, values: string[], enableRegex: boolean): boolean {
  if (!query) return true;

  if (enableRegex) {
    return performRegexSearch(query, values);
  } else {
    return performNormalSearch(query, values);
  }
}