// @file-size-justified: Service class aggregating metadata operations with injected dependencies
/**
 * Metadata Merger Service
 *
 * Main service class that aggregates all metadata merging functionality.
 * Provides comprehensive metadata enrichment by combining information
 * from multiple manga providers.
 *
 * Architecture:
 * - utils.ts - Type guards, interfaces, schemas (~256 lines)
 * - field-extractors.ts - Field extraction functions (~509 lines)
 * - metadata-builder.ts - Metadata building functions (~442 lines)
 * - chapter-operations.ts - Chapter creation/enrichment (~527 lines)
 * - conflict-detection.ts - Conflict detection (~295 lines)
 * - provider-storage.ts - Provider metadata storage (~356 lines)
 * - metadata-enhancer.ts - Metadata enhancement (~514 lines)
 * - index.ts - Service class aggregator (~350 lines)
 *
 * Total: ~3249 lines across 8 modules
 * Original: 2893 lines in 1 file
 */

import { sendMetadataUpdateEvent } from '@/pages/api/events/metadata-updates';
import { prisma } from '@/server/db';
import { ProviderMatcher } from '@/server/utils/providerMatcher';
import type { UnifiedMangaMetadata } from '@/types/search.types';
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';


import { getChapterEnrichmentService } from '../metadata/chapter-enricher';
import { getMetadataConfigService } from '../metadata/configService';
import { getMetadataPersistenceService } from '../metadata/metadata-persister';
import { getProviderFetchingService } from '../metadata/provider-fetcher';
import { UnifiedMetadataMerger } from '../metadata/unified-merger';
import { searchProviderRegistry } from '../search/registerProviders';


import {
  recreateChaptersIfNeeded,
  enrichChapterMetadataFromComicVine as enrichComicVineChapters,
  enrichChapterMetadataFromFandom as enrichFandomChapters
} from './chapter-operations';
import {
  extractVolumesField,
  extractChaptersField,
  extractDescriptionField,
  extractCoverFields,
  extractStatusField,
  extractAuthorsField,
  extractArtistsField,
  extractGenresField,
  extractTagsField,
  extractPublisherField,
  extractStartDateField,
  extractEndDateField,
  extractReleaseYearField,
  extractIdMalField,
  extractIdAnilistField,
  extractAverageScoreField,
  extractPopularityField,
  extractBannerImageField,
  extractFormatField,
  extractSynonymsField,
  extractThemesField,
  extractCharactersField as _extractCharactersField,
  extractCreatorCreditsField as _extractCreatorCreditsField
} from './field-extractors';
import { IntelligentMetadataMerger } from './intelligent-merger';
import {
  getDefaultMergerConfig,
  parseProviderMetadata as _parseProviderMetadata,
  buildFieldUpdates,
  buildUnifiedMetadataFromUpdates,
  buildMetadataProvenance
} from './metadata-builder';
import {
  extractStoredProviderMetadata,
  extractBoundProviderIds,
  fetchFreshProviderMetadata,
  storeProviderMetadata
} from './provider-storage';
import {
  isRecord,
  getUnknownProperty,
  type MetadataUpdateEvent
} from './utils';

import type { ConfigService } from '../config/configService';
import type { ChapterEnrichmentService } from '../metadata/chapter-enricher';
import type { MetadataConfigService } from '../metadata/configService';
import type { MetadataPersistenceService } from '../metadata/metadata-persister';
import type { ProviderFetchingService } from '../metadata/provider-fetcher';
import type { MergeConfig as _MergeConfig } from '../metadata/unified-merger';

/**
 * Options for MetadataMergerService constructor
 */
interface MetadataMergerServiceOptions {
  configService?: ConfigService | undefined;
  providerFetcher?: ProviderFetchingService | undefined;
  metadataMerger?: UnifiedMetadataMerger | undefined;
  metadataPersister?: MetadataPersistenceService | undefined;
  chapterEnricher?: ChapterEnrichmentService | undefined;
  intelligentMerger?: IntelligentMetadataMerger | undefined;
}

// Re-export utilities - explicit exports for tree-shaking
export {
  getUnknownProperty,
  MangaPublicationStatus,
  MangaFormat,
  ChapterStatus,
  isRecord,
  isValidCount,
  normalizeStatus,
  processDate,
  mapDomainToPrismaChapterStatus,
  mapPrismaToDomainChapterStatus,
  ProviderMetadataSchema,
  RawProviderDataSchema,
  StoredMetadataSchema,
} from './utils';
export type {
  MetadataConflict,
  ExtendedPrismaClient,
  MetadataValues,
  MetadataUpdateEvent,
  ExtendedProviderMetadata,
} from './utils';

/**
 * Metadata Merger Service
 *
 * Provides comprehensive metadata enrichment by combining information from multiple
 * manga providers. This service handles the intelligent merging of metadata from
 * different sources while respecting user preferences and provider priorities.
 *
 * Core Features:
 * - Multi-provider metadata aggregation
 * - Intelligent field merging with provider prioritization
 * - User preference support for metadata sources
 * - Automatic metadata validation and repair
 * - Chapter metadata enrichment from ComicVine and Fandom
 */
export class MetadataMergerService {
  private providerMatcher: ProviderMatcher;
  private metadataConfigService: MetadataConfigService | null = null;
  public configService?: ConfigService | undefined;

  // Injected services for 3-layer architecture
  private providerFetcher: ProviderFetchingService;
  private metadataMerger: UnifiedMetadataMerger;
  private metadataPersister: MetadataPersistenceService;
  private chapterEnricher: ChapterEnrichmentService;
  private intelligentMerger: IntelligentMetadataMerger;

  constructor(options?: MetadataMergerServiceOptions) {
    this.providerMatcher = new ProviderMatcher();
    this.configService = options?.configService;
    if (options?.configService) {
      this.metadataConfigService = getMetadataConfigService(options.configService);
    }

    // Initialize services (use provided or get singletons)
    this.providerFetcher = options?.providerFetcher ?? getProviderFetchingService();
    this.metadataPersister = options?.metadataPersister ?? getMetadataPersistenceService();
    this.chapterEnricher = options?.chapterEnricher ?? getChapterEnrichmentService();

    // Initialize UnifiedMetadataMerger with configuration
    this.metadataMerger = options?.metadataMerger ?? new UnifiedMetadataMerger(getDefaultMergerConfig());

    // Initialize IntelligentMetadataMerger
    this.intelligentMerger = options?.intelligentMerger ?? new IntelligentMetadataMerger();
  }

  /**
   * Initialize the service with a configuration service
   *
   * @param configService - The configuration service
   */
  initialize(configService: ConfigService): void {
    this.configService = configService;
    this.metadataConfigService = getMetadataConfigService(configService);
  }

  /**
   * Enrich manga metadata using only the selected providers from confirmation screen
   *
   * @param mangaId - Database manga ID
   * @param selectedProviders - Map of field names to provider names
   * @param forceRefresh - Whether to force refresh from APIs
   * @param importProfileParam - Import profile from wizard
   * @returns Updated manga with enriched metadata
   */
  async enrichMangaMetadataWithSelectedProviders(
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
        where: { id: mangaId },
        include: { Metadata: true }
      });

      if (!manga) {
        throw new ValidationError(`Manga with ID ${mangaId} not found`);
      }

      const mangaTitle = isRecord(manga) ? String(getUnknownProperty(manga, 'title') ?? '') : '';
      logger.info(`Refreshing metadata for manga: ${mangaTitle} using selected providers`);
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

      // Extract bound provider IDs for direct lookup during fresh fetch
      const mangaProviderMetadata = isRecord(manga) ? getUnknownProperty(manga, 'providerMetadata') : undefined;
      const boundIds = extractBoundProviderIds(mangaProviderMetadata);
      if (Object.keys(boundIds).length > 0) {
        logger.info(`Found bound provider IDs: ${JSON.stringify(boundIds)}`);
      }

      // Fetch fresh metadata from provider APIs if needed
      await fetchFreshProviderMetadata(
        uniqueProviders,
        providerMetadata,
        mangaTitle,
        forceRefresh,
        boundIds
      );

      // Build metadata field updates using selected providers
      const extractors = {
        extractVolumesField,
        extractChaptersField,
        extractDescriptionField,
        extractCoverFields,
        extractStatusField,
        extractAuthorsField,
        extractArtistsField,
        extractGenresField,
        extractTagsField,
        extractThemesField,
        extractPublisherField,
        extractStartDateField,
        extractEndDateField,
        extractReleaseYearField,
        extractIdMalField,
        extractIdAnilistField,
        extractAverageScoreField,
        extractPopularityField,
        extractBannerImageField,
        extractFormatField,
        extractSynonymsField
      };
      const updates = buildFieldUpdates(selectedProviders, providerMetadata, manga, extractors);

      // Persist metadata using MetadataPersistenceService
      if (Object.keys(updates).length > 0) {
        logger.info(`Persisting metadata with ${Object.keys(updates).length} fields using MetadataPersistenceService`);

        // Build unified metadata from field updates
        const unifiedMetadata = buildUnifiedMetadataFromUpdates(updates, manga);

        // Build provenance map for audit trail
        const metadataProvenance = buildMetadataProvenance(selectedProviders);

        // Persist using service (with transaction support)
        const persistResult = await this.metadataPersister.persistMetadata({
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
        where: { id: mangaId },
        include: {
          Metadata: true,
          Chapter: true,
          Library: true
        }
      });
    } catch (error: unknown) {
      logger.error(`Error refreshing metadata with selected providers: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Enrich manga metadata using intelligent field-level provider selection
   *
   * Uses intelligent selection to choose the best data for each field
   * from all available providers, regardless of primary source.
   *
   * @param mangaId - Database manga ID
   * @param availableProviders - List of available providers
   * @param userPreferences - User field-level provider preferences
   * @returns Promise resolving to enriched manga data
   */
  async enrichMangaMetadataIntelligently(
    mangaId: number,
    availableProviders: string[],
    userPreferences?: Record<string, string[]>
  ): Promise<unknown> {
    try {
      logger.info(`Enriching manga ${mangaId} with intelligent provider selection`);

      // Get manga from database
      const manga = await prisma.manga.findUnique({
        where: { id: mangaId },
        include: { Metadata: true }
      });

      if (!manga) {
        throw new ValidationError(`Manga with ID ${mangaId} not found`);
      }

      const mangaTitle = isRecord(manga) ? String(getUnknownProperty(manga, 'title') ?? '') : '';

      // Initialize search providers if needed
      if (Object.keys(searchProviderRegistry.getAll()).length === 0) {
        searchProviderRegistry.initialize();
        logger.info('Search providers initialized for intelligent metadata enrichment');
      }

      // Extract stored provider metadata
      const {
        providerMetadata,
        usedRawProviderData: _usedRawProviderData,
        importProfile: extractedProfile
      } = await extractStoredProviderMetadata(manga, new Set(availableProviders), false);

      // Extract bound provider IDs for direct lookup
      const intelligentBoundIds = extractBoundProviderIds(
        isRecord(manga) ? getUnknownProperty(manga, 'providerMetadata') : undefined
      );

      // Fetch fresh metadata from provider APIs if needed
      await fetchFreshProviderMetadata(
        new Set(availableProviders),
        providerMetadata,
        mangaTitle,
        false,
        intelligentBoundIds
      );

      // Use intelligent selection to merge metadata
      const existingMetadata = isRecord(manga) && isRecord(manga.Metadata)
        ? (manga.Metadata as unknown as Partial<UnifiedMangaMetadata>)
        : undefined;

      const intelligentResult = await this.intelligentMerger.mergeMetadata(
        availableProviders,
        providerMetadata as Record<string, Record<string, unknown>>,
        userPreferences,
        existingMetadata
      );

      // Persist the intelligently selected metadata
      if (Object.keys(intelligentResult.selectedMetadata).length > 0) {
        logger.info(`Persisting intelligently selected metadata with ${Object.keys(intelligentResult.selectedMetadata).length} fields`);

        // Convert field provenance to simple provider mapping
        const simpleProvenance: Record<string, string> = {};
        for (const [field, provenance] of Object.entries(intelligentResult.fieldProvenance)) {
          simpleProvenance[field] = provenance.provider;
        }

        const persistResult = await this.metadataPersister.persistMetadata({
          mangaId,
          metadata: intelligentResult.selectedMetadata,
          metadataProvenance: simpleProvenance
        });

        if (persistResult.status === 'error') {
          logger.error(`Failed to persist intelligent metadata for manga ${mangaId}:`, persistResult.error);
          throw persistResult.error;
        }

        if (persistResult.status === 'success') {
          const { manga: _updatedManga, created } = persistResult.data;
          logger.info(`Intelligent metadata ${created ? 'created' : 'updated'} for manga ${mangaId}`);
        }
      } else {
        logger.info('No intelligent metadata updates needed');
      }

      // Store provider metadata
      await storeProviderMetadata(
        mangaId,
        manga,
        providerMetadata,
        extractedProfile,
        false
      );

      // Return updated manga
      return await prisma.manga.findUnique({
        where: { id: mangaId },
        include: {
          Metadata: true,
          Chapter: true,
          Library: true
        }
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to enrich manga ${mangaId} intelligently:`, error);
      throw new Error(`Failed to enrich manga metadata intelligently: ${errorMessage}`);
    }
  }

  /**
   * Enrich manga metadata using all available providers
   *
   * Simplified method that delegates to enrichMangaMetadataWithSelectedProviders
   * with a default provider set covering all major providers.
   *
   * @param mangaId - Database manga ID
   * @returns Promise resolving to enriched manga data
   */
  async enrichMangaMetadata(mangaId: number): Promise<unknown> {
    try {
      logger.info(`Enriching manga ${mangaId} with default provider set`);

      // Define default provider selection (field -> preferred provider)
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

        // Creator information - AniList for creator data
        authors: 'anilist',
        artists: 'anilist',

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
      return await this.enrichMangaMetadataWithSelectedProviders(
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

  /**
   * Check if manga needs metadata enrichment
   *
   * @param manga - Manga object with metadata
   * @returns True if metadata needs enrichment
   */
  needsMetadataEnrichment(manga: {
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
      !manga.metadata.genres || manga.metadata.genres.length === 0,
      !manga.metadata.chapters,
      !manga.metadata.volumes
    ].some(Boolean);

    // Check if metadata was recently fetched (within last 24 hours)
    const recentlyFetched = manga.metadata.lastFetch &&
      new Date().getTime() - new Date(manga.metadata.lastFetch).getTime() < 24 * 60 * 60 * 1000;

    // Need enrichment if essential fields are missing and not recently fetched
    return missingEssentialFields && !recentlyFetched;
  }

  /**
   * Enrich manga chapter metadata from ComicVine
   *
   * Delegates to ChapterEnrichmentService for type-safe enrichment.
   *
   * @param mangaId - Database manga ID
   * @returns True if chapter metadata was enriched
   */
  async enrichChapterMetadataFromComicVine(mangaId: number): Promise<boolean> {
    return enrichComicVineChapters(this.chapterEnricher, mangaId);
  }

  /**
   * Enrich chapter metadata from Fandom
   *
   * Delegates to ChapterEnrichmentService for Fandom chapter enrichment.
   *
   * @param mangaId - Database manga ID
   * @returns Promise<boolean> - true if enrichment was successful
   */
  async enrichChapterMetadataFromFandom(mangaId: number): Promise<boolean> {
    return enrichFandomChapters(this.chapterEnricher, mangaId);
  }

  /**
   * Emit a metadata update event for real-time progress tracking
   *
   * @param event - The metadata update event to emit
   */
  private emitMetadataUpdateEvent(event: MetadataUpdateEvent): void {
    try {
      // Convert event to Record<string, unknown> for sendMetadataUpdateEvent
      const eventData: Record<string, unknown> = {
        mangaId: event.mangaId,
        stage: event.stage,
        provider: event.provider,
        message: event.message,
        error: event.error,
        timestamp: event.timestamp
      };
      sendMetadataUpdateEvent(eventData);
    } catch (error: unknown) {
      logger.error(`Error emitting metadata update event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Create singleton instance
let metadataMergerServiceInstance: MetadataMergerService | null = null;

/**
 * Get the metadata merger service singleton instance
 *
 * @param configService - Optional configuration service (backward compatibility)
 * @returns The metadata merger service instance
 */
export function getMetadataMergerService(configService?: ConfigService): MetadataMergerService {
  if (!metadataMergerServiceInstance) {
    metadataMergerServiceInstance = new MetadataMergerService({ configService });
  } else if (configService && !metadataMergerServiceInstance.configService) {
    metadataMergerServiceInstance.initialize(configService);
  }
  return metadataMergerServiceInstance;
}

// Export a simple reference for backward compatibility
export const metadataMergerService = new MetadataMergerService();
