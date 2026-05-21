/**
 * Provider Matching - Metadata Operations
 *
 * Handles metadata merging and enrichment across multiple providers.
 * Includes intelligent priority-based merging and deduplication.
 *
 * Complexity fixes:
 * - mergeMatchMetadata: Split from single function (complexity 27) into 5 functions (max complexity 8)
 *
 * Extracted from: providerMatchingService.ts (lines 274-331, 433-516)
 * Date: 2025-11-21
 *
 * @module provider-matching/metadata-operations
 */

import type { MangaMetadata } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess, isError } from '@/utils/async-result';
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';

import {
  type MetadataWithProvider,
  type ProviderMatchingServiceConfig,
  type CrossProviderMatchResult,
  PROVIDER_PRIORITY,
} from './types-and-utils';

import type { MetadataService } from '../metadataService';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Matcher interface with cross-provider matching support
 */
export interface MatcherWithCrossProvider {
  findCrossProviderMatches(
    title: string,
    options: { providers?: string[]; limit?: number }
  ): Promise<AsyncResult<CrossProviderMatchResult, Error>>;
}

// ============================================================================
// Internal Helper Functions (not exported)
// ============================================================================

/**
 * Sort metadata list by provider priority
 *
 * Arranges metadata items based on provider priority order, with higher priority
 * providers appearing first. Unknown providers are placed at the end.
 *
 * @param metadataList - List of metadata with provider information
 * @param providerPriority - Priority order for providers
 * @returns Sorted list with highest priority first
 */
function sortByProviderPriority(
  metadataList: MetadataWithProvider[],
  providerPriority: readonly string[]
): MetadataWithProvider[] {
  return [...metadataList].sort((a, b) => {
    const aPriority = providerPriority.indexOf(a.provider.toLowerCase());
    const bPriority = providerPriority.indexOf(b.provider.toLowerCase());
    // If not in priority list, put at end (999)
    const aIndex = aPriority === -1 ? 999 : aPriority;
    const bIndex = bPriority === -1 ? 999 : bPriority;
    return aIndex - bIndex;
  });
}

/**
 * Initialize merged metadata object with Sets for collecting unique values
 *
 * Creates a mutable copy of the base metadata and initializes Sets for
 * array fields to enable deduplication during merging.
 *
 * @param baseMetadata - Base metadata to start with
 * @returns Merged object and collection Sets
 */
function initializeMergedMetadata(baseMetadata: MangaMetadata): {
  merged: MangaMetadata;
  authors: Set<string>;
  artists: Set<string>;
  genres: Set<string>;
  tags: Set<string>;
  alternativeTitles: Set<string>;
} {
  const merged: MangaMetadata = { ...baseMetadata };

  // Initialize Sets from existing arrays (use ?? for proper array fallback)
  const authors = new Set<string>((merged.authors as string[] | undefined) ?? []);
  const artists = new Set<string>(merged.artists ?? []);
  const genres = new Set<string>((merged.genres as string[] | undefined) ?? []);
  const tags = new Set<string>((merged.tags as string[] | undefined) ?? []);
  const alternativeTitles = new Set<string>((merged.alternativeTitles as string[] | undefined) ?? []);

  return { merged, authors, artists, genres, tags, alternativeTitles };
}

/**
 * Merge scalar fields (description, coverUrl, year, etc.) from source into target
 *
 * Only fills in missing fields, doesn't overwrite existing values.
 * Uses a priority-based approach where earlier metadata takes precedence.
 * Returns a new object instead of mutating the parameter.
 *
 * @param target - Target metadata object
 * @param source - Source metadata to merge from
 * @returns New metadata object with merged fields
 */
function mergeScalarFields(target: MangaMetadata, source: MangaMetadata): MangaMetadata {
  const result: MangaMetadata = {
    ...target,
  };

  if (target.description !== undefined || source.description !== undefined) {
    result.description = target.description ?? source.description;
  }
  if (target.coverUrl !== undefined || source.coverUrl !== undefined) {
    result.coverUrl = target.coverUrl ?? source.coverUrl;
  }
  if (target.year !== undefined || source.year !== undefined) {
    result.year = target.year ?? source.year;
  }
  if (target.volumes !== undefined || source.volumes !== undefined) {
    result.volumes = target.volumes ?? source.volumes;
  }
  if (target.chapters !== undefined || source.chapters !== undefined) {
    result.chapters = target.chapters ?? source.chapters;
  }

  return result;
}

/**
 * Merge array fields (authors, genres, tags, etc.) into Sets
 *
 * Adds array field values to collection Sets for deduplication.
 * Handles type casting for fields that may have mixed types.
 *
 * @param collections - Collection Sets to add to
 * @param metadata - Source metadata
 */
function mergeArrayFields(
  collections: {
    authors: Set<string>;
    artists: Set<string>;
    genres: Set<string>;
    tags: Set<string>;
    alternativeTitles: Set<string>;
  },
  metadata: MangaMetadata
): void {
  if (Array.isArray(metadata.authors)) {
    (metadata.authors as string[]).forEach(author => collections.authors.add(author));
  }
  if (Array.isArray(metadata.artists)) {
    metadata.artists.forEach(artist => collections.artists.add(artist));
  }
  if (Array.isArray(metadata.genres)) {
    (metadata.genres as string[]).forEach(genre => collections.genres.add(genre));
  }
  if (Array.isArray(metadata.tags)) {
    (metadata.tags as string[]).forEach(tag => collections.tags.add(tag));
  }
  if (Array.isArray(metadata.alternativeTitles)) {
    (metadata.alternativeTitles as string[]).forEach(title => collections.alternativeTitles.add(title));
  }
}

// ============================================================================
// Public API (exported)
// ============================================================================

/**
 * Merge metadata from multiple matches with intelligent priority
 *
 * Combines metadata from multiple providers using a priority-based approach.
 * Higher priority providers (defined in PROVIDER_PRIORITY) take precedence
 * for scalar fields, while array fields are merged and deduplicated.
 *
 * Strategy:
 * 1. Sort by provider priority (AniList > ComicVine > Fandom > Wikipedia)
 * 2. Use highest priority metadata as base
 * 3. Fill missing scalar fields from lower priority sources
 * 4. Merge and deduplicate array fields (authors, genres, tags, etc.)
 *
 * @param metadataList - List of metadata with provider information
 * @returns Merged metadata
 * @throws {ValidationError} If metadataList is empty
 *
 * @example
 * ```typescript
 * const metadata = mergeMatchMetadata([
 *   { provider: 'anilist', metadata: { title: 'One Piece', authors: ['Oda'] } },
 *   { provider: 'fandom', metadata: { description: 'A pirate manga', authors: ['Eiichiro Oda'] } }
 * ]);
 * // Result: { title: 'One Piece', authors: ['Oda', 'Eiichiro Oda'], description: 'A pirate manga' }
 * ```
 */
export function mergeMatchMetadata(metadataList: MetadataWithProvider[]): MangaMetadata {
  if (metadataList.length === 0) {
    throw new ValidationError('No metadata to merge');
  }

  if (metadataList.length === 1) {
    const firstItem = metadataList[0];
    if (firstItem === undefined) {
      throw new ValidationError('No metadata to merge');
    }
    return firstItem.metadata;
  }

  // Sort by provider priority
  const sortedList = sortByProviderPriority(metadataList, PROVIDER_PRIORITY);

  // Initialize with highest priority metadata
  const firstItem = sortedList[0];
  if (firstItem === undefined) {
    throw new ValidationError('No metadata to merge');
  }

  const { authors, artists, genres, tags, alternativeTitles } = initializeMergedMetadata(firstItem.metadata);
  let merged = { ...firstItem.metadata };

  // Merge data from other sources
  for (let i = 1; i < sortedList.length; i++) {
    const item = sortedList[i];
    if (item === undefined) continue;

    merged = mergeScalarFields(merged, item.metadata);
    mergeArrayFields({ authors, artists, genres, tags, alternativeTitles }, item.metadata);
  }

  // Convert Sets back to arrays
  merged.authors = Array.from(authors);
  merged.artists = Array.from(artists);
  merged.genres = Array.from(genres);
  merged.tags = Array.from(tags);
  merged.alternativeTitles = Array.from(alternativeTitles);

  return merged;
}

/**
 * Get enriched metadata for a manga by searching across providers
 *
 * Fetches metadata from the current provider and searches for matches on
 * other providers. Merges all found metadata using intelligent priority-based
 * merging to create a comprehensive metadata object.
 *
 * Flow:
 * 1. Fetch metadata from current provider
 * 2. Search for cross-provider matches by title
 * 3. Collect metadata from all matched providers
 * 4. Merge metadata using priority-based algorithm
 *
 * @param mangaId - Current manga ID
 * @param currentProvider - Current provider
 * @param title - Manga title for searching
 * @param context - Service context with matcher, metadataService, config
 * @returns AsyncResult with enriched metadata or null if no metadata found
 *
 * @example
 * ```typescript
 * const result = await getEnrichedMetadata(
 *   '12345',
 *   'anilist',
 *   'One Piece',
 *   { matcher, metadataService, config }
 * );
 * if (isSuccess(result)) {
 *   console.log('Enriched metadata:', result.data);
 * }
 * ```
 */
export async function getEnrichedMetadata(
  mangaId: string,
  currentProvider: string,
  title: string,
  context: {
    matcher: MatcherWithCrossProvider;
    metadataService: MetadataService;
    config: ProviderMatchingServiceConfig;
  }
): Promise<AsyncResult<MangaMetadata | null, Error>> {
  try {
    logger.info(`Getting enriched metadata for ${mangaId} from ${currentProvider}`);

    // First get metadata from current provider
    const currentMetadataResult = await context.metadataService.fetchMetadata(mangaId, currentProvider);
    let baseMetadata: MangaMetadata | null = null;

    if (isSuccess(currentMetadataResult)) {
      baseMetadata = currentMetadataResult.data;
    }

    // Find matches on other providers
    const matchesResult = await context.matcher.findCrossProviderMatches(title, {
      providers: Object.keys(context.metadataService.getAllProviders()).filter(
        p => p !== currentProvider
      )
    });

    if (isError(matchesResult)) {
      return createSuccessResult(baseMetadata);
    }

    if (!isSuccess(matchesResult)) {
      return createSuccessResult(baseMetadata);
    }

    // Access matches from typed result
    const { matches } = matchesResult.data;
    if (matches.length === 0) {
      return createSuccessResult(baseMetadata);
    }

    // Collect all metadata
    const allMetadata: MetadataWithProvider[] = [];

    if (baseMetadata) {
      allMetadata.push({ provider: currentProvider, metadata: baseMetadata });
    }

    // Collect metadata from matches (only those with metadata)
    matches.forEach((match) => {
      if (match.metadata) {
        allMetadata.push({ provider: match.provider, metadata: match.metadata });
      }
    });

    if (allMetadata.length === 0) {
      return createSuccessResult(null);
    }

    // Merge all metadata
    const enrichedMetadata = mergeMatchMetadata(allMetadata);

    logger.info(`Successfully enriched metadata from ${allMetadata.length} sources`);
    return createSuccessResult(enrichedMetadata);
  } catch (error: unknown) {
    logger.error('Error getting enriched metadata:', error);
    return createErrorResult(
      error instanceof Error
        ? error
        : new Error(`Failed to get enriched metadata: ${String(error)}`)
    );
  }
}
