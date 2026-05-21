
import { MangaPublicationStatus, ChapterStatus, type Prisma } from '@prisma/client';

import type { MangaMetadata as DomainMangaMetadata } from '@/types/search.types';
import type { AsyncResult} from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { ApiError } from '@/utils/error-handling';
import { toNumberId } from '@/utils/id-converters';


/**
 * Base Metadata Provider
 * 
 * This abstract class extends ApiClient to provide specialized functionality
 * for metadata providers like AniList, ComicVine, Fandom, etc. It standardizes common
 * operations and data structures across different providers.
 * 
 * Features:
 * - Standardized metadata operations (search, get details, etc.)
 * - Common data structures for manga, chapters, authors
 * - Consistent error handling and mapping
 */
import { ApiClient } from './ApiClient';

import type { Manga as MangaEntity, Chapter as ChapterEntity, ContentRating, PublicationDemographic } from '@prisma/client';
// Helper function to transform errors
function transformError(error: unknown, context: {
  serviceName: string;
  operation: string;
  metadata?: Record<string, unknown>;
}): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  const message = error instanceof Error ? error.message : 'Unknown error';
  const apiError = new ApiError(`[${context.serviceName}] ${context.operation}: ${message}`);
  Object.assign(apiError, {
    context
  });
  return apiError;
}
/**
 * Manga interface
 */
export interface Manga {
  id: string | number;
  title: string;
  alternativeTitles?: string[];
  description?: string;
  status?: MangaPublicationStatus;
  contentRating?: ContentRating;
  demographic?: PublicationDemographic;
  coverImage?: string;
  coverUrl?: string; // For compatibility with MangaMetadata
  tags?: string[];
  genres?: string[];
  authors?: Author[];
  artists?: Author[];
  year?: number;
  releaseYear?: number; // For compatibility with MangaMetadata
  lastUpdated?: Date;
  chapters?: Chapter[];
  score?: number;
  rating?: number; // For compatibility with MangaMetadata
  popularity?: number;
  source?: string; // Provider name
  sourceId?: string | number; // Original ID from source
  sourceUrl?: string; // URL to source
  providerSpecific?: Record<string, unknown>; // Provider-specific data
}
/**
 * Chapter interface
 */
export interface Chapter {
  id: string | number;
  title?: string;
  chapterNumber: string | number;
  volumeNumber?: string | number;
  language?: string;
  pages?: number;
  size?: number; // bytes
  publishDate?: Date;
  releaseDate?: Date; // For compatibility with ChapterEntity
  scanlationGroup?: string;
  sourceUrl?: string; // URL to source
  pageUrls?: string[]; // URLs to pages
  providerSpecific?: Record<string, unknown>; // Provider-specific data
}
/**
 * Author interface
 */
export interface Author {
  id?: string;
  name: string;
  role?: string; // e.g., "author", "artist"
  sourceUrl?: string; // URL to source
  providerSpecific?: Record<string, unknown>; // Provider-specific data
}
/**
 * Search options
 */
export interface SearchOptions {
  limit?: number;
  offset?: number;
  sort?: string;
  status?: MangaPublicationStatus[];
  genres?: string[];
  excludedGenres?: string[];
  contentRating?: ContentRating[];
  demographic?: PublicationDemographic[];
  year?: number;
  providerSpecific?: Record<string, unknown>; // Provider-specific options
}
/**
 * Options for fetching chapters
 */
export interface GetChaptersOptions {
  limit?: number;
  offset?: number;
  translatedLanguage?: string[];
  order?: 'asc' | 'desc';
}
/**
 * Options for fetching trending manga
 */
export interface TrendingOptions {
  limit?: number;
  offset?: number;
  contentRating?: ContentRating[];
}
/**
 * Options for fetching recently updated manga
 */
export interface RecentlyUpdatedOptions {
  limit?: number;
  offset?: number;
  contentRating?: ContentRating[];
}
/**
 * Options for fetching manga by author
 */
export interface MangaByAuthorOptions {
  limit?: number;
  offset?: number;
}
/**
 * Abstract base class for metadata providers
 * @template TError - The specific error type for this provider (defaults to Error)
 */
export abstract class MetadataProvider<TError extends Error = Error> extends ApiClient<Manga, TError> {
  /**
   * Searches for manga
   *
   * @param query - Search query
   * @param options - Search options
   * @returns Promise that resolves to AsyncResult with a list of manga
   */
  public abstract search(query: string, options?: SearchOptions): Promise<AsyncResult<Manga[], TError>>;
  /**
   * Gets manga details by ID
   * 
   * @param id - Manga ID
   * @returns Promise that resolves to AsyncResult with manga details
   */
  public abstract getManga(id: string): Promise<AsyncResult<Manga, TError>>;
  /**
   * Gets metadata for a manga
   * 
   * @param id - Manga ID
   * @returns Promise that resolves to manga metadata
   */
  public async getMetadata(id: string): Promise<DomainMangaMetadata | null> {
    const result = await this.getManga(id);
    if (result.status !== 'success') {
      return null;
    }
    // Convert to domain metadata format
    const manga = result.data;
    const metadata: DomainMangaMetadata = {
      title: manga.title,
      ...(manga.alternativeTitles !== undefined && { alternativeTitles: manga.alternativeTitles }),
      ...(manga.description !== undefined && { description: manga.description }),
      ...(manga.status !== undefined && { status: manga.status }),
      ...(manga.coverUrl !== undefined ? { coverUrl: manga.coverUrl } : manga.coverImage !== undefined ? { coverUrl: manga.coverImage } : {}),
      // Remove the 'cover' property as it's not in the DomainMangaMetadata interface
      authors: manga.authors?.map(author => author.name) ?? [],
      artists: manga.artists?.map(artist => artist.name) ?? [],
      tags: manga.tags ?? [],
      genres: manga.genres ?? []
      // releaseYear is not in MangaMetadata, use year if needed in startDate
      // rating is not in MangaMetadata - removed
      // Add links with source URL if available - links is not in MangaMetadata
    };
    return metadata;
  }
  /**
   * Gets chapters for a manga
   * 
   * @param mangaId - Manga ID
   * @param options - Options for fetching chapters
   * @returns Promise that resolves to AsyncResult with a list of chapters
   */
  public abstract getChapters(mangaId: string, options?: GetChaptersOptions): Promise<AsyncResult<Chapter[], TError>>;
  /**
   * Gets chapter details by ID
   * 
   * @param id - Chapter ID
   * @returns Promise that resolves to AsyncResult with chapter details
   */
  public abstract getChapter(id: string): Promise<AsyncResult<Chapter, TError>>;
  /**
   * Gets pages for a chapter
   * 
   * @param chapterId - Chapter ID
   * @returns Promise that resolves to AsyncResult with a list of page URLs
   */
  public abstract getChapterPages(chapterId: string): Promise<AsyncResult<string[], TError>>;
  /**
   * Gets the provider type
   * 
   * @returns Provider type (e.g., 'anilist', 'comicvine', 'fandom')
   */
  public abstract getProviderType(): string;
  /**
   * Gets trending manga
   *
   * @param options - Options for fetching trending manga
   * @returns Promise that resolves to AsyncResult with a list of manga
   */
  public getTrending(_options?: TrendingOptions): Promise<AsyncResult<Manga[], TError>> {
    return Promise.resolve(createErrorResult<Manga[], TError>(transformError(new Error('Not implemented'), {
      serviceName: this.getServiceName(),
      operation: 'getTrending'
    }) as unknown as TError));
  }
  /**
   * Gets recently updated manga
   *
   * @param options - Options for fetching recently updated manga
   * @returns Promise that resolves to AsyncResult with a list of manga
   */
  public getRecentlyUpdated(_options?: RecentlyUpdatedOptions): Promise<AsyncResult<Manga[], TError>> {
    return Promise.resolve(createErrorResult<Manga[], TError>(transformError(new Error('Not implemented'), {
      serviceName: this.getServiceName(),
      operation: 'getRecentlyUpdated'
    }) as unknown as TError));
  }
  /**
   * Gets author details by ID
   *
   * @param id - Author ID
   * @returns Promise that resolves to AsyncResult with author details
   */
  public getAuthor(id: string): Promise<AsyncResult<Author, TError>> {
    return Promise.resolve(createErrorResult<Author, TError>(transformError(new Error('Not implemented'), {
      serviceName: this.getServiceName(),
      operation: 'getAuthor',
      metadata: {
        resourceType: 'author',
        resourceId: id
      }
    }) as unknown as TError));
  }
  /**
   * Gets manga by author
   *
   * @param authorId - Author ID
   * @param options - Options for fetching manga
   * @returns Promise that resolves to AsyncResult with a list of manga
   */
  public getMangaByAuthor(authorId: string, _options?: MangaByAuthorOptions): Promise<AsyncResult<Manga[], TError>> {
    return Promise.resolve(createErrorResult<Manga[], TError>(transformError(new Error('Not implemented'), {
      serviceName: this.getServiceName(),
      operation: 'getMangaByAuthor',
      metadata: {
        resourceType: 'author',
        resourceId: authorId
      }
    }) as unknown as TError));
  }
  /**
   * Gets the service name for error reporting
   * 
   * @returns Service name based on provider type
   */
  protected getServiceName(): string {
    return this.getProviderType();
  }
  /**
   * Converts a provider-specific status to a standard MangaStatus
   * 
   * @param providerStatus - Provider-specific status
   * @returns Standardized manga status
   */
  protected abstract mapStatus(providerStatus: unknown): MangaPublicationStatus;
  /**
   * Converts a provider-specific content rating to a standard ContentRating
   * 
   * @param providerRating - Provider-specific content rating
   * @returns Standardized content rating
   */
  protected abstract mapContentRating(providerRating: unknown): ContentRating;
  /**
   * Converts provider-specific manga data to the domain MangaEntity format
   * 
   * @param manga - Provider-specific manga data
   * @returns Domain-standardized MangaEntity
   */
  protected convertToDomainManga(manga: Manga): Partial<MangaEntity> {
    const result: Partial<MangaEntity> = {
      id: typeof manga.id === 'string' ? toNumberId(manga.id) : manga.id,
      title: manga.title,
      publicationStatus: manga.status ?? MangaPublicationStatus.ONGOING,
      source: this.getProviderType(),
      providerMetadata: (manga.providerSpecific ?? {}) as unknown as Prisma.JsonValue
    };
    if (manga.sourceId !== undefined) {
      result.sourceId = manga.sourceId.toString();
    }
    if (manga.description !== undefined) {
      result.summary = manga.description;
    }
    return result;
  }
  /**
   * Converts provider-specific chapter data to the domain ChapterEntity format
   * 
   * @param chapter - Provider-specific chapter data
   * @param mangaId - The ID of the manga this chapter belongs to
   * @returns Domain-standardized ChapterEntity
   */
  protected convertToDomainChapter(chapter: Chapter, mangaId: string | number): Partial<ChapterEntity> {
    // Create the base entity with proper type safety
    const entity: Partial<ChapterEntity> = {
      id: typeof chapter.id === 'string' ? toNumberId(chapter.id) : chapter.id,
      mangaId: typeof mangaId === 'string' ? toNumberId(mangaId) : mangaId,
      title: chapter.title ?? '',
      index: typeof chapter.chapterNumber === 'string' ? parseFloat(chapter.chapterNumber) : chapter.chapterNumber,
      downloadStatus: ChapterStatus.COMPLETED,
      // Using COMPLETED as chapters are available
      fileName: '',
      // We don't have this information from providers
      size: chapter.size ?? 0
    };
    // Add optional fields only if defined
    if (chapter.language !== undefined) {
      entity.language = chapter.language;
    }
    if (chapter.pages !== undefined) {
      entity.pages = chapter.pages;
    }
    // Only add volume if it exists and can be properly converted
    if (chapter.volumeNumber !== undefined) {
      const volumeValue = typeof chapter.volumeNumber === 'string' ? parseFloat(chapter.volumeNumber) : chapter.volumeNumber;
      entity.volume = volumeValue;
    }
    // Handle dates - prefer releaseDate if available
    if (chapter.releaseDate) {
      entity.releaseDate = typeof chapter.releaseDate === 'string' ? new Date(chapter.releaseDate) : chapter.releaseDate;
    }
    // Note: publishDate and scanlationGroup are not in Prisma Chapter model
    // These would need to be stored in providerMetadata if needed
    return entity;
  }
  /**
   * Updates the connection status with provider version
   * 
   * @param connected - Whether the connection is successful
   * @param options - Additional status options
   */
  protected override updateConnectionStatus(connected: boolean, options?: {
    version?: string;
    error?: string;
  }): void {
    super.updateConnectionStatus(connected, {
      ...options,
      version: options?.version ?? `${this.getProviderType()} Provider`
    });
  }
  /**
   * Safely execute an API request and return an AsyncResult
   * 
   * @param operation - Function that performs the API operation
   * @param context - Additional context for error reporting
   * @returns AsyncResult with the operation result or error
   */
  protected async executeWithAsyncResult<T>(operation: () => Promise<T>, context: {
    operationName: string;
    resourceType?: string;
    resourceId?: string;
  }): Promise<AsyncResult<T, TError>> {
    try {
      const result = await operation();
      return createSuccessResult<T, TError>(result);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Ensure proper errorMessage handling with detailed context
      return createErrorResult<T, TError>(transformError(errorMessage, {
        serviceName: this.getServiceName(),
        operation: context.operationName || 'unknown',
        metadata: {
          resourceType: context.resourceType,
          resourceId: context.resourceId
        }
      }) as unknown as TError);
    }
  }
}