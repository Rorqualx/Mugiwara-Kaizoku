/**
 * Fandom Chapter Creation
 *
 * Creates chapters from Fandom-specific data structures.
 * Handles both volumeData array structure and flat chapters array formats.
 */

import { logger } from '@/utils/logger';

import { batchCreateChaptersInDatabase } from './database';
import { extractChaptersFromFandomVolumes, extractChaptersFromFandomArray } from './fandom-extractors';
import { safeGet, isRecord } from './helpers';

import type { ChapterToCreate } from './types';

/**
 * Create chapters from Fandom data
 *
 * Handles both volumeData array structure and flat chapters array.
 * Fandom data can come in two formats:
 * 1. volumeData: Array of volumes, each containing a chapters array
 * 2. chapters: Flat array of chapters with volume references
 *
 * @param context - Prisma context for database operations
 * @param mangaId - ID of the manga to associate chapters with
 * @param fandomData - Fandom-specific data structure
 */
// eslint-disable-next-line complexity -- Multi-format data handling: volumeData array, volumeDetails array, or flat chapters array with fallback logic
export async function createFandomChapters(
  context: unknown,
  mangaId: number,
  fandomData: unknown
): Promise<void> {
  logger.info(`[createFandomChapters] Received data:`, {
    isRecord: isRecord(fandomData),
    dataKeys: isRecord(fandomData) ? Object.keys(fandomData).slice(0, 20) : [],
    hasVolumeData: isRecord(fandomData) ? !!safeGet(fandomData, 'volumeData') : false,
    hasVolumeDetails: isRecord(fandomData) ? !!safeGet(fandomData, 'volumeDetails') : false,
    volumeDataLength: isRecord(fandomData) && Array.isArray(safeGet(fandomData, 'volumeData'))
      ? (safeGet(fandomData, 'volumeData') as unknown[]).length : 'N/A',
    volumeDetailsLength: isRecord(fandomData) && Array.isArray(safeGet(fandomData, 'volumeDetails'))
      ? (safeGet(fandomData, 'volumeDetails') as unknown[]).length : 'N/A',
  });

  let chaptersToCreate: ChapterToCreate[] = [];

  // Check if we have volumeData or volumeDetails array structure (from wizard import)
  // NOTE: Fandom uses 'volumeDetails' but the import path may use 'volumeData'
  if (isRecord(fandomData)) {
    const volumeData = safeGet(fandomData, 'volumeData') ?? safeGet(fandomData, 'volumeDetails');
    logger.info(`[createFandomChapters] Checking volumeData/volumeDetails:`, {
      hasVolumeData: !!safeGet(fandomData, 'volumeData'),
      hasVolumeDetails: !!safeGet(fandomData, 'volumeDetails'),
      resolvedExists: !!volumeData,
      isArray: Array.isArray(volumeData),
      type: volumeData ? typeof volumeData : 'undefined',
      length: Array.isArray(volumeData) ? volumeData.length : 0,
      firstVolumeChapters: Array.isArray(volumeData) && volumeData.length > 0 && isRecord(volumeData[0])
        ? (Array.isArray(safeGet(volumeData[0], 'chapters')) ? (safeGet(volumeData[0], 'chapters') as unknown[]).length : 0)
        : 'N/A'
    });

    if (Array.isArray(volumeData)) {
      // Log chapter count per volume for debugging (first 5 volumes)
      const volumeChapterCounts = volumeData.slice(0, 5).map((vol, idx) => {
        if (!isRecord(vol)) return { vol: idx + 1, chapters: 0 };
        const chs = safeGet(vol, 'chapters');
        return {
          vol: safeGet(vol, 'volumeNumber') ?? safeGet(vol, 'number') ?? idx + 1,
          chapters: Array.isArray(chs) ? chs.length : 0
        };
      });
      logger.info(`[createFandomChapters] Volume chapter distribution (first 5):`, volumeChapterCounts);

      chaptersToCreate = extractChaptersFromFandomVolumes(volumeData, mangaId);
    }
  }

  // Check if we have chapters array in the new structure (fallback for flat structure)
  if (chaptersToCreate.length === 0 && isRecord(fandomData)) {
    const chapters = safeGet(fandomData, 'chapters');
    if (Array.isArray(chapters)) {
      chaptersToCreate = extractChaptersFromFandomArray(chapters, mangaId);
    } else {
      logger.warn('No chapters array found in FANDOM data');
    }
  }

  // Create chapters in database
  if (chaptersToCreate.length > 0) {
    await batchCreateChaptersInDatabase(context, chaptersToCreate);
    logger.info(`Successfully created all ${chaptersToCreate.length} chapters from Fandom data`);
  }
}
