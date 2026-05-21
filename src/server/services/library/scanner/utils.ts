/**
 * Scanner Utility Functions
 *
 * Shared utility functions and type guards for scanner modules.
 * Extracted from scanner.ts (lines 39-56)
 */

import * as fs from 'fs';
import * as path from 'path';

import { MangaFileParser } from '@/utils/parsers/mangaFileParser';

import type { ScanFileInfo } from './types';

/**
 * Type guard for event emitter with tracked emit capability
 *
 * @param emitter - The emitter to check
 * @returns True if emitter has emitWithTracking method
 */
export function hasTrackedEmit(
  emitter: unknown
): emitter is { emitWithTracking: (event: unknown) => Promise<void> } {
  if (typeof emitter !== 'object' || emitter === null || !('emitWithTracking' in emitter)) {
    return false;
  }
  const record = emitter as Record<string, unknown>;
  return typeof record['emitWithTracking'] === 'function';
}

/**
 * Type guard for event emitter with standard emit capability
 *
 * @param emitter - The emitter to check
 * @returns True if emitter has standard emit method
 */
export function hasStandardEmit(
  emitter: unknown
): emitter is { emit: (eventName: string, data: unknown) => void } {
  if (typeof emitter !== 'object' || emitter === null || !('emit' in emitter)) {
    return false;
  }
  const record = emitter as Record<string, unknown>;
  return typeof record['emit'] === 'function';
}

/**
 * Collect detailed file information from a list of manga files
 *
 * Parses each file to extract chapter/volume numbers and collects file metadata.
 * Used to populate the files array in scan results for detailed review.
 *
 * @param files - Array of file paths to process
 * @returns Array of ScanFileInfo objects with parsed metadata
 */
export async function collectFileDetails(files: string[]): Promise<ScanFileInfo[]> {
  const results = await Promise.all(
    files.map(async (filePath) => {
      try {
        const stats = await fs.promises.stat(filePath);
        const parsed = MangaFileParser.parse(filePath);

        const fileInfo: ScanFileInfo = {
          name: path.basename(filePath),
          path: filePath,
          size: stats.size,
          extension: path.extname(filePath).slice(1).toLowerCase()
        };
        if (parsed.chapter !== undefined) fileInfo.chapterNumber = parsed.chapter;
        if (parsed.volume !== undefined) fileInfo.volumeNumber = parsed.volume;
        return fileInfo;
      } catch {
        // If file stat fails, still include with minimal info
        return {
          name: path.basename(filePath),
          path: filePath,
          size: 0,
          extension: path.extname(filePath).slice(1).toLowerCase()
        };
      }
    })
  );

  return results;
}
