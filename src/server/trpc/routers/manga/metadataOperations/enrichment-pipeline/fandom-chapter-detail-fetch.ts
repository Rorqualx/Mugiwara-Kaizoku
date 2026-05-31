/**
 * Fandom Chapter Detail Fetcher
 *
 * Batch-fetches individual Fandom chapter pages for covers, descriptions,
 * and page counts. Extracts URL templates from scraped URLs to fill gaps.
 *
 * Extracted from phase-fandom-enrichment.ts to keep file sizes manageable.
 *
 * @module enrichment-pipeline/fandom-chapter-detail-fetch
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import { tryAdaptiveParser } from './fandom-adaptive-bridge';
import { loadChapterUrlTemplate } from './fandom-provider-storage';
import { extractTemplateFromUrls, generateUrlsFromTemplate } from './fandom-url-template';

import type { ChapterEnrichmentMaps, ChapterUrlTemplate, EnrichmentPipelineOptions, EnrichmentProgress } from './types';

/** Result from chapter detail fetch attempt */
export interface ChapterDetailFetchResult {
  /** Whether any chapter details were fetched */
  fetched: boolean;
  /** Freshly extracted URL template (never a loaded stored template) */
  discoveredTemplate: ChapterUrlTemplate | null;
  /** True when a stored template was used but produced no covers (should be cleared) */
  storedTemplateFailed: boolean;
}

/**
 * Build a map of chapter URL → chapter number from scraped URLs only.
 * Never guesses URLs — only uses URLs that were actually scraped from wiki pages.
 */
export function buildChapterUrlMap(
  baseUrl: string,
  chapterNumbers: number[],
  adaptiveResult: Awaited<ReturnType<typeof tryAdaptiveParser>>,
  existingCoverMap: Record<number, string>,
  existingDescMap: Record<number, string>,
): Map<string, number> {
  const knownUrls = new Map<number, string>();

  for (const ch of adaptiveResult?.data?.chapterList ?? []) {
    const raw = ch.number ?? ch.chapterNumber;
    const num = typeof raw === 'number' ? raw : (typeof raw === 'string' ? parseFloat(raw) : undefined);
    if (num === undefined || isNaN(num) || !ch.url) continue;
    knownUrls.set(num, ch.url.startsWith('http') ? ch.url : `${baseUrl}${ch.url}`);
  }

  const urlToChapterNum = new Map<string, number>();
  for (const num of chapterNumbers) {
    // Include chapters that need either a cover OR a description
    if (existingCoverMap[num] && existingDescMap[num]) continue;
    const known = knownUrls.get(num);
    if (known) urlToChapterNum.set(known, num);
  }

  return urlToChapterNum;
}

/** Pattern matching generic chapter titles like "Chapter 1", "Episode 5" */
const GENERIC_TITLE_RE = /^(?:(?:Chapter|Episode|Ch\.?)\s+\d+|第\d+[話章])$/i;

/** Collect chapter numbers from all sources and trigger detail fetch if needed */
export async function tryChapterDetailFetch(
  ctx: { mangaId: number; dbChapterCount: number; fandomUrl: string },
  adaptiveResult: Awaited<ReturnType<typeof tryAdaptiveParser>>,
  maps: ChapterEnrichmentMaps,
  onProgress?: EnrichmentProgress,
  options?: EnrichmentPipelineOptions,
): Promise<ChapterDetailFetchResult> {
  const { mangaId, dbChapterCount, fandomUrl } = ctx;
  const coverCount = Object.keys(maps.chapterCoverMap).length;
  const descCount = Object.keys(maps.chapterDescriptionMap).length;
  const pagesCount = Object.keys(maps.chapterPagesMap).length;
  const chapterNumbers = await collectChapterNumbers(adaptiveResult, maps, mangaId, dbChapterCount);

  // Trigger detail fetch when ANY one of covers / descriptions / pages is
  // below 50%. Earlier this required covers AND descs BOTH to be below 50%,
  // which let a title with 60% covers but 40% descriptions silently skip the
  // per-chapter scrape — leaving descriptions stuck partial forever. The fill
  // phases are idempotent (don't overwrite real data) so triggering when any
  // single field type lags is safe and prevents permanently-partial states.
  const threshold = chapterNumbers.length * 0.5;
  const needsDetails = chapterNumbers.length > 0
    && (coverCount < threshold || descCount < threshold || pagesCount < threshold);
  if (!needsDetails) return { fetched: false, discoveredTemplate: null, storedTemplateFailed: false };

  // Skip chapters that already have a non-generic title AND a cover image
  const enrichedSet = await getAlreadyEnrichedChapterNumbers(mangaId);
  const filteredNumbers = chapterNumbers.filter(n => !enrichedSet.has(n));
  if (filteredNumbers.length < chapterNumbers.length) {
    logger.info(`[enrichmentPipeline] Skipping ${chapterNumbers.length - filteredNumbers.length} already-enriched chapters`);
  }
  if (filteredNumbers.length === 0) return { fetched: false, discoveredTemplate: null, storedTemplateFailed: false };

  await onProgress?.('fandom_enrichment', `Fetching covers from ${filteredNumbers.length} Fandom chapter pages...`);
  const result = await fetchChapterDetailsFromFandom({ mangaId, fandomUrl, chapterNumbers: filteredNumbers, adaptiveResult, maps, onProgress, options });
  return { fetched: true, ...result };
}

/** Query DB for chapter numbers that already have non-generic title AND cover image */
async function getAlreadyEnrichedChapterNumbers(mangaId: number): Promise<Set<number>> {
  // title is non-nullable in schema (String, not String?), so filter for non-empty
  // coverImage is nullable (String?), so filter for not-null
  const enriched = await prisma.chapter.findMany({
    where: {
      mangaId,
      coverImage: { not: null },
      title: { not: '' },
    },
    select: { chapterNumber: true, title: true },
  });

  const result = new Set<number>();
  for (const ch of enriched) {
    if (ch.chapterNumber === null) continue;
    if (!GENERIC_TITLE_RE.test(ch.title)) {
      result.add(ch.chapterNumber);
    }
  }
  return result;
}

/** Collect chapter numbers from title map, adaptive result, and DB */
async function collectChapterNumbers(
  adaptiveResult: Awaited<ReturnType<typeof tryAdaptiveParser>>,
  maps: ChapterEnrichmentMaps,
  mangaId: number,
  dbChapterCount: number,
): Promise<number[]> {
  const chapterNumbers = Object.keys(maps.chapterTitleMap).map(Number).filter((n) => !isNaN(n));

  for (const ch of adaptiveResult?.data?.chapterList ?? []) {
    const num = parseFloat(String(ch.number ?? ch.chapterNumber));
    if (!isNaN(num) && ch.url && !chapterNumbers.includes(num)) chapterNumbers.push(num);
  }

  // Always supplement from DB when the adaptive parser found significantly fewer
  // chapters than exist — e.g., a table parser may extract 23 chapters from volume
  // tables while the page actually has 383 in list items. DB chapters ensure the
  // template gap-fill generates URLs for all chapters needing covers.
  if (dbChapterCount > 0 && chapterNumbers.length < dbChapterCount * 0.5) {
    await appendDbChapterNumbers(mangaId, chapterNumbers);
  }

  return chapterNumbers;
}

/** Append chapter numbers from DB (chapters missing covers) */
async function appendDbChapterNumbers(mangaId: number, target: number[]): Promise<void> {
  const dbChapters = await prisma.chapter.findMany({
    where: { mangaId, coverImage: null },
    select: { chapterNumber: true },
  });
  const existing = new Set(target);
  for (const c of dbChapters) {
    if (c.chapterNumber !== null && !existing.has(c.chapterNumber)) {
      target.push(c.chapterNumber);
      existing.add(c.chapterNumber);
    }
  }
}

/** Pattern matching generic chapter titles like "Chapter 1", "Episode 5", "第1話" */
const GENERIC_TITLE_PATTERN = /^(?:(?:Chapter|Episode|Ch\.?)\s+\d+|第\d+[話章])$/i;

/** Merge fetched chapter details into the enrichment maps (gap-fill only) */
function mergeChapterDetails(
  details: Array<{ url: string; title?: string; coverImageUrl?: string; description?: string; pageCount?: number; releaseDate?: string }>,
  urlToChapterNum: Map<string, number>,
  maps: ChapterEnrichmentMaps,
): { coversFound: number; descsFound: number } {
  let coversFound = 0;
  let descsFound = 0;

  /* eslint-disable no-param-reassign -- Intentional in-place mutation of enrichment maps */
  for (const detail of details) {
    const chNum = urlToChapterNum.get(detail.url);
    if (chNum === undefined) continue;

    // Merge real titles from infobox — replace generic "Chapter N" with actual title
    if (detail.title && !GENERIC_TITLE_PATTERN.test(detail.title)) {
      const existing = maps.chapterTitleMap[chNum];
      if (!existing || GENERIC_TITLE_PATTERN.test(existing)) {
        maps.chapterTitleMap[chNum] = detail.title;
      }
    }
    if (detail.coverImageUrl && !maps.chapterCoverMap[chNum]) { maps.chapterCoverMap[chNum] = detail.coverImageUrl; coversFound++; }
    if (detail.description && !maps.chapterDescriptionMap[chNum]) { maps.chapterDescriptionMap[chNum] = detail.description; descsFound++; }
    if (detail.pageCount !== undefined && !maps.chapterPagesMap[chNum]) maps.chapterPagesMap[chNum] = detail.pageCount;
    if (detail.releaseDate && !maps.chapterReleaseDateMap[chNum]) maps.chapterReleaseDateMap[chNum] = detail.releaseDate;
  }
  /* eslint-enable no-param-reassign */

  return { coversFound, descsFound };
}

/** Apply template-based gap-fill to scraped URL map, returning the extracted template */
function applyTemplateGapFill(
  urlToChapterNum: Map<string, number>,
  baseUrl: string,
  chapterNumbers: number[],
  existingCoverMap: Record<number, string>,
  existingDescMap: Record<number, string>,
): ChapterUrlTemplate | null {
  const template = extractTemplateFromUrls(urlToChapterNum, baseUrl);
  if (!template || urlToChapterNum.size >= chapterNumbers.length) return template;

  const gapUrls = generateUrlsFromTemplate(template, chapterNumbers, urlToChapterNum);
  const priorSize = urlToChapterNum.size;
  for (const [url, num] of gapUrls) {
    if (!existingCoverMap[num] || !existingDescMap[num]) urlToChapterNum.set(url, num);
  }
  logger.info(`[enrichmentPipeline] Template gap-fill: ${urlToChapterNum.size} total URLs (was ${priorSize})`);
  return template;
}

/** Try loading a stored template from a previous enrichment run */
async function tryStoredTemplate(
  mangaId: number,
  chapterNumbers: number[],
  existingUrls: Map<string, number>,
  forceRefresh: boolean,
): Promise<{ urls: Map<string, number>; template: ChapterUrlTemplate | null }> {
  if (forceRefresh) return { urls: new Map(), template: null };

  const stored = await loadChapterUrlTemplate(mangaId);
  if (!stored) return { urls: new Map(), template: null };

  const urls = generateUrlsFromTemplate(stored, chapterNumbers, existingUrls);
  logger.info(`[enrichmentPipeline] Using stored template "${stored.template}" for ${urls.size} URLs`);
  return { urls, template: stored };
}

/**
 * Batch-fetch individual Fandom chapter pages for covers and descriptions.
 *
 * Extracts URL templates from scraped URLs to fill gaps for chapters
 * that weren't scraped (e.g., Berserk chapters 280-390).
 */
/** Context for fetching chapter details */
interface FetchDetailCtx {
  mangaId: number;
  fandomUrl: string;
  chapterNumbers: number[];
  adaptiveResult: Awaited<ReturnType<typeof tryAdaptiveParser>>;
  maps: ChapterEnrichmentMaps;
  onProgress?: EnrichmentProgress | undefined;
  options?: EnrichmentPipelineOptions | undefined;
}

/** Result from the internal fetch function */
interface FetchResult {
  discoveredTemplate: ChapterUrlTemplate | null;
  storedTemplateFailed: boolean;
}

async function fetchChapterDetailsFromFandom(ctx: FetchDetailCtx): Promise<FetchResult> {
  const { mangaId, fandomUrl, chapterNumbers, adaptiveResult, maps, onProgress, options } = ctx;
  let discoveredTemplate: ChapterUrlTemplate | null = null;
  let usedStoredTemplate = false;
  let storedTemplateFailed = false;

  try {
    const { chapterDetailService } = await import('@/server/services/fandom/chapter-detail');
    const baseUrl = fandomUrl.replace(/\/wiki\/.*$/, '').replace(/\/$/, '');
    let urlToChapterNum = buildChapterUrlMap(baseUrl, chapterNumbers, adaptiveResult, maps.chapterCoverMap, maps.chapterDescriptionMap);

    // Extract template from scraped URLs and fill gaps
    if (urlToChapterNum.size > 0) {
      discoveredTemplate = applyTemplateGapFill(urlToChapterNum, baseUrl, chapterNumbers, maps.chapterCoverMap, maps.chapterDescriptionMap);
    }

    // Fallback: try stored template from previous enrichment run
    // NOTE: stored templates are NOT returned as discoveredTemplate — they must
    // prove themselves by producing covers, otherwise they decay via TTL.
    if (urlToChapterNum.size === 0) {
      const stored = await tryStoredTemplate(mangaId, chapterNumbers, urlToChapterNum, options?.forceRefresh ?? false);
      if (stored.urls.size > 0) { urlToChapterNum = stored.urls; usedStoredTemplate = true; }
    }

    // Fallback: scrape chapter URLs directly from the wiki page via MediaWiki API.
    // More accurate than URL construction — extracts actual links from the page HTML.
    // Use the adaptive parser's parsed URL (e.g., List_of_Chapters) — NOT the wiki home page.
    if (urlToChapterNum.size < chapterNumbers.length * 0.3) {
      const scrapePage = adaptiveResult?.parsedUrl ?? fandomUrl;
      const scraped = await scrapeChapterUrlsFromWikiPage(scrapePage, baseUrl, chapterNumbers, maps.chapterCoverMap);
      // Merge scraped URLs (don't overwrite existing known URLs)
      for (const [url, num] of scraped) {
        if (!urlToChapterNum.has(url)) urlToChapterNum.set(url, num);
      }
      if (scraped.size > 0) {
        logger.info(`[enrichmentPipeline] Scraped ${scraped.size} chapter URLs from wiki page (total: ${urlToChapterNum.size})`);
      }
    }

    if (urlToChapterNum.size === 0) return { discoveredTemplate, storedTemplateFailed };

    const details = await batchFetchDetails(chapterDetailService, urlToChapterNum, onProgress);
    const { coversFound, descsFound } = mergeChapterDetails(details, urlToChapterNum, maps);
    logger.info(`[enrichmentPipeline] Chapter detail fetch: ${coversFound} covers, ${descsFound} descriptions from ${details.length}/${urlToChapterNum.size} pages`);

    // Validate stored template effectiveness — if <10% of generated URLs yielded
    // covers, the template is bad and should be cleared from storage.
    if (usedStoredTemplate && urlToChapterNum.size > 0) {
      const successRate = coversFound / urlToChapterNum.size;
      if (successRate < 0.1) {
        logger.warn(`[enrichmentPipeline] Stored template ineffective (${coversFound}/${urlToChapterNum.size} covers) — marking for removal`);
        storedTemplateFailed = true;
      }
    }

    // Only persist fresh templates that actually produced covers
    if (discoveredTemplate && coversFound === 0) {
      logger.info(`[enrichmentPipeline] Fresh template produced 0 covers — not persisting`);
      discoveredTemplate = null;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[enrichmentPipeline] Chapter detail batch fetch failed (non-critical): ${msg}`);
  }

  return { discoveredTemplate, storedTemplateFailed };
}

/**
 * Scrape chapter URLs directly from a Fandom wiki page via MediaWiki API.
 * Extracts all `<a href="/wiki/...">` links from `<li>` items that contain
 * chapter numbers. More accurate than URL construction since it uses actual
 * links from the page rather than guessing URL patterns.
 */
async function scrapeChapterUrlsFromWikiPage(
  pageUrl: string,
  baseUrl: string,
  chapterNumbers: number[],
  existingCoverMap: Record<number, string>,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const needed = new Set(chapterNumbers.filter(n => !existingCoverMap[n]));
  if (needed.size === 0) return result;

  try {
    const { fetchPageHtmlViaApi } = await import('@/server/services/fandom/utils/mediaWikiApiFetch');
    const html = await fetchPageHtmlViaApi(pageUrl);
    if (!html) {
      logger.warn(`[enrichmentPipeline] Wiki page scrape: no HTML from ${pageUrl}`);
      return result;
    }

    // Scan all <a> links to wiki pages and match to chapter numbers
    // from the surrounding context (e.g., "002.&#160;" before the link).
    const allLinks = [...html.matchAll(/<a\s+href="(\/wiki\/[^"]+)"[^>]*>([^<]+)<\/a>/gi)];

    for (const linkMatch of allLinks) {
      const path = linkMatch[1] as string;
      if (/(?:Volume|Category|List_of|Special|Main_Page|File:|Image:)/i.test(path)) continue;

      const linkStart = linkMatch.index;
      const contextBefore = html.slice(Math.max(0, linkStart - 80), linkStart);

      // Match: "002.", "15.", "#15", "Chapter 15:", etc. (handles &#160; entities)
      const numMatch = contextBefore.match(/(?:^|<li[^>]*>)\s*(?:#?\s*)?(\d{1,4})\s*[.)\s:&#]/);
      if (!numMatch?.[1]) continue;

      const chNum = parseInt(numMatch[1], 10);
      if (isNaN(chNum) || chNum <= 0 || !needed.has(chNum)) continue;

      const fullUrl = `${baseUrl}${path}`;
      if (!result.has(fullUrl)) {
        result.set(fullUrl, chNum);
      }
    }

    logger.info(`[enrichmentPipeline] Wiki page scrape: found ${result.size} chapter URLs from ${pageUrl}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[enrichmentPipeline] Wiki page chapter URL scrape failed: ${msg}`);
  }

  return result;
}

/** Shape of a chapter detail result from the fetch service */
type ChapterDetailResult = { url: string; title?: string; coverImageUrl?: string; description?: string; pageCount?: number; releaseDate?: string };

/** Run the batch fetch with progress reporting */
async function batchFetchDetails(
  chapterDetailService: { batchFetchChapterDetails: (urls: string[], opts: Record<string, unknown>) => Promise<ChapterDetailResult[]> },
  urlToChapterNum: Map<string, number>,
  onProgress?: EnrichmentProgress,
): Promise<ChapterDetailResult[]> {
  logger.info(`[enrichmentPipeline] Fetching ${urlToChapterNum.size} individual chapter pages for covers/descriptions`);

  const batchOptions: Record<string, unknown> = {
    batchSize: 50, delayMs: 100, maxRetries: 2,
  };
  if (onProgress) {
    batchOptions['onProgress'] = (completed: number, total: number): void => {
      if (completed % 10 === 0 || completed === total) {
        void onProgress('fandom_chapters', `Scraping chapter ${completed}/${total} covers and details...`);
      }
    };
  }

  return chapterDetailService.batchFetchChapterDetails([...urlToChapterNum.keys()], batchOptions);
}
