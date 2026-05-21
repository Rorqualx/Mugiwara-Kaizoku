/**
 * Volume and Chapter Selection Synchronization Utilities
 *
 * Handles the synchronization between volume and chapter selections
 */
import { logger } from '@/utils/logger';

import type { VolumeData, ChapterData } from '../media';
/**
 * Get all chapters for selected volumes
 */
export function getChaptersForVolumes(selectedVolumes: number[], volumeData: VolumeData[]): number[] {
    const chaptersToSelect: number[] = [];
    selectedVolumes.forEach(volumeNumber => {
        // Find the volume data
        const volume = volumeData.find(v => v.volumeNumber === volumeNumber ||
            v.number === volumeNumber ||
            v.index === volumeNumber);
        if (volume) {
            // Get chapters for this volume
            if (volume["chapters"] && Array.isArray(volume["chapters"])) {
                volume["chapters"].forEach((chapter: unknown) => {
                    const ch = chapter as Record<string, unknown>;
                    const chapterNum = ch["number"] ?? ch["index"] ?? ch["id"];
                    if (chapterNum && !chaptersToSelect.includes(Number(chapterNum))) {
                        chaptersToSelect.push(Number(chapterNum));
                    }
                });
            }
            // Handle chapter range (e.g., "1-10")
            if (volume.chapterRange) {
                const range = volume.chapterRange.split('-').map((n: string) => parseInt(n.trim()));
                const start = range[0];
                const end = range[1];
                const isValidRange = range.length === 2 && start !== undefined && end !== undefined && !isNaN(start) && !isNaN(end);

                if (isValidRange) {
                    for (let i = start; i <= end; i++) {
                        // eslint-disable-next-line max-depth -- Complex chapter range processing
                        if (!chaptersToSelect.includes(i)) {
                            chaptersToSelect.push(i);
                        }
                    }
                }
            }
            // Handle chapterCount if no explicit chapters or range
            if (!volume["chapters"] && !volume.chapterRange && volume.chapterCount) {
                // Estimate chapter numbers based on volume position
                const volumeIndex = volumeData.indexOf(volume);
                const previousVolumes = volumeData.slice(0, volumeIndex);
                const previousChapterCount = previousVolumes.reduce((sum, v) => sum + (v.chapterCount ?? 0), 0);
                for (let i = 1; i <= volume.chapterCount; i++) {
                    const chapterNum = previousChapterCount + i;
                    if (!chaptersToSelect.includes(chapterNum)) {
                        chaptersToSelect.push(chapterNum);
                    }
                }
            }
        }
    });
    // Sort chapters numerically
    return chaptersToSelect.sort((a, b) => a - b);
}
/**
 * Get volumes that contain the selected chapters
 */
export function getVolumesForChapters(selectedChapters: number[], volumeData: VolumeData[]): number[] {
    const volumesToSelect: number[] = [];
    volumeData.forEach(volume => {
        const volumeNum = volume.volumeNumber ?? volume.number ?? volume.index;
        // Use explicit undefined check to allow Volume 0 (for prequels like JJK 0)
        if (volumeNum === undefined)
            return;
        let hasSelectedChapter = false;
        // Check if volume contains any selected chapters
        if (volume["chapters"] && Array.isArray(volume["chapters"])) {
            hasSelectedChapter = volume["chapters"].some((chapter: unknown) => {
                const ch = chapter as Record<string, unknown>;
                const chapterNum = ch["number"] ?? ch["index"] ?? ch["id"];
                return chapterNum && selectedChapters.includes(Number(chapterNum));
            });
        }
        // Check chapter range
        if (!hasSelectedChapter && volume.chapterRange) {
            const range = volume.chapterRange.split('-').map((n: string) => parseInt(n.trim()));
            const start = range[0];
            const end = range[1];
            const isValidRange = range.length === 2 && start !== undefined && end !== undefined && !isNaN(start) && !isNaN(end);

            if (isValidRange) {
                hasSelectedChapter = selectedChapters.some(ch => ch >= start && ch <= end);
            }
        }
        if (hasSelectedChapter && !volumesToSelect.includes(volumeNum)) {
            volumesToSelect.push(volumeNum);
        }
    });
    return volumesToSelect.sort((a, b) => a - b);
}
/**
 * Handle volume selection and auto-select corresponding chapters
 */
export function handleVolumeSelection(selectedVolumes: number[], volumeData: VolumeData[], setSelectedChapters: (chapters: number[]) => void, fetchChapterCovers?: (chapters: number[]) => Promise<void>): void {
    const chaptersToSelect = getChaptersForVolumes(selectedVolumes, volumeData);
    // Update chapter selection
    setSelectedChapters(chaptersToSelect);
    // Trigger chapter cover fetching if function provided
    if (fetchChapterCovers && chaptersToSelect.length > 0) {
        fetchChapterCovers(chaptersToSelect).catch(error => {
            logger.error('Failed to fetch chapter covers:', error);
        });
    }
}
/**
 * Batch fetch chapter covers with progress tracking
 */
export async function fetchChapterCoversInBatches(chapters: number[], provider: string, mangaId: string, fetchFunction: (chapterIds: number[]) => Promise<Record<number, string>>, onProgress?: (current: number, total: number) => void): Promise<Record<number, string>> {
    const BATCH_SIZE = 10;

    // Create all batch operations
    const batches: number[][] = [];
    for (let i = 0; i < chapters.length; i += BATCH_SIZE) {
        batches.push(chapters.slice(i, i + BATCH_SIZE));
    }

    // Execute all batches in parallel
    const batchPromises = batches.map(async (batch, index) => {
        try {
            const batchResults = await fetchFunction(batch);
            // Report progress
            if (onProgress) {
                onProgress(Math.min((index + 1) * BATCH_SIZE, chapters.length), chapters.length);
            }
            return batchResults;
        }
        catch (error: unknown) {
            logger.error(`Failed to fetch covers for batch ${index + 1}:`, error);
            return {};
        }
    });

    // Wait for all batches to complete
    const allBatchResults = await Promise.all(batchPromises);

    // Combine all results
    const results = allBatchResults.reduce((acc, batchResults) => ({ ...acc, ...batchResults }), {});

    return results;
}
/**
 * Extract chapter numbers from chapter data
 */
export function extractChapterNumbers(chapters: ChapterData[]): number[] {
    return chapters
        .map(ch => ch.number ?? ch.index ?? 0)
        .filter(num => num > 0)
        .sort((a, b) => a - b);
}
/**
 * Group chapters by volume
 */
export function groupChaptersByVolume(chapters: ChapterData[], volumeData?: VolumeData[]): Map<number, ChapterData[]> {
    const grouped = new Map<number, ChapterData[]>();
    // eslint-disable-next-line complexity -- Complex chapter grouping with multiple fallbacks
    chapters.forEach(chapter => {
        // First check if chapter has explicit volume number
        if (chapter.volumeNumber) {
            const existing = grouped.get(chapter.volumeNumber) ?? [];
            existing.push(chapter);
            grouped.set(chapter.volumeNumber, existing);
            return;
        }
        // Try to determine volume from volumeData
        if (volumeData) {
            const chapterNum = chapter.number ?? chapter.index;
            if (chapterNum) {
                for (const volume of volumeData) {
                    const volumeNum = volume.volumeNumber ?? volume.number ?? volume.index;
                    // Use explicit undefined check to allow Volume 0 (for prequels like JJK 0)
                    if (volumeNum === undefined)
                        continue;
                    // Check if chapter is in this volume's chapters
                    if (volume["chapters"]?.some((ch: unknown) => {
                        const c = ch as Record<string, unknown>;
                        return (c["number"] ?? c["index"] ?? c["id"]) === chapterNum;
                    })) {
                        const existing = grouped.get(volumeNum) ?? [];
                        existing.push(chapter);
                        grouped.set(volumeNum, existing);
                        return;
                    }
                    // Check chapter range
                    if (volume.chapterRange) {
                        const range = volume.chapterRange.split('-').map(n => parseInt(n.trim()));
                        const start = range[0];
                        const end = range[1];
                        const isValidRange = range.length === 2 && start !== undefined && end !== undefined && !isNaN(start) && !isNaN(end);
                        const isInRange = isValidRange && chapterNum >= start && chapterNum <= end;

                        // eslint-disable-next-line max-depth -- Complex volume chapter range matching with nested conditions
                        if (isInRange) {
                            const existing = grouped.get(volumeNum) ?? [];
                            existing.push(chapter);
                            grouped.set(volumeNum, existing);
                            return;
                        }
                    }
                }
            }
        }
        // If no volume found, add to volume 0 (unassigned)
        const existing = grouped.get(0) ?? [];
        existing.push(chapter);
        grouped.set(0, existing);
    });
    return grouped;
}
