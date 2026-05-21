/**
 * Setup Utilities for FileImporter
 *
 * Shared setup logic for manga import operations.
 * Consolidates duplicate code from setupMangaForImport and setupManualImport.
 *
 * Provides:
 * - Manga directory setup with Library relation
 * - Path mapping for download paths
 * - Directory creation and validation
 * - File organization config integration (folderStructure, fileMode)
 * - Common error handling for setup operations
 */

import * as fs from 'fs/promises';

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { getPathMapper } from '../pathMapper';

import { loadFileOrganizationConfig, generateMangaFolderPath, ensureMangaSubdirs } from './utils';

import type { PathMapper } from '../pathMapper';
import type { PrismaClient } from '@prisma/client';

/**
 * Type definition for manga with library relation
 */
export type MangaWithLibrary = {
  id: number;
  title: string;
  libraryPath: string | null;
  Library: { path: string };
};

/**
 * Setup manga directory and get manga information
 *
 * Consolidates common setup logic for both automatic and manual imports:
 * 1. Fetches manga with Library relation from database
 * 2. Creates path mapper instance
 * 3. Maps download path (if provided)
 * 4. Calculates manga library path
 * 5. Creates manga directory if needed
 *
 * @param prisma - Prisma client instance
 * @param mangaId - Manga ID
 * @param options - Optional configuration
 * @param options.downloadPath - Download path to map (for automatic imports)
 * @param options.includePathMapper - Include pathMapper in result (for manual imports)
 * @returns AsyncResult containing manga info and paths
 */
export async function setupMangaDirectory(
  prisma: PrismaClient,
  mangaId: number,
  options?: {
    downloadPath?: string;
    includePathMapper?: boolean;
  }
): Promise<AsyncResult<{
  manga: MangaWithLibrary;
  mangaLibraryPath: string;
  savePath?: string;
  pathMapper?: PathMapper;
}, Error>> {
  // Fetch manga with Library relation
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    include: { Library: true }
  }) as MangaWithLibrary | null;

  if (!manga) {
    return createErrorResult(new Error(`Manga ${mangaId} not found`));
  }

  // Setup path mapper
  const pathMapper = getPathMapper();
  let savePath: string | undefined;

  // Map download path if provided
  if (options?.downloadPath) {
    const originalSavePath = options.downloadPath;
    savePath = pathMapper.mapPath(originalSavePath);

    if (originalSavePath !== savePath) {
      logger.info(`[FileImporter] Path mapped: ${originalSavePath} -> ${savePath}`);
    }

    logger.info(`[FileImporter] Manga: ${manga.title}, Library: ${manga.Library.path}, Download path: ${savePath}`);
  }

  // Load file organization config to determine folder structure and file mode
  const fileOrgConfig = await loadFileOrganizationConfig();

  // Calculate manga library path using folder structure settings
  const mangaLibraryPath = manga.libraryPath
    ?? generateMangaFolderPath(manga.Library.path, manga.title, fileOrgConfig);

  logger.debug('[FileImporter] Resolved manga path', {
    mangaLibraryPath,
    folderStructure: fileOrgConfig.folderStructure,
    fileMode: fileOrgConfig.fileMode,
    hadExistingPath: manga.libraryPath !== null,
  });

  // For keep_in_place mode with a download path, skip directory creation
  // (files stay where the download client saved them)
  if (fileOrgConfig.fileMode !== 'keep_in_place' || !savePath) {
    try {
      await fs.mkdir(mangaLibraryPath, { recursive: true });
      await ensureMangaSubdirs(mangaLibraryPath);
      logger.info(`[FileImporter] Created/verified manga directory: ${mangaLibraryPath}`);
    } catch (error) {
      logger.error(`[FileImporter] Failed to create manga directory: ${mangaLibraryPath}`, error);
      return createErrorResult(new Error(`Failed to create manga directory: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  // Build result object
  const result: {
    manga: MangaWithLibrary;
    mangaLibraryPath: string;
    savePath?: string;
    pathMapper?: PathMapper;
  } = {
    manga,
    mangaLibraryPath
  };

  if (savePath !== undefined) {
    result.savePath = savePath;
  }

  if (options?.includePathMapper) {
    result.pathMapper = pathMapper;
  }

  return createSuccessResult(result);
}
