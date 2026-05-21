/**
 * Chapter Detail Core Fetcher
 *
 * Handles the core fetching logic for chapter details from Fandom wikis.
 * Includes caching, circuit breaking, and HTML parsing with complexity reduction.
 *
 * This module is designed to be under ESLint complexity limits:
 * - max-statements: <50 (down from 71)
 * - complexity: <20 (down from 36)
 * - max-depth: ≤4 (down from 5)
 *
 * @module chapter-detail/core-fetcher
 */

import * as cheerio from 'cheerio';

import { MultiTierCache } from '@/server/services/comicvine/modules/multiTierCache';
import { fetchPageWithRedirectInfo } from '@/server/services/fandom/utils/mediaWikiApiFetch';
import { logger } from '@/utils/logger';

import { extractAnchorSectionContent, hasAnchor } from './anchor-section-extractor';
import { createChapterDetailCache } from './cache-config';
import { CircuitBreaker } from './circuit-breaker';
import { PERFORMANCE_DEFAULTS } from './constants';
import { findChapterCoverImage } from './image-utils';

import type { ChapterDetail } from './types';

// ============================================================================
// Helper Functions (Private)
// ============================================================================

/**
 * Extract base URL without anchor fragment
 */
function getBaseUrl(url: string): string {
  const hashIndex = url.indexOf('#');
  return hashIndex === -1 ? url : url.substring(0, hashIndex);
}

/**
 * Extract chapter metadata from parsed HTML
 *
 * Consolidates all metadata extraction logic to reduce main method complexity.
 * Handles title, chapter number, description, release date, and page count.
 *
 * @param $ - Cheerio API instance
 * @param _chapterUrl - Chapter URL (unused but kept for API compatibility)
 * @returns Object containing all extracted metadata fields
 */
function extractChapterMetadata(
  $: cheerio.CheerioAPI,
  _chapterUrl: string
): {
  title: string | undefined;
  chapterNumber: string | undefined;
  description: string;
  releaseDate: string | undefined;
  pageCount: number | undefined;
} {
  // Extract page title (e.g., "Chapter 1")
  const pageTitle = $('h1.page-header__title, h1#firstHeading, .pi-title').first().text().trim();

  // Extract the actual chapter name from infobox (e.g., "Kaiman" for Chapter 1 of Dorohedoro)
  // This is more valuable than the page title for display purposes
  let chapterName = $('[data-source="title"] .pi-data-value').text().trim();
  if (!chapterName) {
    // Try alternative selectors for chapter name
    chapterName = $('.pi-data-label:contains("Title")').next('.pi-data-value').text().trim();
  }

  // Use chapter name if available and different from generic "Chapter N", otherwise use page title
  const title = chapterName || pageTitle;

  // Extract chapter number from page title first, then fallback to data attributes
  let chapterNumber = pageTitle.match(/Chapter\s+(\d+)/i)?.[1];
  if (!chapterNumber) {
    chapterNumber = $('.pi-data-value:contains("Chapter")').text().match(/\d+/)?.[0];
  }

  // Extract description/synopsis
  let description = '';

  // Try to find synopsis section first
  $('#Synopsis, #Summary, #Plot, #Story').each((_, el) => {
    const section = $(el).parent();
    const nextP = section.nextAll('p').slice(0, 3);
    if (nextP.length > 0) {
      description = nextP.map((_, p) => $(p).text().trim()).get().join(' ');
      return false; // break
    }
  });

  // If no synopsis section, get first few paragraphs from main content
  if (!description) {
    const paragraphs = $('#mw-content-text > p, .mw-parser-output > p').slice(0, 3);
    description = paragraphs.map((_, p) => $(p).text().trim()).get().join(' ');
  }

  // Extract release date
  let releaseDate: string | undefined;
  $('.pi-data-label:contains("Release"), .pi-data-label:contains("Published")').each((_, el) => {
    const value = $(el).next('.pi-data-value').text().trim();
    if (value) {
      releaseDate = value;
      return false; // break
    }
  });

  // Extract page count - try portable-infobox first
  let pageCount: number | undefined;
  $('.pi-data-label:contains("Pages")').each((_, el) => {
    const value = $(el).next('.pi-data-value').text().trim();
    const pages = parseInt(value, 10);
    if (!isNaN(pages)) {
      pageCount = pages;
      return false; // break
    }
  });

  // Fallback: classic infobox table format (th/td)
  if (pageCount === undefined) {
    $('th:contains("Pages")').each((_, el) => {
      const value = $(el).next('td').text().trim();
      const pages = parseInt(value, 10);
      if (!isNaN(pages)) {
        pageCount = pages;
        return false; // break
      }
    });
  }

  // Fallback: infobox with data-source attribute
  if (pageCount === undefined) {
    const pagesValue = $('[data-source="pages"] .pi-data-value').text().trim();
    // Some wikis prefix the value (e.g. OPM: "Online release: 18\nVolume release: 18").
    // Take the first integer in the text rather than parseInt-from-start, which
    // would yield NaN on prefixed strings.
    const firstInt = pagesValue.match(/\d+/)?.[0];
    if (firstInt) {
      const pages = parseInt(firstInt, 10);
      if (!isNaN(pages) && pages > 0) {
        pageCount = pages;
      }
    }
  }

  return { title, chapterNumber, description, releaseDate, pageCount };
}

/**
 * Generate proxy URL for image
 *
 * Creates an MD5-based proxy path to serve images through our image proxy.
 * This protects against CORS issues and provides caching/optimization.
 *
 * @param coverImageUrl - Original image URL from Fandom
 * @returns Proxied URL path
 */
async function generateProxyUrl(coverImageUrl: string): Promise<string> {
  const crypto = await import('crypto');
  const hash = crypto.createHash('md5').update(coverImageUrl).digest('hex');
  const proxyPath = hash.substring(0, 16);
  return `/api/image-proxy/${proxyPath}?url=${encodeURIComponent(coverImageUrl)}`;
}

/**
 * Build ChapterDetail result object
 *
 * Constructs the final ChapterDetail object with conditional field inclusion.
 * Only includes fields that have values to keep response clean.
 *
 * @param data - All extracted chapter data
 * @returns Fully constructed ChapterDetail object
 */
function buildChapterDetail(data: {
  url: string;
  chapterNumber?: string | undefined;
  title?: string | undefined;
  coverImageUrl?: string | undefined;
  description: string;
  releaseDate?: string | undefined;
  pageCount?: number | undefined;
}): ChapterDetail {
  return {
    url: data.url,
    ...(data.chapterNumber ? { chapterNumber: data.chapterNumber } : {}),
    ...(data.title ? { title: data.title } : {}),
    ...(data.coverImageUrl ? { coverImageUrl: data.coverImageUrl } : {}),
    ...(data.description ? {
      description: data.description.substring(0, 500),
      synopsis: data.description.substring(0, 500)
    } : {}),
    ...(data.releaseDate ? { releaseDate: data.releaseDate } : {}),
    ...(data.pageCount !== undefined ? { pageCount: data.pageCount } : {})
  };
}

// ============================================================================
// Core Fetcher Class
// ============================================================================

/**
 * Core Chapter Fetcher Implementation
 *
 * Handles fetching and parsing of chapter details from Fandom wikis with:
 * - Multi-tier caching (L1 memory + L2 persistent)
 * - Circuit breaker for fault tolerance
 * - Connection pooling for performance
 * - Comprehensive metadata extraction
 *
 * Designed to stay under ESLint complexity limits through aggressive
 * helper function extraction and early returns.
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker();
 * const fetcher = new CoreChapterFetcher(breaker);
 *
 * const detail = await fetcher.fetchChapterDetails('https://wiki.example.com/Chapter_1');
 * if (detail) {
 *   logger.info(`Found: ${detail.title}`);
 * }
 * ```
 */
export class CoreChapterFetcher {
  private readonly cacheService: MultiTierCache<ChapterDetail>;

  /**
   * Initialize core fetcher with circuit breaker
   *
   * @param circuitBreaker - Circuit breaker instance for fault tolerance
   */
  constructor(
    private readonly circuitBreaker: CircuitBreaker
  ) {
    this.cacheService = createChapterDetailCache();
  }

  /**
   * Fetch chapter details from Fandom wiki
   *
   * Main entry point for chapter detail fetching. Handles:
   * 1. Circuit breaker check
   * 2. Cache lookup
   * 3. HTTP request + HTML parsing
   * 4. Metadata extraction
   * 5. Image finding + proxy generation
   * 6. Cache storage
   * 7. Circuit breaker update
   *
   * Complexity reduced from 36 to <15 via helper extraction.
   *
   * @param chapterUrl - Full URL to chapter's Fandom wiki page
   * @returns ChapterDetail object if successful, null if failed or circuit open
   */
  async fetchChapterDetails(chapterUrl: string): Promise<ChapterDetail | null> {
    // Check circuit breaker - early return reduces nesting
    if (!this.circuitBreaker.check()) {
      logger.warn(`[circuit-blocked] Chapter detail dropped for ${chapterUrl}`);
      return null;
    }

    try {
      // Check cache first - early return on hit
      const cached = await this.cacheService.get(chapterUrl);
      if (cached) {
        logger.debug(`Cache hit for chapter: ${chapterUrl}`);
        return { ...cached, fromCache: true } as ChapterDetail;
      }

      // Handle anchor URLs (e.g., volume page with chapter anchor)
      const isAnchorUrl = hasAnchor(chapterUrl);
      const fetchUrl = isAnchorUrl ? getBaseUrl(chapterUrl) : chapterUrl;

      // Fetch HTML via MediaWiki API with redirect detection
      logger.info(`Fetching chapter details via MediaWiki API: ${fetchUrl}`, {
        isAnchorUrl,
        originalUrl: chapterUrl,
      });
      const fetchResult = await fetchPageWithRedirectInfo(fetchUrl, {
        timeout: PERFORMANCE_DEFAULTS.requestTimeout
      });

      if (!fetchResult) {
        logger.warn(`Failed to fetch HTML for chapter: ${fetchUrl}`);
        this.circuitBreaker.update(false);
        return null;
      }

      const $ = cheerio.load(fetchResult.html);

      // Determine effective anchor: explicit anchor in URL takes priority,
      // then redirect fragment from API (e.g., Chapter_1 → Volume_1#001._Death_&_Strawberry)
      const effectiveAnchorUrl = isAnchorUrl
        ? chapterUrl
        : (fetchResult.redirectFragment ? `${fetchUrl}#${fetchResult.redirectFragment}` : undefined);

      // For anchor URLs (explicit or redirect-detected), extract from specific section
      let metadata: ReturnType<typeof extractChapterMetadata>;
      let coverImageUrl: string | undefined;

      if (effectiveAnchorUrl) {
        const anchorContent = extractAnchorSectionContent($, effectiveAnchorUrl);
        if (anchorContent) {
          metadata = {
            title: anchorContent.title,
            chapterNumber: undefined,
            description: anchorContent.synopsis ?? '',
            releaseDate: undefined,
            pageCount: undefined,
          };
          coverImageUrl = anchorContent.coverImageUrl;
          // Fallback: if anchor section has no cover, try the page-level infobox image
          // (e.g., Monster wiki: chapter sections have summaries but no images — use volume cover)
          if (!coverImageUrl) {
            coverImageUrl = findChapterCoverImage($, chapterUrl);
          }
          logger.info(`[CoreFetcher] Anchor extraction result`, {
            anchor: effectiveAnchorUrl.split('#')[1]?.substring(0, 30),
            hasCover: !!coverImageUrl,
            hasSynopsis: !!anchorContent.synopsis,
            redirectDetected: !isAnchorUrl && !!fetchResult.redirectFragment,
          });
        } else {
          // Fallback to regular extraction if anchor not found
          metadata = extractChapterMetadata($, chapterUrl);
          coverImageUrl = findChapterCoverImage($, chapterUrl);
        }
      } else {
        // Regular page - extract metadata normally
        metadata = extractChapterMetadata($, chapterUrl);
        coverImageUrl = findChapterCoverImage($, chapterUrl);
      }

      // Diagnostic logging for image extraction result
      logger.info(`[CoreFetcher] Image extraction result`, {
        chapterUrl: chapterUrl.substring(chapterUrl.lastIndexOf('/') + 1),
        htmlLength: fetchResult.html.length,
        foundImage: !!coverImageUrl,
        imageUrlPreview: coverImageUrl?.substring(0, 100),
        hasTitle: !!metadata.title,
        hasDescription: !!metadata.description,
      });

      // Generate proxy URL if we have a cover
      let finalCoverUrl: string | undefined;
      if (coverImageUrl) {
        finalCoverUrl = await generateProxyUrl(coverImageUrl);
        logger.info(`[CoreFetcher] Generated proxy URL for chapter cover`, {
          original: coverImageUrl.substring(0, 80),
          proxy: finalCoverUrl
        });
      }

      // Build result object using helper (reduces complexity)
      const result = buildChapterDetail({
        url: chapterUrl,
        chapterNumber: metadata.chapterNumber,
        title: metadata.title,
        coverImageUrl: finalCoverUrl,
        description: metadata.description,
        releaseDate: metadata.releaseDate,
        pageCount: metadata.pageCount
      });

      // Cache the result
      await this.cacheService.set(chapterUrl, result);

      // Update circuit breaker - success
      this.circuitBreaker.update(true);

      return result;
    } catch (error: unknown) {
      logger.error(`Failed to fetch chapter details from ${chapterUrl}:`, error);
      this.circuitBreaker.update(false);
      return null;
    }
  }
}
