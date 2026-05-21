/**
 * Link Processor
 *
 * Extracts and categorizes links from content.
 *
 * Extracted from: ContentExtractor.ts (lines 249-315)
 * Date: 2025-11-21
 */

import type { ExtractedLink } from './types';
import type { CheerioAPI } from 'cheerio';

/**
 * Extract links from content with type detection
 */
export function extractLinks(
  $: CheerioAPI,
  hints: unknown,
  normalizeUrl: (url: string) => string
): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const seenUrls = new Set<string>();

  // Validate hints is an object
  let hintsRecord: Record<string, unknown>;
  if (!hints || typeof hints !== 'object') {
    hintsRecord = {};
  } else {
    hintsRecord = hints as Record<string, unknown>;
  }

  // Extract chapter links
  $('a').each((_, link) => {
    const $link = $(link);
    const href = $link.attr('href');
    const text = $link.text().trim();

    if (!href || seenUrls.has(href)) return;

    // Determine link type
    let type: ExtractedLink['type'] = 'unknown';

    const chapterPattern = hintsRecord['chapterLinkPattern'];
    const volumePattern = hintsRecord['volumeLinkPattern'];

    // Type guard for RegExp
    const isRegExp = (value: unknown): value is RegExp =>
      value instanceof RegExp ||
      (typeof value === 'object' && value !== null && 'test' in value && typeof (value as { test: unknown }).test === 'function');

    if (isRegExp(chapterPattern)) {
      if (chapterPattern.test(text) || chapterPattern.test(href)) {
        type = 'chapter';
      }
    }

    if (type === 'unknown' && isRegExp(volumePattern)) {
      if (volumePattern.test(text) || volumePattern.test(href)) {
        type = 'volume';
      }
    }

    if (type === 'unknown' && href.startsWith('http')) {
      type = 'external';
    } else if (href.startsWith('#')) {
      return; // Skip anchors
    } else {
      type = 'related';
    }

    links.push({
      url: normalizeUrl(href),
      text,
      type,
      context: $link.closest('table, .infobox, .gallery').length > 0 ?
        'structured' : 'content'
    });

    seenUrls.add(href);
  });

  return links;
}
