/**
 * Volume-Based Chapter Creation
 *
 * Main orchestrator for creating chapters from volume data.
 * This module coordinates the three priority handlers:
 * 1. Pre-parsed chapters (from Fandom, AniList, etc.)
 * 2. Description-parsed chapters (from ComicVine)
 * 3. Fallback estimated chapters
 */

import { logger } from '@/utils/logger';

import { batchCreateChaptersInDatabase } from '../database';
import { mergeMissingChaptersFromEnrichment, sortAndAssignSequentialIndices } from '../enrichment';
import { isRecord } from '../helpers';
import { normalizeVolumeData } from '../normalizer';

import { handleDescriptionParsedChapters } from './description-parser-handler';
import { handleFallbackChapters } from './fallback-handler';
import { handlePreParsedChapters } from './pre-parsed-handler';

import type { ChapterToCreate, ChapterEnrichment } from '../types';

// Re-export types for consumers
export type { ChapterToCreate, ChapterEnrichment, NormalizedVolume } from '../types';

/**
 * Create chapters from volume data with optional enrichment
 *
 * This is the main entry point for creating chapters from volume/issue data.
 * It handles multiple data sources and applies enrichment from any provider.
 *
 * @param context - Prisma context for database operations
 * @param mangaId - ID of the manga to associate chapters with
 * @param volumes - Array of volume/issue data from any provider
 * @param chapterEnrichment - Optional enrichment data (e.g., from Fandom)
 */
export async function createChaptersFromVolumes(
  context: unknown,
  mangaId: number,
  volumes: unknown[],
  chapterEnrichment?: ChapterEnrichment
): Promise<void> {
  logger.info(`Creating chapters from volume data... Found ${volumes.length} volumes`);

  if (volumes.length > 0) {
    logger.debug(`First volume structure: ${JSON.stringify(volumes[0], null, 2)}`);
  }

  if (chapterEnrichment) {
    logger.info(`[createChaptersFromVolumes] Using chapter enrichment data for ${Object.keys(chapterEnrichment).length} chapters`);
  }

  // Import the chapter parser (ComicVine-specific, used as fallback for volumes without pre-parsed chapters)
  const { parseChaptersFromDescription } = await import('@/utils/comicvine-chapter-parser');

  let chaptersToCreate: ChapterToCreate[] = [];
  let globalChapterIndex = 0; // Use 0-based indexing to match enrichment logic

  for (let i = 0; i < volumes.length; i++) {
    const volumeData = volumes[i];
    if (!isRecord(volumeData)) continue;

    // Normalize volume data to handle different provider field names
    const normalized = normalizeVolumeData(volumeData, i);

    logger.debug(`[createChaptersFromVolumes] Processing volume ${i + 1}/${volumes.length}:`, {
      volumeNumber: normalized.volumeNumber,
      title: normalized.title,
      hasPreParsedChapters: !!normalized.chapters,
      chapterCount: normalized.chapters ? normalized.chapters.length : 0,
      volumeDataKeys: Object.keys(volumeData).slice(0, 10)
    });

    // PRIORITY 1: Check if volume already has parsed chapters array (from any provider)
    if (Array.isArray(normalized.chapters) && normalized.chapters.length > 0) {
      const result = handlePreParsedChapters(normalized, mangaId, globalChapterIndex, chapterEnrichment);
      chaptersToCreate.push(...result.chapters);
      globalChapterIndex = result.globalChapterIndex;
      continue;
    }

    // PRIORITY 2: Try to parse chapters from the volume description (primarily for ComicVine)
    // Other providers (Fandom, AniList, Wikipedia) typically include chapters in PRIORITY 1
    const parsedChapters = parseChaptersFromDescription(normalized.description);
    if (parsedChapters.length > 0) {
      chaptersToCreate.push(...handleDescriptionParsedChapters(normalized, mangaId, parseChaptersFromDescription));
      continue;
    }

    // PRIORITY 3: Fallback - estimate chapters when no data available
    const fallbackResult = handleFallbackChapters(normalized, mangaId, globalChapterIndex);
    chaptersToCreate.push(...fallbackResult.chapters);
    globalChapterIndex = fallbackResult.globalChapterIndex;
  }

  logger.info(`[createChaptersFromVolumes] Finished processing all volumes. Total chapters to create: ${chaptersToCreate.length}`);

  // PHASE: Merge missing chapters from Fandom enrichment BEFORE creating
  // ComicVine data sometimes has gaps. Merge with Fandom enrichment to get complete chapter list.
  if (chapterEnrichment) {
    chaptersToCreate = mergeMissingChaptersFromEnrichment(chaptersToCreate, chapterEnrichment, mangaId);
  }

  // Sort and assign sequential indices
  chaptersToCreate = sortAndAssignSequentialIndices(chaptersToCreate);

  logger.info(`[createChaptersFromVolumes] Assigned sequential indices for ${chaptersToCreate.length} chapters (sorted by chapter number)`);

  if (chaptersToCreate.length > 0) {
    logger.debug(`[createChaptersFromVolumes] Sample chapter data (first 3):`,
      chaptersToCreate.slice(0, 3).map(c => ({
        title: c.title,
        index: c.index,
        volume: c.volume,
        fileName: c.fileName,
        chapterNumber: c.chapterNumber
      }))
    );
  }

  // Create chapters in database in batches
  await batchCreateChaptersInDatabase(context, chaptersToCreate);

  logger.info(`Successfully created ${chaptersToCreate.length} chapters from ${volumes.length} volumes`);
}
