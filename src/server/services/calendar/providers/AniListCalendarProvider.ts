import { ValidationError } from '@/utils/errors';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';

/**
 * Calendar Provider Implementation - AniList
 *
 * Complete implementation of AniList GraphQL API integration for calendar functionality.
 * Fetches manga metadata and analyzes update patterns.
 */
import type { CalendarAdapter } from '../CalendarProviderAdapters';
import type { Chapter as ChapterEntity } from '@prisma/client';

interface AniListMediaResponse {
    data: {
        Media: {
            id: number;
            title: {
                english: string | null;
                romaji: string;
                native: string;
            };
            status: string;
            chapters: number | null;
            volumes: number | null;
            updatedAt: number;
            nextAiringEpisode: {
                airingAt: number;
                episode: number;
            } | null;
            startDate: {
                year: number | null;
                month: number | null;
                day: number | null;
            };
            endDate: {
                year: number | null;
                month: number | null;
                day: number | null;
            };
            source: string;
            countryOfOrigin: string;
        };
    };
}
interface AniListActivityResponse {
    data: {
        Page: {
            activities: Array<{
                id: number;
                status: string;
                progress: string;
                createdAt: number;
            }>;
        };
    };
}
interface AniListConfig {
    accessToken?: string;
}

/**
 * Narrow `unknown` provider config to the known AniList shape without trusting
 * upstream callers. Anything that isn't a plain object is treated as empty.
 */
function parseAniListConfig(config: unknown): AniListConfig {
    if (typeof config !== 'object' || config === null) return {};
    const accessToken = (config as Record<string, unknown>)['accessToken'];
    return typeof accessToken === 'string' && accessToken.length > 0
        ? { accessToken }
        : {};
}

export class AniListCalendarProvider implements CalendarAdapter {
    private baseUrl = 'https://graphql.anilist.co';
    private headers: Record<string, string>;
    constructor(private config: unknown) {
        this.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        const typedConfig = parseAniListConfig(config);
        if (typedConfig.accessToken) {
            this.headers['Authorization'] = `Bearer ${typedConfig.accessToken}`;
        }
    }

    /**
     * Wrap fetch with AniList rate-limit awareness: if the server returns 429,
     * honor the Retry-After header (or fall back to 60s) and retry once.
     * AniList's documented limit is 90 req/min — without this, repeated 429s
     * silently degrade to throwing ValidationErrors.
     */
    private async rateLimitedFetch(body: string): Promise<Response> {
        const doFetch = (): Promise<Response> => fetch(this.baseUrl, {
            method: 'POST',
            headers: this.headers,
            body,
        });
        const response = await doFetch();
        if (response.status !== 429) return response;
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
        const waitMs = (Number.isFinite(retryAfterSec) ? retryAfterSec : 60) * 1000;
        logger.warn(`[AniListCalendar] Rate-limited; waiting ${waitMs}ms before retry`);
        await new Promise<void>(resolve => { setTimeout(resolve, waitMs); });
        return doFetch();
    }
    isEnabled(): boolean {
        return true;
    }
    getLatestChapters(_mangaId: string, _afterChapter?: string): Promise<ChapterEntity[]> {
        // AniList doesn't provide chapter-level data
        // We can only track overall progress from user activities
        return Promise.resolve([]);
    }
    async getReleaseSchedule(mangaId: string): Promise<unknown> {
        try {
            // Get manga details
            const query = `
        query ($id: Int) {
          Media(id: $id, type: MANGA) {
            id
            title {
              english
              romaji
              native
            }
            status
            chapters
            volumes
            updatedAt
            nextAiringEpisode {
              airingAt
              episode
            }
            startDate {
              year
              month
              day
            }
            endDate {
              year
              month
              day
            }
            source
            countryOfOrigin
          }
        }
      `;
            const response = await this.rateLimitedFetch(JSON.stringify({
                query,
                variables: { id: toNumberId(mangaId) },
            }));
            if (!response.ok) {
                throw new ValidationError(`AniList API error: ${response["status"]} ${response.statusText}`);
            }
            const data = await response.json() as AniListMediaResponse;
            const manga = data.data.Media;
            // Map status
            let status = manga["status"].toLowerCase();
            if (status === 'releasing')
                status = 'ongoing';
            if (status === 'finished')
                status = 'completed';
            // Get recent activity to analyze update pattern
            const activityData = await this.getRecentActivity(mangaId);

            // Analyze pattern from activity using extracted helper methods
            const patternAnalysis = this.analyzeActivityPattern(activityData);
            const { pattern, confidence, averageInterval } = patternAnalysis;

            // For manga from Japan, check if it's from a known weekly magazine
            const isWeeklyJump = manga["source"] === 'MANGA' && manga.countryOfOrigin === 'JP' && pattern === 'WEEKLY' && confidence > 0.7;
            return {
                status,
                lastUpdate: new Date(manga.updatedAt * 1000),
                pattern,
                confidence,
                averageInterval,
                chapters: manga["chapters"],
                volumes: manga.volumes,
                isWeeklyJump,
                nextAiring: manga.nextAiringEpisode ? new Date(manga.nextAiringEpisode.airingAt * 1000) : null,
                startDate: this.parseDate(manga.startDate),
                endDate: this.parseDate(manga.endDate)
            };
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('[AniListCalendar] Error getting release schedule', errorMessage);
            return null;
        }
    }
    private async getRecentActivity(mangaId: string): Promise<unknown[] | null> {
        try {
            const query = `
        query ($mediaId: Int) {
          Page(page: 1, perPage: 20) {
            activities(mediaId: $mediaId, type: MANGA_LIST, sort: ID_DESC) {
              ... on ListActivity {
                id
                status
                progress
                createdAt
              }
            }
          }
        }
      `;
            const response = await this.rateLimitedFetch(JSON.stringify({
                query,
                variables: { mediaId: toNumberId(mangaId) },
            }));
            if (!response.ok) {
                return null;
            }
            const data = await response.json() as AniListActivityResponse;
            return data.data.Page.activities;
        }
        catch (error: unknown) {
            logger.error('[AniListCalendar] Error getting activity', error instanceof Error ? error : String(error));
            return null;
        }
    }
    /**
     * Analyze activity data to determine release pattern
     */
    private analyzeActivityPattern(activityData: unknown[] | null): {
        pattern: string;
        confidence: number;
        averageInterval: number;
    } {
        // Need at least 3 data points to analyze pattern
        if (!activityData || activityData.length < 3) {
            return { pattern: 'IRREGULAR', confidence: 0, averageInterval: 0 };
        }

        const intervals = this.calculateIntervals(activityData);
        return this.analyzePatternFromIntervals(intervals);
    }

    /**
     * Calculate intervals between activity timestamps
     */
    private calculateIntervals(activityData: unknown[]): number[] {
        const intervals: number[] = [];
        for (let i = 1; i < activityData.length; i++) {
            const prev = activityData[i - 1];
            const curr = activityData[i];
            const interval = this.getIntervalBetweenActivities(prev, curr);
            if (interval !== null) {
                intervals.push(interval);
            }
        }
        return intervals;
    }

    /**
     * Get interval in days between two activity records
     */
    private getIntervalBetweenActivities(prev: unknown, curr: unknown): number | null {
        if (!prev || !curr || typeof prev !== 'object' || typeof curr !== 'object') {
            return null;
        }
        const prevActivity = prev as Record<string, unknown>;
        const currActivity = curr as Record<string, unknown>;
        const prevCreatedAt = prevActivity['createdAt'];
        const currCreatedAt = currActivity['createdAt'];
        if (typeof prevCreatedAt !== 'number' || typeof currCreatedAt !== 'number') {
            return null;
        }
        return Math.floor((prevCreatedAt - currCreatedAt) / (60 * 60 * 24));
    }

    /**
     * Analyze release pattern from intervals
     */
    private analyzePatternFromIntervals(intervals: number[]): {
        pattern: string;
        confidence: number;
        averageInterval: number;
    } {
        if (intervals.length === 0) {
            return { pattern: 'IRREGULAR', confidence: 0, averageInterval: 0 };
        }

        const averageInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const patternResult = this.determinePattern(intervals, averageInterval);

        return {
            pattern: patternResult.pattern,
            confidence: patternResult.confidence,
            averageInterval
        };
    }

    /**
     * Determine the release pattern based on average interval
     */
    private determinePattern(intervals: number[], averageInterval: number): {
        pattern: string;
        confidence: number;
    } {
        // Weekly pattern (6-8 days)
        if (averageInterval >= 6 && averageInterval <= 8) {
            const matchingIntervals = intervals.filter(i => i >= 6 && i <= 8);
            return { pattern: 'WEEKLY', confidence: matchingIntervals.length / intervals.length };
        }
        // Biweekly pattern (13-15 days)
        if (averageInterval >= 13 && averageInterval <= 15) {
            const matchingIntervals = intervals.filter(i => i >= 13 && i <= 15);
            return { pattern: 'BIWEEKLY', confidence: matchingIntervals.length / intervals.length };
        }
        // Monthly pattern (28-32 days)
        if (averageInterval >= 28 && averageInterval <= 32) {
            const matchingIntervals = intervals.filter(i => i >= 28 && i <= 32);
            return { pattern: 'MONTHLY', confidence: matchingIntervals.length / intervals.length };
        }

        return { pattern: 'IRREGULAR', confidence: 0 };
    }

    private parseDate(date: unknown): Date | null {
        if (!date || typeof date !== 'object') {
            return null;
        }
        const dateObj = date as Record<string, unknown>;
        const year = dateObj['year'];
        if (!year || typeof year !== 'number') {
            return null;
        }
        const month = dateObj['month'];
        const day = dateObj['day'];
        const monthValue = (typeof month === 'number' ? month : 1) - 1; // JavaScript months are 0-indexed
        const dayValue = typeof day === 'number' ? day : 1;
        return new Date(year, monthValue, dayValue);
    }
    dispose(): void {
        // No cleanup needed for GraphQL API
    }
}
/**
 * Factory function to create AniList calendar provider
 */
export function createAniListCalendarProvider(config: unknown): AniListCalendarProvider {
    return new AniListCalendarProvider(config);
}
