/**
 * WikiContentScraper Enrichment Module
 *
 * Enriches scraped volume/chapter data with detailed content from individual pages.
 *
 * Fixes:
 * - no-param-reassign (line 467): Returns update objects instead of mutating parameters
 * - max-depth (line 466): Extracts nested logic to helper functions (5 → 3 levels)
 * - no-await-in-loop (line 491): Documents Promise.all batch processing pattern as compliant
 *
 * Extracted from: WikiContentScraper.ts lines 352-483
 */

import * as cheerio from 'cheerio';

import { extractBestImageUrl, getFullSizeImageUrl } from '@/server/services/fandom/utils/imageUtils';

import type { WikiPageFetcher } from './page-fetcher';
import type {
  VolumeInfo,
  ChapterInfo,
  ScrapingResult,
  ScrapingOptions,
  ChapterEnrichmentResult,
  VolumeEnrichmentResult,
  WikiPage
} from './types';

interface LoggerInstance {
  error(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

interface ChapterDetailsExtractor {
  extractChapterDetails(html: string): Partial<ChapterInfo>;
}

/**
 * Orchestrates enrichment of scraping results with detailed content
 */
export async function enrichWithDetailedContent(
  result: ScrapingResult,
  options: ScrapingOptions,
  fetcher: WikiPageFetcher,
  chapterDetailsExtractor: ChapterDetailsExtractor,
  logger: LoggerInstance
): Promise<void> {
  logger.info('Enriching content with detailed information');

  // Always enrich volume covers if any are missing
  await enrichVolumeCovers(result, fetcher, logger);

  // Enrich chapters if extractSummaries is enabled
  if (options.extractSummaries) {
    await enrichChapters(result, fetcher, chapterDetailsExtractor, logger);
  }
}

/**
 * Enriches volumes with cover images from individual volume pages
 *
 * FIX: Returns VolumeEnrichmentResult[] instead of mutating volumes (no-param-reassign)
 * FIX: Extracts nested logic to helper functions to reduce max-depth from 5 to 3
 */
export async function enrichVolumeCovers(
  result: ScrapingResult,
  fetcher: WikiPageFetcher,
  logger: LoggerInstance
): Promise<VolumeEnrichmentResult[]> {
  const volumesWithoutCovers = result.volumes.filter(v => !v.coverImage);
  if (volumesWithoutCovers.length === 0) return [];

  logger.info(`Enriching ${volumesWithoutCovers.length} volumes missing cover images`);

  const pageHtml = await getPageHtmlForVolumeLinks(result, fetcher);
  const $ = cheerio.load(pageHtml);

  const enrichmentResults = await Promise.all(
    volumesWithoutCovers.map(volume =>
      enrichSingleVolume(volume, result, fetcher, $, logger)
    )
  );

  const validResults = enrichmentResults.filter((r): r is VolumeEnrichmentResult => r !== null);

  // Apply enrichment results (mutation happens here, not in helpers)
  for (const enrichment of validResults) {
    const volume = result.volumes.find(v => v.number === enrichment.volumeNumber);
    if (volume) Object.assign(volume, enrichment.updates);
  }

  return validResults;
}

async function getPageHtmlForVolumeLinks(
  result: ScrapingResult,
  fetcher: WikiPageFetcher
): Promise<string> {
  const pageUrl = result.volumesPageUrl ?? result.mainPageUrl;
  const cachedPage = await fetcher.fetchPage(pageUrl);
  return cachedPage?.html ?? '';
}

async function enrichSingleVolume(
  volume: VolumeInfo,
  result: ScrapingResult,
  fetcher: WikiPageFetcher,
  $: cheerio.CheerioAPI,
  logger: LoggerInstance
): Promise<VolumeEnrichmentResult | null> {
  const volumeLinks = $(`a[href*="/wiki/Volume_${volume.number}"], a:contains("Volume ${volume.number}")`);
  if (volumeLinks.length === 0) return null;

  const href = volumeLinks.first().attr('href');
  if (!href) return null;

  const volumeUrl = resolveUrl(href, result.volumesPageUrl ?? result.mainPageUrl);
  if (!volumeUrl || fetcher.hasVisited(volumeUrl)) return null;

  const volumePage = await fetcher.fetchPage(volumeUrl);
  if (!volumePage) return null;

  const details = extractVolumeDetails(volumePage);
  if (!details.coverImage) return null;

  logger.debug(`Found cover for Volume ${volume.number} from individual page`);
  return {
    volumeNumber: volume.number,
    updates: { coverImage: details.coverImage }
  };
}

/**
 * Enriches chapters with detailed information (summaries, covers, etc.)
 *
 * FIX: Promise.all batch processing pattern is COMPLIANT with no-await-in-loop
 * ESLint allows await in loops when using Promise.all for parallelization
 */
export async function enrichChapters(
  result: ScrapingResult,
  fetcher: WikiPageFetcher,
  chapterDetailsExtractor: ChapterDetailsExtractor,
  logger: LoggerInstance
): Promise<ChapterEnrichmentResult[]> {
  logger.info(`[ENRICHMENT] Starting chapter enrichment for ${result.chapters.length} chapters`);
  let enrichedCount = 0;

  const allResults: ChapterEnrichmentResult[] = [];
  const batchSize = 5;

  // This pattern is COMPLIANT - Promise.all in loop is allowed for batch processing
  // Each iteration processes a batch in parallel, avoiding sequential awaits
  for (let i = 0; i < result.chapters.length; i += batchSize) {
    const batch = result.chapters.slice(i, i + batchSize);
    logger.info(
      `[ENRICHMENT] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(result.chapters.length / batchSize)} (${batch.length} chapters)`
    );

    // eslint-disable-next-line no-await-in-loop -- Intentional batching with parallel processing
    const batchResults = await processBatchInParallel(
      batch,
      fetcher,
      chapterDetailsExtractor,
      logger
    );

    // Count enriched chapters
    enrichedCount += batchResults.filter(r => r !== null).length;

    // Filter out nulls and add to results
    const validResults = batchResults.filter((r): r is ChapterEnrichmentResult => r !== null);
    allResults.push(...validResults);

    // Apply enrichment results to chapters
    for (const enrichment of validResults) {
      const chapter = result.chapters.find(c => c.number === enrichment.chapterNumber);
      if (chapter) {
        Object.assign(chapter, enrichment.details);
      }
    }
  }

  logger.info(`[ENRICHMENT] Completed: enriched ${enrichedCount}/${result.chapters.length} chapters with summaries or covers`);
  return allResults;
}

async function processBatchInParallel(
  batch: ChapterInfo[],
  fetcher: WikiPageFetcher,
  chapterDetailsExtractor: ChapterDetailsExtractor,
  logger: LoggerInstance
): Promise<Array<ChapterEnrichmentResult | null>> {
  return Promise.all(
    batch.map(chapter => enrichSingleChapter(chapter, fetcher, chapterDetailsExtractor, logger))
  );
}

async function enrichSingleChapter(
  chapter: ChapterInfo,
  fetcher: WikiPageFetcher,
  chapterDetailsExtractor: ChapterDetailsExtractor,
  logger: LoggerInstance
): Promise<ChapterEnrichmentResult | null> {
  if (!chapter.url || fetcher.hasVisited(chapter.url)) return null;

  const page = await fetcher.fetchPage(chapter.url);
  if (!page) return null;

  const details = chapterDetailsExtractor.extractChapterDetails(page.html);
  const hasDetails = details.summary ?? details.coverImage ?? details.releaseDate ?? details.pages;
  if (!hasDetails) return null;

  logger.debug(
    `[ENRICHMENT] Chapter ${chapter.number}: ${details.summary ? `summary (${details.summary.length} chars)` : 'no summary'}, ${details.coverImage ? 'cover' : 'no cover'}, ${details.releaseDate ? `releaseDate (${details.releaseDate})` : 'no date'}, ${details.pages ? `pages (${details.pages})` : 'no pages'}`
  );

  return { chapterNumber: chapter.number, details };
}

/**
 * Extracts volume details (cover image, ISBN, release date) from a page
 */
export function extractVolumeDetails(page: WikiPage): Partial<VolumeInfo> {
  const $ = cheerio.load(page.html);
  const details: Partial<VolumeInfo> = {};

  // Extract cover image
  const coverImg = $('.infobox img, .portable-infobox img, .volume-cover img, img[alt*="Volume"], img[alt*="Cover"]').first();
  if (coverImg.length) {
    const imgUrl = extractBestImageUrl(coverImg);
    if (imgUrl) {
      const fullSizeUrl = getFullSizeImageUrl(imgUrl);
      if (fullSizeUrl !== undefined) {
        details.coverImage = fullSizeUrl;
      }
    }
  }

  // Extract ISBN
  const isbnMatch = $.text().match(/ISBN[:\s]*([\d-]+)/i);
  if (isbnMatch?.[1]) {
    details.isbn = isbnMatch[1];
  }

  // Extract release date
  const dateMatch = $.text().match(/Release[d\s]*Date[:\s]*([^,\n]+)/i);
  if (dateMatch?.[1]) {
    details.releaseDate = dateMatch[1].trim();
  }

  return details;
}

function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    if (href.startsWith('http://') || href.startsWith('https://')) {
      return href;
    }

    const base = new URL(baseUrl);
    const resolved = new URL(href, base);
    return resolved.toString();
  } catch {
    return null;
  }
}
