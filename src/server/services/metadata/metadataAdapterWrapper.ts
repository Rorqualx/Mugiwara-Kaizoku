/**
 * Metadata Adapter Wrapper
 * Wraps BaseMetadataAdapter implementations to provide IntegrationAdapter interface
 */

import type { BaseMetadataAdapter, BaseProviderConfig } from '@/server/adapters/base-metadata-adapter';
import type { MangaSearchResult, MangaMetadata } from '@/types/search.types';
import type { AsyncResult} from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess } from '@/utils/async-result';
import { toStringId } from '@/utils/id-converters';
import type { IntegrationAdapter, IntegrationMangaData, MetadataSourceInfo, SearchOptions } from '@/utils/integration-adapter';

import type { Chapter as ChapterEntity } from '@prisma/client';

/**
 * Helper Functions for Metadata Conversion
 */

/**
 * Extracts cover image URL from various formats
 */
function extractCoverImageUrl(coverImage: unknown): string {
  if (typeof coverImage === 'string') {
    return coverImage;
  }

  const coverImageObj = typeof coverImage === 'object' && coverImage !== null
    ? coverImage as Record<string, unknown>
    : null;

  if (!coverImageObj) {
    return '';
  }

  const large = coverImageObj["large"];
  if (typeof large === 'string') {
    return large;
  }

  const medium = coverImageObj["medium"];
  if (typeof medium === 'string') {
    return medium;
  }

  return '';
}

/**
 * Filters and extracts author names from staff array
 */
function extractAuthors(staff: unknown[]): string[] {
  return staff
    .filter((s: unknown) => {
      const sObj = s as Record<string, unknown>;
      return sObj["role"] === 'Story & Art' || sObj["role"] === 'Story';
    })
    .map((s: unknown) => (s as Record<string, unknown>)["name"] as string);
}

/**
 * Filters and extracts artist names from staff array
 */
function extractArtists(staff: unknown[]): string[] {
  return staff
    .filter((s: unknown) => {
      const sObj = s as Record<string, unknown>;
      return sObj["role"] === 'Art';
    })
    .map((s: unknown) => (s as Record<string, unknown>)["name"] as string);
}

/**
 * Filters tags to ensure they are all strings
 */
function extractTags(tags: unknown): string[] {
  return Array.isArray(tags)
    ? tags.filter((t: unknown) => typeof t === 'string') as string[]
    : [];
}

/**
 * Extracts external links ensuring array format
 */
function extractExternalLinks(externalLinks: unknown): unknown[] {
  return Array.isArray(externalLinks) ? externalLinks : [];
}

export class MetadataAdapterWrapper<T extends BaseProviderConfig> implements IntegrationAdapter<T> {
  constructor(private adapter: BaseMetadataAdapter<unknown, T>, private config: T) {}

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getSourceInfo(): MetadataSourceInfo {
    const configRecord = this.config as Record<string, unknown>;
    return {
      id: this.adapter.providerName,
      name: this.adapter.providerName,
      type: 'METADATA',
      baseUrl: typeof configRecord['apiEndpoint'] === 'string' ? configRecord['apiEndpoint'] : '',
      supportedFeatures: ['search', 'metadata'],
      isActive: this.isEnabled()
    };
  }

  /**
   * Converts metadata item to search result format
   */
  private convertToSearchResult(item: unknown): MangaSearchResult {
    const itemObj = item as Record<string, unknown>;
    const externalIds = itemObj["externalIds"] as Record<string, unknown> | undefined;
    const staff = Array.isArray(itemObj["staff"]) ? itemObj["staff"] : [];
    const startDate = itemObj["startDate"] as Record<string, unknown> | undefined;

    const sourceId = String(externalIds?.[this.adapter.providerName] ?? itemObj["title"]);
    const statusValue = itemObj["status"] ?? 'UNKNOWN';

    return {
      id: sourceId,
      title: itemObj["title"] as string,
      alternativeTitles: (itemObj["alternativeTitles"] ?? []) as string[],
      description: (itemObj["description"] ?? '') as string,
      coverImage: extractCoverImageUrl(itemObj["coverImage"]),
      status: String(statusValue),
      score: (itemObj["score"] ?? 0) as number,
      popularity: (itemObj["popularity"] ?? 0) as number,
      genres: (itemObj["genres"] ?? []) as string[],
      tags: extractTags(itemObj["tags"]),
      authors: extractAuthors(staff),
      artists: extractArtists(staff),
      sourceId,
      source: this.adapter.providerName,
      provider: this.adapter.providerName,
      year: startDate?.["year"] as number | undefined,
      volumes: itemObj["volumes"] as number | undefined,
      chapters: itemObj["chapters"] as number | undefined,
      externalLinks: extractExternalLinks(itemObj["externalLinks"])
    } as MangaSearchResult;
  }

  async search(query: string, options?: SearchOptions): Promise<AsyncResult<MangaSearchResult[], Error>> {
    const result = await this.adapter.search(query, options);
    if (isSuccess(result)) {
      const data = result.data.map((item: unknown) => this.convertToSearchResult(item));
      return createSuccessResult(data as MangaSearchResult[]);
    }
    const resultRecord = result as Record<string, unknown>;
    const error = resultRecord['error'];
    const errorMessage = typeof error === 'object' && error !== null && 'message' in error
      ? String((error as Record<string, unknown>)['message'])
      : 'Search failed';
    return createErrorResult(new Error(errorMessage));
  }
  async getMangaById(id: string | number): Promise<AsyncResult<IntegrationMangaData, Error>> {
    const result = await this.adapter.getById(id);
    if (isSuccess(result)) {
      const metadata = result.data as Record<string, unknown>;
      const staff = Array.isArray(metadata["staff"]) ? metadata["staff"] : [];

      const data: IntegrationMangaData = {
        id: toStringId(id),
        title: (metadata["title"] as string | undefined) ?? '',
        description: (metadata["description"] as string | undefined) ?? '',
        coverUrl: extractCoverImageUrl(metadata["coverImage"]),
        tags: extractTags(metadata["tags"]),
        authors: extractAuthors(staff)
      };

      // Conditional assignment for optional properties
      const status = metadata["status"];
      if (status !== undefined) {
        data.status = String(status);
      }

      const genres = metadata["genres"];
      if (genres !== undefined) {
        data.genres = genres as string[];
      }

      return createSuccessResult(data);
    }
    const resultRecord = result as Record<string, unknown>;
    const error = resultRecord['error'];
    const errorMessage = typeof error === 'object' && error !== null && 'message' in error
      ? String((error as Record<string, unknown>)['message'])
      : 'Failed to get manga';
    return createErrorResult(new Error(errorMessage));
  }
  async getMangaByTitle(title: string): Promise<AsyncResult<IntegrationMangaData, Error>> {
    const searchResult = await this.search(title);
    if (isSuccess(searchResult) && searchResult.data.length > 0) {
      const firstResult = searchResult.data[0];
      if (firstResult) {
        return this.getMangaById(firstResult.id);
      }
    }
    if (!isSuccess(searchResult)) {
      return searchResult as AsyncResult<IntegrationMangaData, Error>;
    }
    return createErrorResult(new Error('Manga not found'));
  }
  getChapters(_mangaId: string | number, _options?: {
    limit?: number;
    offset?: number;
    translatedLanguage?: string[];
  }): Promise<AsyncResult<ChapterEntity[], Error>> {
    // Most metadata providers don't provide chapter data
    return Promise.resolve(createSuccessResult([]));
  }
  getStatus(): Promise<AsyncResult<{ status: 'ok' | 'error'; message?: string }, Error>> {
    return Promise.resolve(createSuccessResult({ status: 'ok' }));
  }
  async searchManga(query: string, options?: SearchOptions): Promise<AsyncResult<MangaMetadata[], Error>> {
    const result = await this.search(query, options);
    if (isSuccess(result)) {
      return createSuccessResult(result.data as unknown as MangaMetadata[]);
    }
    return result as AsyncResult<MangaMetadata[], Error>;
  }
  async getMangaMetadataById(sourceId: string | number): Promise<AsyncResult<MangaMetadata | null, Error>> {
    const result = await this.getMangaById(sourceId);
    if (isSuccess(result)) {
      return createSuccessResult(result.data as unknown as MangaMetadata);
    }
    return createSuccessResult(null);
  }
  updateMangaMetadata(_mangaId: string | number): Promise<AsyncResult<void, Error>> {
    // No-op for metadata adapters
    return Promise.resolve(createSuccessResult(undefined));
  }
  updateAllMangaMetadata(_limit?: number): Promise<AsyncResult<number, Error>> {
    return Promise.resolve(createSuccessResult(0));
  }
  // Legacy compatibility - just delegate to main methods
  async searchAsync(query: string, options?: SearchOptions): Promise<AsyncResult<MangaSearchResult[], Error>> {
    return this.search(query, options);
  }
  async getMangaByIdAsync(id: string | number): Promise<AsyncResult<IntegrationMangaData, Error>> {
    return this.getMangaById(id);
  }
  async getMangaByTitleAsync(title: string): Promise<AsyncResult<IntegrationMangaData, Error>> {
    return this.getMangaByTitle(title);
  }
  async getChaptersAsync(mangaId: string | number, options?: {
    limit?: number;
    offset?: number;
    translatedLanguage?: string[];
  }): Promise<AsyncResult<ChapterEntity[], Error>> {
    return this.getChapters(mangaId, options);
  }
  async getStatusAsync(): Promise<AsyncResult<{ status: 'ok' | 'error'; message?: string }, Error>> {
    return this.getStatus();
  }
  configure(config: Partial<T>): void {
    Object.assign(this.config, config);
  }
  getConfig(): T {
    return {
      ...this.config
    };
  }
  dispose(): void {
    // Clean up resources if needed
  }
}