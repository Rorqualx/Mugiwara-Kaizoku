/**
 * File Operations Module
 *
 * File system operations for the file importer service.
 * Handles finding, copying, and importing manga files.
 */

/* eslint-disable max-depth, complexity, max-statements, no-await-in-loop */
// Note: ESLint rules disabled for this file due to the complex volume splitting logic
// which requires deep nesting and sequential file processing for data integrity.

import * as fs from 'fs/promises';
import * as path from 'path';



import { DownloadStatus } from '@prisma/client';

import { prisma } from '@/server/db';
import { getGlobalConfigService } from '@/server/services/config/globalConfigService';
import { normalizeFileFormat } from '@/server/services/conversion/format-normalization';
import { isSuccess } from '@/utils/async-result';
import { extractChapterNumber, extractVolumeNumber } from '@/utils/file-utils';
import { logger } from '@/utils/logger';
import { MangaFileParser } from '@/utils/parsers/mangaFileParser';


import { getVolumeSplitter } from '../volumeSplitter';

import { shouldConvertFile, createConversionJob } from './conversion-operations';
import { countPagesInArchive } from './page-counter';
import {
  FileOrganizationSettingsSchema,
  parseJsonSafely,
  getPathAccessibilityError as _getPathAccessibilityError,
  loadFileOrganizationConfig,
  generateFileName,
  type FileOrganizationSettings
} from './utils';

// Re-export for use by other modules
export { _getPathAccessibilityError as getPathAccessibilityError };

import type { PrismaClient } from '@prisma/client';

/**
 * Check if a path is accessible
 *
 * @param dirPath - Path to check
 * @returns True if accessible, false otherwise
 */
export async function isPathAccessible(dirPath: string): Promise<boolean> {
  try {
    await fs.access(dirPath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find manga files in a directory (CBZ, CBR, CBT, CB7, PDF, EPUB, MOBI, AZW3)
 *
 * @param dirPath - Directory to search
 * @returns Array of file paths
 */
export async function findMangaFiles(dirPath: string): Promise<string[]> {
  const mangaExtensions = ['.cbz', '.cbr', '.cbt', '.cb7', '.pdf', '.epub', '.zip', '.mobi', '.azw3'];
  const files: string[] = [];

  // Check path accessibility first
  if (!await isPathAccessible(dirPath)) {
    const errorMsg = _getPathAccessibilityError(dirPath);
    logger.error(`[FileImporter] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively search subdirectories
        const subFiles = await findMangaFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (mangaExtensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    logger.error(`[FileImporter] Error reading directory ${dirPath}:`, error);
    throw error;
  }

  return files;
}

/**
 * Find archive files (ZIP, CBZ, RAR, CBR) in a directory
 *
 * @param dirPath - Directory to search
 * @returns Array of archive file paths
 */
export async function findArchiveFiles(dirPath: string): Promise<string[]> {
  const archiveExtensions = ['.zip', '.cbz', '.rar', '.cbr', '.7z', '.cb7'];
  const files: string[] = [];

  // Check path accessibility first
  if (!await isPathAccessible(dirPath)) {
    const errorMsg = _getPathAccessibilityError(dirPath);
    logger.error(`[FileImporter] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively search subdirectories
        const subFiles = await findArchiveFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (archiveExtensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    logger.error(`[FileImporter] Error reading directory ${dirPath}:`, error);
    throw error;
  }

  return files;
}

/**
 * Import a single file
 *
 * @param sourceFile - Source file path
 * @param destDir - Destination directory
 * @param mangaId - Manga ID
 * @param chapterIds - Chapter IDs that are downloading
 * @param prismaClient - Prisma client instance (defaults to global prisma)
 * @returns Import result for this file
 */
export async function importFile(
  sourceFile: string,
  destDir: string,
  mangaId: number,
  chapterIds: number[],
  prismaClient: PrismaClient = prisma
): Promise<{
  fileName: string;
  filePath: string;
  chapterId?: number;
  chapterNumber?: number;
  size: number;
} | null> {
  const originalFileName = path.basename(sourceFile);

  logger.info(`[FileImporter] Importing file: ${originalFileName}`);

  // Parse filename to extract chapter/volume info
  const parsed = MangaFileParser.parse(originalFileName);
  const chapterNumber = parsed.chapter ?? extractChapterNumber(originalFileName);
  const volumeNumber = parsed.volume ?? extractVolumeNumber(originalFileName);

  // Load file organization config for renaming and volume folder logic
  const fileOrgConfig = await loadFileOrganizationConfig();

  // Apply file naming template if configured
  const manga = await prismaClient.manga.findUnique({
    where: { id: mangaId },
    select: { title: true }
  });
  const mangaTitle = manga?.title ?? 'Unknown';
  const fileName = generateFileName(originalFileName, mangaTitle, chapterNumber, volumeNumber, fileOrgConfig);
  if (fileName !== originalFileName) {
    logger.info(`[FileImporter] Renamed: ${originalFileName} -> ${fileName}`);
  }

  // Place files in standard subdirectories based on media management settings
  const chaptersSubdir = path.join(destDir, 'Chapters');
  let destFile = path.join(chaptersSubdir, fileName);
  await fs.mkdir(chaptersSubdir, { recursive: true });

  const configService = getGlobalConfigService();
  try {
    const fileOrgSettings = await configService.get('fileOrganization');
    if (fileOrgSettings) {
      const rawSettings = parseJsonSafely(fileOrgSettings);
      const settingsParse = FileOrganizationSettingsSchema.safeParse(rawSettings);
      if (settingsParse.success) {
        if (volumeNumber !== null && settingsParse.data.createVolumeFolders) {
          const volumeFolder = `${mangaTitle} Vol ${volumeNumber}`;
          const volumeDirPath = path.join(destDir, 'Volumes', volumeFolder);
          await fs.mkdir(volumeDirPath, { recursive: true });
          destFile = path.join(volumeDirPath, fileName);
        }
        // Chapter subfolder mode: volume-group (default), per-chapter, or flat
        const chMode = settingsParse.data.chapterFolderMode;
        if (chMode === 'volume-group' && volumeNumber !== null) {
          const volGroupDir = path.join(chaptersSubdir, `Vol ${String(volumeNumber).padStart(2, '0')}`);
          await fs.mkdir(volGroupDir, { recursive: true });
          destFile = path.join(volGroupDir, fileName);
        } else if (chMode === 'per-chapter' && chapterNumber !== null) {
          const chFolder = `${mangaTitle} Ch ${String(chapterNumber).padStart(3, '0')}`;
          const chDirPath = path.join(chaptersSubdir, chFolder);
          await fs.mkdir(chDirPath, { recursive: true });
          destFile = path.join(chDirPath, fileName);
        }
        // 'flat' → stays in chaptersSubdir (already set above)
      }
    }
  } catch (error) {
    logger.warn('[FileImporter] Failed to check folder settings, using default path:', error);
  }

  logger.debug(`[FileImporter] Parsed: chapter=${chapterNumber}, volume=${volumeNumber}`);

  // Get file organization settings to determine copy/move behavior.
  // fileMode is sourced from the canonical dotted key via loadFileOrganizationConfig()
  // (already loaded above as fileOrgConfig). The legacy JSON aggregate is parsed only
  // for fields that don't have a dotted-key equivalent (e.g. chapterFolderMode); any
  // fileMode embedded there is ignored because that key drifts when the UI updates
  // file.organization.fileMode without rewriting the aggregate.
  let fileSettings: FileOrganizationSettings = { organizeOnImport: true, fileMode: fileOrgConfig.fileMode, chapterFolderMode: 'volume-group' };
  try {
    const fileOrgSettingsRaw = await configService.get('fileOrganization');
    if (fileOrgSettingsRaw) {
      const rawSettings = parseJsonSafely(fileOrgSettingsRaw);
      const parsed = FileOrganizationSettingsSchema.safeParse(rawSettings);
      if (parsed.success) {
        fileSettings = { ...parsed.data, fileMode: fileOrgConfig.fileMode };
      }
    }
  } catch (error) {
    logger.warn(`[FileImporter] Failed to read file organization settings, using defaults:`, error);
  }

  // Determine final file path based on settings
  let finalFilePath: string;
  let size: number;

  // Defensive: keep_in_place only makes sense when the source is already inside the
  // manga library tree. SAB/NZB completions live in a transient staging dir; persisting
  // those paths gives us broken-link rows once SAB sweeps. Fall through to copy mode
  // when the source isn't already where we'd keep it.
  const sourceUnderLibrary = path.resolve(sourceFile).startsWith(path.resolve(destDir));
  let effectiveMode: 'keep_in_place' | 'move' | 'copy' = fileSettings.fileMode;
  if (effectiveMode === 'keep_in_place' && !sourceUnderLibrary) {
    logger.warn(`[FileImporter] keep_in_place requested but ${sourceFile} is outside ${destDir} — falling back to copy to avoid staging-path persistence`);
    effectiveMode = 'copy';
  }

  if (effectiveMode === 'keep_in_place') {
    // Keep file in original location - just reference it
    finalFilePath = sourceFile;
    const stats = await fs.stat(sourceFile);
    size = stats.size;
    logger.info(`[FileImporter] Keeping file in original location: ${sourceFile}`);
  } else {
    // Copy or move files to destination
    try {
      await fs.copyFile(sourceFile, destFile);
      finalFilePath = destFile;
      const stats = await fs.stat(destFile);
      size = stats.size;

      if (effectiveMode === 'move') {
        // Move mode: delete original after successful copy
        try {
          await fs.unlink(sourceFile);
          logger.info(`[FileImporter] Moved ${fileName} to ${destFile} (original deleted)`);
        } catch (unlinkError) {
          logger.warn(`[FileImporter] Copied file but failed to delete original: ${sourceFile}`, unlinkError);
          logger.info(`[FileImporter] Copied ${fileName} to ${destFile}`);
        }
      } else {
        // Copy mode: keep original
        logger.info(`[FileImporter] Copied ${fileName} to ${destFile}`);
      }
    } catch (error) {
      throw new Error(`Failed to copy file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Check if volume splitting is enabled and if this is a volume file
  if (volumeNumber !== null) {
    try {
      const fileOrgSettings = await configService.get('fileOrganization');
      if (fileOrgSettings) {
        // Use parseJsonSafely to fix no-unsafe-return error
        const rawSettings = parseJsonSafely(fileOrgSettings);

        const settingsParse = FileOrganizationSettingsSchema.safeParse(rawSettings);
        if (settingsParse.success) {
          const settings = settingsParse.data;
          if (settings.splitVolumeFiles) {
            const volumeSplitter = getVolumeSplitter();
            const isVolume = await volumeSplitter.isVolumeFile(finalFilePath);

            if (isVolume) {
              logger.info(`[FileImporter] Detected volume file: ${fileName}, initiating split`);

              // Split volume into chapters (mangaTitle already loaded above)
              {
                const splitResult = await volumeSplitter.splitVolume({
                  volumePath: finalFilePath,
                  outputDir: path.dirname(finalFilePath),
                  volumeNumber,
                  mangaTitle,
                  mangaId
                });

                if (isSuccess(splitResult)) {
                  const { createdFiles: chapters, averageConfidence: confidence, warnings } = splitResult.data;

                  logger.info(`[FileImporter] Volume split successful: ${chapters.length} chapters created (confidence: ${Math.round(confidence * 100)}%)`);

                  if (warnings.length > 0) {
                    warnings.forEach((warning: string) => logger.warn(`[FileImporter] Volume split warning: ${warning}`));
                  }

                  // Import each created chapter file
                  for (const chapterPath of chapters) {
                    const chapterFileName = path.basename(chapterPath);
                    logger.debug(`[FileImporter] Processing split chapter: ${chapterFileName}`);

                    // Extract chapter number from split file
                    const chapterNum = extractChapterNumber(chapterFileName);

                    if (chapterNum !== null) {
                      // Try to match to existing chapter in downloading state
                      const existingChapter = await prismaClient.chapter.findFirst({
                        where: {
                          mangaId,
                          id: { in: chapterIds },
                          downloadStatus: DownloadStatus.DOWNLOADING,
                          OR: [
                            { index: chapterNum },
                            { chapterNumber: chapterNum },
                            { number: chapterNum }
                          ]
                        }
                      });

                      if (existingChapter) {
                        // Get file size
                        const chapterStats = await fs.stat(chapterPath);

                        // iter-5: count pages on split chapter files too
                        const splitPageCount = await countPagesInArchive(chapterPath);
                        // Update existing chapter
                        await prismaClient.chapter.update({
                          where: { id: existingChapter.id },
                          data: {
                            filePath: chapterPath,
                            fileName: chapterFileName,
                            downloadStatus: DownloadStatus.COMPLETED,
                            size: Math.floor(chapterStats.size),
                            fileFormat: normalizeFileFormat(chapterFileName),
                            ...(splitPageCount > 0 && { pageCount: splitPageCount }),
                            volume: volumeNumber
                          }
                        });

                        logger.info(`[FileImporter] Updated chapter ${existingChapter.id} with split file ${chapterFileName}`);

                        // Check if format conversion is needed
                        const fileExtension = path.extname(chapterFileName).slice(1).toLowerCase();
                        const conversionCheck = await shouldConvertFile(fileExtension);

                        if (conversionCheck.shouldConvert && conversionCheck.targetFormat) {
                          await createConversionJob(
                            mangaId,
                            existingChapter.id,
                            chapterPath,
                            fileExtension,
                            conversionCheck.targetFormat
                          );
                        }
                      } else {
                        logger.warn(`[FileImporter] No matching chapter found for ${chapterFileName} (chapter ${chapterNum})`);
                      }
                    }
                  }

                  // Return result for the original volume file (now split)
                  return {
                    fileName,
                    filePath: finalFilePath,
                    size
                  };
                } else {
                  if (splitResult.status !== 'error') {
                    logger.error(`[FileImporter] Volume split failed: Unexpected status`);
                  } else {
                    logger.error(`[FileImporter] Volume split failed: ${splitResult.error.message}`);
                  }
                  // Continue with normal import if splitting fails
                }
              }
            }
          }
        }
      }
    } catch (error) {
      logger.error(`[FileImporter] Error during volume splitting:`, error);
      // Continue with normal import if error occurs
    }
  }

  // Try to match this file to an existing chapter
  let matchedChapter = null;

  if (chapterNumber !== null) {
    // Try to find existing chapter with matching number that's currently DOWNLOADING
    matchedChapter = await prismaClient.chapter.findFirst({
      where: {
        mangaId,
        id: { in: chapterIds },
        downloadStatus: DownloadStatus.DOWNLOADING,
        OR: [
          { index: chapterNumber },
          { chapterNumber: chapterNumber },
          { number: chapterNumber }
        ]
      }
    });

    if (matchedChapter) {
      // iter-5: count pages up front so the `readable` signal is ready on the
      // first import rather than lazily on the first reader open.
      const pageCount = await countPagesInArchive(finalFilePath);
      await prismaClient.chapter.update({
        where: { id: matchedChapter.id },
        data: {
          filePath: finalFilePath,
          fileName,
          downloadStatus: DownloadStatus.COMPLETED,
          size: Math.floor(size),
          fileFormat: normalizeFileFormat(fileName),
          ...(pageCount > 0 && { pageCount }),
          ...(volumeNumber !== null && { volume: volumeNumber })
        }
      });

      logger.info(`[FileImporter] Updated chapter ${matchedChapter.id} (${matchedChapter.title}) with file ${fileName} (${pageCount} pages)`);

      // Check if format conversion is needed
      const fileExtension = path.extname(fileName).slice(1).toLowerCase();
      const conversionCheck = await shouldConvertFile(fileExtension);

      if (conversionCheck.shouldConvert && conversionCheck.targetFormat) {
        await createConversionJob(
          mangaId,
          matchedChapter.id,
          finalFilePath,
          fileExtension,
          conversionCheck.targetFormat
        );
      }
    } else {
      logger.warn(`[FileImporter] No matching DOWNLOADING chapter found for ${fileName} (chapter ${chapterNumber})`);
    }
  }

  // If no chapter was matched and we have downloading chapters left, match by position
  if (!matchedChapter && chapterIds.length > 0) {
    const unmatchedChapters = await prismaClient.chapter.findMany({
      where: {
        mangaId,
        id: { in: chapterIds },
        downloadStatus: DownloadStatus.DOWNLOADING,
        filePath: null
      },
      orderBy: { index: 'asc' }
    });

    const firstUnmatched = unmatchedChapters[0];
    if (firstUnmatched) {
      matchedChapter = firstUnmatched;

      // iter-5: count pages up front (see note at chapter-number match path)
      const pageCount = await countPagesInArchive(finalFilePath);
      await prismaClient.chapter.update({
        where: { id: matchedChapter.id },
        data: {
          filePath: finalFilePath,
          fileName,
          downloadStatus: DownloadStatus.COMPLETED,
          size: Math.floor(size),
          fileFormat: normalizeFileFormat(fileName),
          ...(pageCount > 0 && { pageCount }),
          ...(chapterNumber !== null && { chapterNumber }),
          ...(volumeNumber !== null && { volume: volumeNumber })
        }
      });

      logger.info(`[FileImporter] Matched chapter ${matchedChapter.id} by position with file ${fileName} (${pageCount} pages)`);

      // Check if format conversion is needed
      const fileExtension = path.extname(fileName).slice(1).toLowerCase();
      const conversionCheck = await shouldConvertFile(fileExtension);

      if (conversionCheck.shouldConvert && conversionCheck.targetFormat) {
        await createConversionJob(
          mangaId,
          matchedChapter.id,
          finalFilePath,
          fileExtension,
          conversionCheck.targetFormat
        );
      }
    }
  }

  return {
    fileName,
    filePath: finalFilePath,
    ...(matchedChapter && { chapterId: matchedChapter.id }),
    ...(chapterNumber !== null && { chapterNumber }),
    size
  };
}
