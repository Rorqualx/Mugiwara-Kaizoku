/**
 * Category-Based Chapter Discovery
 *
 * Discovers and extracts chapters from wikis that have no central chapter list page,
 * instead storing chapters as individual pages in categories like Category:Chapters
 * or Category:Manga_Chapters (e.g., Detective Conan).
 *
 * Uses the MediaWiki categorymembers API to enumerate all chapter pages,
 * then extracts chapter numbers from page titles or wikitext infoboxes.
 *
 * @module category-chapter-discovery
 */

import { logger } from '@/utils/logger';

/** Chapter data extracted from category enumeration */
export interface CategoryChapter {
  number: number;
  title: string;
  pageTitle: string;
}

/** SSRF protection: only allow *.fandom.com domains */
const FANDOM_DOMAIN_RE = /^[\w-]+\.fandom\.com$/;

/** Category names to try for chapter pages */
const CHAPTER_CATEGORY_NAMES = [
  'Category:Chapters',
  'Category:Manga_Chapters',
  'Category:Manga chapters',
  'Category:Chapter',
  // Multi-series wikis (e.g., mochijun hosts Pandora Hearts, Vanitas no Carte)
  'Category:Pandora_Hearts_Chapters',
];

/** MediaWiki categorymembers API response structure */
interface CategoryMembersResponse {
  query?: {
    categorymembers?: Array<{ title: string; pageid: number }>;
  };
  continue?: { cmcontinue: string };
}

/**
 * Discover chapter pages via Category API and extract chapter numbers from titles.
 * Falls back to batch wikitext parsing when titles use story names (e.g., Detective Conan).
 *
 * @param domain - Fandom wiki domain (e.g., "detectiveconan.fandom.com")
 * @param timeoutMs - Request timeout per API call
 * @returns Array of chapters sorted by number, or null if < 10 found
 */
// eslint-disable-next-line max-statements, complexity -- 53 statements + complexity 32: multi-strategy discovery cascade (try N categories, fall back to allpages, then to title-only extraction); each strategy needs distinct guards on the result shape
export async function discoverChaptersViaCategory(
  domain: string,
  timeoutMs: number = 10000,
): Promise<CategoryChapter[] | null> {
  if (!FANDOM_DOMAIN_RE.test(domain)) return null;

  let bestPages: Array<{ title: string; pageid: number }> = [];

  /* eslint-disable no-await-in-loop -- sequential by design: try each category in priority order, break early once 50 members found, avoid hammering Fandom API */
  for (const category of CHAPTER_CATEGORY_NAMES) {
    const pages = await fetchAllCategoryMembers(domain, category, timeoutMs);
    if (pages.length > bestPages.length) {
      bestPages = pages;
    }
    if (bestPages.length >= 50) break;
  }
  /* eslint-enable no-await-in-loop */

  // Fallback: if category members are sparse, try allpages with "Chapter " prefix
  // Handles wikis like Gantz/Kuroko where chapters are individual pages without categories.
  // Threshold lowered to 5 to catch series with few published chapters (e.g., 86 Eighty Six
  // currently has only 6-7 serialized chapters).
  if (bestPages.length < 10) {
    const allpagesChapters = await discoverChaptersViaAllpages(domain, timeoutMs);
    if (allpagesChapters && allpagesChapters.length >= 5) {
      await enrichAllpagesChapters(domain, allpagesChapters, timeoutMs);
      return allpagesChapters;
    }
    // If category has >=5 members but allpages failed, still try to use the category data
    if (bestPages.length >= 5) {
      const titleChaps = extractChaptersFromTitles(bestPages);
      if (titleChaps.length >= 5) {
        const pageMap = new Map<number, string>();
        /* eslint-disable max-depth -- depth 5 is the page-number lookup table build inside the fallback-to-category branch; extracting helper would obscure the local data flow */
        for (const page of bestPages) {
          const num = extractChapterNumberFromAnyTitle(page.title);
          if (num !== null) pageMap.set(num, page.title);
        }
        /* eslint-enable max-depth */
        await enrichTitlesFromWikitext(domain, titleChaps, pageMap, timeoutMs);
        return titleChaps;
      }
    }
    return null;
  }

  // Try title-based extraction first (fast, no extra API calls)
  const titleChapters = extractChaptersFromTitles(bestPages);

  // Always check allpages too — it may find more chapters
  const allpagesChapters = await discoverChaptersViaAllpages(domain, timeoutMs);

  // Try wikitext-based extraction on named category members (e.g., "A Lost Raven")
  // when title-based yields few. This handles wikis where chapter pages use story
  // names and the chapter number lives in the infobox `| chapter_no = N` field.
  let wikitextFromCategory: CategoryChapter[] | null = null;
  if (titleChapters.length < bestPages.length * 0.5) {
    logger.info(
      `[categoryChapterDiscovery] Title extraction sparse (${titleChapters.length}/${bestPages.length}), trying wikitext batch for ${domain}`,
    );
    wikitextFromCategory = await batchExtractFromWikitext(domain, bestPages, timeoutMs);
  }

  // Pick the best result: prefer whichever found the most chapters.
  // Then also union with allpages if it found more (different chapter sets can co-exist).
  const candidates: Array<{ name: string; chapters: CategoryChapter[] }> = [];
  if (titleChapters.length >= 5) candidates.push({ name: 'titles', chapters: titleChapters });
  if (wikitextFromCategory && wikitextFromCategory.length >= 5) candidates.push({ name: 'wikitext', chapters: wikitextFromCategory });
  if (allpagesChapters && allpagesChapters.length >= 5) candidates.push({ name: 'allpages', chapters: allpagesChapters });

  if (candidates.length === 0) return null;

  // Start with the largest, then merge unique chapter numbers from other sources.
  // Prefer entries whose pageTitle carries a subtitle (e.g. "Chapter 1: The Two
  // Alchemists" beats the bare redirect "Chapter 1") so downstream wikitext
  // enrichment fetches the actual content page, not the redirect.
  candidates.sort((a, b) => b.chapters.length - a.chapters.length);
  const merged = new Map<number, CategoryChapter>();
  // Prefer "Chapter N: Subtitle" over the bare redirect "Chapter N" (FMA case),
  // but don't let prefixed forms like "Re: Chapter N" win against "Chapter N"
  // (Tokyo Ghoul, where main + :re sequel share chapter numbers).
  const FULL_TITLE_RE = /^Chapter[_ ]\d+(?:\.\d+)?:\s+\S/;
  for (const c of candidates) {
    for (const ch of c.chapters) {
      const existing = merged.get(ch.number);
      if (!existing || (FULL_TITLE_RE.test(ch.pageTitle) && !FULL_TITLE_RE.test(existing.pageTitle))) {
        merged.set(ch.number, ch);
      }
    }
  }
  const mergedChapters = [...merged.values()].sort((a, b) => a.number - b.number);
  logger.info(
    `[categoryChapterDiscovery] Merged ${mergedChapters.length} chapters from ${candidates.map(c => `${c.name}:${c.chapters.length}`).join(', ')} for ${domain}`,
  );

  // Enrich titles on the merged set using wikitext.
  // First-wins: the same chapter number can match multiple page titles on wikis
  // that host both a main series and a sequel (e.g. tokyoghoul.fandom.com has
  // "Chapter 1" for the main series and "Re: Chapter 1" for the :re sequel —
  // both extract chapter=1). Without `!pageMap.has`, the alphabetically-later
  // sequel page overwrites the main-series mapping, and titleByPage lookups
  // (keyed by the chapter's stored pageTitle = "Chapter 1") then miss entirely.
  const pageMap = new Map<number, string>();
  for (const page of bestPages) {
    const num = extractChapterNumberFromAnyTitle(page.title);
    if (num !== null && !pageMap.has(num)) pageMap.set(num, page.title);
  }
  // Also map numbers from allpages/wikitext chapters to their page titles
  for (const c of [allpagesChapters, wikitextFromCategory, titleChapters]) {
    if (!c) continue;
    for (const ch of c) {
      if (!pageMap.has(ch.number)) pageMap.set(ch.number, ch.pageTitle);
    }
  }
  await enrichTitlesFromWikitext(domain, mergedChapters, pageMap, timeoutMs);
  return mergedChapters;
}

// v20: removed the previous fallthrough (separate batchExtractFromWikitext +
// allpagesFallback calls) in favor of the merged-candidates logic above.

/** Extract chapters from page titles using "Chapter N" or "File N" patterns */
function extractChaptersFromTitles(
  pages: Array<{ title: string; pageid: number }>,
): CategoryChapter[] {
  const chapters: CategoryChapter[] = [];
  for (const page of pages) {
    const chapterNumber = extractChapterNumber(page.title);
    if (chapterNumber === null) continue;
    chapters.push({
      number: chapterNumber,
      title: cleanChapterTitle(page.title),
      pageTitle: page.title,
    });
  }
  return deduplicateAndSort(chapters);
}

/** Deduplicate chapters by number and sort ascending */
function deduplicateAndSort(chapters: CategoryChapter[]): CategoryChapter[] {
  const byNumber = new Map<number, CategoryChapter>();
  for (const ch of chapters) {
    if (!byNumber.has(ch.number)) byNumber.set(ch.number, ch);
  }
  const sorted = [...byNumber.values()].sort((a, b) => a.number - b.number);
  logger.info(
    `[categoryChapterDiscovery] Found ${sorted.length} chapters from category enumeration`,
  );
  return sorted;
}

/** Re-exported wrapper so other helpers can use the same extraction logic */
function extractChapterNumberFromAnyTitle(title: string): number | null {
  return extractChapterNumber(title);
}

/** Enrich chapters discovered via allpages prefix scan with wikitext titles.
 *  Used when page titles like "Chapter 1" have no subtitle but the page's
 *  infobox contains `| title = X`. */
async function enrichAllpagesChapters(
  domain: string,
  chapters: CategoryChapter[],
  timeoutMs: number,
): Promise<void> {
  const pageMap = new Map<number, string>();
  for (const ch of chapters) {
    pageMap.set(ch.number, ch.pageTitle);
  }
  await enrichTitlesFromWikitext(domain, chapters, pageMap, timeoutMs);
}

/** Extract chapter number from a page title like "Chapter 42", "Re: Chapter 1", "Act 5".
 *  Exported for direct unit testing — production callers are module-internal. */
export function extractChapterNumber(title: string): number | null {
  // Standard: "Chapter 42", "Chapter_001", "Re: Chapter 1", "Manga Chapter 2.5" (86 Eighty Six).
  // The first alternation branch catches prequel "Chapter 0-1" → 0.1, which the
  // plain-number branch would otherwise collapse to chapter 0.
  const match = title.match(/^(?:Re:\s*)?(?:Manga[_ ])?Chapter[_ ](?:0+-(\d+)|(\d+(?:\.\d+)?))/i);
  if (match?.[1]) return parseFloat(`0.${match[1]}`);
  if (match?.[2]) return parseFloat(match[2]);

  // Rurouni Kenshin style: "Act 1", "Act 255"
  const actMatch = title.match(/^Act[_ ](\d+(?:\.\d+)?)/i);
  if (actMatch?.[1]) return parseFloat(actMatch[1]);

  const fileMatch = title.match(/^File[_ ](\d+(?:\.\d+)?)/i);
  if (fileMatch?.[1]) return parseFloat(fileMatch[1]);

  // Series-name prefix pattern: "Pandora Hearts 19", "Pandora Hearts 18.5: Evidence"
  // Only matches when the prefix is in our known series list to avoid false positives
  const seriesMatch = title.match(/^Pandora[_ ]Hearts[_ ](\d+(?:\.\d+)?)/i);
  if (seriesMatch?.[1]) return parseFloat(seriesMatch[1]);

  return null;
}

/** Clean a page title into a chapter title */
function cleanChapterTitle(pageTitle: string): string {
  return pageTitle
    .replace(/^(?:Chapter|File)[_ ]\d+(?:\.\d+)?[:\s]*/i, '')
    .replace(/_/g, ' ')
    .trim();
}

// ============================================================================
// Batch Wikitext Extraction (for wikis using story titles instead of "Chapter N")
// ============================================================================

/** MediaWiki multi-page revisions API response */
interface RevisionsResponse {
  query?: {
    pages?: Record<string, {
      title: string;
      revisions?: Array<{ slots?: { main?: { '*': string } } }>;
    }>;
    /** Present when redirects=1 — maps from requested title → resolved title */
    redirects?: Array<{ from: string; to: string }>;
  };
}

/** Wikitext patterns that contain chapter numbers in infoboxes/templates */
const WIKITEXT_CHAPTER_PATTERNS = [
  /\|\s*chapter[_ ]?(?:no|num|number)\s*=\s*(\d+)/i,
  /\|\s*(?:number|episode|file)[_ ]?(?:no|num)?\s*=\s*(\d+)/i,
  /\|\s*manga[_ ]?(?:no|chapter)\s*=\s*(\d+)/i,
  // Pandora Hearts style: bare `|Chapter = 13` (no suffix).
  // Placed AFTER more specific patterns so "Chapter Title" doesn't false-match
  // (requires `=` immediately after `chapter`, which doesn't match "Chapter Title =").
  /\|\s*chapter\s*=\s*(\d+)/i,
];

/** Wikitext patterns that contain chapter titles in infoboxes/templates.
 *  Ordered by specificity — most specific first. */
const WIKITEXT_TITLE_PATTERNS = [
  /\|\s*ch[_ ]?title\s*=\s*([^\n|}]+)/i,
  /\|\s*chapter[_ ]?title\s*=\s*([^\n|}]+)/i,
  /\|\s*english[_ ]?title\s*=\s*([^\n|}]+)/i,
  // Tokyo Ghoul / Tokyo Ghoul:re style: `|ename = Yellow Bell` (English NAME, not "english_title").
  // Placed BEFORE the generic `|title` so it wins when `|title` holds a placeholder
  // like "Chapter 122" (which gets rejected anyway, but `ename` is more reliable).
  /\|\s*ename\s*=\s*([^\n|}]+)/i,
  /\|\s*etitle\s*=\s*([^\n|}]+)/i,
  /\|\s*title\s*=\s*([^\n|}]+)/i,
  /\|\s*name\s*=\s*([^\n|}]+)/i,
  // Ranma ½ uses bare `|english = X` (no _title suffix). Last so specific
  // fields win.
  /\|\s*english\s*=\s*([^\n|}]+)/i,
  // Japanese-title fallback (Kaiju No. 8: `|jname = 第1話` when `|title=` is
  // empty). Better than leaving the row title-less; fill phase overwrites
  // when other sources supply a real English title.
  /\|\s*(?:jname|japanese|jp[_ ]?title)\s*=\s*([^\n|}]+)/i,
];

/** Extract a chapter number from wikitext template parameters */
function extractChapterFromWikitext(wikitext: string): number | null {
  for (const pattern of WIKITEXT_CHAPTER_PATTERNS) {
    const match = wikitext.match(pattern);
    if (match?.[1]) return parseInt(match[1], 10);
  }
  return null;
}

/** Strip common wikitext markup from a title string */
function cleanWikitextTitle(raw: string): string {
  return raw
    .replace(/\[\[([^|\]]+\|)?([^\]]+)\]\]/g, '$2') // [[Link]] or [[Link|Text]] → Text
    .replace(/\{\{[^}]*\}\}/g, '') // strip {{templates}}
    .replace(/<[^>]+>/g, '') // strip HTML tags
    .replace(/'''|''/g, '') // strip bold/italic
    .trim();
}

/** Extract a chapter title from wikitext template parameters */
function extractTitleFromWikitext(wikitext: string): string | null {
  for (const pattern of WIKITEXT_TITLE_PATTERNS) {
    const match = wikitext.match(pattern);
    if (match?.[1]) {
      const cleaned = cleanWikitextTitle(match[1]);
      // Reject placeholders and bare numbers
      if (cleaned.length >= 2 && !/^\d+$/.test(cleaned) && !/^(Chapter|Ch\.?)\s*\d+$/i.test(cleaned)) {
        return cleaned;
      }
    }
  }
  return null;
}

/**
 * Batch-fetch wikitext for pages and extract chapter numbers from infoboxes.
 * Uses MediaWiki multi-title queries (up to 50 titles per request).
 */
async function batchExtractFromWikitext(
  domain: string,
  pages: Array<{ title: string; pageid: number }>,
  timeoutMs: number,
): Promise<CategoryChapter[] | null> {
  const chapters: CategoryChapter[] = [];
  const batchSize = 50; // MediaWiki API limit for multi-title queries

  for (let i = 0; i < pages.length; i += batchSize) {
    const batch = pages.slice(i, i + batchSize);
    // eslint-disable-next-line no-await-in-loop -- batches of 50 against the Fandom API; parallelizing would risk rate-limit blocks against a single wiki host
    const batchChapters = await fetchBatchWikitext(domain, batch, timeoutMs);
    chapters.push(...batchChapters);
  }

  if (chapters.length < 10) return null;
  return deduplicateAndSort(chapters);
}

/** Fetch wikitext for a batch of pages and extract chapter numbers */
async function fetchBatchWikitext(
  domain: string,
  batch: Array<{ title: string; pageid: number }>,
  timeoutMs: number,
): Promise<CategoryChapter[]> {
  const titles = batch.map(p => p.title).join('|');
  const url = new URL(`https://${domain}/api.php`);
  url.searchParams.set('action', 'query');
  url.searchParams.set('titles', titles);
  url.searchParams.set('prop', 'revisions');
  url.searchParams.set('rvprop', 'content');
  url.searchParams.set('rvslots', 'main');
  url.searchParams.set('format', 'json');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return [];

    const data = (await response.json()) as RevisionsResponse;
    return parseBatchRevisions(data);
  } catch {
    clearTimeout(timeoutId);
    return [];
  }
}

/** Parse revision responses and extract chapter data */
function parseBatchRevisions(data: RevisionsResponse): CategoryChapter[] {
  const chapters: CategoryChapter[] = [];
  const queryPages = data.query?.pages;
  if (!queryPages) return chapters;

  for (const page of Object.values(queryPages)) {
    const wikitext = page.revisions?.[0]?.slots?.main?.['*'];
    if (!wikitext) continue;

    const chapterNum = extractChapterFromWikitext(wikitext);
    if (chapterNum === null || chapterNum <= 0) continue;

    // Prefer wikitext-extracted title; fall back to page title with underscores stripped
    const wikiTitle = extractTitleFromWikitext(wikitext);
    chapters.push({
      number: chapterNum,
      title: wikiTitle ?? page.title.replace(/_/g, ' '),
      pageTitle: page.title,
    });
  }
  return chapters;
}

/** Fetch wikitext for a batch of pages and extract infobox titles.
 *  Returns a map of page title → extracted title. Unlike the legacy
 *  `batchExtractFromWikitext` which also requires a chapter number in the
 *  wikitext, this helper does NOT require a chapter number — the caller
 *  already knows the number from the page title (via pageMap).
 *  This enables enrichment on wikis like Quintessential Quintuplets where
 *  chapter pages have `| title = X` but no `| chapter_no = N` field. */
async function fetchBatchWikitextWithTitles(
  domain: string,
  batch: Array<{ title: string; pageid: number }>,
  timeoutMs: number,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const titles = batch.map(p => p.title).join('|');
  const url = new URL(`https://${domain}/api.php`);
  url.searchParams.set('action', 'query');
  url.searchParams.set('titles', titles);
  url.searchParams.set('prop', 'revisions');
  url.searchParams.set('rvprop', 'content');
  url.searchParams.set('rvslots', 'main');
  // Follow redirects so wikis like FMA (where "Chapter 1" is a redirect to
  // "Chapter 1: The Two Alchemists") yield the target page's wikitext.
  // Without this, the redirect page's content is `#REDIRECT [[Target]]` and
  // the title regex finds nothing.
  url.searchParams.set('redirects', '1');
  url.searchParams.set('format', 'json');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return result;

    const data = (await response.json()) as RevisionsResponse;
    const queryPages = data.query?.pages;
    if (!queryPages) return result;

    // Build resolved → original title map from redirects so callers can look up
    // by either name. MediaWiki returns redirected pages under their target title.
    const resolvedToOriginal = new Map<string, string>();
    for (const r of data.query?.redirects ?? []) {
      resolvedToOriginal.set(r.to, r.from);
    }

    for (const page of Object.values(queryPages)) {
      const wikitext = page.revisions?.[0]?.slots?.main?.['*'];
      if (!wikitext) continue;
      const title = extractTitleFromWikitext(wikitext);
      if (!title) continue;
      result.set(page.title, title);
      const original = resolvedToOriginal.get(page.title);
      if (original !== undefined) result.set(original, title);
    }
  } catch {
    clearTimeout(timeoutId);
  }

  return result;
}

/**
 * Enrich chapters discovered from page titles with real titles from wikitext infoboxes.
 * Only runs when most chapters have empty or generic titles (cleanChapterTitle stripped
 * the "Chapter N" prefix leaving nothing). Mutates the chapters array in place.
 *
 * Used for wikis like Quintessential Quintuplets (5hanayome) where page titles are
 * "Chapter 1" but the page itself has `| title = The Five-Part Bride` in the infobox.
 */
async function enrichTitlesFromWikitext(
  domain: string,
  chapters: CategoryChapter[],
  pageMap: Map<number, string>,
  timeoutMs: number,
): Promise<void> {
  // Count chapters missing real titles
  const missing = chapters.filter(ch => !ch.title || ch.title.length < 2 || /^(Chapter|Ch\.?)\s*\d+$/i.test(ch.title));
  if (missing.length < chapters.length * 0.5) {
    // Most chapters already have real titles — skip to save API calls
    return;
  }

  logger.info(
    `[categoryChapterDiscovery] Enriching titles from wikitext (${missing.length}/${chapters.length} missing) for ${domain}`,
  );

  // Cap at 300 pages (6 batches of 50) — bumped from 150 so series 150+ chapters
  // (Vinland Saga 211, Bleach 686, Tokyo Ghoul 143+) get full coverage.
  const toFetch = missing.slice(0, 300);
  const pages = toFetch
    .map(ch => pageMap.get(ch.number))
    .filter((t): t is string => typeof t === 'string')
    .map(title => ({ title, pageid: 0 }));

  if (pages.length === 0) return;

  const batchSize = 50;
  const titleByPage = new Map<string, string>();
  for (let i = 0; i < pages.length; i += batchSize) {
    const batch = pages.slice(i, i + batchSize);
    // eslint-disable-next-line no-await-in-loop -- Sequential to avoid API rate limits
    const batchResult = await fetchBatchWikitextWithTitles(domain, batch, timeoutMs);
    for (const [k, v] of batchResult) titleByPage.set(k, v);
  }

  // Apply enriched titles back to chapters. Page title lookup tries both
  // underscored and space-separated variants (MediaWiki is flexible).
  let enrichedCount = 0;
  for (const ch of chapters) {
    const pageTitle = ch.pageTitle;
    const enriched = titleByPage.get(pageTitle) ?? titleByPage.get(pageTitle.replace(/_/g, ' '));
    if (enriched && enriched.length >= 2) {
      ch.title = enriched;
      enrichedCount++;
    }
  }

  if (enrichedCount > 0) {
    logger.info(
      `[categoryChapterDiscovery] Enriched ${enrichedCount} chapter titles from wikitext for ${domain}`,
    );
  }
}

/**
 * Enrich an existing chapterList (as built by buildMangaData) with real titles
 * from wikitext infoboxes. Useful for the plain-table-parser path (Quintessential
 * Quintuplets, My Dress-Up Darling) where chapters come through with generic
 * "Chapter 1" titles but their wiki pages have `| title = X` in the infobox.
 *
 * Requires each chapter to have `.url` pointing to `/wiki/<page>`. Mutates
 * the chapterList entries in place (sets `.title` when enrichment succeeds).
 */
const GENERIC_RE = /^(Chapter|Ch\.?)\s*\d+$/i;
function isGenericTitle(t: string | undefined): boolean {
  return !t || GENERIC_RE.test(t) || /^\d+$/.test(t);
}
function pageTitleFor(ch: { number?: number; url?: string }): string {
  if (ch.url?.startsWith('/wiki/') === true) return decodeURIComponent(ch.url.replace(/^\/wiki\//, ''));
  if (typeof ch.number === 'number') return `Chapter_${ch.number}`;
  return '';
}

export async function enrichChapterListTitlesFromWikitext(
  chapterList: Array<{ number?: number; title?: string; url?: string }>,
  domain: string,
  timeoutMs: number = 10000,
): Promise<void> {
  if (!FANDOM_DOMAIN_RE.test(domain) || chapterList.length === 0) return;
  const needs = chapterList.filter((ch) => isGenericTitle(ch.title) && (ch.url?.startsWith('/wiki/') === true || typeof ch.number === 'number'));
  if (needs.length < chapterList.length * 0.5) return;
  const withUrls = needs.filter((ch) => ch.url?.startsWith('/wiki/') === true).length;
  const useFallback = withUrls < needs.length * 0.2;
  logger.info(`[chapterListEnrichment] ${needs.length}/${chapterList.length} generic, ${withUrls} urls, fallback=${useFallback} for ${domain}`);
  const pages = needs.slice(0, 150).map((ch) => ({ title: pageTitleFor(ch), pageid: 0 })).filter((p) => p.title.length > 0);
  if (pages.length === 0) return;
  const titleByPage = new Map<string, string>();
  for (let i = 0; i < pages.length; i += 50) {
    // eslint-disable-next-line no-await-in-loop -- Sequential to avoid API rate limits
    const r = await fetchBatchWikitextWithTitles(domain, pages.slice(i, i + 50), timeoutMs);
    for (const [k, v] of r) titleByPage.set(k, v);
    if (i === 0 && useFallback && r.size === 0) return;
  }
  let enriched = 0;
  for (const ch of needs) {
    const p = pageTitleFor(ch);
    const t = titleByPage.get(p) ?? titleByPage.get(p.replace(/_/g, ' '));
    if (t && t.length >= 2) { ch.title = t; enriched++; }
  }
  if (enriched > 0) logger.info(`[chapterListEnrichment] Enriched ${enriched} chapter titles for ${domain}`);
}

// ============================================================================
// Category Members API
// ============================================================================

/** Fetch all category members with pagination */
async function fetchAllCategoryMembers(
  domain: string,
  category: string,
  timeoutMs: number,
): Promise<Array<{ title: string; pageid: number }>> {
  const pages: Array<{ title: string; pageid: number }> = [];
  let cmcontinue: string | undefined;

  // Paginate through all results (max 10 pages = 5000 chapters)
  /* eslint-disable no-await-in-loop -- inherently sequential: each page request needs the previous response's `cmcontinue` token */
  for (let page = 0; page < 10; page++) {
    const url = new URL(`https://${domain}/api.php`);
    url.searchParams.set('action', 'query');
    url.searchParams.set('list', 'categorymembers');
    url.searchParams.set('cmtitle', category);
    url.searchParams.set('cmlimit', '500');
    url.searchParams.set('cmtype', 'page');
    url.searchParams.set('format', 'json');
    if (cmcontinue) url.searchParams.set('cmcontinue', cmcontinue);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        headers: { 'User-Agent': 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) break;

      const data = (await response.json()) as CategoryMembersResponse;
      const members = data.query?.categorymembers ?? [];
      pages.push(...members);

      cmcontinue = data.continue?.cmcontinue;
      if (!cmcontinue) break;
    } catch {
      clearTimeout(timeoutId);
      break;
    }
  }
  /* eslint-enable no-await-in-loop */

  return pages;
}

// ============================================================================
// Allpages-Based Chapter Discovery
// ============================================================================

/** MediaWiki allpages API response structure */
interface AllpagesChapterResponse {
  query?: {
    allpages?: Array<{ title: string; pageid: number }>;
  };
  continue?: { apcontinue: string };
}

/** Prefixes to try when searching for chapter pages via allpages API.
 *  "Manga Chapter " covers wikis like 86 Eighty Six.
 *  "Pandora Hearts " covers wikis where chapters are named with series title
 *  (mochijun multi-series wiki hosts "Pandora Hearts 19" etc.).
 *  Series-derived prefixes (e.g. "Konosuba Chapter ") are added dynamically. */
const CHAPTER_PAGE_PREFIXES = ['Chapter ', 'Re: Chapter ', 'Act ', 'Manga Chapter ', 'Pandora Hearts '];

/**
 * Derive a series-name prefix from a Fandom domain.
 * "konosuba.fandom.com" → "Konosuba" so we can probe for "Konosuba Chapter " pages.
 * Returns null when the domain prefix is too short or non-alphabetic.
 */
function deriveSeriesNameFromDomain(domain: string): string | null {
  const sub = domain.split('.')[0];
  if (!sub || sub.length < 3) return null;
  // Skip generic / system subdomains
  if (/^(www|api|en|fr|de|es|it|pt)$/i.test(sub)) return null;
  // Only accept simple alphanumeric (skip hyphens-dashes which usually map to multi-word)
  if (!/^[a-z0-9]+$/i.test(sub)) return null;
  return sub.charAt(0).toUpperCase() + sub.slice(1);
}

/**
 * Discover chapters via the MediaWiki allpages API with chapter prefixes.
 * Tries "Chapter " first, then "Re: Chapter " (for sequels like Tokyo Ghoul:re).
 * Also tries series-derived prefixes ("Konosuba Chapter ", etc.) for wikis
 * where chapter pages are series-prefixed.
 */
async function discoverChaptersViaAllpages(
  domain: string,
  timeoutMs: number,
): Promise<CategoryChapter[] | null> {
  const prefixResults: Array<{ prefix: string; chapters: CategoryChapter[] }> = [];

  const allPrefixes = [...CHAPTER_PAGE_PREFIXES];
  const seriesName = deriveSeriesNameFromDomain(domain);
  if (seriesName) {
    allPrefixes.push(`${seriesName} Chapter `, `${seriesName} Manga Chapter `);
  }

  for (const prefix of allPrefixes) {
    // eslint-disable-next-line no-await-in-loop -- Sequential to avoid rate limiting
    const result = await fetchAllpagesWithPrefix(domain, prefix, timeoutMs);
    if (result && result.length >= 10) {
      prefixResults.push({ prefix, chapters: result });
    }
  }

  if (prefixResults.length === 0) return null;

  // Return the largest result
  return prefixResults.reduce((best, r) => r.chapters.length > best.chapters.length ? r : best).chapters;
}

/** Fetch chapter pages from allpages API with a specific prefix */
async function fetchAllpagesWithPrefix(
  domain: string,
  prefix: string,
  timeoutMs: number,
): Promise<CategoryChapter[] | null> {
  const allPages: Array<{ title: string; pageid: number }> = [];
  let apcontinue: string | undefined;

  /* eslint-disable no-await-in-loop -- inherently sequential: each page request needs the previous response's `apcontinue` token */
  for (let page = 0; page < 10; page++) {
    const url = new URL(`https://${domain}/api.php`);
    url.searchParams.set('action', 'query');
    url.searchParams.set('list', 'allpages');
    url.searchParams.set('apprefix', prefix);
    url.searchParams.set('aplimit', '500');
    url.searchParams.set('format', 'json');
    if (apcontinue) url.searchParams.set('apcontinue', apcontinue);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        headers: { 'User-Agent': 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher)' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) break;

      const data = (await response.json()) as AllpagesChapterResponse;
      const members = data.query?.allpages ?? [];
      allPages.push(...members);

      apcontinue = data.continue?.apcontinue;
      if (!apcontinue) break;
    } catch {
      clearTimeout(timeoutId);
      break;
    }
  }
  /* eslint-enable no-await-in-loop */

  // Threshold 5 (was 10) to catch ongoing series with few published chapters
  if (allPages.length < 5) return null;

  logger.info(
    `[categoryChapterDiscovery] allpages discovery: found ${allPages.length} chapter pages for ${domain}`,
  );

  return extractChaptersFromTitles(allPages);
}
