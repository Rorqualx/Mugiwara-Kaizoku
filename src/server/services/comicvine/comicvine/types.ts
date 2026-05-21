/**
 * ComicVine Type Definitions
 *
 * Type interfaces, error class, and type guards for ComicVine API integration.
 * Used across all comicvine modules.
 *
 * Extracted from: service.ts (lines 1-450)
 */

// ============================================================================
// Image Types
// ============================================================================

/**
 * ComicVine Image Object
 * Represents image URLs in various sizes provided by the ComicVine API
 *
 * @interface ComicVineImage
 * @property {string} [icon_url] - Smallest thumbnail size (16x16)
 * @property {string} [medium_url] - Medium size image (up to 320px)
 * @property {string} [screen_url] - Screen-optimized size (up to 640px)
 * @property {string} [small_url] - Small thumbnail size (up to 160px)
 * @property {string} [super_url] - Large size image (up to 1024px)
 * @property {string} [thumb_url] - Standard thumbnail size (up to 100px)
 * @property {string} [tiny_url] - Tiny thumbnail size (up to 50px)
 * @property {string} [original_url] - Original uploaded image size
 */
export interface ComicVineImage {
  icon_url?: string;
  medium_url?: string;
  screen_url?: string;
  small_url?: string;
  super_url?: string;
  thumb_url?: string;
  tiny_url?: string;
  original_url?: string;
}

// ============================================================================
// Entity Types
// ============================================================================

/**
 * ComicVine Publisher Object
 * Represents a comic publisher's basic information
 *
 * @interface ComicVinePublisher
 * @property {number} id - Unique identifier for the publisher
 * @property {string} [name] - Publisher's name
 * @property {string} [api_detail_url] - URL for detailed publisher information
 */
export interface ComicVinePublisher {
  id: number;
  name?: string;
  api_detail_url?: string;
}

/**
 * ComicVine Issue Object
 * Represents detailed information about a comic issue/chapter
 *
 * @interface ComicVineIssue
 * @property {number} id - Unique identifier for the issue
 * @property {string} [name] - Issue title/name
 * @property {string} [issue_number] - Issue number in the series
 * @property {ComicVineImage} [image] - Issue cover images
 * @property {string} [description] - Issue description/synopsis
 * @property {string} [api_detail_url] - URL for detailed issue information
 * @property {string} [cover_date] - Publication cover date
 * @property {string} [store_date] - Retail store release date
 * @property {Object} [volume] - Parent volume information
 * @property {Array<Object>} [character_credits] - Characters appearing in the issue
 * @property {Array<Object>} [person_credits] - Creators involved in the issue
 */
export interface ComicVineIssue {
  id: number;
  name?: string;
  issue_number?: string;
  image?: ComicVineImage;
  description?: string;
  api_detail_url?: string;
  site_detail_url?: string;  // URL to ComicVine webpage (for FlareSolverr scraping)
  cover_date?: string;
  store_date?: string;
  /** Alternate cover variants (first-print, reprint, alt-artist, etc.) */
  associated_images?: Array<{
    original_url?: string;
    id?: number;
    caption?: string | null;
    image_tags?: string;
  }>;
  /** Newline-separated alternate titles for the issue */
  aliases?: string | null;
  volume?: {
    id: number;
    name?: string;
    api_detail_url?: string;
  };
  character_credits?: Array<{
    id: number;
    name?: string;
    api_detail_url?: string;
  }>;
  person_credits?: Array<{
    id: number;
    name?: string;
    api_detail_url?: string;
    role?: string;
  }>;
}

/**
 * ComicVine Character Object
 * Represents detailed information about a comic character
 *
 * @interface ComicVineCharacter
 * @property {number} id - Unique identifier for the character
 * @property {string} [name] - Character's name
 * @property {ComicVineImage} [image] - Character images
 * @property {string} [description] - Character biography/description
 * @property {string} [api_detail_url] - URL for detailed character information
 * @property {string} [deck] - Brief character summary
 * @property {ComicVinePublisher} [publisher] - Character's publisher
 * @property {number} [gender] - Character's gender (0=Unknown, 1=Male, 2=Female)
 * @property {Object} [origin] - Character's origin information
 * @property {string} [real_name] - Character's real/civilian name
 * @property {Array<Object>} [volume_credits] - Volumes featuring the character
 */
export interface ComicVineCharacter {
  id: number;
  name?: string;
  image?: ComicVineImage;
  description?: string;
  api_detail_url?: string;
  deck?: string;
  publisher?: ComicVinePublisher;
  gender?: number;
  origin?: {
    id: number;
    name?: string;
    api_detail_url?: string;
  };
  real_name?: string;
  volume_credits?: Array<{
    id: number;
    name?: string;
    api_detail_url?: string;
  }>;
}

/**
 * ComicVine Creator Object
 * Represents detailed information about a comic creator
 *
 * @interface ComicVineCreator
 * @property {number} id - Unique identifier for the creator
 * @property {string} [name] - Creator's name
 * @property {ComicVineImage} [image] - Creator images
 * @property {string} [description] - Creator biography/description
 * @property {string} [api_detail_url] - URL for detailed creator information
 * @property {string} [deck] - Brief creator summary
 * @property {string} [birth] - Creator's birth date
 * @property {string} [country] - Creator's country of origin
 * @property {Array<Object>} [volume_credits] - Volumes the creator worked on
 * @property {Array<Object>} [issue_credits] - Issues the creator worked on
 */
export interface ComicVineCreator {
  id: number;
  name?: string;
  image?: ComicVineImage;
  description?: string;
  api_detail_url?: string;
  deck?: string;
  birth?: string;
  country?: string;
  volume_credits?: Array<{
    id: number;
    name?: string;
    api_detail_url?: string;
  }>;
  issue_credits?: Array<{
    id: number;
    name?: string;
    api_detail_url?: string;
  }>;
}

/**
 * ComicVine Volume Object
 * Represents detailed information about a comic volume/series
 *
 * @interface ComicVineVolume
 * @property {number} id - Unique identifier for the volume
 * @property {string} [name] - Volume title/name
 * @property {ComicVineImage} [image] - Volume cover images
 * @property {string} [description] - Volume description/synopsis
 * @property {string} [api_detail_url] - URL for detailed volume information
 * @property {string} [deck] - Brief volume summary
 * @property {number} [start_year] - Year the volume started publication
 * @property {ComicVinePublisher} [publisher] - Volume's publisher
 * @property {number} [count_of_issues] - Total number of issues in the volume
 * @property {Array<Object>} [genres] - Volume genres
 * @property {Object} [first_issue] - First issue in the volume
 * @property {Object} [last_issue] - Last issue in the volume
 * @property {number} [volume_number] - Volume number in series
 * @property {string} [date_added] - Date added to ComicVine
 * @property {string} [date_last_updated] - Last update date
 * @property {Array<Object>} [characters] - Characters appearing in the volume
 * @property {Array<Object>} [person_credits] - Creators involved in the volume
 * @property {Array<Object>} [issues] - Issues in the volume
 * @property {string[]} [aliases] - Alternative titles
 * @property {string} [site_detail_url] - URL to ComicVine webpage
 * @property {string} [resource_type] - API resource type
 * @property {Array<Object>} [concept_credits] - Related concepts
 * @property {Array<Object>} [location_credits] - Featured locations
 * @property {Array<Object>} [object_credits] - Featured objects
 * @property {Array<Object>} [team_credits] - Featured teams
 * @property {Array<Object>} [story_arc_credits] - Related story arcs
 * @property {Array<Object>} [issue_credits] - Related issues
 */
export interface ComicVineVolume {
  id: number;
  name?: string;
  image?: ComicVineImage;
  description?: string;
  api_detail_url?: string;
  deck?: string;
  start_year?: number;
  publisher?: ComicVinePublisher;
  count_of_issues?: number;
  genres?: Array<{
    id: number;
    name?: string;
    api_detail_url?: string;
  }>;
  first_issue?: {
    id: number;
    name?: string;
    issue_number?: string;
    api_detail_url?: string;
  };
  last_issue?: {
    id: number;
    name?: string;
    issue_number?: string;
    api_detail_url?: string;
  };
  volume_number?: number;
  date_added?: string;
  date_last_updated?: string;
  characters?: Array<{
    id: number;
    name?: string;
    api_detail_url?: string;
  }>;
  person_credits?: Array<{
    id: number;
    name?: string;
    api_detail_url?: string;
    role?: string;
  }>;
  issues?: Array<{
    id: number;
    name?: string;
    issue_number?: string;
    api_detail_url?: string;
  }>;
  // Additional fields from ComicVine API
  aliases?: string[];
  site_detail_url?: string;
  resource_type?: string;
  concept_credits?: Array<{
    id: number;
    name?: string;
    api_detail_url?: string;
  }>;
  location_credits?: Array<{
    id: number;
    name?: string;
    api_detail_url?: string;
  }>;
  object_credits?: Array<{
    id: number;
    name?: string;
    api_detail_url?: string;
  }>;
  team_credits?: Array<{
    id: number;
    name?: string;
    api_detail_url?: string;
  }>;
  story_arc_credits?: Array<{
    id: number;
    name?: string;
    api_detail_url?: string;
  }>;
  issue_credits?: Array<{
    id: number;
    name?: string;
    api_detail_url?: string;
  }>;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * ComicVine Pagination Information
 * Contains pagination details for API responses
 *
 * @interface ComicVinePageInfo
 * @property {number} [total_results] - Total number of results available
 * @property {number} [page_number] - Current page number
 * @property {number} [total_pages] - Total number of pages
 * @property {number} [limit] - Results per page
 * @property {number} [offset] - Offset from first result
 */
export interface ComicVinePageInfo {
  total_results?: number;
  page_number?: number;
  total_pages?: number;
  limit?: number;
  offset?: number;
}

/**
 * ComicVine API Response
 * Generic response structure for single-item API responses
 *
 * @interface ComicVineResponse
 * @template T - Type of the results data
 * @property {string} error - Error message if any
 * @property {number} limit - Results per page limit
 * @property {number} offset - Results offset
 * @property {number} number_of_page_results - Results in current page
 * @property {number} number_of_total_results - Total results available
 * @property {number} status_code - HTTP status code
 * @property {T} results - Response data
 * @property {string} version - API version
 */
export interface ComicVineResponse<T> {
  error: string;
  limit: number;
  offset: number;
  number_of_page_results: number;
  number_of_total_results: number;
  status_code: number;
  results: T;
  version: string;
}

/**
 * ComicVine API List Response
 * Generic response structure for list-type API responses
 *
 * @interface ComicVineListResponse
 * @template T - Type of each result item
 * @property {string} error - Error message if any
 * @property {number} limit - Results per page limit
 * @property {number} offset - Results offset
 * @property {number} number_of_page_results - Results in current page
 * @property {number} number_of_total_results - Total results available
 * @property {number} status_code - HTTP status code
 * @property {T[]} results - Array of response data
 * @property {string} version - API version
 */
export interface ComicVineListResponse<T> {
  error: string;
  limit: number;
  offset: number;
  number_of_page_results: number;
  number_of_total_results: number;
  status_code: number;
  results: T[];
  version: string;
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Queued Request for managing concurrent requests
 * Used internally by the rate limiter to queue and manage API requests
 *
 * @interface QueuedRequest
 * @property {string} id - Unique identifier for the request
 * @property {Function} execute - Function to execute the request
 * @property {Function} resolve - Promise resolve callback
 * @property {Function} reject - Promise reject callback
 * @property {number} retries - Current retry count
 * @property {number} maxRetries - Maximum number of retries allowed
 */
export interface QueuedRequest {
  id: string;
  execute: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  retries: number;
  maxRetries: number;
}

/**
 * ComicVine API Response structure
 * Base response structure for type validation
 *
 * @interface ComicVineApiResponse
 * @property {string} error - Error message from API
 * @property {number} status_code - HTTP status code
 * @property {unknown} [results] - Response data
 * @property {number} [limit] - Results per page limit
 * @property {number} [offset] - Results offset
 * @property {number} [number_of_page_results] - Results in current page
 * @property {number} [number_of_total_results] - Total results available
 */
export interface ComicVineApiResponse {
  error: string;
  status_code: number;
  results?: unknown;
  limit?: number;
  offset?: number;
  number_of_page_results?: number;
  number_of_total_results?: number;
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * ComicVine Error class for API-specific errors
 * Provides structured error information with status code and retry capability
 *
 * @class ComicVineError
 * @extends Error
 * @property {string} message - Error message
 * @property {number} [statusCode] - HTTP status code if available
 * @property {boolean} retryable - Whether the request can be retried
 */
export class ComicVineError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'ComicVineError';
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if parsed data is a ComicVine API response
 *
 * @param data - Unknown data to validate
 * @returns True if data matches ComicVineApiResponse structure
 */
export function isComicVineResponse(data: unknown): data is ComicVineApiResponse {
  return typeof data === 'object' && data !== null && 'error' in data && 'status_code' in data;
}
