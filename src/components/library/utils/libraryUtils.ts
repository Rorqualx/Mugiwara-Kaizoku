/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/**
 * Enhanced Library Utility Functions
 *
 * Shared functions for filtering and sorting manga in library views
 * Includes support for advanced filters
 *
 * Note: Contains defensive null checks for runtime safety even where
 * TypeScript infers values are never null/undefined.
 *
 * @module components/library/utils/libraryUtils
 */

import { MangaPublicationStatus, ChapterStatus } from '@prisma/client';

import type { SortOption, FilterOption, AdvancedFilter, SearchField } from '@/store/libraryViewSlice';
import { logger } from '@/utils/logger';


import {
  checkFieldMatch,
  checkTitleMatch,
  checkAuthorMatch,
  checkArtistMatch,
  checkGenreMatch,
  checkTagMatch,
  checkAllFieldsMatch,
} from './library-utils-helpers';
import { getRatingValue } from './rating-extractor';

import type { MangaChapterStats } from './chapter-stats-builder';
import type { Prisma } from '@prisma/client';

// Define manga with relations type using Prisma's generated types
type MangaWithRelations = Prisma.MangaGetPayload<{
    include: {
        Metadata: true;
        Chapter: true;
    };
}>;

// Chapter-stat helpers (sentinel-band filtering, progress, latest chapter)
// live in library-chapter-stats.ts; re-exported here for existing callers.
export {
    SENTINEL_INDEX_MIN,
    isRealChapter,
    calculateProgress,
    getLatestChapterNumber,
    getDownloadStatus,
} from './library-chapter-stats';

interface FilterSortOptions {
    sortBy: SortOption;
    filterBy: FilterOption[];
    searchQuery: string;
    searchField: SearchField;
    enableRegexSearch: boolean;
    advancedFilters: AdvancedFilter;
    searchedManga?: MangaWithRelations[];
}

/**
 * Apply search with field and regex support
 */
function applySearch(manga: MangaWithRelations[], query: string, field: SearchField, enableRegex: boolean): MangaWithRelations[] {
    if (!query) return manga;

    let searchPattern: RegExp | null = null;
    if (enableRegex) {
        try {
            searchPattern = new RegExp(query, 'i');
        } catch (_: unknown) {
            logger.warn('Invalid regex pattern:', query);
        }
    }

    return manga.filter(m => {
        const checkField = (value: string | undefined | null): boolean =>
            checkFieldMatch(value, query, searchPattern);

        switch (field) {
            case 'title':
                return checkTitleMatch(m, checkField);
            case 'author':
                return checkAuthorMatch(m, checkField);
            case 'artist':
                return checkArtistMatch(m, checkField);
            case 'genre':
                return checkGenreMatch(m, checkField);
            case 'tag':
                return checkTagMatch(m, checkField);
            case 'all':
            default:
                return checkAllFieldsMatch(m, checkField);
        }
    });
}
/**
 * Pull a chapter count for filtering. Prefers `_count.Chapter` when the caller
 * loaded the relation count; falls back to the in-memory `Chapter` array length.
 */
function getChapterCount(manga: MangaWithRelations): number {
    const stats = (manga as { chapterStats?: MangaChapterStats | null }).chapterStats;
    if (stats) return stats.realChapterCount;
    const withCount = manga as MangaWithRelations & { _count?: { Chapter?: number } };
    if (typeof withCount._count?.Chapter === 'number') return withCount._count.Chapter;
    return manga.Chapter?.length ?? 0;
}

// eslint-disable-next-line complexity -- Each filter type is a flat independent branch
function applyAdvancedFilters(manga: MangaWithRelations[], filters: AdvancedFilter): MangaWithRelations[] {
    let filtered = manga;
    // Date filters
    if (filters.dateAddedFrom || filters.dateAddedTo) {
        filtered = filtered.filter(m => {
            const createdDate = new Date(m.createdAt);
            if (filters.dateAddedFrom && createdDate < new Date(filters.dateAddedFrom)) {
                return false;
            }
            if (filters.dateAddedTo && createdDate > new Date(filters.dateAddedTo)) {
                return false;
            }
            return true;
        });
    }
    // Last read date filters
    if (filters.lastReadFrom || filters.lastReadTo) {
        filtered = filtered.filter(m => {
            const lastReadTime = getLastReadTime(m);
            if (!lastReadTime)
                return false;
            const lastReadDate = new Date(lastReadTime);
            if (filters.lastReadFrom && lastReadDate < new Date(filters.lastReadFrom)) {
                return false;
            }
            if (filters.lastReadTo && lastReadDate > new Date(filters.lastReadTo)) {
                return false;
            }
            return true;
        });
    }
    // Chapter count filters. Prefer `_count.Chapter` when the query opted into it
    // (cheaper and accurate even if Chapter relation wasn't included).
    if (filters.chaptersMin !== null && filters.chaptersMin !== undefined) {
        const minValue = filters.chaptersMin;
        filtered = filtered.filter(m => getChapterCount(m) >= minValue);
    }
    if (filters.chaptersMax !== null && filters.chaptersMax !== undefined) {
        const maxValue = filters.chaptersMax;
        filtered = filtered.filter(m => getChapterCount(m) <= maxValue);
    }
    // Genre filters
    if (filters["genres"] !== undefined && filters["genres"].length > 0) {
        const genresFilter = filters["genres"];
        filtered = filtered.filter(m => {
            const mangaGenres = m.Metadata?.genres ?? [];
            return genresFilter.some(g => mangaGenres.includes(g));
        });
    }
    // Tag filters
    if (filters["tags"] !== undefined && filters["tags"].length > 0) {
        const tagsFilter = filters["tags"];
        filtered = filtered.filter(m => {
            const mangaTags = m.Metadata?.tags ?? [];
            return tagsFilter.some(t => mangaTags.includes(t));
        });
    }
    // Exclude genres
    if (filters.excludeGenres !== undefined && filters.excludeGenres.length > 0) {
        const excludeGenresFilter = filters.excludeGenres;
        filtered = filtered.filter(m => {
            const mangaGenres = m.Metadata?.genres ?? [];
            return !excludeGenresFilter.some(g => mangaGenres.includes(g));
        });
    }
    // Exclude tags
    if (filters.excludeTags !== undefined && filters.excludeTags.length > 0) {
        const excludeTagsFilter = filters.excludeTags;
        filtered = filtered.filter(m => {
            const mangaTags = m.Metadata?.tags ?? [];
            return !excludeTagsFilter.some(t => mangaTags.includes(t));
        });
    }
    // Publication status filter
    if (filters.publicationStatus !== undefined && filters.publicationStatus.length > 0) {
        const statusFilter = filters.publicationStatus;
        filtered = filtered.filter(m =>
            statusFilter.includes(m.publicationStatus)
        );
    }
    // Reading status filter
    if (filters.readingStatus !== undefined && filters.readingStatus.length > 0) {
        const readingFilter = filters.readingStatus;
        filtered = filtered.filter(m => {
            const { totalCount, readCount, downloadedCount } = chapterCounts(m);
            return readingFilter.some(status => {
                switch (status) {
                    case 'has-chapters': return totalCount > 0;
                    case 'no-chapters': return totalCount === 0;
                    case 'has-downloaded': return downloadedCount > 0;
                    case 'fully-read': return totalCount > 0 && readCount === totalCount;
                    case 'partially-read': return readCount > 0 && readCount < totalCount;
                    case 'not-started': return totalCount > 0 && readCount === 0;
                    default: return true;
                }
            });
        });
    }
    // Rating filter
    if (filters.ratingMin !== null && filters.ratingMin !== undefined) {
        const minRating = filters.ratingMin;
        filtered = filtered.filter(m => getRatingValue(m.Metadata?.rating) >= minRating);
    }
    if (filters.ratingMax !== null && filters.ratingMax !== undefined) {
        const maxRating = filters.ratingMax;
        filtered = filtered.filter(m => getRatingValue(m.Metadata?.rating) <= maxRating);
    }
    // Monitored filter. The Manga model has no top-level `monitored` field
    // (the previous code read a non-existent property and always got `false`,
    // so "Monitored: yes" matched zero manga). Derive the signal from the
    // same chapter array the header bookmark icon uses — a manga counts as
    // monitored iff at least one of its chapters has monitored=true. Keeps
    // the library filter and the per-manga icon in lockstep.
    if (filters.monitored !== null && filters.monitored !== undefined) {
        const monitoredValue = filters.monitored;
        filtered = filtered.filter(m => {
            const stats = (m as { chapterStats?: MangaChapterStats | null }).chapterStats;
            const chapters = (m as MangaWithRelations & { Chapter?: Array<{ monitored?: boolean }> }).Chapter ?? [];
            const mangaMonitored = stats ? stats.isMonitored : chapters.some(ch => ch.monitored === true);
            return mangaMonitored === monitoredValue;
        });
    }
    // Country of origin filter
    if (filters.countryOfOrigin !== undefined && filters.countryOfOrigin.length > 0) {
        const countryFilter = filters.countryOfOrigin;
        filtered = filtered.filter(m =>
            countryFilter.includes(m.Metadata?.countryOfOrigin ?? '')
        );
    }
    return filtered;
}
/**
 * Get last read time for a manga.
 *
 * Uses `Chapter.updatedAt` as a proxy because the canonical source —
 * `ReadingProgress.lastReadAt` — is keyed per-user and is not currently
 * included in the library list query. By restricting to chapters with
 * `isRead === true`, we avoid the case where a metadata-enrichment sweep
 * (which touches every chapter's updatedAt) makes unread series look
 * recently-read. Switching to `ReadingProgress.lastReadAt` requires a
 * server-side include and is tracked as a follow-up.
 */
function getLastReadTime(manga: MangaWithRelations): number {
    const stats = (manga as { chapterStats?: MangaChapterStats | null }).chapterStats;
    if (stats) return stats.lastReadAt ? new Date(stats.lastReadAt).getTime() : 0;
    if (!manga.Chapter || manga.Chapter.length === 0) {
        return 0;
    }
    type ChapterType = MangaWithRelations['Chapter'][number];

    const readTimes = manga.Chapter
        .filter((ch: ChapterType) => ch.isRead)
        .map((ch: ChapterType) => {
            const updatedAt = ch.updatedAt;
            if (typeof updatedAt === 'string' || updatedAt instanceof Date) {
                return new Date(updatedAt).getTime();
            }
            return 0;
        })
        .filter((time: number) => time > 0);
    return readTimes.length > 0 ? Math.max(...readTimes) : 0;
}
interface ChapterCounts {
    totalCount: number;
    readCount: number;
    downloadedCount: number;
    hasErrors: boolean;
}

/**
 * A title's chapter counts. Library grid rows carry `chapterStats` (the SQL
 * aggregate) and no Chapter array, so read those first; fall back to the
 * Chapter array for callers that load one.
 */
function chapterCounts(m: MangaWithRelations): ChapterCounts {
    const stats = (m as { chapterStats?: MangaChapterStats | null }).chapterStats;
    if (stats) {
        return { totalCount: stats.realChapterCount, readCount: stats.readCount, downloadedCount: stats.downloadedCount, hasErrors: stats.hasErrors };
    }
    const chapters = m.Chapter ?? [];
    return {
        totalCount: chapters.length,
        readCount: chapters.filter(ch => ch.isRead).length,
        downloadedCount: chapters.filter(ch => ch.downloadStatus === ChapterStatus.COMPLETED).length,
        hasErrors: chapters.some(ch => ch.downloadStatus === ChapterStatus.ERROR),
    };
}

/** Whether a title passes one of the toolbar's basic filters. */
function passesBasicFilter(m: MangaWithRelations, filter: FilterOption): boolean {
    if (filter === 'completed') return m.publicationStatus === MangaPublicationStatus.COMPLETED;
    const { totalCount, readCount, downloadedCount, hasErrors } = chapterCounts(m);
    switch (filter) {
        case 'read': return totalCount > 0 && readCount === totalCount;
        case 'unread': return totalCount > 0 && readCount === 0;
        case 'in-progress': return readCount > 0 && readCount < totalCount;
        case 'downloaded': return downloadedCount > 0;
        case 'has-issues': return hasErrors;
        default: return true;
    }
}

/**
 * Filter and sort manga based on the provided options
 */
export function filterAndSortManga(manga: MangaWithRelations[], options: FilterSortOptions): MangaWithRelations[] {
    const { sortBy, filterBy, searchQuery, searchField, enableRegexSearch, advancedFilters, searchedManga } = options;
    // Start with searched manga if provided, otherwise use all manga
    let filteredManga = searchedManga ?? manga;
    // Apply search with field and regex support
    if (!searchedManga && searchQuery) {
        filteredManga = applySearch(filteredManga, searchQuery, searchField, enableRegexSearch);
    }
    // Apply basic filters
    if (filterBy.length > 0) {
        filteredManga = filteredManga.filter(m => filterBy.every(filter => passesBasicFilter(m, filter)));
    }
    // Apply advanced filters
    if (Object.keys(advancedFilters).length > 0) {
        filteredManga = applyAdvancedFilters(filteredManga, advancedFilters);
    }
    // Apply sorting
    const sorted = [...filteredManga].sort((a, b) => {
        switch (sortBy) {
            case 'alphabetical': {
                return a["title"].localeCompare(b["title"], undefined, { sensitivity: 'base', numeric: true });
            }
            case 'alphabetical-desc': {
                return b["title"].localeCompare(a["title"], undefined, { sensitivity: 'base', numeric: true });
            }
            case 'date-added': {
                // Sort by createdAt, newest first
                const aCreated = new Date(a.createdAt).getTime();
                const bCreated = new Date(b.createdAt).getTime();
                return bCreated - aCreated;
            }
            case 'date-added-desc': {
                // Sort by createdAt, oldest first
                const aCreatedDesc = new Date(a.createdAt).getTime();
                const bCreatedDesc = new Date(b.createdAt).getTime();
                return aCreatedDesc - bCreatedDesc;
            }
            case 'last-read': {
                // Sort by last read chapter date
                return getLastReadTime(b) - getLastReadTime(a);
            }
            case 'progress': {
                // Sort by read percentage (matches the read/unread/in-progress filters,
                // which all use isRead). Don't use downloadStatus here — a fully-downloaded
                // unread library would otherwise rank as 100% complete.
                const progressOf = (m: MangaWithRelations): number => {
                    const st = (m as { chapterStats?: MangaChapterStats | null }).chapterStats;
                    if (st) return st.realChapterCount > 0 ? st.readCount / st.realChapterCount : 0;
                    const chs = m.Chapter ?? [];
                    return chs.length > 0 ? chs.filter(ch => ch.isRead).length / chs.length : 0;
                };
                return progressOf(b) - progressOf(a);
            }
            case 'rating': {
                // Sort by rating (if available in metadata); Phase 1: JSON shape.
                const aRating = getRatingValue(a.Metadata?.rating);
                const bRating = getRatingValue(b.Metadata?.rating);
                return bRating - aRating;
            }
            default: {
                return 0;
            }
        }
    });
    return sorted;
}
/**
 * Group manga by first letter for alphabet navigation
 */
export function groupMangaByLetter(manga: MangaWithRelations[]): Map<string, MangaWithRelations[]> {
    const groups = new Map<string, MangaWithRelations[]>();
    manga.forEach(m => {
        const title = m["title"];
        let firstChar = title.charAt(0).toUpperCase();
        // Group numbers and special characters under '#'
        if (!/[A-Z]/.test(firstChar)) {
            firstChar = '#';
        }
        if (!groups.has(firstChar)) {
            groups.set(firstChar, []);
        }
        const groupArray = groups.get(firstChar);
        if (groupArray) {
            groupArray.push(m);
        }
    });
    return groups;
}
/**
 * Get available genres from manga collection
 */
export function getAvailableGenres(manga: MangaWithRelations[]): string[] {
    const genresSet = new Set<string>();
    manga.forEach(m => {
        if (m.Metadata?.genres) {
            m.Metadata["genres"].forEach(g => genresSet.add(g));
        }
    });
    return Array.from(genresSet).sort();
}
/**
 * Get available tags from manga collection
 */
export function getAvailableTags(manga: MangaWithRelations[]): string[] {
    const tagsSet = new Set<string>();
    manga.forEach(m => {
        if (m.Metadata?.tags) {
            m.Metadata.tags.forEach(t => tagsSet.add(t));
        }
    });
    return Array.from(tagsSet).sort();
}
