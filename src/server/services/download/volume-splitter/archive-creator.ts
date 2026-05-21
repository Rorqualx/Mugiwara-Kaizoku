/**
 * Archive Creator
 *
 * Creates CBZ archives from image collections.
 * Renames files for consistent page ordering.
 *
 * Extracted from: volumeSplitter.ts (lines 702-720)
 */

import * as path from 'path';

import AdmZip from 'adm-zip';

import { logger } from '@/utils/logger';

import type { ImageEntry } from './types';

/**
 * Create a CBZ archive from images
 *
 * @param images - Images to include in archive
 * @param outputPath - Output CBZ file path
 */
export async function createChapterArchive(images: ImageEntry[], outputPath: string): Promise<void> {
  const zip = new AdmZip();

  for (let i = 0; i < images.length; i++) {
    const image = images[i];

    if (!image) {
      logger.warn(`[VolumeSplitter] Skipping invalid image at index ${i}`);
      continue;
    }

    const ext = path.extname(image.filename);
    // Rename for consistent ordering: page001.jpg, page002.jpg, etc.
    const newFilename = `page${String(i + 1).padStart(3, '0')}${ext}`;
    zip.addFile(newFilename, image.buffer);
  }

  await zip.writeZipPromise(outputPath);
}