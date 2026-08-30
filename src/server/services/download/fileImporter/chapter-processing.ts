/**
 * Chapter Processing Module
 *
 * Chapter creation and processing for the file importer service.
 * Handles creating chapter records from extracted archive files.
 */

/* eslint-disable no-await-in-loop */
// Note: ESLint rule disabled as sequential file processing is required for data integrity.

import * as fs from 'fs/promises';
import * as path from 'path';


import { DownloadStatus } from '@prisma/client';

import { getGlobalConfigService } from '@/server/services/config/globalConfigService';
import { getConversionService } from '@/server/services/conversion';
import { normalizeFileFormat } from '@/server/services/conversion/format-normalization';
import type { FileOrganizationConfig } from '@/server/services/fileOrganization/configService';
import { isSuccess } from '@/utils/async-result';
import { extractChapterNumber, extractVolumeNumber } from '@/utils/file-utils';
import { logger } from '@/utils/logger';
import { MangaFileParser } from '@/utils/parsers/mangaFileParser';


import { shouldConvertFile } from './conversion-operations';
import {
  FileOrganizationSettingsSchema,
  parseJsonSafely,
  loadFileOrganizationConfig,
  generateFileName,
} from './utils';

import type { PrismaClient } from '@prisma/client';

/**
 * Create a conversion job for an imported file
 *
 * @param mangaId - Manga ID
 * @param chapterId - Chapter ID
 * @param sourceFile - Source file path
 * @param sourceFormat - Source format
 * @param targetFormat - Target format
 */
async function createConversionJob(
  mangaId: number,
  chapterId: number,
  sourceFile: string,
  sourceFormat: string,
  targetFormat: string
): Promise<void> {
  try {
    const conversionService = getConversionService();

    // Generate target file path (same location, different extension)
    const targetFile = sourceFile.replace(
      path.extname(sourceFile),
      `.${targetFormat}`
    );

    logger.info(`[FileImporter] Creating conversion job: ${path.basename(sourceFile)} -> ${path.basename(targetFile)}`);

    type ConversionFormat = 'cbz' | 'cbr' | 'pdf' | 'epub';
    const jobResult = await conversionService.createConversionJob({
      mangaId,
      chapterId,
      sourceFile,
      targetFile,
      sourceFormat: sourceFormat as ConversionFormat,
      targetFormat: targetFormat as ConversionFormat,
      priority: 5, // Default priority
      maxAttempts: 3
    });

    if (isSuccess(jobResult)) {
      logger.info(`[FileImporter] Created conversion job ${jobResult.data} for chapter ${chapterId}`);
    } else {
      if (jobResult.status !== 'error') {
        logger.error(`[FileImporter] Failed to create conversion job: Unexpected status`);
      } else {
        logger.error(`[FileImporter] Failed to create conversion job:`, jobResult.error);
      }
    }
  } catch (error: unknown) {
    logger.error('[FileImporter] Error creating conversion job:', error);
  }
}

/**
 * Resolve destination file path, creating volume folder if configured
 *
 * @param destDir - Base destination directory
 * @param fileName - File name
 * @param volumeNumber - Volume number (if known)
 * @param mangaTitle - Manga title
 * @returns Destination file path
 */
async function resolveDestFilePath(
  destDir: string,
  fileName: string,
  volumeNumber: number | null,
  mangaTitle: string
): Promise<string> {
  const chaptersDir = path.join(destDir, 'Chapters');

  if (volumeNumber === null) {
    await fs.mkdir(chaptersDir, { recursive: true });
    return path.join(chaptersDir, fileName);
  }

  try {
    const configService = getGlobalConfigService();
    const fileOrgSettings = await configService.get('fileOrganization');
    if (!fileOrgSettings) {
      await fs.mkdir(chaptersDir, { recursive: true });
      return path.join(chaptersDir, fileName);
    }

    const rawSettings = parseJsonSafely(fileOrgSettings);
    const settingsParse = FileOrganizationSettingsSchema.safeParse(rawSettings);
    if (!settingsParse.success || !settingsParse.data.createVolumeFolders) {
      await fs.mkdir(chaptersDir, { recursive: true });
      return path.join(chaptersDir, fileName);
    }

    const volumeFolder = `${mangaTitle} Vol ${volumeNumber}`;
    const volumeDirPath = path.join(destDir, 'Volumes', volumeFolder);
    await fs.mkdir(volumeDirPath, { recursive: true });
    logger.debug(`[FileImporter] Created/verified volume directory: ${volumeDirPath}`);
    return path.join(volumeDirPath, fileName);
  } catch (error) {
    logger.warn(`[FileImporter] Failed to create volume folder, using default path:`, error);
    await fs.mkdir(chaptersDir, { recursive: true });
    return path.join(chaptersDir, fileName);
  }
}

/** Shared state for one PACK import run. */
interface PackImportContext {
  mangaId: number;
  destDir: string;
  mangaTitle: string;
  fileOrgConfig: FileOrganizationConfig;
  prismaClient: PrismaClient;
  /** Chapter numbers already present in the DB or created earlier in this run. */
  seenChapterNumbers: Set<number>;
}

type PackFileOutcome =
  | { status: 'created'; chapterId: number }
  | { status: 'duplicate' }
  | { status: 'failed' };

/**
 * Conflict-safe insert of one chapter row. `skipDuplicates` maps to
 * INSERT ... ON CONFLICT DO NOTHING, so a duplicate on the partial unique
 * index `Chapter_mangaId_chapterNumber_unique` (or `(mangaId, index)`) is a
 * silent skip instead of a unique-violation error in the Postgres log.
 * Returns the created row id, or null when the insert was skipped.
 */
async function insertPackChapterRow(
  ctx: PackImportContext,
  row: {
    index: number;
    title: string;
    chapterNumber: number;
    volume: number | null;
    destFile: string;
    fileName: string;
    size: number;
  }
): Promise<number | null> {
  const createResult = await ctx.prismaClient.chapter.createMany({
    data: [{
      mangaId: ctx.mangaId,
      index: row.index,
      title: row.title,
      chapterNumber: row.chapterNumber,
      volume: row.volume,
      filePath: row.destFile,
      fileName: row.fileName,
      downloadStatus: DownloadStatus.COMPLETED,
      size: Math.floor(row.size),
      fileFormat: normalizeFileFormat(row.fileName),
      releaseDate: new Date(),
      language: 'en',
      updatedAt: new Date()
    }],
    skipDuplicates: true
  });

  if (createResult.count === 0) return null;

  const createdRow = await ctx.prismaClient.chapter.findUnique({
    where: { mangaId_index: { mangaId: ctx.mangaId, index: row.index } },
    select: { id: true }
  });
  return createdRow?.id ?? null;
}

/** Queue a format-conversion job for the imported file when configured. */
async function maybeQueueConversion(
  mangaId: number,
  chapterId: number,
  destFile: string,
  fileName: string
): Promise<void> {
  const fileExtension = path.extname(fileName).slice(1).toLowerCase();
  const conversionCheck = await shouldConvertFile(fileExtension);
  if (conversionCheck.shouldConvert && conversionCheck.targetFormat) {
    await createConversionJob(mangaId, chapterId, destFile, fileExtension, conversionCheck.targetFormat);
  }
}

/**
 * Import a single PACK file: dedup check, conflict-safe row insert, then the
 * library file copy (in that order — the copy happens only AFTER a successful
 * row create so duplicates/failures never leave orphaned files in the library;
 * a failed copy rolls the row back).
 */
async function importSinglePackFile(
  ctx: PackImportContext,
  sourceFile: string,
  nextIndex: number
): Promise<PackFileOutcome> {
  const originalFileName = path.basename(sourceFile);

  // Parse filename to extract chapter/volume info
  const parsed = MangaFileParser.parse(originalFileName);
  const chapterNumber = parsed.chapter ?? extractChapterNumber(originalFileName);
  const volumeNumber = parsed.volume ?? extractVolumeNumber(originalFileName);
  const resolvedChapterNumber = chapterNumber ?? nextIndex;

  // Skip duplicates (already in DB from a prior import, or a second file in
  // this pack resolving to the same chapter number) without touching the DB.
  if (ctx.seenChapterNumbers.has(resolvedChapterNumber)) {
    logger.debug(`[FileImporter] Skipping duplicate chapter ${resolvedChapterNumber} (${originalFileName})`, {
      mangaId: ctx.mangaId,
      chapterNumber: resolvedChapterNumber
    });
    return { status: 'duplicate' };
  }

  // Apply file naming template if configured
  const fileName = generateFileName(originalFileName, ctx.mangaTitle, chapterNumber, volumeNumber, ctx.fileOrgConfig);
  if (fileName !== originalFileName) {
    logger.info(`[FileImporter] Renamed: ${originalFileName} -> ${fileName}`);
  }

  // Resolve destination path (with volume folder if configured)
  const destFile = await resolveDestFilePath(ctx.destDir, fileName, volumeNumber, ctx.mangaTitle);

  // Size comes from the source file — the library copy hasn't happened yet.
  const stats = await fs.stat(sourceFile);

  const chapterTitle = parsed.title !== '' ? parsed.title : `Chapter ${resolvedChapterNumber}`;
  let chapterId: number | null;
  try {
    chapterId = await insertPackChapterRow(ctx, {
      index: nextIndex,
      title: chapterTitle,
      chapterNumber: resolvedChapterNumber,
      volume: volumeNumber,
      destFile,
      fileName,
      size: stats.size
    });
  } catch (error) {
    logger.error(`[FileImporter] Failed to create chapter for ${fileName}:`, error);
    return { status: 'failed' };
  }

  ctx.seenChapterNumbers.add(resolvedChapterNumber);

  if (chapterId === null) {
    // Lost a race: another writer inserted this chapter between our pre-load
    // and the insert. Nothing was copied yet, so just move on.
    logger.debug(`[FileImporter] Chapter ${resolvedChapterNumber} already exists (conflict skip)`, {
      mangaId: ctx.mangaId,
      chapterNumber: resolvedChapterNumber
    });
    return { status: 'duplicate' };
  }

  // Copy the file into the library AFTER the row exists; if the copy fails,
  // roll the row back so we never keep a COMPLETED chapter without a file.
  try {
    await fs.copyFile(sourceFile, destFile);
    logger.debug(`[FileImporter] Copied ${fileName} to ${destFile}`);
  } catch (error) {
    logger.error(`[FileImporter] Failed to copy ${fileName}, rolling back chapter row:`, error);
    try {
      await ctx.prismaClient.chapter.deleteMany({ where: { id: chapterId } });
      ctx.seenChapterNumbers.delete(resolvedChapterNumber);
    } catch (rollbackError) {
      logger.error(`[FileImporter] Failed to roll back chapter ${chapterId}:`, rollbackError);
    }
    return { status: 'failed' };
  }

  logger.info(`[FileImporter] Created chapter ${chapterId}: ${chapterTitle}`);
  await maybeQueueConversion(ctx.mangaId, chapterId, destFile, fileName);
  return { status: 'created', chapterId };
}

/**
 * Create chapter records from extracted files (PACK mode)
 *
 * @param files - Array of file paths to create chapters from
 * @param mangaId - Manga ID
 * @param destDir - Destination directory in library
 * @param prismaClient - Prisma client instance
 * @returns Array of created chapter IDs
 */
export async function createChaptersFromFiles(
  files: string[],
  mangaId: number,
  destDir: string,
  prismaClient: PrismaClient
): Promise<number[]> {
  logger.info(`[FileImporter] Creating ${files.length} chapter records for PACK download`);

  const createdChapterIds: number[] = [];

  // Load file organization config and manga title once before the loop
  const fileOrgConfig = await loadFileOrganizationConfig();
  const manga = await prismaClient.manga.findUnique({
    where: { id: mangaId },
    select: { title: true }
  });
  const mangaTitle = manga?.title ?? 'Unknown';

  // Sort files by chapter number for consistent ordering
  const sortedFiles = files.sort((a, b) => {
    const aNum = extractChapterNumber(path.basename(a)) ?? 0;
    const bNum = extractChapterNumber(path.basename(b)) ?? 0;
    return aNum - bNum;
  });

  // Get the highest existing chapter index for this manga
  const highestChapter = await prismaClient.chapter.findFirst({
    where: { mangaId },
    orderBy: { index: 'desc' },
    select: { index: true }
  });

  let nextIndex = (highestChapter?.index ?? 0) + 1;

  // Pre-load existing chapter numbers so re-imports of the same pack are
  // skipped BEFORE any file copy or DB write. The partial unique index
  // `Chapter_mangaId_chapterNumber_unique` (WHERE chapterNumber IS NOT NULL)
  // rejects duplicates at the DB level; without this guard every re-import
  // hammered Postgres with unique-violation errors.
  const existingRows = await prismaClient.chapter.findMany({
    where: { mangaId, chapterNumber: { not: null } },
    select: { chapterNumber: true }
  });
  const seenChapterNumbers = new Set<number>();
  for (const row of existingRows) {
    if (row.chapterNumber !== null) seenChapterNumbers.add(row.chapterNumber);
  }

  const ctx: PackImportContext = {
    mangaId,
    destDir,
    mangaTitle,
    fileOrgConfig,
    prismaClient,
    seenChapterNumbers
  };

  let skippedDuplicates = 0;
  for (const sourceFile of sortedFiles) {
    const outcome = await importSinglePackFile(ctx, sourceFile, nextIndex);
    if (outcome.status === 'created') {
      createdChapterIds.push(outcome.chapterId);
      nextIndex++;
    } else if (outcome.status === 'duplicate') {
      skippedDuplicates++;
    }
  }

  if (createdChapterIds.length + skippedDuplicates < sortedFiles.length) {
    logger.warn(`[FileImporter] Some chapters failed to create from PACK`, {
      expected: sortedFiles.length,
      created: createdChapterIds.length,
      skippedDuplicates,
      mangaId
    });
  } else if (skippedDuplicates > 0) {
    logger.info(`[FileImporter] Skipped ${skippedDuplicates} duplicate chapters from PACK`, { mangaId });
  }

  logger.info(`[FileImporter] Created ${createdChapterIds.length} chapters from PACK`);

  return createdChapterIds;
}

// Re-export conversion functions for use by other modules
export { shouldConvertFile, createConversionJob };
