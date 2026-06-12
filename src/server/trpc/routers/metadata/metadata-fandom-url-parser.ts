/**
 * Metadata Fandom URL Parser Router
 *
 * Handles Fandom wiki URL parsing operations.
 * Uses the adaptive orchestrator for intelligent multi-parser parsing,
 * with fallback to simple parser if adaptive fails.
 */

import { z } from 'zod';

import { adaptiveParse, toVolumeDetails } from '@/server/services/fandom/adaptive';
import { toTRPCError, TRPCErrors } from '@/server/trpc/errors';
import { publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';

import {
  validateFandomUrl,
  fetchFandomPage,
  followVolumesLink,
  parseAndDeduplicateVolumes,
  extractChapterCount,
  extractVolumeFallback,
  transformVolumeDetails,
  countChaptersWithUrls,
  collectChapterUrls,
  fetchChapterDetailsForVolumes,
  mapChapterDetailsToVolumes,
  extractGalleryImages,
  type FandomParseResult,
  type FandomVolumeDetail,
} from './fandom-url-parser-utils';

// ============================================================================
// Helper Types
// ============================================================================

interface ParsedVolumeResult {
  volumeDetails: FandomVolumeDetail[];
  totalVolumes: number;
  totalChapters: number;
}

interface ParsingHints {
  chapterConvention: string | null;
  volumeSelectors: string[];
  chapterSelectors: string[];
  chapterUrlPattern: string | null;
  checkCollapsible: boolean;
  checkNestedLists: boolean;
  hasJpEnTabs: boolean;
  skipSelectors: string[];
}

// ============================================================================
// Helper Functions (extracted to reduce nesting depth)
// ============================================================================

/**
 * Try parsing with the adaptive orchestrator.
 * First attempts with cache, then retries without cache if cache returns no data.
 * @param input - Domain (e.g., "attackontitan.fandom.com") or full URL
 */
async function tryAdaptiveParse(input: string): Promise<ParsedVolumeResult | null> {
  logger.info(`[parseFandomUrl] Trying adaptive parser for ${input}`);

  // First attempt with cache
  let adaptiveResult = await adaptiveParse(input, {
    useCache: true,
    probeTimeoutMs: 15000,
    extractionTimeoutMs: 45000,
  });

  // If cache returned no data (often due to cached pattern not applying enhancements),
  // retry without cache to trigger full discovery with all enhancements
  if (!adaptiveResult.success || !adaptiveResult.data) {
    if (adaptiveResult.usedCache) {
      logger.info(`[parseFandomUrl] Cache hit returned no data, retrying with full discovery for ${input}`);
      adaptiveResult = await adaptiveParse(input, {
        useCache: false,
        probeTimeoutMs: 15000,
        extractionTimeoutMs: 45000,
      });
    }
  }

  if (!adaptiveResult.success || !adaptiveResult.data) {
    logger.warn(`[parseFandomUrl] Adaptive parser returned no data for ${input}`, {
      error: adaptiveResult.error,
    });
    return null;
  }

  const volumeDetails = toVolumeDetails(adaptiveResult);
  const totalVolumes = volumeDetails.length;
  const totalChapters = volumeDetails.reduce((sum, v) => sum + v.chapterCount, 0);

  logger.info(`[parseFandomUrl] Adaptive parser succeeded`, {
    volumes: totalVolumes,
    chapters: totalChapters,
    parsedUrl: adaptiveResult.parsedUrl,
    structureType: adaptiveResult.structureType,
    confidence: adaptiveResult.confidence,
    usedCache: adaptiveResult.usedCache,
  });

  return { volumeDetails, totalVolumes, totalChapters };
}

/**
 * Fallback parsing with simple parser
 */
async function parseWithSimpleParser(
  html: string,
  wikiBaseUrl: string,
  parsingHints?: ParsingHints,
  recommendedParser?: string
): Promise<ParsedVolumeResult> {
  const { load } = await import('cheerio');
  let simpleHtml = html;
  const $ = load(html);

  const volumesHtml = await followVolumesLink($, wikiBaseUrl);
  if (volumesHtml) {
    simpleHtml = volumesHtml;
  }

  const uniqueVolumes = await parseAndDeduplicateVolumes(simpleHtml, parsingHints, recommendedParser, wikiBaseUrl);
  let totalVolumes = uniqueVolumes.length;
  const totalChapters = extractChapterCount(simpleHtml, uniqueVolumes);
  if (totalVolumes === 0) {
    totalVolumes = extractVolumeFallback(simpleHtml) ?? 0;
  }

  const volumeDetails = transformVolumeDetails(uniqueVolumes);
  logger.info(`[parseFandomUrl] Simple parser: ${totalVolumes} volumes, ${totalChapters} chapters`);

  return { volumeDetails, totalVolumes, totalChapters };
}

/**
 * Scrape chapter URLs from individual volume pages when chapters lack URLs.
 * Uses the per-volume iterator to fetch volume pages and extract chapter links.
 */
async function scrapeChapterUrlsFromVolumePages(
  volumeDetails: FandomVolumeDetail[],
  domain: string
): Promise<Map<string, string>> {
  // Build a map of chapterNumber -> URL
  const chapterUrlMap = new Map<string, string>();

  const { iterateVolumePages } = await import('@/server/services/fandom/adaptive/per-volume-iterator');

  logger.info(`[scrapeChapterUrls] Scraping ${volumeDetails.length} volume pages for chapter URLs`);

  const result = await iterateVolumePages(domain, volumeDetails.length, {
    concurrency: 3,
    timeoutMs: 10000,
  });

  if (!result.success || result.volumes.length === 0) {
    logger.warn('[scrapeChapterUrls] Per-volume iterator returned no data');
    return chapterUrlMap;
  }

  // Extract chapter URLs from the scraped data
  for (const vol of result.volumes) {
    for (const ch of vol.chapters) {
      if (ch.url) {
        chapterUrlMap.set(String(ch.number), ch.url);
      }
    }
  }

  logger.info(`[scrapeChapterUrls] Found ${chapterUrlMap.size} chapter URLs from volume pages`);
  return chapterUrlMap;
}

/**
 * Fetch and enrich chapter details.
 * When chapters lack URLs, scrapes them from individual volume pages.
 */
async function enrichChapterDetails(
  volumeDetails: FandomVolumeDetail[],
  wikiBaseUrl: string,
  maxChaptersToFetch: number,
  _chapterUrlPattern?: string | null
): Promise<void> {
  const volumesForCount = volumeDetails.map((v) => ({
    number: v.volumeNumber,
    chapters: v.chapters.map((ch) => ({ url: ch.url })),
  }));
  const chaptersWithUrls = countChaptersWithUrls(volumesForCount);
  const totalChapters = volumeDetails.reduce((sum, v) => sum + v.chapters.length, 0);

  logger.info(`[enrichChapterDetails] ${chaptersWithUrls}/${totalChapters} chapters have URLs`);

  // Case 1: Chapters already have URLs - use standard flow
  if (chaptersWithUrls > 0) {
    const maxToFetch = maxChaptersToFetch > 0 ? maxChaptersToFetch : chaptersWithUrls;
    const chaptersToFetch = collectChapterUrls(volumeDetails, wikiBaseUrl, maxToFetch);
    logger.info(`Fetching details for ${chaptersToFetch.length} chapters (existing URLs)`);

    const chapterDetails = await fetchChapterDetailsForVolumes(chaptersToFetch);
    mapChapterDetailsToVolumes(volumeDetails, chapterDetails, wikiBaseUrl);
    logger.info(`Fetched ${chapterDetails.length} chapter details`);
    return;
  }

  // Case 2: No chapters have URLs - scrape from volume pages
  if (totalChapters === 0) {
    logger.info('[enrichChapterDetails] No chapters to enrich');
    return;
  }

  logger.info('[enrichChapterDetails] Chapters lack URLs, scraping from volume pages');

  // Extract domain from wikiBaseUrl
  const domain = new URL(wikiBaseUrl).host;
  const chapterUrlMap = await scrapeChapterUrlsFromVolumePages(volumeDetails, domain);

  if (chapterUrlMap.size === 0) {
    logger.warn('[enrichChapterDetails] Could not find any chapter URLs from volume pages');
    return;
  }

  // Update chapter URLs in volumeDetails
  for (const vol of volumeDetails) {
    for (const ch of vol.chapters) {
      const url = chapterUrlMap.get(ch.chapterNumber);
      if (url) {
        ch.url = url;
      }
    }
  }

  // Now proceed with standard chapter detail fetching
  const chaptersToFetch: string[] = [];
  for (const vol of volumeDetails) {
    for (const ch of vol.chapters) {
      if (ch.url && chaptersToFetch.length < (maxChaptersToFetch > 0 ? maxChaptersToFetch : totalChapters)) {
        chaptersToFetch.push(ch.url);
      }
    }
  }

  if (chaptersToFetch.length === 0) {
    logger.info('[enrichChapterDetails] No chapter URLs to fetch');
    return;
  }

  logger.info(`[enrichChapterDetails] Fetching details for ${chaptersToFetch.length} chapters (from volume pages)`);

  const chapterDetails = await fetchChapterDetailsForVolumes(chaptersToFetch);
  mapChapterDetailsToVolumes(volumeDetails, chapterDetails, wikiBaseUrl);
  logger.info(`[enrichChapterDetails] Enriched ${chapterDetails.length} chapters via scraped URLs`);
}

/**
 * Discover a chapter/volume list URL by scanning links on the current page.
 * Handles series-specific patterns like "List_of_Attack_on_Titan_chapters".
 */
function discoverChapterListFromPage(
  $: Awaited<ReturnType<typeof import('cheerio')['load']>>,
  wikiBaseUrl: string
): string | null {
  // Look for links to chapter/volume list pages
  const candidates: string[] = [];

  $('a[href*="/wiki/"]').each((_i, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const hrefLower = href.toLowerCase();

    // Match series-specific patterns: List_of_*_chapters, List_of_*_volumes
    if (hrefLower.includes('list_of_') && (hrefLower.includes('_chapters') || hrefLower.includes('_volumes'))) {
      candidates.push(href);
      return;
    }
    // Match generic patterns
    if (
      hrefLower.includes('chapters_and_volumes') ||
      hrefLower.includes('volumes_and_chapters') ||
      hrefLower.includes('/wiki/chapters') ||
      hrefLower.includes('/wiki/volume_list') ||
      hrefLower.includes('/wiki/chapter_list')
    ) {
      candidates.push(href);
    }
  });

  if (candidates.length === 0) return null;

  // Prefer chapter-specific pages over generic volume pages
  const sorted = candidates.sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    const aHasChapters = aLower.includes('chapter') ? 1 : 0;
    const bHasChapters = bLower.includes('chapter') ? 1 : 0;
    return bHasChapters - aHasChapters;
  });

  const best = sorted[0];
  if (!best) return null;

  const fullUrl = best.startsWith('http') ? best : `${wikiBaseUrl}${best}`;
  logger.info(`[discoverChapterListFromPage] Found chapter list link: ${fullUrl}`);
  return fullUrl;
}

/**
 * Main parsing logic - separated to reduce mutation nesting
 */
async function parseFandomUrlInternal(
  url: string,
  fetchChapterCovers: boolean,
  maxChaptersToFetch: number,
  parsingHints?: ParsingHints,
  recommendedParser?: string
): Promise<FandomParseResult> {
  const urlObj = new URL(url);
  const wikiBaseUrl = `${urlObj.protocol}//${urlObj.host}`;
  const domain = urlObj.host;

  // Extract gallery from ORIGINAL page BEFORE any parsing
  const html = await fetchFandomPage(url);
  const { load } = await import('cheerio');
  const $ = load(html);
  const gallery = extractGalleryImages($, url);

  // Detect if the input URL is already a chapter/volume list page
  const urlPath = urlObj.pathname.toLowerCase();
  const isChapterListUrl =
    urlPath.includes('list_of_') ||
    urlPath.includes('chapters_and_volumes') ||
    urlPath.includes('volumes_and_chapters') ||
    urlPath.includes('/chapters') ||
    urlPath.includes('/volumes') ||
    urlPath.includes('chapter_list') ||
    urlPath.includes('volume_list');

  // PRIMARY: Try adaptive orchestrator
  // If the URL is already a chapter/volume list page, pass the full URL to skip re-discovery
  const adaptiveInput = isChapterListUrl ? url : domain;
  logger.info(`[parseFandomUrl] Adaptive input: ${adaptiveInput} (isChapterListUrl: ${isChapterListUrl})`);

  let parseResult = await tryAdaptiveParse(adaptiveInput).catch((err) => {
    logger.warn(`[parseFandomUrl] Adaptive parser failed`, { error: String(err) });
    return null;
  });

  // SECONDARY: If adaptive failed, try to discover chapter list URL from page links
  // This handles cases where HEAD probes fail but the page has direct links
  if (!parseResult || parseResult.totalVolumes === 0) {
    logger.info(`[parseFandomUrl] Adaptive returned 0 volumes, scanning page links for chapter list URL`);
    const chapterListUrl = discoverChapterListFromPage($, wikiBaseUrl);
    if (chapterListUrl) {
      logger.info(`[parseFandomUrl] Found chapter list URL from page links: ${chapterListUrl}`);
      // Try adaptive parse with the discovered URL directly
      parseResult = await tryAdaptiveParse(chapterListUrl).catch((err) => {
        logger.warn(`[parseFandomUrl] Adaptive with discovered URL failed`, { error: String(err) });
        return null;
      });
    }
  }

  // FALLBACK: Use simple parser if adaptive failed
  if (!parseResult || parseResult.totalVolumes === 0) {
    logger.info(`[parseFandomUrl] Using simple parser fallback for ${url}`);
    parseResult = await parseWithSimpleParser(html, wikiBaseUrl, parsingHints, recommendedParser);
  }

  // ENRICHMENT: Fetch chapter details if requested
  if (fetchChapterCovers) {
    const chapterUrlPattern = parsingHints?.chapterUrlPattern ?? null;
    await enrichChapterDetails(
      parseResult.volumeDetails,
      wikiBaseUrl,
      maxChaptersToFetch,
      chapterUrlPattern
    ).catch((err) => {
      logger.error(`Error fetching chapter details: ${String(err)}`);
    });
  }

  const result: FandomParseResult = {
    volumes: parseResult.totalVolumes,
    chapters: parseResult.totalChapters,
    volumeDetails: parseResult.volumeDetails,
  };
  if (gallery.length > 0) {
    result.gallery = gallery;
  }
  return result;
}

// ============================================================================
// Router
// ============================================================================

export const metadataFandomUrlParserRouter = router({
  parseFandomUrl: publicProcedure
    .input(
      z.object({
        url: z.string().url(),
        forceRefresh: z.boolean().optional(),
        fetchChapterCovers: z.boolean().optional().default(false),
        maxChaptersToFetch: z.number().optional().default(0),
        parsingHints: z.object({
          chapterConvention: z.string().nullable(),
          volumeSelectors: z.array(z.string()),
          chapterSelectors: z.array(z.string()),
          chapterUrlPattern: z.string().nullable(),
          checkCollapsible: z.boolean(),
          checkNestedLists: z.boolean(),
          hasJpEnTabs: z.boolean(),
          skipSelectors: z.array(z.string()),
        }).optional(),
        recommendedParser: z.string().optional(),
      })
    )
    .mutation(async ({ input }): Promise<FandomParseResult> => {
      const { url, fetchChapterCovers, maxChaptersToFetch, parsingHints, recommendedParser } = input;

      if (!validateFandomUrl(url)) {
        throw TRPCErrors.badRequest('Not a valid Fandom wiki URL');
      }

      logger.info(`Parsing Fandom URL: ${url}`, { fetchChapterCovers, maxChaptersToFetch });

      try {
        return await parseFandomUrlInternal(
          url,
          fetchChapterCovers,
          maxChaptersToFetch,
          parsingHints,
          recommendedParser
        );
      } catch (error: unknown) {
        logger.error(`Error parsing Fandom URL: ${error instanceof Error ? error.message : String(error)}`);
        throw toTRPCError(
          error instanceof Error ? error : new Error(`Failed to parse Fandom URL: ${String(error)}`)
        );
      }
    }),
});
