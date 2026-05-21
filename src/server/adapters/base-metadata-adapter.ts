
import { MangaPublicationStatus } from '@prisma/client';

import type { PartialUnifiedMetadata, PersonInfo, TagInfo, CoverImages, MetadataValidationResult, MetadataValidationError, MetadataValidationWarning, ProviderMetadata, MetadataQuality} from '@/types/search.types';
import { MangaFormat} from '@/types/search.types';
import type { AsyncResult} from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess, isError } from '@/utils/async-result';
import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';


/**
 * Base Metadata Adapter
 *
 * Abstract base class for all metadata provider adapters. Provides common
 * functionality for transforming provider-specific data to the unified
 * metadata format with built-in validation and error handling.
 *
 * Features:
 * - Standardized transformation interface
 * - Built-in validation and type checking
 * - Common utility methods for data normalization
 * - Error handling and logging
 * - Confidence scoring
 * - AsyncResult pattern support
 */

/**
 * Provider configuration base
 */
export interface BaseProviderConfig {
  enabled: boolean;
  apiEndpoint?: string;
  apiUrl?: string;
  apiKey?: string;
  rateLimit?: number;
  timeout?: number;
  retryAttempts?: number;
  priority?: number;
}

/**
 * Search options for providers
 */
export interface ProviderSearchOptions {
  limit?: number;
  offset?: number;
  includeAdult?: boolean;
  language?: string;
}

/**
 * Abstract base class for metadata provider adapters
 */
export abstract class BaseMetadataAdapter<TRawData = unknown, TConfig extends BaseProviderConfig = BaseProviderConfig> {
  /**
   * Provider name identifier
   */
  abstract readonly providerName: string;

  /**
   * Provider priority for conflict resolution (higher = higher priority)
   */
  abstract readonly priority: number;

  /**
   * Provider confidence score (0-1)
   */
  abstract readonly baseConfidence: number;

  /**
   * Configuration
   */
  protected config: TConfig;

  /**
   * Logger instance
   */
  protected logger = logger.child('BaseMetadataAdapter', {
    module: 'BaseMetadataAdapter'
  });
  constructor(config: TConfig) {
    this.config = config;
    // Logger will be initialized in concrete classes where providerName is available
  }

  /**
   * Transform raw provider data to unified metadata format
   * Must be implemented by each provider adapter
   */
  abstract transform(rawData: TRawData): Promise<AsyncResult<PartialUnifiedMetadata, Error>>;

  /**
   * Validate raw provider response
   * Must be implemented by each provider adapter
   */
  abstract validateRawData(data: unknown): data is TRawData;

  /**
   * Search for manga by query
   * Must be implemented by each provider adapter
   */
  abstract search(query: string, options?: ProviderSearchOptions): Promise<AsyncResult<PartialUnifiedMetadata[], Error>>;

  /**
   * Get metadata by provider-specific ID
   * Must be implemented by each provider adapter
   */
  abstract getById(id: string | number): Promise<AsyncResult<PartialUnifiedMetadata, Error>>;

  /**
   * Process and validate provider data to unified format
   */
  async processData(rawData: unknown): Promise<AsyncResult<PartialUnifiedMetadata, Error>> {
    try {
      // Validate raw data structure
      if (!this.validateRawData(rawData)) {
        return createErrorResult(new Error(`Invalid ${this.providerName} data structure`));
      }

      // Transform to unified format
      const transformResult = await this.transform(rawData);
      if (isError(transformResult)) {
        return transformResult;
      }

      // Validate transformed data
      if (!isSuccess(transformResult)) {
        return transformResult;
      }
      const validationResult = this.validateMetadata(transformResult.data);
      if (!validationResult.isValid) {
        // All items in errors array have severity 'error' by type definition
        if (validationResult.errors.length > 0) {
          return createErrorResult(new Error(`Critical validation errors: ${validationResult.errors.map((e: MetadataValidationError) => e.message).join(', ')}`));
        }
      }

      // Add provider metadata
      const enrichedMetadata = this.enrichWithProviderMetadata(transformResult.data, rawData);

      // Log warnings if any
      if (validationResult.warnings.length > 0) {
        this.logger.warn(`Validation warnings for ${this.providerName}:`, validationResult.warnings);
      }
      return createSuccessResult(enrichedMetadata);
    } catch (error: unknown) {
      this.logger.error(`Error processing ${this.providerName} data:`, error);
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Validate unified metadata
   */
  protected validateMetadata(metadata: PartialUnifiedMetadata): MetadataValidationResult {
    const errors: MetadataValidationError[] = [];
    const warnings: MetadataValidationWarning[] = [];

    // Check required fields
    if (!metadata["title"] || (typeof metadata["title"] === 'string' && metadata["title"].trim() === '')) {
      errors.push({
        field: 'title',
        message: 'Title is required',
        severity: 'error'
      });
    }

    // Check suspicious values
    if (metadata.volumes && metadata.volumes.length > 1000) {
      warnings.push({
        field: 'volumes',
        message: `Volume count (${metadata.volumes.length}) seems unusually high - verify this is not a year or other misinterpreted value`,
        severity: 'warning'
      });
    }
    if (metadata["chapters"] && metadata.volumes && metadata["chapters"].length < metadata.volumes.length) {
      warnings.push({
        field: 'chapters',
        message: `Chapter count (${metadata["chapters"].length}) is less than volume count (${metadata.volumes.length}) - this is unusual, verify the counts are correct`,
        severity: 'warning'
      });
    }

    // Check date consistency
    if (metadata.startDate && metadata.endDate) {
      const start = new Date(metadata.startDate);
      const end = new Date(metadata.endDate);
      if (start > end) {
        errors.push({
          field: 'dates',
          message: 'Start date is after end date',
          severity: 'error'
        });
      }
    }

    // Calculate completeness
    const completeness = this.calculateCompleteness(metadata);

    // Calculate confidence based on completeness and provider confidence
    const confidence = this.baseConfidence * completeness;
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: completeness * confidence
    };
  }

  /**
   * Calculate metadata completeness score (0-1)
   */
  protected calculateCompleteness(metadata: PartialUnifiedMetadata): number {
    const importantFields = ['title', 'description', 'covers', 'status', 'format', 'volumes', 'chapters', 'authors', 'genres', 'startDate'];
    let filledFields = 0;
    for (const field of importantFields) {
      const value = metadata[field as keyof PartialUnifiedMetadata];
      if (value !== null) {
        if (Array.isArray(value) && value.length > 0) {
          filledFields++;
        } else if (typeof value === 'object' && Object.keys(value).length > 0) {
          filledFields++;
        } else if (typeof value === 'string' && value.trim() !== '') {
          filledFields++;
        } else if (typeof value === 'number') {
          filledFields++;
        }
      }
    }
    return filledFields / importantFields.length;
  }

  /**
   * Enrich metadata with provider-specific information
   */
  protected enrichWithProviderMetadata(metadata: PartialUnifiedMetadata, rawData: unknown): PartialUnifiedMetadata {
    const now = new Date();

    // Add provider metadata
    const providerMetadata: ProviderMetadata = {
      provider: this.providerName,
      data: this.extractProviderSpecificFields(rawData),
      confidence: this.baseConfidence,
      lastUpdated: now
    };

    // Add metadata quality
    const quality: MetadataQuality = {
      completeness: this.calculateCompleteness(metadata),
      accuracy: this.baseConfidence,
      freshness: 1.0,
      sources: 1,
      overall: this.baseConfidence
    };
    return {
      ...metadata,
      primarySource: this.providerName,
      providerMetadata: [providerMetadata],
      metadataQuality: quality,
      updatedAt: now
    };
  }

  /**
   * Extract provider ID from raw data
   * Can be overridden by specific adapters
   */
  protected extractProviderId(rawData: unknown): string {
    if (typeof rawData === 'object' && rawData !== null) {
      const data = rawData as Record<string, unknown>;
      if ('id' in data) {
        return toStringId(data["id"]);
      }
    }
    return 'UNKNOWN';
  }

  /**
   * Extract provider-specific fields that don't map to unified schema
   * Can be overridden by specific adapters
   */
  protected extractProviderSpecificFields(_rawData: unknown): Record<string, unknown> {
    return {};
  }

  // ===== Common utility methods =====

  /**
   * Normalize date to Date object or null
   */
  protected normalizeDate(date: unknown): Date | null {
    if (!date) return null;

    // Already a Date
    if (date instanceof Date) {
      return isNaN(date.getTime()) ? null : date;
    }

    // String date
    if (typeof date === 'string') {
      const parsed = new Date(date);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    // Object with year/month/day (AniList style)
    // date !== null check is redundant here because we already checked !date at the top
    if (typeof date === 'object' && 'year' in date) {
      const dateObj = date as Record<string, unknown>;
      const year = Number(dateObj['year']);
      const month = Number(dateObj['month'] || 1);
      const day = Number(dateObj['day'] || 1);
      if (isNaN(year)) return null;
      const parsed = new Date(year, month - 1, day);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    // Number (timestamp)
    if (typeof date === 'number') {
      const parsed = new Date(date);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  /**
   * Normalize score to 0-100 scale
   */
  protected normalizeScore(score: unknown, maxScore: number = 100): number | null {
    if (score === null) return null;
    const numScore = Number(score);
    if (isNaN(numScore)) return null;
    const normalized = numScore / maxScore * 100;
    return Math.min(100, Math.max(0, normalized));
  }

  /**
   * Extract clean string from potentially messy data
   */
  protected cleanString(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/\s+/g, ' ');
  }

  /**
   * Clean HTML from string
   */
  protected cleanHtml(html: string): string {
    if (!html) return '';

    // Remove HTML tags
    let cleaned = html.replace(/<[^>]*>/g, '');

    // Decode HTML entities
    cleaned = cleaned.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');

    // Clean up whitespace
    return this.cleanString(cleaned);
  }

  /**
   * Map status string to enum
   */
  protected mapStatus(status: string | undefined): MangaPublicationStatus {
    if (!status) return MangaPublicationStatus.UNKNOWN;
    const upperStatus = status.toUpperCase();

    // Common mappings
    const statusMap: Record<string, MangaPublicationStatus> = {
      'ONGOING': MangaPublicationStatus.ONGOING,
      'RELEASING': MangaPublicationStatus.ONGOING,
      'COMPLETED': MangaPublicationStatus.COMPLETED,
      'FINISHED': MangaPublicationStatus.COMPLETED,
      'COMPLETE': MangaPublicationStatus.COMPLETED,
      'HIATUS': MangaPublicationStatus.HIATUS,
      'ON_HIATUS': MangaPublicationStatus.HIATUS,
      'CANCELLED': MangaPublicationStatus.CANCELLED,
      'CANCELED': MangaPublicationStatus.CANCELLED,
      'UPCOMING': MangaPublicationStatus.UPCOMING,
      'NOT_YET_RELEASED': MangaPublicationStatus.UPCOMING,
      'TBA': MangaPublicationStatus.UPCOMING
    };
    return statusMap[upperStatus] ?? MangaPublicationStatus.UNKNOWN;
  }

  /**
   * Map format string to enum
   */
  protected mapFormat(format: string | undefined): MangaFormat {
    if (!format) return MangaFormat.UNKNOWN;
    const upperFormat = format.toUpperCase();
    const formatMap: Record<string, MangaFormat> = {
      'MANGA': MangaFormat.MANGA,
      'MANHWA': MangaFormat.MANHWA,
      'MANHUA': MangaFormat.MANHUA,
      'NOVEL': MangaFormat.NOVEL,
      'LIGHT_NOVEL': MangaFormat.NOVEL,
      'ONE_SHOT': MangaFormat.ONE_SHOT,
      'DOUJINSHI': MangaFormat.DOUJIN,
      'COMIC': MangaFormat.COMIC,
      'GRAPHIC_NOVEL': MangaFormat.COMIC
    };
    return formatMap[upperFormat] ?? MangaFormat.UNKNOWN;
  }

  /**
   * Extract tags with proper structure
   */
  protected extractTags(tags: unknown[]): TagInfo[] {
    if (!Array.isArray(tags)) return [];
    const processedTags: TagInfo[] = [];
    for (const tag of tags) {
      if (typeof tag === 'string') {
        const cleanedName = this.cleanString(tag);
        if (cleanedName) {
          processedTags.push({
            name: cleanedName
          });
        }
      } else if (typeof tag === 'object' && tag !== null) {
        const tagObj = tag as Record<string, unknown>;
        const cleanedName = this.cleanString((tagObj["name"] ?? tagObj['label'] ?? '') as string);
        if (cleanedName) {
          const tagInfo: TagInfo = { name: cleanedName };
          if (tagObj['category']) tagInfo.category = tagObj['category'] as string;
          if (tagObj['rank']) tagInfo.rank = tagObj['rank'] as number;
          if (tagObj['isMediaSpoiler'] || tagObj['isSpoiler']) tagInfo.isMediaSpoiler = (tagObj['isMediaSpoiler'] || tagObj['isSpoiler']) as boolean;
          if (tagObj['isGeneralSpoiler']) tagInfo.isGeneralSpoiler = tagObj['isGeneralSpoiler'] as boolean;
          if (tagObj['description']) tagInfo.description = tagObj['description'] as string;
          processedTags.push(tagInfo);
        }
      }
    }
    return processedTags;
  }

  /**
   * Extract person info from various formats
   */
  protected extractPersonInfo(persons: unknown[]): PersonInfo[] {
    if (!Array.isArray(persons)) return [];
    return persons.map((person): PersonInfo | null => {
      if (typeof person === 'string') {
        const name = this.cleanString(person);
        return name ? { name, role: 'AUTHOR' } : null;
      }
      if (typeof person === 'object' && person !== null) {
        const personObj = person as Record<string, unknown>;
        const name = this.cleanString((personObj["name"] ?? '') as string);
        if (!name) return null;
        return {
          name,
          role: (personObj['role'] || 'AUTHOR') as string,
          id: personObj["id"] as string,
          image: (personObj['image'] || personObj['avatar']) as string | undefined
        } as PersonInfo;
      }
      return null;
    }).filter((person): person is PersonInfo => person !== null);
  }

  /**
   * Build cover images object from various sources
   */
  protected buildCoverImages(covers: unknown): CoverImages {
    const defaultCover = '/cover-not-found.jpg';
    if (!covers) {
      return {
        original: defaultCover
      };
    }

    // Handle string cover
    if (typeof covers === 'string') {
      return {
        original: covers || defaultCover
      };
    }

    // Handle object with different sizes
    // covers !== null check is redundant here because we already checked !covers at the top
    if (typeof covers === 'object') {
      const coversObj = covers as Record<string, unknown>;
      const result: CoverImages = {};
      // original always has a fallback to defaultCover, so it's always truthy
      const original = coversObj['original'] || coversObj['extraLarge'] || coversObj['large'] || coversObj['medium'] || coversObj['small'] || defaultCover;
      result.original = original as string;
      const large = coversObj['large'] || coversObj['extraLarge'];
      if (large) result.large = large as string;
      if (coversObj['medium']) result.medium = coversObj['medium'] as string;
      if (coversObj['small']) result.small = coversObj['small'] as string;
      const thumbnail = coversObj['thumbnail'] || coversObj['small'];
      if (thumbnail) result.thumbnail = thumbnail as string;
      if (coversObj['color']) result.color = coversObj['color'] as string;
      return result;
    }
    return {
      original: defaultCover
    };
  }
}