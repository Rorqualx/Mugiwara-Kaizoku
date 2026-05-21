/**
 * ComicVine Scraping Service
 *
 * Main orchestrator for scraping ComicVine volume and series data.
 * Refactored to use modular architecture with separate parsing strategies.
 *
 * Scraping Strategy (optimized for performance):
 * 1. First request: FlareSolverr to get cookies + bypass Cloudflare
 * 2. Subsequent requests: Batch HTTP requests using cached cookies (parallel, fast)
 * 3. Fallback: Sequential FlareSolverr for any failed batch requests
 *
 * Returns null gracefully if FlareSolverr is unavailable.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

import {
  buildCookieHeader,
} from '@/server/services/flaresolverr/cookieStore';
import type { StoredCloudflareCookies } from '@/server/services/flaresolverr/types';
import { protectedFetch } from '@/server/services/shared/protectedFetch';
import { logger } from '@/utils/logger';

import { mergeAndProcessChapters } from './chapter-merger';
import { parseChaptersFromLists } from './list-parser';
import { extractVolumeMetadata } from './metadata-extractor';
import { extractPaginationInfo, normalizeUrl } from './pagination-helper';
import { parseChaptersFromText } from './text-parser';
import { delay } from './utils';

import type { ComicVineVolumeChapters, VolumeUrlInfo } from './types';

/** Max retries for failed FlareSolverr requests */
// Iter 14: 4 retries (was 3) gives one more chance after Cloudflare recovers
const MAX_RETRIES = 4;
/** Initial delay between retries in ms */
// Iter 14: 5s base delay (was 2s); exponential gives 5s/10s/20s/40s
const INITIAL_RETRY_DELAY = 5000;
/** Session name for ComicVine - reuses same browser instance */
// Iter 10: ComicVine no longer uses a named FlareSolverr session.
// The session became corrupt after 1-2 issue-page requests (Cloudflare
// re-challenges the session and the cached browser context fails the new
// challenge), causing every subsequent request to return 403. One-shot
// requests (no session) reliably work.
/** Batch size for parallel HTTP requests */
const BATCH_HTTP_SIZE = 5;
/** Default timeout for HTTP requests */
const HTTP_TIMEOUT = 30000;
/** Maximum pages to traverse for pagination */
const MAX_PAGINATION_PAGES = 20;

/**
 * Check if an error is retryable (timeout or challenge-related)
 */
function isRetryableError(error: string): boolean {
  const lowerError = error.toLowerCase();
  return lowerError.includes('timeout') || lowerError.includes('challenge');
}

/**
 * Check if HTML indicates a Cloudflare challenge (not bypassed)
 */
function isCloudflareChallenge(html: string): boolean {
  return (
    html.includes('cf-browser-verification') ||
    html.includes('challenge-platform') ||
    html.includes('cf_chl_') ||
    html.includes('Just a moment...')
  );
}

/**
 * Extracts volume number from issue text using various patterns
 */
function extractVolumeNumber(issueText: string, href: string): number {
  // Primary pattern: "Issue #34"
  const issueMatch = issueText.match(/Issue\s*#(\d+)/i);
  if (issueMatch?.[1]) {
    return parseInt(issueMatch[1], 10);
  }

  // Fallback patterns: "#34", "Volume 34", "Vol. 34"
  const fallbackMatch = issueText.match(/#(\d+)|Volume\s+(\d+)|Vol\.\s*(\d+)/i);
  const matchedNum = fallbackMatch && (fallbackMatch[1] ?? fallbackMatch[2] ?? fallbackMatch[3]);
  if (matchedNum) {
    return parseInt(matchedNum, 10);
  }

  // Last resort: try to extract from the href itself
  const hrefMatch = href.match(/(?:force|volume|vol|issue)[-\s](\d+)/i);
  if (hrefMatch?.[1]) {
    return parseInt(hrefMatch[1], 10);
  }

  // Fallback: extract number from URL slug before /4000- pattern
  // Catches URLs like "/attack-on-titan-1-the-fall/4000-12345/"
  const slugMatch = href.match(/[-/](\d+)[-/](?:4000-)/i);
  if (slugMatch?.[1]) {
    return parseInt(slugMatch[1], 10);
  }

  return 0;
}

/**
 * Extracts volume URLs from a single page's HTML
 */
function extractVolumeUrlsFromPage(
  $: cheerio.CheerioAPI,
  existingUrls: Map<string, VolumeUrlInfo>
): VolumeUrlInfo[] {
  const newVolumes: VolumeUrlInfo[] = [];
  const allIssueLinks = $('a[href*="/4000-"]');

  allIssueLinks.each((_, element) => {
    const $el = $(element);
    const href = $el.attr('href');
    if (!href?.includes('/4000-')) return;

    const fullUrl = href.startsWith('http') ? href : `https://comicvine.gamespot.com${href}`;
    const normalizedUrl = normalizeUrl(fullUrl);

    // Skip if already seen
    if (existingUrls.has(normalizedUrl)) return;

    // Get issue text from element or child
    const issueNumberEl = $el.find('.issue-number');
    const issueText = issueNumberEl.length > 0 ? issueNumberEl.text().trim() : $el.text().trim();

    const volumeNumber = extractVolumeNumber(issueText, href);

    if (volumeNumber > 0) {
      const volumeInfo: VolumeUrlInfo = { volumeNumber, url: fullUrl };
      existingUrls.set(normalizedUrl, volumeInfo);
      newVolumes.push(volumeInfo);
    }
  });

  return newVolumes;
}

/**
 * Default headers for HTTP requests (must match FlareSolverr's browser)
 */
const DEFAULT_HEADERS = {
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'max-age=0',
  Connection: 'keep-alive',
  'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

/**
 * Batch HTTP fetch result
 */
interface BatchFetchResult {
  url: string;
  html: string | null;
  success: boolean;
}

/**
 * ComicVine Scraping Service
 * Handles web scraping for chapter data from ComicVine volume pages
 */
export class ComicVineScrapingService {

  /**
   * Attempt a single fetch with retry handling
   */
  private async attemptFetch(
    url: string,
    attempt: number
  ): Promise<cheerio.CheerioAPI | null> {
    try {
      // Iter 14: pass waitInSeconds so FlareSolverr waits AFTER page load for
      // the Cloudflare challenge JS to fully resolve. The wait grows with each
      // retry attempt (5s → 10s → 15s) to give CF time to recover from rate
      // limiting. Iter 10: omit sessionName entirely (named sessions corrupt).
      const waitSecs = 5 + (attempt - 1) * 5;
      const result = await protectedFetch(url, { timeout: 60000, waitInSeconds: waitSecs });

      // Reject non-2xx even when FlareSolverr returned HTML (status 403 = CF challenge page)
      const httpOk = result.status >= 200 && result.status < 300;
      if (result.success && result.html && httpOk) {
        logger.info('[ComicVine Scraper] Fetched OK', {
          url, status: result.status, attempt, viaFlareSolverr: result.usedFlareSolverr,
        });
        return cheerio.load(result.html);
      }
      if (result.success && result.html && !httpOk && attempt < MAX_RETRIES) {
        return await this.retryFetch(url, attempt, `Non-2xx status: ${result.status}`);
      }

      const error = result.error ?? 'Unknown error';
      if (isRetryableError(error) && attempt < MAX_RETRIES) {
        return await this.retryFetch(url, attempt, error);
      }

      logger.warn('[ComicVine Scraper] protectedFetch failed', {
        url,
        error,
        attempt,
        usedFlareSolverr: result.usedFlareSolverr,
      });
      return null;

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (isRetryableError(errorMsg) && attempt < MAX_RETRIES) {
        return this.retryFetch(url, attempt, errorMsg);
      }

      logger.warn('[ComicVine Scraper] Fetch failed', {
        url,
        error: errorMsg,
        totalAttempts: attempt,
      });
      return null;
    }
  }

  /**
   * Retry fetch after a delay
   */
  private async retryFetch(
    url: string,
    attempt: number,
    error: string
  ): Promise<cheerio.CheerioAPI | null> {
    const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1);
    logger.warn('[ComicVine Scraper] Request failed, retrying...', {
      url,
      error,
      attempt,
      maxAttempts: MAX_RETRIES,
      retryInMs: retryDelay,
    });
    await delay(retryDelay);
    return this.attemptFetch(url, attempt + 1);
  }

  /**
   * Fetch page using protectedFetch with Cloudflare bypass and retry logic
   *
   * ComicVine is Cloudflare-protected. Bypass order:
   * 1. Cached cookies (instant, if available from previous FlareSolverr)
   * 2. FlareSolverr (slow ~20-60s, but reliable)
   *
   * Retries up to MAX_RETRIES times with exponential backoff on failure.
   */
  private async fetchPage(url: string): Promise<cheerio.CheerioAPI | null> {
    return this.attemptFetch(url, 1);
  }

  /**
   * Fetch a single URL using HTTP client with cached cookies (no FlareSolverr)
   *
   * @param url - URL to fetch
   * @param cookies - Cached Cloudflare cookies
   * @returns HTML content or null if failed
   */
  private async fetchWithCookies(
    url: string,
    cookies: StoredCloudflareCookies
  ): Promise<string | null> {
    try {
      const cookieHeader = buildCookieHeader(cookies);
      if (!cookieHeader) {
        return null;
      }

      const response = await axios.get<string>(url, {
        headers: {
          ...DEFAULT_HEADERS,
          'User-Agent': cookies.userAgent,
          Cookie: cookieHeader,
        },
        timeout: HTTP_TIMEOUT,
        responseType: 'text',
      });

      const html = response.data;

      // Check if we still got a Cloudflare challenge
      if (isCloudflareChallenge(html)) {
        logger.debug('[ComicVine Scraper] HTTP request got Cloudflare challenge', { url });
        return null;
      }

      return html;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.debug('[ComicVine Scraper] HTTP request failed', { url, error: errorMsg });
      return null;
    }
  }

  /**
   * Batch fetch multiple URLs using HTTP client with cached cookies
   *
   * Fetches URLs in parallel batches for maximum performance.
   *
   * @param urls - Array of URLs to fetch
   * @param cookies - Cached Cloudflare cookies
   * @returns Array of results (url, html, success)
   */
  private async batchFetchWithCookies(
    urls: string[],
    cookies: StoredCloudflareCookies
  ): Promise<BatchFetchResult[]> {
    const results: BatchFetchResult[] = [];

    // Process in batches to avoid overwhelming the server
    for (let i = 0; i < urls.length; i += BATCH_HTTP_SIZE) {
      const batch = urls.slice(i, i + BATCH_HTTP_SIZE);

      logger.info(`[ComicVine Scraper] Batch HTTP fetch ${Math.floor(i / BATCH_HTTP_SIZE) + 1}/${Math.ceil(urls.length / BATCH_HTTP_SIZE)}`, {
        batchSize: batch.length,
        totalUrls: urls.length,
      });

      // Fetch batch in parallel
      const batchPromises = batch.map(async (url) => {
        const html = await this.fetchWithCookies(url, cookies);
        return { url, html, success: html !== null };
      });

      // eslint-disable-next-line no-await-in-loop -- Batch awaiting is intentional - Promise.all inside loop for controlled parallelism
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to be nice to the server
      if (i + BATCH_HTTP_SIZE < urls.length) {
        // eslint-disable-next-line no-await-in-loop -- Rate limiting delay between batches to avoid server overload
        await delay(500);
      }
    }

    return results;
  }

  /**
   * Scrape multiple volumes with batch HTTP first, FlareSolverr fallback
   *
   * Strategy:
   * 1. First, ensure we have valid cookies (use FlareSolverr for first request if needed)
   * 2. Then batch fetch all URLs using HTTP client with cookies (parallel, fast)
   * 3. For any failed URLs, fall back to sequential FlareSolverr (one-by-one)
   *
   * @param urls - Array of volume URLs to scrape
   * @returns Array of scraped volume data
   */
  async scrapeMultipleVolumes(urls: string[]): Promise<ComicVineVolumeChapters[]> {
    if (urls.length === 0) {
      return [];
    }
    logger.info(`[ComicVine Scraper] Starting scrape for ${urls.length} volumes (sequential FlareSolverr)`);
    // Iter 12: skip the batch HTTP path. Cloudflare invalidates the cached
    // cookies on every request, so the batch path always 403s and falls
    // through. Going straight to sequential FS is the same total work but
    // avoids the wasted parallel HTTP attempt and its async noise.
    return this.scrapeVolumesSequentially(urls);
  }

  /** Process batch fetch with fallback to sequential FlareSolverr */
  private async processBatchWithFallback(
    urls: string[],
    cookies: StoredCloudflareCookies
  ): Promise<ComicVineVolumeChapters[]> {
    const batchResults = await this.batchFetchWithCookies(urls, cookies);
    const successful: ComicVineVolumeChapters[] = [];
    const failedUrls: string[] = [];

    for (const result of batchResults) {
      if (result.success && result.html) {
        const volumeData = this.parseVolumeFromHtml(cheerio.load(result.html), result.url);
        if (volumeData) successful.push(volumeData);
        else failedUrls.push(result.url);
      } else failedUrls.push(result.url);
    }

    const totalCh = successful.reduce((s, v) => s + v.chapters.length, 0);
    logger.info(`[ComicVine] Batch: ${successful.length}/${urls.length} ok (${totalCh} chapters), ${failedUrls.length} failed`);

    if (failedUrls.length > 0) {
      successful.push(...await this.scrapeVolumesSequentially(failedUrls));
    }
    return successful;
  }

  /** Scrape volumes sequentially using FlareSolverr (one-by-one fallback) */
  private async scrapeVolumesSequentially(urls: string[]): Promise<ComicVineVolumeChapters[]> {
    const results: ComicVineVolumeChapters[] = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i] as string;
      // eslint-disable-next-line no-await-in-loop -- Sequential processing required for FlareSolverr
      const result = await this.scrapeVolumeChapters(url);
      if (result) {
        results.push(result);
        logger.info(`[ComicVine] FlareSolverr ${i + 1}/${urls.length}: Vol ${result.volumeNumber} - ${result.chapters.length} ch`);
      } else {
        logger.warn(`[ComicVine] FlareSolverr ${i + 1}/${urls.length}: FAILED`, { url });
      }
       
      // Iter 12: 5s delay (was 1s). Cloudflare rate-limits FlareSolverr after
      // bursts of fast requests; 5s is enough to recover and keep success.
      // eslint-disable-next-line no-await-in-loop -- explicit per-iteration backoff is the whole point of this loop
      if (i < urls.length - 1) await delay(5000);
    }

    const totalCh = results.reduce((s, v) => s + v.chapters.length, 0);
    logger.info(`[ComicVine] Sequential scraping done: ${results.length}/${urls.length} volumes, ${totalCh} chapters`);
    return results;
  }

  /** Parse volume data from HTML (used by batch processing) */
  private parseVolumeFromHtml($: cheerio.CheerioAPI, url: string): ComicVineVolumeChapters | null {
    try {
      const metadata = extractVolumeMetadata($, url);
      const chaptersFromLists = parseChaptersFromLists($);
      const bodyText = $('.wiki-item-display').text() || $('body').text();
      const chaptersFromText = parseChaptersFromText(bodyText);
      const chapters = mergeAndProcessChapters(chaptersFromLists, chaptersFromText);

      if (chapters.length === 0) {
        logger.warn(`[ComicVine] Vol ${metadata.volumeNumber}: 0 chapters found`, { url });
      }
      return { ...metadata, chapters, totalChapters: chapters.length };
    } catch (error: unknown) {
      logger.error('[ComicVine] Parse failed', { url, error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  /**
   * Scrape chapters from a ComicVine volume page
   *
   * Uses protectedFetch for automatic Cloudflare bypass via FlareSolverr.
   * Returns null gracefully if FlareSolverr is unavailable.
   *
   * @param volumeUrl - URL of the ComicVine volume page
   * @returns Volume chapters data or null if scraping fails
   */
  async scrapeVolumeChapters(
    volumeUrl: string
  ): Promise<ComicVineVolumeChapters | null> {
    try {
      logger.info('[ComicVine Scraper] Fetching volume page:', volumeUrl);

      // Try protectedFetch (uses FlareSolverr for Cloudflare bypass)
      const $ = await this.fetchPage(volumeUrl);

      if (!$) {
        logger.warn('[ComicVine Scraper] Failed to fetch page - FlareSolverr may be unavailable', {
          url: volumeUrl,
        });
        return null;
      }

      // Extract metadata (title, summary, cover) using cheerio
      const metadata = extractVolumeMetadata($, volumeUrl);

      // Parse chapters from lists
      const chaptersFromLists = parseChaptersFromLists($);

      // Parse chapters from text
      const bodyText = $('.wiki-item-display').text() || $('body').text();
      const chaptersFromText = parseChaptersFromText(bodyText);

      // Merge and process chapters
      const chapters = mergeAndProcessChapters(
        chaptersFromLists,
        chaptersFromText
      );

      // Log if no chapters found but still return metadata
      // Note: We return metadata even without chapters because themes/genres are valuable
      if (chapters.length === 0) {
        logger.warn(
          '[ComicVine Scraper] No chapters found on page - returning metadata only'
        );
      }

      logger.info('[ComicVine Scraper] Extracted metadata:', {
        volumeTitle: metadata.volumeTitle,
        themesCount: metadata.themes?.length ?? 0,
        themes: metadata.themes ?? [],
        genresCount: metadata.genres?.length ?? 0,
        genres: metadata.genres ?? [],
        chaptersCount: chapters.length,
      });

      // Always return metadata (including themes/genres) even if no chapters
      return {
        ...metadata,
        chapters,
        totalChapters: chapters.length,
      };

    } catch (error: unknown) {
      logger.error('[ComicVine Scraper] Failed to scrape volume', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Extract volume ID from ComicVine URL
   * Note: Currently unused but kept for future volume ID validation
   */
  private _extractVolumeId(url: string): string {
    const match = url.match(/\/4050-(\d+)\/?/);
    return match?.[1] ?? '';
  }

  /**
   * Process a single page during pagination traversal
   */
  private async processSeriesPage(
    currentUrl: string,
    foundUrls: Map<string, VolumeUrlInfo>,
    visitedPages: Set<string>,
    pageCount: number
  ): Promise<{ newVolumes: VolumeUrlInfo[]; nextUrl: string | null }> {
    const $ = await this.fetchPage(currentUrl);
    if (!$) {
      logger.warn('[ComicVine Scraper] Failed to fetch page', { url: currentUrl, page: pageCount });
      return { newVolumes: [], nextUrl: null };
    }

    const newVolumes = extractVolumeUrlsFromPage($, foundUrls);
    logger.info(`[ComicVine Scraper] Page ${pageCount}: found ${newVolumes.length} new volumes`);

    const pagination = extractPaginationInfo($, currentUrl);
    let nextUrl: string | null = null;

    if (pagination?.nextPageUrl) {
      const normalizedNext = normalizeUrl(pagination.nextPageUrl);
      if (!visitedPages.has(normalizedNext)) {
        nextUrl = pagination.nextPageUrl;
      }
    }

    return { newVolumes, nextUrl };
  }

  /**
   * Scrape volume URLs from a series page with pagination support
   *
   * @param seriesUrl - URL of the ComicVine series page
   * @returns Array of volume URLs with their numbers
   */
  async scrapeSeriesVolumeUrls(seriesUrl: string): Promise<VolumeUrlInfo[]> {
    try {
      logger.info('[ComicVine Scraper] Fetching series volume URLs:', seriesUrl);

      const foundUrls = new Map<string, VolumeUrlInfo>();
      const visitedPages = new Set<string>();
      let currentUrl: string | null = seriesUrl;
      let pageCount = 0;

      while (currentUrl && pageCount < MAX_PAGINATION_PAGES) {
        const normalizedCurrent = normalizeUrl(currentUrl);
        if (visitedPages.has(normalizedCurrent)) break;

        visitedPages.add(normalizedCurrent);
        pageCount++;

        // eslint-disable-next-line no-await-in-loop -- Sequential pagination required
        const result = await this.processSeriesPage(currentUrl, foundUrls, visitedPages, pageCount);

        currentUrl = result.nextUrl;
        if (currentUrl) {
          // eslint-disable-next-line no-await-in-loop -- Rate limiting between pages
          await delay(1000);
        }
      }

      const sortedVolumes = Array.from(foundUrls.values()).sort((a, b) => a.volumeNumber - b.volumeNumber);
      logger.info(`[ComicVine Scraper] Total: ${sortedVolumes.length} volumes from ${pageCount} pages`);
      return sortedVolumes;
    } catch (error: unknown) {
      logger.error('[ComicVine Scraper] Failed to scrape series volume URLs', {
        error: error instanceof Error ? error.message : String(error),
        url: seriesUrl,
      });
      return [];
    }
  }

  /**
   * Scrape issue cover images from a ComicVine series/volume page
   *
   * @param url - URL of the ComicVine page
   * @returns Array of cover image URLs (empty strings for issues without covers)
   */
  async scrapeIssueCovers(url: string): Promise<string[]> {
    try {
      logger.info('[ComicVine Scraper] Scraping issue covers from:', url);

      const $ = await this.fetchPage(url);
      if (!$) {
        logger.warn('[ComicVine Scraper] Failed to fetch page for cover scraping');
        return [];
      }

      const covers: string[] = [];

      // Look for issue cover images in various selectors
      // ComicVine typically uses .imgboxart for issue covers
      $('a[href*="/4000-"] img, .issue-cover img, .imgboxart').each((_, element) => {
        const $el = $(element);
        const src = $el.attr('src') ?? $el.attr('data-src');

        if (src && !src.includes('no_image') && !src.includes('placeholder')) {
          // Get the largest version of the image
          const fullSrc = src
            .replace('/scale_small/', '/original/')
            .replace('/scale_medium/', '/original/')
            .replace('/scale_large/', '/original/');
          covers.push(fullSrc);
        }
      });

      logger.info(`[ComicVine Scraper] Found ${covers.length} issue covers`);
      return covers;
    } catch (error: unknown) {
      logger.error('[ComicVine Scraper] Failed to scrape issue covers', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Scrape all volumes for a series
   *
   * @param seriesUrl - URL of the ComicVine series page
   * @returns Array of volume chapters for all volumes in the series
   */
  async scrapeSeriesChapters(
    seriesUrl: string
  ): Promise<ComicVineVolumeChapters[]> {
    try {
      logger.info('[ComicVine Scraper] Fetching series page:', seriesUrl);

      const $ = await this.fetchPage(seriesUrl);
      if (!$) {
        logger.error('[ComicVine Scraper] Failed to fetch series page');
        return [];
      }

      // IMPORTANT: First try to parse chapters from the series page itself
      // Many manga series have chapter titles listed directly on the series page
      const seriesMetadata = extractVolumeMetadata($, seriesUrl);
      const chaptersFromSeriesLists = parseChaptersFromLists($);
      const seriesBodyText = $('.wiki-item-display').text() || $('body').text();
      const chaptersFromSeriesText = parseChaptersFromText(seriesBodyText);
      const seriesChapters = mergeAndProcessChapters(chaptersFromSeriesLists, chaptersFromSeriesText);

      // Only use series page data if it has >= 10 chapters (completeness threshold)
      // Partial data suggests individual volume pages may have more complete listings
      if (seriesChapters.length >= 10) {
        logger.info(`[ComicVine Scraper] Found ${seriesChapters.length} chapters on series page, using directly`);
        return [{ ...seriesMetadata, volumeNumber: 1, chapters: seriesChapters, totalChapters: seriesChapters.length }];
      }

      const partialSeriesData = seriesChapters.length > 0
        ? { ...seriesMetadata, volumeNumber: 1, chapters: seriesChapters, totalChapters: seriesChapters.length }
        : null;
      logger.info(`[ComicVine Scraper] ${partialSeriesData ? `Found ${seriesChapters.length} chapters (< threshold), checking volumes...` : 'No chapters on series page, checking volumes...'}`);


      // Find all volume/issue links
      const volumeLinks: string[] = [];

      // Look for issue links in various locations
      const linkSelectors = [
        '.issue-list a.issue',
        '.volume-issues a',
        'ul.issue-list li a',
        'a[href*="/4000-"]',
        '.wiki-issues-list a',
      ];

      for (const selector of linkSelectors) {
        $(selector).each((_, element) => {
          const href = $(element).attr('href');
          if (href?.includes('/4000-')) {
            const fullUrl = href.startsWith('http')
              ? href
              : `https://comicvine.gamespot.com${href}`;
            if (!volumeLinks.includes(fullUrl)) {
              volumeLinks.push(fullUrl);
            }
          }
        });
      }

      logger.info(`[ComicVine Scraper] Found ${volumeLinks.length} volumes to scrape`);

      // Replace await-in-loop with Promise.all for parallel processing
      const volumePromises = volumeLinks.map(async (volumeUrl, index) => {
        // Stagger requests to avoid rate limiting
        await delay(index * 1000);
        return this.scrapeVolumeChapters(volumeUrl);
      });

      const results = await Promise.all(volumePromises);
      const allVolumeChapters = results.filter(
        (data): data is ComicVineVolumeChapters => data !== null
      );

      // Compare series page data vs volume pages data, return whichever has more chapters
      const volumeTotal = allVolumeChapters.reduce((sum, v) => sum + v.chapters.length, 0);
      if (partialSeriesData && partialSeriesData.chapters.length >= volumeTotal) {
        logger.info(`[ComicVine] Series page has more data (${partialSeriesData.chapters.length} vs ${volumeTotal}), using series`);
        return [partialSeriesData];
      }

      return allVolumeChapters;
    } catch (error: unknown) {
      logger.error('[ComicVine Scraper] Failed to scrape series', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}

// Export singleton instance
export const comicVineScraper = new ComicVineScrapingService();