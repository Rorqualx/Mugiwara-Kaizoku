/**
 * Chapter Detail Image Utilities
 *
 * Utilities for extracting and cleaning chapter cover images from Fandom wikis.
 * Handles various image attribute patterns, lazy loading, and URL normalization.
 *
 * @module chapter-detail/image-utils
 */

import * as cheerio from 'cheerio';


import { logger } from '@/utils/logger';

import { cleanWikiaImageUrl } from '../utils/imageUtils';

import { IMAGE_SELECTORS } from './constants';

import type { AnyNode } from 'domhandler';

// Re-export for external convenience
export { cleanWikiaImageUrl };

/**
 * Cache for successful selectors per wiki hostname
 * Key: wiki hostname (e.g., "fire-force.fandom.com")
 * Value: selector that worked for this wiki
 *
 * This dramatically speeds up chapter cover extraction by reusing
 * the selector that worked for the first chapter instead of testing all 43.
 */
const wikiSelectorCache = new Map<string, string>();

/**
 * Extract wiki hostname from URL for caching purposes
 */
function getWikiHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Check if a src value should be filtered out (not a valid cover image)
 */
function shouldFilterSrc(src: string | undefined): boolean {
  if (!src) return true;
  if (src.includes('data:') || src.includes('Site-logo') || src.includes('transparent.gif')) return true;
  // Filter decorative wiki images (quote icons, UI elements)
  if (/Quote\d*\.png|Icon[_-]|Arrow[_-]|Transparent\.png/i.test(src)) return true;
  // Filter tiny images (likely icons, not covers) via URL dimensions
  if (/\/scale-to-width-down\/(?:1[0-6]|[1-9])\?/.test(src)) return true;
  return false;
}

/**
 * Get the reason why a src was filtered out
 */
function getFilterReason(src: string | undefined): string {
  if (!src) return 'no src';
  if (src.includes('data:')) return 'data uri';
  if (src.includes('Site-logo')) return 'site logo';
  if (src.includes('transparent.gif')) return 'transparent gif';
  if (/Quote\d*\.png/i.test(src)) return 'quote icon';
  if (/\/scale-to-width-down\/(?:1[0-6]|[1-9])\?/.test(src)) return 'tiny image';
  return 'filtered';
}

/**
 * Extract best image URL from cheerio element with multiple attribute fallbacks
 *
 * Checks various image attributes in order of preference to find the best quality image.
 * Handles lazy-loaded images, data attributes, and parent link fallbacks.
 *
 * Returns RAW URL - caller should clean with cleanWikiaImageUrl() as needed.
 * Does not apply cleaning to allow caller to decide cleanup strategy.
 *
 * @param img - Cheerio element containing the image
 * @param _$ - Cheerio API instance (unused but kept for API compatibility)
 * @returns Raw image URL or undefined if no valid URL found
 *
 * @example
 * ```typescript
 * const img = $('img.cover').first();
 * const rawUrl = extractBestImageUrl(img, $);
 * const cleanUrl = cleanWikiaImageUrl(rawUrl);
 * ```
 */
export function extractBestImageUrl(
  img: cheerio.Cheerio<AnyNode>,
  _$: cheerio.CheerioAPI
): string | undefined {
  if (img.length === 0) return undefined;

  // Try different image attributes in order of preference (enhanced list)
  let imgUrl = img.attr('data-src') ??
               img.attr('data-image-url') ??
               img.attr('data-original') ??
               img.attr('data-image-key') ??
               img.attr('data-image-name') ??
               img.attr('src');

  // Also check parent <a> tag for full-size image
  if (!imgUrl) {
    const parentLink = img.parent('a');
    if (parentLink.length > 0) {
      imgUrl = parentLink.attr('href');
    }
  }

  if (!imgUrl) return undefined;

  // Handle data-image-key/data-image-name (construct full URL)
  if (imgUrl && !imgUrl.startsWith('http')) {
    if (img.attr('data-image-key') || img.attr('data-image-name')) {
      imgUrl = `https://static.wikia.nocookie.net/${imgUrl}`;
    }
  }

  return imgUrl;
}

/**
 * Find chapter cover image by testing multiple selectors
 *
 * Attempts to find a chapter cover image using a prioritized list of CSS selectors.
 * Each selector is tried in order until a valid image is found.
 *
 * Includes special debug logging for Chapter 0 URLs to help diagnose selector issues.
 * Uses cleanWikiaImageUrl() to normalize found URLs before returning.
 *
 * @param $ - Cheerio API instance for DOM traversal
 * @param chapterUrl - URL of the chapter page (used for debug logging)
 * @returns Cleaned image URL or undefined if no image found
 *
 * @example
 * ```typescript
 * const $ = cheerio.load(html);
 * const coverUrl = findChapterCoverImage($, 'https://fireforce.fandom.com/wiki/Chapter_0');
 * if (coverUrl) {
 *   logger.info('Found cover:', coverUrl);
 * }
 * ```
 */
/**
 * Try a single selector and return the cleaned URL if valid
 */
function trySelector(
  $: cheerio.CheerioAPI,
  selector: string,
  chapterUrl: string,
  enableVerboseLogging = false
): string | undefined {
  const img = $(selector).first();
  if (!img.length) {
    if (enableVerboseLogging) {
      logger.debug(`[Selector] ${selector} - no match`);
    }
    return undefined;
  }

  const src = img.attr('data-src') ??
             img.attr('data-image-url') ??
             img.attr('data-original') ??
             img.attr('src');

  // Log what we found for debugging
  if (enableVerboseLogging) {
    logger.info(`[Selector] ${selector}`, {
      found: true,
      rawSrc: src?.substring(0, 100),
      hasDataSrc: !!img.attr('data-src'),
      hasSrc: !!img.attr('src'),
      isDataUri: src?.includes('data:'),
      isSiteLogo: src?.includes('Site-logo'),
      chapterUrl: chapterUrl.substring(chapterUrl.lastIndexOf('/') + 1),
    });
  }

  if (shouldFilterSrc(src)) {
    if (enableVerboseLogging) {
      logger.info(`[Selector] ${selector} - FILTERED OUT`, { reason: getFilterReason(src) });
    }
    return undefined;
  }

  const cleanedUrl = cleanWikiaImageUrl(src);
  if (enableVerboseLogging && !cleanedUrl) {
    logger.info(`[Selector] ${selector} - cleanWikiaImageUrl returned empty`, { originalSrc: src });
  }
  return cleanedUrl || undefined;
}

export function findChapterCoverImage(
  $: cheerio.CheerioAPI,
  chapterUrl: string
): string | undefined {
  const wikiHost = getWikiHostname(chapterUrl);
  const cachedSelector = wikiSelectorCache.get(wikiHost);

  // Enable verbose logging for debugging - can check specific chapters or all
  const enableVerboseLogging = chapterUrl.includes('Chapter_0') || chapterUrl.includes('Chapter_1');

  // Diagnostic: Log HTML structure info
  if (enableVerboseLogging) {
    logger.info(`[Image Extraction] Analyzing HTML for chapter cover`, {
      chapterUrl: chapterUrl.substring(chapterUrl.lastIndexOf('/') + 1),
      htmlLength: $.html().length,
      imgMwFileElement: $('img.mw-file-element').length,
      imgDataRelevant: $('img[data-relevant="1"]').length,
      infoboxpic: $('.infoboxpic').length,
      wdsTabContent: $('.wds-tab__content').length,
      portableInfobox: $('.portable-infobox').length,
      firstImgSrc: $('img').first().attr('src')?.substring(0, 80),
    });
  }

  // If we have a cached selector for this wiki, try it first
  if (cachedSelector) {
    const result = trySelector($, cachedSelector, chapterUrl, enableVerboseLogging);
    if (result) {
      logger.debug(`Used cached selector '${cachedSelector}' for ${wikiHost}`);
      return result;
    }
    // Cached selector didn't work, clear it and try all selectors
    logger.debug(`Cached selector '${cachedSelector}' failed for ${chapterUrl}, trying all selectors`);
    wikiSelectorCache.delete(wikiHost);
  }

  logger.debug(`Testing ${IMAGE_SELECTORS.length} selectors for chapter cover image`, { url: chapterUrl });

  // Test each selector
  for (const selector of IMAGE_SELECTORS) {
    const result = trySelector($, selector, chapterUrl, enableVerboseLogging);
    if (result) {
      // Cache this successful selector for the wiki
      if (wikiHost) {
        wikiSelectorCache.set(wikiHost, selector);
        logger.info(`Cached selector '${selector}' for wiki ${wikiHost}`);
      }
      logger.info(`Found chapter cover with selector '${selector}': ${result.substring(0, 100)}`);
      return result;
    }
  }

  // Diagnostic: Log when no image found
  if (enableVerboseLogging) {
    logger.warn(`[Image Extraction] NO cover image found`, {
      chapterUrl: chapterUrl.substring(chapterUrl.lastIndexOf('/') + 1),
      selectorsTestedCount: IMAGE_SELECTORS.length,
      allImgCount: $('img').length,
      firstImgSrcFull: $('img').first().attr('src'),
    });
  } else {
    logger.warn(`No cover image found after testing ${IMAGE_SELECTORS.length} selectors for: ${chapterUrl}`);
  }

  return undefined;
}
