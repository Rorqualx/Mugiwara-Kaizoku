/**
 * Base Native Download Adapter
 *
 * This adapter provides integration with native download manga sources
 * using the AsyncResult pattern for all operations.
 */

import { ChapterStatus } from '@prisma/client';

import type { 
  NativeDownloadProviderConfig,
  NativeDownloadChapterData,
  NativeDownloadSearchOptions,
  DownloadLink
} from '@/types/adapters/native-download-types';
import type { 
  MangaSearchResult, 
  MangaMetadata 
} from '@/types/search.types';
import type { 
  AsyncResult} from '@/utils/async-result';
import { 
  createSuccessResult, 
  createErrorResult, 
  isSuccess 
} from '@/utils/async-result';
import { toStringId } from '@/utils/id-converters';
import type { 
  IntegrationAdapter, 
  IntegrationMangaData, 
  MetadataSourceInfo,
  SearchOptions 
} from '@/utils/integration-adapter';
import { logger } from '@/utils/logger';


import type { Chapter as ChapterEntity } from '@prisma/client';
export abstract class BaseNativeDownloadAdapter implements IntegrationAdapter<NativeDownloadProviderConfig> {
  protected config: NativeDownloadProviderConfig;
  protected source: string;
  protected scraper: unknown; // WebScraper instance
  constructor(config: NativeDownloadProviderConfig, source: string) {
    this.config = config;
    this["source"] = source;
    // this.scraper = new WebScraper(config); // Will be uncommented when WebScraper is available
  }
  // IntegrationAdapter implementation - ALL methods return AsyncResult
  isEnabled(): boolean {
    return !!this.config.enabled;
  }
  getSourceInfo(): MetadataSourceInfo {
    return {
      id: this["source"],
      name: this.config["name"] || this["source"],
      type: 'NATIVE_DOWNLOAD',
      baseUrl: this.config.baseUrl,
      supportedFeatures: ['search', 'metadata', 'chapters', 'download'],
      isActive: this.isEnabled()
    };
  }
  async search(query: string, options?: SearchOptions): Promise<AsyncResult<MangaSearchResult[], Error>> {
    try {
      this.log(`Searching for: ${query}`);
      // Map SearchOptions to NativeDownloadSearchOptions
      const configId = this.config.id;
      const nativeDownloadOptions: NativeDownloadSearchOptions = {
        query,
        ...(options?.limit !== undefined && { limit: options.limit }),
        ...(options?.offset !== undefined && { offset: options.offset }),
        sourceIds: [configId],
        includeCover: true
      };
      const searchUrl = this.buildSearchUrl(query, nativeDownloadOptions);
      // Type guard for scraper
      if (!this.scraper || typeof this.scraper !== 'object') {
        return createErrorResult(new Error('Scraper not initialized'));
      }
      const scraper = this.scraper as {
        fetchPage: (url: string) => Promise<unknown>;
        extractSearchResults: (html: string) => Promise<unknown>;
      };
      const result = await scraper.fetchPage(searchUrl);
      if (result === null || typeof result !== 'string') {
        return createErrorResult(new Error('Failed to fetch search page'));
      }
      const html = result;
      const resultsData = await scraper.extractSearchResults(html);
      if (!Array.isArray(resultsData)) {
        return createErrorResult(new Error('Invalid search results format'));
      }
      const results = resultsData;
      this.log(`Found ${results.length} results`);
      return createSuccessResult(results);
    } catch (error: unknown) {
      this.log('Search failed', error);
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }
  async getMangaById(id: string | number): Promise<AsyncResult<IntegrationMangaData, Error>> {
    try {
      this.log(`Getting manga by ID: ${id}`);
      const mangaUrl = this.buildMangaUrl(toStringId(id));
      // Type guard for scraper
      if (!this.scraper || typeof this.scraper !== 'object') {
        return createErrorResult(new Error('Scraper not initialized'));
      }
      const scraper = this.scraper as {
        fetchPage: (url: string) => Promise<unknown>;
        extractMangaDetails: (html: string, id: string) => Promise<unknown>;
      };
      const result = await scraper.fetchPage(mangaUrl);
      if (result === null || typeof result !== 'string') {
        return createErrorResult(new Error('Failed to fetch manga page'));
      }
      const html = result;
      const detailsData = await scraper.extractMangaDetails(html, toStringId(id));
      if (!detailsData || typeof detailsData !== 'object') {
        return createErrorResult(new Error('Invalid manga data format'));
      }
      const mangaData = detailsData as IntegrationMangaData;
      this.log(`Retrieved manga: ${mangaData["title"]}`);
      // Convert NativeDownloadMangaData to IntegrationMangaData
      const data: IntegrationMangaData = {
        id: mangaData["id"],
        title: mangaData["title"],
        ...(mangaData["description"] !== undefined && { description: mangaData["description"] }),
        ...(mangaData.coverUrl !== undefined && { coverUrl: mangaData.coverUrl }),
        ...(mangaData["status"] !== undefined && { status: mangaData["status"] }),
        ...(mangaData["genres"] !== undefined && { genres: mangaData["genres"] }),
        ...(mangaData["tags"] !== undefined && { tags: mangaData["tags"] }),
        ...(mangaData.authors !== undefined && { authors: mangaData.authors })
      };
      return createSuccessResult(data);
    } catch (error: unknown) {
      this.log('Failed to get manga', error);
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }
  async getMangaByTitle(title: string): Promise<AsyncResult<IntegrationMangaData, Error>> {
    const searchResult = await this.search(title, { limit: 1 });
    if (!isSuccess(searchResult)) {
      return searchResult as AsyncResult<IntegrationMangaData, Error>;
    }
    const results = searchResult.data;
    if (results.length === 0) {
      return createErrorResult(new Error(`No manga found with title: ${title}`));
    }
    const firstResult = results[0];
    if (firstResult === undefined) {
      return createErrorResult(new Error('No results found'));
    }
    const mangaId = firstResult.id || firstResult.sourceId;
    if (!mangaId) {
      return createErrorResult(new Error('No manga ID found in search results'));
    }
    return this.getMangaById(mangaId);
  }
  async getChapters(
    mangaId: string | number,
    options?: {
      limit?: number;
      offset?: number;
      translatedLanguage?: string[];
    }
  ): Promise<AsyncResult<ChapterEntity[], Error>> {
    try {
      this.log(`Getting chapters for manga: ${mangaId}`);
      const mangaUrl = this.buildMangaUrl(toStringId(mangaId));
      // Type guard for scraper
      if (!this.scraper || typeof this.scraper !== 'object') {
        return createErrorResult(new Error('Scraper not initialized'));
      }
      const scraper = this.scraper as {
        fetchPage: (url: string) => Promise<unknown>;
        extractChapterList: (html: string) => Promise<unknown>;
      };
      const result = await scraper.fetchPage(mangaUrl);
      if (result === null || typeof result !== 'string') {
        return createErrorResult(new Error('Failed to fetch manga page for chapters'));
      }
      const html = result;
      const chapterListData = await scraper.extractChapterList(html);
      if (!Array.isArray(chapterListData)) {
        return createErrorResult(new Error('Invalid chapter list format'));
      }
      const chapterData = chapterListData;
      this.log(`Found ${chapterData.length} chapters`);
      // Convert to ChapterEntity format
      let chapters: ChapterEntity[] = chapterData.map((ch: NativeDownloadChapterData) => 
        this.convertToChapterEntity(ch, toStringId(mangaId))
      );
      // Apply filtering based on options
      if (options?.offset) {
        chapters = chapters.slice(options.offset);
      }
      if (options?.limit) {
        chapters = chapters.slice(0, options.limit);
      }
      return createSuccessResult(chapters);
    } catch (error: unknown) {
      this.log('Failed to get chapters', error);
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }
  async getStatus(): Promise<AsyncResult<{ status: 'ok' | 'error'; message?: string }, Error>> {
    try {
      // Type guard for scraper
      if (!this.scraper || typeof this.scraper !== 'object') {
        return createSuccessResult({
          status: 'error',
          message: 'Scraper not initialized'
        });
      }
      const scraper = this.scraper as {
        fetchPage: (url: string) => Promise<unknown>;
      };
      // Test connection by fetching the base URL
      const html = await scraper.fetchPage(this.config.baseUrl);
      if (html && typeof html === 'string') {
        return createSuccessResult({ status: 'ok' });
      }
      return createSuccessResult({
        status: 'error',
        message: 'Could not connect to source'
      });
    } catch (error: unknown) {
      return createSuccessResult({
        status: 'error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
  async searchManga(query: string, options?: SearchOptions): Promise<AsyncResult<MangaMetadata[], Error>> {
    const result = await this.search(query, options);
    if (!isSuccess(result)) {
      return result as AsyncResult<MangaMetadata[], Error>;
    }
    // Convert MangaSearchResult[] to MangaMetadata[]
    const metadata: MangaMetadata[] = result.data.map(item => ({
      ...item,
      // Add any additional MangaMetadata fields if needed
    } as MangaMetadata));
    return createSuccessResult(metadata);
  }
  async getMangaMetadataById(sourceId: string | number): Promise<AsyncResult<MangaMetadata | null, Error>> {
    const result = await this.getMangaById(sourceId);
    if (!isSuccess(result)) {
      return createSuccessResult(null);
    }
    // Convert IntegrationMangaData to MangaMetadata
    const metadata: MangaMetadata = {
      id: result.data["id"],
      title: result.data["title"],
      description: result.data["description"] ?? '',
      coverImage: result.data.coverUrl ?? '',
      status: result.data["status"],
      genres: result.data["genres"] ?? [],
      tags: result.data["tags"] ?? [],
      authors: result.data["authors"] ?? [],
      // Add other MangaMetadata fields
    } as MangaMetadata;
    return createSuccessResult(metadata);
  }
  updateMangaMetadata(_mangaId: string | number): Promise<AsyncResult<void, Error>> {
    // Native download adapters don't update metadata
    return Promise.resolve(createSuccessResult(undefined));
  }
  updateAllMangaMetadata(_limit?: number): Promise<AsyncResult<number, Error>> {
    // Native download adapters don't update metadata
    return Promise.resolve(createSuccessResult(0));
  }
  // Native Download-specific methods
  async getDownloadLinks(mangaId: string, chapterId: string): Promise<AsyncResult<DownloadLink[], Error>> {
    try {
      this.log(`Getting download links for chapter: ${chapterId}`);
      const chapterUrl = this.buildChapterUrl(mangaId, chapterId);
      // Type guard for scraper
      if (!this.scraper || typeof this.scraper !== 'object') {
        return createErrorResult(new Error('Scraper not initialized'));
      }
      const scraper = this.scraper as {
        fetchPage: (url: string) => Promise<unknown>;
        extractDownloadLinks: (html: string) => Promise<unknown>;
      };
      const result = await scraper.fetchPage(chapterUrl);
      if (result === null || typeof result !== 'string') {
        return createErrorResult(new Error('Failed to fetch chapter page'));
      }
      const html = result;
      const linksData = await scraper.extractDownloadLinks(html);
      if (!Array.isArray(linksData)) {
        return createErrorResult(new Error('Invalid download links format'));
      }
      const links = linksData;
      this.log(`Found ${links.length} download links`);
      return createSuccessResult(links);
    } catch (error: unknown) {
      this.log('Failed to get download links', error);
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }
  async validateWebsite(url: string): Promise<AsyncResult<{ isValid: boolean; errors?: string[] }, Error>> {
    try {
      // Type guard for scraper
      if (!this.scraper || typeof this.scraper !== 'object') {
        return createSuccessResult({
          isValid: false,
          errors: ['Scraper not initialized']
        });
      }
      const scraper = this.scraper as {
        fetchPage: (url: string) => Promise<unknown>;
      };
      const fetchResult = await scraper.fetchPage(url);
      if (fetchResult === null || typeof fetchResult !== 'string') {
        return createSuccessResult({
          isValid: false,
          errors: ['Failed to fetch website']
        });
      }
      const html = fetchResult;
      // Test if we can extract basic structure
      const configWithSelectors = this.config as NativeDownloadProviderConfig & { selectors?: unknown };
      const testResult = await this.testSelectors(html, configWithSelectors.selectors);
      const missingFields: string[] = [];
      for (const [field, success] of Object.entries(testResult)) {
        if (!success) {
          missingFields.push(field);
        }
      }
      const validationResult: { isValid: boolean; errors?: string[] } = {
        isValid: missingFields.length === 0
      };
      if (missingFields.length > 0) {
        validationResult.errors = [`Missing selectors: ${missingFields.join(', ')}`];
      }
      return createSuccessResult(validationResult);
    } catch (error: unknown) {
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }
  // Legacy compatibility - these just delegate to the main methods
  async searchAsync(query: string, options?: SearchOptions): Promise<AsyncResult<MangaSearchResult[], Error>> {
    return this.search(query, options);
  }
  async getMangaByIdAsync(id: string | number): Promise<AsyncResult<IntegrationMangaData, Error>> {
    return this.getMangaById(id);
  }
  async getMangaByTitleAsync(title: string): Promise<AsyncResult<IntegrationMangaData, Error>> {
    return this.getMangaByTitle(title);
  }
  async getChaptersAsync(
    mangaId: string | number, 
    options?: { limit?: number; offset?: number; translatedLanguage?: string[] }
  ): Promise<AsyncResult<ChapterEntity[], Error>> {
    return this.getChapters(mangaId, options);
  }
  async getStatusAsync(): Promise<AsyncResult<{ status: 'ok' | 'error'; message?: string }, Error>> {
    return this.getStatus();
  }
  // Configuration methods
  configure(config: Partial<NativeDownloadProviderConfig>): void {
    this.config = { ...this.config, ...config };
  }
  getConfig(): NativeDownloadProviderConfig {
    return this.config;
  }
  dispose(): void {
    // Cleanup if needed
  }
  // Helper methods
  protected log(message: string, error?: unknown): void {
    if (this.config["debug"]) {
      logger.info(`[${this["source"]}] ${message}`, error ?? '');
    }
  }
  protected abstract buildSearchUrl(query: string, options?: NativeDownloadSearchOptions): string;
  protected abstract buildMangaUrl(mangaId: string): string;
  protected abstract buildChapterUrl(mangaId: string, chapterId: string): string;
  protected abstract testSelectors(html: string, selectors: unknown): Promise<Record<string, boolean>>;
  protected convertToChapterEntity(chapter: NativeDownloadChapterData, mangaId: string): ChapterEntity {
    // Convert NativeDownloadChapterData to Prisma ChapterEntity
    // Note: This is a partial mapping - actual implementation would need all required fields
    return {
      // Required fields
      id: parseInt(chapter["id"]),
      mangaId: parseInt(mangaId),
      title: chapter["title"] ?? '',
      fileName: '',
      index: chapter.number,
      size: 0,
      // Optional number fields
      chapterNumber: chapter.number,
      number: chapter.number,
      pages: Array.isArray(chapter.pages) ? chapter.pages.length : null,
      pageCount: null,
      pageCountAttempts: 0,
      // Resolution fields
      resolutionWidth: null,
      resolutionHeight: null,
      resolutionLabel: null,
      // Content fields
      description: null,
      language: null,
      downloadStatus: ChapterStatus.AVAILABLE,
      downloadUrl: chapter.url,
      coverImage: null,
      hash: null,
      mimeType: null,
      volume: null,
      volumeId: null,
      filePath: null,
      fileFormat: null,
      releaseDate: null,
      isRead: false,
      // Missing required fields
      alternativeTitles: [],
      monitored: false,
      packDownloadId: null,
      mangadexId: null,
      suwayomiChapterId: null,
      // Timestamps
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
}