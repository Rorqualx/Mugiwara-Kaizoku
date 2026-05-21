/**
 * Chapter Enrichment
 *
 * Functions for enriching chapter metadata from ComicVine and Fandom providers.
 * Delegates to ChapterEnrichmentService for type-safe enrichment.
 */

import type { ChapterEnrichmentService } from '@/server/services/metadata/chapter-enricher';
import { logger } from '@/utils/logger';


/**
 * Enrich manga chapter metadata from ComicVine
 *
 * Delegates to ChapterEnrichmentService for type-safe enrichment.
 *
 * @param chapterEnricher - ChapterEnrichmentService instance
 * @param mangaId - Database manga ID
 * @returns True if chapter metadata was enriched
 */
export async function enrichChapterMetadataFromComicVine(
  chapterEnricher: ChapterEnrichmentService,
  mangaId: number
): Promise<boolean> {
  const result = await chapterEnricher.enrichFromComicVine({ mangaId });

  if (result.status === 'success') {
    logger.info(
      `Successfully enriched ComicVine chapters for manga ${mangaId}: ${result.data.createdCount} created, ${result.data.updatedCount} updated`
    );
    return true;
  }

  if (result.status === 'error') {
    logger.error(`Failed to enrich ComicVine chapters for manga ${mangaId}:`, result.error);
  }

  return false;
}

/**
 * Enrich chapter metadata from Fandom
 *
 * Delegates to ChapterEnrichmentService for Fandom chapter enrichment.
 * Creates or updates chapters with volume and title information from Fandom.
 *
 * @param chapterEnricher - ChapterEnrichmentService instance
 * @param mangaId - Database manga ID
 * @returns Promise<boolean> - true if enrichment was successful
 */
export async function enrichChapterMetadataFromFandom(
  chapterEnricher: ChapterEnrichmentService,
  mangaId: number
): Promise<boolean> {
  const result = await chapterEnricher.enrichFromFandom({ mangaId });

  if (result.status === 'success') {
    logger.info(
      `Successfully enriched Fandom chapters for manga ${mangaId}: ${result.data.createdCount} created, ${result.data.updatedCount} updated`
    );
    return true;
  }

  if (result.status === 'error') {
    logger.error(`Failed to enrich Fandom chapters for manga ${mangaId}:`, result.error);
  }

  return false;
}
