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

        const size = validChapters.reduce((sum: number, chapter: Chapter) => {
            return sum + chapter.size;
        }, 0);

        const pageCount = validChapters.reduce((sum: number, chapter: Chapter) => {
            // Use file-based pageCount first, fall back to metadata pages
            return sum + (chapter.pageCount ?? chapter.pages ?? 0);
        }, 0);

        return {
            volumeSize: size,
            volumePageCount: pageCount
        };
    }, [chapters]);
}
