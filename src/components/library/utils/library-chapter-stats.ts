/* eslint-disable @typescript-eslint/no-unnecessary-condition -- defensive null
   checks for runtime safety: Prisma's generated type claims Chapter is always
   present, but partial query payloads can omit it (same policy as libraryUtils). */
/**
 * Chapter statistics helpers for library views.
 *
 * Single source of truth for volume-file-row filtering: volume rows carry
 * NULL chapterNumber and an index in the synthetic band (>= 100000) —
 * written by pack import (100000 + vol), the library scanner
 * (100000 + vol*100), and ensureVolumeFileRows. Those rows are file
 * pointers, not chapters — every user-facing count, latest-chapter, and
 * progress computation must exclude them, otherwise Bleach's "Volume 74"
 * row renders as "Chapters: 100074".
 *
 * Both fields matter: real numbered chapters can also sit at sentinel
 * indexes (Gantz gap-chapter stubs live at 100007+ with real
 * chapterNumbers) and must still count as chapters. The
 * chapterNumber >= 100000 case covers legacy pack-import rows written
 * before the convention was unified on NULL.
 *
 * @module components/library/utils/library-chapter-stats
 */

import { ChapterStatus } from '@prisma/client';

import type { MangaChapterStats } from './chapter-stats-builder';
import type { Prisma } from '@prisma/client';

type MangaWithRelations = Prisma.MangaGetPayload<{
    include: {
        Metadata: true;
        Chapter: true;
    };
}>;

/** A manga that may carry a server-precomputed chapter aggregate (library grid). */
type MangaMaybeStats = MangaWithRelations & { chapterStats?: MangaChapterStats | null };

/** First index of the synthetic volume-row band. */
export const SENTINEL_INDEX_MIN = 100000;

export function isRealChapter(chapter: { index: number; chapterNumber?: number | null }): boolean {
    if (chapter.chapterNumber !== null && chapter.chapterNumber !== undefined) {
        return chapter.chapterNumber < SENTINEL_INDEX_MIN;
    }
    return chapter.index < SENTINEL_INDEX_MIN;
}

/**
 * Calculate read progress percentage for a manga
 */
export function calculateProgress(manga: MangaMaybeStats): number {
    const stats = manga.chapterStats;
    if (stats) {
        return stats.realChapterCount === 0 ? 0 : Math.round((stats.readCount / stats.realChapterCount) * 100);
    }
    const realChapters = (manga.Chapter ?? []).filter(isRealChapter);
    if (realChapters.length === 0) {
        return 0;
    }
    const readCount = realChapters.filter(ch => ch.isRead).length;
    return Math.round((readCount / realChapters.length) * 100);
}

/**
 * Get the latest chapter number
 */
export function getLatestChapterNumber(manga: MangaMaybeStats): string | null {
    if (manga.chapterStats) return manga.chapterStats.latestChapterNumber;
    const realChapters = (manga.Chapter ?? []).filter(isRealChapter);
    if (realChapters.length === 0) {
        return null;
    }
    // Sort chapters by number (descending) and get the first one
    const sortedChapters = [...realChapters].sort((a, b) => {
        const aNum = parseFloat(String(a.chapterNumber ?? '0'));
        const bNum = parseFloat(String(b.chapterNumber ?? '0'));
        return bNum - aNum;
    });
    const firstChapter = sortedChapters[0];
    if (firstChapter === undefined) {
        return null;
    }
    const chapterNum = firstChapter.chapterNumber;
    // Note: `0` is a valid chapter number (prologue). Don't treat it as missing.
    return chapterNum !== null && chapterNum !== undefined ? String(chapterNum) : null;
}

/**
 * Get download status summary
 */
export function getDownloadStatus(manga: MangaMaybeStats): {
    downloaded: number;
    total: number;
    hasErrors: boolean;
} {
    const stats = manga.chapterStats;
    if (stats) {
        return { downloaded: stats.downloadedCount, total: stats.realChapterCount, hasErrors: stats.hasErrors };
    }
    const realChapters = (manga.Chapter ?? []).filter(isRealChapter);
    if (realChapters.length === 0) {
        return { downloaded: 0, total: 0, hasErrors: false };
    }
    const downloaded = realChapters.filter(ch => ch.downloadStatus === ChapterStatus.COMPLETED).length;
    const hasErrors = realChapters.some(ch => ch.downloadStatus === ChapterStatus.ERROR);
    return {
        downloaded,
        total: realChapters.length,
        hasErrors
    };
}
