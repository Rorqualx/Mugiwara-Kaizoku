/**
 * TAR Extraction Wrapper for Conversion Layer
 *
 * Bridges the disk-based TAR extractor (file importer layer) to the in-memory
 * interface expected by converters ({ name: string; data: Buffer }[]).
 *
 * @module tar-wrapper
 */

import * as fs from 'fs/promises';

import { extractFromTar } from '@/server/services/download/fileImporter/extractors/tar-extractor';
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
 * Extract images from a TAR/CBT archive into in-memory buffers.
 *
 * Calls the disk-based extractor, reads extracted files into memory,
 * then cleans up the temp directory.
 *
 * @param archivePath - Path to the TAR/CBT archive
 * @returns AsyncResult with extracted image files as buffers
 */
export async function extractImagesFromTar(
  archivePath: string
): Promise<AsyncResult<ExtractionResult, Error>> {
  let extractDir: string | null = null;

  try {
    logger.debug(`[TarWrapper] Extracting images from: ${archivePath}`);

    const result = await extractFromTar(archivePath);

    if (result.status !== 'success') {
      const error = result.status === 'error' ? result.error : new Error('TAR extraction failed');
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

    logger.info(`[TarWrapper] Loaded ${files.length} images into memory from TAR archive`);

    return createSuccessResult({ files, totalFiles, extractedCount });
  } catch (error: unknown) {
    logger.error('[TarWrapper] Extraction failed:', error);
    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  } finally {
    // Clean up temp directory
    if (extractDir) {
      await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {
        logger.warn(`[TarWrapper] Failed to cleanup temp dir: ${extractDir}`);
      });
    }
  }
}
