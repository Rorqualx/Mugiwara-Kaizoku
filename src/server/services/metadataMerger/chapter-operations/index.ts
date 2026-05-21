/**
 * Chapter Operations Module
 *
 * Main orchestrator for chapter recreation from provider metadata.
 * Coordinates extraction and database operations for Wikipedia, ComicVine, and Fandom providers.
 */

import { logger } from '@/utils/logger';

import { createChaptersInDatabase } from './chapter-creator';
import { extractComicVineChapters } from './comicvine-extractor';
import { extractFandomChapters } from './fandom-extractor';
import { extractWikipediaChapters } from './wikipedia-extractor';

// Re-export enrichment functions
export { enrichChapterMetadataFromComicVine, enrichChapterMetadataFromFandom } from './enrichment';

// Re-export types
export type { ExtractedChapter, ChapterExtractionResult } from './types';

/**
 * Recreate chapters from provider metadata if needed
 *
 * Handles chapter recreation logic for ComicVine, Wikipedia, and Fandom providers.
 * Deletes existing chapters and creates new ones based on provider metadata.
 *
 * @param mangaId - Database manga ID
 * @param selectedProviders - Map of field names to provider names
 * @param providerMetadata - Provider metadata map
 * @returns True if chapters were recreated, false otherwise
 */
export async function recreateChaptersIfNeeded(
  mangaId: number,
  selectedProviders: Record<string, string>,
  providerMetadata: Record<string, unknown>
): Promise<boolean> {
  // Determine effective chapter provider
  const effectiveChapterProvider = determineChapterProvider(selectedProviders);

  if (!effectiveChapterProvider) {
    logger.info('No chapter provider selected, skipping chapter recreation');
    return false;
  }

  logger.info(`Checking for detailed chapter data from ${effectiveChapterProvider}`);

  // Get the chapter data from the selected provider
  const chapterProviderData = providerMetadata[effectiveChapterProvider];

  logger.info('[DEBUG] chapterProviderData keys:', {
    hasData: !!chapterProviderData,
    isRecord: typeof chapterProviderData === 'object' && chapterProviderData !== null,
    keys: typeof chapterProviderData === 'object' && chapterProviderData !== null
      ? Object.keys(chapterProviderData as Record<string, unknown>)
      : 'not a record',
    type: typeof chapterProviderData
  });

  if (!chapterProviderData) {
    logger.info('No chapter provider data available');
    return false;
  }

  // Extract chapters based on provider
  const extractionResult = await extractChaptersByProvider(effectiveChapterProvider, chapterProviderData);

  // Create chapters in database if extraction was successful
  if (extractionResult.shouldRecreate && extractionResult.chapters.length > 0) {
    logger.info(`[DEBUG] Starting chapter recreation for ${extractionResult.chapters.length} chapters`);
    return createChaptersInDatabase(mangaId, extractionResult.chapters);
  }

  logger.warn(
    `[DEBUG] Skipping chapter recreation: shouldRecreate=${extractionResult.shouldRecreate}, ` +
    `chapters.length=${extractionResult.chapters.length}`
  );
  logger.info('No detailed chapter data available for recreation');
  return false;
}

/**
 * Determine effective chapter provider
 *
 * ComicVine volumes are actually issues/chapters, so we check both
 * chapter and volume providers.
 */
function determineChapterProvider(selectedProviders: Record<string, string>): string | null {
  const chapterProvider = selectedProviders['chapters'];
  const volumeProvider = selectedProviders['volumes'];

  // If ComicVine is the volume provider, use it for chapters too
  const effectiveProvider = volumeProvider === 'comicvine' && !chapterProvider
    ? 'comicvine'
    : chapterProvider;

  logger.info(
    `[DEBUG] Chapter provider determination: chapterProvider=${chapterProvider}, ` +
    `volumeProvider=${volumeProvider}, effectiveChapterProvider=${effectiveProvider}`
  );

  return effectiveProvider ?? null;
}

/**
 * Extract chapters using appropriate provider extractor
 */
async function extractChaptersByProvider(
  provider: string,
  providerData: unknown
): Promise<import('./types').ChapterExtractionResult> {
  switch (provider) {
    case 'wikipedia':
      return extractWikipediaChapters(providerData);

    case 'comicvine':
      return extractComicVineChapters(providerData);

    case 'fandom':
      return extractFandomChapters(providerData);

    default:
      logger.warn(`Unknown chapter provider: ${provider}`);
      return { chapters: [], shouldRecreate: false };
  }
}
