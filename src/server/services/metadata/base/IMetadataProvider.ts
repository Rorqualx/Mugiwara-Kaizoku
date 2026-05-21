/**
 * Standard Metadata Provider Interface
 * 
 * All metadata providers MUST implement this interface.
 * This ensures consistent behavior across all providers.
 */

import type { MangaMetadata, MetadataDetails } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';

import type { Chapter as ChapterEntity, ProviderErrorType } from '@prisma/client';
/**
 * Search options for provider queries
 */
export interface SearchOptions {
  limit?: number;
  offset?: number;
  includeAdult?: boolean;
  language?: string;
}

/**
 * Provider configuration base
 */
export interface ProviderConfig {
  enabled: boolean;
  apiKey?: string;
  apiUrl?: string;
  rateLimit?: number;
  timeout?: number;
}

/**
 * Standard metadata provider interface
 * All providers must implement these methods consistently
 */
export interface IMetadataProvider {
  // Core identification
  readonly providerId: string;
  readonly providerName: string;
  readonly version: string;
  // Configuration
  readonly config: ProviderConfig;
  // Standard search operations
  search(query: string, options?: SearchOptions): Promise<AsyncResult<MangaMetadata[], Error>>;
  getById(id: string): Promise<AsyncResult<MangaMetadata | null, Error>>;
  // Standard metadata operations  
  getMetadata(mangaId: string): Promise<AsyncResult<MetadataDetails, Error>>;
  getChapters(mangaId: string): Promise<AsyncResult<ChapterEntity[], Error>>;
  // Standard validation
  validateConfig(): boolean;
  isAvailable(): Promise<boolean>;
  // Optional bulk operations
  searchBulk?(queries: string[], options?: SearchOptions): Promise<AsyncResult<MangaMetadata[][], Error>>;
  getByIds?(ids: string[]): Promise<AsyncResult<(MangaMetadata | null)[], Error>>;
}

/**
 * Provider response wrapper for consistent error handling
 */
export interface ProviderResponse<T> {
  success: boolean;
  data?: T;
  error?: Error;
  timestamp: Date;
  providerId: string;
}

// ProviderErrorType is imported from Prisma above

/**
 * Standard provider error class
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    public type: ProviderErrorType,
    public providerId: string,
    public details?: unknown
  ) {
    super(message);
    this["name"] = 'ProviderError';
  }
}
