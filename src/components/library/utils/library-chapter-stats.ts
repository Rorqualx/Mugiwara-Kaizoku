/* eslint-disable @typescript-eslint/no-unnecessary-condition -- defensive null
   checks for runtime safety: Prisma's generated type claims Chapter is always
   present, but partial query payloads can omit it (same policy as libraryUtils). */
/**
 * Chapter statistics helpers for library views.
 *
 * Single source of truth for sentinel-band filtering: pack import creates
 * synthetic volume rows at chapterNumber/index = 100000 + volumeNumber
 * (the library scanner uses the same index band with NULL chapterNumber).
 * Those rows are file pointers, not chapters — every user-facing count,
 * latest-chapter, and progress computation must exclude them, otherwise
 * Bleach's "Volume 74" row renders as "Chapters: 100074".
 *
 * @module components/library/utils/library-chapter-stats
 */

import { ChapterStatus } from '@prisma/client';

import type { Prisma } from '@prisma/client';

type MangaWithRelations = Prisma.MangaGetPayload<{
    include: {
        Metadata: true;
        Chapter: true;
    };
}>;

/** First index of the pack-import synthetic volume-row band. */
export const SENTINEL_INDEX_MIN = 100000;

export function isRealChapter(chapter: { index: number }): boolean {
    return chapter.index < SENTINEL_INDEX_MIN;
}

/**
 * Calculate read progress percentage for a manga
 */
export function calculateProgress(manga: MangaWithRelations): number {
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
export function getLatestChapterNumber(manga: MangaWithRelations): string | null {
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
export function getDownloadStatus(manga: MangaWithRelations): {
    downloaded: number;
    total: number;
    hasErrors: boolean;
} {
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
