/**
 * ComicVine Integration Service - Main Aggregator
 *
 * This service aggregates all ComicVine-related modules into a unified service.
 * All operations are delegated to specialized modules for maintainability.
 *
 * Architecture:
 * - comicvine/types.ts - Type definitions (0 methods)
 * - comicvine/http-client.ts - HTTP client with retry (1 class)
 * - comicvine/volume-operations.ts - Volume operations (8 methods)
 * - comicvine/entity-operations.ts - Entity operations (3 methods)
 *
 * Total: 11+ methods across 4 modules
 *
 * Original file: 1,525 lines -> Refactored: ~400 lines (74% reduction)
 */

import axios from 'axios';

import { ValidationError } from '@/utils/errors';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';

import * as entityOps from './comicvine/entity-operations';
import { ComicVineHttpClient } from './comicvine/http-client';
import * as volumeOps from './comicvine/volume-operations';
import * as modularQueries from './modularQueries';
import { ComicVineRateLimiter } from './modules/rateLimiter';

// Import from decomposed modules

// Re-export types for backward compatibility
export type {
  ComicVineImage,
  ComicVinePublisher,
  ComicVineIssue,
  ComicVineCharacter,
  ComicVineCreator,
  ComicVineVolume,
  ComicVinePageInfo,
  ComicVineResponse,
  ComicVineListResponse
} from './comicvine/types';

// Re-export class and function
export { ComicVineError, isComicVineResponse } from './comicvine/types';

import type {
  ComicVineVolume,
  ComicVineIssue,
  ComicVineCharacter,
  ComicVineCreator,
  ComicVineResponse,
  ComicVineListResponse,
  QueuedRequest
} from './comicvine/types';
import type { ConfigService } from '../config/configService';
import type { AxiosInstance } from 'axios';

/**
 * ComicVine Integration Service
 *
 * Comprehensive service layer for interacting with the ComicVine API.
 * Implements robust error handling, rate limiting, and caching for
 * reliable comic metadata retrieval.
 *
 * Core Features:
 * - Volume and issue information retrieval
 * - Character and creator data access
 * - Search functionality
 * - Metadata enrichment
 *
 * Advanced Capabilities:
 * - Intelligent rate limiting
 * - Request caching
 * - Error recovery
 * - Circuit breaker protection
 *
 * @example
 * ```typescript
 * // Initialize service
 * const service = new ComicVineService();
 * await service.initialize();
 *
 * // Search for volumes
 * const results = await service.searchBasicVolumes('Batman');
 *
 * // Get detailed information
 * const volume = await service.getDetailedVolumeInfo(123);
 * ```
 */
export class ComicVineService {
  private apiKey: string | null = null;
  private axiosInstance: AxiosInstance | null = null;
  private rateLimiter: ComicVineRateLimiter;
  private httpClient: ComicVineHttpClient;
  private requestQueue: QueuedRequest[] = [];
  private isProcessingQueue = false;

  constructor() {
    // Initialize with strict Comic Vine limits from best practices guide
    this.rateLimiter = new ComicVineRateLimiter({
      maxRequestsPerHour: 200, // Comic Vine actual limit
      minDelayMs: 1000, // 1 second minimum between requests
      safeDelayMs: 3000, // 3 seconds recommended delay
      maxDelayMs: 5000, // 5 seconds when near limit
      warningThreshold: 0.75 // Warn at 75% of limit
    });
    this.httpClient = new ComicVineHttpClient(this.rateLimiter);
  }

  // ============================================================================
  // Initialization Methods
  // ============================================================================

  /**
   * Initialize the ComicVine client with API key from configuration service
   *
   * @param configServiceInstance - Optional configuration service instance
   * @returns Promise<boolean> True if initialization successful
   */
  async initialize(configServiceInstance?: ConfigService): Promise<boolean> {
    try {
      // Import here to avoid circular dependencies
      const { comicvineConfigService, getComicvineConfigService } = await import('./configService');

      // Get the configuration service instance
      let configService;
      if (configServiceInstance) {
        configService = getComicvineConfigService(configServiceInstance);
      } else {
        configService = comicvineConfigService;
      }

      // Check if ComicVine is enabled in configuration
      const isEnabled = await configService.isEnabled();
      if (!isEnabled) {
        logger.debug('ComicVine integration is disabled in configuration');
        return false;
      }

      // Get API key from configuration service
      const apiKey = await configService.getApiKey();
      if (!apiKey) {
        logger.debug('ComicVine API key not found in configuration');
        return false;
      }

      // Get rate limit from configuration
      const rateLimit = await configService.getRateLimit();
      if (rateLimit) {
        // Update rate limiter if available - optional implementation detail
      }

      // Set API key and initialize axios instance
      this.apiKey = apiKey;
      this.initializeAxiosInstance();

      logger.info('ComicVine client initialized with API key from configuration');
      return true;
    } catch (error: unknown) {
      logger.error(`Failed to initialize ComicVine client: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Initialize the axios instance with the API key
   */
  private initializeAxiosInstance(): void {
    if (!this.apiKey) return;

    this.axiosInstance = axios.create({
      baseURL: modularQueries.BASE_URL,
      params: {
        api_key: this.apiKey,
        format: 'json'
      },
      headers: {
        'User-Agent': 'Kaizoku/1.0.0'
      }
    });

    // Set axios instance on HTTP client for delegated operations
    this.httpClient.setAxiosInstance(this.axiosInstance);
  }

  /**
   * Check if ComicVine integration is enabled and properly configured
   *
   * @param configServiceInstance - Optional configuration service instance
   * @returns Promise<boolean> True if enabled and configured
   */
  async isEnabled(configServiceInstance?: ConfigService): Promise<boolean> {
    try {
      const { comicvineConfigService, getComicvineConfigService } = await import('./configService');

      let configService;
      if (configServiceInstance) {
        configService = getComicvineConfigService(configServiceInstance);
      } else {
        configService = comicvineConfigService;
      }

      return await configService.isEnabled();
    } catch (error: unknown) {
      logger.error(`Failed to check if ComicVine is enabled: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  // ============================================================================
  // Adapter Methods (used by ComicVineProvider)
  // ============================================================================

  /**
   * Search for volumes in ComicVine
   * This method is used by the ComicVineProvider adapter
   */
  async searchVolumes(options: {
    query: string;
    apiKey: string;
    limit?: number;
    offset?: number;
    sort?: string;
  }): Promise<unknown> {
    try {
      await this.initialize();

      if (options.apiKey && this.apiKey !== options.apiKey) {
        this.apiKey = options.apiKey;
        this.initializeAxiosInstance();
      }

      const params: Record<string, unknown> = {
        ...modularQueries.searchBasicVolumesQuery(
          options.query,
          options.offset !== undefined ? Math.floor(options.offset / (options.limit ?? 10)) : 0,
          options.limit ?? 10
        )
      };

      if (options.sort) {
        const [field, direction] = options.sort.split(':');
        if (field && direction) {
          params['sort'] = `${field}:${direction}`;
        }
      }

      const response = await this.httpClient.fetchWithRetry<ComicVineListResponse<ComicVineVolume>>('/search', params);

      if (response.results.length > 0) {
        const firstResult = response.results[0];
        if (firstResult) {
          // Cast to access concepts field that may not be in the type
          const rawResult = firstResult as unknown as Record<string, unknown>;
          const concepts = rawResult['concepts'] as Array<unknown> | undefined;
          logger.info('[ComicVine API] First search result:', {
            id: firstResult.id,
            name: firstResult.name,
            hasImage: !!firstResult.image,
            imageData: firstResult.image, // Log full image object
            hasDescription: !!firstResult.description,
            descriptionLength: firstResult.description?.length,
            hasDeck: !!firstResult.deck,
            hasGenres: !!firstResult.genres,
            genresCount: Array.isArray(firstResult.genres) ? firstResult.genres.length : 0,
            hasConcepts: !!concepts,
            conceptsCount: Array.isArray(concepts) ? concepts.length : 0,
            conceptsData: concepts?.slice(0, 3), // Log first 3 concepts for debugging
            hasPersonCredits: !!firstResult.person_credits,
            personCreditsCount: Array.isArray(firstResult.person_credits) ? firstResult.person_credits.length : 0,
            hasCharacters: !!firstResult.characters,
            charactersCount: Array.isArray(firstResult.characters) ? firstResult.characters.length : 0,
            hasPublisher: !!firstResult.publisher,
            publisherName: firstResult.publisher?.name,
            countOfIssues: firstResult.count_of_issues,
            startYear: firstResult.start_year,
            // Debug: Check site_detail_url from API
            site_detail_url: rawResult['site_detail_url'],
            hasSiteDetailUrl: !!rawResult['site_detail_url'],
          });
        }
      }

      return response;
    } catch (error: unknown) {
      logger.error(`ComicVine searchVolumes error: ${error instanceof Error ? error.message : String(error)}`);
      return { results: [] };
    }
  }

  /**
   * Get detailed volume information by ID
   * This method is used by the ComicVineProvider adapter
   */
  async getVolume(id: string, apiKey: string): Promise<unknown> {
    try {
      await this.initialize();

      if (apiKey && this.apiKey !== apiKey) {
        this.apiKey = apiKey;
        this.initializeAxiosInstance();
      }

      const numericId = id.includes('-') ? toNumberId(id.split('-')[1]) : toNumberId(id);
      if (isNaN(numericId)) {
        throw new ValidationError(`Invalid ComicVine volume ID: ${id}`);
      }

      const volumeId = id.includes('-') ? id : `4050-${numericId}`;
      const response = await this.httpClient.fetchWithRetry<ComicVineResponse<ComicVineVolume>>(
        `/volume/${volumeId}`,
        modularQueries.completeVolumeInfoQuery(numericId)
      );

      return response;
    } catch (error: unknown) {
      logger.error(`ComicVine getVolume error: ${error instanceof Error ? error.message : String(error)}`);
      return { results: null };
    }
  }

  // ============================================================================
  // Volume Operations (delegated to volume-operations.ts)
  // ============================================================================

  /**
   * Get basic volume information by ID
   */
  async getBasicVolumeInfo(id: number): Promise<ComicVineVolume | null> {
    return volumeOps.getBasicVolumeInfo(
      this.httpClient,
      () => this.initialize(),
      id
    );
  }

  /**
   * Get detailed volume information by ID
   */
  async getDetailedVolumeInfo(id: number): Promise<ComicVineVolume | null> {
    return volumeOps.getDetailedVolumeInfo(
      this.httpClient,
      () => this.initialize(),
      id
    );
  }

  /**
   * Get complete volume information by ID
   */
  async getCompleteVolumeInfo(id: number): Promise<ComicVineVolume | null> {
    return volumeOps.getCompleteVolumeInfo(
      this.httpClient,
      () => this.initialize(),
      id
    );
  }

  /**
   * Search for volumes with basic information
   */
  async searchBasicVolumes(query: string, page = 0, limit = 50): Promise<ComicVineVolume[]> {
    return volumeOps.searchBasicVolumes(
      this.httpClient,
      () => this.initialize(),
      query,
      page,
      limit
    );
  }

  /**
   * Get issues for a volume
   */
  async getVolumeIssues(volumeId: number, page = 0, limit = 100): Promise<ComicVineIssue[]> {
    return volumeOps.getVolumeIssues(
      this.httpClient,
      () => this.initialize(),
      volumeId,
      page,
      limit
    );
  }

  /**
   * Get ALL issues for a volume (handles pagination automatically)
   */
  async getAllVolumeIssues(volumeId: number): Promise<ComicVineIssue[]> {
    return volumeOps.getAllVolumeIssues(
      this.httpClient,
      () => this.initialize(),
      volumeId
    );
  }

  /**
   * Get characters for a volume
   */
  async getVolumeCharacters(volumeId: number, page = 0, limit = 100): Promise<ComicVineCharacter[]> {
    return volumeOps.getVolumeCharacters(
      this.httpClient,
      () => this.initialize(),
      volumeId,
      page,
      limit
    );
  }

  /**
   * Get creators for a volume
   */
  async getVolumeCreators(volumeId: number, page = 0, limit = 100): Promise<ComicVineCreator[]> {
    return volumeOps.getVolumeCreators(
      this.httpClient,
      () => this.initialize(),
      volumeId,
      page,
      limit
    );
  }

  // ============================================================================
  // Entity Operations (delegated to entity-operations.ts)
  // ============================================================================

  /**
   * Get issue information by ID
   */
  async getIssueInfo(id: number): Promise<ComicVineIssue | null> {
    return entityOps.getIssueInfo(
      this.httpClient,
      () => this.initialize(),
      id
    );
  }

  /**
   * Get character information by ID
   */
  async getCharacterInfo(id: number): Promise<ComicVineCharacter | null> {
    return entityOps.getCharacterInfo(
      this.httpClient,
      () => this.initialize(),
      id
    );
  }

  /**
   * Get creator information by ID
   */
  async getCreatorInfo(id: number): Promise<ComicVineCreator | null> {
    return entityOps.getCreatorInfo(
      this.httpClient,
      () => this.initialize(),
      id
    );
  }

  // ============================================================================
  // Queue Management
  // ============================================================================

  /**
   * Process request queue
   * Ensures requests are processed sequentially with proper rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (!request) continue;

      try {
        // eslint-disable-next-line no-await-in-loop -- Sequential processing is intentional for queue management
        const result = await request.execute();
        request.resolve(result);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        request.reject(new Error(errorMessage));
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Queue a request for execution
   * Adds request to queue and starts processing
   */
  private async queueRequest<T>(
    id: string,
    execute: () => Promise<T>,
    maxRetries: number = 5
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        id,
        execute,
        resolve: resolve as (value: unknown) => void,
        reject,
        retries: 0,
        maxRetries
      };

      this.requestQueue.push(queuedRequest);

      // Start processing queue
      this.processQueue().catch((error) => {
        logger.error('Error processing request queue:', error);
      });
    });
  }
}

// Create and export a singleton instance
export const comicvineService = new ComicVineService();
