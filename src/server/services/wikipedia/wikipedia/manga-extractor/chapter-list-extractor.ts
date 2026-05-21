/**
 * Chapter List Extractor Module
 *
 * Orchestrates chapter extraction from Wikipedia:
 * - Searches for "List of X chapters" pages
 * - Handles redirects and disambiguation pages
 * - Parses chapter tables
 * - Provides fallback search strategies
 *
 * Extracted from manga-extractor (lines 464-715)
 */

import { filterToMainSeriesContent } from '@/server/services/shared/parsing-utils';
import { logger } from '@/utils/logger';

import {
  fetchPageContentById,
  lookupPageByTitle,
  searchChapterListPages,
} from '../api-client';
import {
  parseChapterTables,
  parseVolumeListPattern,
} from '../chapter-parser';

import type { Cache, WikipediaChapter } from '../types';

/** Extract chapter number from a single list item's text content.
 *  For ranges "N-M", returns M (the upper endpoint) for max-chapter detection.
 *  Accepts decimals: "1.5. Title" -> 1.5, "Chapter 139.5" -> 139.5. */
function extractChapterNumberFromLiText(text: string): number {
  const std = text.match(/^0*(\d+(?:\.\d+)?)(?:[–-]0*(\d+(?:\.\d+)?))?[.\s"]/);
  if (std) return std[2] ? parseFloat(std[2]) : parseFloat(std[1] ?? '0');
  const bub = text.match(/^Bub\s+(\d+(?:\.\d+)?)/i);
  if (bub) return parseFloat(bub[1] ?? '0');
  const genius = text.match(/^Genius\s+0*(\d+(?:\.\d+)?)/i);
  if (genius) return parseFloat(genius[1] ?? '0');
  const chPrefix = text.match(/^Chapter\s+0*(\d+(?:\.\d+)?)/i);
  if (chPrefix) return parseFloat(chPrefix[1] ?? '0');
  return 0;
}

/** Count <ol><li> items inside wikitables (for pages with implicit ordered list numbering) */
function countOlLiInWikitables(html: string): number {
  const tablePattern = /<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>[\s\S]*?<\/table>/gi;
  let total = 0;
  let tableMatch;
  while ((tableMatch = tablePattern.exec(html)) !== null) {
    const olMatches = tableMatch[0].match(/<ol[^>]*>[\s\S]*?<\/ol>/gi);
    if (!olMatches) continue;
    for (const olBlock of olMatches) {
      const liMatches = olBlock.match(/<li[^>]*>/gi);
      if (liMatches) total += liMatches.length;
    }
  }
  return total;
}

/** Extract max chapter number from list items in HTML.
 *  Handles explicit formats: "N.", "Bub N", "Genius N", "Chapter N:".
 *  Falls back to counting <ol><li> items in wikitables for implicit numbering. */
function extractMaxChapterFromListItems(html: string): number | null {
  let maxChapter = 0;
  const liPattern = /<li[^>]*>(.*?)<\/li>/gis;
  let match;
  while ((match = liPattern.exec(html)) !== null) {
    const text = (match[1] ?? '').replace(/<[^>]*>/g, '').trim();
    const num = extractChapterNumberFromLiText(text);
    if (num > maxChapter && num < 1000) maxChapter = num;
  }

  // Fallback: count <ol><li> items for pages using implicit ordered list numbering
  if (maxChapter < 10) {
    const olLiTotal = countOlLiInWikitables(html);
    if (olLiTotal >= 10) {
      maxChapter = olLiTotal;
      logger.info(`[WIKIPEDIA] Counted ${olLiTotal} <ol><li> items in wikitables (implicit numbering)`);
    }
  }

  return maxChapter >= 10 ? maxChapter : null;
}

/**
 * Convert per-volume chapter numbering to global numbering in place.
 *
 * Single-page "List of X chapters" pages sometimes render each volume as its
 * own table with chapter numbers reset to 1 per volume (e.g., 20th Century
 * Boys: Vol1/Ch1 "Friends", Vol2/Ch1 "Amiability"...). Downstream maps keyed
 * by number collapse these duplicates, dropping real titles.
 *
 * Detects per-volume numbering via high duplicate density + volumeNumber
 * presence, then assigns 1..N globally, sorted by (volume, original number).
 *
 * Also used by the multi-sub-page merge path where per-volume numbers appear
 * via duplicate collapse.
 */
function applyPerVolumeRenumbering(chapters: WikipediaChapter[]): void {
  if (chapters.length === 0) return;
  const uniqueNumbers = new Set(chapters.map(c => c.number));
  const hasVolumes = chapters.some(c => c.volumeNumber !== undefined);
  if (chapters.length <= uniqueNumbers.size * 2 || !hasVolumes) return;

  logger.info(
    `[WIKIPEDIA] Per-volume numbering detected (${chapters.length} raw → ${uniqueNumbers.size} unique numbers), renumbering globally`,
  );

  const sorted = [...chapters].sort((a, b) => {
    const va = a.volumeNumber ?? 0;
    const vb = b.volumeNumber ?? 0;
    if (va !== vb) return va - vb;
    const na = typeof a.number === 'number' ? a.number : parseFloat(String(a.number));
    const nb = typeof b.number === 'number' ? b.number : parseFloat(String(b.number));
    return na - nb;
  });
  for (let i = 0; i < sorted.length; i++) {
    const ch = sorted[i];
    if (ch) ch.number = i + 1;
  }
  /* eslint-disable-next-line no-param-reassign -- intentional in-place mutation; callers retain same array reference */
  chapters.length = 0;
  chapters.push(...sorted);
}

/** Known title aliases for chapter list pages that use different naming */
const CHAPTER_LIST_ALIASES: Record<string, string> = {
  'Detective Conan': 'List of Case Closed chapters',
  'Case Closed': 'List of Case Closed chapters',
  'Haikyuu!!': 'List of Haikyu!! chapters',
  'Haikyu': 'List of Haikyu!! chapters',
  'Kaguya-sama wa Kokurasetai: Tensai-tachi no Renai Zunousen': 'List of Kaguya-sama: Love Is War chapters',
  'Kaguya-sama': 'List of Kaguya-sama: Love Is War chapters',
  'Diamond no Ace': 'List of Ace of Diamond chapters',
  'Ace of Diamond': 'List of Ace of Diamond chapters',
  'Kuroko no Basket': "List of Kuroko's Basketball chapters",
  "Kuroko's Basketball": "List of Kuroko's Basketball chapters",
  'Ajin': 'List of Ajin: Demi-Human chapters',
  'Ajin: Demi-Human': 'List of Ajin: Demi-Human chapters',
  'Tokyo Ghoul:re': 'List of Tokyo Ghoul chapters',
  'Tokyo Ghoul': 'List of Tokyo Ghoul chapters',
  "JoJo's Bizarre Adventure": "List of JoJo's Bizarre Adventure volumes",
  "JoJo Part 1: Phantom Blood": "Phantom Blood",
  "JoJo Part 2: Battle Tendency": "Battle Tendency",
  "JoJo Part 3: Stardust Crusaders": "List of JoJo's Bizarre Adventure: Stardust Crusaders chapters",
  "JoJo Part 4: Diamond is Unbreakable": "List of JoJo's Bizarre Adventure: Diamond Is Unbreakable chapters",
  "JoJo Part 5: Golden Wind": "List of JoJo's Bizarre Adventure: Golden Wind chapters",
  "JoJo Part 6: Stone Ocean": "List of JoJo's Bizarre Adventure: Stone Ocean chapters",
  "JoJo Part 7: Steel Ball Run": "List of Steel Ball Run chapters",
  "JoJo Part 8: JoJolion": "List of JoJolion chapters",
  'InuYasha': 'List of InuYasha chapters',
  'Inuyasha': 'List of InuYasha chapters',
  'Fist of the North Star': 'List of Fist of the North Star chapters',
  'Hokuto no Ken': 'List of Fist of the North Star chapters',
  'The Quintessential Quintuplets': 'List of The Quintessential Quintuplets volumes',
  'Beelzebub': 'List of Beelzebub chapters',
  'Prince of Tennis': 'List of The Prince of Tennis chapters',
  'Deadman Wonderland': 'Deadman Wonderland',
  'Eden no Ori': 'Cage of Eden',
  'Psyren': 'List of Psyren chapters',
  'March Comes in Like a Lion': 'March Comes In like a Lion',
  '3-gatsu no Lion': 'March Comes In like a Lion',
  'Ao Ashi': 'Aoashi',
  'Aoashi': 'Aoashi',
};


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
 * @param cache - Cache instance for storing results
 * @returns Array of chapters with titles and metadata
 */
// eslint-disable-next-line max-statements, complexity -- 60 statements + complexity 30: Wikipedia article fetch + cache check + section discovery + table parsing + chapter extraction with alias/redirect fallback paths; future split candidate
export async function getChapterList(
  mangaTitle: string,
  cache: Cache<unknown>
): Promise<WikipediaChapter[]> {
  const cacheKey = `chapters:${mangaTitle}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    logger.debug(`[WIKIPEDIA] Using cached chapters for: ${mangaTitle}`);
    return cached as WikipediaChapter[];
  }

  try {
    const chapterPageTitle = `List of ${mangaTitle} chapters`;
    logger.info(`[WIKIPEDIA] Looking for chapter list page: "${chapterPageTitle}"`);

    const searchResponse = await lookupPageByTitle(chapterPageTitle);
    const pages = searchResponse.query?.pages;

    if (!pages) {
      return [];
    }

    const pageId = Object.keys(pages)[0];
    if (pageId === '-1') {
      // Try known title aliases before falling back to search
      const aliasTitle = CHAPTER_LIST_ALIASES[mangaTitle];
      if (aliasTitle) {
        const derivedTitle = aliasTitle.replace('List of ', '').replace(' chapters', '').replace(' volumes', '');
        // Guard against recursive alias lookup
        if (derivedTitle !== mangaTitle) {
          logger.info(`[WIKIPEDIA] Trying alias: "${aliasTitle}"`);
          const aliasResponse = await lookupPageByTitle(aliasTitle);
          const aliasPages = aliasResponse.query?.pages;
          const aliasPageId = aliasPages ? Object.keys(aliasPages)[0] : undefined;
          // eslint-disable-next-line max-depth -- depth 5 is the alias-page-found short-circuit recursing into the derived title; flattening would obscure the early-return
          if (aliasPageId && aliasPageId !== '-1') {
            return await getChapterList(derivedTitle, cache);
          }
        }
      }
      logger.info(`[WIKIPEDIA] Chapter list page not found, trying alternative search`);
      return await searchChapterList(mangaTitle);
    }

    if (!pageId) {
      logger.warn('[WIKIPEDIA] No valid page ID found for chapter list');
      return [];
    }

    logger.info(`[WIKIPEDIA] Found chapter list page, fetching content for page ID: ${pageId}`);

    // Detect sub-page redirect: Wikipedia API may resolve to a specific sub-page
    // e.g., "List of Bleach chapters" → "List of Bleach chapters (424–686)"
    // Also detect redirect to volumes page: "List of Naruto chapters" → "List of Naruto volumes"
    const pageData = pages[pageId] as Record<string, unknown> | undefined;
    const returnedTitle = typeof pageData?.['title'] === 'string' ? (pageData['title'] as string) : '';
    const subPageRangePattern = /\(\d+[\u2013\-–]\d+\)/;
    const hasPartSuffix = /\(Part\s/i.test(returnedTitle);
    const redirectedToVolumes = returnedTitle.toLowerCase().includes('volumes') && !returnedTitle.toLowerCase().includes('chapters');

    if (subPageRangePattern.test(returnedTitle) || hasPartSuffix || redirectedToVolumes) {
      logger.info(`[WIKIPEDIA] Detected sub-page/redirect: "${returnedTitle}", searching for all sibling pages`);
      const siblings = await fetchAllSiblingSubPages(mangaTitle, cacheKey, cache);
      if (siblings.length > 0) return siblings;
      // Fall through to normal parsing if no siblings found
    }

    const response = await fetchPageContentById(parseInt(pageId, 10));
    if (!response.parse) {
      return [];
    }

    const htmlContent = response.parse.text?.['*'] ?? '';

    // Handle redirect pages
    if (isRedirectPage(htmlContent)) {
      return await handleRedirectPage(htmlContent, mangaTitle, cacheKey, cache);
    }

    // Handle disambiguation pages
    if (isDisambiguationPage(htmlContent)) {
      return await parseDisambiguationPage(htmlContent, mangaTitle, cacheKey, cache);
    }

    // Filter to main series content before parsing (excludes sequels like Tokyo Ghoul:re)
    const filteredHtml = filterToMainSeriesContent(htmlContent, mangaTitle);

    // Parse as normal chapter page
    const chapters = parseChapterTables(filteredHtml);

    // Repair per-volume numbering (e.g., 20th Century Boys resets each volume to 1)
    applyPerVolumeRenumbering(chapters);

    // Cross-validate with table list items (handles "Bub N", "Genius N", "00N.", <ol><li> formats)
    const tableMax = extractMaxChapterFromListItems(filteredHtml);
    if (tableMax && chapters.length > 0 && tableMax > chapters.length * 1.2) {
      // Table shows more chapters than parser found — supplement with placeholders
      const maxParsed = Math.max(...chapters.map(ch => typeof ch.number === 'number' ? ch.number : 0));
      for (let i = maxParsed + 1; i <= tableMax; i++) {
        chapters.push({ number: i, title: `Chapter ${i}` });
      }
      logger.info(`[WIKIPEDIA] Table list supplement: ${maxParsed}→${tableMax} chapters`);
    }

    cache.set(cacheKey, chapters);
    return chapters;
  } catch (error: unknown) {
    logger.error(
      `Wikipedia getChapterList errorMessage for "${mangaTitle}": ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}

/**
 * Check if HTML content is a redirect page
 *
 * @param htmlContent - HTML content to check
 * @returns True if page is a redirect
 */
function isRedirectPage(htmlContent: string): boolean {
  return htmlContent.includes('redirectMsg') || htmlContent.includes('Redirect to:');
}

/**
 * Check if HTML content is a disambiguation page
 *
 * @param htmlContent - HTML content to check
 * @returns True if page is a disambiguation page
 */
function isDisambiguationPage(htmlContent: string): boolean {
  return htmlContent.includes('List of') && htmlContent.includes('chapters (');
}

/**
 * Extract redirect target from HTML content
 *
 * @param htmlContent - HTML content containing redirect
 * @returns Redirect target title or null if not found
 */
function extractRedirectTarget(htmlContent: string): string | null {
  const redirectMatch = htmlContent.match(/href="\/wiki\/([^"]+)"/);
  if (!redirectMatch?.[1]) {
    return null;
  }
  return decodeURIComponent(redirectMatch[1].replace(/_/g, ' '));
}

/**
 * Fetch content for a redirect target page
 *
 * @param redirectTarget - Target page title
 * @returns HTML content or null if not found
 */
async function fetchRedirectContent(redirectTarget: string): Promise<string | null> {
  const redirectResponse = await lookupPageByTitle(redirectTarget);
  const redirectPages = redirectResponse.query?.pages;

  if (!redirectPages) {
    return null;
  }

  const redirectPageId = Object.keys(redirectPages)[0];
  if (!redirectPageId || redirectPageId === '-1') {
    logger.warn('[WIKIPEDIA] No valid redirect page ID found');
    return null;
  }

  const redirectContentResponse = await fetchPageContentById(parseInt(redirectPageId, 10));
  if (!redirectContentResponse.parse) {
    return null;
  }

  return redirectContentResponse.parse.text?.['*'] ?? null;
}

/**
 * Handle redirect pages by following the redirect and processing content
 *
 * @param htmlContent - HTML content of redirect page
 * @param mangaTitle - Manga title
 * @param cacheKey - Cache key for storing results
 * @param cache - Cache instance
 * @returns Array of chapters
 */
async function handleRedirectPage(
  htmlContent: string,
  mangaTitle: string,
  cacheKey: string,
  cache: Cache<unknown>
): Promise<WikipediaChapter[]> {
  logger.info(`[WIKIPEDIA] Found redirect page, following redirect...`);

  const redirectTarget = extractRedirectTarget(htmlContent);
  if (!redirectTarget) {
    return [];
  }

  logger.info(`[WIKIPEDIA] Following redirect to: ${redirectTarget}`);

  const redirectHtml = await fetchRedirectContent(redirectTarget);
  if (!redirectHtml) {
    return [];
  }

  // Check if redirect target is a disambiguation page
  if (isDisambiguationPage(redirectHtml)) {
    return parseDisambiguationPage(redirectHtml, mangaTitle, cacheKey, cache);
  }

  // Filter to main series content before parsing
  const filteredHtml = filterToMainSeriesContent(redirectHtml, mangaTitle);

  // Parse as normal chapter page
  const chapters = parseChapterTables(filteredHtml);
  if (chapters.length > 0) {
    cache.set(cacheKey, chapters);
    return chapters;
  }

  // Redirect target yielded no chapters (e.g., "Detective Conan" → "Case Closed volumes").
  // Try known title aliases as a fallback.
  const aliasTitle = CHAPTER_LIST_ALIASES[mangaTitle];
  if (aliasTitle) {
    logger.info(`[WIKIPEDIA] Redirect yielded 0 chapters, trying alias: "${aliasTitle}"`);
    const aliasChapters = await searchChapterList(aliasTitle.replace('List of ', '').replace(' chapters', ''));
    if (aliasChapters.length > 0) {
      cache.set(cacheKey, aliasChapters);
      return aliasChapters;
    }
  }

  cache.set(cacheKey, chapters);
  return chapters;
}

/**
 * Parse disambiguation page to find chapter sub-pages
 *
 * Handles manga like Bleach that split chapter lists across multiple
 * sub-pages (e.g., chapters 1–187, 188–423, 424–686).
 * Fetches ALL sub-pages in parallel and merges/deduplicates chapters.
 *
 * @param html - HTML content of disambiguation page
 * @param _mangaTitle - Manga title (unused, kept for signature compat)
 * @param cacheKey - Cache key for storing results
 * @param cache - Cache instance
 * @returns Array of chapters merged from all sub-pages
 */
async function parseDisambiguationPage(
  html: string,
  _mangaTitle: string,
  cacheKey: string,
  cache: Cache<unknown>
): Promise<WikipediaChapter[]> {
  logger.info('[WIKIPEDIA] Found disambiguation page, looking for chapter sub-pages');

  // Match links containing "chapters" followed by a parenthesized qualifier.
  // The old pattern required two digit groups (e.g., "1–186"), which missed
  // sub-pages using Roman numerals like "Part I". Now matches any parenthesized suffix.
  const hrefPattern = /href="\/wiki\/([^"]+chapters[^"]*\([^)]+\)[^"]*)"/gi;
  const rawMatches = [...html.matchAll(hrefPattern)];

  // Deduplicate sub-page URLs (same page may be linked multiple times in HTML)
  const seenUrls = new Set<string>();
  const hrefMatches = rawMatches.filter((m) => {
    const url = m[1] ?? '';
    if (seenUrls.has(url)) return false;
    seenUrls.add(url);
    return true;
  });

  logger.info(`[WIKIPEDIA] Found ${hrefMatches.length} chapter sub-page links from disambiguation HTML`);

  // Supplement: search API may find sibling pages not linked from the disambiguation page
  // (e.g., "List of Dragon Ball Z chapters" not linked from "List of Dragon Ball manga volumes")
  // Sequel suffixes that indicate a different series (not a continuation of the same manga)
  const SEQUEL_SUFFIXES = ['super', 'gt', 'boruto', 'shippuden', ':re', 'kai', 'brotherhood'];
  const extraTitles: string[] = [];
  const searchSiblings = await searchChapterListPages(_mangaTitle, 0);
  const mangaLower = _mangaTitle.toLowerCase();
  for (const page of searchSiblings) {
    // Normalize URL for dedup: decode both forms to canonical title
    const normalizedTitle = decodeURIComponent(page.title.replace(/_/g, ' ').replace(/%20/g, ' ')).toLowerCase();
    const alreadySeen = [...seenUrls].some((url) =>
      decodeURIComponent(url.replace(/_/g, ' ').replace(/%20/g, ' ')).toLowerCase() === normalizedTitle,
    );
    const encoded = encodeURIComponent(page.title.replace(/ /g, '_'));
    if (alreadySeen || !page.title.toLowerCase().includes('chapters')) continue;
    // Reject sequel series: title contains words beyond the manga title that indicate a sequel
    const titleAfterManga = page.title.toLowerCase().replace(/list of /i, '').replace(mangaLower, '').trim();
    const isSequel = SEQUEL_SUFFIXES.some((s) => titleAfterManga.includes(s));
    if (isSequel) {
      logger.debug(`[WIKIPEDIA] Skipped sequel sibling: "${page.title}"`);
      continue;
    }
    seenUrls.add(encoded);
    extraTitles.push(page.title);
    logger.info(`[WIKIPEDIA] Added search-discovered sibling: "${page.title}"`);
  }

  if (hrefMatches.length === 0 && extraTitles.length === 0) return [];

  logger.info(`[WIKIPEDIA] Fetching ${hrefMatches.length + extraTitles.length} chapter sub-pages total`);

  // Fetch ALL sub-pages in parallel and merge chapters
  const allChapters = await fetchAllSubPages(hrefMatches);

  // Fetch search-discovered siblings — may be continuations numbered from 1
  // (e.g., Dragon Ball Z chapters 1-325 = actual chapters 195-519)
  for (const title of extraTitles) {
    // eslint-disable-next-line no-await-in-loop -- Sequential continuation detection
    const siblingChapters = await fetchSiblingPageChapters(title);
    if (siblingChapters.length === 0) continue;

    // Detect continuation: if >50% of new chapters overlap with existing, offset them
    const existingNums = new Set(allChapters.map(ch => typeof ch.number === 'number' ? ch.number : 0));
    const overlapCount = siblingChapters.filter(ch => existingNums.has(typeof ch.number === 'number' ? ch.number : 0)).length;

    if (overlapCount > siblingChapters.length * 0.5 && allChapters.length > 0) {
      const maxExisting = Math.max(...allChapters.map(ch => typeof ch.number === 'number' ? ch.number : 0));
      logger.info(`[WIKIPEDIA] Continuation detected for "${title}": offsetting ${siblingChapters.length} chapters by ${maxExisting}`);
      for (const ch of siblingChapters) {
        allChapters.push({ ...ch, number: (typeof ch.number === 'number' ? ch.number : 0) + maxExisting });
      }
    } else {
      allChapters.push(...siblingChapters);
    }
  }

  if (allChapters.length === 0) return [];

  // Deduplicate by chapter number, keep first occurrence
  const byNumber = new Map<number, WikipediaChapter>();
  for (const ch of allChapters) {
    const num = typeof ch.number === 'number' ? ch.number : parseFloat(String(ch.number));
    if (!isNaN(num) && !byNumber.has(num)) byNumber.set(num, ch);
  }

  let merged = [...byNumber.values()].sort((a, b) => {
    const aNum = typeof a.number === 'number' ? a.number : parseFloat(String(a.number));
    const bNum = typeof b.number === 'number' ? b.number : parseFloat(String(b.number));
    return aNum - bNum;
  });

  // Detect per-volume numbering: if dedup collapsed >60% of chapters, the sub-pages
  // use per-volume numbers (1-12 per volume) instead of global numbers.
  // Fix by renumbering sequentially (sub-pages are already in chapter order).
  if (allChapters.length > merged.length * 3) {
    logger.info(`[WIKIPEDIA] Per-volume numbering detected (${allChapters.length} raw → ${merged.length} deduped), renumbering sequentially`);
    merged = allChapters.map((ch, idx) => ({ ...ch, number: idx + 1 }));
  } else {
    // Single-page-style per-volume pattern (same number repeated with different volumeNumber)
    applyPerVolumeRenumbering(merged);
  }

  logger.info(`[WIKIPEDIA] Merged ${merged.length} chapters from ${hrefMatches.length} sub-pages`);
  cache.set(cacheKey, merged);
  return merged;
}

/** Fetch and parse chapters from a single sibling page by title */
async function fetchSiblingPageChapters(title: string): Promise<WikipediaChapter[]> {
  try {
    const response = await lookupPageByTitle(title);
    const pages = response.query?.pages;
    const pageId = pages ? Object.keys(pages)[0] : undefined;
    if (!pageId || pageId === '-1') return [];

    const content = await fetchPageContentById(parseInt(pageId, 10));
    if (!content.parse) return [];
    return parseSubPageHtml(content.parse.text?.['*'] ?? '');
  } catch {
    logger.warn(`[WIKIPEDIA] Failed to fetch sibling: ${title}`);
    return [];
  }
}

/**
 * Parse sub-page HTML using the best available parser.
 * Tries parseChapterTables first (handles table-based formats like Bleach),
 * falls back to parseVolumeListPattern (handles <ol> list formats like One Piece).
 */
function parseSubPageHtml(html: string): WikipediaChapter[] {
  const tableChapters = parseChapterTables(html);
  if (tableChapters.length > 0) return tableChapters;
  return parseVolumeListPattern(html);
}

/**
 * Fetch all chapter sub-pages in parallel and return combined chapters.
 * Uses Promise.allSettled so one failed sub-page doesn't block others.
 */
async function fetchAllSubPages(
  hrefMatches: RegExpMatchArray[],
): Promise<WikipediaChapter[]> {
  const fetchPromises = hrefMatches.map(async (match) => {
    const encoded = match[1];
    if (!encoded) return [];

    const title = decodeURIComponent(encoded.replace(/_/g, ' '));
    logger.info(`[WIKIPEDIA] Fetching sub-page: ${title}`);

    const response = await lookupPageByTitle(title);
    const pages = response.query?.pages;
    if (!pages) return [];

    const pageId = Object.keys(pages)[0];
    if (!pageId || pageId === '-1') return [];

    const content = await fetchPageContentById(parseInt(pageId, 10));
    if (!content.parse) return [];

    return parseSubPageHtml(content.parse.text?.['*'] ?? '');
  });

  const results = await Promise.allSettled(fetchPromises);
  const chapters: WikipediaChapter[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') chapters.push(...result.value);
  }
  return chapters;
}

/**
 * Fetch all sibling sub-pages when a sub-page redirect is detected.
 *
 * Uses searchChapterListPages to find all "List of X chapters (N–M)" pages,
 * fetches them in parallel, and merges/deduplicates the chapters.
 *
 * @param mangaTitle - Manga title to search for sibling pages
 * @param cacheKey - Cache key for storing results
 * @param cache - Cache instance
 * @returns Array of merged chapters from all sibling sub-pages
 */
async function fetchAllSiblingSubPages(
  mangaTitle: string,
  cacheKey: string,
  cache: Cache<unknown>,
): Promise<WikipediaChapter[]> {
  const siblingPages = await searchChapterListPages(mangaTitle, 0);

  if (siblingPages.length === 0) return [];

  logger.info(`[WIKIPEDIA] Found ${siblingPages.length} sibling chapter list pages`);

  // Fetch all pages in parallel
  const fetchPromises = siblingPages.map(async (page) => {
    const content = await fetchPageContentById(page.pageid);
    if (!content.parse) return [];
    return parseSubPageHtml(content.parse.text?.['*'] ?? '');
  });

  const results = await Promise.allSettled(fetchPromises);
  const allChapters: WikipediaChapter[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') allChapters.push(...result.value);
  }

  if (allChapters.length === 0) return [];

  // Deduplicate by chapter number
  const byNumber = new Map<number, WikipediaChapter>();
  for (const ch of allChapters) {
    const num = typeof ch.number === 'number' ? ch.number : parseFloat(String(ch.number));
    if (!isNaN(num) && !byNumber.has(num)) byNumber.set(num, ch);
  }

  let merged = [...byNumber.values()].sort((a, b) => {
    const aNum = typeof a.number === 'number' ? a.number : parseFloat(String(a.number));
    const bNum = typeof b.number === 'number' ? b.number : parseFloat(String(b.number));
    return aNum - bNum;
  });

  // Detect per-volume numbering: if dedup collapsed >60% of chapters, the sub-pages
  // use per-volume numbers (1-12 per volume) instead of global numbers.
  // Fix by renumbering sequentially (sub-pages are already in chapter order).
  if (allChapters.length > merged.length * 3) {
    logger.info(`[WIKIPEDIA] Per-volume numbering detected (${allChapters.length} raw → ${merged.length} deduped), renumbering sequentially`);
    merged = allChapters.map((ch, idx) => ({ ...ch, number: idx + 1 }));
  } else {
    applyPerVolumeRenumbering(merged);
  }

  logger.info(`[WIKIPEDIA] Merged ${merged.length} chapters from ${siblingPages.length} sibling pages`);
  cache.set(cacheKey, merged);
  return merged;
}

/**
 * Search for chapter list pages when direct lookup fails
 *
 * Internal fallback orchestration function that searches Wikipedia
 * for chapter-related pages when the standard "List of X chapters"
 * page doesn't exist.
 *
 * @param mangaTitle - Manga title to search for
 * @returns Array of chapters from the first matching page
 */
async function searchChapterList(mangaTitle: string): Promise<WikipediaChapter[]> {
  // Use dynamic import to avoid circular dependency with search-parser
  const { searchChapterList: search } = await import('../chapter-parser/search-parser');
  return search(mangaTitle, parseChapterTables);
}
