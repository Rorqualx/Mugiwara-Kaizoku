/**
 * File Importer Service
 *
 * Main aggregator for file import operations.
 * Imports completed downloads into manga library.
 *
 * Architecture:
 * - fileImporter/types.ts - Shared type definitions (ImportResult, CompletedDownload)
 * - fileImporter/utils.ts - Utility functions, schemas (sanitizePath, getPathAccessibilityError)
 * - fileImporter/file-operations.ts - File finding/importing (isPathAccessible, findMangaFiles, findArchiveFiles, importFile)
 * - fileImporter/archive-operations.ts - Archive extraction (extractArchive)
 * - fileImporter/chapter-processing.ts - Chapter creation (createChaptersFromFiles)
 * - fileImporter/conversion-operations.ts - Format conversion (shouldConvertFile, createConversionJob)
 *
 * Original: 1317 lines -> Refactored: ~380 lines (-71%)
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { extractArchive } from './fileImporter/archive-operations';
import { createChaptersFromFiles } from './fileImporter/chapter-processing';
import {
  findMangaFiles,
  findArchiveFiles,
  importFile
} from './fileImporter/file-operations';
import { ManualImporter, type ManualFileMapping } from './fileImporter/manual-import';
import { setupMangaDirectory, type MangaWithLibrary } from './fileImporter/setup-utils';

import type { ImportResult, CompletedDownload } from './fileImporter/types';
import type { PrismaClient } from '@prisma/client';

// Re-export types for backward compatibility
export type { ImportResult, CompletedDownload } from './fileImporter/types';

/**
 * FileImporter - Service for importing completed downloads into manga library
 *
 * This service handles copying files from download client directories to the
 * manga library and updating chapter statuses.
 */
export class FileImporter {
  constructor(private prismaClient: PrismaClient = prisma) {}

  /**
   * Import completed download files into manga library
   *
   * @param download - CompletedDownload information
   * @returns AsyncResult containing import results
   */
  async importDownload(download: CompletedDownload): Promise<AsyncResult<ImportResult, Error>> {
    try {
      logger.info(`[FileImporter] Starting import for job ${download.jobId}, manga ${download.mangaId}`);

      // Emit import started event
      void realtimeEmitter.emitImportProgress({
        mangaId: download.mangaId,
        operation: 'started',
      });

      const setupResult = await this.setupMangaForImport(download.mangaId, download.savePath);
      if (setupResult.status === 'error') {
        // Emit import failed event
        void realtimeEmitter.emitImportProgress({
          mangaId: download.mangaId,
          operation: 'failed',
          error: setupResult.error.message,
        });
        return createErrorResult(setupResult.error);
      }

      if (setupResult.status !== 'success') {
        const errorMsg = 'Unexpected setup result status';
        void realtimeEmitter.emitImportProgress({
          mangaId: download.mangaId,
          operation: 'failed',
          error: errorMsg,
        });
        return createErrorResult(new Error(errorMsg));
      }

      const manga = setupResult.data.manga;
      const mangaLibraryPath = setupResult.data.mangaLibraryPath;
      const savePath = setupResult.data.savePath;

      let importResult: ImportResult = {
        mangaId: download.mangaId,
        mangaTitle: manga.title,
        filesImported: 0,
        chaptersUpdated: 0,
        files: [],
        errors: []
      };

      const isPack = download.mode === 'PACK';

      if (isPack) {
        importResult = await this.handlePackModeImport(savePath, download.mangaId, mangaLibraryPath, importResult);
      } else {
        importResult = await this.handleBulkModeImport(download, mangaLibraryPath, importResult);
      }

      await this.updateMangaLibraryPath(manga, mangaLibraryPath);

      logger.info(`[FileImporter] Import complete: ${importResult.filesImported} files imported, ${importResult.chaptersUpdated} chapters updated`);

      // Emit import completed event
      void realtimeEmitter.emitImportProgress({
        mangaId: download.mangaId,
        mangaTitle: manga.title,
        operation: 'completed',
        filesImported: importResult.filesImported,
        progress: 100,
      });

      return createSuccessResult(importResult);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to import download';
      logger.error('[FileImporter] Error importing download:', error);

      // Emit import failed event
      void realtimeEmitter.emitImportProgress({
        mangaId: download.mangaId,
        operation: 'failed',
        error: errorMessage,
      });

      return createErrorResult(new Error(errorMessage));
    }
  }

  /**
   * Setup manga for import - get manga info and create directory
   */
  private async setupMangaForImport(
    mangaId: number,
    downloadSavePath: string
  ): Promise<AsyncResult<{
    manga: MangaWithLibrary;
    mangaLibraryPath: string;
    savePath: string;
  }, Error>> {
    const result = await setupMangaDirectory(this.prismaClient, mangaId, {
      downloadPath: downloadSavePath,
      includePathMapper: false
    });

    if (result.status === 'error') {
      return createErrorResult(result.error);
    }

    if (result.status !== 'success') {
      return createErrorResult(new Error('Unexpected result status from setupMangaDirectory'));
    }

    const manga = result.data.manga;
    const mangaLibraryPath = result.data.mangaLibraryPath;
    const savePath = result.data.savePath;

    // savePath is guaranteed to exist when downloadPath option is provided
    if (!savePath) {
      return createErrorResult(new Error('savePath not provided by setupMangaDirectory'));
    }

    return createSuccessResult({
      manga,
      mangaLibraryPath,
      savePath
    });
  }

  /**
   * Handle PACK mode import (archive extraction)
   */
  private async handlePackModeImport(
    savePath: string,
    mangaId: number,
    mangaLibraryPath: string,
    importResult: ImportResult
  ): Promise<ImportResult> {
    logger.info(`[FileImporter] PACK mode detected - extracting archives and creating chapters`);

    const archiveFiles = await findArchiveFiles(savePath);

    if (archiveFiles.length === 0) {
      throw new Error(`No archive files found in ${savePath} for PACK download`);
    }

    logger.info(`[FileImporter] Found ${archiveFiles.length} archive files to extract`);

    let result = { ...importResult };

    for (const archiveFile of archiveFiles) {
      // eslint-disable-next-line no-await-in-loop -- Sequential file extraction required
      result = await this.processArchiveFile(archiveFile, mangaId, mangaLibraryPath, result);
    }

    return result;
  }

  /**
   * Process single archive file
   */
  private async processArchiveFile(
    archiveFile: string,
    mangaId: number,
    mangaLibraryPath: string,
    importResult: ImportResult
  ): Promise<ImportResult> {
    try {
      const { extractDir, files: extractedFiles } = await extractArchive(archiveFile);

      logger.info(`[FileImporter] Extracted ${extractedFiles.length} files from ${path.basename(archiveFile)}`);

      const createdChapterIds = await createChaptersFromFiles(
        extractedFiles,
        mangaId,
        mangaLibraryPath,
        this.prismaClient
      );

      const filesInfo = await this.getExtractedFilesInfo(extractedFiles, mangaLibraryPath);

      await this.cleanupExtractionDirectory(extractDir);

      return {
        ...importResult,
        filesImported: importResult.filesImported + extractedFiles.length,
        chaptersUpdated: importResult.chaptersUpdated + createdChapterIds.length,
        files: [...importResult.files, ...filesInfo]
      };

    } catch (error) {
      const errorMsg = `Failed to process archive ${path.basename(archiveFile)}: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(`[FileImporter] ${errorMsg}`);
      return {
        ...importResult,
        errors: [...importResult.errors, errorMsg]
      };
    }
  }

  /**
   * Get information about extracted files
   */
  private async getExtractedFilesInfo(
    extractedFiles: string[],
    mangaLibraryPath: string
  ): Promise<Array<{ fileName: string; filePath: string; size: number; chapterId?: number }>> {
    const filesInfo: Array<{ fileName: string; filePath: string; size: number; chapterId?: number }> = [];

    for (const file of extractedFiles) {
      const filePath = path.join(mangaLibraryPath, path.basename(file));
      // eslint-disable-next-line no-await-in-loop -- Sequential file stat operations required
      const stats = await fs.stat(filePath);
      filesInfo.push({
        fileName: path.basename(file),
        filePath,
        size: stats.size
      });
    }

    return filesInfo;
  }

  /**
   * Cleanup extraction directory
   */
  private async cleanupExtractionDirectory(extractDir: string): Promise<void> {
    try {
      await fs.rm(extractDir, { recursive: true, force: true });
      logger.debug(`[FileImporter] Cleaned up temp directory: ${extractDir}`);
    } catch (cleanupError) {
      logger.warn(`[FileImporter] Failed to cleanup temp directory ${extractDir}:`, cleanupError);
    }
  }

  /**
   * Handle BULK mode import (individual chapter files)
   */
  private async handleBulkModeImport(
    download: CompletedDownload,
    mangaLibraryPath: string,
    importResult: ImportResult
  ): Promise<ImportResult> {
    logger.info(`[FileImporter] BULK mode - matching files to existing chapters`);

    const files = await findMangaFiles(download.savePath);

    if (files.length === 0) {
      throw new Error(`No manga files found in ${download.savePath}`);
    }

    logger.info(`[FileImporter] Found ${files.length} manga files in ${download.savePath}`);

    let result = { ...importResult };

    for (const sourceFile of files) {
      // eslint-disable-next-line no-await-in-loop -- Sequential file import required
      result = await this.importSingleFile(sourceFile, mangaLibraryPath, download, result);
    }

    return result;
  }

  /**
   * Import single file in BULK mode
   */
  private async importSingleFile(
    sourceFile: string,
    mangaLibraryPath: string,
    download: CompletedDownload,
    importResult: ImportResult
  ): Promise<ImportResult> {
    try {
      const imported = await importFile(
        sourceFile,
        mangaLibraryPath,
        download.mangaId,
        download.chapterIds,
        this.prismaClient
      );

      if (imported) {
        return {
          ...importResult,
          filesImported: importResult.filesImported + 1,
          files: [...importResult.files, imported],
          chaptersUpdated: imported.chapterId
            ? importResult.chaptersUpdated + 1
            : importResult.chaptersUpdated
        };
      }

      return importResult;
    } catch (error) {
      const errorMsg = `Failed to import ${sourceFile}: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(`[FileImporter] ${errorMsg}`);
      return {
        ...importResult,
        errors: [...importResult.errors, errorMsg]
      };
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

  /**
   * Manual import of files with explicit chapter mappings
   * Delegates to ManualImporter for implementation
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
    results: Array<{
      sourcePath: string;
      fileName: string;
      chapterId?: number;
      success: boolean;
      error?: string;
    }>;
  }, Error>> {
    const manualImporter = new ManualImporter(this.prismaClient);
    return manualImporter.manualImport(mangaId, files);
  }
}
