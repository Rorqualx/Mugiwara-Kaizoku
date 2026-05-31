/**
 * Chapter Creator Module
 *
 * Handles creation of chapter database entries from manga files.
 * Extracted from scanner.ts createChaptersFromFiles method (lines 506-569)
 *
 * IMPROVEMENT: Batches file size checks to avoid await-in-loop violation.
 */

import * as path from 'path';


import { ChapterStatus } from '@prisma/client';

import { prisma } from '@/server/db';
import { normalizeFileFormat } from '@/server/services/conversion/format-normalization';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { extractChapterNumber, extractVolumeNumber, getFileSizeBytes, countArchivePages } from '@/utils/file-utils';
import { logger } from '@/utils/logger';
import { MangaFileParser } from '@/utils/parsers/mangaFileParser';


// Import functions from submodules
import {
  parseFileInfo,
  buildChapterMaps,
  processFileForLinking,
  tryLinkVolumeToCompletedChapters
} from './chapter-creator/auto-matcher';
import {
  upsertChapterFilesBatch,
  resolveAndStoreVolumeBoundaries,
  type ChapterFileInput,
} from './chapter-creator/chapter-file-service';
import { executeChapterUpdates, deleteOrphanedVolumeChapters } from './chapter-creator/update-helpers';
import { isVolumeMappingOnly, processFileWithUserMapping } from './chapter-creator/user-mapping-matcher';

// Re-export types from submodule for external use
export type {
  ChapterMappingForImport,
  ParsedFileInfo,
  LinkFilesResult,
  ChapterInfo,
  ChapterUpdate,
  ChapterCreate,
  ChapterFileCreate
} from './chapter-creator/types';

// Import types for internal use
import type { ChapterMappingForImport, LinkFilesResult, ChapterUpdate, ChapterCreate } from './chapter-creator/types';

/**
 * Create chapter entries from a list of files
 *
 * Parses chapter numbers, volumes, and file sizes, then bulk creates chapters.
 * Uses batched file size checks to avoid performance issues.
 * If user-provided mappings are available, those take precedence over filename parsing.
 *
 * @param mangaId - ID of the manga these chapters belong to
 * @param files - List of chapter file paths
 * @param parseFileNames - Whether to parse file names for metadata
 * @param userMappings - Optional user-provided volume/chapter mappings from import pipeline
 */
// eslint-disable-next-line complexity, max-statements -- File parsing with filename extraction and user mapping resolution
export async function createChaptersFromFileList(
  mangaId: number,
  files: string[],
  parseFileNames: boolean,
  userMappings?: ChapterMappingForImport[]
): Promise<void> {
  // Batch get all file sizes and page counts to avoid await-in-loop
  const fileSizeMap = new Map<string, number>();
  const pageCountMap = new Map<string, number>();
  await Promise.all(
    files.map(async (file) => {
      const [size, pages] = await Promise.all([
        getFileSizeBytes(file),
        countArchivePages(file),
      ]);
      fileSizeMap.set(file, size);
      if (pages > 0) pageCountMap.set(file, pages);
    })
  );

  // Build mapping lookup by filename for O(1) access
  const mappingByFilename = new Map<string, ChapterMappingForImport>();
  if (userMappings && userMappings.length > 0) {
    for (const m of userMappings) {
      mappingByFilename.set(path.basename(m.filePath), m);
    }
    logger.debug('Using user-provided chapter mappings', { mappingCount: userMappings.length });
  }

  const chapters = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file === undefined) continue;

    const fileName = path.basename(file);
    let chapterNumber = i + 1;
    let volumeNumber: number | null = null;
    let chapterTitle = `Chapter ${chapterNumber}`;
    let pageCount: number | null = null;

    // Metadata fields from user mapping
    let coverImage: string | null = null;
    let description: string | null = null;
    let releaseDate: Date | null = null;
    let chapterNum: number | null = null;

    // Check for user-provided mapping first (takes priority)
    const userMapping = mappingByFilename.get(fileName);

    // Volume mapping with chapter ranges: expand into one chapter per chapter in the range
    // This ensures volume files (e.g., "TR Vol 5.cbz") create chapters for the entire volume
    // (e.g., Ch 37-45) instead of a single sequential chapter
    if (userMapping && isVolumeMappingOnly(userMapping) &&
        userMapping.chapterRangeStart !== undefined && userMapping.chapterRangeEnd !== undefined) {
      const vol = userMapping.volumeNumber ?? null;
      const fileSize = fileSizeMap.get(file) ?? 0;

      const fileFormat = normalizeFileFormat(fileName);
      for (let chNum = userMapping.chapterRangeStart; chNum <= userMapping.chapterRangeEnd; chNum++) {
        const chTitle = userMapping.title
          ? `${userMapping.title} - Chapter ${chNum}`
          : (vol !== null ? `Vol.${vol} Chapter ${chNum}` : `Chapter ${chNum}`);
        chapters.push({
          mangaId,
          fileName,
          filePath: file,
          fileFormat,
          index: chNum,
          title: chTitle,
          size: fileSize,
          downloadStatus: ChapterStatus.COMPLETED,
          volume: vol,
          pageCount: null,
          updatedAt: new Date(),
          coverImage: userMapping.coverImage ?? null,
          description: null,
          releaseDate: userMapping.releaseDate ? new Date(userMapping.releaseDate) : null,
          chapterNumber: chNum,
        });
      }

      logger.debug('Expanded volume file into chapter range', {
        file: fileName, volume: vol,
        rangeStart: userMapping.chapterRangeStart, rangeEnd: userMapping.chapterRangeEnd,
        chaptersCreated: userMapping.chapterRangeEnd - userMapping.chapterRangeStart + 1
      });
      continue;
    }

    if (userMapping && (userMapping.chapterNumber !== undefined || userMapping.volumeNumber !== undefined)) {
      // Use user-provided mapping data
      chapterNumber = userMapping.chapterNumber ?? i + 1;
      volumeNumber = userMapping.volumeNumber ?? null;
      chapterTitle = userMapping.title ?? `Chapter ${chapterNumber}`;
      pageCount = userMapping.pageCount ?? null;

      // Store additional metadata from mapping
      coverImage = userMapping.coverImage ?? null;
      description = userMapping.description ?? null;
      chapterNum = userMapping.chapterNumber ?? null;
      if (userMapping.releaseDate) {
        releaseDate = new Date(userMapping.releaseDate);
      }

      // Format title with volume if present
      if (volumeNumber !== null && !chapterTitle.includes('Vol.')) {
        chapterTitle = `Vol.${volumeNumber} ${chapterTitle}`;
      }
    } else if (parseFileNames) {
      // Fall back to filename parsing
      const parsed = MangaFileParser.parse(fileName);

      if (parsed.chapter !== undefined) {
        chapterNumber = parsed.chapter;
        // chapterNum (→ Chapter.chapterNumber column) is a SEPARATE variable
        // from chapterNumber (→ Chapter.index column). Without this assignment
        // the parsed number lands only on index and the column stays NULL,
        // which produced the Kaiju vol 1 7-fold "1-7"+missing-slot duplication
        // bug (rows had index + volume but NULL chapterNumber, so the UI
        // rendered 7 "found but unmatched" rows + 7 "expected" missing slots).
        chapterNum = parsed.chapter;
        chapterTitle = `Chapter ${chapterNumber}`;
      }

      if (parsed.volume !== undefined) {
        volumeNumber = parsed.volume;
        chapterTitle = `Vol.${volumeNumber} ${chapterTitle}`;
      }

      // Use parsed title if different from manga title
      if (parsed.cleanTitle && parsed.cleanTitle !== parsed.title) {
        chapterTitle += ` - ${parsed.title}`;
      }
    } else {
      // Try basic extraction
      const extractedChapter = extractChapterNumber(fileName);
      const extractedVolume = extractVolumeNumber(fileName);

      if (extractedChapter !== null) {
        chapterNumber = extractedChapter;
        chapterNum = extractedChapter; // see note above — chapterNum is a separate column
        chapterTitle = `Chapter ${chapterNumber}`;
      }

      if (extractedVolume !== null) {
        volumeNumber = extractedVolume;
        chapterTitle = `Vol.${volumeNumber} ${chapterTitle}`;
      }
    }

    // Get file size and page count from pre-fetched maps (no await in loop)
    const size = fileSizeMap.get(file) ?? 0;
    pageCount ??= pageCountMap.get(file) ?? null;

    chapters.push({
      mangaId,
      fileName,
      filePath: file,
      fileFormat: normalizeFileFormat(fileName),
      index: chapterNumber,
      title: chapterTitle,
      size,
      downloadStatus: ChapterStatus.COMPLETED,
      volume: volumeNumber,
      pageCount,
      updatedAt: new Date(),
      // Additional metadata from import mapping
      coverImage,
      description,
      releaseDate,
      chapterNumber: chapterNum
    });
  }

  // Sort chapters by volume and index
  chapters.sort((a, b) => {
    if (a.volume !== b.volume) {
      return (a.volume ?? 0) - (b.volume ?? 0);
    }
    return a.index - b.index;
  });

  // Query existing chapter indices from DB to avoid @@unique([mangaId, index]) violations
  const existingChapters = await prisma.chapter.findMany({
    where: { mangaId },
    select: { index: true }
  });
  const usedIndices = new Set<number>(existingChapters.map((c) => c.index));

  // Deduplicate indices - assign unique sequential indices to avoid constraint violations
  for (const chapter of chapters) {
    if (usedIndices.has(chapter.index)) {
      // Find next available index
      let newIndex = chapter.index + 1;
      while (usedIndices.has(newIndex)) {
        newIndex++;
      }
      chapter.index = newIndex;
    }
    usedIndices.add(chapter.index);
  }

  // Bulk create chapters (skipDuplicates as safety net for race conditions)
  const result = await prisma.chapter.createMany({
    data: chapters,
    skipDuplicates: true
  });

  if (result.count < chapters.length) {
    logger.warn('Some chapters were skipped during creation (possible index collision)', {
      mangaId,
      expected: chapters.length,
      created: result.count
    });
  }

  // Create ChapterFile entries for the newly created chapters
  if (chapters.length > 0) {
    // Fetch the created chapters to get their IDs
    const createdChapters = await prisma.chapter.findMany({
      where: { mangaId },
      select: { id: true, index: true, filePath: true, fileName: true, size: true }
    });

    // Build a map of index → chapter for matching
    const chapterByIndex = new Map(createdChapters.map((c) => [c.index, c]));

    // Track which filePaths appear in multiple chapters (volume files)
    const filePathCounts = new Map<string, number>();
    for (const ch of chapters) {
      const count = filePathCounts.get(ch.filePath) ?? 0;
      filePathCounts.set(ch.filePath, count + 1);
    }

    const chapterFileInputs: ChapterFileInput[] = [];
    for (const ch of chapters) {
      const created = chapterByIndex.get(ch.index);
      if (!created?.filePath) continue;

      const isVolumeSource = (filePathCounts.get(ch.filePath) ?? 0) > 1;
      chapterFileInputs.push({
        chapterId: created.id,
        filePath: created.filePath,
        fileName: created.fileName,
        fileSize: created.size,
        sourceType: isVolumeSource ? 'volume' : 'chapter',
      });
    }

    if (chapterFileInputs.length > 0) {
      await upsertChapterFilesBatch(chapterFileInputs);
      logger.debug('Created ChapterFile entries for new chapters', {
        mangaId,
        count: chapterFileInputs.length
      });

      // For each volume-source file (one filePath shared by ≥2 chapter rows),
      // validate page count and persist per-chapter page boundaries so the
      // reader can jump inside the volume CBZ.
      const volumeFilePaths = [...filePathCounts.entries()]
        .filter(([, count]) => count > 1)
        .map(([fp]) => fp);
      for (const volPath of volumeFilePaths) {
        const actualPages = pageCountMap.get(volPath);
        if (actualPages === undefined || actualPages <= 0) continue;
        const volChapters = chapters
          .filter((ch) => ch.filePath === volPath)
          .map((ch) => {
            const created = chapterByIndex.get(ch.index);
            return created ? {
              id: created.id,
              chapterNumber: ch.chapterNumber ?? ch.index,
              ...(ch.pageCount !== null ? { pageCount: ch.pageCount } : {}),
              ...(ch.title ? { title: ch.title } : {}),
            } : null;
          })
          .filter((c): c is { id: number; chapterNumber: number; pageCount?: number; title?: string } => c !== null);
        // eslint-disable-next-line no-await-in-loop -- sequential per-volume; typical count < 10
        await resolveAndStoreVolumeBoundaries(volPath, actualPages, volChapters);
      }
    }
  }

  // Emit WebSocket event for real-time UI sync (batch creation)
  if (chapters.length > 0) {
    void realtimeEmitter.emitChapterUpdate({
      chapterId: 0, // Batch indicator - no single chapter ID
      mangaId,
      action: 'created',
      data: {
        chaptersCreated: chapters.length,
        source: 'library-scan'
      }
    });
  }
}

/**
 * Link files to existing chapters for a manga
 *
 * For volume files (e.g., "v01.cbz"), links to ALL chapters in that volume.
 * For chapter files (e.g., "ch001.cbz"), links to the specific chapter.
 * On re-import: Deletes previous "Volume X" chapters and updates existing chapters.
 *
 * When userMappings are provided (from import wizard), they take priority over
 * filename-based auto-matching.
 *
 * @param mangaId - ID of the manga to link files to
 * @param files - List of file paths to link
 * @param userMappings - Optional user-provided volume/chapter mappings from import pipeline
 */
// eslint-disable-next-line complexity, max-statements -- File linking with ChapterFile creation requires sequential steps
export async function linkFilesToExistingChapters(
  mangaId: number,
  files: string[],
  userMappings?: ChapterMappingForImport[]
): Promise<LinkFilesResult> {
  if (files.length === 0) return { linked: 0, created: 0 };

  logger.info('Linking files to existing chapters', { mangaId, fileCount: files.length, hasMappings: !!userMappings });

  // Delete orphaned "Volume X" chapters from previous imports
  await deleteOrphanedVolumeChapters(mangaId);

  // Get ALL chapters so we can update them with new file paths
  const allChapters = await prisma.chapter.findMany({
    where: { mangaId },
    select: { id: true, number: true, index: true, volume: true, downloadStatus: true }
  });

  // Build maps: pending for linking, completed by volume for re-import updates
  const pendingChapters = allChapters.filter((c) => c.downloadStatus !== ChapterStatus.COMPLETED);
  const completedByVolume = new Map<number, Array<{ id: number }>>();
  for (const ch of allChapters) {
    if (ch.volume === null) continue;
    const volume = ch.volume;
    const arr = completedByVolume.get(volume) ?? [];
    arr.push({ id: ch.id });
    completedByVolume.set(volume, arr);
  }

  const maps = buildChapterMaps(pendingChapters);
  const usedIndices = new Set(allChapters.map((c) => c.index));

  // Batch get file sizes
  const fileSizeMap = new Map<string, number>();
  await Promise.all(files.map(async (f) => fileSizeMap.set(f, await getFileSizeBytes(f))));

  // Build user mapping lookup by filename for O(1) access
  const userMappingByFilename = new Map<string, ChapterMappingForImport>();
  if (userMappings && userMappings.length > 0) {
    for (const m of userMappings) {
      userMappingByFilename.set(path.basename(m.filePath), m);
    }
    logger.info('Using user-provided mappings for file linking', { mappingCount: userMappings.length });
  }

  // Track which chapters have been matched (for user mapping mode)
  const matchedChapterIds = new Set<number>();

  const updates: ChapterUpdate[] = [];
  const creates: ChapterCreate[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;
    const fileInfo = parseFileInfo(file, i, fileSizeMap);

    // Try user mapping first (highest priority)
    const userMapping = userMappingByFilename.get(fileInfo.fileName);
    if (userMapping) {
      const linked = processFileWithUserMapping(file, fileInfo, userMapping, allChapters, matchedChapterIds, updates);
      if (linked) continue; // Successfully linked via user mapping
    }

    // Fall back to auto-matching (filename-based)
    if (!tryLinkVolumeToCompletedChapters(fileInfo, maps, completedByVolume, updates, { creates, mangaId })) {
      processFileForLinking(fileInfo, mangaId, maps, updates, creates);
    }
  }

  // Deduplicate indices for new chapters
  for (const chapter of creates) {
    while (usedIndices.has(chapter.index)) chapter.index++;
    usedIndices.add(chapter.index);
  }

  await executeChapterUpdates(updates, mangaId);
  if (creates.length > 0) {
    await prisma.chapter.createMany({ data: creates, skipDuplicates: true });

    // Create ChapterFile entries for newly created chapters
    const newChapters = await prisma.chapter.findMany({
      where: {
        mangaId,
        index: { in: creates.map((c) => c.index) }
      },
      select: { id: true, index: true, filePath: true, fileName: true, size: true }
    });

    const newByIndex = new Map(newChapters.map((c) => [c.index, c]));
    const newFileInputs: ChapterFileInput[] = [];

    for (const create of creates) {
      const ch = newByIndex.get(create.index);
      if (!ch?.filePath) continue;

      newFileInputs.push({
        chapterId: ch.id,
        filePath: ch.filePath,
        fileName: ch.fileName,
        fileSize: ch.size,
        sourceType: 'chapter',
      });
    }

    if (newFileInputs.length > 0) {
      await upsertChapterFilesBatch(newFileInputs);
    }
  }

  // Emit event
  if (updates.length > 0 || creates.length > 0) {
    void realtimeEmitter.emitChapterUpdate({
      chapterId: 0,
      mangaId,
      action: 'updated',
      data: { linked: updates.length, created: creates.length, source: 'import-pipeline' }
    });
  }

  logger.info('File linking complete', { mangaId, linked: updates.length, created: creates.length });
  return { linked: updates.length, created: creates.length };
}
