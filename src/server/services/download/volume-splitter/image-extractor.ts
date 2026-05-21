/**
 * Image Extractor
 *
 * Extracts all images from volume archives (CBZ/ZIP).
 * Filters image files, skips metadata, and sorts by filename.
 *
 * Extracted from: volumeSplitter.ts (lines 420-467)
 */

import * as path from 'path';

import AdmZip from 'adm-zip';

import { logger } from '@/utils/logger';

import { naturalSort } from './utils';

import type { ImageEntry } from './types';

/**
 * Extract all images from volume archive
 *
 * @param volumePath - Path to volume archive
 * @returns Array of image entries with buffers
 */
export function extractImages(volumePath: string): ImageEntry[] {
  const ext = path.extname(volumePath).toLowerCase();

  if (ext !== '.cbz' && ext !== '.zip') {
    throw new Error(`Unsupported archive format: ${ext}. Only CBZ/ZIP are currently supported.`);
  }

  const zip = new AdmZip(volumePath);
  const entries = zip.getEntries();

  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  const images: ImageEntry[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    if (!entry) {
      logger.warn(`[VolumeSplitter] Skipping invalid entry at index ${i}`);
      continue;
    }

    if (entry.isDirectory) continue;

    const entryExt = path.extname(entry.entryName).toLowerCase();
    if (!imageExtensions.includes(entryExt)) continue;

    // Skip macOS metadata files
    if (entry.entryName.includes('__MACOSX') || entry.entryName.startsWith('.')) {
      continue;
    }

    try {
      const buffer = entry.getData();
      images.push({
        filename: entry.entryName,
        index: i,
        buffer
      });
    } catch (error) {
      logger.warn(`[VolumeSplitter] Failed to extract ${entry.entryName}:`, error);
    }
  }

  // Sort images by filename for proper page ordering
  images.sort((a, b) => naturalSort(a.filename, b.filename));

  return images;
}