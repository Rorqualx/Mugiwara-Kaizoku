/**
 * MangaDex API Client — Extended from original client.ts
 * Adds statistics, typed aggregate, auto-pagination, and author details
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import {
  SafeParams,
  MangaSearchParams,
  ChapterSearchParams,
  MangaListResponse,
  ChapterListResponse,
  CoverArtListResponse,
  AuthorListResponse,
  StatisticsResponse,
  AggregateResponse,
  AtHomeResponse,
  Manga,
  Chapter,
  CoverArt,
  Author,
  isMangaDexErrorResponse,
  MangaDexRelationshipType,
} from './types';
import { RateLimiter } from '../../core/rate-limiter';
import { ApiError } from '../../types/errors';

export interface MangaDexClientConfig {
  baseUrl: string;
  timeout: number;
  rateLimit?: {
    maxRequests: number;
    perMilliseconds: number;
  };
  userAgent?: string;
  defaultContentRating?: ('safe' | 'suggestive' | 'erotica' | 'pornographic')[];
}

/**
 * Custom error class for MangaDex API errors (backward compat)
 */
export class MangaDexApiError extends ApiError {
  constructor(
    message: string,
    statusCode?: number,
    errors?: unknown[],
    requestId?: string
  ) {
    super(message, statusCode, errors, requestId, 'mangadex');
    this.name = 'MangaDexApiError';
  }
}

/**
 * MangaDex API Client
 */
export class MangaDexClient {
  private readonly axiosInstance: AxiosInstance;
  private readonly rateLimiter?: RateLimiter;
  private readonly defaultContentRating: ('safe' | 'suggestive' | 'erotica' | 'pornographic')[];

  constructor(config: MangaDexClientConfig) {
    this.validateConfig(config);

    this.defaultContentRating = config.defaultContentRating || ['safe', 'suggestive', 'erotica'];

    this.axiosInstance = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        'User-Agent': config.userAgent || 'MangaDex-TypeScript-Client/2.0.0',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 500,
    });

    if (config.rateLimit) {
      this.rateLimiter = new RateLimiter(
        config.rateLimit.maxRequests,
        config.rateLimit.perMilliseconds
      );
    }

    this.axiosInstance.interceptors.request.use(async (requestConfig) => {
      if (this.rateLimiter) {
        await this.rateLimiter.waitIfNeeded();
      }
      return requestConfig;
    });

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        return this.handleRequestError(error);
      }
    );
  }

  private validateConfig(config: MangaDexClientConfig): void {
    if (!config.baseUrl) throw new Error('Base URL is required');
    try {
      new URL(config.baseUrl);
    } catch {
      throw new Error('Invalid base URL');
    }
    if (config.timeout <= 0) throw new Error('Timeout must be positive');
    if (config.rateLimit) {
      if (config.rateLimit.maxRequests <= 0)
        throw new Error('Rate limit maxRequests must be positive');
      if (config.rateLimit.perMilliseconds <= 0)
        throw new Error('Rate limit perMilliseconds must be positive');
    }
  }

  private handleRequestError(error: AxiosError): never {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      let message = `API request failed with status ${status}`;
      let errors: unknown[] = [];
      let requestId: string | undefined;

      if (isMangaDexErrorResponse(data)) {
        message = data.errors[0]?.detail || message;
        errors = data.errors;
      }

      requestId = error.response.headers['x-request-id'] as string;
      throw new MangaDexApiError(message, status, errors, requestId);
    } else if (error.request) {
      throw new MangaDexApiError('No response received from server.');
    } else {
      throw new MangaDexApiError(`Request setup error: ${error.message}`);
    }
  }

  private buildQueryParams(params: SafeParams): string {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;

      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== undefined && item !== null) {
            searchParams.append(`${key}[]`, String(item));
          }
        }
      } else if (typeof value === 'boolean') {
        searchParams.append(key, value ? '1' : '0');
      } else if (typeof value === 'object') {
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          if (nestedValue !== undefined && nestedValue !== null) {
            searchParams.append(`${key}[${nestedKey}]`, String(nestedValue));
          }
        }
      } else {
        searchParams.append(key, String(value));
      }
    }

    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  }

  private async safeRequest<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.axiosInstance.request<T>(config);

      if (isMangaDexErrorResponse(response.data)) {
        const errorData = response.data;
        throw new MangaDexApiError(
          errorData.errors[0]?.detail || 'API returned error',
          response.status,
          errorData.errors,
          response.headers['x-request-id'] as string
        );
      }

      return response.data;
    } catch (error) {
      if (error instanceof MangaDexApiError) throw error;
      throw new MangaDexApiError(
        `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ==================== Original Public API (preserved) ====================

  async ping(): Promise<string> {
    const response = await this.axiosInstance.get<string>('/ping', {
      responseType: 'text',
    });
    return response.data;
  }

  async searchManga(params: MangaSearchParams = {}): Promise<MangaListResponse> {
    const safeParams: SafeParams = {
      ...params,
      contentRating: params.contentRating || this.defaultContentRating,
      limit: Math.min(params.limit || 10, 100),
    };
    const queryString = this.buildQueryParams(safeParams);
    return this.safeRequest<MangaListResponse>({ method: 'GET', url: `/manga${queryString}` });
  }

  async getManga(
    id: string,
    includes: MangaDexRelationshipType[] = ['author', 'artist', 'cover_art']
  ): Promise<MangaListResponse> {
    if (!this.isValidUUID(id)) throw new MangaDexApiError(`Invalid UUID: ${id}`);
    const queryString = this.buildQueryParams({ includes });
    return this.safeRequest<MangaListResponse>({ method: 'GET', url: `/manga/${id}${queryString}` });
  }

  async getMangaChapters(
    mangaId: string,
    params: ChapterSearchParams = {}
  ): Promise<ChapterListResponse> {
    if (!this.isValidUUID(mangaId)) throw new MangaDexApiError(`Invalid UUID: ${mangaId}`);
    const safeParams: SafeParams = {
      ...params,
      limit: Math.min(params.limit || 100, 500),
      manga: mangaId,
    };
    const queryString = this.buildQueryParams(safeParams);
    return this.safeRequest<ChapterListResponse>({ method: 'GET', url: `/chapter${queryString}` });
  }

  async getMangaAggregate(
    mangaId: string,
    translatedLanguage?: string[]
  ): Promise<AggregateResponse> {
    if (!this.isValidUUID(mangaId)) throw new MangaDexApiError(`Invalid UUID: ${mangaId}`);
    const queryString = this.buildQueryParams({ translatedLanguage });
    return this.safeRequest<AggregateResponse>({
      method: 'GET',
      url: `/manga/${mangaId}/aggregate${queryString}`,
    });
  }

  async getMangaCovers(
    mangaId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<CoverArtListResponse> {
    if (!this.isValidUUID(mangaId)) throw new MangaDexApiError(`Invalid UUID: ${mangaId}`);
    const queryString = this.buildQueryParams({
      limit: Math.min(limit, 100),
      offset,
      manga: [mangaId],
      order: { volume: 'asc' } as Record<string, string>,
    });
    return this.safeRequest<CoverArtListResponse>({ method: 'GET', url: `/cover${queryString}` });
  }

  async getAuthor(authorId: string): Promise<AuthorListResponse> {
    if (!this.isValidUUID(authorId)) throw new MangaDexApiError(`Invalid UUID: ${authorId}`);
    return this.safeRequest<AuthorListResponse>({ method: 'GET', url: `/author/${authorId}` });
  }

  async getChapter(chapterId: string): Promise<ChapterListResponse> {
    if (!this.isValidUUID(chapterId)) throw new MangaDexApiError(`Invalid UUID: ${chapterId}`);
    return this.safeRequest<ChapterListResponse>({ method: 'GET', url: `/chapter/${chapterId}` });
  }

  async getChapterImages(chapterId: string): Promise<AtHomeResponse> {
    if (!this.isValidUUID(chapterId)) throw new MangaDexApiError(`Invalid UUID: ${chapterId}`);
    return this.safeRequest<AtHomeResponse>({
      method: 'GET',
      url: `/at-home/server/${chapterId}`,
    });
  }

  // ==================== NEW: Extended Methods ====================

  /**
   * Get manga statistics (rating, follows, comments)
   */
  async getStatistics(mangaId: string): Promise<StatisticsResponse> {
    if (!this.isValidUUID(mangaId)) throw new MangaDexApiError(`Invalid UUID: ${mangaId}`);
    return this.safeRequest<StatisticsResponse>({
      method: 'GET',
      url: `/statistics/manga/${mangaId}`,
    });
  }

  /**
   * Get all chapters with auto-pagination
   */
  async getAllChapters(
    mangaId: string,
    language?: string,
    limit: number = 500
  ): Promise<Chapter[]> {
    const allChapters: Chapter[] = [];
    let offset = 0;
    const pageLimit = Math.min(limit, 500);

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const params: ChapterSearchParams = {
        limit: pageLimit,
        offset,
        translatedLanguage: language ? [language] : undefined,
        order: { chapter: 'asc' },
        includes: ['scanlation_group'],
      };

      const response = await this.getMangaChapters(mangaId, params);
      const chapters = Array.isArray(response.data)
        ? response.data.filter((ch): ch is Chapter => ch != null)
        : (response.data ? [response.data] : []);
      allChapters.push(...chapters);

      if (!response.total || allChapters.length >= response.total || chapters.length < pageLimit) {
        break;
      }
      offset += pageLimit;
    }

    return allChapters;
  }

  /**
   * Get all covers with auto-pagination
   */
  async getAllCovers(mangaId: string): Promise<CoverArt[]> {
    const allCovers: CoverArt[] = [];
    let offset = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const response = await this.getMangaCovers(mangaId, 100, offset);
      const covers = Array.isArray(response.data)
        ? response.data.filter((c): c is CoverArt => c != null)
        : (response.data ? [response.data] : []);
      allCovers.push(...covers);

      if (!response.total || allCovers.length >= response.total || covers.length < 100) {
        break;
      }
      offset += 100;
    }

    return allCovers;
  }

  /**
   * Get author details
   */
  async getAuthorDetails(authorId: string): Promise<Author | undefined> {
    try {
      const response = await this.getAuthor(authorId);
      if (Array.isArray(response.data)) return response.data[0];
      return response.data;
    } catch {
      return undefined;
    }
  }

  // ==================== Utility Methods (isValidUUID now public) ====================

  /**
   * Validate UUID format
   */
  isValidUUID(uuid: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
  }

  /**
   * Get cover image URL — FIXED: includes mangaId in path
   */
  getCoverUrl(
    mangaId: string,
    cover: { fileName: string },
    size: 'original' | '512' | '256' = '512'
  ): string {
    const baseUrl = 'https://uploads.mangadex.org/covers';
    const fileName = encodeURIComponent(cover.fileName);

    switch (size) {
      case 'original':
        return `${baseUrl}/${mangaId}/${fileName}`;
      case '512':
        return `${baseUrl}/${mangaId}/${fileName}.512.jpg`;
      case '256':
        return `${baseUrl}/${mangaId}/${fileName}.256.jpg`;
      default:
        return `${baseUrl}/${mangaId}/${fileName}.512.jpg`;
    }
  }

  /**
   * Legacy getCoverUrl without mangaId (backward compat, deprecated)
   */
  getCoverUrlLegacy(cover: { fileName: string }, size: 'original' | '512' | '256' = '512'): string {
    const baseUrl = 'https://uploads.mangadex.org/covers';
    const fileName = encodeURIComponent(cover.fileName);

    switch (size) {
      case 'original':
        return `${baseUrl}/${fileName}`;
      case '512':
        return `${baseUrl}/${fileName}.512.jpg`;
      case '256':
        return `${baseUrl}/${fileName}.256.jpg`;
      default:
        return `${baseUrl}/${fileName}.512.jpg`;
    }
  }

  extractRelationships<T extends { id: string; type: string }>(
    manga: { relationships: Array<{ id: string; type: string; attributes?: Record<string, unknown> }> },
    type: string
  ): T[] {
    return manga.relationships
      .filter((rel) => rel.type === type)
      .map((rel) => ({ id: rel.id, type: rel.type, attributes: rel.attributes } as unknown as T));
  }

  getEnglishTitle(manga: { attributes: { title: Record<string, string | undefined> } }): string {
    const titles = manga.attributes.title;
    if (titles['en']) return titles['en'];
    if (titles['ja-ro']) return titles['ja-ro'];
    if (titles['ja']) return titles['ja'];
    const firstTitle = Object.values(titles).find((title) => title !== undefined);
    return firstTitle || 'Unknown Title';
  }

  getEnglishDescription(
    manga: { attributes: { description: Record<string, string | undefined> } }
  ): string {
    const descriptions = manga.attributes.description;
    return descriptions['en'] || descriptions['ja-ro'] || descriptions['ja'] || '';
  }
}

/**
 * Create a default MangaDex client with safe defaults
 */
export function createDefaultClient(): MangaDexClient {
  return new MangaDexClient({
    baseUrl: 'https://api.mangadex.org',
    timeout: 30000,
    rateLimit: {
      maxRequests: 5,
      perMilliseconds: 1000,
    },
    defaultContentRating: ['safe', 'suggestive', 'erotica'],
    userAgent: 'MangaDex-TypeScript-Client/2.0.0',
  });
}
