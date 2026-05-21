/**
 * Phase 3.5: Wikipedia Fallback Enrichment
 *
 * Fills gaps left by Fandom enrichment using Wikipedia data.
 * Only updates existing chapters — never creates new ones.
 * Skips entirely if Fandom already filled 90%+ of chapter titles.
 *
 * Non-critical: failures log a warning but don't block the pipeline.
 */

import { invalidateMangaCache } from '@/server/trpc/routers/manga/crud-operations/get-manga-cache';
import { logger } from '@/utils/logger';

import {
  convertToGapFillMaps,
} from './wikipedia-fallback/data-conversion';
import {
  fetchAlternativeTitles,
  fetchWikipediaData,
} from './wikipedia-fallback/data-fetching';
import {
  applyWikipediaDataToDb,
} from './wikipedia-fallback/db-application';
import {
  getExistingEnrichmentState,
} from './wikipedia-fallback/enrichment-state';
import {
  hasEnrichmentData,
  logCoverageSkip,
  logGapFillResult,
} from './wikipedia-fallback/logging';
import {
  applyWikipediaVolumeRanges,
} from './wikipedia-fallback/volume-ranges';

import type { EnrichmentProgress } from './types';
import type { WikipediaFallbackOptions } from './wikipedia-fallback/types';

/** Threshold: skip Wikipedia if Fandom already filled this fraction of titles.
 *  Lowered from 0.9 to 0.7 to be more aggressive with Wikipedia gap-fill for
 *  partially-covered titles (descriptions, release dates). */
const COVERAGE_THRESHOLD = 0.7;

/**
 * Run Phase 3.5: Wikipedia fallback enrichment (gap-fill only).
 */
export async function phaseWikipediaFallback(
  mangaId: number,
  title: string,
  onProgress?: EnrichmentProgress,
  options?: WikipediaFallbackOptions,
): Promise<void> {
  await onProgress?.('wikipedia_enrichment', `Gap-filling "${title}" with Wikipedia chapter data...`);

  try {
    logger.info(`[enrichmentPipeline] Starting Wikipedia fallback for manga ${mangaId}: "${title}"`);

    const enrichmentState = await getExistingEnrichmentState(mangaId);
    const needsVolumeData = enrichmentState.volumeCoverageNeedsHelp || (options?.forceVolumeExtraction ?? false);

    if (enrichmentState.coveragePct >= COVERAGE_THRESHOLD && !needsVolumeData) {
      logCoverageSkip(enrichmentState);
      return;
    }
    if (needsVolumeData) {
      logger.info(`[enrichmentPipeline] Wikipedia running — volume data needed (forceVolumeExtraction=${options?.forceVolumeExtraction ?? false})`);
    }

    // Try primary title first, then alternative titles
    let wikipediaData = await fetchWikipediaData(title);
    if (!wikipediaData) {
      const altTitles = await fetchAlternativeTitles(mangaId);
      for (const altTitle of altTitles.slice(0, 3)) {
        logger.info(`[enrichmentPipeline] Wikipedia: trying alt title "${altTitle}"`);
        // eslint-disable-next-line no-await-in-loop -- Sequential fallback search with early return
        wikipediaData = await fetchWikipediaData(altTitle);
        if (wikipediaData) break;
      }
    }
    if (!wikipediaData) {
      logger.info(`[enrichmentPipeline] No Wikipedia data found for "${title}"`);
      return;
    }

    // When volume data is needed, force-include volume assignments regardless of existing state
    const forceVolumeAssignments = needsVolumeData;
    const maps = convertToGapFillMaps(wikipediaData, enrichmentState, forceVolumeAssignments);
    if (!hasEnrichmentData(maps)) {
      logger.info(`[enrichmentPipeline] Wikipedia found no new data to gap-fill`);
      return;
    }

    await applyWikipediaDataToDb(mangaId, maps);

    // When volume coverage needs help and Wikipedia has volume assignments,
    // use them to set Volume ranges and chapter-to-volume assignments
    if (needsVolumeData && Object.keys(maps.chapterVolumeMap).length > 0) {
      await applyWikipediaVolumeRanges(mangaId, maps.chapterVolumeMap);
    }

    await invalidateMangaCache(mangaId);
    logGapFillResult(maps);
  } catch (error) {
    logger.warn(`[enrichmentPipeline] Wikipedia fallback failed (non-critical):`, error);
  }
}
