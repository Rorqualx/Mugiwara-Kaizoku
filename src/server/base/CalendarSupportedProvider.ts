/**
 * Enhanced Metadata Provider Interface for Calendar Support
 * 
 * This interface extends the standard metadata provider functionality
 * to include methods for fetching release schedule information.
 * 
 * Following project conventions:
 * - AsyncResult pattern for all async operations
 * - Proper error handling with typed errors
 * - Type-safe data transformations
 */

import type { EnhancedMangaMetadata, RecentRelease, FetchRecentReleasesOptions, ReleaseScheduleCapabilities, ID } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';

/**
 * Interface for metadata providers with calendar support
 */
export interface CalendarSupportedProvider {
  /**
   * Get release schedule capabilities of this provider
   */
  getReleaseCapabilities(): ReleaseScheduleCapabilities;
  
  /**
   * Fetch recent chapter releases for a manga
   * 
   * @param mangaId - Provider-specific manga ID
   * @param options - Options for fetching releases
   * @returns AsyncResult with array of recent releases or error
   */
  fetchRecentReleases(
    mangaId: string,
    options?: FetchRecentReleasesOptions
  ): Promise<AsyncResult<RecentRelease[], Error>>;
  
  /**
   * Get enhanced metadata including release schedule
   * 
   * @param mangaId - Provider-specific manga ID
   * @returns AsyncResult with enhanced metadata or error
   */
  getEnhancedMetadata(
    mangaId: string
  ): Promise<AsyncResult<EnhancedMangaMetadata, Error>>;
  
  /**
   * Check if a manga has regular release schedule
   * 
   * @param mangaId - Provider-specific manga ID
   * @returns AsyncResult with boolean indicating regular schedule
   */
  hasRegularSchedule(
    mangaId: string
  ): Promise<AsyncResult<boolean, Error>>;
  
  /**
   * Get next expected release date if available
   * 
   * @param mangaId - Provider-specific manga ID
   * @returns AsyncResult with next release date or null
   */
  getNextReleaseDate(
    mangaId: string
  ): Promise<AsyncResult<Date | null, Error>>;
}

/**
 * Extended provider configuration for calendar features
 */
export interface CalendarProviderConfig {
  /**
   * Enable fetching of recent releases
   */
  enableRecentReleases?: boolean;
  
  /**
   * Enable schedule detection
   */
  enableScheduleDetection?: boolean;
  
  /**
   * Maximum number of recent releases to fetch
   */
  maxRecentReleases?: number;
  
  /**
   * Default timezone for release schedules
   */
  defaultTimezone?: string;
  
  /**
   * Cache duration for release data (in seconds)
   */
  releaseCacheDuration?: number;
}

/**
 * Release schedule sync result
 */
export interface ReleaseScheduleSyncResult {
  /**
   * Provider name
   */
  provider: string;
  
  /**
   * Number of manga synced
   */
  mangaSynced: number;
  
  /**
   * Number of schedules detected
   */
  schedulesDetected: number;
  
  /**
   * Number of recent releases fetched
   */
  releasesFetched: number;
  
  /**
   * Errors encountered during sync
   */
  errors: Array<{
    mangaId: string;
    error: string;
  }>;
  
  /**
   * Sync duration in milliseconds
   */
  duration: number;
}

/**
 * Options for syncing release schedules
 */
export interface ReleaseScheduleSyncOptions {
  /**
   * Specific manga IDs to sync (if not provided, sync all monitored)
   */
  mangaIds?: ID[];
  
  /**
   * Force refresh even if recently synced
   */
  forceRefresh?: boolean;
  
  /**
   * Include manga in hiatus
   */
  includeHiatus?: boolean;
  
  /**
   * Batch size for concurrent operations
   */
  batchSize?: number;
  
  /**
   * Progress callback
   */
  onProgress?: (current: number, total: number) => void;
}

/**
 * Release schedule fallback strategy
 */
export interface ReleaseFallbackStrategy {
  /**
   * Use historical data from database
   */
  useHistoricalData: boolean;
  
  /**
   * Use pattern detection algorithm
   */
  usePatternDetection: boolean;
  
  /**
   * Use crowd-sourced data (future feature)
   */
  useCrowdSourced: boolean;
  
  /**
   * Minimum confidence threshold for predictions
   */
  minConfidence: number;
  
  /**
   * Maximum age of historical data to consider (in days)
   */
  maxHistoricalAge: number;
}

/**
 * Manual schedule override
 */
export interface ManualScheduleOverride {
  /**
   * Manga ID
   */
  mangaId: ID;
  
  /**
   * Override type
   */
  overrideType: 'schedule' | 'next_release' | 'hiatus';
  
  /**
   * Schedule data for override
   */
  scheduleData?: {
    releaseType: string;
    dayOfWeek?: number;
    dayOfMonth?: number;
    timezone?: string;
  };
  
  /**
   * Next release date for override
   */
  nextReleaseDate?: Date;
  
  /**
   * Hiatus information
   */
  hiatusInfo?: {
    startDate: Date;
    endDate?: Date;
    reason?: string;
  };
  
  /**
   * User who created the override
   */
  createdBy?: string;
  
  /**
   * Override expiration date
   */
  expiresAt?: Date;
}

/**
 * Type guard for checking if provider supports calendar features
 */
export function isCalendarSupportedProvider(
  provider: unknown
): provider is CalendarSupportedProvider {
  if (!provider || typeof provider !== 'object') return false;
  
  const p = provider as Record<string, unknown>;
  
  return (
    typeof p["getReleaseCapabilities"] === 'function' &&
    typeof p["fetchRecentReleases"] === 'function' &&
    typeof p["getEnhancedMetadata"] === 'function' &&
    typeof p["hasRegularSchedule"] === 'function' &&
    typeof p["getNextReleaseDate"] === 'function'
  );
}
