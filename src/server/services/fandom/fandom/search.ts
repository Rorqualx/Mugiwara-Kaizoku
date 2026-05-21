// @file-size-justified: Core search orchestration for Fandom wikis - coordinates MediaWiki+V1 APIs, result processing, thumbnail fetching, and cover enhancement. Cover resolution extracted to cover-resolver.ts.
/**
 * Fandom Search Operations
 *
 * Search functionality for finding manga and characters across Fandom APIs.
 * Extracted from FandomService for better modularity and reduced complexity.
 * Cover image resolution is in cover-resolver.ts.
 */

import { logger } from '@/utils/logger';

import { findBestCover } from './cover-resolver';

import type { FandomV1API } from '../FandomV1API';
import type { MediaWikiAPI } from '../MediaWikiAPI';
import type {
  FandomSearchResult,
  WikiConfig,
  FandomPageMetadata,
  MediaWikiSearchResult,
  FandomV1ArticleDetails
} from '../types';

const log = logger.child('FandomSearch');

// ============================================================================
// Types
// ============================================================================

export interface SearchOptions {
  type?: 'all' | 'manga' | 'character';
  limit?: number;
  includeDetails?: boolean;
}

export interface SearchDependencies {
  mediaWikiAPI: MediaWikiAPI;
  v1API: FandomV1API;
  wikiConfig: WikiConfig;
  getPageMetadata: (title: string) => Promise<FandomPageMetadata | null>;
}

interface ArticleDetails {
  thumbnail?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Helper Functions - Extracted to reduce complexity and depth
// ============================================================================

/**
 * Wiki context for type determination
 */
export interface WikiContext {
  /** Wiki name (e.g., "Fire Force", "One Piece") */
  wikiName?: string;
  /** Wiki subdomain (e.g., "fire-force", "onepiece", "dorohedoro") */
  subdomain?: string;
  /** Whether this wiki is manga-focused (has chapters/volumes categories) */
  isMangaWiki?: boolean;
}

/**
 * Determine the type of result based on title and optional wiki context
 *
 * @param title - Page title
 * @param wikiContext - Optional context about the wiki being searched
 */
// eslint-disable-next-line complexity -- Type classification function checking many title patterns and wiki context signals
export function determineResultType(
  title: string,
  wikiContext?: WikiContext
): 'manga' | 'character' | 'article' {
  const lowerTitle = title.toLowerCase();

  // Check for wiki/meta pages first - these are NEVER manga
  if (lowerTitle.includes(' wiki') || lowerTitle.endsWith('wiki')) {
    return 'article';
  }

  // Check for chapter/volume pages - these should NOT be manga
  if (isChapterOrVolumePage(lowerTitle)) {
    return 'article';
  }

  // Check for arc/saga pages - these are also articles
  if (lowerTitle.includes(' arc') || lowerTitle.includes(' saga')) {
    return 'article';
  }

  // Check for character indicators
  if (lowerTitle.includes('characters') || lowerTitle.includes('character list')) {
    return 'character';
  }

  // Explicit manga/series suffix - highest confidence
  if (lowerTitle.endsWith('(manga)') || lowerTitle.endsWith('(series)')) {
    return 'manga';
  }

  // Handle manga title patterns with dash-enclosed suffixes (e.g., "Title -manuscriptus-", "Title -chronicles-")
  // Common pattern for manga spinoffs and adaptations
  if (/-[a-z]+-$/i.test(lowerTitle) && wikiContext?.isMangaWiki) {
    return 'manga';
  }

  // Wiki context-aware detection: exact title match to wiki name
  if (wikiContext?.isMangaWiki && wikiContext.wikiName) {
    const wikiNameLower = wikiContext.wikiName.toLowerCase();
    if (lowerTitle === wikiNameLower) {
      return 'manga';
    }
  }

  // Subdomain-title match: If title matches wiki subdomain (normalized), it's the main series page
  // This handles cases like "Dorohedoro" on dorohedoro.fandom.com where wiki isn't in POPULAR_WIKIS
  if (wikiContext?.subdomain) {
    const normalizedSubdomain = normalizeForComparison(wikiContext.subdomain);
    const normalizedTitle = normalizeForComparison(lowerTitle);
    if (normalizedTitle === normalizedSubdomain) {
      return 'manga';
    }
  }

  // If title has parentheses but isn't manga/series, it's likely a character
  if (title.includes('(')) {
    return 'character';
  }

  // Default to article
  return 'article';
}

/**
 * Normalize a string for comparison by removing separators and spaces
 */
function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .replace(/[-_\s]+/g, '')  // Remove hyphens, underscores, spaces
    .replace(/['']/g, '');    // Remove apostrophes
}

/**
 * Check if title indicates a chapter or volume page
 */
function isChapterOrVolumePage(lowerTitle: string): boolean {
  return (
    lowerTitle.includes('chapter ') ||
    lowerTitle.includes('volume ') ||
    lowerTitle.includes('episode ') ||
    /chapter \d+/i.test(lowerTitle) ||
    /volume \d+/i.test(lowerTitle) ||
    /episode \d+/i.test(lowerTitle)
  );
}

/**
 * Calculate relevance score for search results
 */
export function calculateRelevanceScore(query: string, title: string): number {
  const queryLower = query.toLowerCase();
  const titleLower = title.toLowerCase();

  // Main manga page patterns get highest priority
  if (titleLower === `${queryLower} (manga)` || titleLower === `${queryLower} (series)`) {
    return 100;
  }

  let score = calculateBaseScore(queryLower, titleLower);
  score = applyMangaBoost(score, titleLower);
  score = applyNonMangaPenalty(score, titleLower);

  return Math.max(0, Math.min(100, score));
}

function calculateBaseScore(queryLower: string, titleLower: string): number {
  if (titleLower === queryLower) {
    return 95;
  }
  if (titleLower.startsWith(queryLower)) {
    return 80;
  }
  if (titleLower.includes(queryLower)) {
    return 60;
  }
  return 0;
}

function applyMangaBoost(score: number, titleLower: string): number {
  if (titleLower.includes('(manga)') || titleLower.includes('(series)')) {
    return score + 20;
  }
  return score;
}

function applyNonMangaPenalty(score: number, titleLower: string): number {
  const penaltyTerms = ['episode', 'anime', 'game', 'movie'];
  if (penaltyTerms.some(term => titleLower.includes(term))) {
    return score - 30;
  }
  return score;
}

/**
 * Get article details for a page
 */
export async function getArticleDetails(
  pageId: number,
  v1API: FandomV1API
): Promise<ArticleDetails | null> {
  try {
    const details = await v1API.getArticleDetails(pageId, {
      abstract: 0,
      width: 150,
      height: 150
    });

    const pageDetail = details[pageId];
    if (pageDetail) {
      return {
        ...(pageDetail.thumbnail ? { thumbnail: pageDetail.thumbnail } : {}),
        metadata: { type: pageDetail.type }
      };
    }
    return null;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.debug('Failed to get article details', { pageId, errorMessage });
    return null;
  }
}

// ============================================================================
// MediaWiki Result Processing - Extracted to reduce depth
// ============================================================================

interface ProcessedMediaWikiResult {
  result: FandomSearchResult;
  shouldInclude: boolean;
}

interface DetailUpdates {
  thumbnail?: string;
  metadata?: FandomSearchResult['metadata'];
  abstract?: string;
}

async function processMediaWikiResult(
  mwResult: MediaWikiSearchResult,
  query: string,
  options: SearchOptions,
  deps: SearchDependencies
): Promise<ProcessedMediaWikiResult | null> {
  // Build wiki context for type determination
  const wikiContext: WikiContext = {
    wikiName: deps.wikiConfig.name,
    subdomain: deps.wikiConfig.subdomain,
    // Wiki is manga-focused if it has chapters/volumes categories defined
    isMangaWiki: !!(deps.wikiConfig.categories?.chapters ?? deps.wikiConfig.categories?.volumes)
  };

  const type = determineResultType(mwResult.title, wikiContext);

  // Filter based on type preference
  if (options.type === 'manga' && type !== 'manga') {
    return null;
  }

  const baseUrl = `${(deps.mediaWikiAPI as unknown as { config: { baseUrl: string } })['config'].baseUrl}/wiki/${encodeURIComponent(mwResult.title)}`;
  const abstract = mwResult.snippet?.replace(/<[^>]*>/g, '');

  let searchResult: FandomSearchResult = {
    id: `mw-${mwResult.pageid}`,
    title: mwResult.title,
    url: baseUrl,
    wikiUrl: baseUrl,
    type,
    wiki: deps.wikiConfig.name,
    ...(abstract ? { abstract } : {}),
    score: calculateRelevanceScore(query, mwResult.title)
  };

  // Fetch enhanced details only when explicitly requested (slow operation)
  if (options.includeDetails === true) {
    const updates = await fetchEnhancedDetails(mwResult, deps);
    // Merge updates, only including defined values
    if (updates.thumbnail) {
      searchResult = { ...searchResult, thumbnail: updates.thumbnail };
    }
    if (updates.metadata) {
      searchResult = { ...searchResult, metadata: updates.metadata };
    }
    if (updates.abstract) {
      searchResult = { ...searchResult, abstract: updates.abstract };
    }
  }

  return { result: searchResult, shouldInclude: true };
}

async function fetchEnhancedDetails(
  mwResult: MediaWikiSearchResult,
  deps: SearchDependencies
): Promise<DetailUpdates> {
  log.info('Fetching enhanced details for result:', {
    title: mwResult.title
  });

  try {
    const [articleDetails, pageDetails] = await Promise.all([
      getArticleDetails(mwResult.pageid, deps.v1API),
      deps.getPageMetadata(mwResult.title)
    ]);

    const updates = buildDetailUpdates(articleDetails, pageDetails);

    log.info('Setting search result metadata:', {
      title: mwResult.title,
      hasArticleDetails: !!articleDetails,
      hasPageDetails: !!pageDetails,
      metadataKeys: updates.metadata ? Object.keys(updates.metadata) : [],
      volumes: updates.metadata?.volumes,
      chapters: updates.metadata?.chapters,
      volumesListUrl: (updates.metadata as FandomPageMetadata | undefined)?.volumesListUrl
    });

    return updates;
  } catch (detailError: unknown) {
    log.error('Failed to get enhanced details', {
      pageid: mwResult.pageid,
      title: mwResult.title,
      error: detailError instanceof Error ? detailError.message : 'Unknown error',
      stack: detailError instanceof Error ? detailError.stack : undefined
    });
    return {};
  }
}

function buildDetailUpdates(
  articleDetails: ArticleDetails | null,
  pageDetails: FandomPageMetadata | null
): DetailUpdates {
  const updates: DetailUpdates = {};

  if (articleDetails) {
    if (articleDetails.thumbnail) {
      updates.thumbnail = articleDetails.thumbnail;
    }
    updates.metadata = {
      ...(articleDetails.metadata ?? {}),
      ...pageDetails
    };
  } else if (pageDetails) {
    updates.metadata = pageDetails;
  }

  // Apply page description
  const description = pageDetails?.['description'] as string | undefined;
  if (description && description !== 'No description available') {
    updates.abstract = description;
  }

  return updates;
}

// ============================================================================
// V1 API Result Processing - Fixed await-in-loop
// ============================================================================

interface V1ResultProcessingContext {
  query: string;
  options: SearchOptions;
  deps: SearchDependencies;
  processedIds: Set<number>;
}

async function processV1Results(
  v1Results: unknown[],
  context: V1ResultProcessingContext
): Promise<FandomSearchResult[]> {
  // Filter v1 results that haven't been processed
  const unprocessedV1Results = v1Results
    .map(raw => raw as Record<string, unknown>)
    .filter(v1Result => !context.processedIds.has(v1Result['id'] as number));

  // Create base results
  const baseResults = unprocessedV1Results
    .map(v1Result => createV1SearchResult(v1Result, context))
    .filter((result): result is FandomSearchResult => result !== null);

  // If no details needed, return base results
  if (!context.options.includeDetails) {
    return baseResults;
  }

  // Fetch details in parallel and merge with results (fixes await-in-loop & no-param-reassign)
  const resultsWithDetails = await Promise.all(
    baseResults.map(async (result, index) => {
      const v1Result = unprocessedV1Results[index];
      if (!v1Result) return result;

      try {
        const v1Id = v1Result['id'] as number;
        const details = await context.deps.v1API.getArticleDetails(v1Id, {
          abstract: 200,
          width: 300,
          height: 300
        });

        const detailsRecord = details as Record<string, FandomV1ArticleDetails>;
        const articleDetail = detailsRecord[v1Id];
        if (articleDetail?.thumbnail) {
          return { ...result, thumbnail: articleDetail.thumbnail };
        }
      } catch (detailError: unknown) {
        log.debug('Failed to get v1 article details', {
          id: v1Result['id'],
          error: detailError instanceof Error ? detailError.message : 'Unknown error'
        });
      }

      return result;
    })
  );

  return resultsWithDetails;
}

function createV1SearchResult(
  v1Result: Record<string, unknown>,
  context: V1ResultProcessingContext
): FandomSearchResult | null {
  const title = v1Result['title'] as string;

  // Build wiki context for type determination
  const wikiContext: WikiContext = {
    wikiName: context.deps.wikiConfig.name,
    subdomain: context.deps.wikiConfig.subdomain,
    isMangaWiki: !!(context.deps.wikiConfig.categories?.chapters ?? context.deps.wikiConfig.categories?.volumes)
  };

  const type = determineResultType(title, wikiContext);

  // Filter based on type preference
  if (context.options.type === 'manga' && type !== 'manga') {
    return null;
  }

  const snippet = v1Result['snippet'] as string | undefined;
  const v1Abstract = snippet?.replace(/<[^>]*>/g, '');
  const id = v1Result['id'];
  const url = v1Result['url'] as string;

  return {
    id: `v1-${id}`,
    title,
    url,
    wikiUrl: url,
    type,
    wiki: context.deps.wikiConfig.name,
    ...(v1Abstract ? { abstract: v1Abstract } : {}),
    score: calculateRelevanceScore(context.query, title)
  };
}

// ============================================================================
// Result Filtering and Sorting
// ============================================================================

function filterAndSortResults(
  results: FandomSearchResult[],
  options: SearchOptions,
  wikiName?: string
): FandomSearchResult[] {
  let filteredResults = results;

  // Filter by type if specified
  if (options.type && options.type !== 'all') {
    filteredResults = results.filter(r => r.type === options.type);
  }

  // Sort by relevance score
  filteredResults.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  // Prioritize main manga page if searching for manga
  if (options.type === 'manga') {
    filteredResults = prioritizeMangaPage(filteredResults, wikiName);
  }

  return filteredResults;
}

/**
 * Check if a page is likely a disambiguation or term page (not the actual manga)
 */
function isDisambiguationPage(title: string, wikiName: string): boolean {
  const titleLower = title.toLowerCase();
  const wikiNameLower = wikiName.toLowerCase();

  // Exact match to wiki name without suffix is likely a disambiguation
  // e.g., "Dandadan" on dandadan wiki when "Dandadan (Manga)" exists
  if (titleLower === wikiNameLower) {
    return true;
  }

  // Pages with disambiguation suffixes
  if (titleLower.includes('(disambiguation)') || titleLower.includes('(term)')) {
    return true;
  }

  return false;
}

function prioritizeMangaPage(
  results: FandomSearchResult[],
  wikiName?: string
): FandomSearchResult[] {
  // Find the actual manga page (with suffix)
  const mainMangaPage = results.find(r =>
    r.title.toLowerCase().endsWith('(manga)') ||
    r.title.toLowerCase().endsWith('(series)')
  );

  if (!mainMangaPage) {
    return results;
  }

  // Filter out disambiguation pages and chapter/volume pages
  const otherResults = results.filter(r => {
    if (r.id === mainMangaPage.id) return false;
    if (wikiName && isDisambiguationPage(r.title, wikiName)) return false;
    if (r.title.toLowerCase().includes('chapter ')) return false;
    if (r.title.toLowerCase().includes('volume ')) return false;
    if (/chapter \d+/i.test(r.title)) return false;
    if (/volume \d+/i.test(r.title)) return false;
    return true;
  });

  return [mainMangaPage, ...otherResults.slice(0, 2)];
}

// ============================================================================
// Batch Thumbnail Fetching
// ============================================================================

/**
 * Map V1 API details to results
 */
function mapDetailsToResults(
  results: FandomSearchResult[],
  details: Record<number, FandomV1ArticleDetails>
): FandomSearchResult[] {
  return results.map(result => {
    const idStr = result.id.replace(/^(mw-|v1-)/, '');
    const pageId = parseInt(idStr, 10);
    const detail = details[pageId];
    return detail?.thumbnail && !result.thumbnail
      ? { ...result, thumbnail: detail.thumbnail }
      : result;
  });
}

/**
 * Update top manga result with better cover from infobox
 */
async function enhanceTopMangaCover(
  results: FandomSearchResult[],
  wikiSubdomain: string
): Promise<FandomSearchResult[]> {
  const topMangaResult = results.find(r => r.type === 'manga')
    ?? results.find(r => !r.thumbnail);

  log.info('enhanceTopMangaCover', {
    resultCount: results.length,
    topMangaResult: topMangaResult ? { id: topMangaResult.id, title: topMangaResult.title, type: topMangaResult.type } : null
  });

  if (!topMangaResult) return results;

  const betterCover = await findBestCover(topMangaResult.title, wikiSubdomain);
  if (!betterCover) return results;

  log.info('Enhanced cover', { title: topMangaResult.title, cover: betterCover.substring(0, 100) });

  return results.map(r =>
    r.id === topMangaResult.id ? { ...r, thumbnail: betterCover } : r
  );
}

/**
 * Batch fetch thumbnails for all results in a single API call
 */
async function batchFetchThumbnails(
  results: FandomSearchResult[],
  v1API: FandomV1API,
  wikiSubdomain?: string
): Promise<FandomSearchResult[]> {
  const pageIds = results
    .map(r => {
      const idStr = r.id.replace(/^(mw-|v1-)/, '');
      const parsed = parseInt(idStr, 10);
      return isNaN(parsed) ? null : parsed;
    })
    .filter((id): id is number => id !== null);

  log.info('batchFetchThumbnails', { resultCount: results.length, pageIds, wikiSubdomain });

  if (pageIds.length === 0) {
    // Even without pageIds, still try enhanced cover from infobox
    if (wikiSubdomain) {
      log.info('No numeric pageIds but wikiSubdomain available, trying enhanced cover');
      return enhanceTopMangaCover(results, wikiSubdomain);
    }
    return results;
  }

  try {
    const details = await v1API.getArticleDetails(pageIds, {
      abstract: 0,
      width: 200,
      height: 200
    });

    log.info('V1 API details fetched', {
      pageIds,
      detailKeys: Object.keys(details),
      hasThumbnails: Object.values(details).some(d => d.thumbnail !== undefined)
    });

    const resultsWithThumbnails = mapDetailsToResults(results, details);

    // For top manga result, try to fetch better cover from infobox
    if (wikiSubdomain) {
      return await enhanceTopMangaCover(resultsWithThumbnails, wikiSubdomain);
    }

    return resultsWithThumbnails;
  } catch (error: unknown) {
    log.warn('Batch thumbnail fetch failed, trying enhanced cover as fallback', {
      error: error instanceof Error ? error.message : 'Unknown error',
      wikiSubdomain
    });
    // Even if V1 API fails, still try infobox cover
    if (wikiSubdomain) {
      return enhanceTopMangaCover(results, wikiSubdomain);
    }
    return results;
  }
}

// ============================================================================
// Exact Title Lookup
// ============================================================================

/**
 * Try to fetch a page by exact title match
 *
 * This is useful for pages that MediaWiki's full-text search fails to find,
 * especially pages with special characters (apostrophes, colons, etc.)
 *
 * @param query - The exact title to look up
 * @param options - Search options
 * @param deps - Dependencies
 * @returns FandomSearchResult if page found, null otherwise
 */
async function tryExactTitleLookup(
  query: string,
  options: SearchOptions,
  deps: SearchDependencies
): Promise<FandomSearchResult | null> {
  try {
    // Get MediaWiki API config for building URLs
    const apiConfig = (deps.mediaWikiAPI as unknown as { config: { baseUrl: string } })['config'];
    const baseUrl = apiConfig.baseUrl;

    // Try exact title lookup
    const page = await deps.mediaWikiAPI.getPageByTitle(query);
    if (!page || page.pageid === -1) {
      return null;
    }

    // Build wiki context for type determination
    const wikiContext: WikiContext = {
      wikiName: deps.wikiConfig.name,
      subdomain: deps.wikiConfig.subdomain,
      isMangaWiki: !!(deps.wikiConfig.categories?.chapters ?? deps.wikiConfig.categories?.volumes)
    };

    const type = determineResultType(page.title, wikiContext);

    // Filter based on type preference (but allow 'all' type to pass through)
    if (options.type && options.type !== 'all' && type !== options.type) {
      return null;
    }

    const pageUrl = `${baseUrl}/wiki/${encodeURIComponent(page.title)}`;

    const result: FandomSearchResult = {
      id: `mw-${page.pageid}`,
      title: page.title,
      url: pageUrl,
      wikiUrl: pageUrl,
      type,
      wiki: deps.wikiConfig.name,
      score: 1.0 // Exact match gets highest score
    };

    log.info('Found exact title match', { query, title: page.title, pageid: page.pageid });
    return result;
  } catch (error: unknown) {
    log.debug('Exact title lookup failed', {
      query,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
}

// ============================================================================
// Main Search Function
// ============================================================================

/**
 * Search for manga or characters across both APIs
 *
 * @param query - Search query string
 * @param options - Search options
 * @param deps - Dependencies (APIs and config)
 * @returns Array of search results
 */
export async function search(
  query: string,
  options: SearchOptions,
  deps: SearchDependencies
): Promise<FandomSearchResult[]> {
  const limit = options.limit ?? 10;

  try {
    // First, try exact title lookup - this handles cases where MediaWiki's
    // full-text search fails to find pages with special characters (apostrophes, etc.)
    // e.g., "Hannelore's Fifth Year at the Royal Academy" on ascendance-of-a-bookworm wiki
    const exactTitleResult = await tryExactTitleLookup(query, options, deps);

    // Try MediaWiki API first (more reliable)
    const mediaWikiResults = await deps.mediaWikiAPI.search(query, { limit });

    // Try v1 API but don't fail if unavailable
    const v1Results = await fetchV1Results(query, limit, deps.v1API);

    // Process MediaWiki results in parallel
    const processPromises = mediaWikiResults.map(mwResult =>
      processMediaWikiResult(mwResult, query, options, deps)
    );
    const processedResults = await Promise.all(processPromises);

    const results: FandomSearchResult[] = processedResults
      .filter((r): r is ProcessedMediaWikiResult => r !== null)
      .map(r => r.result);

    // Add exact title result if found and not already in results
    if (exactTitleResult) {
      const exactId = exactTitleResult.id;
      if (!results.some(r => r.id === exactId)) {
        // Add to front since exact match is highest priority
        results.unshift(exactTitleResult);
        log.info('Added exact title match to results', { title: exactTitleResult.title, id: exactId });
      }
    }

    // Process v1 API results (avoid duplicates)
    const processedIds = new Set(mediaWikiResults.map(r => r.pageid));
    const v1ProcessedResults = await processV1Results(v1Results, {
      query,
      options,
      deps,
      processedIds
    });
    results.push(...v1ProcessedResults);

    // Filter and sort results - pass wiki name to filter disambiguation pages
    const wikiName = deps.wikiConfig.name;
    const sortedResults = filterAndSortResults(results, options, wikiName).slice(0, limit);

    // Batch fetch thumbnails - pass subdomain for enhanced cover fetching
    const wikiSubdomain = deps.wikiConfig.subdomain;
    const resultsWithThumbnails = await batchFetchThumbnails(
      sortedResults,
      deps.v1API,
      wikiSubdomain
    );

    return resultsWithThumbnails;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('Search failed', { query, errorMessage });
    throw error;
  }
}

async function fetchV1Results(
  query: string,
  limit: number,
  v1API: FandomV1API
): Promise<unknown[]> {
  try {
    return await v1API.searchArticles(query, { limit });
  } catch (v1Error: unknown) {
    log.debug('Fandom v1 API search failed, using MediaWiki only', {
      error: v1Error instanceof Error ? v1Error.message : 'Unknown error'
    });
    return [];
  }
}
