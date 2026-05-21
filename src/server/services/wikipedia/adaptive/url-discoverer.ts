/**
 * Wikipedia URL Discoverer
 *
 * Discovers Wikipedia pages for manga volumes and chapters using
 * extensive URL patterns and title variations.
 *
 * @module wikipedia/adaptive/url-discoverer
 */

/* eslint-disable no-param-reassign -- Discovery functions accumulate results into a shared object */

import { normalizeUrlForComparison } from '@/server/utils/url-normalization';
import { logger } from '@/utils/logger';

import { batchCheckPagesWithSize, searchChapterListPages } from '../wikipedia/api-client';

import {
  type WikipediaPageType,
  type WikipediaUrlDiscoveryResult,
  type WikipediaUrlProbeResult,
  type UrlPattern,
  type TitleVariation,
  WIKIPEDIA_ARTICLE_BASE,
} from './types';

// ============================================================================
// URL Pattern Definitions
// ============================================================================

/**
 * URL patterns for discovering Wikipedia manga pages.
 * Ordered by priority (most specific/reliable first).
 * Note: manga_volumes is tried before chapters because it typically has more complete data
 */
const URL_PATTERNS: UrlPattern[] = [
  // Primary patterns - dedicated list pages (most reliable)
  { template: 'List_of_{TITLE}_manga_volumes', priority: 1, expectedPageType: 'list-page', requiresEncoding: true },
  { template: 'List_of_{TITLE}_chapters', priority: 2, expectedPageType: 'list-page', requiresEncoding: true },
  { template: 'List_of_{TITLE}_manga_chapters', priority: 3, expectedPageType: 'list-page', requiresEncoding: true },
  { template: 'List_of_{TITLE}_volumes', priority: 4, expectedPageType: 'list-page', requiresEncoding: true },

  // Alternative list patterns
  { template: '{TITLE}_chapter_list', priority: 5, expectedPageType: 'list-page', requiresEncoding: true },
  { template: '{TITLE}_(manga)_chapters', priority: 6, expectedPageType: 'list-page', requiresEncoding: true },

  // Main article patterns (for Media sections)
  { template: '{TITLE}_(manga)', priority: 10, expectedPageType: 'main-article', requiresEncoding: true },
  { template: '{TITLE}_(comics)', priority: 11, expectedPageType: 'main-article', requiresEncoding: true },
  { template: '{TITLE}_(manhwa)', priority: 12, expectedPageType: 'main-article', requiresEncoding: true },
  { template: '{TITLE}_(manhua)', priority: 13, expectedPageType: 'main-article', requiresEncoding: true },
  { template: '{TITLE}_(novel_series)', priority: 14, expectedPageType: 'main-article', requiresEncoding: true },
  { template: '{TITLE}', priority: 15, expectedPageType: 'main-article', requiresEncoding: true },
  // Note: List_of_{TITLE}_episodes intentionally excluded - anime episode lists don't have manga data
];

/**
 * Known title mappings for special cases.
 * Use actual characters (not URL-encoded) - encoding happens in API calls.
 */
const TITLE_MAPPINGS: Record<string, string> = {
  'spy x family': 'Spy_×_Family',
  'spy-x-family': 'Spy_×_Family',
  'hunter x hunter': 'Hunter_×_Hunter',
  'hunter-x-hunter': 'Hunter_×_Hunter',
  '86': '86_(novel_series)',
  '86 eighty-six': '86_(novel_series)',
  'one piece': 'One_Piece',
  'jjk': 'Jujutsu_Kaisen',
  'jujutsu kaisen': 'Jujutsu_Kaisen',
  'mha': 'My_Hero_Academia',
  'my hero academia': 'My_Hero_Academia',
  'demon slayer': 'Demon_Slayer:_Kimetsu_no_Yaiba',
  'kimetsu no yaiba': 'Demon_Slayer:_Kimetsu_no_Yaiba',
  'attack on titan': 'Attack_on_Titan',
  'fullmetal alchemist': 'Fullmetal_Alchemist',
  'one punch man': 'One-Punch_Man',
  'bleach': 'Bleach_(manga)',
  'naruto': 'Naruto',
  'tokyo ghoul': 'Tokyo_Ghoul',
  'dr stone': 'Dr._Stone',
  'dr. stone': 'Dr._Stone',
  'blue lock': 'Blue_Lock',
  'haikyuu': 'Haikyu!!',
  'haikyu': 'Haikyu!!',
  'vinland saga': 'Vinland_Saga_(manga)',
  'chainsaw man': 'Chainsaw_Man',
  'black clover': 'Black_Clover',
  'solo leveling': 'Solo_Leveling',
  'mob psycho 100': 'Mob_Psycho_100',
  'frieren': 'Frieren',
  'call of the night': 'Call_of_the_Night',
  'fly me to the moon': 'Fly_Me_to_the_Moon_(manga)',
  'tokyo revengers': 'Tokyo_Revengers',
  'horimiya': 'Horimiya',
  'the promised neverland': 'The_Promised_Neverland',
  'vagabond': 'Vagabond_(manga)',
  'goodnight punpun': 'Goodnight_Punpun',
  "jojo's bizarre adventure": "JoJo's_Bizarre_Adventure",
  'monster': 'Monster_(manga)',
  // Konosuba uses non-standard capitalization on Wikipedia: "KonoSuba"
  // The page is /wiki/List_of_KonoSuba_volumes (Vol-not-Chap list pattern).
  'konosuba': 'KonoSuba',
  'kono subarashii sekai ni shukufuku wo': 'KonoSuba',
  'kono subarashii sekai ni shukufuku wo!': 'KonoSuba',
  'slam dunk': 'Slam_Dunk_(manga)',
  'land of the lustrous': 'Land_of_the_Lustrous',
  'fire punch': 'Fire_Punch',
  're:zero': 'Re:Zero',
  'mushoku tensei': 'Mushoku_Tensei',
  'dorohedoro': 'Dorohedoro',
  'neon genesis evangelion': 'Neon_Genesis_Evangelion_(manga)',
  'darling in the franxx': 'Darling_in_the_Franxx',
  'march comes in like a lion': 'March_Comes_In_like_a_Lion',
  '3-gatsu no lion': 'March_Comes_In_like_a_Lion',
  'sangatsu no lion': 'March_Comes_In_like_a_Lion',
  'kaiju no. 8': 'Kaiju_No._8',
  'sakamoto days': 'Sakamoto_Days',
  'kaguya-sama': 'Kaguya-sama:_Love_Is_War',
  'kaguya-sama: love is war': 'Kaguya-sama:_Love_Is_War',
  'kaguya sama love is war': 'Kaguya-sama:_Love_Is_War',
  'iruma-kun': 'Welcome_to_Demon_School!_Iruma-kun',
  'gachiakuta': 'Gachiakuta',
};

// ============================================================================
// Main Discovery Function
// ============================================================================

/**
 * Discover Wikipedia URLs for a manga title.
 */
export async function discoverWikipediaUrls(
  titleOrUrl: string,
  options: { preferListPage?: boolean; timeoutMs?: number } = {}
): Promise<WikipediaUrlDiscoveryResult> {
  const startTime = Date.now();
  const { preferListPage = true, timeoutMs = 10000 } = options;

  const result = createEmptyDiscoveryResult();

  try {
    if (titleOrUrl.includes('wikipedia.org')) {
      return await handleWikipediaUrl(titleOrUrl, result, startTime, preferListPage, timeoutMs);
    }

    const variations = generateTitleVariations(titleOrUrl);
    await discoverPages(variations, result, preferListPage, timeoutMs);
    result.primaryUrl = determinePrimaryUrl(result, preferListPage);

  } catch (error) {
    logDiscoveryError(titleOrUrl, error);
  }

  result.durationMs = Date.now() - startTime;
  logDiscoveryComplete(titleOrUrl, result);

  return result;
}

/**
 * Create an empty discovery result.
 */
function createEmptyDiscoveryResult(): WikipediaUrlDiscoveryResult {
  return {
    primaryUrl: null,
    listPageUrl: null,
    mainArticleUrl: null,
    sectionAnchor: null,
    triedUrls: [],
    statusCodes: new Map(),
    pageType: 'unknown',
    durationMs: 0,
  };
}

/**
 * Discover list and main article pages.
 */
async function discoverPages(
  variations: TitleVariation[],
  result: WikipediaUrlDiscoveryResult,
  preferListPage: boolean,
  timeoutMs: number
): Promise<void> {
  if (preferListPage) {
    const listResult = await findListPage(variations, result, timeoutMs);
    if (listResult) {
      result.listPageUrl = listResult.url;
      result.pageType = 'list-page';
    }
  }

  const mainResult = await findMainArticle(variations, result, timeoutMs);
  if (mainResult) {
    result.mainArticleUrl = mainResult.url;
    if (!result.listPageUrl) {
      result.pageType = 'main-article';
    }
  }
}

/**
 * Determine the primary URL based on preferences.
 */
function determinePrimaryUrl(
  result: WikipediaUrlDiscoveryResult,
  preferListPage: boolean
): string | null {
  if (preferListPage && result.listPageUrl) return result.listPageUrl;
  return result.mainArticleUrl ?? result.listPageUrl;
}

/**
 * Log discovery error.
 */
function logDiscoveryError(titleOrUrl: string, error: unknown): void {
  logger.error('[WikipediaDiscoverer] Discovery error', {
    titleOrUrl,
    error: error instanceof Error ? error.message : String(error),
  });
}

/**
 * Log discovery completion.
 */
function logDiscoveryComplete(
  titleOrUrl: string,
  result: WikipediaUrlDiscoveryResult
): void {
  logger.debug('[WikipediaDiscoverer] Discovery complete', {
    titleOrUrl,
    primaryUrl: result.primaryUrl,
    listPageUrl: result.listPageUrl,
    mainArticleUrl: result.mainArticleUrl,
    triedCount: result.triedUrls.length,
    durationMs: result.durationMs,
  });
}

// ============================================================================
// URL Handling
// ============================================================================

/**
 * Handle an existing Wikipedia URL.
 * Extracts the title and performs full discovery to find list pages.
 */
async function handleWikipediaUrl(
  url: string,
  result: WikipediaUrlDiscoveryResult,
  startTime: number,
  preferListPage: boolean,
  timeoutMs: number
): Promise<WikipediaUrlDiscoveryResult> {
  const match = url.match(/\/wiki\/([^#?]+)/);
  if (!match?.[1]) {
    result.durationMs = Date.now() - startTime;
    return result;
  }

  const pageTitle = decodeURIComponent(match[1]);

  if (url.includes('#')) {
    result.sectionAnchor = url.split('#')[1] ?? null;
  }

  // Always set the provided URL as a known good URL
  if (pageTitle.startsWith('List_of_')) {
    result.listPageUrl = url;
    result.pageType = 'list-page';
  } else {
    result.mainArticleUrl = url;
    result.pageType = result.sectionAnchor ? 'section-anchor' : 'main-article';
  }

  // Extract a clean title for discovery (remove underscores, parentheticals)
  // e.g., "One_Piece" -> "One Piece", "Bleach_(manga)" -> "Bleach"
  const cleanTitle = pageTitle
    .replace(/_/g, ' ')
    .replace(/\s*\([^)]+\)\s*$/, '')
    .trim();

  // Run full discovery to find list pages (volumes/chapters)
  // This is the key fix - we now discover related pages instead of returning early
  if (cleanTitle && !pageTitle.startsWith('List_of_')) {
    logger.debug('[WikipediaDiscoverer] Running discovery from URL', {
      url,
      cleanTitle,
      pageTitle,
    });

    const variations = generateTitleVariations(cleanTitle);
    await discoverPages(variations, result, preferListPage, timeoutMs);
  }

  result.primaryUrl = determinePrimaryUrl(result, preferListPage);
  result.durationMs = Date.now() - startTime;
  return result;
}

// ============================================================================
// Title Variations
// ============================================================================

/**
 * Generate title variations for URL discovery.
 */
export function generateTitleVariations(title: string): TitleVariation[] {
  const variations: TitleVariation[] = [];
  const seen = new Set<string>();

  const addVariation = (t: string, type: TitleVariation['type']): void => {
    const normalized = t.trim();
    if (!seen.has(normalized.toLowerCase())) {
      seen.add(normalized.toLowerCase());
      variations.push({ title: normalized, type });
    }
  };

  // Check for known mapping first (highest priority)
  const lowerTitle = title.toLowerCase().trim();
  if (TITLE_MAPPINGS[lowerTitle]) {
    addVariation(TITLE_MAPPINGS[lowerTitle], 'normalized');
  }

  // Special character variants BEFORE normalized - important for "x" vs "×"
  // This ensures we try the actual page (×) before the redirect page (x)
  const specialCharVariants = handleSpecialCharacters(title);
  for (const variant of specialCharVariants) {
    addVariation(variant, 'encoded');
  }

  addVariation(title, 'original');

  const normalized = normalizeTitle(title);
  addVariation(normalized, 'normalized');

  const encoded = encodeURIComponent(title.replace(/ /g, '_'));
  if (encoded !== normalized) {
    addVariation(encoded, 'encoded');
  }

  addVariation(`${normalized}_(manga)`, 'parenthetical');
  addVariation(`${normalized}_(comics)`, 'parenthetical');

  return variations;
}

/**
 * Normalize a title for Wikipedia URLs.
 */
function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Handle special characters in titles.
 * Returns variants with actual characters - encoding happens in API calls.
 */
function handleSpecialCharacters(title: string): string[] {
  const variants: string[] = [];
  const normalized = normalizeTitle(title);

  // Convert " x " to "×" (multiplication sign)
  if (title.includes('×') || title.toLowerCase().includes(' x ')) {
    variants.push(normalized.replace(/_x_/gi, '_×_'));
  }

  if (title.includes(':')) {
    variants.push(normalized);
  }

  // Apostrophes are kept as-is - encoding handled by API
  if (title.includes("'")) {
    variants.push(normalized);
  }

  return variants;
}

// ============================================================================
// Page Discovery (Batch Optimized)
// ============================================================================

/**
 * Minimum content size in bytes for a valid list page.
 * Pages smaller than this are likely stubs or redirects.
 */
const MIN_LIST_PAGE_SIZE = 10000;

/**
 * Minimum content size for main articles (lower threshold).
 */
const MIN_MAIN_ARTICLE_SIZE = 5000;

/**
 * Candidate page for batch lookup
 */
interface PageCandidate {
  pageTitle: string;
  url: string;
  pattern: UrlPattern;
  variation: TitleVariation;
}

/**
 * Find a list page for the given title variations using batch lookup.
 * Collects all possible patterns, checks them in a single API call.
 * Falls back to search-based discovery for split chapter lists (Part I, volumes 1-27, etc.)
 */
async function findListPage(
  variations: TitleVariation[],
  result: WikipediaUrlDiscoveryResult,
  _timeoutMs: number
): Promise<WikipediaUrlProbeResult | null> {
  const listPatterns = URL_PATTERNS.filter(p => p.expectedPageType === 'list-page');
  const patternResult = await findPageByPatternsBatch(variations, listPatterns, result, 'list-page', MIN_LIST_PAGE_SIZE);

  if (patternResult) {
    return patternResult;
  }

  // Fallback: Use search API to find split chapter lists like (Part I), (volumes 1-27), etc.
  return findListPageViaSearch(variations, result);
}

/**
 * Search-based fallback for finding list pages.
 * Catches split chapter lists that pattern matching misses.
 */
async function findListPageViaSearch(
  variations: TitleVariation[],
  result: WikipediaUrlDiscoveryResult
): Promise<WikipediaUrlProbeResult | null> {
  // Use the first variation (most likely to match)
  const primaryTitle = variations[0]?.title;
  if (!primaryTitle) {
    return null;
  }

  const searchResults = await searchChapterListPages(primaryTitle, MIN_LIST_PAGE_SIZE);

  if (searchResults.length === 0) {
    return null;
  }

  // Sort by size and pick the largest (most complete data)
  searchResults.sort((a, b) => b.size - a.size);
  const best = searchResults[0];
  if (!best) {
    return null;
  }

  const url = `${WIKIPEDIA_ARTICLE_BASE}${best.title.replace(/ /g, '_')}`;

  logger.debug('[WikipediaDiscoverer] Found list page via search fallback', {
    title: primaryTitle,
    foundPage: best.title,
    size: best.size,
    totalResults: searchResults.length,
  });

  result.triedUrls.push(url);
  result.statusCodes.set(url, 200);

  return createProbeResult(url, 'list-page', best.size);
}

/**
 * Find a main article for the given title variations using batch lookup.
 */
async function findMainArticle(
  variations: TitleVariation[],
  result: WikipediaUrlDiscoveryResult,
  _timeoutMs: number
): Promise<WikipediaUrlProbeResult | null> {
  const mainPatterns = URL_PATTERNS.filter(p => p.expectedPageType === 'main-article');
  return findPageByPatternsBatch(variations, mainPatterns, result, 'main-article', MIN_MAIN_ARTICLE_SIZE);
}

/**
 * Find a page by batch-checking all pattern combinations.
 *
 * OPTIMIZATION: Instead of sequential API calls per pattern (13+ calls),
 * we collect all candidates and check them in a single batch call (1 call).
 */
async function findPageByPatternsBatch(
  variations: TitleVariation[],
  patterns: UrlPattern[],
  result: WikipediaUrlDiscoveryResult,
  pageType: WikipediaPageType,
  minSize: number
): Promise<WikipediaUrlProbeResult | null> {
  // Step 1: Collect all candidate pages (no API calls yet)
  const candidates = collectCandidates(variations, patterns, result);

  if (candidates.length === 0) {
    return null;
  }

  // Step 2: Batch check all candidates in a single API call
  const pageTitles = candidates.map(c => c.pageTitle);
  const batchResults = await batchCheckPagesWithSize(pageTitles, minSize);

  // Step 3: Collect ALL valid candidates and select the LARGEST by size
  // (Previously returned first match - now we compare quality via size)
  const validPages: Array<{ candidate: PageCandidate; size: number }> = [];

  for (const candidate of candidates) {
    const checkResult = batchResults.get(candidate.pageTitle);

    // Record the attempt
    result.triedUrls.push(candidate.url);
    result.statusCodes.set(candidate.url, checkResult?.exists ? 200 : 404);

    if (checkResult?.exists && checkResult.hasContent) {
      validPages.push({ candidate, size: checkResult.size });
    } else if (checkResult?.exists && !checkResult.hasContent) {
      logger.debug('[WikipediaDiscoverer] Page exists but is a stub', {
        pageTitle: candidate.pageTitle,
        size: checkResult.size,
        minRequired: minSize,
      });
    }
  }

  if (validPages.length === 0) {
    return null;
  }

  // Sort by size descending and return largest (most complete data)
  validPages.sort((a, b) => b.size - a.size);
  const best = validPages[0] as { candidate: PageCandidate; size: number };

  logger.debug('[WikipediaDiscoverer] Selected largest page via batch lookup', {
    pageTitle: best.candidate.pageTitle,
    size: best.size,
    pattern: best.candidate.pattern.template,
    candidatesCompared: validPages.length,
  });

  return createProbeResult(best.candidate.url, pageType, best.size);
}

/**
 * Collect all candidate page titles from variations and patterns.
 * Returns candidates in priority order (patterns first, then variations).
 * Uses normalized URL comparison to prevent duplicates from case/trailing slash differences.
 */
function collectCandidates(
  variations: TitleVariation[],
  patterns: UrlPattern[],
  result: WikipediaUrlDiscoveryResult
): PageCandidate[] {
  const candidates: PageCandidate[] = [];
  // Use normalized URLs for deduplication (handles case, trailing slashes, etc.)
  const seenNormalized = new Set(result.triedUrls.map(normalizeUrlForComparison));

  // Iterate variations first, then patterns within each variation
  // This maintains the priority: known mappings → special chars → normalized → encoded
  for (const variation of variations) {
    for (const pattern of patterns) {
      const titleForUrl = variation.title.replace(/ /g, '_');
      const pageTitle = pattern.template.replace('{TITLE}', titleForUrl);
      const url = `${WIKIPEDIA_ARTICLE_BASE}${pageTitle}`;
      const normalized = normalizeUrlForComparison(url);

      if (seenNormalized.has(normalized)) continue;
      seenNormalized.add(normalized);

      candidates.push({
        pageTitle,
        url,
        pattern,
        variation,
      });
    }
  }

  return candidates;
}

/**
 * Create a successful probe result.
 */
function createProbeResult(
  url: string,
  pageType: WikipediaPageType,
  size: number = 0
): WikipediaUrlProbeResult {
  return {
    url,
    exists: true,
    statusCode: 200,
    probeTimeMs: 0,
    hasVolumeData: pageType === 'list-page',
    hasChapterData: pageType === 'list-page',
    pageType,
    size,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Build full Wikipedia URL from page title.
 */
export function buildWikipediaUrl(pageTitle: string): string {
  const normalized = normalizeTitle(pageTitle);
  return `${WIKIPEDIA_ARTICLE_BASE}${encodeURIComponent(normalized)}`;
}

/**
 * Extract page title from Wikipedia URL.
 */
export function extractPageTitle(url: string): string | null {
  const match = url.match(/\/wiki\/([^#?]+)/);
  if (!match?.[1]) return null;
  return decodeURIComponent(match[1].replace(/_/g, ' '));
}

/**
 * Check if a URL is a Wikipedia URL.
 */
export function isWikipediaUrl(url: string): boolean {
  return url.includes('wikipedia.org/wiki/');
}

/**
 * Get the normalized title for cache lookups.
 */
export function getNormalizedCacheKey(titleOrUrl: string): string {
  if (isWikipediaUrl(titleOrUrl)) {
    const title = extractPageTitle(titleOrUrl);
    return title?.toLowerCase().replace(/_/g, ' ') ?? titleOrUrl.toLowerCase();
  }
  return titleOrUrl.toLowerCase().trim();
}
