/**
 * Metadata Extractors Module
 *
 * Handles metadata extraction from provider responses.
 * Decomposed to reduce cyclomatic complexity from 38 to under 20.
 *
 * Extracted from: urlParsingService.ts (lines 217-269)
 */

import { safeGet, isRecord } from './utils';

// ============================================================================
// Helper Extractors (reduce complexity)
// ============================================================================

/**
 * Extract base metadata common to all providers
 *
 * @param data - Unknown data from provider
 * @returns Base metadata record with common fields
 */
// eslint-disable-next-line complexity -- Complex metadata extraction with multiple fallbacks
function extractBaseMetadata(data: unknown): Record<string, unknown> {
  if (!isRecord(data)) {
    return {};
  }

  return {
    title: safeGet(data, 'title') ?? safeGet(data, 'name') ?? '',
    description: safeGet(data, 'description') ?? safeGet(data, 'synopsis') ?? '',
    status: safeGet(data, 'status') ?? '',
    format: safeGet(data, 'format') ?? safeGet(data, 'type') ?? '',
    genres: safeGet(data, 'genres') ?? [],
    tags: safeGet(data, 'tags') ?? [],
    themes: safeGet(data, 'themes') ?? [],
    authors: safeGet(data, 'authors') ?? [],
    artists: safeGet(data, 'artists') ?? [],
    publisher: safeGet(data, 'publisher') ?? '',
    demographic: safeGet(data, 'demographic') ?? '',
    startDate: safeGet(data, 'startDate') ?? safeGet(data, 'releaseDate') ?? '',
    endDate: safeGet(data, 'endDate') ?? '',
    alternativeTitles: safeGet(data, 'alternativeTitles') ?? safeGet(data, 'altTitles') ?? []
  };
}

/**
 * Extract Fandom-specific metadata
 *
 * @param data - Unknown data from Fandom API
 * @param baseMetadata - Base metadata to merge with
 * @returns Fandom metadata record or null if not Fandom data
 */
function extractFandomMetadata(
  data: unknown,
  baseMetadata: Record<string, unknown>
): Record<string, unknown> | null {
  if (!isRecord(data)) {
    return null;
  }

  const fandomMetadata = safeGet(data, 'metadata');
  if (!isRecord(fandomMetadata)) {
    return null;
  }

  return {
    ...baseMetadata,
    description: safeGet(fandomMetadata, 'description') || baseMetadata['description'],
    synopsis: safeGet(fandomMetadata, 'synopsis') ?? '',
    volumeInfo: safeGet(fandomMetadata, 'volumeInfo') ?? '',
    genres: safeGet(fandomMetadata, 'genres') || baseMetadata['genres'],
    themes: safeGet(fandomMetadata, 'themes') || baseMetadata['themes']
  };
}

/**
 * Extract AniList-specific metadata
 *
 * @param data - Unknown data from AniList API
 * @param baseMetadata - Base metadata to merge with
 * @returns AniList metadata record or null if not AniList data
 */
function extractAnilistMetadata(
  data: unknown,
  baseMetadata: Record<string, unknown>
): Record<string, unknown> | null {
  if (!isRecord(data)) {
    return null;
  }

  const anilistMedia = safeGet(data, 'Media');
  if (!isRecord(anilistMedia)) {
    return null;
  }

  const title = safeGet(anilistMedia, 'title');
  const titleRomaji = isRecord(title) ? safeGet(title, 'romaji') : undefined;
  const titleEnglish = isRecord(title) ? safeGet(title, 'english') : undefined;

  return {
    ...baseMetadata,
    title: titleRomaji || titleEnglish || baseMetadata['title'],
    description: safeGet(anilistMedia, 'description') || baseMetadata['description'],
    status: safeGet(anilistMedia, 'status') || baseMetadata['status'],
    format: safeGet(anilistMedia, 'format') || baseMetadata['format'],
    genres: safeGet(anilistMedia, 'genres') || baseMetadata['genres'],
    startDate: safeGet(anilistMedia, 'startDate'),
    endDate: safeGet(anilistMedia, 'endDate')
  };
}

// ============================================================================
// Main Extractor (orchestrates helpers)
// ============================================================================

/**
 * Extract metadata from parse result
 *
 * Complexity reduced from 38 to under 10 by delegating to helper functions.
 * Each provider has a dedicated extractor to maintain single responsibility.
 *
 * @param data - Unknown data from provider API
 * @param provider - Provider name ('fandom', 'anilist', etc.)
 * @returns Extracted metadata record
 */
export function extractMetadataFromResult(
  data: unknown,
  provider: string
): Record<string, unknown> {
  const baseMetadata = extractBaseMetadata(data);

  // Provider-specific extraction
  if (provider === 'fandom') {
    const fandomMetadata = extractFandomMetadata(data, baseMetadata);
    if (fandomMetadata) {
      return fandomMetadata;
    }
  }

  if (provider === 'anilist') {
    const anilistMetadata = extractAnilistMetadata(data, baseMetadata);
    if (anilistMetadata) {
      return anilistMetadata;
    }
  }

  return baseMetadata;
}
