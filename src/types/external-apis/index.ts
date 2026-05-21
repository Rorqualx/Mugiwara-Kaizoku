/**
 * Type Definitions for External API Responses
 *
 * This module provides TypeScript type definitions for external API responses
 * that are not covered by Zod schemas, or for use in contexts where runtime
 * validation is not required.
 *
 * @module types/external-apis
 *
 * @remarks
 * - For runtime validation, prefer using Zod schemas from @/lib/validation/common-schemas
 * - These types are for static type checking only
 * - When receiving data from external APIs, always validate with Zod first
 */

// ============================================================================
// Re-export Zod-based Types
// ============================================================================

/**
 * Re-export validated types from Zod schemas
 *
 * @remarks
 * These types are automatically inferred from Zod schemas and include
 * runtime validation guarantees when used with the schemas
 */
export type {
  RawProviderData,
  RawVolumeData,
  RawChapterData,
  AniListMedia,
  AniListPage,
  ComicVineVolume,
  ComicVineResponse,
  MetadataResponse,
  SearchResult,
  PaginatedSearchResults,
} from '@/lib/validation/common-schemas';

// ============================================================================
// Provider-Agnostic Types
// ============================================================================

/**
 * Generic provider search result
 *
 * @remarks
 * Use this type for provider-agnostic search result handling
 */
export interface ProviderSearchResult {
  /** Unique identifier (can be string or number depending on provider) */
  id: string | number;

  /** Title of the manga/comic */
  title: string;

  /** URL to cover image (optional) */
  coverImage?: string;

  /** Description or synopsis (optional) */
  description?: string;

  /** Publication year (optional) */
  year?: number;

  /** Publication status (optional) */
  status?: string;

  /** Provider-specific score/rating (optional) */
  score?: number;

  /** Provider name */
  provider?: string;
}

/**
 * Volume data structure
 *
 * @remarks
 * Represents a manga volume with optional chapter information
 */
export interface VolumeData {
  /** Volume number */
  number: number;

  /** Volume title */
  title: string;

  /** Array of chapters in this volume (optional) */
  chapters?: ChapterData[];

  /** Cover image URL (optional) */
  coverImage?: string;

  /** Release date (optional) */
  releaseDate?: string;

  /** Page count (optional) */
  pages?: number;
}

/**
 * Chapter data structure
 *
 * @remarks
 * Represents a manga chapter
 */
export interface ChapterData {
  /** Chapter number */
  number: number;

  /** Chapter title (optional) */
  title?: string;

  /** Page count (optional) */
  pages?: number;

  /** URL to chapter (optional) */
  url?: string;

  /** Release date (optional) */
  releaseDate?: string;

  /** Volume this chapter belongs to (optional) */
  volume?: number;
}

// ============================================================================
// Provider-Specific Extended Types
// ============================================================================

/**
 * Extended AniList media type with additional fields
 *
 * @remarks
 * Extends the base AniListMedia with additional fields that may be present
 */
export interface AniListMediaExtended {
  id: number;
  title: {
    romaji: string;
    english?: string | null;
    native?: string | null;
  };
  coverImage?: {
    large?: string | null;
    medium?: string | null;
    extraLarge?: string | null;
  } | null;
  bannerImage?: string | null;
  description?: string | null;
  status?: string | null;
  genres?: string[] | null;
  averageScore?: number | null;
  startDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  } | null;
  endDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  } | null;
  volumes?: number | null;
  chapters?: number | null;
  countryOfOrigin?: string | null;
}

/**
 * Extended ComicVine volume type
 *
 * @remarks
 * Extends the base ComicVineVolume with additional fields
 */
export interface ComicVineVolumeExtended {
  id: number;
  name: string;
  start_year?: string | null;
  count_of_issues?: number | null;
  publisher?: {
    name: string;
    id?: number;
  } | null;
  description?: string | null;
  image?: {
    thumb_url?: string;
    small_url?: string;
    medium_url?: string;
    original_url?: string;
    super_url?: string;
  } | null;
  first_issue?: {
    id?: number;
    name?: string;
  } | null;
  last_issue?: {
    id?: number;
    name?: string;
  } | null;
}

// ============================================================================
// API Response Wrapper Types
// ============================================================================

/**
 * Generic API response wrapper
 *
 * @remarks
 * Use this for standardizing responses across different providers
 */
export interface ApiResponse<T> {
  /** Response data */
  data: T;

  /** Success status */
  success: boolean;

  /** Error message (if success is false) */
  error?: string;

  /** HTTP status code (optional) */
  statusCode?: number;

  /** Additional metadata (optional) */
  metadata?: {
    total?: number;
    page?: number;
    limit?: number;
    hasNextPage?: boolean;
  };
}

/**
 * Paginated API response
 *
 * @remarks
 * Standard structure for paginated responses
 */
export interface PaginatedResponse<T> {
  /** Array of results */
  results: T[];

  /** Total number of results */
  total?: number;

  /** Current page number */
  page?: number;

  /** Results per page */
  limit?: number;

  /** Whether there are more pages */
  hasNextPage?: boolean;

  /** Total number of pages */
  totalPages?: number;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Provider API error
 *
 * @remarks
 * Standardized error structure for provider API failures
 */
export interface ProviderApiError {
  /** Error message */
  message: string;

  /** Provider name */
  provider: string;

  /** HTTP status code (if applicable) */
  statusCode?: number;

  /** Original error details */
  details?: unknown;

  /** Timestamp of error */
  timestamp?: Date;
}

// ============================================================================
// Metadata Types
// ============================================================================

/**
 * Combined metadata from multiple providers
 *
 * @remarks
 * Used when aggregating metadata from multiple sources
 */
export interface CombinedMetadata {
  /** Primary title */
  title: string;

  /** Alternative titles */
  alternativeTitles?: string[];

  /** Description/synopsis */
  description?: string;

  /** Cover image URL */
  coverImage?: string;

  /** Banner image URL */
  bannerImage?: string;

  /** Authors/creators */
  authors?: string[];

  /** Genres */
  genres?: string[];

  /** Tags */
  tags?: string[];

  /** Publication status */
  status?: string;

  /** Publication year */
  year?: number;

  /** Average rating/score */
  rating?: number;

  /** Number of volumes */
  volumes?: number;

  /** Number of chapters */
  chapters?: number;

  /** Provider sources */
  sources?: {
    provider: string;
    id: string | number;
    url?: string;
  }[];
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Make all properties of T optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Record<string, unknown>
    ? DeepPartial<T[P]>
    : T[P];
};

/**
 * Extract the data type from an ApiResponse
 */
export type UnwrapApiResponse<T> = T extends ApiResponse<infer U> ? U : never;

/**
 * Extract the item type from a PaginatedResponse
 */
export type UnwrapPaginatedResponse<T> = T extends PaginatedResponse<infer U>
  ? U
  : never;
