/**
 * Field Extraction Utilities for Library Search
 *
 * Provides specialized functions for extracting searchable values
 * from manga metadata based on field type.
 *
 * @module components/library/search/field-extractors
 */

import type { SearchField } from '@/store/libraryViewSlice';

import type { Prisma } from '@prisma/client';


/**
 * Manga with metadata included
 */
type MangaWithMetadata = Prisma.MangaGetPayload<{
  include: {
    Metadata: true;
    Chapter: true;
  };
}>;

/**
 * Extract title values including synonyms
 */
function extractTitleValues(manga: MangaWithMetadata): string[] {
  const titles: string[] = [manga.title];

  if (manga.Metadata?.synonyms) {
    titles.push(...manga.Metadata.synonyms);
  }

  return titles.filter(Boolean);
}

/**
 * Extract author values
 */
function extractAuthorValues(manga: MangaWithMetadata): string[] {
  return manga.Metadata?.authors ?? [];
}

/**
 * Extract artist values
 */
function extractArtistValues(manga: MangaWithMetadata): string[] {
  return manga.Metadata?.artists ?? [];
}

/**
 * Extract genre values
 */
function extractGenreValues(manga: MangaWithMetadata): string[] {
  return manga.Metadata?.genres ?? [];
}

/**
 * Extract tag values
 */
function extractTagValues(manga: MangaWithMetadata): string[] {
  return manga.Metadata?.tags ?? [];
}

/**
 * Extract all searchable values
 */
function extractAllValues(manga: MangaWithMetadata): string[] {
  return [
    manga.title,
    ...(manga.Metadata?.synonyms ?? []),
    ...(manga.Metadata?.authors ?? []),
    ...(manga.Metadata?.artists ?? []),
    ...(manga.Metadata?.genres ?? []),
    ...(manga.Metadata?.tags ?? [])
  ].filter(Boolean);
}

/**
 * Field extractor function mapping
 */
const FIELD_EXTRACTORS: Record<
  SearchField,
  (manga: MangaWithMetadata) => string[]
> = {
  title: extractTitleValues,
  author: extractAuthorValues,
  artist: extractArtistValues,
  genre: extractGenreValues,
  tag: extractTagValues,
  all: extractAllValues,
};

/**
 * Get searchable values for a specific field
 *
 * @param manga - Manga with metadata
 * @param field - Search field type
 * @returns Array of searchable string values
 */
export function getFieldValues(
  manga: MangaWithMetadata,
  field: SearchField
): string[] {
  const extractor = FIELD_EXTRACTORS[field];
  return extractor(manga);
}
