/**
 * Auto Matcher Module
 *
 * Handles automatic file-to-chapter matching based on filename parsing.
 * This is the fallback when user mappings are not provided.
 *
 * @module server/services/library/scanner/chapter-creator/auto-matcher
 */

import * as path from 'path';


import { ChapterStatus } from '@prisma/client';

import { normalizeFileFormat } from '@/server/services/conversion/format-normalization';
import { extractChapterNumber, extractVolumeNumber } from '@/utils/file-utils';
import { MangaFileParser } from '@/utils/parsers/mangaFileParser';


import type { ParsedFileInfo, ChapterInfo, ChapterUpdate, ChapterCreate } from './types';

// ============================================================================
// File Parsing
// ============================================================================

/**
 * Parse file info (chapter number, volume, size) from file path
 */
export function parseFileInfo(file: string, index: number, fileSizeMap: Map<string, number>): ParsedFileInfo {
  const fileName = path.basename(file);
  let chapterNumber: number | null = null;
  let volumeNumber: number | null = null;
  let title = `File ${index + 1}`;
  let hasExplicitChapter = false;

  const parsed = MangaFileParser.parse(fileName);

  if (parsed.chapter !== undefined) {
    chapterNumber = parsed.chapter;
    title = `Chapter ${chapterNumber}`;
    hasExplicitChapter = true;
  }

  if (parsed.volume !== undefined) {
    volumeNumber = parsed.volume;
  }

  // Fallback to basic extraction for chapter
  if (!hasExplicitChapter) {
    const extractedChapter = extractChapterNumber(fileName);
    if (extractedChapter !== null) {
      chapterNumber = extractedChapter;
      title = `Chapter ${chapterNumber}`;
      hasExplicitChapter = true;
    }
  }

  // Fallback to basic extraction for volume
  if (volumeNumber === null) {
    const extractedVolume = extractVolumeNumber(fileName);
    if (extractedVolume !== null) {
      volumeNumber = extractedVolume;
    }
  }

  // Determine if this is a volume file (has volume but no chapter)
  const isVolumeFile = volumeNumber !== null && !hasExplicitChapter;

  // Update title for volume files
  if (isVolumeFile) {
    title = `Volume ${volumeNumber}`;
  }

  const size = fileSizeMap.get(file) ?? 0;

  return { file, fileName, chapterNumber, volumeNumber, title, size, isVolumeFile };
}

// ============================================================================
// Chapter Matching
// ============================================================================

/**
 * Try to match a file to an existing chapter by volume+number or just number
 */
export function matchFileToChapter(
  fileInfo: ParsedFileInfo,
  chaptersByNumber: Map<number, ChapterInfo>,
  chaptersByVolumeAndNumber: Map<string, ChapterInfo>
): ChapterInfo | null {
  if (fileInfo.chapterNumber === null) return null;

  // Try volume + chapter number first (more specific)
  if (fileInfo.volumeNumber !== null) {
    const key = `${fileInfo.volumeNumber}-${fileInfo.chapterNumber}`;
    const chapter = chaptersByVolumeAndNumber.get(key);
    if (chapter) {
      chaptersByVolumeAndNumber.delete(key);
      chaptersByNumber.delete(fileInfo.chapterNumber);
      return chapter;
    }
  }

  // Try chapter number only
  const chapter = chaptersByNumber.get(fileInfo.chapterNumber);
  if (chapter) {
    chaptersByNumber.delete(fileInfo.chapterNumber);
    if (chapter.volume !== null) {
      chaptersByVolumeAndNumber.delete(`${chapter.volume}-${fileInfo.chapterNumber}`);
    }
    return chapter;
  }

  return null;
}

/**
 * Link a volume file to all chapters in that volume
 */
export function linkVolumeFileToChapters(
  fileInfo: ParsedFileInfo,
  chaptersByVolume: Map<number, ChapterInfo[]>
): ChapterInfo[] {
  if (fileInfo.volumeNumber === null) return [];

  const chaptersInVolume = chaptersByVolume.get(fileInfo.volumeNumber);
  if (!chaptersInVolume || chaptersInVolume.length === 0) return [];

  // Remove matched chapters from the volume map
  chaptersByVolume.delete(fileInfo.volumeNumber);
  return chaptersInVolume;
}

// ============================================================================
// Map Building
// ============================================================================

/** Chapter maps for auto-matching */
export interface ChapterMaps {
  byNumber: Map<number, ChapterInfo>;
  byVolumeAndNumber: Map<string, ChapterInfo>;
  byVolume: Map<number, ChapterInfo[]>;
}

/**
 * Build chapter lookup maps from existing chapters
 */
export function buildChapterMaps(
  chapters: Array<{ id: number; number: number | null; index: number; volume: number | null }>
): ChapterMaps {
  const byNumber = new Map<number, ChapterInfo>();
  const byVolumeAndNumber = new Map<string, ChapterInfo>();
  const byVolume = new Map<number, ChapterInfo[]>();

  for (const ch of chapters) {
    const num = ch.number ?? ch.index;
    const info: ChapterInfo = { id: ch.id, volume: ch.volume };

    byNumber.set(num, info);

    if (ch.volume !== null) {
      byVolumeAndNumber.set(`${ch.volume}-${num}`, info);

      const volumeChapters = byVolume.get(ch.volume) ?? [];
      volumeChapters.push(info);
      byVolume.set(ch.volume, volumeChapters);
    }
  }

  return { byNumber, byVolumeAndNumber, byVolume };
}

// ============================================================================
// File Processing
// ============================================================================

/**
 * Process a single file and add to updates/creates lists
 */
export function processFileForLinking(
  fileInfo: ParsedFileInfo,
  mangaId: number,
  maps: ChapterMaps,
  updates: ChapterUpdate[],
  creates: ChapterCreate[]
): void {
  // Handle volume files - link to ALL chapters in that volume
  if (fileInfo.isVolumeFile) {
    const volumeChapters = linkVolumeFileToChapters(fileInfo, maps.byVolume);
    for (const ch of volumeChapters) {
      updates.push({ id: ch.id, fileName: fileInfo.fileName, filePath: fileInfo.file, size: fileInfo.size });
    }
    if (volumeChapters.length > 0) return;
  }

  // Handle chapter files - link to specific chapter
  const match = matchFileToChapter(fileInfo, maps.byNumber, maps.byVolumeAndNumber);
  if (match) {
    updates.push({ id: match.id, fileName: fileInfo.fileName, filePath: fileInfo.file, size: fileInfo.size });
    return;
  }

  // No match found - create new chapter
  const index = fileInfo.chapterNumber ?? fileInfo.volumeNumber ?? 0;
  creates.push({
    mangaId,
    fileName: fileInfo.fileName,
    filePath: fileInfo.file,
    fileFormat: normalizeFileFormat(fileInfo.fileName),
    index,
    title: fileInfo.title,
    size: fileInfo.size,
    downloadStatus: ChapterStatus.COMPLETED,
    volume: fileInfo.volumeNumber,
    updatedAt: new Date()
  });
}

/**
 * Try to link a volume file to completed chapters (for re-imports)
 * Returns true if handled, false if should fall through to normal processing
 */
export function tryLinkVolumeToCompletedChapters(
  fileInfo: ParsedFileInfo,
  maps: { byVolume: Map<number, ChapterInfo[]> },
  completedByVolume: Map<number, Array<{ id: number }>>,
  updates: ChapterUpdate[]
): boolean {
  if (!fileInfo.isVolumeFile || fileInfo.volumeNumber === null) return false;

  const pendingChapters = maps.byVolume.get(fileInfo.volumeNumber);
  if (pendingChapters && pendingChapters.length > 0) return false;

  const completedChapters = completedByVolume.get(fileInfo.volumeNumber);
  if (!completedChapters || completedChapters.length === 0) return false;

  for (const ch of completedChapters) {
    updates.push({ id: ch.id, fileName: fileInfo.fileName, filePath: fileInfo.file, size: fileInfo.size });
  }
  completedByVolume.delete(fileInfo.volumeNumber);
  return true;
}
