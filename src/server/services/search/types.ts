/**
 * Type definitions for the manga search service
 * 
 * This module defines the core types used for manga search functionality across
 * different providers (AniList, ComicVine, etc.). It includes interfaces for
 * search results, provider implementations, and provider-specific data structures.
 * 
 * @module SearchTypes
 */

/**
 * Represents a standardized manga search result
 * 
 * This interface provides a unified structure for manga metadata across different
 * providers. It includes both common fields (title, description) and provider-specific
 * fields from AniList and ComicVine.
 * 
 * @example
 * ```typescript
 * const result: SearchResult = {
 *   id: "12345",
 *   title: "One Piece",
 *   cover: "https://example.com/cover.jpg",
 *   description: "The story follows Monkey D. Luffy...",
 *   status: "Ongoing",
 *   genres: ["Adventure", "Fantasy"],
 *   chapters: 1089,
 *   volumes: 106
 * };
 * ```
 */
export interface SearchResult {
  id: string;
  title: string;
  cover?: string;
  coverImage?: string; // For backward compatibility
  description?: string;
  status?: string;
  alternativeTitles?: string[];
  score?: number;
  popularity?: number;
  startDate?: string;
  endDate?: string;
  genres?: string[];
  themes?: string[]; // Themes/concepts (extracted from providers like ComicVine)
  chapters?: number | null; // Total number of chapters
  volumes?: number | null;  // Total number of volumes
  provider?: string; // Identifier for the provider that generated this result
  year?: number; // Publication year
  author?: string; // Author name (singular, for backward compatibility)
  authors?: string[]; // Authors list (multiple authors)
  artists?: string[]; // Artists list
  providerUrl?: string; // URL from the provider
  wikiUrl?: string; // Wiki URL for Fandom results
  url?: string; // Generic URL field for compatibility
  metadata?: Record<string, unknown>; // Additional metadata from provider
  
  // Additional fields from AniList
  idMal?: number;
  format?: string;
  countryOfOrigin?: string;
  isLicensed?: boolean;
  source?: string;
  meanScore?: number;
  favorites?: number;
  trending?: number;
  tags?: string[] | unknown[] | Array<{
    id: number;
    name: string;
    category?: string;
    rank?: number;
    isGeneralSpoiler?: boolean;
    isMediaSpoiler?: boolean;
  }>;
  bannerImage?: string;
  relations?: Array<{
    id: number;
    relationType: string;
    mediaId: number;
    title: string;
    format?: string;
    type?: string;
    status?: string;
    coverImage?: string;
  }>;
  characters?: Array<{
    id: number;
    name: string;
    role: string;
    image?: string;
    description?: string;
  }>;
  staff?: Array<{
    id: number;
    name: string;
    role: string;
    image?: string;
  }>;
  recommendations?: Array<{
    id: number;
    mediaId: number;
    title: string;
    coverImage?: string;
  }>;
  externalLinks?: Array<{
    id: number;
    url: string;
    site: string;
    type?: string;
  }>;
  
  // Additional fields from ComicVine
  aliases?: string[];
  siteDetailUrl?: string;
  resourceType?: string;
  volumeNumber?: number;
  dateAdded?: string;
  dateLastUpdated?: string;
  deck?: string; // Short description/summary
  firstIssue?: {
    id: number;
    name?: string;
    issueNumber?: string;
  };
  lastIssue?: {
    id: number;
    name?: string;
    issueNumber?: string;
  };
  publisher?: string | {
    id: number;
    name: string;
  };
  concepts?: Array<{
    id: number;
    name: string;
  }>;
  locations?: Array<{
    id: number;
    name: string;
  }>;
  objects?: Array<{
    id: number;
    name: string;
  }>;
  teams?: Array<{
    id: number;
    name: string;
  }>;
  storyArcs?: Array<{
    id: number;
    name: string;
  }>;
  issues?: Array<{
    id: number;
    name?: string;
    issueNumber?: string;
  }>;
}

/**
 * Defines the interface for a manga search provider
 * 
 * Search providers implement this interface to provide manga search and metadata
 * retrieval functionality. Each provider must implement both search and metadata
 * retrieval methods.
 * 
 * @example
 * ```typescript
 * class AniListProvider implements SearchProvider {
 *   name = "AniList";
 *   
 *   async search(query: string, options?: SearchOptions) {
 *     // Implementation
 *     return results;
 *   }
 *   
 *   async getMetadata(id: string) {
 *     // Implementation
 *     return metadata;
 *   }
 * }
 * ```
 */
export interface SearchProvider {
  name: string;
  type?: string;
  isEnabled?: boolean | (() => Promise<boolean>) | (() => boolean);
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  getMetadata(id: string, title?: string): Promise<SearchResult>;
}

/**
 * Options for configuring search requests
 * 
 * Provides pagination controls for search results. These options are passed
 * to provider search implementations to control result size and offset.
 * 
 * @example
 * ```typescript
 * const options: SearchOptions = {
 *   limit: 20,   // Return up to 20 results
 *   offset: 40   // Skip first 40 results
 * };
 * ```
 */
export interface SearchOptions {
  limit?: number;
  offset?: number;
}

/**
 * Enhanced search filters for advanced search functionality
 */
export interface SearchFilters {
  type?: string;
  status?: string;
  year?: number;
  genres?: string[];
  limit?: number;
  offset?: number;
  maxWikis?: number; // For Fandom provider
}

/**
 * Configuration for search providers
 */
export interface SearchProviderConfig {
  name?: string;
  identifier?: string;
  supportedTypes?: string[];
  rateLimit?: {
    requestsPerSecond: number;
    burstLimit?: number;
  };
  cache?: {
    enabled: boolean;
    ttl: number;
  };
  timeout?: number;
  retries?: number;
}

/**
 * Search error class
 */
export class SearchError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider?: string
  ) {
    super(message);
    this["name"] = 'SearchError';
  }
}

/**
 * Configuration for manga update monitoring
 * 
 * Defines how frequently a manga should be checked for updates. Supports both
 * predefined intervals and custom cron expressions.
 * 
 * @example
 * ```typescript
 * const config: MonitoringConfig = {
 *   interval: 'daily',
 *   overrideGlobal: true,
 *   lastChecked: new Date('2025-03-11'),
 *   nextCheck: new Date('2025-03-12')
 * };
 * 
 * // With custom interval
 * const customConfig: MonitoringConfig = {
 *   interval: 'custom',
 *   customInterval: '0 0 * * *', // Daily at midnight
 *   overrideGlobal: true
 * };
 * ```
 */
export interface MonitoringConfig {
  interval: 'never' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
  customInterval?: string; // cron expression
  overrideGlobal: boolean;
  lastChecked?: Date;
  nextCheck?: Date;
}

/**
 * Options for batch operations on manga
 * 
 * Configures how batch operations (like downloads) should be performed,
 * including format preferences and concurrency settings.
 * 
 * @example
 * ```typescript
 * const options: BatchOperationOptions = {
 *   format: 'cbz',
 *   concurrent: 3,
 *   priority: 1
 * };
 * ```
 */
export interface BatchOperationOptions {
  format?: 'cbz' | 'pdf' | 'raw';
  concurrent?: number;
  priority?: number;
}

/**
 * AniList-specific title information
 * 
 * Contains different versions of a manga's title as provided by AniList,
 * including romanized, English, and native language versions.
 * 
 * @example
 * ```typescript
 * const title: AniListTitle = {
 *   romaji: "Boku no Hero Academia",
 *   english: "My Hero Academia",
 *   native: "僕のヒーローアカデミア"
 * };
 * ```
 */
export interface AniListTitle {
  romaji?: string;
  english?: string;
  native?: string;
}

/**
 * AniList date representation
 * 
 * Represents a date in the AniList API format, with optional components
 * for partial dates.
 * 
 * @example
 * ```typescript
 * const date: AniListDate = {
 *   year: 2014,
 *   month: 7,
 *   day: 7
 * };
 * ```
 */
export interface AniListDate {
  year?: number;
  month?: number;
  day?: number;
}

/**
 * AniList cover image information
 * 
 * Contains URLs for different sizes of cover images from AniList.
 * 
 * @example
 * ```typescript
 * const coverImage: AniListCoverImage = {
 *   large: "https://example.com/large.jpg",
 *   medium: "https://example.com/medium.jpg"
 * };
 * ```
 */
export interface AniListCoverImage {
  large?: string;
  medium?: string;
}

/**
 * Raw response from the AniList API
 * 
 * Represents the structure of manga data as returned directly from the
 * AniList API, before transformation into the standardized SearchResult format.
 * 
 * @example
 * ```typescript
 * const response: AniListResponse = {
 *   id: 1,
 *   title: {
 *     romaji: "One Piece",
 *     english: "One Piece",
 *     native: "ワンピース"
 *   },
 *   description: "Gol D. Roger was known as the...",
 *   coverImage: {
 *     large: "https://example.com/cover.jpg"
 *   },
 *   status: "RELEASING",
 *   genres: ["Action", "Adventure"]
 * };
 * ```
 */
export interface AniListResponse {
  id: number;
  title: AniListTitle;
  description?: string;
  coverImage?: AniListCoverImage;
  status?: string;
  averageScore?: number;
  popularity?: number;
  startDate?: AniListDate;
  endDate?: AniListDate;
  genres?: string[];
  bannerImage?: string;
  synonyms?: string[];
}
