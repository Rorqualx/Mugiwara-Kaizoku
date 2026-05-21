/**
 * Calendar Provider Mixin
 * 
 * This mixin adds calendar support functionality to existing metadata providers.
 * It provides default implementations and utilities for fetching release schedules
 * and recent chapter information.
 * 
 * Following project conventions:
 * - AsyncResult pattern for all async operations
 * - Proper error handling with contextual errors
 * - Type-safe implementations
 */

import type { EnhancedMangaMetadata, RecentRelease, FetchRecentReleasesOptions, ReleaseScheduleCapabilities, ProviderReleaseSchedule} from '@/types/search.types';
import { createSuccessResult, createErrorResult, isSuccess, isError } from '@/utils/async-result';
import type { AsyncResult} from '@/utils/async-result';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';

import { type CalendarProviderConfig, type ReleaseScheduleSyncResult, type ReleaseScheduleSyncOptions } from './CalendarSupportedProvider';

import type { CalendarSupportedProvider} from './CalendarSupportedProvider';

// Re-export for external use
export type { CalendarProviderConfig } from './CalendarSupportedProvider';

/**
 * Base implementation of calendar support that can be mixed into providers
 */
export abstract class CalendarProviderMixin implements CalendarSupportedProvider {
  protected calendarConfig: CalendarProviderConfig;
  protected releaseCache: Map<string, {
    data: RecentRelease[];
    timestamp: number;
  }>;

  /**
   * Abstract method to get basic metadata - must be implemented by specific providers
   */
  protected abstract getBasicMetadata(mangaId: string): Promise<AsyncResult<EnhancedMangaMetadata, Error>>;

  /**
   * Abstract method to be implemented by specific providers
   */
  abstract fetchRecentReleases(mangaId: string, options?: FetchRecentReleasesOptions): Promise<AsyncResult<RecentRelease[], Error>>;
  constructor(config?: CalendarProviderConfig) {
    this.calendarConfig = {
      enableRecentReleases: true,
      enableScheduleDetection: true,
      maxRecentReleases: 20,
      defaultTimezone: 'UTC',
      releaseCacheDuration: 3600,
      // 1 hour
      ...config
    };
    this.releaseCache = new Map();
  }

  /**
   * Default implementation of release capabilities
   * Providers should override this to specify their actual capabilities
   */
  getReleaseCapabilities(): ReleaseScheduleCapabilities {
    return {
      supportsSchedule: this.calendarConfig.enableScheduleDetection ?? false,
      hasReleaseSchedule: false,
      supportsRecentReleases: this.calendarConfig.enableRecentReleases ?? false,
      supportsScheduleDetection: this.calendarConfig.enableScheduleDetection ?? false,
      defaultTimezone: this.calendarConfig.defaultTimezone ?? 'UTC'
    };
  }

  /**
   * Helper method to check cache for recent releases
   */
  protected getCachedReleases(mangaId: string): RecentRelease[] | null {
    const cached = this.releaseCache.get(mangaId);
    if (!cached) return null;
    const now = Date.now();
    const cacheAge = (now - cached.timestamp) / 1000; // Convert to seconds

    if (cacheAge > (this.calendarConfig.releaseCacheDuration ?? 3600)) {
      this.releaseCache.delete(mangaId);
      return null;
    }
    return cached.data;
  }

  /**
   * Helper method to cache recent releases
   */
  protected cacheReleases(mangaId: string, releases: RecentRelease[]): void {
    this.releaseCache.set(mangaId, {
      data: releases,
      timestamp: Date.now()
    });
  }

  /**
   * Default implementation that combines regular metadata with release info
   */
  async getEnhancedMetadata(mangaId: string): Promise<AsyncResult<EnhancedMangaMetadata, Error>> {
    try {
      // Get regular metadata (to be implemented by specific provider)
      const metadataResult = await this.getBasicMetadata(mangaId);
      if (isError(metadataResult)) {
        return metadataResult;
      }
      if (!isSuccess(metadataResult)) {
        return createErrorResult(new Error('Failed to get metadata'));
      }
      const metadata = metadataResult.data;
      let enhancedMetadata: EnhancedMangaMetadata = {
        ...metadata
      };

      // Fetch recent releases if enabled
      if (this.calendarConfig.enableRecentReleases) {
        enhancedMetadata = await this.addReleaseDataToMetadata(mangaId, enhancedMetadata);
      }
      return createSuccessResult(enhancedMetadata);
    } catch (error: unknown) {
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Helper method to add release data to enhanced metadata
   * Extracted to reduce nesting depth
   * Returns updated metadata without mutating the parameter
   */
  private async addReleaseDataToMetadata(mangaId: string, metadata: EnhancedMangaMetadata): Promise<EnhancedMangaMetadata> {
    const releasesResult = await this.fetchRecentReleases(mangaId);

    // Early return if no successful releases
    if (!isSuccess(releasesResult) || releasesResult.data.length === 0) {
      return metadata;
    }

    const updatedMetadata: EnhancedMangaMetadata = {
      ...metadata,
      recentReleases: releasesResult.data
    };

    // Try to detect schedule if enabled
    if (!this.calendarConfig.enableScheduleDetection) {
      return updatedMetadata;
    }

    const scheduleResult = await this.detectScheduleFromReleases(releasesResult.data);
    if (!isSuccess(scheduleResult)) {
      return updatedMetadata;
    }

    return this.attachScheduleToMetadata(updatedMetadata, scheduleResult.data);
  }

  /**
   * Helper method to attach schedule data to metadata
   * Extracted to reduce complexity
   * Returns updated metadata without mutating the parameter
   */
  private attachScheduleToMetadata(metadata: EnhancedMangaMetadata, schedule: ProviderReleaseSchedule): EnhancedMangaMetadata {
    const dayOfWeek = schedule.type === 'weekly' || schedule.type === 'biweekly'
      ? typeof schedule.dayOfWeek === 'number'
        ? schedule.dayOfWeek
        : undefined
      : undefined;

    return {
      ...metadata,
      releaseSchedule: {
        pattern: schedule.pattern as "weekly" | "biweekly" | "monthly" | "irregular" | "hiatus",
        ...(dayOfWeek !== undefined ? { dayOfWeek } : {}),
        ...(schedule.nextRelease ? { nextRelease: schedule.nextRelease } : {}),
        ...(schedule.type ? { frequency: schedule.type } : {})
      }
    };
  }

  /**
   * Detect release schedule from recent releases
   */
  protected detectScheduleFromReleases(releases: RecentRelease[]): Promise<AsyncResult<ProviderReleaseSchedule, Error>> {
    try {
      if (releases.length < 3) {
        return Promise.resolve(createErrorResult(new Error('Insufficient releases for pattern detection')));
      }
      const releaseDates = this.extractReleaseDatesFromReleases(releases);
      const mangaId = releases[0]?.mangaId || '0'; // Get mangaId from first release

      // Check for weekly pattern
      const weeklyPattern = this.detectWeeklyPattern(releaseDates);
      if (weeklyPattern.confidence > 0.7) {
        const providerName = this.constructor['name'] as string;
        return Promise.resolve(createSuccessResult({
          provider: providerName,
          mangaId: toNumberId(mangaId),
          hasReleaseSchedule: true,
          updateFrequency: 'weekly',
          confidence: weeklyPattern.confidence,
          ...(weeklyPattern.nextRelease ? { nextRelease: weeklyPattern.nextRelease } : {}),
          lastUpdated: new Date()
        }));
      }

      // Check for bi-weekly pattern
      const biweeklyPattern = this.detectBiweeklyPattern(releaseDates);
      if (biweeklyPattern.confidence > 0.6) {
        const providerName = this.constructor['name'] as string;
        return Promise.resolve(createSuccessResult({
          provider: providerName,
          mangaId: toNumberId(mangaId),
          hasReleaseSchedule: true,
          updateFrequency: 'biweekly',
          confidence: biweeklyPattern.confidence,
          ...(biweeklyPattern.nextRelease ? { nextRelease: biweeklyPattern.nextRelease } : {}),
          lastUpdated: new Date()
        }));
      }

      // Check for monthly pattern
      const monthlyPattern = this.detectMonthlyPattern(releaseDates);
      if (monthlyPattern.confidence > 0.6) {
        const providerName = this.constructor['name'] as string;
        return Promise.resolve(createSuccessResult({
          provider: providerName,
          mangaId: toNumberId(mangaId),
          hasReleaseSchedule: true,
          updateFrequency: 'monthly',
          confidence: monthlyPattern.confidence,
          ...(monthlyPattern.nextRelease ? { nextRelease: monthlyPattern.nextRelease } : {}),
          lastUpdated: new Date()
        }));
      }

      // Default to irregular
      return Promise.resolve(createSuccessResult({
        provider: this.constructor["name"],
        mangaId: toNumberId(mangaId),
        hasReleaseSchedule: false,
        updateFrequency: 'irregular',
        confidence: 0.3,
        lastUpdated: new Date()
      }));
    } catch (error: unknown) {
      return Promise.resolve(createErrorResult(error instanceof Error ? error : new Error(String(error))));
    }
  }

  /**
   * Check if manga has regular schedule based on recent releases
   */
  async hasRegularSchedule(mangaId: string): Promise<AsyncResult<boolean, Error>> {
    try {
      const releasesResult = await this.fetchRecentReleases(mangaId);
      if (isError(releasesResult)) {
        return releasesResult;
      }

      const hasEnoughReleases = isSuccess(releasesResult) && releasesResult.data.length >= 3;
      if (!hasEnoughReleases) {
        return createSuccessResult(false);
      }

      const scheduleResult = await this.detectScheduleFromReleases(releasesResult.data);
      if (isError(scheduleResult) || !isSuccess(scheduleResult)) {
        return createSuccessResult(false);
      }

      const isRegular = scheduleResult.data.type !== 'irregular' && (scheduleResult.data.confidence ?? 0) > 0.6;
      return createSuccessResult(isRegular);
    } catch (error: unknown) {
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get next expected release date
   */
  async getNextReleaseDate(mangaId: string): Promise<AsyncResult<Date | null, Error>> {
    try {
      const metadataResult = await this.getEnhancedMetadata(mangaId);
      if (isError(metadataResult)) {
        return metadataResult;
      }

      if (!isSuccess(metadataResult)) {
        return createErrorResult(new Error('Failed to get metadata'));
      }

      const schedule = metadataResult.data.releaseSchedule;
      const isValidSchedule = schedule && typeof schedule === 'object' && 'confidence' in schedule;
      if (!isValidSchedule) {
        return createSuccessResult(null);
      }

      const scheduleObj = schedule as { confidence?: number; nextRelease?: Date | string };
      const hasConfidence = scheduleObj.confidence && scheduleObj.confidence >= 0.5;
      if (!hasConfidence) {
        return createSuccessResult(null);
      }

      const nextRelease = scheduleObj.nextRelease;
      const nextReleaseDate = nextRelease instanceof Date ? nextRelease : nextRelease ? new Date(nextRelease) : null;
      return createSuccessResult(nextReleaseDate);
    } catch (error: unknown) {
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Pattern detection helpers
   */

  private detectWeeklyPattern(dates: Date[]): {
    confidence: number;
    dayOfWeek?: number;
    nextRelease?: Date;
  } {
    if (dates.length < 3) return {
      confidence: 0
    };

    // Count occurrences of each day of week
    const dayCount = new Map<number, number>();
    dates.forEach(date => {
      const day = date.getDay();
      dayCount.set(day, (dayCount.get(day) ?? 0) + 1);
    });

    // Find most common day
    let maxCount = 0;
    let mostCommonDay = 0;
    dayCount.forEach((count, day) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonDay = day;
      }
    });

    // Calculate confidence based on consistency
    const confidence = maxCount / dates.length;

    // Calculate next release if confident enough
    let nextRelease: Date | undefined;
    if (confidence > 0.7) {
      const today = new Date();
      const daysUntilNext = (mostCommonDay - today.getDay() + 7) % 7 || 7;
      nextRelease = new Date(today);
      nextRelease.setDate(today.getDate() + daysUntilNext);
    }
    return {
      confidence,
      dayOfWeek: mostCommonDay,
      ...(nextRelease ? { nextRelease } : {})
    };
  }
  private detectBiweeklyPattern(dates: Date[]): {
    confidence: number;
    dayOfWeek?: number;
    nextRelease?: Date;
  } {
    if (dates.length < 4) return {
      confidence: 0
    };

    // Check intervals between releases
    const intervals: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      const prevDate = dates[i - 1];
      const currDate = dates[i];
      if (!prevDate || !currDate) continue;
      const days = Math.round((prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24));
      intervals.push(days);
    }

    // Count bi-weekly intervals (13-15 days)
    const biweeklyCount = intervals.filter(i => i >= 13 && i <= 15).length;
    const confidence = biweeklyCount / intervals.length;

    if (confidence <= 0.6) {
      return { confidence: 0 };
    }

    // Get most common day of week from bi-weekly releases
    const biweeklyDates = dates.filter((_, i) => {
      const interval = intervals[i - 1];
      return i === 0 || (interval !== undefined && interval >= 13 && interval <= 15);
    });
    const weeklyResult = this.detectWeeklyPattern(biweeklyDates);

    // Calculate next release
    let nextRelease: Date | undefined;
    const lastRelease = dates[0];
    if (weeklyResult.dayOfWeek !== undefined && lastRelease) {
      nextRelease = new Date(lastRelease);
      nextRelease.setDate(lastRelease.getDate() + 14);

      // Adjust to correct day of week
      while (nextRelease.getDay() !== weeklyResult.dayOfWeek) {
        nextRelease.setDate(nextRelease.getDate() + 1);
      }
    }

    return {
      confidence,
      ...(weeklyResult.dayOfWeek !== undefined ? { dayOfWeek: weeklyResult.dayOfWeek } : {}),
      ...(nextRelease ? { nextRelease } : {})
    };
  }
  private detectMonthlyPattern(dates: Date[]): {
    confidence: number;
    dayOfMonth?: number;
    nextRelease?: Date;
  } {
    if (dates.length < 3) return {
      confidence: 0
    };

    // Count occurrences of each day of month
    const dayCount = new Map<number, number>();
    dates.forEach(date => {
      const day = date.getDate();
      dayCount.set(day, (dayCount.get(day) ?? 0) + 1);
    });

    // Find most common day
    let maxCount = 0;
    let mostCommonDay = 0;
    dayCount.forEach((count, day) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonDay = day;
      }
    });

    // Calculate confidence
    const confidence = maxCount / dates.length;

    // Calculate next release if confident enough
    let nextRelease: Date | undefined;
    if (confidence > 0.6) {
      const today = new Date();
      nextRelease = new Date(today.getFullYear(), today.getMonth(), mostCommonDay);

      // If the day has passed this month, move to next month
      if (nextRelease <= today) {
        nextRelease.setMonth(nextRelease.getMonth() + 1);
      }
    }
    return {
      confidence,
      dayOfMonth: mostCommonDay,
      ...(nextRelease ? { nextRelease } : {})
    };
  }

  /**
   * Helper to extract release dates from recent releases
   */
  private extractReleaseDatesFromReleases(releases: RecentRelease[]): Date[] {
    return releases.map(release => release.releaseDate).filter((date): date is Date => date instanceof Date).sort((a, b) => b.getTime() - a.getTime());
  }
}

/**
 * Helper to sync release schedules from multiple providers
 */
export class ReleaseScheduleSyncHelper {
  constructor(private providers: Map<string, CalendarSupportedProvider>, private loggerInstance = logger) {}

  /**
   * Sync release schedules for given manga
   */
  syncReleaseSchedules(_options: ReleaseScheduleSyncOptions): Promise<ReleaseScheduleSyncResult> {
    const startTime = Date.now();
    const results: ReleaseScheduleSyncResult = {
      provider: 'multi',
      mangaSynced: 0,
      schedulesDetected: 0,
      releasesFetched: 0,
      errors: [],
      duration: 0
    };
    try {
      // Process each provider
      for (const [providerName, provider] of this.providers) {
        const capabilities = provider.getReleaseCapabilities();
        if (!capabilities.supportsRecentReleases) {
          this.loggerInstance.debug(`Provider ${providerName} does not support release fetching`);
          continue;
        }

        // Sync with this provider
        // Implementation details would go here

        this.loggerInstance.info(`Synced with provider ${providerName}`);
      }
      results.duration = Date.now() - startTime;
      return Promise.resolve(results);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.loggerInstance.error('Release schedule sync failed', errorMessage);
      return Promise.reject(new Error(errorMessage));
    }
  }
}