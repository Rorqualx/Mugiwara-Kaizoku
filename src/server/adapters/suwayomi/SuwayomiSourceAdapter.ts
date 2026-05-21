// @file-size-justified: Adapter class with many interface methods - splitting would fragment the API
/**
 * Suwayomi Source Adapter
 *
 * GraphQL-based adapter for interacting with Suwayomi server.
 * Implements the IntegrationAdapter interface for seamless integration
 * with the existing adapter infrastructure.
 *
 * Features:
 * - Source management (list, install, uninstall extensions)
 * - Manga search across multiple sources
 * - Chapter fetching with pagination
 * - Download queue management via native GraphQL
 * - Real-time status via subscriptions
 *
 * @module adapters/suwayomi/SuwayomiSourceAdapter
 */

import {
  getSuwayomiGraphQLClient,
  type SuwayomiGraphQLClient,
} from '@/server/services/suwayomi/graphql/client';
import type {
  MangaType,
  ChapterType,
  SourceType,
  ExtensionType,
  DownloadStatus,
  SuwayomiGraphQLConfig,
} from '@/server/services/suwayomi/graphql/types';
import type { MetadataSourceInfo } from '@/types/adapters/native-download-types';
import type { BaseIntegrationConfig } from '@/types/config.types';
import type {
  MangaSearchResult,
  MangaMetadata,
  SearchOptions,
} from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess, isError } from '@/utils/async-result';
import type {
  IntegrationAdapter,
  IntegrationMangaData,
} from '@/utils/integration-adapter';
import { logger } from '@/utils/logger';


import type { Chapter as ChapterEntity } from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

/**
 * Suwayomi adapter configuration
 */
export interface SuwayomiSourceAdapterConfig extends BaseIntegrationConfig {
  /** Suwayomi server host */
  host: string;
  /** Suwayomi server port */
  port: number;
  /** Use GraphQL API (vs REST) */
  useGraphQL: boolean;
  /** GraphQL HTTP endpoint */
  graphqlHttpUrl?: string;
  /** GraphQL WebSocket endpoint */
  graphqlWsUrl?: string;
  /** Basic auth credentials */
  auth?: {
    username: string;
    password: string;
  };
  /** Default page size for queries */
  defaultPageSize: number;
  /** Default language filter */
  defaultLanguages: string[];
}

/**
 * Source search result with source info
 */
export interface SuwayomiMangaSearchResult extends MangaSearchResult {
  sourceId: string;
  sourceName: string;
  sourceIconUrl?: string;
}

/**
 * Multi-source search options
 */
export interface MultiSourceSearchOptions extends SearchOptions {
  /** Source IDs to search (empty = all installed) */
  sourceIds?: string[];
  /** Languages to filter sources by */
  languages?: string[];
  /** Include NSFW sources */
  includeNsfw?: boolean;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: SuwayomiSourceAdapterConfig = {
  enabled: false,
  host: 'localhost',
  port: 4567,
  useGraphQL: true,
  defaultPageSize: 20,
  defaultLanguages: ['en'],
};

// =============================================================================
// SuwayomiSourceAdapter Class
// =============================================================================

/**
 * Suwayomi Source Adapter
 *
 * Provides access to Suwayomi's manga sources, chapters, and downloads
 * via the GraphQL API with real-time subscription support.
 */
export class SuwayomiSourceAdapter implements IntegrationAdapter<SuwayomiSourceAdapterConfig> {
  private config: SuwayomiSourceAdapterConfig;
  private graphqlClient: SuwayomiGraphQLClient | null = null;

  /**
   * Create a new SuwayomiSourceAdapter
   */
  constructor(config?: Partial<SuwayomiSourceAdapterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('SuwayomiSourceAdapter created', {
      host: this.config.host,
      port: this.config.port,
      useGraphQL: this.config.useGraphQL,
    });
  }

  // ===========================================================================
  // IntegrationAdapter Interface Implementation
  // ===========================================================================

  /**
   * Check if adapter is enabled
   */
  public isEnabled(): boolean {
    return this.config.enabled === true;
  }

  /**
   * Get source info
   */
  public getSourceInfo(): MetadataSourceInfo {
    return {
      id: 'suwayomi',
      name: 'Suwayomi',
      type: 'integration',
      version: '2.0.0',
      isActive: this.isEnabled(),
    };
  }

  /**
   * Search for manga
   */
  public async search(
    query: string,
    options?: SearchOptions
  ): Promise<AsyncResult<MangaSearchResult[], Error>> {
    try {
      const client = this.getClient();
      if (!client) {
        return createErrorResult(new Error('Suwayomi client not available'));
      }

      // Get installed sources
      const sources = await client.getSources();
      const installedSources = sources.filter(
        (s) => s.extension.isInstalled === true
      );

      if (installedSources.length === 0) {
        return createSuccessResult([]);
      }

      // Search first installed source (for basic search)
      const firstSource = installedSources[0];
      if (!firstSource) {
        return createSuccessResult([]);
      }

      const result = await client.searchSourceManga(
        String(firstSource.id),
        query,
        options?.page ?? 1
      );

      const searchResults: MangaSearchResult[] = result.mangas.map((manga) =>
        this.transformMangaToSearchResult(manga, firstSource)
      );

      return createSuccessResult(searchResults);
    } catch (error) {
      logger.error('Suwayomi search failed', { query, error });
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get manga by ID
   */
  public async getMangaById(
    id: string | number
  ): Promise<AsyncResult<IntegrationMangaData, Error>> {
    try {
      const client = this.getClient();
      if (!client) {
        return createErrorResult(new Error('Suwayomi client not available'));
      }

      const mangaId = typeof id === 'string' ? parseInt(id, 10) : id;
      const manga = await client.getManga(mangaId);

      if (!manga) {
        return createErrorResult(new Error(`Manga ${id} not found`));
      }

      return createSuccessResult(this.transformMangaToIntegrationData(manga));
    } catch (error) {
      logger.error('Suwayomi getMangaById failed', { id, error });
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get manga by title
   */
  public async getMangaByTitle(
    title: string
  ): Promise<AsyncResult<IntegrationMangaData, Error>> {
    // Search and return first result
    const searchResult = await this.search(title, { limit: 1 });

    if (isSuccess(searchResult) && searchResult.data.length > 0) {
      const firstResult = searchResult.data[0];
      if (firstResult) {
        return this.getMangaById(firstResult.id);
      }
    }

    return createErrorResult(new Error(`Manga "${title}" not found`));
  }

  /**
   * Get chapters for a manga
   */
  public async getChapters(
    mangaId: string | number,
    options?: { limit?: number; offset?: number; translatedLanguage?: string[] }
  ): Promise<AsyncResult<ChapterEntity[], Error>> {
    try {
      const client = this.getClient();
      if (!client) {
        return createErrorResult(new Error('Suwayomi client not available'));
      }

      const id = typeof mangaId === 'string' ? parseInt(mangaId, 10) : mangaId;
      const result = await client.getChapters(id, options?.limit);

      const chapters: ChapterEntity[] = result.chapters.map((chapter) =>
        this.transformChapterToEntity(chapter, id)
      );

      // Apply offset if provided
      if (options?.offset) {
        return createSuccessResult(chapters.slice(options.offset));
      }

      return createSuccessResult(chapters);
    } catch (error) {
      logger.error('Suwayomi getChapters failed', { mangaId, error });
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get adapter status
   */
  public async getStatus(): Promise<
    AsyncResult<{ status: 'ok' | 'error'; message?: string }, Error>
  > {
    try {
      const client = this.getClient();
      if (!client) {
        return createSuccessResult({
          status: 'error',
          message: 'Suwayomi client not initialized',
        });
      }

      const healthy = await client.checkServerHealth();
      return createSuccessResult({
        status: healthy ? 'ok' : 'error',
        message: healthy ? 'Suwayomi server is running' : 'Suwayomi server is not responding',
      });
    } catch (error) {
      return createSuccessResult({
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Search manga (alias for search)
   */
  public async searchManga(
    query: string,
    options?: SearchOptions
  ): Promise<AsyncResult<MangaMetadata[], Error>> {
    const result = await this.search(query, options);

    if (isError(result)) {
      return createErrorResult(result.error);
    }

    if (!isSuccess(result)) {
      return createSuccessResult([]);
    }

    const metadata: MangaMetadata[] = result.data.map((r: MangaSearchResult) => ({
      id: String(r.id),
      title: r.title,
      description: r.description,
      coverImage: r.coverImage,
      status: r.status,
      genres: r.genres,
      tags: r.tags,
      authors: r['authors'] as string[] | undefined,
    }));

    return createSuccessResult(metadata);
  }

  /**
   * Update manga metadata (not supported - Suwayomi is read-only)
   */
  public updateMangaMetadata(
    _mangaId: string | number
  ): Promise<AsyncResult<void, Error>> {
    return Promise.resolve(
      createErrorResult(
        new Error('Suwayomi adapter does not support metadata updates')
      )
    );
  }

  /**
   * Configure the adapter
   */
  public configure(config: Partial<SuwayomiSourceAdapterConfig>): void {
    this.config = { ...this.config, ...config };

    // Reinitialize client if URL changed
    if (config.host || config.port || config.graphqlHttpUrl) {
      this.graphqlClient = null;
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): SuwayomiSourceAdapterConfig {
    return { ...this.config };
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    if (this.graphqlClient) {
      void this.graphqlClient.dispose();
      this.graphqlClient = null;
    }
  }

  // ===========================================================================
  // Source Management Methods
  // ===========================================================================

  /**
   * Get all installed sources
   */
  public async getSources(): Promise<AsyncResult<SourceType[], Error>> {
    try {
      const client = this.getClient();
      if (!client) {
        return createErrorResult(new Error('Suwayomi client not available'));
      }

      const sources = await client.getSources();
      return createSuccessResult(sources);
    } catch (error) {
      logger.error('Failed to get sources', { error });
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get all extensions
   */
  public async getExtensions(): Promise<AsyncResult<ExtensionType[], Error>> {
    try {
      const client = this.getClient();
      if (!client) {
        return createErrorResult(new Error('Suwayomi client not available'));
      }

      const extensions = await client.getExtensions();
      return createSuccessResult(extensions);
    } catch (error) {
      logger.error('Failed to get extensions', { error });
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Install an extension
   */
  public async installExtension(pkgName: string): Promise<AsyncResult<boolean, Error>> {
    try {
      const client = this.getClient();
      if (!client) {
        return createErrorResult(new Error('Suwayomi client not available'));
      }

      const success = await client.installExtension(pkgName);
      return createSuccessResult(success);
    } catch (error) {
      logger.error('Failed to install extension', { pkgName, error });
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Uninstall an extension
   */
  public async uninstallExtension(pkgName: string): Promise<AsyncResult<boolean, Error>> {
    try {
      const client = this.getClient();
      if (!client) {
        return createErrorResult(new Error('Suwayomi client not available'));
      }

      const success = await client.uninstallExtension(pkgName);
      return createSuccessResult(success);
    } catch (error) {
      logger.error('Failed to uninstall extension', { pkgName, error });
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  // ===========================================================================
  // Multi-Source Search Methods
  // ===========================================================================

  /**
   * Search manga across multiple sources
   */
  public async searchMultiSource(
    query: string,
    options?: MultiSourceSearchOptions
  ): Promise<AsyncResult<SuwayomiMangaSearchResult[], Error>> {
    try {
      const client = this.getClient();
      if (!client) {
        return createErrorResult(new Error('Suwayomi client not available'));
      }

      // Get all sources
      const allSources = await client.getSources();

      // Filter sources
      let sourcesToSearch = allSources.filter(
        (s) => s.extension.isInstalled === true
      );

      // Filter by language if specified
      if (options?.languages?.length) {
        const languages = options.languages;
        sourcesToSearch = sourcesToSearch.filter((s) =>
          languages.includes(s.lang)
        );
      }

      // Filter by NSFW
      if (!options?.includeNsfw) {
        sourcesToSearch = sourcesToSearch.filter((s) => !s.isNsfw);
      }

      // Filter by specific source IDs
      if (options?.sourceIds?.length) {
        const sourceIds = options.sourceIds;
        sourcesToSearch = sourcesToSearch.filter((s) =>
          sourceIds.includes(String(s.id))
        );
      }

      if (sourcesToSearch.length === 0) {
        return createSuccessResult([]);
      }

      // Search all sources in parallel
      const searchPromises = sourcesToSearch.map(async (source) => {
        try {
          const result = await client.searchSourceManga(
            String(source.id),
            query,
            options?.page ?? 1
          );
          return {
            source,
            mangas: result.mangas,
          };
        } catch {
          return { source, mangas: [] };
        }
      });

      const results = await Promise.all(searchPromises);

      // Aggregate results
      const allResults: SuwayomiMangaSearchResult[] = [];
      for (const { source, mangas } of results) {
        for (const manga of mangas) {
          allResults.push({
            ...this.transformMangaToSearchResult(manga, source),
            sourceId: String(source.id),
            sourceName: source.name,
            sourceIconUrl: source.iconUrl,
          });
        }
      }

      // Apply limit
      const limit = options?.limit ?? this.config.defaultPageSize;
      return createSuccessResult(allResults.slice(0, limit));
    } catch (error) {
      logger.error('Multi-source search failed', { query, error });
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  // ===========================================================================
  // Download Management Methods
  // ===========================================================================

  /**
   * Enqueue chapters for download
   */
  public async enqueueDownload(
    chapterIds: number[]
  ): Promise<AsyncResult<DownloadStatus, Error>> {
    try {
      const client = this.getClient();
      if (!client) {
        return createErrorResult(new Error('Suwayomi client not available'));
      }

      const status = await client.enqueueChapterDownloads(chapterIds);
      if (!status) {
        return createErrorResult(new Error('Failed to enqueue downloads'));
      }

      return createSuccessResult(status);
    } catch (error) {
      logger.error('Failed to enqueue downloads', { chapterIds, error });
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Dequeue chapters from download
   */
  public async dequeueDownload(
    chapterIds: number[]
  ): Promise<AsyncResult<DownloadStatus, Error>> {
    try {
      const client = this.getClient();
      if (!client) {
        return createErrorResult(new Error('Suwayomi client not available'));
      }

      const status = await client.dequeueChapterDownloads(chapterIds);
      if (!status) {
        return createErrorResult(new Error('Failed to dequeue downloads'));
      }

      return createSuccessResult(status);
    } catch (error) {
      logger.error('Failed to dequeue downloads', { chapterIds, error });
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get current download status
   */
  public async getDownloadStatus(): Promise<AsyncResult<DownloadStatus, Error>> {
    try {
      const client = this.getClient();
      if (!client) {
        return createErrorResult(new Error('Suwayomi client not available'));
      }

      const status = await client.getDownloadStatus();
      if (!status) {
        return createErrorResult(new Error('Failed to get download status'));
      }

      return createSuccessResult(status);
    } catch (error) {
      logger.error('Failed to get download status', { error });
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Start the downloader
   */
  public async startDownloader(): Promise<AsyncResult<DownloadStatus, Error>> {
    try {
      const client = this.getClient();
      if (!client) {
        return createErrorResult(new Error('Suwayomi client not available'));
      }

      const status = await client.startDownloader();
      if (!status) {
        return createErrorResult(new Error('Failed to start downloader'));
      }

      return createSuccessResult(status);
    } catch (error) {
      logger.error('Failed to start downloader', { error });
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Stop the downloader
   */
  public async stopDownloader(): Promise<AsyncResult<DownloadStatus, Error>> {
    try {
      const client = this.getClient();
      if (!client) {
        return createErrorResult(new Error('Suwayomi client not available'));
      }

      const status = await client.stopDownloader();
      if (!status) {
        return createErrorResult(new Error('Failed to stop downloader'));
      }

      return createSuccessResult(status);
    } catch (error) {
      logger.error('Failed to stop downloader', { error });
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Clear the download queue
   */
  public async clearDownloadQueue(): Promise<AsyncResult<DownloadStatus, Error>> {
    try {
      const client = this.getClient();
      if (!client) {
        return createErrorResult(new Error('Suwayomi client not available'));
      }

      const status = await client.clearDownloadQueue();
      if (!status) {
        return createErrorResult(new Error('Failed to clear download queue'));
      }

      return createSuccessResult(status);
    } catch (error) {
      logger.error('Failed to clear download queue', { error });
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  // ===========================================================================
  // Chapter Operations
  // ===========================================================================

  /**
   * Get chapter pages
   */
  public async getChapterPages(chapterId: number): Promise<AsyncResult<string[], Error>> {
    try {
      const client = this.getClient();
      if (!client) {
        return createErrorResult(new Error('Suwayomi client not available'));
      }

      const pages = await client.getChapterPages(chapterId);
      return createSuccessResult(pages);
    } catch (error) {
      logger.error('Failed to get chapter pages', { chapterId, error });
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Fetch chapters from source (refresh)
   */
  public async fetchChaptersFromSource(
    mangaId: number
  ): Promise<AsyncResult<ChapterType[], Error>> {
    try {
      const client = this.getClient();
      if (!client) {
        return createErrorResult(new Error('Suwayomi client not available'));
      }

      const chapters = await client.fetchChapters(mangaId);
      return createSuccessResult(chapters);
    } catch (error) {
      logger.error('Failed to fetch chapters from source', { mangaId, error });
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Update chapter read status
   */
  public async updateChapterRead(
    chapterId: number,
    isRead: boolean
  ): Promise<AsyncResult<ChapterType, Error>> {
    try {
      const client = this.getClient();
      if (!client) {
        return createErrorResult(new Error('Suwayomi client not available'));
      }

      const chapter = await client.updateChapter(chapterId, { isRead });
      if (!chapter) {
        return createErrorResult(new Error('Failed to update chapter'));
      }

      return createSuccessResult(chapter);
    } catch (error) {
      logger.error('Failed to update chapter read status', { chapterId, error });
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Get or create the GraphQL client
   */
  private getClient(): SuwayomiGraphQLClient | null {
    if (!this.config.enabled) {
      return null;
    }

    if (!this.graphqlClient) {
      const httpUrl =
        this.config.graphqlHttpUrl ??
        `http://${this.config.host}:${this.config.port}/api/graphql`;
      const wsUrl =
        this.config.graphqlWsUrl ??
        `ws://${this.config.host}:${this.config.port}/api/graphql`;

      const clientConfig: Partial<SuwayomiGraphQLConfig> = {
        httpUrl,
        wsUrl,
      };

      if (this.config.auth) {
        clientConfig.basicAuth = this.config.auth;
      }

      this.graphqlClient = getSuwayomiGraphQLClient(clientConfig);
    }

    return this.graphqlClient;
  }

  /**
   * Transform Suwayomi manga to search result
   */
  private transformMangaToSearchResult(
    manga: MangaType,
    source: SourceType
  ): MangaSearchResult {
    const result: MangaSearchResult = {
      id: String(manga.id),
      title: manga.title,
      status: this.mapMangaStatus(manga.status),
      genres: manga.genre,
      tags: [],
      authors: [manga.author, manga.artist].filter(Boolean) as string[],
      provider: 'suwayomi',
      source: source.name,
      sourceId: String(source.id),
      externalId: String(manga.id),
    };

    if (manga.description) {
      result.description = manga.description;
    }
    if (manga.thumbnailUrl) {
      result.coverImage = manga.thumbnailUrl;
    }

    return result;
  }

  /**
   * Transform Suwayomi manga to integration data
   */
  private transformMangaToIntegrationData(manga: MangaType): IntegrationMangaData {
    const result: IntegrationMangaData = {
      id: manga.id,
      title: manga.title,
      status: this.mapMangaStatus(manga.status),
      genres: manga.genre,
      tags: [],
      authors: [manga.author, manga.artist].filter(Boolean) as string[],
      sourceId: manga.sourceId,
      url: manga.url,
      inLibrary: manga.inLibrary,
    };

    if (manga.description) {
      result.description = manga.description;
    }
    if (manga.thumbnailUrl) {
      result.coverUrl = manga.thumbnailUrl;
    }

    return result;
  }

  /**
   * Transform Suwayomi chapter to ChapterEntity
   * Note: Some fields are mapped to compatible Chapter model fields
   */
  private transformChapterToEntity(
    chapter: ChapterType,
    mangaId: number
  ): ChapterEntity {
    return {
      id: chapter.id,
      mangaId,
      number: chapter.chapterNumber,
      chapterNumber: chapter.chapterNumber,
      title: chapter.name,
      fileName: `chapter-${chapter.id}`,
      index: chapter.sourceOrder,
      size: 0,
      volume: null,
      volumeId: null,
      releaseDate: new Date(chapter.uploadDate),
      language: 'en',
      pageCount: chapter.pageCount,
      pageCountAttempts: 0,
      pages: chapter.pageCount,
      isRead: chapter.isRead,
      monitored: true,
      createdAt: new Date(chapter.fetchedAt),
      updatedAt: new Date(),
      filePath: null,
      hash: null,
      downloadStatus: chapter.isDownloaded ? 'COMPLETED' : 'PENDING',
      downloadUrl: chapter.realUrl ?? chapter.url,
      mimeType: null,
      resolutionWidth: null,
      resolutionHeight: null,
      resolutionLabel: null,
      alternativeTitles: [],
      coverImage: null,
      description: null,
      fileFormat: null,
      packDownloadId: null,
      mangadexId: null,
      suwayomiChapterId: null,
    };
  }

  /**
   * Map Suwayomi status to standard status
   */
  private mapMangaStatus(
    status: MangaType['status']
  ): 'ongoing' | 'completed' | 'hiatus' | 'cancelled' | 'unknown' {
    switch (status) {
      case 'ONGOING':
        return 'ongoing';
      case 'COMPLETED':
      case 'PUBLISHING_FINISHED':
        return 'completed';
      case 'ON_HIATUS':
        return 'hiatus';
      case 'CANCELLED':
        return 'cancelled';
      default:
        return 'unknown';
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let adapterInstance: SuwayomiSourceAdapter | null = null;

/**
 * Get or create the singleton adapter instance
 */
export function getSuwayomiSourceAdapter(
  config?: Partial<SuwayomiSourceAdapterConfig>
): SuwayomiSourceAdapter {
  if (!adapterInstance) {
    adapterInstance = new SuwayomiSourceAdapter(config);
  } else if (config) {
    adapterInstance.configure(config);
  }
  return adapterInstance;
}

/**
 * Create a new adapter instance (non-singleton)
 */
export function createSuwayomiSourceAdapter(
  config?: Partial<SuwayomiSourceAdapterConfig>
): SuwayomiSourceAdapter {
  return new SuwayomiSourceAdapter(config);
}

// Types are exported with their interface definitions above
