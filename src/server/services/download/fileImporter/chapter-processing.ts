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

  for (const sourceFile of sortedFiles) {
    const originalFileName = path.basename(sourceFile);

    // Parse filename to extract chapter/volume info
    const parsed = MangaFileParser.parse(originalFileName);
    const chapterNumber = parsed.chapter ?? extractChapterNumber(originalFileName);
    const volumeNumber = parsed.volume ?? extractVolumeNumber(originalFileName);

    // Apply file naming template if configured
    const fileName = generateFileName(originalFileName, mangaTitle, chapterNumber, volumeNumber, fileOrgConfig);
    if (fileName !== originalFileName) {
      logger.info(`[FileImporter] Renamed: ${originalFileName} -> ${fileName}`);
    }

    // Resolve destination path (with volume folder if configured)
    const destFile = await resolveDestFilePath(destDir, fileName, volumeNumber, mangaTitle);

    // Copy file to library
    try {
      await fs.copyFile(sourceFile, destFile);
      logger.debug(`[FileImporter] Copied ${fileName} to ${destFile}`);
    } catch (error) {
      logger.error(`[FileImporter] Failed to copy ${fileName}:`, error);
      continue; // Skip this file but continue with others
    }

    // Get file size
    const stats = await fs.stat(destFile);
    const size = stats.size;

    // Create chapter record
    try {
      const chapter = await prismaClient.chapter.create({
        data: {
          mangaId,
          index: nextIndex,
          title: parsed.title || `Chapter ${chapterNumber ?? nextIndex}`,
          chapterNumber: chapterNumber ?? nextIndex,
          volume: volumeNumber,
          filePath: destFile,
          fileName,
          downloadStatus: DownloadStatus.COMPLETED,
          size: Math.floor(size),
          fileFormat: normalizeFileFormat(fileName),
          releaseDate: new Date(),
          language: 'en',
          updatedAt: new Date()
        }
      });

      createdChapterIds.push(chapter.id);
      logger.info(`[FileImporter] Created chapter ${chapter.id}: ${chapter.title}`);

      // Check if format conversion is needed
      const fileExtension = path.extname(fileName).slice(1).toLowerCase();
      const conversionCheck = await shouldConvertFile(fileExtension);

      if (conversionCheck.shouldConvert && conversionCheck.targetFormat) {
        await createConversionJob(
          mangaId,
          chapter.id,
          destFile,
          fileExtension,
          conversionCheck.targetFormat
        );
      }

      nextIndex++;
    } catch (error) {
      logger.error(`[FileImporter] Failed to create chapter for ${fileName}:`, error);
    }
  }

  if (createdChapterIds.length < sortedFiles.length) {
    logger.warn(`[FileImporter] Some chapters failed to create from PACK`, {
      expected: sortedFiles.length,
      created: createdChapterIds.length,
      mangaId
    });
  }

  logger.info(`[FileImporter] Created ${createdChapterIds.length} chapters from PACK`);

  return createdChapterIds;
}

// Re-export conversion functions for use by other modules
export { shouldConvertFile, createConversionJob };
