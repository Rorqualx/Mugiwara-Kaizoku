/**
 * Volume Parser Module
 *
 * Handles parsing of volume tables from Fandom wiki HTML and deduplication.
 */

import { logger } from '@/utils/logger';

import { isRecord, safeGet } from '../metadata-utils';

/**
 * Parse volume tables from HTML and remove duplicates
 * @param html - The HTML content to parse
 * @returns Array of unique volume objects
 */
export async function parseAndDeduplicateVolumes(html: string): Promise<unknown[]> {
  const { parseVolumeTablesEnhanced, parsePageAdaptive } = await import(
    '@/server/services/metadata/utils/fandomTableParser'
  );

  // Parse volume tables with enhanced options
  const volumes: unknown[] = parseVolumeTablesEnhanced(html, parsePageAdaptive);

  // Remove duplicates (some wikis have multiple tables per volume)
  const uniqueVolumes: unknown[] = volumes.filter(
    (vol: unknown, index: number, self: unknown[]) =>
      index ===
      self.findIndex(
        (v: unknown) =>
          isRecord(v) &&
          isRecord(vol) &&
          safeGet(v, 'volumeNumber') === safeGet(vol, 'volumeNumber')
      )
  );

  return uniqueVolumes;
}

/**
 * Extract all chapter URLs from volumes
 * @param volumes - Array of volume objects
 * @returns Array of chapter URLs
 */
export function extractChapterUrls(volumes: unknown[]): string[] {
  const chapterUrls: string[] = [];

  volumes.forEach((vol: unknown) => {
    if (!isRecord(vol)) return;

    const volumeNumber = safeGet(vol, 'volumeNumber');
    const chapters = safeGet(vol, 'chapters');
    if (!Array.isArray(chapters)) return;

    // Log Volume 0 specifically for debugging
    if (volumeNumber === 0) {
      logger.info(`[extractChapterUrls] Volume 0 has ${chapters.length} chapters`);
    }

    chapters.forEach((ch: unknown) => {
      if (!isRecord(ch)) return;

      const url = safeGet(ch, 'url');
      // Log Volume 0 chapter URLs specifically
      if (volumeNumber === 0) {
        logger.info(`[extractChapterUrls] Vol0 chapter: url=${typeof url === 'string' ? url : 'NO URL'}`);
      }
      if (typeof url === 'string') {
        chapterUrls.push(url);
      }
    });
  });

  return chapterUrls;
}
