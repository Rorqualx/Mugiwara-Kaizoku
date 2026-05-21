/**
 * Description Extractors
 *
 * Functions for extracting manga/series descriptions from HTML documents.
 * Supports multiple sources with fallback strategies.
 *
 * Extracted from: UnifiedMetadataParser.ts (lines 827-868)
 * Deduplicated: 2 methods → 1 configurable function
 */

import { ExtractionUtilities } from './extraction-utilities';

import type { CheerioAPI } from 'cheerio';


export type DescriptionSource = 'generic' | 'wikipedia';

/**
 * Extract description from HTML content
 *
 * @param $ - Cheerio API instance
 * @param source - Source type for specialized extraction
 * @returns Extracted description text
 */
export function extractDescription($: CheerioAPI, source: DescriptionSource = 'generic'): string {
  if (source === 'wikipedia') {
    // Wikipedia usually has the description in the first paragraph
    const $firstPara = $('.mw-parser-output > p').first();
    return ExtractionUtilities.cleanText($firstPara.text());
  }

  // Generic extraction with multiple selectors
  const selectors = [
    '#Synopsis',
    '.synopsis',
    '#Plot',
    '.plot-summary',
    '#Summary',
    '#Overview'
  ];

  for (const selector of selectors) {
    const $section = $(selector);
    if ($section.length > 0) {
      // Get the next paragraph
      const $next = $section.nextAll('p').first();
      if ($next.length > 0) {
        return ExtractionUtilities.cleanText($next.text());
      }
    }
  }

  // Fallback: first substantial paragraph
  const $paragraphs = $('#mw-content-text p, .mw-parser-output p');
  for (let i = 0; i < Math.min(5, $paragraphs.length); i++) {
    const text = ExtractionUtilities.cleanText($paragraphs.eq(i).text());
    if (text.length > 100) {
      return text;
    }
  }

  return '';
}
