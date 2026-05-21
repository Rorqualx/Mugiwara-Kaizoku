/**
 * Provider Interfaces
 *
 * This module defines standardized interfaces for all provider types in the application.
 * It consolidates various provider patterns into a consistent set of interfaces.
 */

import type { DownloadRequest } from './download-types';
import type { PageInfo } from './reader/reader-types';
import type { SearchResult } from './search-types/core-search.types';
import type { SearchOptions } from './search.types';
import type { AsyncResult } from '../utils/async-result';
import type { Manga, Chapter, Metadata } from '@prisma/client';

// Type aliases for compatibility
type MangaEntity = Manga;
type NormalizedMetadata = Metadata;
type NormalizedChapter = Chapter;

/**
 * Base provider interface with common properties and methods
 * All provider interfaces should extend this base interface
 */
export interface BaseProvider {
  /**
   * Provider identifier
   */
  readonly id: string;

  /**
   * Provider display name
   */
  readonly name: string;

  /**
   * Whether the provider is enabled
   */
  isEnabled(): boolean;

  /**
   * Provider status
   */
  getStatus(): 'active' | 'inactive' | 'error' | 'rate_limited' | 'configuring';
}

/**
 * Configuration interface for all providers
 */
export interface ProviderConfig {
  /**
   * Whether the provider is enabled
   */
  enabled: boolean;

  /**
   * API key for authenticated services
   */
  apiKey?: string;

  /**
   * Base API URL
   */
  apiUrl?: string;

  /**
   * Rate limiting configuration
   */
  rateLimit?: {
    requestsPerMinute?: number;
    requestsPerDay?: number;
    throttleMs?: number;
  };

  /**
   * Logger function for debugging
   */
  logger?: (message: string, error?: unknown) => void;

  /**
   * Any additional provider-specific configuration
   */
  [key: string]: unknown;
}

/**
 * Interface for metadata provider adapters
 * Metadata provider adapters supply information about manga/comics
 * This interface is used for adapter implementations that wrap external APIs
 */
export interface IMetadataProviderAdapter extends BaseProvider {
  /**
   * Search for manga by title or query string
   * 
   * @param query - The search query
   * @param options - Search options (limit, offset, filters)
   * @returns AsyncResult with array of manga entities
   */
  search(query: string, options?: SearchOptions): Promise<AsyncResult<MangaEntity[]>>;

  /**
   * Get manga details by ID
   * 
   * @param id - Provider-specific manga ID
   * @returns AsyncResult with manga entity or null if not found
   */
  getMangaById(id: string): Promise<AsyncResult<MangaEntity | null>>;

  /**
   * Get manga chapters by manga ID
   * 
   * @param mangaId - Provider-specific manga ID
   * @returns AsyncResult with array of normalized chapters
   */
  getChapters?(mangaId: string): Promise<AsyncResult<NormalizedChapter[]>>;

  /**
   * Get provider configuration
   * 
   * @returns Current provider configuration
   */
  getConfig(): ProviderConfig;

  /**
   * Update provider configuration
   * 
   * @param config - New partial configuration
   */
  configure(config: Partial<ProviderConfig>): void;
}

/**
 * Interface for download providers
 * Download providers handle downloading manga/comic content
 */
export interface DownloadProvider extends BaseProvider {
  /**
   * Download a chapter
   * 
   * @param mangaId - Manga ID
   * @param chapterId - Chapter ID
   * @param options - Download options
   * @returns AsyncResult with download status
   */
  downloadChapter(mangaId: string, chapterId: string, options?: unknown): Promise<AsyncResult<unknown>>;

  /**
   * Get download status
   * 
   * @param downloadId - Download ID
   * @returns AsyncResult with download status
   */
  getDownloadStatus(downloadId: string): Promise<AsyncResult<unknown>>;

  /**
   * Cancel a download
   * 
   * @param downloadId - Download ID
   * @returns AsyncResult with cancellation status
   */
  cancelDownload(downloadId: string): Promise<AsyncResult<boolean>>;

  /**
   * Get all active downloads
   * 
   * @returns AsyncResult with array of active downloads
   */
  getActiveDownloads(): Promise<AsyncResult<DownloadRequest[]>>;

  /**
   * Get provider configuration
   * 
   * @returns Current provider configuration
   */
  getConfig(): ProviderConfig;

  /**
   * Update provider configuration
   * 
   * @param config - New partial configuration
   */
  configure(config: Partial<ProviderConfig>): void;
}

/**
 * Interface for source providers
 * Source providers supply manga/comic content directly
 */
export interface SourceProvider extends BaseProvider {
  /**
   * Search for manga from this source
   * 
   * @param query - Search query
   * @param options - Search options
   * @returns AsyncResult with search results
   */
  search(query: string, options?: SearchOptions): Promise<AsyncResult<SearchResult[]>>;

  /**
   * Get manga details from this source
   * 
   * @param id - Source-specific manga ID
   * @returns AsyncResult with manga details
   */
  getManga(id: string): Promise<AsyncResult<unknown>>;

  /**
   * Get chapters for a manga from this source
   * 
   * @param mangaId - Source-specific manga ID
   * @returns AsyncResult with chapters
   */
  getChapters(mangaId: string): Promise<AsyncResult<Chapter[]>>;

  /**
   * Get pages for a chapter from this source
   * 
   * @param mangaId - Source-specific manga ID
   * @param chapterId - Source-specific chapter ID
   * @returns AsyncResult with pages
   */
  getPages(mangaId: string, chapterId: string): Promise<AsyncResult<PageInfo[]>>;

  /**
   * Get provider configuration
   * 
   * @returns Current provider configuration
   */
  getConfig(): ProviderConfig;

  /**
   * Update provider configuration
   * 
   * @param config - New partial configuration
   */
  configure(config: Partial<ProviderConfig>): void;
}

/**
 * @deprecated Use IMetadataProviderAdapter instead
 * Temporary type alias for backward compatibility during migration
 */
export type MetadataProvider = IMetadataProviderAdapter;

/**
 * Interface for metadata adapters
 * Adapters transform provider-specific data to standardized formats
 */
export interface MetadataAdapter {
  /**
   * Provider identifier
   */
  readonly providerId: string;

  /**
   * Transform provider-specific manga data to normalized metadata
   * 
   * @param data - Provider-specific manga data
   * @returns Normalized metadata
   */
  transformManga(data: unknown): NormalizedMetadata;

  /**
   * Transform provider-specific chapter data to normalized chapter
   * 
   * @param data - Provider-specific chapter data
   * @param mangaId - Manga ID
   * @returns Normalized chapter
   */
  transformChapter(data: unknown, mangaId: string): NormalizedChapter;
}

/**
 * Factory function type for creating providers
 */
export type ProviderFactory<T extends BaseProvider> = (config: ProviderConfig) => T;

/**
 * Registry for provider factories
 */
export interface ProviderRegistry {
  /**
   * Register a provider factory
   * 
   * @param providerId - Provider ID
   * @param factory - Provider factory function
   */
  register<T extends BaseProvider>(providerId: string, factory: ProviderFactory<T>): void;

  /**
   * Create a provider instance
   * 
   * @param providerId - Provider ID
   * @param config - Provider configuration
   * @returns Provider instance
   */
  create<T extends BaseProvider>(providerId: string, config: ProviderConfig): T;

  /**
   * Get all registered provider IDs
   * 
   * @returns Array of provider IDs
   */
  getProviderIds(): string[];
}