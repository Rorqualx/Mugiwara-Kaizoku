/**
 * Volume Statistics Hook
 *
 * Custom hook that calculates aggregate statistics for a volume.
 * Uses DB-recorded sizes and page counts from chapter records.
 *
 * @module useVolumeStatistics
 */

import { useMemo } from 'react';

import type { FileVerificationMap } from './utils';
import type { Chapter } from '@prisma/client';

/**
 * Parameters for the useVolumeStatistics hook
 */
export interface UseVolumeStatisticsParams {
    /** Array of chapters in the volume */
    chapters: Chapter[];
    /** File verification data (kept for interface compatibility) */
    fileVerification?: FileVerificationMap | undefined;
}

/**
 * Return value from the useVolumeStatistics hook
 */
export interface UseVolumeStatisticsReturn {
    /** Total size of all chapter files in bytes */
    volumeSize: number;
    /** Total page count across all chapters */
    volumePageCount: number;
}

/**
 * Hook for calculating volume statistics
 *
 * Computes aggregate statistics for a volume based on its chapters.
 * Always uses DB-recorded values - file verification only affects
 * readability, not displayed statistics.
 *
 * @param params - Hook parameters
 * @returns Volume statistics
 */
export function useVolumeStatistics({
    chapters,
}: UseVolumeStatisticsParams): UseVolumeStatisticsReturn {
    return useMemo(() => {
        const validChapters = chapters.filter(
            (chapter: Chapter): chapter is Chapter => chapter instanceof Object
        );

        // A whole-volume archive is represented by a "volume-file" row (chapterNumber === null):
        // its size/pageCount cover the ENTIRE volume, while the numbered chapters are slices of the
        // same archive. Summing both double-counts (a tankōbon reads as ~2x its real size/pages), so
        // when a volume-file row exists it alone defines the volume totals; otherwise sum the
        // per-chapter rows (volumes stored as individual chapter files, e.g. clean Dorohedoro v18).
        const volumeFileRows = validChapters.filter(
            (c: Chapter) => c.chapterNumber === null && c.filePath !== null
        );

        const size = volumeFileRows.length > 0
            ? Math.max(...volumeFileRows.map((c: Chapter) => c.size))
            : validChapters.reduce((sum: number, c: Chapter) => sum + c.size, 0);

        const pageCount = volumeFileRows.length > 0
            ? Math.max(...volumeFileRows.map((c: Chapter) => c.pageCount ?? c.pages ?? 0))
            : validChapters.reduce((sum: number, c: Chapter) => sum + (c.pageCount ?? c.pages ?? 0), 0);

        return {
            volumeSize: size,
            volumePageCount: pageCount
        };
    }, [chapters]);
}
