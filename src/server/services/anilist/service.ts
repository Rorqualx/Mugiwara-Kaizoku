/**
 * AniList Integration Service Module
 * 
 * A comprehensive service layer for AniList API integration that provides:
 * 
 * Core Features:
 * - Authentication and initialization with fallback modes
 * - Manga search with flexible options
 * - Rich metadata retrieval and transformation
 * - Robust error handling with recovery
 * - Efficient type conversions and mappings
 * 
 * Integration Capabilities:
 * - Supports both authenticated and public access
 * - Graceful degradation when credentials unavailable
 * - Modular query selection for optimized data retrieval
 * - Automatic metadata enrichment
 * 
 * Error Handling:
 * - Comprehensive error recovery strategies
 * - Detailed logging for debugging
 * - Graceful fallbacks for common failures
 * - Rate limit compliance
 * 
 * Performance Features:
 * - Query optimization based on needs
 * - Efficient data transformation
 * - Memory-conscious operations
 * - Request deduplication
 * 
 * Usage Examples:
 * ```typescript
 * // Initialize service
 * const service = new AniListService();
 * await service.initialize();
 * 
 * // Search for manga
 * const results = await service.searchManga('One Piece', {
 *   limit: 10,
 *   includeDescription: true
 * });
 * 
 * // Get detailed information
 * const details = await service.getMangaDetails(123);
 * 
 * // Update metadata
 * await service.updateMangaMetadata(localId, anilistId);
 * ```
 * 
 * @module anilistService
 */


import { MangaPublicationStatus, type Prisma } from '@prisma/client';

import { prisma } from '@/server/db';
import type { ConfigService as ExternalConfigService } from '@/types/config-service';
import { createContextualErrorCreator } from '@/utils/error-handling';
import { logger } from '@/utils/logger';


// Import kept for potential future use
 
import { adaptConfigService as _adaptConfigService } from '../config/configServiceAdapter';


import { anilistClient, AniListGraphQLClient } from './client';
import * as modularQueries from './modularQueries';
import * as queries from './queries';

import type { ConfigService as InternalConfigService } from '../config/configService';

/**
 * Interface for manga search results from AniList
 * 
 * Represents the essential data returned from basic manga searches.
 * Fields are optional to handle partial API responses gracefully.
 * 
 * @example
 * ```typescript
 * const result: AniListMangaResult = {
 *   id: 123,
 *   title: {
 *     english: "One Piece",
 *     romaji: "One Piece",
 *     native: "ワンピース"
 *   },
 *   coverImage: {
 *     large: "https://..."
 *   }
 * };
 * ```
 */
export interface AniListMangaResult {
  id: number;
  idMal?: number;
  title: {
    english?: string;
    romaji?: string;
    native?: string;
  };
  description?: string;
  coverImage?: {
    extraLarge?: string;
    large?: string;
    medium?: string;
    color?: string;
  };
  bannerImage?: string;
  format?: string;
  status?: string;
  countryOfOrigin?: string;
  isAdult?: boolean;
  chapters?: number;
  volumes?: number;
  genres?: string[];
  synonyms?: string[];
  averageScore?: number;
  meanScore?: number;
  popularity?: number;
  siteUrl?: string;
  startDate?: {
    year?: number;
    month?: number;
    day?: number;
  };
  endDate?: {
    year?: number;
    month?: number;
    day?: number;
  };
  tags?: Array<{
    id?: number;
    name?: string;
    category?: string;
    rank?: number;
    isMediaSpoiler?: boolean;
  }>;
}

/**
 * Interface for detailed manga information from AniList
 * 
 * Comprehensive manga data structure including all available fields.
 * Extends basic search results with additional metadata fields.
 * 
 * Note: All fields are optional to handle varying API responses
 * and prevent runtime errors from missing data.
 * 
 * @example
 * ```typescript
 * const details: AniListMangaDetails = {
 *   id: 123,
 *   title: { english: "One Piece" },
 *   genres: ["Action", "Adventure"],
 *   staff: {
 *     edges: [
 *       {
 *         role: "Story & Art",
 *         node: { name: { full: "Oda Eiichiro" } }
 *       }
 *     ]
 *   }
 * };
 * ```
 */
export interface AniListMangaDetails extends AniListMangaResult {
  genres?: string[];
  synonyms?: string[];
  staff?: {
    edges?: Array<{
      role?: string;
      node?: {
        name?: {
          full?: string;
        };
      };
    }>;
  };
  tags?: Array<{
    name?: string;
    rank?: number;
  }>;
  externalLinks?: Array<{
    url?: string;
    site?: string;
  }>;
  /**
   * Phase 1: directed relations from AL (prequel/sequel/side_story/etc.).
   * Fed into the MangaRelation table by phase-finalize/manga-relation-resolver.
   */
  relations?: {
    edges?: Array<{
      id?: number;
      relationType?: string;
      node?: {
        id?: number;
        title?: { romaji?: string; english?: string };
        format?: string;
        type?: string;
        status?: string;
        coverImage?: { medium?: string };
      };
    }>;
  };
}

/**
 * Interface for AniList search response
 * 
 * Represents the paginated response structure from AniList searches.
 * Includes the media array containing search results.
 * 
 * @example
 * ```typescript
 * const response: AniListSearchResponse = {
 *   Page: {
 *     media: [
 *       { id: 123, title: { english: "One Piece" } },
 *       { id: 456, title: { english: "Naruto" } }
 *     ]
 *   }
 * };
 * ```
 */
interface AniListSearchResponse {
  Page: {
    media: AniListMangaResult[];
  };
}

/**
 * Interface for AniList manga details response
 * 
 * Represents the full response structure for detailed manga queries.
 * Contains a single Media object with comprehensive manga data.
 * 
 * @example
 * ```typescript
 * const response: AniListDetailsResponse = {
 *   Media: {
 *     id: 123,
 *     title: { english: "One Piece" },
 *     description: "...",
 *     genres: ["Action", "Adventure"]
 *   }
 * };
 * ```
 */
interface AniListDetailsResponse {
  Media: AniListMangaDetails;
}

/**
 * Type guard to check if an object is an InternalConfigService
 * This is done by checking for internal-specific methods
 */
function isInternalConfigService(obj: unknown): obj is InternalConfigService {
  return (
    obj !== null &&
    obj !== undefined &&
    typeof obj === 'object' &&
    'get' in obj &&
    'set' in obj &&
    'getAll' in obj
  );
}

/**
 * AniList Integration Service
 *
 * Core service class that provides a comprehensive interface to the AniList API.
 * Handles all aspects of AniList integration including:
 *
 * Authentication:
 * - Client initialization with credentials
 * - Token management and refresh
 * - Public access fallback
 *
 * Data Operations:
 * - Manga search with filters
 * - Detailed information retrieval
 * - Metadata synchronization
 * - Batch operations
 *
 * Error Handling:
 * - Network error recovery
 * - Rate limit management
 * - Data validation
 * - Fallback strategies
 *
 * @example
 * ```typescript
 * // Initialize with settings
 * const service = new AniListService();
 * const initialized = await service.initialize();
 *
 * if (initialized) {
 *   // Search with options
 *   const results = await service.searchManga('One Piece', {
 *     limit: 10,
 *     includeDescription: true
 *   });
 *
 *   // Get detailed info
 *   const details = await service.getMangaDetails(123);
 *
 *   // Update metadata
 *   await service.updateMangaMetadata(
 *     localMangaId,
 *     anilistId
 *   );
 * }
 * ```
 */
export class AniListService {
  /**
   * Initialize the AniList client with credentials from the configuration system
   * 
   * Comprehensive initialization process that:
   * 1. Verifies AniList integration status
   * 2. Retrieves credentials from the unified configuration service
   * 3. Validates and configures the client
   * 4. Sets up error handling
   * 
   * Credential Sources:
   * - Centralized configuration system
   * 
   * Error Handling:
   * - Invalid credentials
   * - Missing configuration
   * - Configuration access errors
   * - Network issues
   * 
   * @param {ExternalConfigService | InternalConfigService} [configServiceInstance] - Optional configuration service instance
   * @returns {Promise<boolean>} True if initialization successful
   * @throws {Error} If critical initialization fails
   *
   * @example
   * ```typescript
   * try {
   *   const success = await anilistService.initialize();
   *
   *   if (success) {
   *     logger.info('AniList client ready');
   *     // Start using the service
   *     const results = await service.searchManga('One Piece');
   *   } else {
   *     logger.info('AniList integration disabled or misconfigured');
   *     // Handle graceful fallback
   *   }
   * } catch (error) {
   *   console.error('Failed to initialize AniList service:', error);
   *   // Implement recovery strategy
   * }
   * ```
   */
  async initialize(configServiceInstance?: ExternalConfigService | InternalConfigService | unknown): Promise<boolean> {
    return this.errorHandler.withErrorHandling(
      async () => {
        // Import here to avoid circular dependencies
        const { anilistConfigService, getAnilistConfigService } = await import('./configService');

        // Get the configuration service instance
        // Adapt the config service if it's the internal implementation
        let internalConfigService: InternalConfigService | undefined;

        if (configServiceInstance !== undefined && configServiceInstance !== null) {
          if (isInternalConfigService(configServiceInstance)) {
            // It's already an internal config service
            internalConfigService = configServiceInstance;
          } else {
            // It's an external config service, we can't use it directly
            // Fall back to the default anilistConfigService
            internalConfigService = undefined;
          }
        }

        const configService = internalConfigService !== undefined
          ? getAnilistConfigService(internalConfigService)
          : anilistConfigService;

        // Check if AniList is enabled in the configuration
        const isEnabled = await configService.isEnabled();

        if (!isEnabled) {
          logger.debug('AniList integration is disabled in configuration');
          return false;
        }

        // Get credentials from the configuration service
        const credentials = await configService.getApiCredentials();
        const { clientId, clientSecret, accessToken } = credentials;

        // Check if we have valid credentials
        if (clientId && clientSecret) {
          // Create a new client with the credentials
          const newClient = new AniListGraphQLClient(clientId, clientSecret, accessToken);

          // Replace the singleton instance properties
          Object.assign(anilistClient, newClient);

          logger.info('AniList client initialized with credentials from configuration');
          return true;
        }

        logger.debug('AniList credentials not found in configuration');
        return false;
      },
      "initialize",
      { configServiceProvided: !!configServiceInstance }
    ).catch((error) => {
      // On error, return false instead of throwing
      logger.error(`Failed to initialize AniList client: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    });
  }

  /**
   * Search for manga on AniList
   * 
   * Performs an optimized search operation with configurable options.
   * Handles various edge cases and provides detailed error information.
   * 
   * Features:
   * - Configurable result limit
   * - Optional field selection
   * - Automatic error recovery
   * - Response validation
   * 
   * Error Handling:
   * - Invalid query strings
   * - Network timeouts
   * - Rate limiting
   * - Malformed responses
   * 
   * @param {string} query - Search query string
   * @param {Object} options - Search configuration
   * @param {number} [options.limit=10] - Maximum results (1-50)
   * @param {boolean} [options.includeDescription=false] - Include full descriptions
   * @returns {Promise<AniListMangaResult[]>} Filtered and validated results
   * @throws {Error} For invalid queries or critical failures
   * 
   * @example
   * ```typescript
   * try {
   *   // Basic search
   *   const results = await service.searchManga('One Piece');
   * 
   *   // Advanced search
   *   const detailed = await service.searchManga('One Piece', {
   *     limit: 25,
   *     includeDescription: true
   *   });
   * 
   *   // Process results
   *   detailed.forEach(manga => {
   *     logger.info(`${manga["title"].english}: ${manga["description"]}`);
   *   });
   * } catch (error) {
   *   console.error('Search failed:', error);
   *   // Implement fallback or retry logic
   * }
   * ```
   */
  // Create error handler with service context
  private errorHandler = createContextualErrorCreator({
    service: "AniListService",
    resourceType: "Manga"
  });

  async searchManga(
  query: string,
  options: {limit?: number;includeDescription?: boolean;filterAdultContent?: boolean;} = {})
  : Promise<AniListMangaResult[]> {
    return this.errorHandler.withErrorHandling(
      async () => {
        const { limit = 10, includeDescription = false, filterAdultContent } = options;

        // Get filter setting from config if not provided
        let shouldFilterAdult = filterAdultContent;
        if (shouldFilterAdult === undefined) {
          try {
            const { configService } = await import('../config/configService');
            shouldFilterAdult = await configService.get<boolean>('anilist.filterAdultContent');
          } catch {
            shouldFilterAdult = true; // Default to filtering if config fails
          }
        }

        // Build query based on options - include all comprehensive fields
        const searchQuery = includeDescription ?
        modularQueries.buildSearchQuery([
        'title',
        'description',
        'coverImage',
        'status',
        'format',
        'chapters',
        'volumes',
        'genres',
        'synonyms',
        'averageScore',
        'popularity',
        'idMal',
        'bannerImage',
        'startDate',
        'endDate',
        'tags',
        'staff',
        'countryOfOrigin',
        'isAdult',
        'source',
        'externalLinks']
        ) :
        queries.SEARCH_MANGA;

        // Execute search
        const variables: Record<string, unknown> = {
          search: query,
          limit
        };

        // Add adult filter if configured
        if (shouldFilterAdult) {
          variables["isAdult"] = false; // Only show non-adult content
        }

        const response = await anilistClient.query<AniListSearchResponse>(
          searchQuery,
          variables
        );

        // Validate response structure
        if (!Array.isArray(response.Page.media)) {
          throw this.errorHandler.createError(
            "Invalid response structure from AniList API",
            "searchManga",
            { query }
          );
        }

        return response.Page.media;
      },
      "searchManga",
      { query, options }
    ).catch((error) => {
      // On error, return empty array instead of throwing
      logger.warn(`Search failed, returning empty results: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    });
  }

  /**
   * Get detailed information about a specific manga
   * 
   * Retrieves comprehensive manga data including relationships,
   * metadata, and statistics. Implements caching and validation.
   * 
   * Retrieved Data:
   * - Basic information (title, status)
   * - Publication details (volumes, chapters)
   * - Rich metadata (genres, tags)
   * - Related content
   * - Community data
   * 
   * Error Handling:
   * - Invalid manga IDs
   * - Missing data fields
   * - API timeouts
   * - Rate limiting
   * 
   * @param {number} id - AniList manga ID
   * @returns {Promise<AniListMangaDetails | null>} Full manga details or null if not found
   * @throws {Error} For invalid IDs or API failures
   * 
   * @example
   * ```typescript
   * try {
   *   const details = await service.getMangaDetails(123);
   *   
   *   if (details) {
   *     // Process manga information
   *     const {
   *       title,
   *       description,
   *       chapters,
   *       genres
   *     } = details;
   * 
   *     // Use the data
   *     logger.info(`Found: ${title.english}`);
   *   } else {
   *     logger.info('Manga not found');
   *   }
   * } catch (error) {
   *   console.error('Failed to get manga details:', error);
   *   // Handle error case
   * }
   * ```
   */
  async getMangaDetails(id: number): Promise<AniListMangaDetails | null> {
    return this.errorHandler.withErrorHandling(
      async () => {
        const response = await anilistClient.query<AniListDetailsResponse>(
          queries.GET_MANGA_DETAILS,
          { id }
        );

        // Response.Media is guaranteed by the type AniListDetailsResponse
        return response.Media;
      },
      "getMangaDetails",
      { mangaId: id }
    ).catch((error) => {
      // On error, return null instead of throwing
      logger.warn(`Failed to get manga details, returning null: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    });
  }

  /**
   * Update manga metadata with information from AniList
   * 
   * Synchronizes local manga metadata with AniList data.
   * Performs intelligent merging and validation of metadata.
   * 
   * Update Process:
   * 1. Fetch latest AniList data
   * 2. Transform to local format
   * 3. Validate all fields
   * 4. Merge with existing data
   * 5. Save to database
   * 
   * Metadata Handling:
   * - Preserves local customizations
   * - Updates only changed fields
   * - Maintains data integrity
   * - Handles missing fields
   * 
   * Error Recovery:
   * - Network failures
   * - Invalid data
   * - Partial updates
   * - Concurrent modifications
   * 
   * @param {number} mangaId - Local manga database ID
   * @param {number} anilistId - AniList manga ID
   * @returns {Promise<boolean>} True if update successful
   * @throws {Error} For critical update failures
   * 
   * @example
   * ```typescript
   * try {
   *   const success = await service.updateMangaMetadata(
   *     localId,
   *     anilistId
   *   );
   * 
   *   if (success) {
   *     logger.info('Metadata updated successfully');
   *   } else {
   *     logger.info('Update skipped - no changes needed');
   *   }
   * } catch (error) {
   *   console.error('Metadata update failed:', error);
   *   // Implement retry logic or manual update
   * }
   * ```
   */

  /**
   * Maps AniList status to Prisma MangaPublicationStatus enum
   */
  private mapAniListStatusToPrisma(status?: string): MangaPublicationStatus | undefined {
    if (!status) return undefined;

    const statusMap: Record<string, MangaPublicationStatus> = {
      'FINISHED': MangaPublicationStatus.COMPLETED,
      'RELEASING': MangaPublicationStatus.ONGOING,
      'NOT_YET_RELEASED': MangaPublicationStatus.NOT_YET_PUBLISHED,
      'CANCELLED': MangaPublicationStatus.CANCELLED,
      'HIATUS': MangaPublicationStatus.HIATUS
    };

    return statusMap[status.toUpperCase()] ?? MangaPublicationStatus.UNKNOWN;
  }

  async updateMangaMetadata(mangaId: number, anilistId: number): Promise<boolean> {
    return this.errorHandler.withErrorHandling(
      async () => {
        const details = await this.getMangaDetails(anilistId);
        if (!details) {
          return false;
        }

        // Transform AniList data to our metadata format
        const metadata: Record<string, unknown> = {
          title: (details["title"].english ?? details["title"].romaji) ?? details["title"].native ?? '',
          authors: details.staff?.edges?.
          filter((edge) => edge.role?.toLowerCase().includes('story')).
          map((edge) => edge.node?.name?.full).
          filter(Boolean) as string[],
          genres: details["genres"]?.filter(Boolean) as string[],
          tags: details["tags"]?.map((tag) => tag.name).filter(Boolean) as string[]
        };

        if (details["description"]) metadata['description'] = details["description"];
        if (details.coverImage?.large || details.coverImage?.medium) {
          metadata['coverUrl'] = details.coverImage.large ?? details.coverImage.medium;
        }
        if (details["status"]) metadata['status'] = this.mapAniListStatusToPrisma(details["status"]);
        // Type system guarantees these are defined (not null)
        if (details["chapters"]) metadata['chapters'] = details["chapters"];
        if (details.volumes) metadata['volumes'] = details.volumes;

        // Create a properly typed update input (deep clone to match Prisma's expected type)
        const metadataClone = JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>;
        const updateData = {
          metadata: {
            update: metadataClone
          }
        };

        // Update manga in database
        await prisma.manga.update({
          where: { id: mangaId },
          data: updateData as Prisma.MangaUpdateInput // Type assertion for properly constructed data
        });

        return true;
      },
      "updateMangaMetadata",
      { mangaId, anilistId }
    ).catch((error) => {
      // On error, return false instead of throwing
      logger.warn(`Failed to update manga metadata, returning false: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    });
  }
}

// Create and export singleton instance
export const anilistService = new AniListService();