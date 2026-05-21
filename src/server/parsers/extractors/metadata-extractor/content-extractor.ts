/**
 * Content Metadata Extractor
 *
 * Extracts metadata from meta tags and page content.
 * Supports Open Graph, Twitter, and standard meta tags,
 * as well as plot/synopsis extraction from page content.
 *
 * Extracted from: MetadataExtractor.ts (lines 466-515)
 */

import { cleanTitle } from './utils';

import type { ExtractedMetadata } from './types';
import type { CheerioAPI } from 'cheerio';

/**
 * Extract metadata from HTML meta tags
 * Checks Open Graph, Twitter, and standard meta tags
 */
export function extractFromMetaTags($: CheerioAPI): Partial<ExtractedMetadata> {
  const metadata: Partial<ExtractedMetadata> = {};

  // Open Graph tags
  const ogTitle = $('meta[property="og:title"]').attr('content');
  if (ogTitle) metadata.title = cleanTitle(ogTitle);

  const ogDescription = $('meta[property="og:description"]').attr('content');
  if (ogDescription) metadata.description = ogDescription;

  // Twitter tags
  const twitterTitle = $('meta[name="twitter:title"]').attr('content');
  if (twitterTitle && !metadata.title) {
    metadata.title = cleanTitle(twitterTitle);
  }

  // Standard meta tags
  const description = $('meta[name="description"]').attr('content');
  if (description && !metadata.description) {
    metadata.description = description;
  }

  return metadata;
}

/**
 * Extract metadata from page content
 * Looks for plot/synopsis sections and first paragraphs
 */
export function extractFromContent($: CheerioAPI): Partial<ExtractedMetadata> {
  const metadata: Partial<ExtractedMetadata> = {};

  // Extract plot/synopsis
  const plotSelectors = [
    '#Plot', '#Synopsis', '#Story', '.plot-summary',
    'h2:contains("Plot")', 'h2:contains("Synopsis")',
    'h3:contains("Plot")', 'h3:contains("Synopsis")'
  ];

  for (const selector of plotSelectors) {
    const $heading = $(selector).first();
    if ($heading.length > 0) {
      const $content = $heading.nextUntil('h2, h3');
      const plot = $content.text().trim();
      if (plot) {
        metadata.plot = plot;
        break;
      }
    }
  }

  // Extract description from first paragraph if no plot
  if (!metadata.plot) {
    const firstPara = $('.mw-parser-output > p, #mw-content-text > p').first().text().trim();
    if (firstPara && firstPara.length > 50) {
      metadata.description = firstPara;
    }
  }

  return metadata;
}
