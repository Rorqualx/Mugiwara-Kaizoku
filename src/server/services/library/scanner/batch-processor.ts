/**
 * Batch Processor Module
 *
 * Provides batch processing utilities to avoid await-in-loop ESLint violations.
 * Processes multiple async operations in parallel with concurrency control.
 *
 * Fixes await-in-loop violations at:
 * - scanner.ts line 166: Processing manga groups
 * - scanner.ts line 233: Checking image directories
 */

import { isImageDirectory } from '@/utils/file-utils';

import type { ScanItem } from './types';

/**
 * Options for batch processing manga groups
 */
export interface BatchProcessOptions {
  concurrency?: number;
}

/**
 * Batch process manga groups with concurrency control
 *
 * Processes multiple manga groups in parallel while limiting concurrent operations.
 * Avoids await-in-loop violation (scanner.ts line 166).
 *
 * @param mangaGroups - Map of manga paths to their files
 * @param processFn - Function to process each manga group
 * @param options - Processing options
 * @returns Array of scan items from all processed groups
 */
export async function processMangaGroupsBatch(
  mangaGroups: Map<string, string[]>,
  processFn: (path: string, files: string[]) => Promise<ScanItem>,
  options: BatchProcessOptions = {}
): Promise<ScanItem[]> {
  const { concurrency = 5 } = options;
  const entries = Array.from(mangaGroups.entries());

  // Create batches
  const batches: Array<Array<[string, string[]]>> = [];
  for (let i = 0; i < entries.length; i += concurrency) {
    batches.push(entries.slice(i, i + concurrency));
  }

  // Process all batches sequentially (each batch processes items in parallel)
  const allResults = await batches.reduce<Promise<ScanItem[]>>(
    async (accPromise, batch) => {
      const acc = await accPromise;

      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(async ([mangaPath, files]) => {
          try {
            return await processFn(mangaPath, files);
          } catch (error: unknown) {
            // Return error scan item
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
              path: mangaPath,
              parsed: {
                original: mangaPath.split('/').pop() ?? mangaPath,
                title: mangaPath.split('/').pop() ?? mangaPath,
                cleanTitle: mangaPath.split('/').pop() ?? mangaPath
              },
              status: 'error' as const,
              error: errorMessage
            };
          }
        })
      );

      return [...acc, ...batchResults];
    },
    Promise.resolve([])
  );

  return allResults;
}

/**
 * Batch check if files are image directories
 *
 * Checks multiple files in parallel to determine which are image directories.
 * Avoids await-in-loop violation (scanner.ts line 233).
 *
 * @param files - Array of file paths to check
 * @returns Map of file paths to boolean indicating if they are image directories
 */
export async function checkImageDirectoriesBatch(
  files: string[]
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  // Check all files in parallel
  const checks = await Promise.all(
    files.map(async (file) => {
      const isImageDir = await isImageDirectory(file);
      return { file, isImageDir };
    })
  );

  // Build result map
  for (const { file, isImageDir } of checks) {
    results.set(file, isImageDir);
  }

  return results;
}
