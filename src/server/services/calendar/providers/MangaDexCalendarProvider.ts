/**
 * MangaDex Calendar Provider
 *
 * Provides calendar integration for MangaDex, fetching latest chapters
 * and analyzing release patterns for release schedule detection.
 *
 * @module server/services/calendar/providers/MangaDexCalendarProvider
 */

import { mangadexClient } from '@/server/services/mangadex';
import type { MangaDexReleaseSchedule, MangaDexChapter } from '@/server/services/mangadex/types';
import { logger } from '@/utils/logger';

import type { CalendarAdapter } from '../CalendarProviderAdapters';
import type { Chapter as ChapterEntity } from '@prisma/client';

/**
 * Partial ChapterEntity for MangaDex calendar transformations.
 * This represents what we can construct from MangaDex chapter data.
 */
type MangaDexChapterTransform = {
  id: number;
  mangaId: number;
  title: string;
  fileName: string;
  index: number;
  chapterNumber: number;
  number: number;
  volume: number | null;
  pages: number;
  pageCount: number;
  language: string;
  releaseDate: Date;
  downloadStatus: 'PENDING';
  isRead: boolean;
  monitored: boolean;
  size: number;
  createdAt: Date;
  updatedAt: Date;
  mangadexId: string;
  hash: null;
  mimeType: null;
  resolutionWidth: null;
  resolutionHeight: null;
  resolutionLabel: null;
  alternativeTitles: string[];
  coverImage: null;
  description: null;
  fileFormat: null;
  filePath: null;
  packDownloadId: null;
  volumeId: null;
  downloadUrl: null;
};

const log = logger.child('MangaDexCalendarProvider');

/**
 * MangaDex Calendar Provider Implementation
 */
export class MangaDexCalendarProvider implements CalendarAdapter {
  private config: Record<string, unknown>;

  constructor(config: Record<string, unknown>) {
    this.config = config;
  }

  /**
   * Check if the provider is enabled
   */
  isEnabled(): boolean {
    return this.config['enabled'] !== false;
  }

  /**
   * Get latest chapters for a manga
   */
  async getLatestChapters(mangaId: string, afterChapter?: string): Promise<ChapterEntity[]> {
    try {
      log.info('Fetching latest chapters from MangaDex', { mangaId, afterChapter });

      const response = await mangadexClient.getMangaChapters(mangaId, {
        limit: 50,
        order: { publishAt: 'desc' },
      });

      const chapters = Array.isArray(response.data) ? response.data : [response.data];

      // Filter chapters if afterChapter is specified
      let filteredChapters = chapters;
      if (afterChapter) {
        const afterNum = parseFloat(afterChapter);
        filteredChapters = chapters.filter(ch => {
          const chNum = ch.attributes.chapter ? parseFloat(ch.attributes.chapter) : 0;
          return chNum > afterNum;
        });
      }

      // Transform to ChapterEntity format (partial)
      return filteredChapters.map(chapter => this.transformToChapterEntity(chapter, mangaId));
    } catch (error) {
      log.error('Failed to fetch latest chapters from MangaDex', {
        mangaId,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Get release schedule for a manga by analyzing chapter patterns
   */
  async getReleaseSchedule(mangaId: string): Promise<MangaDexReleaseSchedule | null> {
    try {
      log.info('Analyzing release schedule from MangaDex', { mangaId });

      // Fetch last 50 chapters sorted by publish date
      const response = await mangadexClient.getMangaChapters(mangaId, {
        limit: 50,
        order: { publishAt: 'desc' },
      });

      const chapters = Array.isArray(response.data) ? response.data : [response.data];

      if (chapters.length < 3) {
        return {
          mangaId,
          pattern: 'IRREGULAR',
          confidence: 0
        };
      }

      // Extract publish dates and calculate intervals
      const publishDates = chapters
        .map(ch => new Date(ch.attributes.publishAt))
        .sort((a, b) => b.getTime() - a.getTime());

      const intervals: number[] = [];
      for (let i = 0; i < publishDates.length - 1; i++) {
        const currentDate = publishDates[i];
        const nextDate = publishDates[i + 1];
        if (currentDate && nextDate) {
          const diff = currentDate.getTime() - nextDate.getTime();
          intervals.push(diff / (1000 * 60 * 60 * 24)); // Convert to days
        }
      }

      // Analyze pattern
      const schedule = this.analyzeReleasePattern(mangaId, intervals, publishDates);
      log.info('Release schedule analyzed', { mangaId, pattern: schedule.pattern, confidence: schedule.confidence });

      return schedule;
    } catch (error) {
      log.error('Failed to analyze release schedule', {
        mangaId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    // No resources to dispose
  }

  // ==================== Private Helpers ====================

  /**
   * Analyze release pattern from intervals
   */
  private analyzeReleasePattern(
    mangaId: string,
    intervals: number[],
    publishDates: Date[]
  ): MangaDexReleaseSchedule {
    if (intervals.length === 0) {
      return { mangaId, pattern: 'IRREGULAR', confidence: 0 };
    }

    // Calculate average interval
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

    // Calculate standard deviation
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    // Calculate coefficient of variation (CV) for consistency measure
    const cv = stdDev / avgInterval;

    // Determine pattern based on average interval
    let pattern: MangaDexReleaseSchedule['pattern'];
    if (avgInterval >= 5 && avgInterval <= 9) {
      pattern = 'WEEKLY';
    } else if (avgInterval >= 12 && avgInterval <= 16) {
      pattern = 'BIWEEKLY';
    } else if (avgInterval >= 25 && avgInterval <= 35) {
      pattern = 'MONTHLY';
    } else {
      pattern = 'IRREGULAR';
    }

    // Calculate confidence based on consistency (lower CV = higher confidence)
    // CV < 0.2 = high confidence, CV > 0.5 = low confidence
    let confidence = Math.max(0, Math.min(1, 1 - cv));

    // Lower confidence for irregular patterns
    if (pattern === 'IRREGULAR') {
      confidence *= 0.5;
    }

    // Determine most common day of week
    const dayOfWeekCounts: number[] = [0, 0, 0, 0, 0, 0, 0];
    for (const date of publishDates) {
      const dayIndex = date.getDay();
      dayOfWeekCounts[dayIndex] = (dayOfWeekCounts[dayIndex] ?? 0) + 1;
    }
    const mostCommonDay = dayOfWeekCounts.indexOf(Math.max(...dayOfWeekCounts));

    // Calculate next expected release
    const lastRelease = publishDates[0];
    let nextExpectedRelease: Date | undefined;
    if (lastRelease && pattern !== 'IRREGULAR') {
      const nextDate = new Date(lastRelease);
      nextDate.setDate(nextDate.getDate() + Math.round(avgInterval));
      nextExpectedRelease = nextDate;
    }

    return {
      mangaId,
      pattern,
      confidence: Math.round(confidence * 100) / 100,
      dayOfWeek: mostCommonDay,
      averageInterval: Math.round(avgInterval * 10) / 10,
      lastRelease,
      nextExpectedRelease
    };
  }

  /**
   * Transform MangaDex chapter to ChapterEntity format
   *
   * Note: This creates a partial entity suitable for calendar display.
   * The `id` field is set to 0 as it will be assigned by the database if persisted.
   */
  private transformToChapterEntity(chapter: MangaDexChapter, mangaId: string): ChapterEntity {
    const chapterNum = chapter.attributes.chapter
      ? parseFloat(chapter.attributes.chapter)
      : 0;

    const parsedMangaId = parseInt(mangaId, 10);

    const transformed: MangaDexChapterTransform = {
      id: 0, // Will be assigned by database
      mangaId: Number.isNaN(parsedMangaId) ? 0 : parsedMangaId,
      title: chapter.attributes.title ?? `Chapter ${chapter.attributes.chapter ?? '?'}`,
      fileName: `chapter-${chapter.id}`,
      index: Math.floor(chapterNum),
      chapterNumber: chapterNum,
      number: chapterNum,
      volume: chapter.attributes.volume ? parseInt(chapter.attributes.volume, 10) : null,
      pages: chapter.attributes.pages,
      pageCount: chapter.attributes.pages,
      language: chapter.attributes.translatedLanguage,
      releaseDate: new Date(chapter.attributes.publishAt),
      downloadStatus: 'PENDING',
      isRead: false,
      monitored: false,
      size: 0,
      createdAt: new Date(chapter.attributes.createdAt),
      updatedAt: new Date(chapter.attributes.updatedAt),
      mangadexId: chapter.id,
      hash: null,
      mimeType: null,
      resolutionWidth: null,
      resolutionHeight: null,
      resolutionLabel: null,
      alternativeTitles: [],
      coverImage: null,
      description: null,
      fileFormat: null,
      filePath: null,
      packDownloadId: null,
      volumeId: null,
      downloadUrl: null
    };

    // MangaDexChapterTransform satisfies ChapterEntity structure
    return transformed as ChapterEntity;
  }
}

/**
 * Factory function to create MangaDex calendar provider
 */
export function createMangaDexCalendarProvider(config: Record<string, unknown>): CalendarAdapter {
  return new MangaDexCalendarProvider(config);
}
