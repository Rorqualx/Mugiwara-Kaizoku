/**
 * Wikipedia Metadata Provider Adapter
 * 
 * A specialized adapter for enriching manga metadata using Wikipedia data.
 * This adapter provides supplementary information to fill gaps in metadata
 * from other providers, including plot summaries, chapter lists, author details,
 * and publication information.
 * 
 * Features:
 * - Intelligent title matching with disambiguation handling
 * - Chapter and volume list extraction
 * - Plot summary and description enrichment
 * - Author and publication metadata
 * - Caching for improved performance
 * - Fallback data for incomplete metadata
 * 
 * Usage:
 * ```typescript
 * const adapter = createWikipediaAdapter({ enabled: true });
 * 
 * // Search for manga
 * const results = await adapter.searchAsync("One Piece");
 * 
 * // Get detailed metadata
 * const metadata = await adapter.getMangaByIdAsync("One_Piece");
 * 
 * // Enrich existing metadata
 * const enriched = await adapter.enrichMetadata(existingData);
 * ```
 */

import { MangaPublicationStatus } from '@prisma/client';

import type { WikipediaMangaData } from '@/server/services/wikipedia/wikipedia/service';
import { wikipediaService } from '@/server/services/wikipedia/wikipedia/service';
import type { MangaSearchResult, MangaMetadata } from '@/types/search.types';
import { createSuccessResult, createErrorResult, isSuccess, isError} from '@/utils/async-result';
import type { AsyncResult} from '@/utils/async-result';
import { toStringId } from '@/utils/id-converters';
import { BaseIntegrationAdapter } from '@/utils/integration-adapter';
import type { IntegrationAdapter, SearchOptions, IntegrationMangaData, MetadataSourceInfo, BaseIntegrationConfig } from '@/utils/integration-adapter';
import { logger } from '@/utils/logger';


import {
  mergeDescription,
  mergeCreatorField,
  mergeGenres,
  mergeMetadata
} from './helpers/wikipediaEnrichmentHelpers';

import type { Chapter as ChapterEntity, PrismaClient } from '@prisma/client';
/**
 * Wikipedia adapter configuration
 */
export interface WikipediaConfig extends BaseIntegrationConfig {
  enabled: boolean;
  cacheEnabled?: boolean;
  cacheTTL?: number; // in seconds
  enrichmentOnly?: boolean; // If true, only provides enrichment data, not primary search
  maxSearchResults?: number;
  [key: string]: unknown; // Index signature for BaseIntegrationConfig compatibility
}
/**
 * Default configuration for Wikipedia adapter
 */
export const DEFAULT_WIKIPEDIA_CONFIG: WikipediaConfig = {
  enabled: true,
  cacheEnabled: true,
  cacheTTL: 86400,
  // 24 hours
  enrichmentOnly: false,
  maxSearchResults: 10
};
/**
 * Map Wikipedia publication status to Prisma enum
 */
function mapPublicationStatus(
  wikiStatus: WikipediaMangaData['publicationStatus'],
  legacyStatus: WikipediaMangaData['status']
): MangaPublicationStatus {
  // Prefer structured publicationStatus
  if (wikiStatus) {
    switch (wikiStatus) {
      case 'ongoing': return MangaPublicationStatus.ONGOING;
      case 'finished': return MangaPublicationStatus.COMPLETED;
      case 'hiatus': return MangaPublicationStatus.HIATUS;
      case 'cancelled': return MangaPublicationStatus.CANCELLED;
      default: return MangaPublicationStatus.UNKNOWN;
    }
  }
  // Fall back to legacy status string
  if (legacyStatus) {
    const lower = legacyStatus.toLowerCase();
    if (lower.includes('ongoing') || lower.includes('current')) return MangaPublicationStatus.ONGOING;
    if (lower.includes('finished') || lower.includes('completed') || lower.includes('ended')) return MangaPublicationStatus.COMPLETED;
    if (lower.includes('hiatus')) return MangaPublicationStatus.HIATUS;
    if (lower.includes('cancelled') || lower.includes('canceled')) return MangaPublicationStatus.CANCELLED;
  }
  return MangaPublicationStatus.UNKNOWN;
}

/**
 * Transform Wikipedia data to integration manga format
 */
function transformWikipediaToManga(data: WikipediaMangaData): IntegrationMangaData {
  return {
    id: encodeURIComponent(data["title"].replace(/ /g, '_')),
    sourceId: data.wikipediaUrl ?? '',
    title: data["title"],
    alternativeTitles: data["alternativeTitles"] ?? [],
    description: data.synopsis ?? data.plot ?? data["description"] ?? '',
    coverUrl: data.coverImage ?? '',
    author: data.author?.join(', ') ?? '',
    artist: data.artist?.join(', ') ?? '',
    status: mapPublicationStatus(data.publicationStatus, data.status),
    genres: data["genres"] ?? [],
    tags: data.demographic ? [data.demographic] : [],
    chapters: data["chapters"],
    volumes: data.volumes,
    publishYear: data.originalRun ? parseInt(data.originalRun.split('–')[0] ?? '') : undefined,
    publisher: data.publisher,
    metadata: {
      magazine: data.magazine,
      englishMagazine: data.englishMagazine,
      imprint: data.imprint,
      originalRun: data.originalRun,
      volumeListUrl: data.volumeListUrl,
      chapterListUrls: data.chapterListUrls,
      volumeList: data.volumeList,
      chapterList: data.chapterList,
      // New fields from extended types
      editor: data.editor,
      mangaType: data.mangaType,
      licensedBy: data.licensedBy,
      publicationStatus: data.publicationStatus,
      startDate: data.startDate?.toISOString(),
      endDate: data.endDate?.toISOString(),
    }
  };
}
/**
 * Transform Wikipedia data to search result format
 */
function transformToSearchResult(data: WikipediaMangaData): MangaSearchResult {
  return {
    id: encodeURIComponent(data["title"].replace(/ /g, '_')),
    title: data["title"],
    coverImage: data.coverImage ?? '',
    source: 'wikipedia',
    sourceId: data.wikipediaUrl ?? encodeURIComponent(data["title"].replace(/ /g, '_')),
    provider: 'wikipedia',
    description: data.synopsis ?? data.plot ?? data["description"] ?? '',
    tags: data.demographic ? [data.demographic] : [],
    genres: data["genres"] ?? [],
    ...(data["alternativeTitles"] && data["alternativeTitles"].length > 0
      ? { alternativeTitles: data["alternativeTitles"] }
      : {}),
    status: mapPublicationStatus(data.publicationStatus, data.status)
  };
}
/**
 * Wikipedia Adapter Implementation
 */
export class WikipediaAdapter extends BaseIntegrationAdapter<WikipediaConfig> implements IntegrationAdapter<WikipediaConfig> {
  protected config: WikipediaConfig;
  private wikipedia: typeof wikipediaService;
  constructor(config: Partial<WikipediaConfig> = {}, _prisma?: PrismaClient) {
    const fullConfig = {
      ...DEFAULT_WIKIPEDIA_CONFIG,
      ...config
    };
    super(fullConfig, 'wikipedia');
    this.config = fullConfig;
    this.wikipedia = wikipediaService;
    logger.info('Wikipedia adapter initialized', {
      enabled: this.config.enabled,
      enrichmentOnly: this.config.enrichmentOnly
    });
  }
  /**
   * Get adapter name
   */
  getName(): string {
    return 'wikipedia';
  }
  /**
   * Get adapter version
   */
  getVersion(): string {
    return '1.0.0';
  }
  /**
   * Check if adapter is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
  /**
   * Get adapter configuration
   */
  getConfig(): WikipediaConfig {
    return {
      ...this.config
    };
  }
  /**
   * Search for manga on Wikipedia
   */
  async searchAsync(query: string, _options?: SearchOptions): Promise<AsyncResult<MangaSearchResult[], Error>> {
    if (!this.config.enabled) {
      return createErrorResult(new Error('Wikipedia adapter is not enabled'));
    }
    if (this.config.enrichmentOnly) {
      return createSuccessResult([]);
    }
    try {
      logger.info(`Searching Wikipedia for: ${query}`);
      // Search for best match
      const result = await this.wikipedia.findBestMatch(query);
      if (!result) {
        logger.info('No Wikipedia results found');
        return createSuccessResult([]);
      }
      // Transform to search result
      const searchResult = transformToSearchResult(result);
      return createSuccessResult([searchResult]);
    } catch (error: unknown) {
      logger.error('Wikipedia search failed:', error);
      return createErrorResult(error instanceof Error ? error : new Error('Wikipedia search failed'));
    }
  }
  /**
   * Get manga details by ID (Wikipedia page title)
   */
  async getMangaByIdAsync(id: string): Promise<AsyncResult<IntegrationMangaData, Error>> {
    if (!this.config.enabled) {
      return createErrorResult(new Error('Wikipedia adapter is not enabled'));
    }
    try {
      // Decode the ID to get the page title
      const title = decodeURIComponent(id).replace(/_/g, ' ');
      logger.info(`Fetching Wikipedia data for: ${title}`);
      const result = await this.wikipedia.findBestMatch(title);
      if (!result) {
        return createErrorResult(new Error(`No Wikipedia page found for: ${title}`));
      }
      const mangaData = transformWikipediaToManga(result);
      return createSuccessResult(mangaData);
    } catch (error: unknown) {
      logger.error('Failed to fetch Wikipedia manga data:', error);
      return createErrorResult(error instanceof Error ? error : new Error('Failed to fetch Wikipedia data'));
    }
  }
  /**
   * Get metadata source information
   */
  getMetadataSource(): MetadataSourceInfo {
    return {
      id: 'wikipedia',
      name: 'Wikipedia',
      type: 'manga',
      version: '1.0.0'
    };
  }
  /**
   * Get source information (required by IntegrationAdapter)
   */
  getSourceInfo(): MetadataSourceInfo {
    return this.getMetadataSource();
  }
  /**
   * Standard search method (throws errors)
   */
  async search(query: string, options?: SearchOptions): Promise<AsyncResult<MangaSearchResult[], Error>> {
    return this.searchAsync(query, options);
  }
  /**
   * Get manga by ID (throws errors)
   */
  async getMangaById(id: string | number): Promise<AsyncResult<IntegrationMangaData, Error>> {
    return this.getMangaByIdAsync(toStringId(id));
  }
  /**
   * Get manga by title (throws errors)
   */
  async getMangaByTitle(title: string): Promise<AsyncResult<IntegrationMangaData, Error>> {
    return this.getMangaByTitleAsync(title);
  }
  /**
   * Get manga by title async
   */
  async getMangaByTitleAsync(title: string): Promise<AsyncResult<IntegrationMangaData, Error>> {
    return this.getMangaByIdAsync(encodeURIComponent(title.replace(/ /g, '_')));
  }
  /**
   * Get chapters (returns AsyncResult)
   */
  async getChapters(mangaId: string | number): Promise<AsyncResult<ChapterEntity[], Error>> {
    return this.getChaptersAsync(toStringId(mangaId));
  }
  /**
   * Get status (returns AsyncResult)
   */
  getStatus(): Promise<AsyncResult<{ status: 'ok' | 'error'; message?: string; }, Error>> {
    return this.getStatusAsync();
  }
  /**
   * Get status async
   */
  getStatusAsync(): Promise<AsyncResult<{
    status: 'ok' | 'error';
    message?: string;
  }, Error>> {
    return Promise.resolve(createSuccessResult({
      status: this.config.enabled ? 'ok' : 'error',
      message: this.config.enabled ? 'Wikipedia adapter is operational' : 'Wikipedia adapter is disabled'
    }));
  }
  /**
   * Search manga metadata
   */
  async searchManga(query: string, options?: SearchOptions): Promise<AsyncResult<MangaMetadata[], Error>> {
    const result = await this.search(query, options);
    if (isSuccess(result)) {
      // Transform search results to MangaMetadata format
      const metadata = result.data.map(r => {
        const m: MangaMetadata = {
          title: r["title"],
          status: r["status"] ?? MangaPublicationStatus.UNKNOWN
        };
        return m;
      });
      return createSuccessResult(metadata);
    }
    if (isError(result)) {
      return createErrorResult(result.error);
    }
    return createSuccessResult([]);
  }
  /**
   * Get manga metadata by ID
   */
  async getMangaMetadataById(sourceId: string | number): Promise<AsyncResult<MangaMetadata | null, Error>> {
    const result = await this.getMangaById(sourceId);
    if (isSuccess(result)) {
      const metadata: MangaMetadata = {
        title: result.data["title"],
        status: result.data["status"] as MangaPublicationStatus
      };
      return createSuccessResult(metadata);
    }
    if (isError(result)) {
      return createErrorResult(result.error);
    }
    return createSuccessResult(null);
  }
  /**
   * Update manga metadata
   */
  updateMangaMetadata(mangaId: string | number): Promise<AsyncResult<void, Error>> {
    // Wikipedia is read-only, no updates supported
    logger.info(`Wikipedia adapter does not support metadata updates for manga ${mangaId}`);
    return Promise.resolve(createSuccessResult(undefined));
  }
  /**
   * Update all manga metadata
   */
  updateAllMangaMetadata(_limit?: number): Promise<AsyncResult<number, Error>> {
    // Wikipedia is read-only, no updates supported
    return Promise.resolve(createSuccessResult(0));
  }
  /**
   * Configure the adapter
   */
  configure(config: Partial<WikipediaConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
  }
  /**
   * Dispose of resources
   */
  dispose(): void {
    // No resources to clean up
  }
  /**
   * Enrich existing metadata with Wikipedia data
   */
  async enrichMetadata(existingData: IntegrationMangaData): Promise<AsyncResult<IntegrationMangaData, Error>> {
    if (!this.config.enabled) {
      return createSuccessResult(existingData);
    }

    try {
      logger.info(`Enriching metadata for: ${existingData["title"]}`);

      const wikiData = await this.wikipedia.findBestMatch(existingData["title"]);
      if (!wikiData) {
        logger.info('No Wikipedia enrichment data found');
        return createSuccessResult(existingData);
      }

      // Use helper functions to reduce complexity
      const enrichedData: IntegrationMangaData = {
        ...existingData,
        description: mergeDescription(
          existingData["description"] as string | undefined,
          wikiData.plot,
          wikiData["description"]
        ),
        author: mergeCreatorField(
          existingData["author"] as string | undefined,
          wikiData.author
        ),
        artist: mergeCreatorField(
          existingData["artist"] as string | undefined,
          wikiData.artist
        ),
        genres: mergeGenres(
          existingData["genres"] as string[] | undefined,
          wikiData["genres"]
        ),
        chapters: existingData["chapters"] ?? wikiData["chapters"],
        volumes: existingData["volumes"] ?? wikiData.volumes,
        publisher: existingData["publisher"] ?? wikiData.publisher,
        metadata: mergeMetadata(
          existingData["metadata"] as Record<string, unknown> | undefined,
          wikiData
        )
      };

      logger.info('Successfully enriched metadata with Wikipedia data');
      return createSuccessResult(enrichedData);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to enrich with Wikipedia data:', errorMessage);
      return createSuccessResult(existingData);
    }
  }
  /**
   * Get chapters (not directly supported by Wikipedia)
   */
  getChaptersAsync(_mangaId: string): Promise<AsyncResult<ChapterEntity[], Error>> {
    // Wikipedia doesn't provide direct chapter downloads
    return Promise.resolve(createSuccessResult([]));
  }
  /**
   * Download a chapter (not supported by Wikipedia)
   */
  downloadChapterAsync(_mangaId: string, _chapterId: string): Promise<AsyncResult<{
    path: string;
  }, Error>> {
    return Promise.reject(new Error('Wikipedia does not support chapter downloads'));
  }
  /**
   * Validate configuration
   */
  validateConfig(): AsyncResult<boolean, Error> {
    if (typeof this.config.enabled !== 'boolean') {
      return createErrorResult(new Error('Invalid configuration: enabled must be a boolean'));
    }
    return createSuccessResult(true);
  }
}
/**
 * Factory function to create Wikipedia adapter
 */
export function createWikipediaAdapter(config?: Partial<WikipediaConfig>, prisma?: PrismaClient): WikipediaAdapter {
  return new WikipediaAdapter(config, prisma);
}
/**
 * Default export
 */
export default WikipediaAdapter;