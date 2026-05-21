/**
 * Provider Types Module
 *
 * Provider-related types for search, metadata, and API responses.
 * Includes provider-specific search results and configuration types.
 *
 * Extracted from: search.types.ts
 */

// ============================================================================
// Imports
// ============================================================================

import type { SearchOptions } from './configuration.types';
import type { SearchResult, MangaSearchResult } from './core-search.types';
import type { MangaPublicationStatus, MangaFormat } from './enums.types';

// ============================================================================
// Provider Error and Status Types
// ============================================================================

/**
 * Provider error details (data interface, not the error class)
 * Note: For throwing errors, use the ProviderError class from enums.types.ts
 */
export interface ProviderErrorInfo {
  provider: string;
  error: string;
  errorType?: 'api_down' | 'rate_limit' | 'network' | 'auth' | 'unknown';
  timestamp: number;
}

export interface ProviderStatus {
  provider: string;
  status: 'healthy' | 'degraded' | 'down';
  lastCheck: Date;
  responseTime?: number;
  error?: string;
}

// ============================================================================
// Provider Search Results
// ============================================================================

/**
 * Provider search result wrapper
 */
export interface ProviderSearchResult {
  provider: string;
  results: MangaSearchResult[];
  error?: string;
  errorType?: 'api_down' | 'rate_limit' | 'network' | 'auth' | 'unknown';
  totalResults?: number;
}

/**
 * Search response with error tracking
 */
export interface SearchResponseWithErrors {
  results: MangaSearchResult[];
  providerErrors?: ProviderErrorInfo[];
}

// ============================================================================
// Provider-Specific Search Results
// ============================================================================

// Provider-specific search result types
export interface AniListSearchResult extends SearchResult {
  anilistId: number;
  averageScore?: number;
  popularity?: number;
  trending?: number;
  score?: number; // alias for averageScore for UI compatibility
}

export interface ComicVineSearchResult extends SearchResult {
  volumeId: number; // Required for type guard
  comicvineId: string;
  publisher?: string;
  deck?: string;
  issuesCount?: number;
  siteDetailUrl?: string;
}

export interface NativeDownloadSearchResult extends SearchResult {
  nativeDownloadId: string; // Required for type guard
  overview?: string;
  year?: number;
  images?: unknown[];
  remoteId?: string;
}

// ============================================================================
// Provider Metadata
// ============================================================================

export interface ProviderMetadata {
  provider: string;
  data: unknown;
  confidence?: number;
  lastUpdated?: Date;
}

/**
 * Provider metadata response from getProviderMetadata mutation
 * Combines metadata with provider binding information
 * Note: This is a standalone interface to allow flexible typing from different providers
 */
export interface ProviderMetadataResponse {
  // Provider identification
  source: string;
  providerId: string;

  // Core metadata fields
  title?: string;
  description?: string;
  alternativeTitles?: string[];

  // Status and format - may be strings or enums depending on provider
  status?: MangaPublicationStatus | string;
  format?: MangaFormat | string;

  // People
  author?: string;
  artist?: string;
  authors?: string[];
  artists?: string[];

  // Publication info
  publisher?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  year?: number;

  // Content
  genres?: string[];
  tags?: string[];
  themes?: string[];
  characters?: string[];

  // Counts
  chapters?: number;
  volumes?: number;
  totalChapters?: number;
  totalVolumes?: number;

  // Images
  coverUrl?: string;
  coverImage?: string;
  coverLarge?: string;
  coverMedium?: string;
  coverSmall?: string;
  bannerImage?: string;

  // Ratings and popularity
  rating?: number;
  score?: number;
  averageScore?: number;
  popularity?: number;

  // External links
  externalUrl?: string;
  url?: string;
  wikiUrl?: string;

  // Additional metadata
  [key: string]: unknown;
}

// ============================================================================
// Provider Configuration
// ============================================================================

/**
 * Configuration types
 */
export interface ComicVineConfig {
  // Required fields
  apiKey: string;

  // Provider configuration
  id?: string;
  name?: string;
  enabled?: boolean;
  priority?: number;
  capabilities?: string[];

  // API configuration
  apiEndpoint?: string;
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  throttleMs?: number;

  // Rate limiting
  rateLimit?: {
    requests: number;
    window: number;
  };
}

// ============================================================================
// ComicVine API Types
// ============================================================================

export interface ComicVineApiResponse {
  error: string;
  limit: number;
  offset: number;
  number_of_page_results: number;
  number_of_total_results: number;
  status_code: number;
  results: unknown[];
}

export interface ComicVineVolume {
  id: number;
  name: string;
  count_of_issues?: number;
  description?: string;
  image?: {
    icon_url?: string;
    medium_url?: string;
    screen_url?: string;
    screen_large_url?: string;
    small_url?: string;
    super_url?: string;
    thumb_url?: string;
    tiny_url?: string;
    original_url?: string;
  };
}

// ============================================================================
// Search Provider Interface
// ============================================================================

// Search Provider interface
export interface SearchProvider {
  name: string;
  type: unknown;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  getMetadata?(id: string, title?: string): Promise<SearchResult>;
  isEnabled?(): Promise<boolean>;
}

