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
 * Remove a matched chapter from the by-volume map so a later volume archive
 * in the same batch can't re-link (and clobber) a chapter that already got
 * its own per-chapter file.
 */
function removeFromVolumeMap(chapter: ChapterInfo, byVolume: Map<number, ChapterInfo[]>): void {
  if (chapter.volume === null) return;
  const list = byVolume.get(chapter.volume);
  if (!list) return;
  const remaining = list.filter((c) => c !== chapter);
  if (remaining.length === 0) {
    byVolume.delete(chapter.volume);
  } else {
    byVolume.set(chapter.volume, remaining);
  }
}

/**
 * Try to match a file to an existing chapter by volume+number or just number
 */
export function matchFileToChapter(
  fileInfo: ParsedFileInfo,
  maps: ChapterMaps
): ChapterInfo | null {
  if (fileInfo.chapterNumber === null) return null;

  // Try volume + chapter number first (more specific)
  if (fileInfo.volumeNumber !== null) {
    const key = `${fileInfo.volumeNumber}-${fileInfo.chapterNumber}`;
    const chapter = maps.byVolumeAndNumber.get(key);
    if (chapter) {
      maps.byVolumeAndNumber.delete(key);
      maps.byNumber.delete(fileInfo.chapterNumber);
      removeFromVolumeMap(chapter, maps.byVolume);
      return chapter;
    }
  }

  // Try chapter number only
  const chapter = maps.byNumber.get(fileInfo.chapterNumber);
  if (chapter) {
    maps.byNumber.delete(fileInfo.chapterNumber);
    if (chapter.volume !== null) {
      maps.byVolumeAndNumber.delete(`${chapter.volume}-${fileInfo.chapterNumber}`);
    }
    removeFromVolumeMap(chapter, maps.byVolume);
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
  chapters: Array<{ id: number; number: number | null; chapterNumber: number | null; index: number; volume: number | null }>
): ChapterMaps {
  const byNumber = new Map<number, ChapterInfo>();
  const byVolumeAndNumber = new Map<string, ChapterInfo>();
  const byVolume = new Map<number, ChapterInfo[]>();

  for (const ch of chapters) {
    // chapterNumber is the canonical display number; `number` is a legacy
    // column that is NULL library-wide. Falling straight to `index` mismatched
    // files whenever index drifted from chapterNumber (index is ordinal —
    // e.g. a stub for chapter 200 parked at index 191 swallowed the c191
    // file, see project_chapter_index_semantics).
    const num = ch.chapterNumber ?? ch.number ?? ch.index;
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
  // Handle volume files - link to ALL chapters in that volume + create one
  // "volume-file" row (NULL chapterNumber) representing the whole-volume
  // archive itself, so the UI can render a single "1-N" compendium entry
  // alongside the per-chapter rows. Without this row the UI shows only the
  // numbered chapters and there's no unified compendium pointer (see
  // project_volume_file_row_model). When only one chapter is in the volume
  // there's no compendium to point at — skip the volume-file row in that case
  // since it would be indistinguishable from a regular chapter row.
  if (fileInfo.isVolumeFile) {
    const volumeChapters = linkVolumeFileToChapters(fileInfo, maps.byVolume);
    for (const ch of volumeChapters) {
      updates.push({ id: ch.id, fileName: fileInfo.fileName, filePath: fileInfo.file, size: fileInfo.size });
    }
    if (volumeChapters.length > 1) {
      creates.push({
        mangaId,
        fileName: fileInfo.fileName,
        filePath: fileInfo.file,
        fileFormat: normalizeFileFormat(fileInfo.fileName),
        // Place volume-file rows in a synthetic high-index range so they
        // don't collide with per-chapter rows. The dedup pass in
        // chapter-creator will bump if the chosen index is still taken.
        index: 100000 + ((fileInfo.volumeNumber ?? 0) * 100),
        title: '',
        size: fileInfo.size,
        downloadStatus: ChapterStatus.COMPLETED,
        volume: fileInfo.volumeNumber,
        // chapterNumber intentionally omitted — NULL is what marks this
        // as the volume-file row vs the per-chapter rows.
        updatedAt: new Date(),
      });
    }
    if (volumeChapters.length > 0) return;
  }

  // Handle chapter files - link to specific chapter
  const match = matchFileToChapter(fileInfo, maps);
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
    // chapterNumber is a SEPARATE column from `index` and is what the UI
    // reads to render numbered chapter slots. Omitting it leaves the row
    // with NULL chapterNumber, which produced the Kaiju vol 1 7-fold
    // "1-7" + missing-slot duplication (UI rendered 7 "found but
    // unmatched" rows plus 7 "expected but missing" slots).
    ...(fileInfo.chapterNumber !== null ? { chapterNumber: fileInfo.chapterNumber } : {}),
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
  updates: ChapterUpdate[],
  // Optional `creates` + `mangaId` so re-imports can also add a volume-file
  // row when one isn't already present. Bundled into one options arg to
  // stay under the max-params lint cap.
  volumeFileOptions?: { creates: ChapterCreate[]; mangaId: number },
): boolean {
  if (!fileInfo.isVolumeFile || fileInfo.volumeNumber === null) return false;

  const pendingChapters = maps.byVolume.get(fileInfo.volumeNumber);
  if (pendingChapters && pendingChapters.length > 0) return false;

  const completedChapters = completedByVolume.get(fileInfo.volumeNumber);
  if (!completedChapters || completedChapters.length === 0) return false;

  for (const ch of completedChapters) {
    updates.push({ id: ch.id, fileName: fileInfo.fileName, filePath: fileInfo.file, size: fileInfo.size });
  }
  if (volumeFileOptions && completedChapters.length > 1) {
    volumeFileOptions.creates.push({
      mangaId: volumeFileOptions.mangaId,
      fileName: fileInfo.fileName,
      filePath: fileInfo.file,
      fileFormat: normalizeFileFormat(fileInfo.fileName),
      index: 100000 + (fileInfo.volumeNumber * 100),
      title: '',
      size: fileInfo.size,
      downloadStatus: ChapterStatus.COMPLETED,
      volume: fileInfo.volumeNumber,
      updatedAt: new Date(),
    });
  }
  completedByVolume.delete(fileInfo.volumeNumber);
  return true;
}
