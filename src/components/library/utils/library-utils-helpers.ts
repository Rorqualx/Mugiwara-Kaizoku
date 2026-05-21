/**
 * Helper functions for library filtering and search operations
 * Extracted to reduce complexity of main filtering function
 *
 * @module components/library/utils/library-utils-helpers
 */

import type { Prisma } from '@prisma/client';

// Define manga with relations type using Prisma's generated types
type MangaWithRelations = Prisma.MangaGetPayload<{
  include: {
    Metadata: true;
    Chapter: true;
  };
}>;

/**
 * Check if a value matches a search pattern
 *
 * @param value - The value to check
 * @param query - The search query
 * @param searchPattern - Optional regex pattern
 * @returns Whether the value matches
 */
export function checkFieldMatch(
  value: string | undefined | null,
  query: string,
  searchPattern: RegExp | null
): boolean {
  if (!value) return false;

  if (searchPattern) {
    return searchPattern.test(value);
  }

  return value.toLowerCase().includes(query.toLowerCase());
}

/**
 * Check if title or synonyms match search query
 *
 * @param manga - The manga to check
 * @param checkField - Field check function
 * @returns Whether title matches
 */
export function checkTitleMatch(
  manga: MangaWithRelations,
  checkField: (value: string | undefined | null) => boolean
): boolean {
  if (checkField(manga.title)) return true;

  if (manga.Metadata && Array.isArray(manga.Metadata.synonyms)) {
    return manga.Metadata.synonyms.some(checkField);
  }

  return false;
}

/**
 * Check if authors match search query
 *
 * @param manga - The manga to check
 * @param checkField - Field check function
 * @returns Whether authors match
 */
export function checkAuthorMatch(
  manga: MangaWithRelations,
  checkField: (value: string | undefined | null) => boolean
): boolean {
  return (
    !!manga.Metadata &&
    Array.isArray(manga.Metadata.authors) &&
    manga.Metadata.authors.some(checkField)
  );
}

/**
 * Check if artists match search query
 *
 * @param manga - The manga to check
 * @param checkField - Field check function
 * @returns Whether artists match
 */
export function checkArtistMatch(
  manga: MangaWithRelations,
  checkField: (value: string | undefined | null) => boolean
): boolean {
  return (
    !!manga.Metadata &&
    Array.isArray(manga.Metadata.artists) &&
    manga.Metadata.artists.some(checkField)
  );
}

/**
 * Check if genres match search query
 *
 * @param manga - The manga to check
 * @param checkField - Field check function
 * @returns Whether genres match
 */
export function checkGenreMatch(
  manga: MangaWithRelations,
  checkField: (value: string | undefined | null) => boolean
): boolean {
  return (
    !!manga.Metadata &&
    Array.isArray(manga.Metadata.genres) &&
    manga.Metadata.genres.some(checkField)
  );
}

/**
 * Check if tags match search query
 *
 * @param manga - The manga to check
 * @param checkField - Field check function
 * @returns Whether tags match
 */
export function checkTagMatch(
  manga: MangaWithRelations,
  checkField: (value: string | undefined | null) => boolean
): boolean {
  return (
    !!manga.Metadata &&
    Array.isArray(manga.Metadata.tags) &&
    manga.Metadata.tags.some(checkField)
  );
}

/**
 * Check all fields for a match (used in 'all' search mode)
 *
 * @param manga - The manga to check
 * @param checkField - Field check function
 * @returns Whether any field matches
 */
export function checkAllFieldsMatch(
  manga: MangaWithRelations,
  checkField: (value: string | undefined | null) => boolean
): boolean {
  // Check title
  if (checkField(manga.title)) return true;

  // Check metadata fields if available
  if (!manga.Metadata) return false;

  // Check synonyms
  if (Array.isArray(manga.Metadata.synonyms)) {
    if (manga.Metadata.synonyms.some(checkField)) return true;
  }

  // Check authors
  if (Array.isArray(manga.Metadata.authors)) {
    if (manga.Metadata.authors.some(checkField)) return true;
  }

  // Check artists
  if (Array.isArray(manga.Metadata.artists)) {
    if (manga.Metadata.artists.some(checkField)) return true;
  }

  // Check genres
  if (Array.isArray(manga.Metadata.genres)) {
    if (manga.Metadata.genres.some(checkField)) return true;
  }

  // Check tags
  if (Array.isArray(manga.Metadata.tags)) {
    if (manga.Metadata.tags.some(checkField)) return true;
  }

  return false;
}
