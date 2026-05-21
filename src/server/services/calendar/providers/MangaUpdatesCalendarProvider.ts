/**
 * MangaUpdates Calendar Provider
 *
 * Provides calendar integration using MangaUpdates release data.
 * Fetches per-chapter release dates and analyzes release patterns
 * for schedule detection.
 *
 * MU provides official publisher release dates (Viz, MANGA Plus, etc.)
 * which are more reliable than scanlation upload timestamps.
 *
 * @module server/services/calendar/providers/MangaUpdatesCalendarProvider
 */

import { mangaUpdatesService } from '@/server/services/mangaupdates/service';
import { logger } from '@/utils/logger';

import type { CalendarAdapter } from '../CalendarProviderAdapters';
import type { Chapter as ChapterEntity } from '@prisma/client';

const log = logger.child('MangaUpdatesCalendarProvider');

export class MangaUpdatesCalendarProvider implements CalendarAdapter {
  private config: Record<string, unknown>;

  constructor(config: Record<string, unknown>) {
    this.config = config;
  }

  isEnabled(): boolean {
    return this.config['enabled'] !== false;
  }

  /**
   * Get latest chapters by fetching MU release records.
   * Transforms release data into partial ChapterEntity objects.
   */
  async getLatestChapters(mangaTitle: string, afterChapter?: string): Promise<ChapterEntity[]> {
    try {
      log.info('Fetching releases from MangaUpdates', { mangaTitle, afterChapter });

      const seriesId = this.config['seriesId'] as number | undefined;
      if (!seriesId) {
        log.warn('No MangaUpdates seriesId configured', { mangaTitle });
        return [];
      }

      const releases = await mangaUpdatesService.getRecentReleases(mangaTitle, seriesId, 50);
      if (releases.length === 0) return [];

      const afterNum = afterChapter ? parseFloat(afterChapter) : 0;

      return releases
        .filter(r => {
          const chNum = parseFloat(r.chapter);
          return !isNaN(chNum) && chNum > afterNum;
        })
        .map(release => this.transformToChapterEntity(release));
    } catch (error: unknown) {
      log.error('Failed to fetch MangaUpdates releases', {
        mangaTitle,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Analyze release pattern from MU release dates.
   * Returns schedule with pattern type and confidence.
   */
  async getReleaseSchedule(mangaTitle: string): Promise<MUReleaseSchedule | null> {
    try {
      const seriesId = this.config['seriesId'] as number | undefined;
      if (!seriesId) return null;

      const releases = await mangaUpdatesService.getRecentReleases(mangaTitle, seriesId, 50);
      if (releases.length < 3) {
        return { mangaTitle, pattern: 'IRREGULAR', confidence: 0 };
      }

      const dates = releases
        .map(r => new Date(r.release_date))
        .filter(d => !isNaN(d.getTime()))
        .sort((a, b) => b.getTime() - a.getTime());

      if (dates.length < 3) {
        return { mangaTitle, pattern: 'IRREGULAR', confidence: 0 };
      }

      return this.analyzePattern(mangaTitle, dates);
    } catch (error: unknown) {
      log.error('Failed to analyze MU release schedule', {
        mangaTitle,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  dispose(): void {
    // No resources to dispose
  }

  // ==================== Private Helpers ====================

  private analyzePattern(mangaTitle: string, dates: Date[]): MUReleaseSchedule {
    const intervals: number[] = [];
    for (let i = 0; i < dates.length - 1; i++) {
      const curr = dates[i];
      const next = dates[i + 1];
      if (curr && next) {
        intervals.push((curr.getTime() - next.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    if (intervals.length === 0) {
      return { mangaTitle, pattern: 'IRREGULAR', confidence: 0 };
    }

    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / intervals.length;
    const cv = Math.sqrt(variance) / avg;

    let pattern: MUReleaseSchedule['pattern'];
    if (avg >= 5 && avg <= 9) pattern = 'WEEKLY';
    else if (avg >= 12 && avg <= 16) pattern = 'BIWEEKLY';
    else if (avg >= 25 && avg <= 35) pattern = 'MONTHLY';
    else pattern = 'IRREGULAR';

    let confidence = Math.max(0, Math.min(1, 1 - cv));
    if (pattern === 'IRREGULAR') confidence *= 0.5;

    const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0];
    for (const d of dates) dayOfWeekCounts[d.getDay()] = (dayOfWeekCounts[d.getDay()] ?? 0) + 1;
    const dayOfWeek = dayOfWeekCounts.indexOf(Math.max(...dayOfWeekCounts));

    let nextExpected: Date | undefined;
    const last = dates[0];
    if (last && pattern !== 'IRREGULAR') {
      nextExpected = new Date(last);
      nextExpected.setDate(nextExpected.getDate() + Math.round(avg));
    }

    return {
      mangaTitle, pattern,
      confidence: Math.round(confidence * 100) / 100,
      dayOfWeek, averageInterval: Math.round(avg * 10) / 10,
      lastRelease: dates[0], nextExpectedRelease: nextExpected,
    };
  }

  private transformToChapterEntity(
    release: { id: number; chapter: string; volume: string | null; release_date: string; groups: Array<{ name: string }> },
  ): ChapterEntity {
    const chNum = parseFloat(release.chapter);
    const chapterNumber = isNaN(chNum) ? 0 : chNum;
    const groups = release.groups.map(g => g.name).join(', ');

    return {
      id: 0,
      mangaId: 0,
      title: `Chapter ${release.chapter}`,
      fileName: `mu-release-${release.id}`,
      index: Math.floor(chapterNumber),
      chapterNumber,
      number: chapterNumber,
      volume: release.volume ? parseInt(release.volume, 10) : null,
      pages: 0,
      pageCount: 0,
      language: 'en',
      releaseDate: new Date(release.release_date),
      downloadStatus: 'PENDING',
      isRead: false,
      monitored: false,
      size: 0,
      createdAt: new Date(release.release_date),
      updatedAt: new Date(release.release_date),
      mangadexId: null,
      suwayomiChapterId: null,
      hash: null,
      mimeType: null,
      resolutionWidth: null,
      resolutionHeight: null,
      resolutionLabel: null,
      alternativeTitles: [groups],
      coverImage: null,
      description: `Released by: ${groups}`,
      fileFormat: null,
      filePath: null,
      packDownloadId: null,
      volumeId: null,
      downloadUrl: null,
    } as ChapterEntity;
  }
}

interface MUReleaseSchedule {
  mangaTitle: string;
  pattern: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'IRREGULAR';
  confidence: number;
  dayOfWeek?: number | undefined;
  averageInterval?: number | undefined;
  lastRelease?: Date | undefined;
  nextExpectedRelease?: Date | undefined;
}

export function createMangaUpdatesCalendarProvider(config: Record<string, unknown>): CalendarAdapter {
  return new MangaUpdatesCalendarProvider(config);
}
