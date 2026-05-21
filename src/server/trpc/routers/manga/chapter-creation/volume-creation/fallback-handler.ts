/**
 * Fallback Chapter Handler
 *
 * Handles Priority 3: Estimate chapters when no data available.
 * Used when volume has no pre-parsed chapters and description
 * parsing fails to extract chapter information.
 */

import { logger } from '@/utils/logger';

import { parseReleaseDate, truncateString } from '../helpers';

import type { ChapterToCreate, NormalizedVolume, FallbackHandlerResult } from '../types';

/**
 * Default number of chapters to estimate per volume when no data is available
 */
const ESTIMATED_CHAPTERS_PER_VOLUME = 6;

// Database column limits (VARCHAR(255))
const MAX_TITLE_LENGTH = 255;
const MAX_FILENAME_LENGTH = 255;

/**
 * Create estimated chapters when no chapter data is available
 *
 * @param normalized - Normalized volume data
 * @param mangaId - ID of the manga to associate chapters with
 * @param globalChapterIndex - Current global chapter index for sequential ordering
 * @returns Object containing created chapters and updated global chapter index
 */
export function handleFallbackChapters(
  normalized: NormalizedVolume,
  mangaId: number,
  globalChapterIndex: number
): FallbackHandlerResult {
  const chapters: ChapterToCreate[] = [];
  let currentIndex = globalChapterIndex;

  const volumeName = (typeof normalized.title === 'string' && normalized.title)
    ? normalized.title
    : `Volume #${normalized.volumeNumber}`;

  logger.info(`No chapters found for Volume #${normalized.volumeNumber}, creating ${ESTIMATED_CHAPTERS_PER_VOLUME} estimated chapters`);

  for (let j = 1; j <= ESTIMATED_CHAPTERS_PER_VOLUME; j++) {
    const chapterTitle = `${volumeName} - Chapter ${j}`;
    const fileName = `v${normalized.volumeNumber.toString().padStart(2, '0')}-c${j.toString().padStart(3, '0')}.cbz`;
    chapters.push({
      mangaId: mangaId,
      title: truncateString(chapterTitle, MAX_TITLE_LENGTH),
      alternativeTitles: [],
      index: currentIndex++,
      chapterNumber: j,
      fileName: truncateString(fileName, MAX_FILENAME_LENGTH),
      size: 0,
      downloadStatus: 'PENDING' as const,
      volume: normalized.volumeNumber,
      downloadUrl: normalized.downloadUrl ?? null,
      coverImage: normalized.coverImage ?? null,
      description: (typeof normalized.description === 'string' ? normalized.description : null),
      releaseDate: parseReleaseDate(normalized.releaseDate) ?? null,
      pageCount: null,
      // Default to monitored for auto-download system
      monitored: true,
      // CRITICAL: Must explicitly set updatedAt for createMany (Prisma doesn't auto-populate @updatedAt in batch inserts)
      updatedAt: new Date()
    });
  }

  return { chapters, globalChapterIndex: currentIndex };
}
