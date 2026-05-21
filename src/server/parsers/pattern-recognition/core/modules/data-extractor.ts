/**
 * Data Extractor Module
 *
 * Responsible for extracting and processing pattern data from HTML elements.
 * Provides functions for:
 * - Extracting structured data based on pattern types
 * - Calculating confidence scores for pattern matches
 * - Merging extracted data from multiple matches
 * - Creating recognition responses
 *
 * Extracted from: PatternRecognitionEngine.ts
 * Date: 2025-11-20
 */

import type {
  Pattern,
  PatternFeatures,
  PatternMatch,
  RecognitionResponse,
} from '@/server/parsers/pattern-recognition/types';

import { extractNumber } from './utils';

import type { CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';

type Element = AnyNode;

// ============================================================================
// Data Extraction
// ============================================================================

/**
 * Extract data from an HTML element based on pattern type
 * @param element - DOM element to extract data from
 * @param $ - Cheerio API instance
 * @param pattern - Pattern definition specifying extraction rules
 * @returns Extracted data object
 */
export function extractData(
  element: Element,
  $: CheerioAPI,
  pattern: Pattern
): unknown {
  const $el = $(element);
  const data: Record<string, unknown> = {};

   
  const patternType = pattern.type;
  switch (patternType) {
    case 'volume':
      data['volumeNumber'] = extractNumber($el.text());
      data['title'] = $el.find('.title, h3, h4').first().text().trim();
      data['coverImage'] = $el.find('img').first().attr('src');
      break;

    case 'chapter':
      data['chapterNumber'] = extractNumber($el.text());
      data['title'] = $el.find('.title, a').first().text().trim();
      data['url'] = $el.find('a').first().attr('href');
      break;

    case 'title':
      data['title'] = $el.text().trim();
      break;

    case 'coverImage':
      data['url'] = $el.attr('src') ?? $el.find('img').first().attr('src');
      data['alt'] = $el.attr('alt') ?? $el.find('img').first().attr('alt');
      break;

    case 'infobox':
      $el.find('.pi-item, tr').each((_, item) => {
        const $item = $(item);
        const label = $item
          .find('.pi-data-label, th')
          .first()
          .text()
          .trim();
        const value = $item
          .find('.pi-data-value, td')
          .first()
          .text()
          .trim();
        if (label && value) {
          data[label.toLowerCase().replace(/\s+/g, '_')] = value;
        }
      });
      break;

    case 'table':
      data['headers'] = [];
      data['rows'] = [];
      $el.find('thead th, tr:first-child th, tr:first-child td').each(
        (_, cell) => {
          const headers = data['headers'];
          if (Array.isArray(headers)) {
            headers.push($(cell).text().trim());
          }
        }
      );
      $el.find('tbody tr, tr:not(:first-child)').each((_, row) => {
        const rowData: string[] = [];
        $(row)
          .find('td, th')
          .each((_, cell) => {
            rowData.push($(cell).text().trim());
          });
        if (rowData.length > 0) {
          const rows = data['rows'];
          if (Array.isArray(rows)) {
            rows.push(rowData);
          }
        }
      });
      break;

    case 'metadata':
    case 'description':
    case 'author':
    case 'gallery':
    default: {
      data['text'] = $el.text().trim();
      data['html'] = $el.html();
      return data;
    }
  }

  return data;
}

// ============================================================================
// Confidence Calculation
// ============================================================================

/**
 * Calculate simple confidence score between two feature sets
 * Uses structural, semantic, and statistical feature comparison
 * @param features1 - First feature set
 * @param features2 - Second feature set to compare against
 * @returns Confidence score between 0 and 1
 */
export function calculateSimpleConfidence(
  features1: PatternFeatures,
  features2: PatternFeatures
): number {
  let score = 0;
  let count = 0;

  // Compare structural features
  const struct1 = features1.structural;
  const struct2 = features2.structural;
  if (struct1.tagName === struct2.tagName)
    score += 0.3;
  if (struct1.depth === struct2.depth)
    score += 0.1;
  if (struct1.siblingIndex === struct2.siblingIndex)
    score += 0.1;
  count += 0.5;

  // Compare semantic features
  const sem1 = features1.semantic;
  const sem2 = features2.semantic;
  if (sem1.hasHeading === sem2.hasHeading)
    score += 0.2;
  if (sem1.hasList === sem2.hasList)
    score += 0.1;
  if (sem1.hasTable === sem2.hasTable)
    score += 0.1;
  count += 0.4;

  // Compare statistical features
  const stat1 = features1.statistical;
  const stat2 = features2.statistical;
  const textDiff = Math.abs(
    (stat1.textLength ?? 0) -
      (stat2.textLength ?? 0)
  );
  if (textDiff < 50) score += 0.1;
  count += 0.1;

  return count > 0 ? score / count : 0;
}

/**
 * Calculate overall confidence from all matches
 * Uses weighted average of individual match confidences
 * @param matches - Array of pattern matches
 * @returns Overall confidence score between 0 and 1
 */
export function calculateOverallConfidence(matches: PatternMatch[]): number {
  if (matches.length === 0) return 0;
  let totalConfidence = 0;
  for (const m of matches) {
     
    totalConfidence += m.confidence;
  }
  return totalConfidence / matches.length;
}

// ============================================================================
// Response Creation
// ============================================================================

/**
 * Create recognition response object
 * @param matches - Array of pattern matches
 * @param confidence - Overall confidence score
 * @param metrics - Performance metrics for the recognition
 * @returns Complete recognition response
 */
export function createResponse(
  matches: PatternMatch[],
  confidence: number,
  metrics: RecognitionResponse['performanceMetrics']
): RecognitionResponse {
  return {
    success: matches.length > 0,
    matches,
    confidence,
    extractedData: mergeExtractedData(matches),
     
    performanceMetrics: metrics,
  };
}

/**
 * Merge extracted data from multiple pattern matches
 * Groups data by pattern type and creates arrays of extracted values
 * @param matches - Array of pattern matches containing extracted data
 * @returns Merged data structure organized by pattern type
 */
export function mergeExtractedData(matches: PatternMatch[]): unknown {
  const merged: Record<string, unknown[]> = {};

  for (const m of matches) {
     
    const type: string = m.pattern.type;
    merged[type] ??= [];
    const list = merged[type];
    if (Array.isArray(list)) {
       
      list.push(m.extractedData);
    }
  }

  return merged;
}
