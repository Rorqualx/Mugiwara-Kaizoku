/**
 * 7-Zip Extraction Wrapper for Conversion Layer
 *
 * Bridges the disk-based 7z extractor (file importer layer) to the in-memory
 * interface expected by converters ({ name: string; data: Buffer }[]).
 *
 * @module seven-zip-wrapper
 */

import * as fs from 'fs/promises';

import { extractFrom7z } from '@/server/services/download/fileImporter/extractors/seven-zip-extractor';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

/** Matches the interface from rar-extractor.ts */
export interface ExtractionResult {
  files: Array<{ name: string; data: Buffer }>;
  totalFiles: number;
  extractedCount: number;
}

/**
 * Extract images from a 7z/CB7 archive into in-memory buffers.
 *
 * Calls the disk-based extractor, reads extracted files into memory,
 * then cleans up the temp directory.
 *
 * @param archivePath - Path to the 7z/CB7 archive
 * @returns AsyncResult with extracted image files as buffers
 */
export async function extractImagesFrom7z(
  archivePath: string
): Promise<AsyncResult<ExtractionResult, Error>> {
  let extractDir: string | null = null;

  try {
    logger.debug(`[7zWrapper] Extracting images from: ${archivePath}`);

    const result = await extractFrom7z(archivePath);

    if (result.status !== 'success') {
      const error = result.status === 'error' ? result.error : new Error('7z extraction failed');
      return createErrorResult(error);
    }

    extractDir = result.data.extractDir;
    const { files: diskFiles, totalFiles, extractedCount } = result.data;

    // Read each extracted image file into memory
    const files: Array<{ name: string; data: Buffer }> = [];
    for (const diskFile of diskFiles) {
      // eslint-disable-next-line no-await-in-loop -- Sequential reads to control memory usage
      const data = await fs.readFile(diskFile.filePath);
      files.push({ name: diskFile.name, data });
    }

    logger.info(`[7zWrapper] Loaded ${files.length} images into memory from 7z archive`);

    return createSuccessResult({ files, totalFiles, extractedCount });
  } catch (error: unknown) {
    logger.error('[7zWrapper] Extraction failed:', error);
    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  } finally {
    // Clean up temp directory
    if (extractDir) {
      await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {
        logger.warn(`[7zWrapper] Failed to cleanup temp dir: ${extractDir}`);
      });
    }
  }
}
