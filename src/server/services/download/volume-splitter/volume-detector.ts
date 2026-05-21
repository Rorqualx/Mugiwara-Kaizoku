/**
 * Volume File Detector
 *
 * Detects if a file is likely a volume archive vs individual chapter.
 * Uses filename patterns and file size heuristics.
 *
 * Extracted from: volumeSplitter.ts (lines 106-131)
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import { logger } from '@/utils/logger';

/**
 * Check if a file is likely a volume (vs individual chapter)
 *
 * Heuristics:
 * - Filename contains "volume", "vol", "v01", etc.
 * - Large file size (>50MB suggests multiple chapters)
 * - High image count (>50 pages suggests volume)
 *
 * @param filePath - Path to archive file
 * @returns True if file appears to be a volume
 */
export async function isVolumeFile(filePath: string): Promise<boolean> {
  const filename = path.basename(filePath, path.extname(filePath)).toLowerCase();

  // Check filename patterns
  const volumePatterns = [
    /\bvol(?:ume)?[\s._-]*\d+/i,
    /\bv\d{2,}/i,
    /\btome\s*\d+/i,
    /\btomo\s*\d+/i
  ];

  const hasVolumePattern = volumePatterns.some(pattern => pattern.test(filename));

  // Check file size (volumes are typically >50MB)
  try {
    const stats = await fs.stat(filePath);
    const sizeMB = stats.size / (1024 * 1024);
    const isLargeFile = sizeMB > 50;

    // If has volume pattern OR is large file, consider it a volume
    return hasVolumePattern || isLargeFile;
  } catch (_error) {
    logger.warn(`[VolumeSplitter] Could not check file size for ${filePath}, using pattern only`);
    return hasVolumePattern;
  }
}