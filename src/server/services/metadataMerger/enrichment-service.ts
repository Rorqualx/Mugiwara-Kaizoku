/**
 * Enrichment Service Module
 *
 * Main orchestration functions for metadata enrichment workflow.
 * Coordinates provider fetching, metadata building, and persistence.
 *
 * Extracted from: metadataMerger.ts
 */

import { sendMetadataUpdateEvent } from '@/pages/api/events/metadata-updates';
import { prisma } from '@/server/db';
import type { UnifiedMangaMetadata } from '@/types/search.types';
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';


import { getMetadataPersistenceService } from '../metadata/metadata-persister';
import { searchProviderRegistry } from '../search/registerProviders';

import { recreateChaptersIfNeeded } from './chapter-operations';
import * as extractors from './field-extractors';
import {
  buildFieldUpdates,
  buildUnifiedMetadataFromUpdates,
  buildMetadataProvenance
} from './metadata-builder';
import {
  extractStoredProviderMetadata,
  fetchFreshProviderMetadata,
  storeProviderMetadata
} from './provider-storage';
import {
  isRecord,
  getUnknownProperty,
  type MetadataUpdateEvent
} from './utils';

// ============================================================================
// Main Enrichment Functions
// ============================================================================

/**
 * Enrich manga metadata using only the selected providers from confirmation screen
 *
 * @param mangaId - Database manga ID
 * @param selectedProviders - Map of field names to provider names
 * @param forceRefresh - Whether to force refresh from APIs
 * @param importProfileParam - Import profile parameter
 * @returns Updated manga with enriched metadata
 */
export async function enrichMangaMetadataWithSelectedProviders(
  mangaId: number,
  selectedProviders: Record<string, string>,
  forceRefresh: boolean = false,
  importProfileParam: unknown = null
): Promise<unknown> {
  let manga: unknown = null;
  let importProfile = importProfileParam;

  try {
    // Get manga from database
    manga = await prisma.manga.findUnique({
      where: {
        id: mangaId
      },
      include: {
        Metadata: true
      }
    });

    if (!manga) {
      throw new ValidationError(`Manga with ID ${mangaId} not found`);
    }

    logger.info(`Refreshing metadata for manga: ${(manga as Record<string, unknown>)["title"]} using selected providers`);
    logger.info(`Selected providers by field: ${JSON.stringify(selectedProviders)}`);

    // Get unique providers from the selection
    const uniqueProviders = new Set(Object.values(selectedProviders));
    logger.info(`Unique providers to fetch from: ${Array.from(uniqueProviders).join(', ')}`);

    // Initialize search providers if needed
    if (Object.keys(searchProviderRegistry.getAll()).length === 0) {
      searchProviderRegistry.initialize();
      logger.info('Search providers initialized for metadata enrichment');
    }

    // Extract stored provider metadata (3-tier priority system)
    const {
      providerMetadata,
      usedRawProviderData: _usedRawProviderData,
      importProfile: extractedProfile
    } = await extractStoredProviderMetadata(manga, uniqueProviders, forceRefresh);

    // Use passed importProfile or extracted one
    if (!importProfile && extractedProfile) {
      importProfile = extractedProfile;
    }

    // Fetch fresh metadata from provider APIs if needed
    const mangaTitle = isRecord(manga) ? String(getUnknownProperty(manga, 'title') ?? '') : '';
    await fetchFreshProviderMetadata(
      uniqueProviders,
      providerMetadata,
      mangaTitle,
      forceRefresh
    );

    // Build metadata field updates using selected providers
    const updates = buildFieldUpdates(selectedProviders, providerMetadata, manga, extractors);

    // Persist metadata using MetadataPersistenceService
    if (Object.keys(updates).length > 0) {
      logger.info(`Persisting metadata with ${Object.keys(updates).length} fields using MetadataPersistenceService`);

      // Build unified metadata from field updates
      const unifiedMetadata = buildUnifiedMetadataFromUpdates(updates, manga);

      // Build provenance map for audit trail
      const metadataProvenance = buildMetadataProvenance(selectedProviders);

      // Persist using service (with transaction support)
      const metadataPersistenceService = getMetadataPersistenceService();
      const persistResult = await metadataPersistenceService.persistMetadata({
        mangaId,
        metadata: unifiedMetadata as UnifiedMangaMetadata,
        metadataProvenance
      });

      // Handle persistence errors with AsyncResult type guard
      if (persistResult.status === 'error') {
        logger.error(`Failed to persist metadata for manga ${mangaId}:`, persistResult.error);
        throw persistResult.error;
      }

      // Extract data after successful result
      if (persistResult.status === 'success') {
        const { manga: _updatedManga, created } = persistResult.data;
        logger.info(`Metadata ${created ? 'created' : 'updated'} for manga ${mangaId}`);
      }
    } else {
      logger.info('No metadata updates needed');
    }

    // Recreate chapters if needed based on provider metadata
    const chaptersRecreated = await recreateChaptersIfNeeded(
      mangaId,
      selectedProviders,
      providerMetadata
    );

    if (chaptersRecreated) {
      logger.info(`Chapters recreated for manga ${mangaId} from provider metadata`);
    }

    // Store provider metadata with preservation of existing data
    await storeProviderMetadata(
      mangaId,
      manga,
      providerMetadata,
      importProfile,
      forceRefresh
    );

    // Return updated manga
    return await prisma.manga.findUnique({
      where: {
        id: mangaId
      },
      include: {
        Metadata: true,
        Chapter: true,
        Library: true
      }
    });
  }
  catch (error: unknown) {
    logger.error(`Error refreshing metadata with selected providers: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Enrich manga metadata using all available providers
 *
 * Simplified method that delegates to enrichMangaMetadataWithSelectedProviders
 * with a default provider set covering all major providers.
 *
 * This method provides backward compatibility for API calls that don't specify
 * provider preferences. It uses a sensible default provider priority for each field.
 *
 * @param mangaId - Database manga ID
 * @returns Promise resolving to enriched manga data
 */
export async function enrichMangaMetadata(mangaId: number): Promise<unknown> {
  try {
    logger.info(`Enriching manga ${mangaId} with default provider set`);

    // Define default provider selection (field -> preferred provider)
    // Each field maps to a single provider based on data quality and reliability
    const defaultSelectedProviders: Record<string, string> = {
      // Core metadata - AniList preferred for comprehensive data
      title: 'anilist',
      description: 'anilist',
      summary: 'anilist',

      // Images - AniList has high-quality images
      coverImage: 'anilist',
      cover: 'anilist',
      bannerImage: 'anilist',

      // Status and format
      status: 'anilist',
      format: 'anilist',

      // Categorization - AniList has comprehensive tagging
      genres: 'anilist',
      tags: 'anilist',

      // Creator information - ComicVine has good creator data
      authors: 'comicvine',
      artists: 'comicvine',

      // Publisher - ComicVine specializes in publisher data
      publisher: 'comicvine',

      // Volume/Chapter counts - ComicVine is authoritative for volumes
      volumes: 'comicvine',
      chapters: 'anilist',

      // Scoring and popularity - AniList only
      averageScore: 'anilist',
      popularity: 'anilist',

      // Dates - AniList has reliable date data
      startDate: 'anilist',
      endDate: 'anilist',

      // External IDs and links
      idMal: 'anilist',
      idAnilist: 'anilist',

      // Additional metadata
      synonyms: 'anilist',
      countryOfOrigin: 'anilist',
    };

    logger.info(`Using default provider priorities: ${JSON.stringify(defaultSelectedProviders)}`);

    // Delegate to the main enrichment method
    return await enrichMangaMetadataWithSelectedProviders(
      mangaId,
      defaultSelectedProviders,
      false, // forceRefresh = false (use cached data when available)
      null   // importProfile = null (no import profile)
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to enrich manga ${mangaId}:`, error);
    throw new Error(`Failed to enrich manga metadata: ${errorMessage}`);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if manga needs metadata enrichment
 *
 * @param manga - Manga object with metadata
 * @returns True if metadata needs enrichment
 */
export function needsMetadataEnrichment(manga: {
  metadata?: {
    coverLarge?: string | null;
    summary?: string | null;
    genres?: string[];
    chapters?: number | null;
    volumes?: number | null;
    lastFetch?: Date | string;
  } | null;
}): boolean {
  if (!manga.metadata) {
    return true;
  }

  // Check for missing essential fields
  const missingEssentialFields = [
    !manga.metadata.coverLarge,
    !manga.metadata.summary,
    !manga.metadata["genres"] || manga.metadata["genres"].length === 0,
    !manga.metadata["chapters"],
    !manga.metadata.volumes
  ].some(Boolean);

  // Check if metadata was recently fetched (within last 24 hours)
  const recentlyFetched = manga.metadata.lastFetch &&
    new Date().getTime() - new Date(manga.metadata.lastFetch).getTime() < 24 * 60 * 60 * 1000;

  // Need enrichment if essential fields are missing and not recently fetched
  return missingEssentialFields && !recentlyFetched;
}

/**
 * Emit a metadata update event for real-time progress tracking
 *
 * @param event - The metadata update event to emit
 */
export function emitMetadataUpdateEvent(event: MetadataUpdateEvent): void {
  try {
    // Convert event to Record<string, unknown> for sendMetadataUpdateEvent
    const eventData: Record<string, unknown> = {
      mangaId: event.mangaId,
      stage: event.stage,
      timestamp: event.timestamp,
      ...(event.provider && { provider: event.provider }),
      ...(event.message && { message: event.message }),
      ...(event.error && { error: event.error })
    };
    sendMetadataUpdateEvent(eventData);
    logger.debug(`Emitted metadata update event: ${event.stage}${event.provider ? ` for ${event.provider}` : ''}`);
  }
  catch (error: unknown) {
    logger.error(`Error emitting metadata update event: ${error instanceof Error ? error.message : String(error)}`);
  }
}
