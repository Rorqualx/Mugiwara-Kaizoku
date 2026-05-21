/**
 * Element Processor Module
 *
 * Element-level processing and pattern matching extracted from RecognitionCore.
 * Handles feature extraction, pattern matching, confidence calculation, and data extraction.
 *
 * Extracted from: recognition-core.ts
 * Date: 2025-11-20
 *
 * @module ElementProcessor
 */

import * as cheerio from 'cheerio';

import { FeatureEngineering } from '@/server/parsers/pattern-recognition/core/FeatureEngineering';
import type {
  Pattern,
  PatternFeatures,
  PatternMatch,
  RecognitionOptions,
} from '@/server/parsers/pattern-recognition/types';

import { extractNumber } from './utils';

import type { CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';

// Type alias for clarity
type Element = AnyNode;

// ============================================================================
// ElementProcessor Class
// ============================================================================

/**
 * Processes individual DOM elements for pattern matching and data extraction
 */
export class ElementProcessor {
  private featureEngineering: FeatureEngineering;
  private patterns: Map<string, Pattern>;

  /**
   * Create a new ElementProcessor instance
   *
   * @param featureEngineering - Feature engineering service
   * @param patterns - Map of available patterns
   */
  constructor(
    featureEngineering: FeatureEngineering,
    patterns: Map<string, Pattern>
  ) {
    this.featureEngineering = featureEngineering;
    this.patterns = patterns;
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Process a single element
   *
   * Extracts features from the element and matches against known patterns.
   *
   * @param element - DOM element to process
   * @param $ - Cheerio instance
   * @param options - Recognition options
   * @returns Array of pattern matches
   */
  processElement(
    element: Element,
    $: CheerioAPI,
    options: RecognitionOptions
  ): PatternMatch[] {
    const matches: PatternMatch[] = [];

    // Extract features
    const features = this.featureEngineering.extractFeatures(element, $);

    // ML Pipeline disabled - using simplified pattern matching
    // Get all patterns and try to match them
    for (const pattern of this.patterns.values()) {
      // Simple confidence check based on feature similarity
      const confidence = this.calculateSimpleConfidence(
        features,
        pattern.features
      );

      if (confidence >= (options.confidenceThreshold ?? 0.7)) {
        const extractedData = this.extractData(element, $, pattern);
        matches.push({
          pattern,
          element,
          features,
          confidence,
          extractedData,
        });
      }
    }

    return matches;
  }

  // ============================================================================
  // Private Methods - Confidence Calculation
  // ============================================================================

  /**
   * Calculate simple confidence score without ML
   *
   * @param features1 - First feature set
   * @param features2 - Second feature set
   * @returns Confidence score (0-1)
   */
  private calculateSimpleConfidence(
    features1: PatternFeatures,
    features2: PatternFeatures
  ): number {
    let score = 0;
    let count = 0;

    // Compare structural features
    if (features1.structural.tagName === features2.structural.tagName) {
      score += 0.3;
    }
    if (features1.structural.depth === features2.structural.depth) {
      score += 0.1;
    }
    if (
      features1.structural.siblingIndex === features2.structural.siblingIndex
    ) {
      score += 0.1;
    }
    count += 0.5;

    // Compare semantic features
    if (features1.semantic.hasHeading === features2.semantic.hasHeading) {
      score += 0.2;
    }
    if (features1.semantic.hasList === features2.semantic.hasList) {
      score += 0.1;
    }
    if (features1.semantic.hasTable === features2.semantic.hasTable) {
      score += 0.1;
    }
    count += 0.4;

    // Compare statistical features
    const textDiff = Math.abs(
      (features1.statistical.textLength ?? 0) -
        (features2.statistical.textLength ?? 0)
    );
    if (textDiff < 50) {
      score += 0.1;
    }
    count += 0.1;

    return count > 0 ? score / count : 0;
  }

  // ============================================================================
  // Private Methods - Data Extraction
  // ============================================================================

  /**
   * Extract data based on pattern
   *
   * @param element - DOM element
   * @param $ - Cheerio instance
   * @param pattern - Pattern to use for extraction
   * @returns Extracted data
   */
  private extractData(
    element: Element,
    $: CheerioAPI,
    pattern: Pattern
  ): unknown {
    const $el = $(element);
    const data: Record<string, unknown> = {};

    switch (pattern.type) {
      case 'volume':
        return this.extractVolumeData($el, $);
      case 'chapter':
        return this.extractChapterData($el, $);
      case 'title':
        return this.extractTitleData($el, $);
      case 'coverImage':
        return this.extractCoverImageData($el, $);
      case 'infobox':
        return this.extractInfoboxData($el, $);
      case 'table':
        return this.extractTableData($el, $);
      default:
        data['text'] = $el.text().trim();
        data['html'] = $el.html();
        return data;
    }
  }

  /**
   * Extract volume data from element
   *
   * @param $el - Cheerio element
   * @param _$ - Cheerio instance (unused but required for consistency)
   * @returns Volume data
   */
  private extractVolumeData(
    $el: cheerio.Cheerio<Element>,
    _$: CheerioAPI
  ): Record<string, unknown> {
    return {
      volumeNumber: extractNumber($el.text()),
      title: $el.find('.title, h3, h4').first().text().trim(),
      coverImage: $el.find('img').first().attr('src'),
    };
  }

  /**
   * Extract chapter data from element
   *
   * @param $el - Cheerio element
   * @param _$ - Cheerio instance (unused but required for consistency)
   * @returns Chapter data
   */
  private extractChapterData(
    $el: cheerio.Cheerio<Element>,
    _$: CheerioAPI
  ): Record<string, unknown> {
    return {
      chapterNumber: extractNumber($el.text()),
      title: $el.find('.title, a').first().text().trim(),
      url: $el.find('a').first().attr('href'),
    };
  }

  /**
   * Extract title data from element
   *
   * @param $el - Cheerio element
   * @param _$ - Cheerio instance (unused but required for consistency)
   * @returns Title data
   */
  private extractTitleData(
    $el: cheerio.Cheerio<Element>,
    _$: CheerioAPI
  ): Record<string, unknown> {
    return {
      title: $el.text().trim(),
    };
  }

  /**
   * Extract cover image data from element
   *
   * @param $el - Cheerio element
   * @param _$ - Cheerio instance (unused but required for consistency)
   * @returns Cover image data
   */
  private extractCoverImageData(
    $el: cheerio.Cheerio<Element>,
    _$: CheerioAPI
  ): Record<string, unknown> {
    return {
      url: $el.attr('src') ?? $el.find('img').first().attr('src'),
      alt: $el.attr('alt') ?? $el.find('img').first().attr('alt'),
    };
  }

  /**
   * Extract infobox data from element
   *
   * @param $el - Cheerio element
   * @param $ - Cheerio instance
   * @returns Infobox data
   */
  private extractInfoboxData(
    $el: cheerio.Cheerio<Element>,
    $: CheerioAPI
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    $el.find('.pi-item, tr').each((_, item) => {
      const $item = $(item);
      const label = $item.find('.pi-data-label, th').first().text().trim();
      const value = $item.find('.pi-data-value, td').first().text().trim();
      if (label && value) {
        data[label.toLowerCase().replace(/\s+/g, '_')] = value;
      }
    });

    return data;
  }

  /**
   * Extract table data from element
   *
   * @param $el - Cheerio element
   * @param $ - Cheerio instance
   * @returns Table data
   */
  private extractTableData(
    $el: cheerio.Cheerio<Element>,
    $: CheerioAPI
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {
      headers: [],
      rows: [],
    };

    // Extract headers
    $el
      .find('thead th, tr:first-child th, tr:first-child td')
      .each((_, cell) => {
        (data['headers'] as string[]).push($(cell).text().trim());
      });

    // Extract rows
    $el.find('tbody tr, tr:not(:first-child)').each((_, row) => {
      const rowData: string[] = [];
      $(row)
        .find('td, th')
        .each((_, cell) => {
          rowData.push($(cell).text().trim());
        });
      if (rowData.length > 0) {
        (data['rows'] as string[][]).push(rowData);
      }
    });

    return data;
  }
}
