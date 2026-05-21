/**
 * Wikipedia Provider Strategy
 * 
 * Implements the provider strategy pattern for Wikipedia.
 * Wraps the existing WikipediaService with the unified provider interface.
 */

import { MetadataProvider } from '@prisma/client';

import { parseURL } from '@/server/parsers/unified';
import WikipediaService from '@/server/services/wikipedia/wikipedia/service';
import type { SearchResult, MangaMetadata } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';
import { mapToMangaStatus } from '@/utils/status-mapper';


import type { ProviderStrategy, ProviderConfig } from '../registry';
// ============================================================================
// Wikipedia Provider Strategy Implementation
// ============================================================================
export class WikipediaProviderStrategy implements ProviderStrategy {
  public readonly name = 'Wikipedia';
  public readonly type = MetadataProvider.WIKIPEDIA;
  private service: WikipediaService;
  private config: ProviderConfig;
  constructor(config?: Partial<ProviderConfig>) {
    this.service = new WikipediaService();
    this.config = {
      enabled: true,
      priority: 3,
      timeout: 20000,
      rateLimit: {
        requests: 20,
        window: 1000 // 20 requests per second
      },
      fallbackProviders: [MetadataProvider.FANDOM],
      ...config
    };
  }
  /**
   * Search for manga on Wikipedia
   */
  public async search(
    query: string,
    _options?: unknown
  ): Promise<AsyncResult<SearchResult[], Error>> {
    try {
      // Use the existing WikipediaService search
      const searchResults = await this.service.searchManga(query);
      if (searchResults.length === 0) {
        return createSuccessResult([]);
      }
      // Convert to unified SearchResult format
      const results: SearchResult[] = searchResults.map(result => this.convertToSearchResult(result));
      return createSuccessResult(results);
    } catch (error: unknown) {
  logger.error(`Wikipedia search failed for query "${query}":`, error);
      return createErrorResult(
        error instanceof Error ? error : new Error(`Wikipedia search failed: ${String(error)}`)
      );
    }
  }
  /**
   * Get detailed metadata for a manga
   */
  public async getMetadata(
    id: string,
    _options?: unknown
  ): Promise<AsyncResult<MangaMetadata, Error>> {
    try {
      // Check if ID is a URL
      const isUrl = id.startsWith('http://') || id.startsWith('https://');
      if (isUrl) {
        // Use unified parser for URL
        const parseResult = await parseURL(id, { source: 'wikipedia' });
        return createSuccessResult(this.convertToMangaMetadata(parseResult));
      } else {
        // Use WikipediaService for page title/ID
        const mangaInfo = await this.service.getMangaInfo(id);
        return createSuccessResult(this.convertToMangaMetadata(mangaInfo));
      }
    } catch (error: unknown) {
  logger.error(`Wikipedia metadata fetch failed for ID "${id}":`, error);
      return createErrorResult(
        error instanceof Error ? error : new Error(`Wikipedia metadata fetch failed: ${String(error)}`)
      );
    }
  }
  /**
   * Check if provider is enabled
   */
  public isEnabled(): Promise<boolean> {
    return Promise.resolve(this.config.enabled);
  }
  /**
   * Get provider configuration
   */
  public getConfig(): ProviderConfig {
    return { ...this.config };
  }
  /**
   * Update provider configuration
   */
  public updateConfig(config: Partial<ProviderConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
    if (config.enabled !== undefined) {
      logger.info(`Wikipedia provider ${config.enabled ? 'enabled' : 'disabled'}`);
    }
  }
  /**
   * Convert Wikipedia search result to unified SearchResult
   */
  private convertToSearchResult(wikipediaResult: unknown): SearchResult {
    const result = wikipediaResult as Record<string, unknown>;
    const thumbnail = result["thumbnail"] as Record<string, unknown> | undefined;
    const metadata = result["metadata"] as Record<string, unknown> | undefined;
    const pageid = result["pageid"];
    const title = result["title"] as string;
    const redirects = result["redirects"] as string[] | undefined;
    const extract = result["extract"] as string | undefined;
    const snippet = result["snippet"] as string | undefined;
    const url = result["url"] as string | undefined;
    const thumbnailSource = thumbnail?.["source"] as string | undefined;

    return {
      id: (pageid?.toString() ?? title) || '',
      title: title,
      type: 'manga',
      alternativeTitles: redirects ?? [],
      description: extract ?? snippet ?? '',
      coverImage: thumbnailSource ?? '',
      url: url ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      provider: MetadataProvider.WIKIPEDIA,
      metadata: {
        pageid: result["pageid"],
        categories: result["categories"],
        lastModified: result["touched"],
        wordCount: result["wordcount"],
        ...(metadata ?? {})
      }
    };
  }
  /**
   * Convert Wikipedia data to unified MangaMetadata
   * Complex due to parsing diverse Wikipedia infobox formats and field mappings
   */
  // eslint-disable-next-line max-statements, complexity
  private convertToMangaMetadata(data: unknown): MangaMetadata {
    const dataObj = data as Record<string, unknown>;
    const metadata = dataObj["metadata"] as Record<string, unknown> | undefined;
    const infobox = dataObj["infobox"] as Record<string, unknown> | undefined;
    // Handle parsed content from unified parser
    if (metadata || infobox) {
      const title = dataObj["title"] as string | undefined;
      const alternativeTitles = metadata?.["alternativeTitles"] as string[] | undefined;
      const description = dataObj["description"] as string | undefined;
      const extract = dataObj["extract"] as string | undefined;
      const coverImage = dataObj["coverImage"] as string | undefined;
      const infoboxImage = infobox?.["image"] as string | undefined;
      const metadataStatus = metadata?.["status"] as string | undefined;
      const infoboxStatus = infobox?.["status"] as string | undefined;
      const genres = metadata?.["genres"] as string[] | undefined;
      const tags = metadata?.["tags"] as string[] | undefined;

      const result: MangaMetadata = {
        title: title ?? '',
        alternativeTitles: alternativeTitles ?? [],
        description: description ?? extract ?? '',
        coverImage: coverImage ?? infoboxImage ?? '',
        status: mapToMangaStatus(metadataStatus ?? infoboxStatus ?? 'UNKNOWN'),
        genres: genres ?? [],
        tags: tags ?? [],
        authors: this.extractAuthors(infobox?.["author"] ?? metadata?.["author"]),
        artists: this.extractAuthors(infobox?.["illustrator"] ?? metadata?.["artist"]),
        externalLinks: this.extractExternalLinks(infobox)
      };
      // Conditional property assignments for exactOptionalPropertyTypes
      const bannerImage = metadata?.["bannerImage"] as string | undefined;
      if (bannerImage) {
        result.bannerImage = bannerImage;
      }
      const infoboxPublisher = infobox?.["publisher"] as string | undefined;
      const metadataPublisher = metadata?.["publisher"] as string | undefined;
      const publisher = infoboxPublisher ?? metadataPublisher;
      if (publisher) {
        result.publisher = publisher;
      }
      const year = this.extractYear(infobox?.["published"] ?? metadata?.["year"]);
      if (year !== undefined) {
        result.year = year;
      }
      const volumes = infobox?.["volumes"] ?? metadata?.["volumes"];
      if (volumes !== undefined) {
        result.volumes = volumes as number;
      }
      const chapters = infobox?.["chapters"] ?? metadata?.["chapters"];
      if (chapters !== undefined) {
        result.chapters = chapters as number;
      }
      const popularity = metadata?.["popularity"];
      if (popularity !== undefined) {
        result.popularity = popularity as number;
      }
      return result;
    }
    // Handle WikipediaService format
    const thumbnail = dataObj["thumbnail"] as Record<string, unknown> | undefined;
    const categories = dataObj["categories"] as string[] | undefined;
    const serviceTitle = dataObj["title"] as string | undefined;
    const serviceRedirects = dataObj["redirects"] as string[] | undefined;
    const serviceExtract = dataObj["extract"] as string | undefined;
    const serviceThumbnail = thumbnail?.["source"] as string | undefined;
    const serviceStatus = dataObj["status"] as string | undefined;

    const serviceResult: MangaMetadata = {
      title: serviceTitle ?? '',
      alternativeTitles: serviceRedirects ?? [],
      description: serviceExtract ?? '',
      coverImage: serviceThumbnail ?? '',
      status: mapToMangaStatus(serviceStatus ?? 'UNKNOWN'),
      genres: categories?.filter((cat: string) => cat.includes('manga')) ?? [],
      tags: [],
      authors: this.extractAuthors(dataObj["author"]),
      artists: this.extractAuthors(dataObj["illustrator"]),
      externalLinks: {}
    };
    // Conditional property assignments
    const publisher = dataObj["publisher"] as string | undefined;
    if (publisher) {
      serviceResult.publisher = publisher;
    }
    const year = this.extractYear(dataObj["published"]);
    if (year !== undefined) {
      serviceResult.year = year;
    }
    const volumes = dataObj["volumes"];
    if (volumes !== undefined) {
      serviceResult.volumes = volumes as number;
    }
    const chapters = dataObj["chapters"];
    if (chapters !== undefined) {
      serviceResult.chapters = chapters as number;
    }
    return serviceResult;
  }
  /**
   * Extract authors from various formats
   */
  private extractAuthors(authorData: unknown): string[] {
    if (!authorData) return [];
    if (Array.isArray(authorData)) {
      return authorData.filter((item): item is string => typeof item === 'string');
    }
    if (typeof authorData === 'string') {
      return authorData.split(/[,;&]/).map(a => a.trim()).filter(Boolean);
    }
    return [];
  }
  /**
   * Extract year from published date
   */
  private extractYear(published: unknown): number | undefined {
    if (!published) return undefined;
    const yearMatch = String(published).match(/\b(19|20)\d{2}\b/);
    return yearMatch ? parseInt(yearMatch[0], 10) : undefined;
  }
  /**
   * Extract external links from infobox
   */
  private extractExternalLinks(infobox: unknown): Record<string, string> {
    const links: Record<string, string> = {};
    if (!infobox) return links;
    const infoboxObj = infobox as Record<string, unknown>;
    const website = infoboxObj["website"];
    if (website) {
      links["official"] = website as string;
    }
    const englishPublisher = infoboxObj["english publisher"];
    if (englishPublisher) {
      links["englishPublisher"] = englishPublisher as string;
    }
    return links;
  }
}
// ============================================================================
// Exports
// ============================================================================
export default WikipediaProviderStrategy;