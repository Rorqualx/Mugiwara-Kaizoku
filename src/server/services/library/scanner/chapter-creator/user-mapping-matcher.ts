/**
 * User Mapping Matcher Module
 *
 * Handles matching files to chapters using user-provided mappings from the import pipeline.
 * These mappings take priority over filename-based auto-matching.
 *
 * @module server/services/library/scanner/chapter-creator/user-mapping-matcher
 */

import { logger } from '@/utils/logger';

import type { ChapterMappingForImport, ChapterUpdate, ParsedFileInfo } from './types';

// ============================================================================
// Types
// ============================================================================

/** Chapter data for matching */
export interface ChapterForMatching {
  id: number;
  number: number | null;
  index: number;
  volume: number | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a user mapping represents a volume file (whole volume, not specific chapter)
 */
export function isVolumeMappingOnly(mapping: ChapterMappingForImport): boolean {
  return mapping.volumeNumber !== undefined && mapping.chapterNumber === undefined;
}

/**
 * Match a file to an existing chapter using user-provided chapter number
 * Returns the matched chapter or null if no match found
 */
export function matchByUserChapterNumber(
  mapping: ChapterMappingForImport,
  allChapters: ChapterForMatching[],
  matchedChapterIds: Set<number>
): { id: number; volume: number | null } | null {
  const targetNum = mapping.chapterNumber;
  if (targetNum === undefined) return null;

  // Find unmatched chapter with matching number
  const chapter = allChapters.find(
    (ch) => !matchedChapterIds.has(ch.id) && (ch.number === targetNum || ch.index === targetNum)
  );

  if (chapter) {
    matchedChapterIds.add(chapter.id);
    return { id: chapter.id, volume: chapter.volume };
  }

  return null;
}

/**
 * Link a volume file to all chapters in that volume using chapter range from user mapping
 * This is the most precise method when the frontend provides chapterRangeStart/End
 */
export function linkVolumeFileByChapterRange(
  mapping: ChapterMappingForImport,
  allChapters: ChapterForMatching[],
  matchedChapterIds: Set<number>
): Array<{ id: number }> {
  const { chapterRangeStart, chapterRangeEnd } = mapping;
  if (chapterRangeStart === undefined || chapterRangeEnd === undefined) return [];

  // Find chapters in the exact range specified by user mapping
  const chaptersInRange = allChapters.filter(
    (ch) =>
      !matchedChapterIds.has(ch.id) &&
      ch.number !== null &&
      ch.number >= chapterRangeStart &&
      ch.number <= chapterRangeEnd
  );

  // Mark all found chapters as matched
  for (const ch of chaptersInRange) {
    matchedChapterIds.add(ch.id);
  }

  return chaptersInRange.map((ch) => ({ id: ch.id }));
}

/**
 * Link a volume file to all chapters in that volume by volume number
 * Fallback when chapter ranges are not provided
 */
export function linkVolumeFileByVolumeNumber(
  volumeNumber: number,
  allChapters: ChapterForMatching[],
  matchedChapterIds: Set<number>
): Array<{ id: number }> {
  // Find all chapters in this volume that haven't been matched yet
  const chaptersInVolume = allChapters.filter((ch) => ch.volume === volumeNumber && !matchedChapterIds.has(ch.id));

  // Mark all found chapters as matched
  for (const ch of chaptersInVolume) {
    matchedChapterIds.add(ch.id);
  }

  return chaptersInVolume.map((ch) => ({ id: ch.id }));
}

/**
 * Fallback: Find chapters by chapter number range for a volume
 * Used when database volume numbers don't match user expectations
 *
 * Example: Volume 1 contains chapters 1-6
 * If chapters 1-6 don't have volume=1, find them by number range
 */
export function findChaptersByNumberRange(
  volumeNumber: number,
  allChapters: ChapterForMatching[],
  matchedChapterIds: Set<number>,
  chaptersPerVolume: number = 6
): Array<{ id: number }> {
  // Calculate expected chapter range for this volume
  const startChapter = (volumeNumber - 1) * chaptersPerVolume + 1;
  const endChapter = volumeNumber * chaptersPerVolume;

  const chaptersInRange = allChapters.filter(
    (ch) =>
      !matchedChapterIds.has(ch.id) && ch.number !== null && ch.number >= startChapter && ch.number <= endChapter
  );

  // Mark all found chapters as matched
  for (const ch of chaptersInRange) {
    matchedChapterIds.add(ch.id);
  }

  return chaptersInRange.map((ch) => ({ id: ch.id }));
}

// ============================================================================
// Main Processing Function
// ============================================================================

/**
 * Process a file with user mapping and link to existing chapters
 * Returns true if the file was successfully linked, false if it should fall through to auto-matching
 */
// eslint-disable-next-line max-params -- All parameters required for file-to-chapter matching
export function processFileWithUserMapping(
  file: string,
  fileInfo: ParsedFileInfo,
  mapping: ChapterMappingForImport,
  allChapters: ChapterForMatching[],
  matchedChapterIds: Set<number>,
  updates: ChapterUpdate[]
): boolean {
  // Build metadata fields object, only including fields that have values
  const metadataFields: Partial<Omit<ChapterUpdate, 'id' | 'fileName' | 'filePath' | 'size'>> = {};
  if (mapping.title !== undefined) metadataFields.title = mapping.title;
  if (mapping.coverImage !== undefined) metadataFields.coverImage = mapping.coverImage;
  if (mapping.description !== undefined) metadataFields.description = mapping.description;
  if (mapping.pageCount !== undefined) metadataFields.pageCount = mapping.pageCount;
  if (mapping.releaseDate !== undefined) metadataFields.releaseDate = new Date(mapping.releaseDate);

  // Case 1: Volume file with chapter range (most precise)
  if (isVolumeMappingOnly(mapping) && mapping.chapterRangeStart !== undefined) {
    const chaptersInRange = linkVolumeFileByChapterRange(mapping, allChapters, matchedChapterIds);
    if (chaptersInRange.length > 0) {
      logger.debug('Linked volume file by chapter range', {
        file: fileInfo.fileName,
        rangeStart: mapping.chapterRangeStart,
        rangeEnd: mapping.chapterRangeEnd,
        chaptersLinked: chaptersInRange.length
      });
      for (const ch of chaptersInRange) {
        updates.push({ id: ch.id, fileName: fileInfo.fileName, filePath: file, size: fileInfo.size, ...metadataFields });
      }
      return true;
    }
  }

  // Case 2: Volume file without chapter range - try by volume number
  if (isVolumeMappingOnly(mapping) && mapping.volumeNumber !== undefined) {
    // First try by volume field
    let chaptersInVolume = linkVolumeFileByVolumeNumber(mapping.volumeNumber, allChapters, matchedChapterIds);

    // Fallback: try chapter number range if volume field didn't match
    if (chaptersInVolume.length === 0) {
      logger.debug('No chapters found by volume field, trying chapter range fallback', {
        volumeNumber: mapping.volumeNumber
      });
      chaptersInVolume = findChaptersByNumberRange(mapping.volumeNumber, allChapters, matchedChapterIds);
    }

    if (chaptersInVolume.length > 0) {
      logger.debug('Linked volume file to chapters', {
        file: fileInfo.fileName,
        volumeNumber: mapping.volumeNumber,
        chaptersLinked: chaptersInVolume.length
      });
      for (const ch of chaptersInVolume) {
        updates.push({ id: ch.id, fileName: fileInfo.fileName, filePath: file, size: fileInfo.size, ...metadataFields });
      }
      return true;
    }
  }

  // Case 3: Specific chapter mapping
  if (mapping.chapterNumber !== undefined) {
    const matchedChapter = matchByUserChapterNumber(mapping, allChapters, matchedChapterIds);
    if (matchedChapter) {
      logger.debug('Linked chapter file by user mapping', {
        file: fileInfo.fileName,
        chapterNumber: mapping.chapterNumber
      });
      updates.push({ id: matchedChapter.id, fileName: fileInfo.fileName, filePath: file, size: fileInfo.size, ...metadataFields });
      return true;
    }
  }

  return false;
}
