/**
 * Calendar Provider Adapters
 *
 * Specialized adapters for calendar functionality that wrap the existing API clients
 * to provide calendar-specific methods like getting latest chapters and release schedules.
 */

// Import API clients
import { UnifiedAniListAdapter as AniListAdapter } from '@/server/adapters/unified-anilist-adapter';
import { UnifiedComicVineAdapter as ComicVineAdapter } from '@/server/adapters/unified-comicvine-adapter';
import { isSuccess } from '@/utils/async-result';
import { ValidationError } from '@/utils/errors';
import { createLogger } from '@/utils/logger';

import { createAniListCalendarProvider } from './providers/AniListCalendarProvider';
import { createMangaDexCalendarProvider } from './providers/MangaDexCalendarProvider';
import { createMangaUpdatesCalendarProvider } from './providers/MangaUpdatesCalendarProvider';

import type { Chapter as ChapterEntity } from '@prisma/client';

const logger = createLogger('CalendarProviderAdapters');
// Base interface for calendar adapters
export interface CalendarAdapter {
    isEnabled(): boolean;
    getLatestChapters(mangaId: string, afterChapter?: string): Promise<ChapterEntity[]>;
    getReleaseSchedule?(mangaId: string): Promise<unknown>;
    dispose(): void;
}
/**
 * AniList adapter for calendar functionality
 */
export class CalendarAniListAdapter implements CalendarAdapter {
    private adapter: AniListAdapter;
    constructor(config: Record<string, unknown>) {
        const accessToken = config["accessToken"];
        const clientId = config["clientId"];
        const clientSecret = config["clientSecret"];
        this.adapter = new AniListAdapter({
            enabled: true,
            accessToken: typeof accessToken === 'string' ? accessToken : '',
            clientId: typeof clientId === 'string' ? clientId : '',
            clientSecret: typeof clientSecret === 'string' ? clientSecret : ''
        });
    }
    isEnabled(): boolean {
        return true; // enabled is hardcoded to true in constructor
    }
    getLatestChapters(_mangaId: string, _afterChapter?: string): Promise<ChapterEntity[]> {
        // AniList doesn't provide chapter-level data
        // We can only get manga metadata
        return Promise.resolve([]);
    }
    async getReleaseSchedule(mangaId: string): Promise<unknown> {
        try {
            const mangaResult = await this.adapter.getById(mangaId);
            if (!isSuccess(mangaResult)) {
                throw new ValidationError('Failed to get manga');
            }
            const manga = mangaResult.data;
            // Extract any schedule-related information
            return {
                status: manga["status"],
                updatedAt: manga.updatedAt
            };
        }
        catch (error: unknown) {
            logger.error('[CalendarAniList] Error getting release schedule', { error: error instanceof Error ? error.message : String(error) });
            return null;
        }
    }
    dispose(): void {
        // No dispose method on adapter
    }
}
/**
 * ComicVine adapter for calendar functionality
 */
export class CalendarComicVineAdapter implements CalendarAdapter {
    private adapter: ComicVineAdapter;
    constructor(config: Record<string, unknown>) {
        const apiKey = config["apiKey"];
        this.adapter = new ComicVineAdapter({
            enabled: true,
            apiKey: typeof apiKey === 'string' ? apiKey : ''
        });
    }
    isEnabled(): boolean {
        return true; // enabled is hardcoded to true in constructor
    }
    getLatestChapters(_volumeId: string, _afterChapter?: string): Promise<ChapterEntity[]> {
        // ComicVine works with issues, not chapters
        // Would need custom implementation to map issues to chapters
        return Promise.resolve([]);
    }
    dispose(): void {
        // No dispose method on adapter
    }
}
/**
 * Fandom adapter for calendar functionality
 */
// FandomAdapter not available
/*
export class CalendarFandomAdapter implements CalendarAdapter {
  private adapter: unknown;
  
  constructor(config: unknown) {
    // this.adapter = new FandomAdapter({
    //   enabled: true,
    //   wikiDomain: config.wikiDomain || 'manga.fandom.com'
    // });
  }
  
  isEnabled(): boolean {
    return false; // FandomAdapter not available
  }
  
  async getLatestChapters(mangaId: string, afterChapter?: string): Promise<ChapterEntity[]> {
    // Fandom wikis don't provide real-time chapter releases
    return [];
  }
  
  dispose(): void {
    // No dispose method on adapter
  }
}
*/
/**
 * Factory function to create calendar adapters
 */
export function createCalendarAdapter(provider: string, config: Record<string, unknown>): CalendarAdapter | null {
    switch (provider.toLowerCase()) {
        case 'mangadex':
            return createMangaDexCalendarProvider(config);
        case 'anilist':
            // Use the real AniList provider for actual API calls
            return createAniListCalendarProvider(config);
        case 'mangaupdates':
            return createMangaUpdatesCalendarProvider(config);
        case 'comicvine':
            // ComicVine doesn't provide real-time chapter data
            return new CalendarComicVineAdapter(config);
        case 'fandom':
            // Fandom wikis don't provide real-time chapter releases - adapter not available
            return null; // CalendarFandomAdapter not available
        default:
            logger.warn(`[CalendarAdapter] Unknown provider: ${provider}`, { provider });
            return null;
    }
}
/**
 * Type guard for calendar adapter
 */
export function isCalendarAdapter(obj: unknown): obj is CalendarAdapter {
    return obj !== null &&
        typeof (obj as Record<string, unknown>)["isEnabled"] === 'function' &&
        typeof (obj as Record<string, unknown>)["getLatestChapters"] === 'function' &&
        typeof (obj as Record<string, unknown>)["dispose"] === 'function';
}
