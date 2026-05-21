/**
 * Base Metadata Client
 * 
 * This abstract class provides a foundation for all metadata clients, implementing
 * common functionality and defining required interfaces for specific implementations.
 */

import type { AsyncResult} from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { MangaPublicationStatus as MangaStatus } from '@prisma/client';
import type { Manga as MangaEntity } from '@prisma/client';
import type { Chapter as ChapterEntity } from '@prisma/client';

/**
 * Base configuration for metadata clients
 */
export interface MetadataClientConfig {
  baseURL?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  [key: string]: unknown;
}

/**
 * Search options for metadata clients
 */
export interface MetadataSearchOptions {
  query: string;
  limit?: number;
  offset?: number;
  includeAdult?: boolean;
  sort?: string;
  [key: string]: unknown;
}

/**
 * Abstract base class for metadata clients
 */
export abstract class MetadataClient {
  protected config: Required<MetadataClientConfig>;
  
  /**
   * Creates a new metadata client
   * 
   * @param config - Client configuration
   */
  constructor(config: MetadataClientConfig = {}) {
    this.config = {
      baseURL: 'https://api.example.com',
      timeout: 10000,
      retries: 3,
      retryDelay: 1000,
      cacheEnabled: true,
      cacheTTL: 3600,
      ...config
    };
  }
  
  /**
   * Searches for manga
   * 
   * @param options - Search options
   * @returns Promise that resolves to a list of manga entities
   */
  public abstract search(options: MetadataSearchOptions): Promise<AsyncResult<MangaEntity[]>>;
  
  /**
   * Gets manga by ID
   * 
   * @param id - Manga ID
   * @returns Promise that resolves to a manga entity or null
   */
  public abstract getManga(id: string | number): Promise<AsyncResult<MangaEntity | null>>;
  
  /**
   * Gets chapters for a manga
   * 
   * @param mangaId - Manga ID
   * @param options - Options for fetching chapters
   * @returns Promise that resolves to a list of chapter entities
   */
  public abstract getChapters(mangaId: string | number, options?: {
    limit?: number;
    offset?: number;
    translatedLanguage?: string[];
  }): Promise<AsyncResult<ChapterEntity[]>>;
  
  /**
   * Gets chapter by ID
   * 
   * @param id - Chapter ID
   * @returns Promise that resolves to a chapter entity or null
   */
  public abstract getChapter(id: string | number): Promise<AsyncResult<ChapterEntity | null>>;
  
  /**
   * Gets pages for a chapter
   * 
   * @param chapterId - Chapter ID
   * @returns Promise that resolves to a list of page URLs
   */
  public abstract getChapterPages(chapterId: string | number): Promise<AsyncResult<string[]>>;
  
  /**
   * Gets trending manga
   * 
   * @param limit - Maximum number of results to return
   * @param includeAdult - Whether to include adult content
   * @returns Promise that resolves to a list of manga entities
   */
  public abstract getTrending(limit?: number, includeAdult?: boolean): Promise<AsyncResult<MangaEntity[]>>;
  
  /**
   * Gets recently updated manga
   * 
   * @param limit - Maximum number of results to return
   * @param includeAdult - Whether to include adult content
   * @returns Promise that resolves to a list of manga entities
   */
  public abstract getRecentlyUpdated(limit?: number, includeAdult?: boolean): Promise<AsyncResult<MangaEntity[]>>;
  
  /**
   * Gets tags/genres
   * 
   * @returns Promise that resolves to a list of tags/genres
   */
  public abstract getTags(): Promise<AsyncResult<{ id: string; name: string; }[]>>;
  
  /**
   * Checks the health of the API
   * 
   * @returns Promise that resolves to a boolean indicating if the API is healthy
   */
  public abstract checkHealth(): Promise<AsyncResult<boolean>>;
  
  /**
   * Creates a success result
   * 
   * @param data - Result data
   * @returns AsyncResult with success status and data
   */
  protected success<T>(data: T): AsyncResult<T> {
    return createSuccessResult(data);
  }
  
  /**
   * Creates an error result
   * 
   * @param error - Error object or message
   * @returns AsyncResult with error status and error
   */
  protected error<T>(error: Error | string): AsyncResult<T> {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    return createErrorResult(errorObj);
  }
  
  /**
   * Logs an error message
   * 
   * @param message - Error message
   * @param error - Error object
   */
  protected logError(message: string, error?: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`${message}: ${errorMessage}`);
  }
  
  /**
   * Maps provider status to domain MangaStatus
   * 
   * @param providerStatus - Provider-specific status
   * @returns Domain MangaStatus
   */
  protected abstract mapStatus(providerStatus: unknown): MangaStatus;
  
  /**
   * Disposes of resources
   */
  public dispose(): void {
    // Override in subclasses if needed
  }
}