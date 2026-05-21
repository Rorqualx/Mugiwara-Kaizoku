/**
 * Volume Splitter Utilities
 *
 * Shared helper functions for volume splitting operations.
 *
 * @module server/services/download/volume-splitter
 */

import { logger } from '@/utils/logger';

import type { ImageEntry } from './types';

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate image entry with logging
 */
export function validateImage(image: ImageEntry | undefined, index: number): image is ImageEntry {
  if (!image) {
    logger.warn(`[VolumeSplitter] Skipping invalid image at index ${index}`);
    return false;
  }
  return true;
}

// ============================================================================
// Title Page Detection
// ============================================================================

/**
 * Check if filename indicates a title/cover page
 */
export function isTitlePage(filename: string): boolean {
  const lower = filename.toLowerCase();
  return (
    lower.includes('title') ||
    lower.includes('cover') ||
    lower.includes('p001') ||
    lower.includes('page001') ||
    lower.includes('_001.') ||
    lower.includes('-001.')
  );
}

// ============================================================================
// Sorting
// ============================================================================

/**
 * Natural sort for filenames (handles numbers correctly)
 */
export function naturalSort(a: string, b: string): number {
  const regex = /(\d+)|(\D+)/g;
  const aParts = a.match(regex) ?? [];
  const bParts = b.match(regex) ?? [];

  for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
    const aPart = aParts[i];
    const bPart = bParts[i];

    if (!aPart || !bPart) {
      continue;
    }

    const aNum = parseInt(aPart, 10);
    const bNum = parseInt(bPart, 10);

    if (!isNaN(aNum) && !isNaN(bNum)) {
      if (aNum !== bNum) return aNum - bNum;
    } else {
      if (aPart !== bPart) return aPart.localeCompare(bPart);
    }
  }

  return aParts.length - bParts.length;
}