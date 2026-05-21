/**
 * ComicVine API Query Definitions
 * 
 * This module provides optimized GraphQL queries for the ComicVine API.
 * Each query is carefully designed to fetch only required data while
 * maintaining API efficiency and rate limit compliance.
 * 
 * Query Categories:
 * - Basic Information (lightweight, search-optimized)
 * - Detailed Information (comprehensive metadata)
 * - Complete Information (all available data)
 * - Relationship Queries (issues, characters, creators)
 * 
 * Performance Optimization:
 * - Field selection to minimize response size
 * - Query modularization to prevent over-fetching
 * - Pagination support for large datasets
 * - Caching-friendly field combinations
 * 
 * Rate Limit Considerations:
 * - Basic queries count as 1 request
 * - Detailed queries with relationships as 2 requests
 * - Complete queries may count as multiple requests
 * 
 * @module comicvineQueries
 */

/**
 * Base URL for ComicVine API v4
 * All requests are made relative to this endpoint
 */
export const BASE_URL = 'https://comicvine.gamespot.com/api';

/**
 * Standard parameters included in all requests
 * Ensures consistent response format
 */
export const DEFAULT_PARAMS = {
  format: 'json',
};

/**
 * Field Lists for Different Query Types
 * 
 * Carefully curated field selections for different use cases:
 * - Optimized for specific view requirements
 * - Balanced between completeness and performance
 * - Structured for efficient caching
 * 
 * Usage Notes:
 * - Basic lists minimize data transfer
 * - Detailed lists include essential metadata
 * - Complete lists fetch all available data
 * - Relationship lists focus on specific aspects
 */
export const FIELD_LISTS = {
  // Basic volume info for search results and list views
  // Enhanced to include more useful fields for search results
  BASIC_VOLUME: [
    'id',
    'name',
    'image',
    'start_year',
    'publisher',
    'count_of_issues',
    'deck',
    'description',  // Added for full description
    'genres',       // Added for genre tags
    'concepts',     // Added for themes (ComicVine stores themes as concepts)
    'person_credits', // Added for authors/artists
    'characters',   // Added for character list
    'volume_number',
    'site_detail_url' // Added to get the actual ComicVine URL
  ].join(','),
  
  // Detailed volume info for manga detail pages
  DETAILED_VOLUME: [
    'id',
    'name',
    'image',
    'description',
    'start_year',
    'publisher',
    'count_of_issues',
    'genres',
    'concepts',     // Added for themes (ComicVine stores themes as concepts)
    'deck',
    'first_issue',
    'last_issue',
    'volume_number',
    'date_added',
    'date_last_updated'
  ].join(','),
  
  // Complete volume info with all related data
  COMPLETE_VOLUME: [
    'id',
    'name',
    'image',
    'description',
    'start_year',
    'publisher',
    'count_of_issues',
    'genres',
    'concepts',     // Themes (ComicVine stores themes as concepts)
    'characters',
    'person_credits',
    'first_issue',
    'last_issue',
    'volume_number',
    'date_added',
    'date_last_updated',
    'deck',
    'issues',
    'aliases',
    'site_detail_url',
    'resource_type',
    'concept_credits',
    'location_credits',
    'object_credits',
    'team_credits',
    'story_arc_credits',
    'issue_credits'
  ].join(','),
  
  // Issue info for chapter details
  ISSUE: [
    'id',
    'name',
    'image',
    'description',
    'issue_number',
    'volume',
    'cover_date',
    'store_date',
    'person_credits',
    'character_credits',
    'deck',
    'site_detail_url',  // Added to get proper URLs for each issue
    'associated_images', // Alt cover variants — feeds Metadata.galleryImages
    'aliases'            // Alternate issue titles — feeds Volume.alternativeTitle
  ].join(','),
  
  // Character info
  CHARACTER: [
    'id',
    'name',
    'image',
    'description',
    'deck',
    'publisher',
    'gender',
    'origin',
    'real_name',
    'volume_credits'
  ].join(','),
  
  // Creator info (person)
  CREATOR: [
    'id',
    'name',
    'image',
    'description',
    'deck',
    'birth',
    'country',
    'volume_credits',
    'issue_credits'
  ].join(',')
};

// Query parameters for different query types
export interface QueryParams {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Basic Volume Information Query
 * 
 * Lightweight query optimized for:
 * - Search results
 * - List views
 * - Grid displays
 * - Quick lookups
 * 
 * Performance Profile:
 * - Single API request
 * - Minimal data transfer
 * - High cache efficiency
 * - Fast response time
 * 
 * @param id - ComicVine volume ID
 * @returns Query parameters for basic volume info
 * 
 * @example
 * ```typescript
 * const params = basicVolumeInfoQuery(123);
 * // Use in API request:
 * const data = await api.get(`/volume/4050-123`, { params });
 * logger.info(data["name"], data.publisher);
 * ```
 */
export function basicVolumeInfoQuery(_id: number): QueryParams {
  return {
    field_list: FIELD_LISTS.BASIC_VOLUME
  };
}

/**
 * Detailed Volume Information Query
 * 
 * Comprehensive query for full volume details:
 * - Complete metadata
 * - Publication information
 * - Series details
 * - Issue tracking
 * 
 * Performance Profile:
 * - Multiple API requests
 * - Moderate data size
 * - Cacheable response
 * - Medium response time
 * 
 * @param id - ComicVine volume ID
 * @returns Query parameters for detailed volume info
 * 
 * @example
 * ```typescript
 * const params = detailedVolumeInfoQuery(123);
 * // Use in API request:
 * const data = await api.get(`/volume/4050-123`, { params });
 * logger.info(data["description"], data["genres"]);
 * ```
 */
export function detailedVolumeInfoQuery(_id: number): QueryParams {
  return {
    field_list: FIELD_LISTS.DETAILED_VOLUME
  };
}

/**
 * Complete Volume Information Query
 * 
 * Exhaustive query fetching all available data:
 * - All basic and detailed fields
 * - All relationships
 * - All metadata
 * - All credits
 * 
 * Performance Profile:
 * - Multiple API requests
 * - Large response size
 * - Complex caching needs
 * - Slower response time
 * 
 * Warning: Use sparingly due to high resource usage
 * 
 * @param id - ComicVine volume ID
 * @returns Query parameters for complete volume info
 * 
 * @example
 * ```typescript
 * const params = completeVolumeInfoQuery(123);
 * // Use in API request:
 * const data = await api.get(`/volume/4050-123`, { params });
 * // Access any available data
 * logger.info(data.characters, data.story_arc_credits);
 * ```
 */
export function completeVolumeInfoQuery(_id: number): QueryParams {
  return {
    field_list: FIELD_LISTS.COMPLETE_VOLUME
  };
}

/**
 * Issue Info Query
 * For chapter details
 */
export function issueInfoQuery(_id: number): QueryParams {
  return {
    field_list: FIELD_LISTS.ISSUE
  };
}

/**
 * Character Info Query
 * For character details
 */
export function characterInfoQuery(_id: number): QueryParams {
  return {
    field_list: FIELD_LISTS.CHARACTER
  };
}

/**
 * Creator Info Query
 * For author/artist details
 */
export function creatorInfoQuery(_id: number): QueryParams {
  return {
    field_list: FIELD_LISTS.CREATOR
  };
}

/**
 * Search Query for Basic Volume Information
 * 
 * Optimized search query with pagination:
 * - Basic volume details
 * - Search result formatting
 * - Pagination support
 * - Sort options
 * 
 * Performance Profile:
 * - Efficient search operation
 * - Minimal data per result
 * - Quick response time
 * - Pagination-friendly
 * 
 * @param query - Search string
 * @param page - Page number (0-based)
 * @param limit - Results per page
 * @returns Query parameters for volume search
 * 
 * @example
 * ```typescript
 * const params = searchBasicVolumesQuery('Batman', 0, 10);
 * // Use in API request:
 * const results = await api.get('/search', { params });
 * results.forEach(volume => logger.info(volume["name"]));
 * ```
 */
export function searchBasicVolumesQuery(query: string, page = 0, limit = 50): QueryParams {
  return {
    query,
    resources: 'volume',
    page,
    limit,
    field_list: FIELD_LISTS.BASIC_VOLUME
  };
}

/**
 * Volume Issues Query
 * 
 * Retrieves all issues/chapters for a volume:
 * - Issue metadata
 * - Chapter information
 * - Release dates
 * - Cover images
 * 
 * Performance Profile:
 * - Paginated requests
 * - Moderate data size
 * - Cacheable results
 * - Efficient filtering
 * 
 * @param volumeId - ComicVine volume ID
 * @param page - Page number (0-based)
 * @param limit - Results per page
 * @returns Query parameters for volume issues
 * 
 * @example
 * ```typescript
 * const params = volumeIssuesQuery(123, 0, 100);
 * // Use in API request:
 * const issues = await api.get('/issues', { params });
 * issues.forEach(issue => {
 *   logger.info(`#${issue.issue_number}: ${issue["name"]}`);
 * });
 * ```
 */
export function volumeIssuesQuery(volumeId: number, page = 0, limit = 100): QueryParams {
  return {
    filter: `volume:${volumeId}`,
    field_list: FIELD_LISTS.ISSUE,
    page,
    limit
  };
}

/**
 * Volume Characters Query
 * 
 * Fetches all characters appearing in a volume:
 * - Character details
 * - Appearance information
 * - Character metadata
 * - Related information
 * 
 * Performance Profile:
 * - Paginated requests
 * - Moderate to large data
 * - Cacheable results
 * - Complex relationships
 * 
 * @param volumeId - ComicVine volume ID
 * @param page - Page number (0-based)
 * @param limit - Results per page
 * @returns Query parameters for volume characters
 * 
 * @example
 * ```typescript
 * const params = volumeCharactersQuery(123, 0, 100);
 * // Use in API request:
 * const characters = await api.get('/characters', { params });
 * characters.forEach(char => {
 *   logger.info(`${char["name"]} (${char.real_name})`);
 * });
 * ```
 */
export function volumeCharactersQuery(volumeId: number, page = 0, limit = 100): QueryParams {
  return {
    filter: `volume:${volumeId}`,
    field_list: FIELD_LISTS.CHARACTER,
    page,
    limit
  };
}

/**
 * Volume Creators Query
 * 
 * Retrieves all creators involved with a volume:
 * - Authors and artists
 * - Role information
 * - Creator details
 * - Credit information
 * 
 * Performance Profile:
 * - Paginated requests
 * - Moderate data size
 * - Highly cacheable
 * - Role-based filtering
 * 
 * @param volumeId - ComicVine volume ID
 * @param page - Page number (0-based)
 * @param limit - Results per page
 * @returns Query parameters for volume creators
 * 
 * @example
 * ```typescript
 * const params = volumeCreatorsQuery(123, 0, 100);
 * // Use in API request:
 * const creators = await api.get('/people', { params });
 * creators.forEach(person => {
 *   logger.info(`${person["name"]} - ${person.role}`);
 * });
 * ```
 */
export function volumeCreatorsQuery(volumeId: number, page = 0, limit = 100): QueryParams {
  return {
    filter: `volume:${volumeId}`,
    field_list: FIELD_LISTS.CREATOR,
    page,
    limit
  };
}
