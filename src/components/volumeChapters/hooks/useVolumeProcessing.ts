/**
 * Volume Processing Hook
 *
 * Handles chapter grouping by volumes and placeholder generation.
 * Returns AsyncResult for consistent error handling.
 *
 * Extracted from: VolumeGroupedChapters.tsx (lines 258-322)
 */

import { useMemo } from 'react';

import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { isPhantomStub } from '../phantom-stub';
import {
    isValidChapter,
    extractVolumeNumber,
    generatePlaceholderChapters,
    createPlaceholderChapterForVolume
} from '../utils';

import type { VolumeProcessingState } from '../types';
import type { Chapter } from "@prisma/client";

interface UseVolumeProcessingProps {
    chapters: Chapter[] | null | undefined;
    hasActualChapters: boolean;
    hasMetadataCounts: boolean;
    volumeCount: number;
    chapterCount: number;
    mangaTitle: string | undefined;
}

/**
 * Process chapters into volumes with AsyncResult pattern
 */
export function useVolumeProcessing({
    chapters,
    hasActualChapters,
    hasMetadataCounts,
    volumeCount,
    chapterCount,
    mangaTitle
}: UseVolumeProcessingProps): AsyncResult<VolumeProcessingState, Error> {
    return useMemo((): AsyncResult<VolumeProcessingState, Error> => {
        try {
            const volumeMap = new Map<number, Chapter[]>();

            // Process actual chapters if available
            if (hasActualChapters && Array.isArray(chapters)) {
                processActualChapters(chapters, volumeMap);

                // Fill in missing volumes from metadata
                if (hasMetadataCounts && volumeCount > 0) {
                    addMissingPlaceholderVolumes(volumeMap, volumeCount, mangaTitle);
                }
            }
            // Generate placeholder chapters if we have metadata counts but no actual chapters
            else if (hasMetadataCounts) {
                processPlaceholderChapters(volumeCount, chapterCount, mangaTitle, volumeMap);
            }

            // Sort chapters within each volume by index
            sortChaptersInVolumes(volumeMap);

            // Sort volumes by number and convert to array
            const sortedVolumes = Array.from(volumeMap.entries()).sort(([a], [b]) => a - b);

            // Return success result with volume data and stats
            return createSuccessResult<VolumeProcessingState, Error>({
                volumes: sortedVolumes,
                stats: {
                    volumeCount: sortedVolumes.length,
                    chapterCount: Array.isArray(chapters) ? chapters.length : 0,
                    ...(volumeCount > 0 ? { metadataVolumes: volumeCount } : {}),
                    ...(chapterCount > 0 ? { metadataChapters: chapterCount } : {})
                }
            });
        }
        catch (error: unknown) {
            logger.error('Error processing manga volumes:', error);

            // Ensure proper error typing with instanceof check
            const typedError = error instanceof Error ?
                error :
                new Error(`Failed to process manga volumes: ${String(error)}`);

            return createErrorResult<VolumeProcessingState, Error>(typedError);
        }
    }, [hasActualChapters, hasMetadataCounts, chapters, volumeCount, chapterCount, mangaTitle]);
}

/**
 * Process actual chapters from database
 */
function processActualChapters(chapters: Chapter[], volumeMap: Map<number, Chapter[]>): void {
    // First filter out invalid chapters AND phantom stubs left over from wrong
    // provider bindings or reidentify passes. The backend-side cleanup (Fix B
    // in the audit plan) deletes these on next enrichment, but in-flight users
    // still have them — this filter keeps the UI honest in the meantime.
    const validChapters = chapters.filter((c) => isValidChapter(c) && !isPhantomStub(c));

    validChapters.forEach((chapter) => {
        // Extract volume number from database only
        const volumeNumber = extractVolumeNumber(chapter);

        if (!volumeMap.has(volumeNumber)) {
            volumeMap.set(volumeNumber, []);
        }

        const volumeChapters = volumeMap.get(volumeNumber);
        if (volumeChapters) {
            volumeChapters.push(chapter);
        }
    });

}

/**
 * Generate placeholder chapters when no actual chapters available
 */
function processPlaceholderChapters(
    volumeCount: number,
    chapterCount: number,
    mangaTitle: string | undefined,
    volumeMap: Map<number, Chapter[]>
): void {
    const placeholderVolumeMap = generatePlaceholderChapters(
        volumeCount,
        chapterCount,
        mangaTitle ?? 'Unknown Manga'
    );

    // Copy the placeholder volumes to the main volumeMap
    placeholderVolumeMap.forEach((chaps, volumeNumber) => {
        volumeMap.set(volumeNumber, chaps);
    });
}

/**
 * Add placeholder entries for volumes reported in metadata but missing locally
 *
 * When metadata says 34 volumes but only 30 exist locally, this adds
 * placeholder chapters for the 4 missing volume numbers so they appear in the UI.
 */
function addMissingPlaceholderVolumes(
    volumeMap: Map<number, Chapter[]>,
    volumeCount: number,
    mangaTitle: string | undefined
): void {
    for (let vol = 1; vol <= volumeCount; vol++) {
        if (!volumeMap.has(vol)) {
            volumeMap.set(vol, [createPlaceholderChapterForVolume(vol, mangaTitle)]);
        }
    }
}

/**
 * Sort chapters within each volume by index
 */
function sortChaptersInVolumes(volumeMap: Map<number, Chapter[]>): void {
    volumeMap.forEach((chapters) => {
        chapters.sort((a, b) => {
            const indexA = a.index || 0;
            const indexB = b.index || 0;
            return indexA - indexB;
        });
    });
}
