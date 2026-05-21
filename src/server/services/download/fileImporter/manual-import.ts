/**
 * Manual Import Module
 *
 * Handles manual file import with explicit chapter mappings.
 * Separated from automatic download imports for clarity.
 *
 * Architecture:
 * - Processes files with explicit chapter ID mappings
 * - Handles file validation, copying, and database updates
 * - Creates conversion jobs when needed
 * - Manages file cleanup on errors
 *
 * Dependencies:
 * - setup-utils.ts - Directory setup and manga retrieval
 * - file-operations.ts - Path accessibility checks
 * - conversion-operations.ts - Format conversion
 * - pathMapper - Path mapping for remote file systems
 */

import * as fs from 'fs/promises';
import * as path from 'path';


import { DownloadStatus } from '@prisma/client';

import type { PathMapper } from '@/server/services/download/pathMapper';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';


import { shouldConvertFile, createConversionJob } from './conversion-operations';
import { isPathAccessible, getPathAccessibilityError } from './file-operations';
import { setupMangaDirectory, type MangaWithLibrary } from './setup-utils';

import type { PrismaClient } from '@prisma/client';

/**
 * Type for manual file mapping input
 */
export interface ManualFileMapping {
  sourcePath: string;
  chapterId: number;
  chapterNumber?: number | undefined;
  fileName: string;
}

/**
 * Type for manual import result
 */
export interface ManualImportResult {
  sourcePath: string;
  fileName: string;
  chapterId?: number;
  success: boolean;
  error?: string;
}

/**
 * ManualImporter - Service for importing files with explicit chapter mappings
 *
 * This class handles manual file imports where users explicitly specify
 * which file should be imported for which chapter. Unlike automatic imports,
 * manual imports require explicit chapter ID mappings.
 */
export class ManualImporter {
  constructor(private prismaClient: PrismaClient) {}

  /**
   * Manual import of files with explicit chapter mappings
   *
   * @param mangaId - Manga ID
   * @param files - Array of file mappings (sourcePath -> chapterId)
   * @returns AsyncResult containing import results
   */
  async manualImport(
    mangaId: number,
    files: ManualFileMapping[]
  ): Promise<AsyncResult<{
    filesProcessed: number;
    filesImported: number;
    filesFailed: number;
    results: ManualImportResult[];
  }, Error>> {
    try {
      logger.info(`[FileImporter] Starting manual import for manga ${mangaId}, ${files.length} files`);

      const setupResult = await this.setupManualImport(mangaId);
      if (setupResult.status === 'error') {
        return createErrorResult(setupResult.error);
      }

      if (setupResult.status !== 'success') {
        return createErrorResult(new Error('Unexpected setup result status'));
      }

      const manga = setupResult.data.manga;
      const mangaLibraryPath = setupResult.data.mangaLibraryPath;
      const pathMapper = setupResult.data.pathMapper;

      const results: ManualImportResult[] = [];

      let filesImported = 0;
      let filesFailed = 0;

      for (const fileMapping of files) {
        // eslint-disable-next-line no-await-in-loop -- Sequential file processing required
        const result = await this.processManualFileMapping(
          fileMapping,
          mangaId,
          mangaLibraryPath,
          pathMapper
        );

        results.push(result);

        if (result.success) {
          filesImported++;
        } else {
          filesFailed++;
        }
      }

      await this.updateMangaLibraryPath(manga, mangaLibraryPath);

      logger.info(`[FileImporter] Manual import complete: ${filesImported} files imported, ${filesFailed} failed`);

      return createSuccessResult({
        filesProcessed: files.length,
        filesImported,
        filesFailed,
        results
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to perform manual import';
      logger.error('[FileImporter] Error in manual import:', error);
      return createErrorResult(new Error(errorMessage));
    }
  }

  /**
   * Setup manual import - get manga info and create directory
   */
  private async setupManualImport(mangaId: number): Promise<AsyncResult<{
    manga: MangaWithLibrary;
    mangaLibraryPath: string;
    pathMapper: PathMapper;
  }, Error>> {
    const result = await setupMangaDirectory(this.prismaClient, mangaId, {
      includePathMapper: true
    });

    if (result.status === 'error') {
      return createErrorResult(result.error);
    }

    if (result.status !== 'success') {
      return createErrorResult(new Error('Unexpected result status from setupMangaDirectory'));
    }

    const pathMapper = result.data.pathMapper;
    if (!pathMapper) {
      return createErrorResult(new Error('pathMapper not provided by setupMangaDirectory'));
    }

    return createSuccessResult({
      manga: result.data.manga,
      mangaLibraryPath: result.data.mangaLibraryPath,
      pathMapper
    });
  }

  /**
   * Process single file mapping for manual import
   */
  private async processManualFileMapping(
    fileMapping: ManualFileMapping,
    mangaId: number,
    mangaLibraryPath: string,
    pathMapper: PathMapper
  ): Promise<ManualImportResult> {
    try {
      const { chapterId, chapterNumber, fileName } = fileMapping;
      const originalSourcePath = fileMapping.sourcePath;
      const sourcePath = pathMapper.mapPath(fileMapping.sourcePath);

      if (originalSourcePath !== sourcePath) {
        logger.info(`[FileImporter] Path mapped: ${originalSourcePath} -> ${sourcePath}`);
      }

      logger.info(`[FileImporter] Manual import: ${fileName} -> chapter ${chapterId}`);

      const validationError = await this.validateSourceFile(sourcePath);
      if (validationError) {
        logger.error(`[FileImporter] ${validationError}`);
        return {
          sourcePath: originalSourcePath,
          fileName,
          chapterId,
          success: false,
          error: validationError
        };
      }

      const chapter = await this.getChapter(chapterId);
      if (!chapter) {
        const error = `Chapter ${chapterId} not found`;
        logger.error(`[FileImporter] ${error}`);
        return {
          sourcePath: originalSourcePath,
          fileName,
          chapterId,
          success: false,
          error
        };
      }

      const destFileResult = await this.copyFileToUniqueDestination(sourcePath, fileName, mangaLibraryPath);
      if (destFileResult.status === 'error') {
        const errorMsg = `Failed to copy file: ${destFileResult.error.message}`;
        logger.error(`[FileImporter] ${errorMsg}`);
        return {
          sourcePath: originalSourcePath,
          fileName,
          chapterId,
          success: false,
          error: errorMsg
        };
      }

      if (destFileResult.status !== 'success') {
        const errorMsg = 'Unexpected result status from copyFileToUniqueDestination';
        logger.error(`[FileImporter] ${errorMsg}`);
        return {
          sourcePath: originalSourcePath,
          fileName,
          chapterId,
          success: false,
          error: errorMsg
        };
      }

      const destFile = destFileResult.data;

      const updateResult = await this.updateChapterWithFile(
        chapterId,
        destFile,
        fileName,
        chapterNumber
      );

      if (updateResult.status === 'error') {
        await this.cleanupFile(destFile);
        return {
          sourcePath: originalSourcePath,
          fileName,
          chapterId,
          success: false,
          error: `Database update failed: ${updateResult.error.message}`
        };
      }

      if (updateResult.status !== 'success') {
        await this.cleanupFile(destFile);
        return {
          sourcePath: originalSourcePath,
          fileName,
          chapterId,
          success: false,
          error: 'Unexpected result status from updateChapterWithFile'
        };
      }

      await this.checkAndCreateConversionJob(mangaId, chapterId, destFile, fileName);

      return {
        sourcePath: originalSourcePath,
        fileName: path.basename(destFile),
        chapterId,
        success: true
      };

    } catch (error) {
      const errorMsg = `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(`[FileImporter] ${errorMsg}`, error);
      return {
        sourcePath: fileMapping.sourcePath,
        fileName: fileMapping.fileName,
        chapterId: fileMapping.chapterId,
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Validate source file exists and is accessible
   */
  private async validateSourceFile(sourcePath: string): Promise<string | null> {
    try {
      await fs.access(sourcePath, fs.constants.R_OK);
      return null;
    } catch {
      const parentDir = path.dirname(sourcePath);
      const parentAccessible = await isPathAccessible(parentDir);
      if (parentAccessible) {
        return `Source file not found: ${sourcePath}`;
      }
      // ESLint incorrectly infers error type in catch block
       
      return String(getPathAccessibilityError(sourcePath));
    }
  }

  /**
   * Get chapter by ID
   */
  private async getChapter(chapterId: number): Promise<{ id: number } | null> {
    return this.prismaClient.chapter.findUnique({
      where: { id: chapterId }
    });
  }

  /**
   * Copy file to destination with unique name if needed
   */
  private async copyFileToUniqueDestination(
    sourcePath: string,
    fileName: string,
    mangaLibraryPath: string
  ): Promise<AsyncResult<string, Error>> {
    let destFile = path.join(mangaLibraryPath, fileName);
    let fileCounter = 1;
    const originalDestFile = destFile;

    // eslint-disable-next-line no-await-in-loop -- Sequential uniqueness check required
    while (await isPathAccessible(destFile)) {
      const ext = path.extname(fileName);
      const baseName = path.basename(fileName, ext);
      const newFileName = `${baseName}_${fileCounter}${ext}`;
      destFile = path.join(mangaLibraryPath, newFileName);
      fileCounter++;
    }

    if (destFile !== originalDestFile) {
      logger.warn(`[FileImporter] File ${fileName} already exists, using ${path.basename(destFile)}`);
    }

    try {
      await fs.copyFile(sourcePath, destFile);
      logger.info(`[FileImporter] Copied ${fileName} to ${destFile}`);
      return createSuccessResult(destFile);
    } catch (error) {
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Update chapter with file information
   */
  private async updateChapterWithFile(
    chapterId: number,
    destFile: string,
    fileName: string,
    chapterNumber?: number
  ): Promise<AsyncResult<void, Error>> {
    try {
      const stats = await fs.stat(destFile);
      const size = stats.size;

      const updateData = {
        filePath: destFile,
        fileName: path.basename(destFile),
        downloadStatus: DownloadStatus.COMPLETED,
        size: Math.floor(size),
        fileFormat: path.extname(fileName).slice(1).toUpperCase(),
        ...(chapterNumber !== undefined && { chapterNumber })
      };

      await this.prismaClient.chapter.update({
        where: { id: chapterId },
        data: updateData
      });

      logger.info(`[FileImporter] Updated chapter ${chapterId} with file ${path.basename(destFile)}`);
      return createSuccessResult(undefined);
    } catch (error) {
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Check if conversion is needed and create conversion job
   */
  private async checkAndCreateConversionJob(
    mangaId: number,
    chapterId: number,
    destFile: string,
    fileName: string
  ): Promise<void> {
    const fileExtension = path.extname(fileName).slice(1).toLowerCase();
    const conversionCheck = await shouldConvertFile(fileExtension);

    if (conversionCheck.shouldConvert && conversionCheck.targetFormat) {
      await createConversionJob(
        mangaId,
        chapterId,
        destFile,
        fileExtension,
        conversionCheck.targetFormat
      );
    }
  }

  /**
   * Cleanup file after failed operation
   */
  private async cleanupFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.warn(`[FileImporter] Cleaned up file ${filePath} after DB update failure`);
    } catch (cleanupError) {
      logger.error(`[FileImporter] Failed to clean up file ${filePath}:`, cleanupError);
    }
  }

  /**
   * Update manga library path if not set
   */
  private async updateMangaLibraryPath(
    manga: { id: number; libraryPath: string | null },
    mangaLibraryPath: string
  ): Promise<void> {
    if (!manga.libraryPath) {
      await this.prismaClient.manga.update({
        where: { id: manga.id },
        data: { libraryPath: mangaLibraryPath }
      });
    }
  }
}
