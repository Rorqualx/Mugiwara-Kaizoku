/**
 * ComicVine Theme Scraping
 *
 * Handles scraping themes, genres, and cover images from ComicVine pages.
 * Extracted from ComicVineProvider.ts to keep file under 500 lines.
 */

import { comicVineScraper } from '@/server/services/comicvine/scrapingService';
import type { SearchResult } from '@/types/search.types';
import { logger } from '@/utils/logger';

// ============================================================================
// Theme Scraping
// ============================================================================

/**
 * Check if result needs theme/genre scraping
 */
export function needsThemeScraping(result: SearchResult): boolean {
  const hasThemes = result.themes && result.themes.length > 0;
  const metadata = result.metadata as Record<string, unknown> | undefined;
  const metadataThemes = metadata?.['themes'];
  const hasMetadataThemes = Array.isArray(metadataThemes) && metadataThemes.length > 0;

  return !hasThemes && !hasMetadataThemes;
}

/**
 * Scrape and assign themes/genres/coverImage from ComicVine volume page
 *
 * @param result - Search result to update
 * @param siteUrl - ComicVine volume detail page URL
 * @returns Updated search result with themes/genres/coverImage
 */
export async function scrapeAndAssignThemesGenres(
  result: SearchResult,
  siteUrl: string | undefined
): Promise<SearchResult> {
  if (!siteUrl) {
    return result;
  }

  // Skip FlareSolverr scraping for series pages (/4050-)
  if (siteUrl.includes('/4050-')) {
    logger.debug('Skipping theme scraping for series page', { url: siteUrl });
    return result;
  }

  try {
    const scrapedData = await comicVineScraper.scrapeVolumeChapters(siteUrl);
    let enrichedResult = { ...result };

    enrichedResult = assignCoverImage(enrichedResult, scrapedData, siteUrl);
    enrichedResult = assignThemes(enrichedResult, scrapedData, siteUrl);
    enrichedResult = assignGenresFallback(enrichedResult, scrapedData, siteUrl);

    return enrichedResult;
  } catch (scrapeError: unknown) {
    logger.warn('Failed to scrape from ComicVine', { url: siteUrl, error: scrapeError });
    return result;
  }
}

/**
 * Assign cover image from scraped data
 */
function assignCoverImage(
  result: SearchResult,
  scrapedData: { coverImage?: string } | null,
  siteUrl: string
): SearchResult {
  if (!scrapedData?.coverImage || result.coverImage) {
    return result;
  }

  let enrichedResult = { ...result, coverImage: scrapedData.coverImage };

  if (enrichedResult.metadata) {
    enrichedResult = {
      ...enrichedResult,
      metadata: {
        ...(enrichedResult.metadata as Record<string, unknown>),
        coverImage: scrapedData.coverImage,
      },
    };
  }

  logger.debug('Scraped coverImage from ComicVine', { coverImage: scrapedData.coverImage, url: siteUrl });
  return enrichedResult;
}

/**
 * Assign themes from scraped data
 */
function assignThemes(
  result: SearchResult,
  scrapedData: { themes?: string[] } | null,
  siteUrl: string
): SearchResult {
  if (!scrapedData?.themes || scrapedData.themes.length === 0) {
    return result;
  }

  let enrichedResult = { ...result, themes: scrapedData.themes };

  if (enrichedResult.metadata) {
    enrichedResult = {
      ...enrichedResult,
      metadata: {
        ...(enrichedResult.metadata as Record<string, unknown>),
        themes: scrapedData.themes,
      },
    };
  }

  logger.debug('Scraped themes from ComicVine', { themes: scrapedData.themes, url: siteUrl });
  return enrichedResult;
}

/**
 * Assign genres as fallback if no themes and no existing genres
 */
function assignGenresFallback(
  result: SearchResult,
  scrapedData: { genres?: string[] } | null,
  siteUrl: string
): SearchResult {
  if (!scrapedData?.genres || scrapedData.genres.length === 0) {
    return result;
  }

  if (result.genres && result.genres.length > 0) {
    return result;
  }

  logger.debug('Scraped genres from ComicVine', { genres: scrapedData.genres, url: siteUrl });
  return { ...result, genres: scrapedData.genres };
}
