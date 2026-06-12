/**
 * Unified Parser Adapter
 *
 * Integrates the new unified metadata parser with the existing metadata provider system.
 * Provides a bridge between the legacy provider interface and the new parser architecture.
 */

import { ContentRating } from '@prisma/client';

import type { ApiClientConfig } from '@/server/base/ApiClient';
import { 
  MetadataProvider} from '@/server/base/MetadataProvider';
import type { 
  Manga, 
  Chapter, 
  SearchOptions, 
  GetChaptersOptions
} from '@/server/base/MetadataProvider';
import { FandomAdapter } from '@/server/parsers/adapters/FandomAdapter';
import { WikipediaAdapter } from '@/server/parsers/adapters/WikipediaAdapter';
import { CachedUnifiedParser } from '@/server/parsers/CachedUnifiedParser';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult} from '@/utils/async-result';
import { logger } from '@/utils/logger';
import { mapToMangaStatus } from '@/utils/status-mapper';


import type { MangaPublicationStatus as DomainMangaStatus } from '@prisma/client';
// ============================================================================
// Configuration
// ============================================================================
export interface UnifiedParserConfig extends Partial<ApiClientConfig> {
  baseURL?: string;
  cacheTTL?: number;
  cacheNamespace?: string;
  sources?: Array<'fandom' | 'wikipedia' | 'mangadex' | 'anilist' | 'comicvine'>;
  preferredSource?: 'fandom' | 'wikipedia' | 'auto';
  language?: string;
  enableBatchOperations?: boolean;
  performanceMonitoring?: boolean;
}

export interface ParserMetrics {
  searches: number;
  parses: number;
  cacheHits: number;
  cacheMisses: number;
  errors: number;
  cacheHitRate: number;
}
// ============================================================================
// Unified Parser Adapter Implementation
// ============================================================================
export class UnifiedParserAdapter extends MetadataProvider<Error> {
  private parser: CachedUnifiedParser;
  private fandomAdapter: FandomAdapter;
  private wikipediaAdapter: WikipediaAdapter;
  private parserConfig: UnifiedParserConfig;
  private metrics: {
    searches: number;
    parses: number;
    cacheHits: number;
    cacheMisses: number;
    errors: number;
  };
  constructor(config: UnifiedParserConfig = {}) {
    // Ensure we have a baseURL for ApiClient
    const apiConfig: ApiClientConfig = {
      baseURL: config.baseURL ?? 'https://api.unified-parser.local',
      ...config
    };
    super(apiConfig);
    this.parserConfig = {
      cacheTTL: 86400, // 24 hours
      cacheNamespace: 'unified-parser',
      sources: ['fandom', 'wikipedia'],
      preferredSource: 'auto',
      language: 'en',
      enableBatchOperations: true,
      performanceMonitoring: false,
      ...config
    };
    this.parser = new CachedUnifiedParser();
    this.fandomAdapter = new FandomAdapter();
    this.wikipediaAdapter = new WikipediaAdapter();
    this.metrics = {
      searches: 0,
      parses: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0
    };
    // Start performance monitoring if enabled
    if (this.parserConfig.performanceMonitoring) {
      this.startMonitoring();
    }
  }
  /**
   * Get provider type
   */
  public getProviderType(): string {
    return 'unified-parser';
  }
  /**
   * Search for manga across configured sources
   */
  async search(query: string, options?: SearchOptions): Promise<AsyncResult<Manga[], Error>> {
    try {
      this.metrics.searches++;
      // For unified parser, we'll use a simplified search
      // In production, this would connect to actual search endpoints
      const results: Manga[] = [];
      // Search across configured sources in parallel
      const searchPromises = (this.parserConfig.sources ?? ['fandom']).map(async (source) => {
        if (source === 'fandom') {
          // Use Fandom search
          return this.searchFandom(query, options);
        } else if (source === 'wikipedia') {
          // Use Wikipedia search
          return this.searchWikipedia(query, options);
        }
        return [];
      });

      const searchResults = await Promise.all(searchPromises);
      searchResults.forEach(sourceResults => results.push(...sourceResults));
      // Apply limit if specified
      const limit = options?.limit ?? 20;
      const limitedResults = results.slice(0, limit);
      return createSuccessResult(limitedResults);
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
this.metrics.errors++;
      return createErrorResult(errorMessage as unknown as Error);
    }
  }
  /**
   * Get manga details by ID
   */
  getManga(id: string): Promise<AsyncResult<Manga, Error>> {
    try {
      // Parse the ID to extract source and actual ID
      const [source, actualId] = id.split(':');
      // For now, return a placeholder
      // In production, this would fetch from the appropriate source
      const manga: Manga = {
        id,
        title: `Manga ${actualId}`,
        description: 'Placeholder description',
        ...(source && { source }),
        ...(actualId && { sourceId: actualId })
      };
      return Promise.resolve(createSuccessResult(manga));
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
this.metrics.errors++;
      return Promise.resolve(createErrorResult(errorMessage as unknown as Error));
    }
  }
  /**
   * Extract chapters from volume data
   * @param volumes - Array of volume objects
   * @param mangaId - Manga identifier for chapter IDs
   * @returns Array of chapters extracted from volumes
   */
  private extractChaptersFromVolumes(
    volumes: unknown[],
    mangaId: string
  ): Chapter[] {
    const chapters: Chapter[] = [];

    for (const vol of volumes) {
      // Early return: skip invalid volumes
      if (!vol || typeof vol !== 'object') continue;

      const volRecord = vol as Record<string, unknown>;
      const volChapters = volRecord["chapters"];

      // Early return: skip if no chapters array
      if (!Array.isArray(volChapters)) continue;

      for (const ch of volChapters) {
        // Early return: skip invalid chapters
        if (!ch || typeof ch !== 'object') continue;

        const chRecord = ch as Record<string, unknown>;
        chapters.push({
          id: `${mangaId}:${chRecord["chapterNumber"]}`,
          chapterNumber: chRecord["chapterNumber"],
          title: chRecord["title"],
          volumeNumber: volRecord["volumeNumber"],
          sourceUrl: chRecord["url"]
        } as Chapter);
      }
    }

    return chapters;
  }

  /**
   * Get chapters for a manga
   */
  async getChapters(mangaId: string, options?: GetChaptersOptions): Promise<AsyncResult<Chapter[], Error>> {
    try {
      this.metrics.parses++;
      // Parse manga page to get chapters
      const [_source, url] = mangaId.split(':', 2);
      if (!url) {
        return createErrorResult(new Error('Invalid manga ID format'));
      }
      // Use the cached parser with the URL
      const result = await this.parser.parseUnified(url, {
        extractImages: false,
        followLinks: false
      }) as unknown as Record<string, unknown>;
      // Convert to Chapter format
      const chapters: Chapter[] = [];
      // Extract chapters from parsed result
      if (Array.isArray(result["chapters"])) {
        for (const ch of result["chapters"]) {
          if (ch && typeof ch === 'object') {
            const chRecord = ch as Record<string, unknown>;
            chapters.push({
              id: `${mangaId}:${chRecord["chapterNumber"]}`,
              chapterNumber: chRecord["chapterNumber"],
              title: chRecord["title"],
              volumeNumber: chRecord["volumeNumber"],
              sourceUrl: chRecord["url"]
            } as Chapter);
          }
        }
      }
      // Extract chapters from volumes
      if (Array.isArray(result["volumes"])) {
        const volumeChapters = this.extractChaptersFromVolumes(
          result["volumes"] as unknown[],
          mangaId
        );
        chapters.push(...volumeChapters);
      }
      // Apply options
      let filteredChapters = chapters;
      if (options?.offset) {
        filteredChapters = filteredChapters.slice(options.offset);
      }
      if (options?.limit) {
        filteredChapters = filteredChapters.slice(0, options.limit);
      }
      return createSuccessResult(filteredChapters);
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
this.metrics.errors++;
      return createErrorResult(errorMessage as unknown as Error);
    }
  }
  /**
   * Get chapter details by ID
   */
  getChapter(id: string): Promise<AsyncResult<Chapter, Error>> {
    try {
      // Parse the chapter ID
      const parts = id.split(':');
      const chapterNumber = parts[parts.length - 1];
      const chapter: Chapter = {
        id,
        chapterNumber: chapterNumber as string | number,
        title: `Chapter ${chapterNumber}`
      };
      return Promise.resolve(createSuccessResult(chapter));
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
return Promise.resolve(createErrorResult(errorMessage as unknown as Error));
    }
  }
  /**
   * Get chapter pages
   */
  getChapterPages(_chapterId: string): Promise<AsyncResult<string[], Error>> {
    try {
      // This would need to be implemented based on the source
      // For now, return empty array
      return Promise.resolve(createSuccessResult([]));
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
return Promise.resolve(createErrorResult(errorMessage as unknown as Error));
    }
  }
  /**
   * Search Fandom wikis
   */
  private async searchFandom(query: string, _options?: SearchOptions): Promise<Manga[]> {
    // Use Fandom adapter for search
    const searchUrl = `https://${query.toLowerCase().replace(/\s+/g, '')}.fandom.com/wiki/${query.replace(/\s+/g, '_')}`;
    try {
      // Type assertion for dynamically loaded adapter with extract method
      const adapter = this.fandomAdapter as { extract: (url: string) => Promise<unknown> };
      const result = await adapter.extract(searchUrl);
      if (result && typeof result === 'object') {
        const resultRecord = result as Record<string, unknown>;
        const description = resultRecord["description"] as string | undefined;
        const coverImage = resultRecord["coverImage"] as string | undefined;
        const genres = resultRecord["genres"] as string[] | undefined;
        const status = resultRecord["status"] as DomainMangaStatus | undefined;
        const author = resultRecord["author"];
        const authors = Array.isArray(author)
          ? author.map((name: unknown) => ({ name: String(name) }))
          : undefined;

        return [{
          id: `fandom:${searchUrl}`,
          title: (resultRecord["title"] as string | undefined) ?? query,
          source: 'fandom',
          sourceUrl: searchUrl,
          ...(description !== undefined ? { description } : {}),
          ...(coverImage !== undefined ? { coverImage } : {}),
          ...(authors !== undefined ? { authors } : {}),
          ...(genres !== undefined ? { genres } : {}),
          ...(status !== undefined ? { status } : {})
        }];
      }
    } catch (error: unknown) {
      logger.error('Fandom search error:', error);
    }
    return [];
  }
  /**
   * Search Wikipedia
   */
  private async searchWikipedia(query: string, _options?: SearchOptions): Promise<Manga[]> {
    // Use Wikipedia adapter for search
    const searchUrl = `https://en.wikipedia.org/wiki/${query.replace(/\s+/g, '_')}`;
    try {
      // Type assertion for dynamically loaded adapter with extract method
      const adapter = this.wikipediaAdapter as { extract: (url: string) => Promise<unknown> };
      const result = await adapter.extract(searchUrl);
      if (result && typeof result === 'object') {
        const resultRecord = result as Record<string, unknown>;
        const description = resultRecord["description"] as string | undefined;
        const coverImage = resultRecord["coverImage"] as string | undefined;
        const genres = resultRecord["genres"] as string[] | undefined;
        const status = resultRecord["status"] as DomainMangaStatus | undefined;
        const author = resultRecord["author"];
        const authors = Array.isArray(author)
          ? author.map((name: unknown) => ({ name: String(name) }))
          : undefined;

        return [{
          id: `wikipedia:${searchUrl}`,
          title: (resultRecord["title"] as string | undefined) ?? query,
          source: 'wikipedia',
          sourceUrl: searchUrl,
          ...(description !== undefined ? { description } : {}),
          ...(coverImage !== undefined ? { coverImage } : {}),
          ...(authors !== undefined ? { authors } : {}),
          ...(genres !== undefined ? { genres } : {}),
          ...(status !== undefined ? { status } : {})
        }];
      }
    } catch (error: unknown) {
      logger.error('Wikipedia search error:', error);
    }
    return [];
  }
  /**
   * Start performance monitoring
   */
  private startMonitoring(): void {
    setInterval(() => {
      logger.info('UnifiedParser Metrics:', {
        ...this.metrics,
        cacheHitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0
      });
    }, 60000); // Log every minute
  }
  /**
   * Get current metrics
   */
  getMetrics(): ParserMetrics {
    return {
      ...this.metrics,
      cacheHitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0
    };
  }
  /**
   * Map provider-specific status to standard MangaStatus
   */
  protected mapStatus(providerStatus: unknown): DomainMangaStatus {
    const statusStr = String(providerStatus).toLowerCase();
    return mapToMangaStatus(statusStr)
  }
  /**
   * Map provider-specific content rating to standard ContentRating
   */
  protected mapContentRating(providerRating: unknown): ContentRating {
    const ratingStr = String(providerRating).toLowerCase();
    switch (ratingStr) {
      case 'safe':
      case 'g':
      case 'all ages':
        return ContentRating.ALL_AGES;
      case 'suggestive':
      case 'pg':
      case 'pg-13':
      case 'teen':
        return ContentRating.TEEN;
      case 'mature':
      case 'r':
      case '17+':
        return ContentRating.MATURE;
      case 'explicit':
      case 'nc-17':
      case '18+':
      case 'adult':
        return ContentRating.ADULTS_ONLY;
      default:
        return ContentRating.UNKNOWN;
    }
  }
  /**
   * Ping the provider to check if it's available
   */
  protected ping(): Promise<void> {
    try {
      // For unified parser, we just check if we can initialize
      // In production, this might check actual endpoints
      // If ping fails, it should throw an error
      return Promise.resolve();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Promise.reject(new Error(errorMessage));
    }
  }
}
/**
 * Factory function to create a UnifiedParserAdapter instance
 */
export function createUnifiedParserAdapter(config?: UnifiedParserConfig): UnifiedParserAdapter {
  return new UnifiedParserAdapter(config);
}