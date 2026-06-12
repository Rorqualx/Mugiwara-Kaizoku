// @file-size-justified: Self-contained per-volume iterator that owns URL pattern
// probing, multi-API discovery fallbacks (Category/embeddedin/allpages),
// concurrent batch processing, and chapter-extraction from individual volume pages.
// Splitting would scatter the URL-pattern-finding state machine across files
// without obvious natural boundaries.
/**
 * Per-Volume Page Iterator
 *
 * Handles Fandom wikis where chapters are distributed across individual volume pages
 * (e.g., /wiki/Volume_1, /wiki/Volume_2, etc.) rather than on a central list page.
 *
 * Example wikis: Black Clover, Goodnight Punpun, Mushoku Tensei
 *
 * @module per-volume-iterator
 */

import * as cheerio from 'cheerio';

import { logger } from '@/utils/logger';

import { discoverVolumePagesViaApi, discoverVolumePagesViaCategory, discoverVolumePagesViaEmbeddedin, extractVolumeNumberFromTitle } from './per-volume-iterator/allpages-discovery';
import { processVolumesBatch, processVolumesFromTitles } from './per-volume-iterator/batch-processing';

import type { BatchDeps } from './per-volume-iterator/batch-processing';
import type { AnyNode } from 'domhandler';

// ============================================================================
// Types
// ============================================================================

export interface VolumePageChapter {
  number: number;
  title?: string;
  url?: string;
  /** Chapter cover spread image from volume page section */
  coverImage?: string;
  /** Chapter synopsis from volume page section */
  summary?: string;
  volumeNumber: number;
}

export interface VolumePageData {
  volumeNumber: number;
  title?: string;
  description?: string;
  coverImage?: string;
  chapters: VolumePageChapter[];
  releaseDate?: string;
  /** Page count from volume infobox (e.g., "192" or "192 (JP) / 200 (EN)" — first integer taken) */
  pageCount?: number;
  /** ISBN from volume infobox (prefers ISBN-13 if both present) */
  isbn?: string;
}

export interface PerVolumeIteratorOptions {
  maxVolumes?: number;
  concurrency?: number;
  timeoutMs?: number;
  userAgent?: string;
  /** Manga title for AI fallback extraction prompts */
  mangaTitle?: string;
}

export interface PerVolumeIteratorResult {
  success: boolean;
  volumes: VolumePageData[];
  totalChapters: number;
  pagesChecked: number;
  pagesWithChapters: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_VOLUMES = 100;
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; MangaMetadataBot/1.0)';

// Volume URL patterns to try (both padded and unpadded).
// `%series%` is replaced with a series name derived from the wiki domain.
const VOLUME_URL_PATTERNS = [
  '/wiki/Volume_%d',
  '/wiki/Volume_%02d',  // Zero-padded (e.g., Volume_02, Volume_03)
  '/wiki/Volume_%d_(Manga)',
  '/wiki/Vol._%d',
  '/wiki/Vol_%d',  // Variant without dot
  '/wiki/Manga_Volume_%d',
  '/wiki/%series%_Manga_Volume_%d',  // Konosuba_Manga_Volume_1 etc.
  '/wiki/%series%_Volume_%d',
  '/wiki/%series%_Volume_%02d',  // Zero-padded series-prefixed
];

/** Derive a series-name from a Fandom domain. */
function deriveSeriesNameFromDomain(domain: string): string | null {
  const sub = domain.split('.')[0];
  if (!sub || sub.length < 3) return null;
  if (/^(www|api|en|fr|de|es|it|pt)$/i.test(sub)) return null;
  if (!/^[a-z0-9]+$/i.test(sub)) return null;
  return sub.charAt(0).toUpperCase() + sub.slice(1);
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Formats a volume number according to the pattern.
 * Handles both %d (unpadded) and %02d (zero-padded) patterns.
 * Also substitutes %series% with a series name derived from the domain.
 */
function formatVolumeNumber(pattern: string, volNum: number, seriesName?: string | null): string {
  let out = pattern;
  if (out.includes('%series%')) {
    if (!seriesName) return ''; // Skip patterns that need a series name when none is available
    out = out.split('%series%').join(seriesName);
  }
  if (out.includes('%02d')) {
    out = out.replace('%02d', volNum.toString().padStart(2, '0'));
  } else {
    out = out.replace('%d', String(volNum));
  }
  return out;
}

// ============================================================================
// Fetching
// ============================================================================

/** Single fetch attempt with timeout. Returns HTML or null.
 *  Uses the MediaWiki action=parse API to bypass Cloudflare, which was
 *  silently serving "Just a moment…" challenge pages to the direct-fetch
 *  path and causing extractVolumeMetadata to see zero infobox content on
 *  any Fandom wiki (Cloudflare blocked ~100% of Volume_N scrapes on the
 *  v28 sample, yielding 0 pageCounts for 17/20 titles). */
async function fetchHtmlOnce(
  url: string,
  timeoutMs: number,
  _userAgent: string
): Promise<{ html: string | null; retryable: boolean }> {
  try {
    const { fetchPageHtmlViaApi } = await import('@/server/services/fandom/utils/mediaWikiApiFetch');
    const html = await fetchPageHtmlViaApi(url, { timeout: timeoutMs });
    if (html) return { html, retryable: false };
    return { html: null, retryable: true };
  } catch {
    return { html: null, retryable: true };
  }
}

/** Short-TTL success cache for volume-page HTML. Pattern probing
 *  (findVolumeUrlPattern), structure checks (hasPerVolumeStructure), and
 *  batch processing all fetch the same Volume_N URLs within one enrichment
 *  pass — previously each phase re-fetched Volume_1/Volume_2 from the
 *  network. Pages are static on the timescale of a single run, so
 *  successful fetches are reused briefly; failures are never cached so
 *  transient nulls stay retryable. */
const HTML_CACHE_TTL_MS = 5 * 60 * 1000;
const HTML_CACHE_MAX_ENTRIES = 50;
const htmlCache = new Map<string, { html: string; fetchedAt: number }>();

/**
 * Fetches HTML from a URL with timeout and one retry on transient failures.
 */
async function fetchHtml(
  url: string,
  timeoutMs: number,
  userAgent: string
): Promise<string | null> {
  const cached = htmlCache.get(url);
  if (cached) {
    if (Date.now() - cached.fetchedAt < HTML_CACHE_TTL_MS) return cached.html;
    htmlCache.delete(url);
  }

  const first = await fetchHtmlOnce(url, timeoutMs, userAgent);
  let html = first.html;
  if (!html && first.retryable) {
    await new Promise<void>((r) => { setTimeout(r, 1500); });
    const second = await fetchHtmlOnce(url, timeoutMs, userAgent);
    html = second.html;
  }

  if (html) {
    if (htmlCache.size >= HTML_CACHE_MAX_ENTRIES) {
      // Map preserves insertion order — drop the oldest entry (FIFO).
      const oldest = htmlCache.keys().next().value;
      if (oldest !== undefined) htmlCache.delete(oldest);
    }
    htmlCache.set(url, { html, fetchedAt: Date.now() });
  }
  return html;
}

/**
 * Probes to find the correct volume URL pattern for a wiki.
 *
 * Stage 1 fans out all pattern Vol_1 probes in parallel — collapses worst-case
 * "no pattern works" from N×timeout sequential to ~1×timeout. Stage 2 then
 * verifies Vol_2 sequentially in pattern priority order, falling back to a
 * Vol_1-only match if no Vol_2 confirms (matches prior behavior).
 */
async function findVolumeUrlPattern(
  baseUrl: string,
  options: Required<PerVolumeIteratorOptions>,
  seriesName: string | null
): Promise<string | null> {
  const candidates = VOLUME_URL_PATTERNS
    .map((pattern) => ({ pattern, url1path: formatVolumeNumber(pattern, 1, seriesName) }))
    .filter((c): c is { pattern: string; url1path: string } => c.url1path !== '');

  // Stage 1: parallel Vol_1 probe across all patterns.
  const vol1Results = await Promise.all(
    candidates.map(async ({ pattern, url1path }) => {
      const html = await fetchHtml(`${baseUrl}${url1path}`, options.timeoutMs, options.userAgent);
      return { pattern, html };
    }),
  );
  const vol1Hits = vol1Results.filter((r) => r.html !== null && r.html.length > 1000);

  // Stage 2: verify Vol_2 in original pattern priority order; first confirmation wins.
  for (const { pattern } of vol1Hits) {
    const url2path = formatVolumeNumber(pattern, 2, seriesName);
    const url2 = `${baseUrl}${url2path}`;
    // eslint-disable-next-line no-await-in-loop -- Early-exit verification; later patterns may not need probing
    const html2 = await fetchHtml(url2, options.timeoutMs, options.userAgent);
    if (html2 && html2.length > 1000) {
      logger.debug(`[perVolumeIterator] Found working pattern: ${pattern}`);
      return pattern;
    }
  }

  // Fallback: accept a Vol_1-only match if no Vol_2 confirmed (some wikis are inconsistent).
  const [firstVol1Hit] = vol1Hits;
  if (firstVol1Hit) {
    logger.debug(`[perVolumeIterator] Found partial pattern (vol 1 only): ${firstVol1Hit.pattern}`);
    return firstVol1Hit.pattern;
  }

  return null;
}

// ============================================================================
// Chapter Extraction
// ============================================================================

/**
 * Extracts chapter number from text like "Chapter 1", "Ch. 12", etc.
 * Also supports Volume 0 prequel format: "Chapter 0-1", "000-1" → 0.1
 */
function extractChapterNumber(text: string): number | null {
  // Special handling for Volume 0 prequel format: "Chapter 0-1", "000-1" → 0.1, 0.2, etc.
  const zeroChapterPatterns = [
    /chapter\s*0+-(\d+)/i,        // Chapter 0-1 → 0.1
    /^0+-(\d+)(?:\.|$|\s)/,       // 000-1, 000-1. → 0.1
    /\b0+-(\d+)\b/,               // 000-1 anywhere → 0.1
  ];
  for (const pattern of zeroChapterPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return parseFloat(`0.${match[1]}`);
    }
  }

  // "Chapter 1" or "Chapter 1: Title"
  const chapterMatch = text.match(/chapter\s*(\d+(?:\.\d+)?)/i);
  if (chapterMatch?.[1]) return parseFloat(chapterMatch[1]);

  // "Ch. 1" or "Ch 12"
  const chMatch = text.match(/ch\.?\s*(\d+(?:\.\d+)?)/i);
  if (chMatch?.[1]) return parseFloat(chMatch[1]);

  // Just a number at start
  const numberMatch = text.match(/^(\d+(?:\.\d+)?)/);
  if (numberMatch?.[1]) return parseFloat(numberMatch[1]);

  return null;
}

/**
 * Extracts chapter title from text like "Chapter 1: The Beginning".
 */
function extractChapterTitle(text: string): string | undefined {
  // "Chapter 1: Title" -> "Title"
  const colonMatch = text.match(/chapter\s*\d+(?:\.\d+)?:\s*(.+)/i);
  if (colonMatch?.[1]) return colonMatch[1].trim();

  // "Chapter 1 - Title" -> "Title"
  const dashMatch = text.match(/chapter\s*\d+(?:\.\d+)?\s*[-–—]\s*(.+)/i);
  if (dashMatch?.[1]) return dashMatch[1].trim();

  return undefined;
}

/**
 * Builds an absolute URL from a relative href.
 */
function buildAbsoluteUrl(href: string | undefined, baseUrl: string): string | undefined {
  if (!href) return undefined;
  if (href.startsWith('http')) return href;
  if (href.startsWith('/')) return `${baseUrl}${href}`;
  return undefined;
}

/**
 * Extracts chapters from a volume page HTML.
 * Uses multiple strategies to find chapters with various URL patterns:
 * - /wiki/Chapter_N (standard)
 * - /wiki/Chapter_Title (title-based like Haikyuu)
 * - /wiki/Title_(chapter_N) (Naruto-style)
 */
export function extractChaptersFromVolumePage(
  html: string,
  volumeNumber: number,
  baseUrl: string,
  $loaded?: cheerio.CheerioAPI
): VolumePageChapter[] {
  const $ = $loaded ?? cheerio.load(html);
  const chapters: VolumePageChapter[] = [];
  const seenNumbers = new Set<number>();

  // Strategy 1: Look for Chapter links in content (standard /wiki/Chapter_N pattern)
  $('a[href*="/wiki/Chapter_"]').each((_i, el) => {
    const $link = $(el);
    const href = $link.attr('href') ?? '';
    const text = $link.text().trim();

    // Extract chapter number from URL
    let chapterNum: number | undefined;

    // Special handling for Volume 0 prequel format: Chapter_0-1 → 0.1
    const zeroMatch = href.match(/Chapter_0+-(\d+)/i);
    if (zeroMatch?.[1]) {
      chapterNum = parseFloat(`0.${zeroMatch[1]}`);
    } else {
      const urlMatch = href.match(/Chapter_(\d+(?:\.\d+)?)/i);
      if (urlMatch?.[1]) {
        chapterNum = parseFloat(urlMatch[1]);
      }
    }

    if (chapterNum === undefined) return;
    if (seenNumbers.has(chapterNum)) return;
    seenNumbers.add(chapterNum);

    const chapter: VolumePageChapter = { number: chapterNum, volumeNumber };
    const title = extractChapterTitle(text);
    if (title) chapter.title = title;
    const absoluteUrl = buildAbsoluteUrl(href, baseUrl);
    if (absoluteUrl) chapter.url = absoluteUrl;
    chapters.push(chapter);
  });

  // Strategy 2: Look for chapter text patterns in lists (with any wiki link)
  if (chapters.length === 0) {
    $('li').each((_i, el) => {
      const text = $(el).text().trim();
      const chapterNum = extractChapterNumber(text);

      if (chapterNum === null || seenNumbers.has(chapterNum)) return;
      seenNumbers.add(chapterNum);

      // Find any wiki link in the list item (title-based URLs)
      const $link = $(el).find('a[href*="/wiki/"]').first();
      const href = $link.attr('href');

      const chapter: VolumePageChapter = { number: chapterNum, volumeNumber };
      const title = extractChapterTitle(text);
      if (title) chapter.title = title;
      const absoluteUrl = buildAbsoluteUrl(href, baseUrl);
      if (absoluteUrl) chapter.url = absoluteUrl;
      chapters.push(chapter);
    });
  }

  // Strategy 3: Look in tables for chapter rows (with any wiki link)
  if (chapters.length === 0) {
    $('table tr').each((_i, el) => {
      const $row = $(el);
      const text = $row.text();

      const chapterNum = extractChapterNumber(text);
      if (chapterNum === null || seenNumbers.has(chapterNum)) return;
      seenNumbers.add(chapterNum);

      // Try to find any link in the row that looks like a chapter page
      // First try links containing "Chapter", then fall back to any wiki link
      let $link = $row.find('a[href*="Chapter"]').first();
      if ($link.length === 0) {
        $link = $row.find('a[href*="/wiki/"]').first();
      }
      const href = $link.attr('href');

      const chapter: VolumePageChapter = { number: chapterNum, volumeNumber };
      const title = extractChapterTitle(text);
      if (title) chapter.title = title;
      const absoluteUrl = buildAbsoluteUrl(href, baseUrl);
      if (absoluteUrl) chapter.url = absoluteUrl;
      chapters.push(chapter);
    });
  }

  // Sort by chapter number
  chapters.sort((a, b) => a.number - b.number);

  return chapters;
}

/**
 * Collects paragraph text following a header element.
 */
function collectParagraphsAfterHeader(
  $: cheerio.CheerioAPI,
  $header: cheerio.Cheerio<AnyNode>
): string | undefined {
  const paragraphs: string[] = [];
  let $next = $header.next();

  while ($next.length > 0 && !$next.is('h2, h3') && paragraphs.length < 5) {
    if ($next.is('p')) {
      const text = $next.text().trim();
      if (text.length > 20) paragraphs.push(text);
    }
    $next = $next.next();
  }

  return paragraphs.length > 0 ? paragraphs.join('\n\n') : undefined;
}

/**
 * Extracts volume description from section ID.
 */
function extractDescriptionById(
  $: cheerio.CheerioAPI,
  sectionIds: string[]
): string | undefined {
  for (const sectionId of sectionIds) {
    const $header = $(`#${sectionId}, [id="${sectionId}"]`);
    if ($header.length === 0) continue;

    const $section = $header.closest('h2, h3');
    if ($section.length === 0) continue;

    const description = collectParagraphsAfterHeader($, $section);
    if (description) return description;
  }
  return undefined;
}

/**
 * Extracts volume description from header text selectors.
 */
function extractDescriptionByHeaderText(
  $: cheerio.CheerioAPI,
  selectors: string[]
): string | undefined {
  for (const selector of selectors) {
    const $header = $(selector).first();
    if ($header.length === 0) continue;

    const description = collectParagraphsAfterHeader($, $header);
    if (description) return description;
  }
  return undefined;
}

/**
 * Extracts opening paragraphs from the page body before any h2 section.
 * Handles wikis like Punpun where the volume description is the first paragraph
 * with no section header.
 */
function extractOpeningParagraphs($: cheerio.CheerioAPI): string | undefined {
  const paragraphs: string[] = [];
  const $content = $('.mw-parser-output').first();
  if ($content.length === 0) return undefined;

  // Iterate direct children, stop at first h2
  $content.children().each((_i, el) => {
    const $el = $(el);
    if ($el.is('h2')) return false; // stop iteration
    if ($el.is('p')) {
      const text = $el.text().trim();
      if (text.length > 50) paragraphs.push(text);
    }
    return undefined;
  });

  return paragraphs.length > 0 ? paragraphs.join('\n\n') : undefined;
}

/**
 * Extracts volume description from Publisher Summary, Synopsis, Summary, Blurb,
 * or similar sections. Falls back to opening paragraphs before any h2.
 */
function extractVolumeDescription($: cheerio.CheerioAPI): string | undefined {
  const sectionIds = [
    'Publisher_Summary', 'Publisher_summary', 'Synopsis',
    'Summary', 'Plot', 'Description', 'Overview', 'Blurb',
  ];

  const byId = extractDescriptionById($, sectionIds);
  if (byId) return byId;

  const headerSelectors = [
    'h2:contains("Publisher Summary")', 'h2:contains("Synopsis")',
    'h2:contains("Summary")', 'h2:contains("Blurb")',
    'h3:contains("Publisher Summary")', 'h3:contains("Synopsis")',
    'h3:contains("Summary")', 'h3:contains("Blurb")',
  ];

  const byHeader = extractDescriptionByHeaderText($, headerSelectors);
  if (byHeader) return byHeader;

  // Fallback: opening paragraphs before any section header (e.g. Punpun)
  return extractOpeningParagraphs($);
}

/**
 * Extracts volume metadata from a volume page HTML.
 */
function extractVolumeMetadata(
  html: string,
  volumeNumber: number,
  $loaded?: cheerio.CheerioAPI
): Partial<VolumePageData> {
  const $ = $loaded ?? cheerio.load(html);
  const metadata: Partial<VolumePageData> = { volumeNumber };

  // Extract title from page heading
  const pageTitle = $('h1.page-header__title, h1#firstHeading').text().trim();
  if (pageTitle && !pageTitle.match(/^volume\s*\d+$/i)) {
    metadata.title = pageTitle;
  }

  // Extract cover image from infobox
  const $coverImg = $('.pi-image img, .pi-image-thumbnail img, .portable-infobox img, .infobox img, .image img').first();
  if ($coverImg.length > 0) {
    const coverImage = $coverImg.attr('data-src') ?? $coverImg.attr('src');
    if (coverImage) metadata.coverImage = coverImage;
  }

  // Extract release date from infobox
  const $infobox = $('.portable-infobox, .infobox');
  $infobox.find('tr, .pi-item').each((_i, el) => {
    const text = $(el).text().toLowerCase();
    if (text.includes('release') || text.includes('published') || text.includes('date')) {
      const dateMatch = $(el).text().match(/(\w+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/);
      if (dateMatch?.[1]) {
        metadata.releaseDate = dateMatch[1];
      }
    }
  });

  // Extract page count from portable-infobox. Wikis vary:
  //   data-source="pages" (Dr. Stone), "page" (Black Clover), "Pages" (Konosuba)
  const pagesRaw = $(
    '[data-source="pages"] .pi-data-value, [data-source="page"] .pi-data-value, [data-source="Pages"] .pi-data-value'
  ).first().text().trim();
  if (pagesRaw) {
    const firstInt = pagesRaw.match(/\d+/)?.[0];
    if (firstInt) {
      const n = parseInt(firstInt, 10);
      if (!isNaN(n) && n > 0) metadata.pageCount = n;
    }
  }

  // Fallback: classic infobox table (Fruits Basket uses <td>Pages</td><td>196</td>)
  if (metadata.pageCount === undefined) {
    $('th:contains("Pages"), td:contains("Pages")').each((_, el) => {
      const value = $(el).next('td').text().trim();
      const firstInt = value.match(/\d+/)?.[0];
      if (firstInt) {
        const n = parseInt(firstInt, 10);
        if (!isNaN(n) && n > 0) {
          metadata.pageCount = n;
          return false;
        }
      }
    });
  }

  // Extract ISBN from portable infobox (data-source="isbn", "ISBN", etc.) or
  // classic infobox rows. Prefer ISBN-13 (13 digits) over ISBN-10 when both
  // appear in the same cell. Normalises separator forms "978-4-09-..." → digits.
  const isbnRaw = $(
    '[data-source="isbn"] .pi-data-value, [data-source="ISBN"] .pi-data-value, [data-source="isbn13"] .pi-data-value, [data-source="isbn_13"] .pi-data-value'
  ).first().text().trim();
  let isbnText = isbnRaw;
  if (!isbnText) {
    // Classic infobox fallback
    $('th:contains("ISBN"), td:contains("ISBN")').each((_, el) => {
      const value = $(el).next('td').text().trim();
      if (value) { isbnText = value; return false; }
    });
  }
  if (isbnText) {
    // Prefer ISBN-13 (13 digits), fall back to ISBN-10 (10 digits incl. X)
    const digits13 = isbnText.match(/97[89][-\s]?(?:\d[-\s]?){9}\d/)?.[0];
    const digits10 = isbnText.match(/(?:\d[-\s]?){9}[\dXx]/)?.[0];
    const picked = digits13 ?? digits10;
    if (picked) metadata.isbn = picked.replace(/[-\s]/g, '');
  }

  // Extract description from Publisher Summary, Synopsis, or Summary sections
  const description = extractVolumeDescription($);
  if (description) metadata.description = description;

  return metadata;
}

/** Extracted cover and summary from a chapter section */
interface ChapterSectionData {
  coverImage?: string;
  summary?: string;
}

/**
 * Extracts cover image and summary from sibling elements after a chapter heading.
 */
function extractCoverAndSummaryFromSiblings(
  $: cheerio.CheerioAPI,
  $heading: cheerio.Cheerio<AnyNode>,
): ChapterSectionData {
  const result: ChapterSectionData = {};
  let $next = $heading.next();

  while ($next.length > 0 && !$next.is('h2, h3')) {
    if (!result.coverImage) {
      const $img = $next.find('img').first();
      const src = $img.length > 0 ? ($img.attr('data-src') ?? $img.attr('src')) : undefined;
      if (src && !src.includes('pixel') && !src.includes('1x1')) {
        result.coverImage = src;
      }
    }

    if (!result.summary && $next.is('p')) {
      const text = $next.text().trim();
      if (text.length > 30) {
        result.summary = text;
      }
    }

    if (result.coverImage && result.summary) break;
    $next = $next.next();
  }

  return result;
}

/**
 * Extracts a chapter number from a heading like "001. Title", "Chapter 1: Title", "Chapter 24".
 */
function extractChapterNumberFromHeading(headingText: string): number | null {
  // Pattern 1: Bleach-style "001. Death & Strawberry"
  const bleachMatch = headingText.match(/^(-?\d{1,4}(?:\.\d)?)\.\s/);
  if (bleachMatch?.[1]) return parseFloat(bleachMatch[1]);

  // Pattern 2: "Chapter N", "Chapter N: Title", "Chapter N - Title"
  const chapterMatch = headingText.match(/^chapter\s+(\d+(?:\.\d+)?)\s*(?:[:：\-–—]|$)/i);
  if (chapterMatch?.[1]) return parseFloat(chapterMatch[1]);

  return null;
}

/**
 * Extracts per-chapter cover images and synopses from volume page sections.
 *
 * Matches headings like "001. Death & Strawberry", "Chapter 1: Herr Doctor Tenma",
 * or "Chapter 24" to chapters by number. When no pre-existing chapter exists for a
 * heading, creates a new VolumePageChapter (handles wikis where headings ARE the
 * chapter source, e.g. Monster).
 */
export function extractChapterSectionsFromVolumePage(
  html: string,
  chapters: VolumePageChapter[],
  volumeNumber?: number,
  $loaded?: cheerio.CheerioAPI
): void {
  const $ = $loaded ?? cheerio.load(html);
  const chaptersByNumber = new Map<number, VolumePageChapter>();
  for (const ch of chapters) {
    chaptersByNumber.set(ch.number, ch);
  }

  // Infer volumeNumber from existing chapters if not provided
  const volNum = volumeNumber ?? chapters[0]?.volumeNumber ?? 0;

  const headings = $('h2, h3').toArray();

  for (const heading of headings) {
    const $heading = $(heading);
    const headingText = $heading.text().trim();

    const chapterNum = extractChapterNumberFromHeading(headingText);
    if (chapterNum === null) continue;

    let chapter = chaptersByNumber.get(chapterNum);
    if (!chapter) {
      // Create a new chapter from the heading (e.g. Monster "Chapter 1: Herr Doctor Tenma")
      chapter = { number: chapterNum, volumeNumber: volNum };
      const title = extractChapterTitle(headingText);
      if (title) chapter.title = title;
      chapters.push(chapter);
      chaptersByNumber.set(chapterNum, chapter);
    }

    const sectionData = extractCoverAndSummaryFromSiblings($, $heading);
    if (sectionData.coverImage) chapter.coverImage = sectionData.coverImage;
    if (sectionData.summary) chapter.summary = sectionData.summary;
  }
}

// ============================================================================
// Allpages Supplement
// ============================================================================

/** Params for allpages supplement discovery */
interface SupplementParams {
  domain: string;
  baseUrl: string;
  volumes: VolumePageData[];
  knownVolumeCount: number | undefined;
  options: Required<PerVolumeIteratorOptions>;
  deps: BatchDeps;
}

/** When pattern-based iteration finds far fewer volumes than expected, supplement via allpages. */
async function supplementWithAllpages(params: SupplementParams): Promise<VolumePageData[]> {
  const { domain, baseUrl, volumes, knownVolumeCount, options, deps } = params;
  const expectedMin = knownVolumeCount ? knownVolumeCount * 0.5 : 5;
  if (volumes.length >= expectedMin) return volumes;

  const apiTitles = await discoverVolumePagesViaApi(domain, options.timeoutMs);
  if (!apiTitles || apiTitles.length <= volumes.length) return volumes;

  const existingNums = new Set(volumes.map((v) => v.volumeNumber));
  const extraTitles = apiTitles.filter((t) => {
    const num = extractVolumeNumberFromTitle(t);
    return num !== null && !existingNums.has(num);
  });
  if (extraTitles.length === 0) return volumes;

  logger.info(`[perVolumeIterator] Supplementing with ${extraTitles.length} volume pages via allpages`);
  const extra = await processVolumesFromTitles(baseUrl, extraTitles, options, deps);
  return [...volumes, ...extra].sort((a, b) => a.volumeNumber - b.volumeNumber);
}

// ============================================================================
// Batch Processing Dependencies
// ============================================================================

/** Build batch deps for volume page processing */
function buildBatchDeps(seriesName: string | null): BatchDeps {
  return {
    fetchHtml,
    // Bind seriesName so callers in batch-processing can use a 2-arg signature
    formatVolumeNumber: (pattern: string, volNum: number) => formatVolumeNumber(pattern, volNum, seriesName),
    extractChaptersFromVolumePage,
    extractVolumeMetadata,
    extractChapterSectionsFromVolumePage,
  };
}

// ============================================================================
// Main Iterator
// ============================================================================

/**
 * Iterates through volume pages to extract chapter data.
 *
 * @param domain - The Fandom wiki domain (e.g., "blackclover.fandom.com")
 * @param knownVolumeCount - Optional: Known number of volumes to limit iteration
 * @param options - Iterator options
 */
export async function iterateVolumePages(
  domain: string,
  knownVolumeCount?: number,
  options?: PerVolumeIteratorOptions
): Promise<PerVolumeIteratorResult> {
  const mergedOptions: Required<PerVolumeIteratorOptions> = {
    maxVolumes: options?.maxVolumes ?? DEFAULT_MAX_VOLUMES,
    concurrency: options?.concurrency ?? DEFAULT_CONCURRENCY,
    timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    userAgent: options?.userAgent ?? DEFAULT_USER_AGENT,
    mangaTitle: options?.mangaTitle ?? '',
  };

  const baseUrl = `https://${domain}`;

  logger.info(`[perVolumeIterator] Starting iteration for ${domain}`);

  // Derive series name for series-prefixed URL patterns (Konosuba etc.)
  const seriesName = deriveSeriesNameFromDomain(domain);
  const batchDeps = buildBatchDeps(seriesName);

  // Find the working URL pattern. seriesName allows trying patterns like
  // /wiki/{Series}_Manga_Volume_N (Konosuba etc.).
  const urlPattern = await findVolumeUrlPattern(baseUrl, mergedOptions, seriesName);

  let volumes: VolumePageData[];

  if (urlPattern) {
    const maxVolume = knownVolumeCount && knownVolumeCount > 0 ? knownVolumeCount : mergedOptions.maxVolumes;
    volumes = await processVolumesBatch({ baseUrl, urlPattern, startVolume: 1, endVolume: maxVolume, options: mergedOptions }, batchDeps);
    // Supplement via allpages if pattern found far fewer volumes than expected
    volumes = await supplementWithAllpages({ domain, baseUrl, volumes, knownVolumeCount, options: mergedOptions, deps: batchDeps });
  } else {
    // Fallback 1: discover via Category:Volumes API (handles custom naming like Bleach)
    const categoryPages = await discoverVolumePagesViaCategory(domain, mergedOptions.timeoutMs);
    if (categoryPages && categoryPages.length >= 2) {
      logger.info(`[perVolumeIterator] Using category discovery: ${categoryPages.length} volumes for ${domain}`);
      const categoryTitles = categoryPages.map((p) => p.title);
      volumes = await processVolumesFromTitles(baseUrl, categoryTitles, mergedOptions, batchDeps);
    } else {
      // Fallback 2: discover via Embeddedin API (pages transcluding volume templates)
      const embeddedinPages = await discoverVolumePagesViaEmbeddedin(domain, mergedOptions.timeoutMs);
      if (embeddedinPages && embeddedinPages.length >= 2) {
        logger.info(`[perVolumeIterator] Using embeddedin discovery: ${embeddedinPages.length} volumes for ${domain}`);
        const embeddedinTitles = embeddedinPages.map((p) => p.title);
        volumes = await processVolumesFromTitles(baseUrl, embeddedinTitles, mergedOptions, batchDeps);
      } else {
        // Fallback 3: discover subtitle-style pages via MediaWiki allpages API
        const apiTitles = await discoverVolumePagesViaApi(domain, mergedOptions.timeoutMs);
        if (!apiTitles) {
          logger.warn(`[perVolumeIterator] No working volume URL pattern found for ${domain}`);
          return { success: false, volumes: [], totalChapters: 0, pagesChecked: VOLUME_URL_PATTERNS.length, pagesWithChapters: 0 };
        }
        logger.info(`[perVolumeIterator] Using allpages discovery: ${apiTitles.length} titles for ${domain}`);
        volumes = await processVolumesFromTitles(baseUrl, apiTitles, mergedOptions, batchDeps);
      }
    }
  }

  // Calculate statistics
  const totalChapters = volumes.reduce((sum, v) => sum + v.chapters.length, 0);
  const pagesWithChapters = volumes.filter((v) => v.chapters.length > 0).length;

  logger.info(
    `[perVolumeIterator] Completed: ${volumes.length} volumes, ${totalChapters} chapters from ${pagesWithChapters} pages`
  );

  return {
    success: volumes.length > 0,
    volumes,
    totalChapters,
    pagesChecked: volumes.length,
    pagesWithChapters,
  };
}

/**
 * Probes /wiki/Volume_0 and parses metadata + chapters if the page exists.
 *
 * Background: HxH "Kurapika's Memories", JJK 0, and other published prequel
 * volumes live at /wiki/Volume_0 but every per-volume iteration path in this
 * file starts at Vol 1 — findVolumeUrlPattern probes Vol_1/Vol_2,
 * processVolumesBatch starts at startVolume=1, discoverVolumeCount loops
 * 1..50. Vol 0 was structurally unreachable. This fetcher reuses the same
 * extractVolumeMetadata + extractChaptersFromVolumePage helpers used for
 * Vol 1+ so the parsed shape is identical.
 */
export async function fetchVolumeZeroIfExists(
  domain: string,
  options?: PerVolumeIteratorOptions
): Promise<VolumePageData | null> {
  const mergedOptions: Required<PerVolumeIteratorOptions> = {
    maxVolumes: 1,
    concurrency: 1,
    timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    userAgent: options?.userAgent ?? DEFAULT_USER_AGENT,
    mangaTitle: options?.mangaTitle ?? '',
  };
  const baseUrl = `https://${domain}`;
  const html = await fetchHtml(`${baseUrl}/wiki/Volume_0`, mergedOptions.timeoutMs, mergedOptions.userAgent);
  if (!html) return null;

  // Parse the page once and share the DOM across the three extractors.
  const $ = cheerio.load(html);
  const chapters = extractChaptersFromVolumePage(html, 0, baseUrl, $);
  const metadata = extractVolumeMetadata(html, 0, $);
  extractChapterSectionsFromVolumePage(html, chapters, 0, $);

  const result: VolumePageData = { volumeNumber: 0, chapters };
  if (metadata.title) result.title = metadata.title;
  if (metadata.description) result.description = metadata.description;
  if (metadata.coverImage) result.coverImage = metadata.coverImage;
  if (metadata.releaseDate) result.releaseDate = metadata.releaseDate;
  if (metadata.pageCount !== undefined) result.pageCount = metadata.pageCount;

  logger.info(`[perVolumeIterator] Vol 0 found for ${domain}: title="${result.title ?? 'untitled'}", ${chapters.length} chapters`);
  return result;
}

/**
 * Checks if a wiki uses the per-volume page structure.
 * Returns true if /wiki/Volume_1 exists and contains chapter information.
 */
export async function hasPerVolumeStructure(
  domain: string,
  options?: PerVolumeIteratorOptions
): Promise<boolean> {
  const mergedOptions: Required<PerVolumeIteratorOptions> = {
    maxVolumes: 1,
    concurrency: 1,
    timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    userAgent: options?.userAgent ?? DEFAULT_USER_AGENT,
    mangaTitle: options?.mangaTitle ?? '',
  };

  const baseUrl = `https://${domain}`;
  const seriesName = deriveSeriesNameFromDomain(domain);
  const urlPattern = await findVolumeUrlPattern(baseUrl, mergedOptions, seriesName);

  if (!urlPattern) {
    return false;
  }

  // Check if Volume 1 has chapters
  const url = `${baseUrl}${urlPattern.replace('%d', '1')}`;
  const html = await fetchHtml(url, mergedOptions.timeoutMs, mergedOptions.userAgent);

  if (!html) {
    return false;
  }

  const chapters = extractChaptersFromVolumePage(html, 1, baseUrl);
  return chapters.length > 0;
}
