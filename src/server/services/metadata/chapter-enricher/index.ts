/**
 * Chapter Enrichment Service
 *
 * Main aggregator for chapter enrichment from ComicVine and Fandom.
 * Delegates to provider-specific enrichers for implementation.
 *
 * Architecture:
 * - chapter-enricher/types.ts - Shared types (6 exports)
 * - chapter-enricher/comicvine-enricher.ts - ComicVine integration (9 methods)
 * - chapter-enricher/fandom-enricher.ts - Fandom integration (1 method)
 * - chapter-enricher/index.ts - Main service (2 methods + singleton)
 *
 * Original: 564 lines → Refactored: ~100 lines (82% reduction)
 */

import { logger } from '@/server/utils/logger';
import type { AsyncResult } from '@/utils/validation/async-result';

import { comicVineEnricher } from './comicvine-enricher';
import { fandomEnricher } from './fandom-enricher';

import type { EnrichChaptersInput, EnrichChaptersResult } from './types';

/**
 * Chapter Enrichment Service
 *
 * Delegates to provider-specific enrichers based on manga source.
 */
export class ChapterEnrichmentService {
  private logger = logger;

  /**
   * Enrich chapter metadata from ComicVine
   *
   * Fetches issues from ComicVine API and creates/updates Chapter records.
   * Only works for manga with source='comicvine'.
   *
   * @param input - Enrichment input with manga ID
   * @returns AsyncResult with enrichment statistics
   */
  async enrichFromComicVine(
    input: EnrichChaptersInput
  ): Promise<AsyncResult<EnrichChaptersResult, Error>> {
    return comicVineEnricher.enrichFromComicVine(input);
  }

  /**
   * Enrich chapter metadata from Fandom
   *
   * Fetches and parses volume/chapter tables from Fandom wiki pages.
   * Creates/updates Chapter records with volume assignments.
   *
   * @param input - Enrichment input with manga ID
   * @returns AsyncResult with enrichment statistics
   */
  async enrichFromFandom(
    input: EnrichChaptersInput
  ): Promise<AsyncResult<EnrichChaptersResult, Error>> {
    return fandomEnricher.enrichFromFandom(input);
  }
}

/**
 * Singleton instance management
 */
let chapterEnrichmentServiceInstance: ChapterEnrichmentService | null = null;

/**
 * Get singleton instance of ChapterEnrichmentService
 */
export function getChapterEnrichmentService(): ChapterEnrichmentService {
  chapterEnrichmentServiceInstance ??= new ChapterEnrichmentService();
  return chapterEnrichmentServiceInstance;
}

/**
 * Export singleton instance (backward compatible)
 */
export const chapterEnrichmentService = getChapterEnrichmentService();

/**
 * Re-export types for convenience
 */
export type { EnrichChaptersInput, EnrichChaptersResult } from './types';
