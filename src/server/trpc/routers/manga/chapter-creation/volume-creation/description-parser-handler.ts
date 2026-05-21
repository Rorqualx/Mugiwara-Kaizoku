/**
 * Description Parser Handler
 *
 * Handles Priority 2: Parse chapters from volume description.
 * Used primarily for ComicVine data where chapter information
 * is embedded in the volume description text.
 */

import { logger } from '@/utils/logger';

import { safeGetString, parseReleaseDate, truncateString } from '../helpers';

import type { ChapterToCreate, NormalizedVolume, ParseChaptersFromDescriptionFn } from '../types';

// Database column limits (VARCHAR(255))
const MAX_TITLE_LENGTH = 255;
const MAX_FILENAME_LENGTH = 255;

/**
 * Parse chapters from volume description (primarily for ComicVine)
 *
 * @param normalized - Normalized volume data with description
 * @param mangaId - ID of the manga to associate chapters with
 * @param parseChaptersFromDescription - Function to parse chapter data from description text
 * @returns Array of chapters created from parsed description
 */
export function handleDescriptionParsedChapters(
  normalized: NormalizedVolume,
  mangaId: number,
  parseChaptersFromDescription: ParseChaptersFromDescriptionFn
): ChapterToCreate[] {
  const chapters: ChapterToCreate[] = [];

  // Parse chapters from description
  const parsedChapters = parseChaptersFromDescription(normalized.description);

  // Safety check - should only be called when parsing yields results
  if (parsedChapters.length === 0) {
    logger.warn(`handleDescriptionParsedChapters called but no chapters found in description for volume ${normalized.volumeNumber}`);
    return chapters;
  }

  logger.info(`Volume #${normalized.volumeNumber} contains ${parsedChapters.length} chapters from description parsing`);

  for (const parsedChapter of parsedChapters) {
    // Use actual chapter number for index to preserve source numbering
    const chapterIndex = parsedChapter.chapterNumber;

    const chapterTitle = safeGetString(parsedChapter, 'title', `Chapter ${parsedChapter.chapterNumber}`);
    const fileName = `v${normalized.volumeNumber.toString().padStart(2, '0')}-c${parsedChapter.chapterNumber.toString().padStart(3, '0')}.cbz`;
    chapters.push({
      mangaId: mangaId,
      title: truncateString(chapterTitle, MAX_TITLE_LENGTH),
      alternativeTitles: [],
      index: chapterIndex,
      chapterNumber: parsedChapter.chapterNumber,
      fileName: truncateString(fileName, MAX_FILENAME_LENGTH),
      size: 0,
      downloadStatus: 'PENDING' as const,
      volume: normalized.volumeNumber,
      // Use volume URL as download reference
      downloadUrl: normalized.downloadUrl ?? null,
      // Use volume cover for all chapters in the volume
      coverImage: normalized.coverImage ?? null,
      // Store volume info in description
      description: typeof normalized.title === 'string' && normalized.title ? `From ${normalized.title}` : `Volume #${normalized.volumeNumber}`,
      releaseDate: parseReleaseDate(normalized.releaseDate) ?? null,
      pageCount: null,
      // Default to monitored for auto-download system
      monitored: true,
      // CRITICAL: Must explicitly set updatedAt for createMany (Prisma doesn't auto-populate @updatedAt in batch inserts)
      updatedAt: new Date()
    });
  }

  return chapters;
}
