// @file-size-justified: Main orchestrator coordinates complex Wikipedia extraction across multiple parsers and API calls
/* eslint-disable max-lines */
/**
 * Wikipedia Manga Extractor Module - Main Orchestrator
 *
 * High-level orchestration functions for extracting manga data from Wikipedia.
 * Coordinates API calls, parsing, and data aggregation across multiple modules.
 * Phase 3: Business logic orchestration (no parsing or HTTP logic).
 *
 * Refactored from: manga-extractor.ts (998 lines split into 6 focused modules)
 */

import * as cheerio from 'cheerio';

import { cacheProvider as _cacheProvider } from '@/server/cache/UnifiedCacheProvider';
import {
  discoverWikipediaUrls,
  analyzeWikipediaStructure,
  getWikipediaCache,
  parseMediaSection,
  type WikipediaParseResult,
  type WikipediaParserOptions,
  type WikipediaCachedPattern,
  type WikipediaUrlDiscoveryResult,
  type WikipediaParserType,
  WikipediaStructureType,
  DEFAULT_WIKIPEDIA_OPTIONS,
} from '@/server/services/wikipedia/adaptive';
import { logger } from '@/utils/logger';

import { fetchPageContent } from '../api-client';
import { createCache } from '../utils';

import { getChapterList as getChapterListInternal } from './chapter-list-extractor';
import { extractBasicInfo } from './info/basic-info-extractor';
import { extractEmbeddedData } from './info/embedded-data-extractor';
import { extractMetadata } from './info/metadata-extractor';
import {
  getVolumeList as getVolumeListInternal,
  getVolumeWithChapters as getVolumeWithChaptersInternal,
  getVolumesWithDescriptions as getVolumesWithDescriptionsInternal,
} from './volume-list-extractor';

import type {
  Cache,
  WikipediaMangaData,
  WikipediaChapter,
  WikipediaVolume,
} from '../types';

// ============================================================================
// Cache Configuration
// ============================================================================

/** L2 cache namespace for Wikipedia data */
const _WIKIPEDIA_CACHE_NAMESPACE = 'wikipedia';

/** L2 cache TTL: 24 hours (86400 seconds) */
const _WIKIPEDIA_L2_CACHE_TTL = 86400;

/**
 * L1: Shared in-memory cache for all manga extraction operations
 * TTL: 1 hour (3600000ms) - fast, lost on restart
 */
const cache: Cache<unknown> = createCache(3600000);

// ============================================================================
// Two-Tier Cache Helpers
// ============================================================================

/**
 * Get from two-tier cache: DISABLED
 * Wikipedia caching caused stale parsed data to persist across code fixes,
 * making parser improvements ineffective until cache expiry (24h).
 * The performance benefit doesn't justify the debugging cost.
 */
function getFromTwoTierCache<T>(_key: string): T | null {
  return null;
}

/**
 * Set to both cache tiers: DISABLED (see getFromTwoTierCache)
 */
async function setToTwoTierCache<T>(_key: string, _value: T): Promise<void> {
  // No-op: caching disabled
}

// ============================================================================
// Manga Info Extraction
// ============================================================================

/**
 * Get comprehensive manga information from Wikipedia
 *
 * Orchestrates extraction of manga metadata from Wikipedia pages including:
 * - Title, alternative titles, and URLs
 * - Plot/description and cover image
 * - Author, artist, publisher information
 * - Genres, demographic, and publication dates
 * - Volume and chapter counts with embedded data
 *
 * @param pageTitleOrUrl - Wikipedia page title or full URL
 * @returns Complete manga metadata or null if not found
 */
export async function getMangaInfo(
  pageTitleOrUrl: string
): Promise<WikipediaMangaData | null> {
  // Extract page title from URL if needed
  let pageTitle = pageTitleOrUrl;
  if (pageTitleOrUrl.includes('wikipedia.org/wiki/')) {
    const match = pageTitleOrUrl.match(/\/wiki\/([^#?]+)/);
    if (match?.[1]) {
      pageTitle = decodeURIComponent(match[1].replace(/_/g, ' '));
    }
  }

  const cacheKey = `manga:${pageTitle}`;

  // Two-tier cache: L1 (in-memory) → L2 (database)
  const cached = getFromTwoTierCache<WikipediaMangaData>(cacheKey);
  if (cached) {
    logger.debug(`Wikipedia two-tier cache hit for manga: ${pageTitle}`);
    return cached;
  }

  try {
    // Get page content using api-client
    const response = await fetchPageContent(pageTitle);
    const data = response;

    if (!data.parse) {
      return null;
    }

    const htmlContent = data.parse.text?.['*'] ?? '';
    const sections = data.parse.sections ?? [];

    // Parse the HTML content with cheerio
    const $ = cheerio.load(htmlContent);

    // Initialize manga data object
    let mangaData: WikipediaMangaData = {
      title: pageTitle,
      wikipediaUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`,
    };

    // Extract information using focused extractors
    // extractBasicInfo returns a new object, others mutate in place
    mangaData = extractBasicInfo($, pageTitle, mangaData);
    extractMetadata($, sections, mangaData);
    extractEmbeddedData($, htmlContent, mangaData);

    // Save to both L1 and L2 cache
    await setToTwoTierCache(cacheKey, mangaData);
    return mangaData;
  } catch (error: unknown) {
    logger.error(
      `Wikipedia getMangaInfo errorMessage for "${pageTitle}": ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

// ============================================================================
// Chapter List Extraction
// ============================================================================

/**
 * Get chapter list from Wikipedia
 *
 * Orchestrates chapter extraction by:
 * 1. Looking for "List of X chapters" page
 * 2. Handling redirects and disambiguation pages
 * 3. Parsing chapter tables using chapter-parser functions
 * 4. Falling back to alternative search strategies
 *
 * @param mangaTitle - Manga title to search for chapter list
 * @returns Array of chapters with titles and metadata
 */
export async function getChapterList(mangaTitle: string): Promise<WikipediaChapter[]> {
  return getChapterListInternal(mangaTitle, cache);
}

// ============================================================================
// Volume List Extraction
// ============================================================================

/**
 * Get volume list from Wikipedia
 *
 * Orchestrates volume extraction using:
 * 1. Enhanced volume extractor for rich metadata
 * 2. Fallback to standard HTML parsing
 * 3. Caching for performance
 *
 * @param volumeListUrl - URL to the volume list page
 * @returns Array of volumes with chapter information
 */
export async function getVolumeList(volumeListUrl: string): Promise<WikipediaVolume[]> {
  return getVolumeListInternal(volumeListUrl, cache);
}

/**
 * Get specific volume with chapters from Wikipedia
 *
 * Orchestrates extraction of a single volume's detailed information
 * including chapter titles and volume description.
 *
 * @param chapterPageUrl - URL to the chapter list page
 * @param volumeNumber - Volume number to extract
 * @returns Volume with chapters or null if not found
 */
export async function getVolumeWithChapters(
  chapterPageUrl: string,
  volumeNumber: number
): Promise<WikipediaVolume | null> {
  return getVolumeWithChaptersInternal(chapterPageUrl, volumeNumber);
}

/**
 * Get volumes with descriptions and chapter ranges from Wikipedia
 *
 * Orchestrates extraction of volumes with rich metadata:
 * - Volume titles (Japanese and English)
 * - Chapter ranges or individual chapter lists
 * - Plot descriptions/summaries
 * - Release dates and ISBNs
 *
 * Handles multiple formats:
 * - Volume sections with descriptions (Kaiju No. 8 style)
 * - Fire Force style with individual chapter titles
 * - Table-based volume lists with descriptions
 *
 * @param volumeListUrl - URL to the volume list page
 * @returns Array of volumes with descriptions and chapter ranges
 */
export async function getVolumesWithDescriptions(
  volumeListUrl: string
): Promise<WikipediaVolume[]> {
  return getVolumesWithDescriptionsInternal(volumeListUrl, cache);
}

// ============================================================================
// Best Match Finding
// ============================================================================

/**
 * Find best matching Wikipedia page for a manga title
 *
 * Main entry point for manga data extraction. Orchestrates search and extraction
 * to find the most relevant Wikipedia page for a given manga title, including:
 * - Searching for main manga page
 * - Extracting complete metadata
 * - Following volume and chapter list URLs
 * - Enriching data with descriptions and summaries
 *
 * Re-exported from best-match-finder.ts for convenience.
 */
export { findBestMatch } from './best-match-finder';

// ============================================================================
// Adaptive Extraction
// ============================================================================

/**
 * Adaptive extraction with intelligent parser selection.
 *
 * Uses static analysis to detect page structure and route to the
 * appropriate parser for best results. Supports:
 * - Dedicated List_of_* pages
 * - Main article Media sections
 * - Combined extraction from multiple sources
 *
 * @param titleOrUrl - Manga title or Wikipedia URL
 * @param options - Parser options
 * @returns Parse result with data, confidence, and metadata
 */
export async function adaptiveExtract(
  titleOrUrl: string,
  options: Partial<WikipediaParserOptions> = {}
): Promise<WikipediaParseResult> {
  const startTime = Date.now();
  const mergedOptions = { ...DEFAULT_WIKIPEDIA_OPTIONS, ...options };
  const patternCache = getWikipediaCache();

  // Pattern cache disabled — stale cached extraction data caused parser fixes
  // to be silently ignored. Always fetch and parse fresh data.
  const _cached = patternCache.get(titleOrUrl);
  void _cached; // Suppress unused warning

  // Discover URLs
  const discovery = await discoverWikipediaUrls(titleOrUrl, {
    preferListPage: mergedOptions.preferListPage,
    timeoutMs: mergedOptions.probeTimeoutMs,
  });

  if (!discovery.primaryUrl) {
    return createFailureResult(titleOrUrl, startTime, 'No Wikipedia page found');
  }

  // Fetch and analyze page
  const result = await extractFromDiscovery(discovery, mergedOptions, startTime);

  // Pattern caching disabled (see above)

  return result;
}

/**
 * Build Wikipedia URL from cached path.
 */
function buildCachedUrl(cached: WikipediaCachedPattern): string | null {
  if (cached.listPagePath) return `https://en.wikipedia.org/wiki/${cached.listPagePath}`;
  if (cached.mainPagePath) return `https://en.wikipedia.org/wiki/${cached.mainPagePath}`;
  return null;
}

/**
 * Build WikipediaMangaData from cached metadata.
 */
function buildMangaDataFromCache(
  cached: WikipediaCachedPattern,
  cachedData: { volumes: WikipediaVolume[]; chapters: number; metadata: Partial<WikipediaMangaData> | undefined },
  url: string
): WikipediaMangaData | null {
  if (!cachedData.metadata) return null;

  const data: WikipediaMangaData = {
    title: cachedData.metadata.title ?? cached.title,
    wikipediaUrl: url,
    volumes: cachedData.metadata.volumes ?? cachedData.volumes.length,
    chapters: cachedData.metadata.chapters ?? cachedData.chapters,
    volumeList: cachedData.volumes,
    chapterList: [],
  };

  // Add optional fields only if they exist
  if (cachedData.metadata.alternativeTitles) data.alternativeTitles = cachedData.metadata.alternativeTitles;
  if (cachedData.metadata.description) data.description = cachedData.metadata.description;
  if (cachedData.metadata.synopsis) data.synopsis = cachedData.metadata.synopsis;
  if (cachedData.metadata.coverImage) data.coverImage = cachedData.metadata.coverImage;
  if (cachedData.metadata.author) data.author = cachedData.metadata.author;
  if (cachedData.metadata.artist) data.artist = cachedData.metadata.artist;
  if (cachedData.metadata.publisher) data.publisher = cachedData.metadata.publisher;
  if (cachedData.metadata.englishPublisher) data.englishPublisher = cachedData.metadata.englishPublisher;
  if (cachedData.metadata.magazine) data.magazine = cachedData.metadata.magazine;
  if (cachedData.metadata.imprint) data.imprint = cachedData.metadata.imprint;
  if (cachedData.metadata.originalRun) data.originalRun = cachedData.metadata.originalRun;
  if (cachedData.metadata.genres) data.genres = cachedData.metadata.genres;
  if (cachedData.metadata.demographic) data.demographic = cachedData.metadata.demographic;
  if (cachedData.metadata.status) data.status = cachedData.metadata.status;

  return data;
}

/**
 * Create result from fully cached extraction data (no API call needed).
 */
function createCachedExtractionResult(
  cached: WikipediaCachedPattern,
  cachedData: { volumes: WikipediaVolume[]; chapters: number; metadata: Partial<WikipediaMangaData> | undefined },
  url: string,
  startTime: number
): WikipediaParseResult {
  const mangaData = buildMangaDataFromCache(cached, cachedData, url);

  return {
    success: true,
    data: mangaData,
    volumes: cachedData.volumes,
    chapters: [],
    error: null,
    pageType: cached.pageType,
    structureType: cached.structureType,
    parsedUrl: url,
    listPageUrl: cached.listPagePath ? `https://en.wikipedia.org/wiki/${cached.listPagePath}` : null,
    mainArticleUrl: cached.mainPagePath ? `https://en.wikipedia.org/wiki/${cached.mainPagePath}` : null,
    confidence: 0.95,
    usedCache: true,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Extract with a cached pattern.
 * If cache has valid extraction data, returns immediately (0 API calls).
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- Disabled caching code, kept for re-enablement
async function _extractWithCachedPattern(
  cached: WikipediaCachedPattern,
  options: WikipediaParserOptions,
  startTime: number
): Promise<WikipediaParseResult> {
  const patternCache = getWikipediaCache();
  const url = buildCachedUrl(cached);

  if (!url) {
    return createFailureResult(cached.title, startTime, 'Invalid cached pattern');
  }

  // SHORT-CIRCUIT: Return cached extraction data without API call
  if (patternCache.hasValidExtraction(cached.title)) {
    const cachedData = patternCache.getExtractedData(cached.title);
    if (cachedData) {
      logger.debug('[AdaptiveExtract] Short-circuit cache hit', { title: cached.title });
      patternCache.recordSuccess(cached.title);
      return createCachedExtractionResult(cached, cachedData, url, startTime);
    }
  }

  // No cached extraction - fetch and parse
  return fetchAndParseWithCachedPattern(cached, options, url, startTime);
}

/**
 * Fetch and parse using cached pattern (when extraction data not cached).
 */
async function fetchAndParseWithCachedPattern(
  cached: WikipediaCachedPattern,
  options: WikipediaParserOptions,
  url: string,
  startTime: number
): Promise<WikipediaParseResult> {
  const patternCache = getWikipediaCache();

  try {
    const pagePath = cached.listPagePath ?? cached.mainPagePath ?? '';
    const response = await fetchPageContent(extractTitleFromPath(pagePath));

    if (!response.parse) {
      patternCache.recordFailure(cached.title);
      return createFailureResult(cached.title, startTime, 'Failed to fetch cached page');
    }

    const htmlContent = response.parse.text?.['*'] ?? '';
    const result = await parseByType(htmlContent, cached.recommendedParser, options);

    patternCache.recordSuccess(cached.title);
    updateCacheWithExtraction(cached.title, result);

    return buildCachedPatternResult(cached, result, url, startTime);
  } catch (error) {
    patternCache.recordFailure(cached.title);
    const msg = error instanceof Error ? error.message : String(error);
    return createFailureResult(cached.title, startTime, msg);
  }
}

/**
 * Update cache with newly extracted data.
 */
function updateCacheWithExtraction(title: string, result: Partial<WikipediaParseResult>): void {
  if (!result.success) return;

  const updateData: {
    volumes?: WikipediaVolume[];
    chapters?: number;
    metadata?: Partial<WikipediaMangaData>;
  } = {
    chapters: result.data?.chapters ?? result.chapters?.length ?? 0,
  };

  if (result.volumes) updateData.volumes = result.volumes;

  const metadata = buildCacheMetadata(result.data);
  if (metadata) updateData.metadata = metadata;

  getWikipediaCache().updateExtractionData(title, updateData);
}

/**
 * Build cache-safe metadata from WikipediaMangaData.
 */
function buildCacheMetadata(data: WikipediaMangaData | null | undefined): Partial<WikipediaMangaData> | undefined {
  if (!data) return undefined;

  const metadata: Partial<WikipediaMangaData> = {
    title: data.title,
  };

  if (data.author) metadata.author = data.author;
  if (data.artist) metadata.artist = data.artist;
  if (data.description) metadata.description = data.description;
  if (data.coverImage) metadata.coverImage = data.coverImage;
  if (data.genres) metadata.genres = data.genres;
  if (data.status) metadata.status = data.status;
  if (data.volumes !== undefined) metadata.volumes = data.volumes;
  if (data.chapters !== undefined) metadata.chapters = data.chapters;

  return metadata;
}

/**
 * Build result from cached pattern fetch.
 */
function buildCachedPatternResult(
  cached: WikipediaCachedPattern,
  result: Partial<WikipediaParseResult>,
  url: string,
  startTime: number
): WikipediaParseResult {
  return {
    success: result.success ?? false,
    data: result.data ?? null,
    volumes: result.volumes ?? [],
    chapters: result.chapters ?? [],
    error: result.error ?? null,
    pageType: cached.pageType,
    structureType: cached.structureType,
    parsedUrl: url,
    listPageUrl: cached.listPagePath ? `https://en.wikipedia.org/wiki/${cached.listPagePath}` : null,
    mainArticleUrl: cached.mainPagePath ? `https://en.wikipedia.org/wiki/${cached.mainPagePath}` : null,
    confidence: 0.8,
    usedCache: true,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Extract series title from URL or page title.
 * Cleans up "List of X chapters" to get just "X".
 */
function extractSeriesTitleFromUrl(url: string): string | undefined {
  const pageTitle = extractTitleFromUrl(url);

  // Handle "List of X chapters" pattern
  const listMatch = pageTitle.match(/^List of (.+?)\s+(?:chapters|volumes|manga)/i);
  if (listMatch?.[1]) {
    return listMatch[1];
  }

  // Handle "X (manga)" pattern
  const mangaMatch = pageTitle.match(/^(.+?)\s*\(manga\)/i);
  if (mangaMatch?.[1]) {
    return mangaMatch[1];
  }

  return pageTitle;
}

/**
 * Extract from discovery result.
 */
async function extractFromDiscovery(
  discovery: WikipediaUrlDiscoveryResult,
  options: WikipediaParserOptions,
  startTime: number
): Promise<WikipediaParseResult> {
  // primaryUrl is guaranteed to exist when this function is called
  const primaryUrl = discovery.primaryUrl ?? '';
  const pageTitle = extractTitleFromUrl(primaryUrl);
  const seriesTitle = extractSeriesTitleFromUrl(primaryUrl);

  try {
    const response = await fetchPageContent(pageTitle);
    if (!response.parse) {
      return createFailureResult(primaryUrl, startTime, 'Failed to fetch page content');
    }

    const htmlContent = response.parse.text?.['*'] ?? '';
    const analysis = analyzeWikipediaStructure(htmlContent, primaryUrl);

    logger.debug('[AdaptiveExtract] Structure analyzed', {
      pageType: analysis.pageType,
      structureType: analysis.structureType,
      recommendedParser: analysis.recommendedParser,
      confidence: analysis.confidence,
      seriesTitle,
    });

    const result = await parseByType(htmlContent, analysis.recommendedParser, options, seriesTitle);

    // Enrich with main article data if we used a list page
    const enrichedResult = await enrichWithMainArticle(result, discovery, options);

    return {
      success: enrichedResult.success ?? false,
      data: enrichedResult.data ?? null,
      volumes: enrichedResult.volumes ?? [],
      chapters: enrichedResult.chapters ?? [],
      error: enrichedResult.error ?? null,
      pageType: analysis.pageType,
      structureType: analysis.structureType,
      parsedUrl: primaryUrl,
      listPageUrl: discovery.listPageUrl,
      mainArticleUrl: discovery.mainArticleUrl,
      confidence: analysis.confidence,
      usedCache: false,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[AdaptiveExtract] Extraction failed', { primaryUrl, error: msg });
    return createFailureResult(primaryUrl, startTime, msg);
  }
}

/**
 * Parse content by parser type.
 */
async function parseByType(
  html: string,
  parserType: WikipediaParserType,
  options: WikipediaParserOptions,
  seriesTitle?: string
): Promise<Partial<WikipediaParseResult>> {
  const $ = cheerio.load(html);

  switch (parserType) {
    case 'list-page':
    case 'wikitable':
      return parseWikitableContent($, html, options, seriesTitle);

    case 'media-section':
      return parseMediaSectionContent(html);

    case 'infobox-only':
      return parseInfoboxOnly($);

    case 'combined':
    default:
      return parseCombinedContent($, html, options, seriesTitle);
  }
}

/**
 * Parse wikitable content for volumes and chapters.
 */
/*
 * Intentionally complex (max-statements 77, complexity 47) — kept inline by
 * deliberate decision, not a refactor TODO.
 *
 * The function does 4 things that share local state and must execute in
 * order against the same parsed HTML:
 *   (1) cascade through 3 fallback parsing strategies (with-descriptions
 *       → embedded → basic-with-filter), each tuned for a different
 *       Wikipedia article shape we've seen in production
 *   (2) derive a declared chapter count from up to 3 sources
 *       (lead text / body text / table list-items), with a precedence rule
 *       that prefers text over table when both exist
 *   (3) gap-fill in 3 distinct branches whose thresholds were tuned by
 *       round-by-round audit (see project memory entries
 *       project_improvement_loop_round*.md): regenerate-all when
 *       extractedRatio < 0.1, over-count-correct when > 1.2 AND >= 40
 *       declared, tail-extend when 0.8–1.0
 *   (4) validate against a max-reasonable-chapters-per-volume bound
 *
 * Refactoring carries real regression risk: the project's parser baseline
 * (scripts/surveys/baseline-checkpoint-n*.json) tests end-to-end pipeline
 * output, not isolated parser behavior, so a behavior-preserving refactor
 * cannot be independently verified short of re-running the full multi-hour
 * baseline corpus and inspecting a per-manga diff. The current shape was
 * arrived at incrementally over multiple parser-improvement rounds with
 * each branch and threshold pinned by an actual production failure.
 */
// eslint-disable-next-line max-statements, complexity -- legitimately complex (see block comment above); not a refactor candidate
async function parseWikitableContent(
  $: cheerio.CheerioAPI,
  html: string,
  _options: WikipediaParserOptions,
  seriesTitle?: string
): Promise<Partial<WikipediaParseResult>> {
  // Import volume parsing functions
  const {
    parseVolumeTableWithDescriptionsFiltered,
    parseVolumeTableFiltered,
    extractEmbeddedVolumes,
  } = await import('../../volume-parser');

  // Filter to main series content and try parsing with descriptions first
  let volumes = parseVolumeTableWithDescriptionsFiltered(html, seriesTitle);

  // Fall back to embedded volumes if no volumes found
  if (volumes.length === 0) {
    volumes = extractEmbeddedVolumes(html);
  }

  // Fall back to basic volume table parsing with filtering
  if (volumes.length === 0) {
    volumes = parseVolumeTableFiltered(html, seriesTitle);
  }

  // Extract all chapters from volumes
  const chapters: WikipediaChapter[] = [];
  for (const vol of volumes) {
    if (vol.chapters.length > 0) {
      chapters.push(...vol.chapters);
    }
  }

  // Gap-fill: use lead/body/table chapter count to generate or extend chapters.
  // Priority: body text (most explicit) > lead paragraphs > table list items (may use offset numbering).
  // Between lead and body, prefer the larger (body often has total, lead may be partial).
  const leadFromLead = extractChapterCountFromLead($);
  const leadFromBody = extractChapterCountFromBody($);
  const textDeclared = Math.max(leadFromLead ?? 0, leadFromBody ?? 0);
  // Also try table extraction — it may find data when text methods don't, or supplement them.
  // For multi-edition pages, text count is preferred (avoids over-counting from multiple tables).
  const leadFromTable = extractMaxChapterFromTableLists($);
  // Prefer text over table when both exist (text is the declared total, table may use offset numbering)
  const maxDeclared = textDeclared > 0 ? textDeclared : (leadFromTable ?? 0);
  const leadCount = maxDeclared > 0 ? maxDeclared : null;
  if (leadCount) {
    const extractedRatio = chapters.length > 0 ? chapters.length / leadCount : 0;
    if (extractedRatio < 0.1) {
      // Very few or no chapters extracted — generate all from declared count.
      chapters.length = 0;
      const volCount = volumes.length > 0 ? volumes.length : 1;
      const chapPerVol = Math.ceil(leadCount / volCount);
      for (let i = 1; i <= leadCount; i++) {
        const volIdx = volumes.length > 0
          ? Math.min(Math.floor((i - 1) / chapPerVol), volumes.length - 1)
          : undefined;
        const volNumber = volIdx !== undefined ? volumes[volIdx]?.number : undefined;
        chapters.push(volNumber !== undefined
          ? { number: i, title: `Chapter ${i}`, volumeNumber: volNumber }
          : { number: i, title: `Chapter ${i}` });
      }
      logger.info(`[parseWikitableContent] Generated ${leadCount} placeholder chapters from declared count across ${volCount} volumes`);
    } else if (extractedRatio > 1.2 && leadCount >= 40) {
      // Over-counted (multiple volumization editions parsed) — regenerate from declared count
      // Only apply when declared count is substantial (>=40) to avoid false positives from volume counts
      chapters.length = 0;
      const chapPerVol = Math.ceil(leadCount / volumes.length);
      for (let i = 1; i <= leadCount; i++) {
        const volIdx = Math.min(Math.floor((i - 1) / chapPerVol), volumes.length - 1);
        const volNumber = volumes[volIdx]?.number;
        chapters.push(volNumber !== undefined
          ? { number: i, title: `Chapter ${i}`, volumeNumber: volNumber }
          : { number: i, title: `Chapter ${i}` });
      }
      logger.info(`[parseWikitableContent] Over-count correction: ${Math.round(extractedRatio * leadCount)}→${leadCount} chapters (declared: ${leadCount})`);
    } else if (extractedRatio >= 0.8 && extractedRatio <= 1.0) {
      // Most chapters found — extend the tail with placeholders
      const gap = leadCount - chapters.length;
      const maxExtracted = Math.max(...chapters.map(ch => typeof ch.number === 'number' ? ch.number : 0));
      const lastVol = volumes.length;
      for (let i = maxExtracted + 1; i <= maxExtracted + gap; i++) {
        chapters.push({ number: i, title: `Chapter ${i}`, volumeNumber: lastVol });
      }
      logger.info(`[parseWikitableContent] Gap-filled ${gap} chapters (${chapters.length - gap}→${chapters.length}, declared: ${leadCount})`);
    }
  }

  // Also extract alternative titles from infobox
  const alternativeTitles = extractAlternativeTitlesFromInfobox($);

  // Try to get chapter count from lead paragraph (most accurate for list pages)
  const leadChapterCount = extractChapterCountFromLead($);

  // Validate extracted chapter count - if it seems too high, estimate from volumes
  // A typical manga volume has 8-12 chapters, max reasonable is 15
  const maxReasonableChaptersPerVolume = 15;
  const maxReasonableChapters = volumes.length * maxReasonableChaptersPerVolume;
  const avgChaptersPerVolume = 10;
  const estimatedChapters = volumes.length * avgChaptersPerVolume;

  let chapterCount: number;
  if (leadChapterCount) {
    chapterCount = leadChapterCount;
  } else if (chapters.length > 0 && chapters.length <= maxReasonableChapters) {
    chapterCount = chapters.length;
  } else {
    // Chapter extraction returned unreasonably high count - use estimate
    chapterCount = estimatedChapters;
  }

  // Build manga data with available info
  // Prefer lead paragraph count > infobox count > pattern-extracted count
  const mangaData: WikipediaMangaData = {
    title: extractTitleFromInfobox($) ?? '',
    volumes: volumes.length,
    chapters: chapterCount,
    volumeList: volumes,
    chapterList: chapters,
  };

  // Add alternative titles if any found
  if (alternativeTitles.length > 0) {
    mangaData.alternativeTitles = alternativeTitles;
  }

  // Extract additional metadata from infobox (may override chapter count if found)
  const chaptersBeforeInfobox = mangaData.chapters;
  extractInfoboxMetadata($, mangaData);
  const infoboxSetChapters = mangaData.chapters !== chaptersBeforeInfobox;

  // Post-infobox correction: if the infobox explicitly set a chapter count that differs
  // from what we extracted, trust the infobox (most reliable source).
  if (infoboxSetChapters && mangaData.chapters && mangaData.chapters > 0 && volumes.length > 0) {
    const infoboxCount = mangaData.chapters;
    const shouldRegenerate =
      chapters.length === 0 ||
      // Infobox says significantly more than extracted (e.g., lead gave partial count)
      (infoboxCount > chapters.length * 2 && chapters.length < infoboxCount) ||
      // Parsed way too many (multiple volumization editions on page)
      (chapters.length > infoboxCount * 1.5);
    if (shouldRegenerate) {
      const prevCount = chapters.length;
      chapters.length = 0;
      const chapPerVol = Math.ceil(infoboxCount / volumes.length);
      for (let i = 1; i <= infoboxCount; i++) {
        const volIdx = Math.min(Math.floor((i - 1) / chapPerVol), volumes.length - 1);
        const volNumber = volumes[volIdx]?.number;
        chapters.push(volNumber !== undefined
          ? { number: i, title: `Chapter ${i}`, volumeNumber: volNumber }
          : { number: i, title: `Chapter ${i}` });
      }
      mangaData.chapterList = chapters;
      logger.info(`[parseWikitableContent] Regenerated ${infoboxCount} chapters from infobox (was: ${prevCount}) across ${volumes.length} volumes`);
    }
  }

  // Determine chapter source for logging
  let chapterSource: string;
  if (leadChapterCount) {
    chapterSource = 'lead';
  } else if (chapters.length > 0 && chapters.length <= maxReasonableChapters) {
    chapterSource = 'extracted';
  } else {
    chapterSource = 'estimated';
  }
  logger.info(`[parseWikitableContent] Extracted ${volumes.length} volumes, ${mangaData.chapters} chapters (source: ${chapterSource})`);

  return {
    success: volumes.length > 0 || chapters.length > 0,
    data: mangaData,
    volumes,
    chapters,
  };
}

/**
 * Extract title from infobox.
 */
function extractTitleFromInfobox($: cheerio.CheerioAPI): string | null {
  // Try infobox caption/title
  const caption = $('.infobox caption, .infobox-above, .infobox th.summary').first().text().trim();
  if (caption) return caption;

  // Try page title
  const pageTitle = $('#firstHeading, .mw-page-title-main').first().text().trim();
  if (pageTitle) return pageTitle;

  return null;
}

/**
 * Extract alternative titles from infobox.
 */
function extractAlternativeTitlesFromInfobox($: cheerio.CheerioAPI): string[] {
  const titles: string[] = [];
  const seen = new Set<string>();

  // Look for Japanese/English/Romaji titles in infobox
  $('.infobox tr, .infobox-manga tr').each((_, row) => {
    const $row = $(row);
    const label = $row.find('th').text().toLowerCase().trim();
    const value = $row.find('td').text().trim();

    if (!value || value.length < 2) return;

    // Match various title labels
    if (
      label.includes('japanese') ||
      label.includes('romaji') ||
      label.includes('english') ||
      label.includes('native') ||
      label.includes('kanji') ||
      label.includes('original')
    ) {
      // Clean the value
      const cleanTitle = value
        .replace(/\s+/g, ' ')
        .replace(/\[.*?\]/g, '') // Remove references
        .trim();

      if (cleanTitle && !seen.has(cleanTitle.toLowerCase())) {
        seen.add(cleanTitle.toLowerCase());
        titles.push(cleanTitle);
      }
    }
  });

  // Also extract from title element with lang attribute
  $('[lang="ja"], [lang="ja-Latn"]').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 1 && !seen.has(text.toLowerCase())) {
      seen.add(text.toLowerCase());
      titles.push(text);
    }
  });

  return titles;
}

/**
 * Extract metadata from infobox into manga data.
 * Intentionally mutates the data object for efficiency.
 */
function extractInfoboxMetadata($: cheerio.CheerioAPI, data: WikipediaMangaData): void {
  /* eslint-disable no-param-reassign */
  const infobox = $('.infobox, .infobox-manga, .infobox-book').first();

  // eslint-disable-next-line complexity -- Infobox field extraction with 15+ field types
  infobox.find('tr').each((_, row) => {
    const $row = $(row);
    const label = $row.find('th').text().toLowerCase().trim();
    const $td = $row.find('td');
    const value = $td.text().trim();

    if (!value) return;

    // Author/Writer
    if (label.includes('author') || label.includes('written by') || label.includes('writer')) {
      data.author = value.split(/[,&]/).map(a => a.trim()).filter(Boolean);
    }

    // Artist/Illustrator
    if (label.includes('artist') || label.includes('illustrated by') || label.includes('illustrator')) {
      data.artist = value.split(/[,&]/).map(a => a.trim()).filter(Boolean);
    }

    // Publisher
    if (label.includes('publisher') && !label.includes('english')) {
      data.publisher = value.replace(/\[.*?\]/g, '').trim();
    }

    // English Publisher
    if (label.includes('english publisher')) {
      data.englishPublisher = value.replace(/\[.*?\]/g, '').trim();
    }

    // Magazine
    if (label.includes('magazine') && !label.includes('english')) {
      data.magazine = value.replace(/\[.*?\]/g, '').trim();
    }

    // Demographic
    if (label.includes('demographic')) {
      data.demographic = value.replace(/\[.*?\]/g, '').trim();
    }

    // Genres
    if (label.includes('genre')) {
      data.genres = value.split(/[,;]/).map(g => g.replace(/\[.*?\]/g, '').trim()).filter(Boolean);
    }

    // Original Run
    if (label.includes('original run') || label.includes('published')) {
      data.originalRun = value.replace(/\[.*?\]/g, '').trim();
      // Derive status from original run
      if (value.toLowerCase().includes('present')) {
        data.status = 'ONGOING';
      } else if (value.match(/\d{4}\s*[–-]\s*\d{4}/)) {
        data.status = 'COMPLETED';
      }
    }

    // Volume count from infobox
    if (label.includes('volume') && !label.includes('list')) {
      const volMatch = value.match(/(\d+)/);
      if (volMatch?.[1]) {
        data.volumes = parseInt(volMatch[1], 10);
      }
    }

    // Chapter count from infobox
    if (label.includes('chapter') && !label.includes('list')) {
      const chMatch = value.match(/(\d+)/);
      if (chMatch?.[1]) {
        data.chapters = parseInt(chMatch[1], 10);
      }
    }
  });

  // Extract plot/synopsis from first paragraphs
  const synopsis = extractSynopsis($);
  if (synopsis) {
    data.synopsis = synopsis;
    data.plot = synopsis; // For backwards compatibility
  }
  /* eslint-enable no-param-reassign */
}

/**
 * Extract synopsis from main article.
 */
function extractSynopsis($: cheerio.CheerioAPI): string | null {
  // Look for Synopsis, Plot, or Story section
  const synopsisHeaders = ['#Synopsis', '#Plot', '#Story', '#Premise'];
  for (const selector of synopsisHeaders) {
    const $header = $(selector);
    if ($header.length > 0) {
      const $nextP = $header.closest('h2, h3').nextAll('p').first();
      const text = $nextP.text().trim();
      if (text && text.length > 50) {
        return text;
      }
    }
  }

  // Fall back to first substantial paragraph after lead
  const paragraphs: string[] = [];
  $('.mw-parser-output > p').slice(0, 3).each((_, p) => {
    const text = $(p).text().trim();
    if (text && text.length > 100) {
      paragraphs.push(text);
    }
  });

  return paragraphs.length > 0 ? paragraphs.join('\n\n') : null;
}

/**
 * Parse a chapter count from text, validating it's in reasonable range.
 */
function parseChapterCount(match: RegExpMatchArray | null): number | null {
  if (!match?.[1]) return null;
  const count = parseInt(match[1], 10);
  return count >= 10 && count <= 2000 ? count : null;
}

/**
 * Extract chapter count from infobox "Chapters" row.
 */
function extractChapterCountFromInfobox($: cheerio.CheerioAPI): number | null {
  const infobox = $('.infobox');
  if (infobox.length === 0) return null;

  const chaptersRow = infobox.find('tr').filter((_, row) => {
    const th = $(row).find('th').text().toLowerCase().trim();
    return th === 'chapters' || (th.includes('chapter') && !th.includes('list'));
  });

  if (chaptersRow.length === 0) return null;

  const td = chaptersRow.find('td').text();
  return parseChapterCount(td.match(/(\d{2,4})/));
}

/**
 * Extract chapter count from lead paragraph or infobox.
 * Searches for patterns like "X chapters", "X individual chapters".
 */
function extractChapterCountFromLead($: cheerio.CheerioAPI): number | null {
  // Get first few paragraphs
  const leadText = $('.mw-parser-output > p').slice(0, 3).text();

  // Pattern 1: "X chapters" or "X individual chapters" in lead
  const chapterMatch = parseChapterCount(
    leadText.match(/(\d{2,4})\s+(?:individual\s+)?chapters/i)
  );
  if (chapterMatch) return chapterMatch;

  // Pattern 2: "chapter count of X" or "total of X chapters" in lead
  const totalMatch = parseChapterCount(
    leadText.match(/(?:total\s+of|count\s+of)\s+(\d{2,4})\s+chapters/i)
  );
  if (totalMatch) return totalMatch;

  // Pattern 3: Look in infobox for "Chapters" row
  return extractChapterCountFromInfobox($);
}

/** Extract chapter number from a single list item text (shared logic) */
function extractChapterNumFromText(text: string): number {
  const std = text.match(/^0*(\d+)(?:[–-]0*(\d+))?[.\s"]/);
  if (std) return std[2] ? parseInt(std[2], 10) : parseInt(std[1] ?? '0', 10);
  const bub = text.match(/^Bub\s+(\d+)/i);
  if (bub) return parseInt(bub[1] ?? '0', 10);
  const genius = text.match(/^Genius\s+0*(\d+)/i);
  if (genius) return parseInt(genius[1] ?? '0', 10);
  const chPrefix = text.match(/^Chapter\s+0*(\d+)/i);
  if (chPrefix) return parseInt(chPrefix[1] ?? '0', 10);
  return 0;
}

/** Extract max chapter number from list items in wikitables.
 *  Handles explicit patterns + implicit <ol><li> counting as fallback. */
function extractMaxChapterFromTableLists($: cheerio.CheerioAPI): number | null {
  let maxChapter = 0;
  $('table.wikitable').each((_, table) => {
    $(table).find('li').each((_i, li) => {
      const num = extractChapterNumFromText($(li).text().trim());
      if (num > maxChapter && num < 1000) maxChapter = num;
    });
  });

  // Fallback: count <ol><li> items in wikitables (implicit numbered lists).
  // Only use when no explicit chapter numbers were found and count is substantial.
  if (maxChapter < 10) {
    let olLiTotal = 0;
    $('table.wikitable ol li').each(() => { olLiTotal++; });
    if (olLiTotal >= 50) {
      maxChapter = olLiTotal;
      logger.info(`[parseWikitableContent] Counted ${olLiTotal} <ol><li> items (implicit numbering)`);
    }
  }

  return maxChapter >= 10 ? maxChapter : null;
}

/** Search deeper in article body for chapter count (beyond lead paragraphs) */
function extractChapterCountFromBody($: cheerio.CheerioAPI): number | null {
  // Search all paragraphs for patterns like "compiled the 147 chapters" or "serialized for 276 chapters"
  const bodyText = $('.mw-parser-output p').text();
  // Match "X chapters" or "X issues" in various phrasings
  const patterns = [
    /(?:compiled|collected|serialized|published|ran for|consists of|containing)\s+(?:the\s+)?(\d{2,4})\s+(?:individual\s+)?chapters/i,
    /for\s+(\d{2,4})\s+issues\s+published/i,
    /(\d{2,4})\s+(?:individual\s+)?chapters?\s+(?:were|have been)\s+(?:compiled|collected|combined|published|released)/i,
    /(?:total\s+of|its)\s+(\d{2,4})\s+(?:individual\s+)?chapters/i,
    /(?:the|with(?:\s+the)?)\s+(\d{2,4})\s+chapters\s+(?:collected|compiled|combined|organized|published)/i,
  ];
  // Return the largest match across all patterns (avoids partial counts from sub-sections)
  let maxCount = 0;
  for (const pattern of patterns) {
    const match = bodyText.match(pattern);
    if (match?.[1]) {
      const count = parseInt(match[1], 10);
      if (count >= 10 && count <= 2000 && count > maxCount) maxCount = count;
    }
  }
  return maxCount > 0 ? maxCount : null;
}

/**
 * Parse media section content.
 * Builds proper WikipediaMangaData from the extracted section data.
 */
function parseMediaSectionContent(html: string): Partial<WikipediaParseResult> {
  const sectionData = parseMediaSection(html);

  const hasData = sectionData.volumes.length > 0 ||
    sectionData.chapters.length > 0 ||
    sectionData.volumeCount !== null;

  if (!hasData) {
    return {
      success: false,
      data: null,
      volumes: [],
      chapters: [],
    };
  }

  // Build proper WikipediaMangaData from section data
  const mangaData: WikipediaMangaData = {
    title: '', // Will be filled by caller or merge
    volumes: sectionData.volumeCount ?? sectionData.volumes.length,
    chapters: sectionData.chapterCount ?? sectionData.chapters.length,
    volumeList: sectionData.volumes,
    chapterList: sectionData.chapters,
  };

  // Add optional metadata if available
  if (sectionData.status) {
    mangaData.status = sectionData.status;
  }
  if (sectionData.startDate && sectionData.endDate) {
    mangaData.originalRun = `${sectionData.startDate} – ${sectionData.endDate}`;
  } else if (sectionData.startDate) {
    mangaData.originalRun = `${sectionData.startDate} – present`;
  }
  if (sectionData.publisher) {
    mangaData.publisher = sectionData.publisher;
  }
  if (sectionData.magazine) {
    mangaData.magazine = sectionData.magazine;
  }

  return {
    success: true,
    data: mangaData,
    volumes: sectionData.volumes,
    chapters: sectionData.chapters,
  };
}

/**
 * Parse infobox only.
 */
function parseInfoboxOnly($: cheerio.CheerioAPI): Partial<WikipediaParseResult> {
  // Extract basic info from infobox
  const infobox = $('.infobox, .infobox-manga').first();

  let foundData = false;

  infobox.find('tr').each((_, row) => {
    const label = $(row).find('th').text().toLowerCase();
    const value = $(row).find('td').text();

    if (label.includes('volume') || label.includes('chapter')) {
      const match = value.match(/\d+/);
      if (match) foundData = true;
    }
  });

  return {
    success: foundData,
    data: null,
    volumes: [],
    chapters: [],
  };
}

/**
 * Parse combined content using multiple strategies.
 */
async function parseCombinedContent(
  $: cheerio.CheerioAPI,
  html: string,
  options: WikipediaParserOptions,
  seriesTitle?: string
): Promise<Partial<WikipediaParseResult>> {
  // Try wikitable first with filtering
  const wikitableResult = await parseWikitableContent($, html, options, seriesTitle);
  if ((wikitableResult.volumes && wikitableResult.volumes.length > 0) ||
      (wikitableResult.chapters && wikitableResult.chapters.length > 0)) {
    return wikitableResult;
  }

  // Fall back to media section
  const mediaSectionResult = parseMediaSectionContent(html);
  if (mediaSectionResult.success) {
    return mediaSectionResult;
  }

  // Last resort: infobox
  return parseInfoboxOnly($);
}

/**
 * Enrich result with main article data.
 */
// eslint-disable-next-line complexity -- Wikipedia main article extraction with multiple data sources
async function enrichWithMainArticle(
  result: Partial<WikipediaParseResult>,
  discovery: WikipediaUrlDiscoveryResult,
  options: WikipediaParserOptions
): Promise<Partial<WikipediaParseResult>> {
  if (!options.enrichWithMainArticle) return result;
  if (!discovery.mainArticleUrl) return result;
  if (discovery.mainArticleUrl === discovery.listPageUrl) return result;

  try {
    const pageTitle = extractTitleFromUrl(discovery.mainArticleUrl);
    const mangaData = await getMangaInfo(pageTitle);

    if (mangaData) {
      // Merge data - preserve volumeList and chapterList from list page extraction
      const existingData = result.data;

      // Get the best volumeList and chapterList
      const mergedVolumeList = existingData?.volumeList?.length
        ? existingData.volumeList
        : mangaData.volumeList;
      const mergedChapterList = existingData?.chapterList?.length
        ? existingData.chapterList
        : mangaData.chapterList;

      // Calculate counts based on available data
      // For volumes, prefer list length as it's more accurate
      const volumeCount =
        mergedVolumeList?.length ??
        existingData?.volumes ??
        mangaData.volumes;

      // For chapters, prefer sources in this order:
      // 1. Infobox chapter count from main article (if explicitly set and > 10)
      //    - Small values (<10) are likely noise from extractEmbeddedChapters
      // 2. List page extracted count (if reasonable: < volumes * 15)
      // 3. Fallback to list length
      const mainArticleChapters = mangaData.chapters;
      const listPageChapters = existingData?.chapters;

      // Determine if main article chapter count is from infobox (reasonable) or noise
      const mainArticleHasReasonableCount =
        typeof mainArticleChapters === 'number' && mainArticleChapters > 10;
      // Check if list page count is reasonable (not inflated)
      const maxReasonableChapters = (volumeCount ?? 1) * 15;
      const listPageHasReasonableCount =
        typeof listPageChapters === 'number' && listPageChapters <= maxReasonableChapters;

      let chapterCount: number | undefined;
      if (mainArticleHasReasonableCount) {
        chapterCount = mainArticleChapters;
      } else if (listPageHasReasonableCount) {
        chapterCount = listPageChapters;
      } else {
        // Fall back to list length or a reasonable estimate
        chapterCount = mergedChapterList?.length ?? listPageChapters;
      }

      const mergedData: WikipediaMangaData = {
        ...mangaData,
      };

      // Only set lists if we have values
      if (mergedVolumeList && mergedVolumeList.length > 0) {
        mergedData.volumeList = mergedVolumeList;
      }
      if (mergedChapterList && mergedChapterList.length > 0) {
        mergedData.chapterList = mergedChapterList;
      }

      // Only set counts if we have values
      if (typeof volumeCount === 'number') {
        mergedData.volumes = volumeCount;
      }
      if (typeof chapterCount === 'number') {
        mergedData.chapters = chapterCount;
      }

      return {
        ...result,
        data: mergedData,
        // Also preserve top-level volumes/chapters
        volumes: result.volumes?.length ? result.volumes : [],
        chapters: result.chapters?.length ? result.chapters : [],
      };
    }
  } catch (error) {
    logger.debug('[AdaptiveExtract] Failed to enrich with main article', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return result;
}

/**
 * Cache a successful pattern.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention -- Disabled caching code, kept for re-enablement
function _cacheSuccessfulPattern(
  titleOrUrl: string,
  discovery: WikipediaUrlDiscoveryResult,
  result: WikipediaParseResult,
  patternCache: ReturnType<typeof getWikipediaCache>
): void {
  const listPath = discovery.listPageUrl ? extractPathFromUrl(discovery.listPageUrl) : null;
  const mainPath = discovery.mainArticleUrl ? extractPathFromUrl(discovery.mainArticleUrl) : null;

  // Build URL existence map from discovery results
  const urlExistsMap: Record<string, boolean> = {};
  for (const url of discovery.triedUrls) {
    const statusCode = discovery.statusCodes.get(url);
    urlExistsMap[url] = statusCode === 200;
  }

  // Build options conditionally to satisfy exactOptionalPropertyTypes
  const cacheOptions: {
    extractedVolumes?: WikipediaVolume[];
    extractedChapters?: number;
    extractedMetadata?: Partial<WikipediaMangaData>;
    urlExistsMap?: Record<string, boolean>;
  } = {
    extractedChapters: result.data?.chapters ?? result.chapters.length,
    urlExistsMap,
  };
  if (result.volumes.length > 0) cacheOptions.extractedVolumes = result.volumes;
  const metadata = buildCacheMetadata(result.data);
  if (metadata) cacheOptions.extractedMetadata = metadata;

  // Use setWithData to cache extraction results along with pattern
  patternCache.setWithData(
    titleOrUrl,
    listPath,
    mainPath,
    result.pageType,
    result.structureType,
    'combined',
    cacheOptions
  );
}

/**
 * Create a failure result.
 */
function createFailureResult(
  titleOrUrl: string,
  startTime: number,
  error: string
): WikipediaParseResult {
  return {
    success: false,
    data: null,
    volumes: [],
    chapters: [],
    error,
    pageType: 'unknown',
    structureType: WikipediaStructureType.UNKNOWN,
    parsedUrl: titleOrUrl,
    listPageUrl: null,
    mainArticleUrl: null,
    confidence: 0,
    durationMs: Date.now() - startTime,
    usedCache: false,
  };
}

/**
 * Extract title from URL.
 */
function extractTitleFromUrl(url: string): string {
  const match = url.match(/\/wiki\/([^#?]+)/);
  if (!match?.[1]) return url;
  return decodeURIComponent(match[1].replace(/_/g, ' '));
}

/**
 * Extract path from URL.
 */
function extractPathFromUrl(url: string): string | null {
  const match = url.match(/\/wiki\/([^#?]+)/);
  return match?.[1] ?? null;
}

/**
 * Extract title from path.
 */
function extractTitleFromPath(path: string): string {
  return decodeURIComponent(path.replace(/_/g, ' '));
}
