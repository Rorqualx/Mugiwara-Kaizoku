/**
 * Shared CBZ Archive Builder
 *
 * Creates CBZ (Comic Book ZIP) archives from in-memory image buffers.
 * Used by CBZConverter, PDFConverter, EPUBInputConverter, and KindleConverter
 * to avoid duplicating archive creation logic.
 *
 * @module cbz-builder
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import JSZip from 'jszip';

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

/**
 * Create a CBZ archive from in-memory image buffers.
 *
 * @param images - Array of image buffers with filenames
 * @param outputPath - Output CBZ file path
 * @param compressionLevel - ZIP compression level (0-9)
 * @param onProgress - Optional progress callback (0-100)
 * @returns AsyncResult indicating success or error
 */
export async function createCBZArchive(
  images: Array<{ name: string; data: Buffer }>,
  outputPath: string,
  compressionLevel: number,
  onProgress?: (progress: number) => void
): Promise<AsyncResult<void, Error>> {
  try {
    const zip = new JSZip();

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      if (!image) continue;

      // Use basename to avoid nested directory structure
      const basename = path.basename(image.name);

      zip.file(basename, image.data, {
        compression: 'DEFLATE',
        compressionOptions: { level: compressionLevel },
      });

      if (onProgress) {
        onProgress(((i + 1) / images.length) * 100);
      }

      logger.debug(`[CBZBuilder] Added: ${basename}`);
    }

    const zipData = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: compressionLevel },
    });

    await fs.writeFile(outputPath, zipData);
    logger.info(`[CBZBuilder] CBZ created: ${outputPath}`);

    return createSuccessResult(undefined);
  } catch (error: unknown) {
    logger.error('[CBZBuilder] Failed to create CBZ', error);
    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  }
}
