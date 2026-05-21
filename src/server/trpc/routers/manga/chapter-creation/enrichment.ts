/**
 * Chapter Enrichment Module
 *
 * Functions for merging enrichment data and sorting chapters.
 */

import { logger } from '@/utils/logger';

import { parseReleaseDate } from './helpers';

import type { ChapterToCreate, ChapterEnrichment } from './types';

/**
 * Determine volume number for a chapter by proximity matching
 *
 * Uses two strategies:
 * 1. Find nearby chapter within ±3 and use its volume
 * 2. For chapters beyond the highest existing chapter, use the last volume
 *    (handles Final Chapter, Epilogues that come after the main series)
 */
function determineVolumeNumber(
  chapterNum: number,
  existingChapters: ChapterToCreate[]
): number | null {
  // PRIORITY 1: Find nearby chapter within ±3
  const nearbyChapter = existingChapters.find(c =>
    Math.abs(c.chapterNumber - chapterNum) <= 3
  );

  if (nearbyChapter) {
    return nearbyChapter.volume;
  }

  // PRIORITY 2: For chapters beyond the highest existing chapter,
  // assign to the last known volume (handles Final Chapter, Epilogues)
  const chapterNumbers = existingChapters.map(c => c.chapterNumber);
  const highestChapterNum = Math.max(...chapterNumbers);

  if (chapterNum > highestChapterNum) {
    const lastChapter = existingChapters.find(c => c.chapterNumber === highestChapterNum);
    const volumeNumber = lastChapter?.volume ?? null;
    logger.info(`[mergeMissingChapters] Assigning chapter ${chapterNum} to last volume ${volumeNumber} (beyond source range)`);
    return volumeNumber;
  }

  return null;
}

/**
 * Merge missing chapters from enrichment data that aren't in the main chapter list
 */
export function mergeMissingChaptersFromEnrichment(
  chaptersToCreate: ChapterToCreate[],
  chapterEnrichment: ChapterEnrichment,
  mangaId: number
): ChapterToCreate[] {
  try {
    // Get all chapter numbers AND titles from ComicVine chapters for deduplication
    const comicvineChapterNumbers = new Set(chaptersToCreate.map(c => c.chapterNumber));

    // CRITICAL: Also track chapter titles to prevent duplicates with different numbers
    // Normalize titles by removing special characters and converting to lowercase for comparison
    const normalizeTitle = (title: string): string =>
      title.toLowerCase().replace(/[^\w\s]/g, '').trim();

    const comicvineChapterTitles = new Set(
      chaptersToCreate.map(c => normalizeTitle(typeof c.title === 'string' ? c.title : ''))
    );

    // Get all chapter numbers from Fandom enrichment
    const enrichedChapterNumbers = Object.keys(chapterEnrichment).map(n => parseInt(n, 10)).filter(n => !isNaN(n));

    // Find missing chapter numbers (in enrichment but not in ComicVine)
    const missingChapterNumbers = enrichedChapterNumbers.filter(n => !comicvineChapterNumbers.has(n));

    if (missingChapterNumbers.length > 0) {
      logger.warn(`[mergeMissingChapters] Detected ${missingChapterNumbers.length} chapters with different numbers in Fandom data: ${missingChapterNumbers.join(', ')}`);
      logger.info(`[mergeMissingChapters] Checking for duplicates by title before merging...`);

      let addedCount = 0;
      let skippedCount = 0;
      const newChapters: ChapterToCreate[] = [];

      for (const chapterNum of missingChapterNumbers) {
        const enrichment = chapterEnrichment[chapterNum];
        if (!enrichment) continue;

        const enrichmentTitle = enrichment.title ?? `Chapter ${chapterNum}`;
        const normalizedEnrichmentTitle = normalizeTitle(enrichmentTitle);

        // CRITICAL: Skip if a chapter with the same title already exists (different number)
        if (comicvineChapterTitles.has(normalizedEnrichmentTitle)) {
          logger.debug(`[mergeMissingChapters] Skipping duplicate chapter ${chapterNum}: "${enrichmentTitle}" (already exists with different number)`);
          skippedCount++;
          continue;
        }

        // Determine volume by looking at nearby chapters or assigning to last volume
        const volumeNumber = determineVolumeNumber(chapterNum, chaptersToCreate);

        logger.info(`[mergeMissingChapters] Adding unique missing chapter ${chapterNum}: "${enrichmentTitle}"`);

        newChapters.push({
          mangaId: mangaId,
          title: enrichmentTitle,
          alternativeTitles: enrichment.alternativeTitles ?? [],
          index: -1, // Temporary - will be reassigned after sorting
          chapterNumber: chapterNum,
          fileName: `c${String(chapterNum).padStart(3, '0')}.cbz`,
          size: 0,
          downloadStatus: 'PENDING' as const,
          volume: volumeNumber,
          downloadUrl: enrichment.url ?? null,
          coverImage: enrichment.coverImage ?? null,
          description: enrichment.summary ?? null,
          releaseDate: parseReleaseDate(enrichment.releaseDate) ?? null,
          pageCount: enrichment.pages ?? null,
          monitored: true,
          updatedAt: new Date()
        });

        comicvineChapterTitles.add(normalizedEnrichmentTitle);
        addedCount++;
      }

      logger.info(`[mergeMissingChapters] Merge complete: ${addedCount} added, ${skippedCount} skipped as duplicates - total now ${chaptersToCreate.length + newChapters.length}`);
      return [...chaptersToCreate, ...newChapters];
    }

    return chaptersToCreate;
  } catch (error) {
    logger.error(`[mergeMissingChapters] Error merging missing chapters:`, error);
    // Don't throw - continue with original chapters
    return chaptersToCreate;
  }
}

/**
 * Sort chapters by chapter number and assign sequential indices
 */
export function sortAndAssignSequentialIndices(
  chapters: ChapterToCreate[]
): ChapterToCreate[] {
  // CRITICAL: Sort all chapters by chapter number for correct ordering
  const sorted = [...chapters].sort((a, b) => {
    const aNum = a.chapterNumber;
    const bNum = b.chapterNumber;
    return aNum - bNum;
  });

  // IMPORTANT: Use sequential indices (1, 2, 3, ...) to prevent unique constraint violations
  // Chapter numbers may have duplicates or gaps, but indices must be unique
  return sorted.map((chapter, idx) => ({
    ...chapter,
    index: idx + 1  // Start from 1
  }));
}
