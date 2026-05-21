/**
 * Table Extractor - Main Class
 *
 * Orchestrates table extraction from wiki pages using pattern-based detection.
 * Delegates actual extraction to specialized modules.
 *
 * Architecture:
 * - table-extractor/types.ts - Type definitions (180 lines)
 * - table-extractor/utils.ts - Shared utilities (441 lines)
 * - table-extractor/gallery-extractors.ts - Gallery extraction (176 lines)
 * - table-extractor/volume-extractors.ts - Volume extraction (284 lines)
 * - table-extractor/chapter-extractors.ts - Chapter extraction (90 lines)
 * - table-extractor/arc-extractors.ts - Arc extraction (132 lines)
 * - table-extractor/complex-extractors.ts - Complex patterns (296 lines)
 *
 * Original: 1367 lines -> Refactored: ~350 lines (74% reduction)
 */

import { PatternLibrary } from '../patterns/PatternLibrary';

import {
  extractStoryArcTable,
  extractNestedArcChapters,
} from './table-extractor/arc-extractors';
import { extractChapterOnlyTable } from './table-extractor/chapter-extractors';
import {
  extractMultiColumnVolumes,
  extractRowspanVolumeChapters,
  extractGenericTable,
} from './table-extractor/complex-extractors';
import {
  extractWikiaGalleryVolumes,
  extractTabbedGalleryVolumes,
  extractGalleryData,
} from './table-extractor/gallery-extractors';
import {
  extractHeaders,
  isValidTable,
  containsVolumeInfo,
  hasStructuredData,
  containsTableData,
  mergeRelatedTables,
} from './table-extractor/utils';
import {
  extractStandardVolumeTable,
  extractTankobon,
  extractOmnibusEditions,
} from './table-extractor/volume-extractors';

import type {
  CheerioAPI,
  Element,
  VolumeInfo,
  TableData,
  TablePattern,
  ExtractionOptions,
} from './table-extractor/types';

// Re-export types for backward compatibility
export type {
  VolumeInfo,
  ChapterInfo,
  StoryArc,
  TableData,
  ExtractionOptions,
} from './table-extractor/types';

export class TableExtractor {
  private patterns: PatternLibrary;
  private tablePatterns: TablePattern[] = [];

  constructor() {
    this.patterns = new PatternLibrary();
    this.registerTablePatterns();
  }

  /**
   * Register all table extraction patterns
   */
  private registerTablePatterns(): void {
    // ====== Gallery Patterns ======
    this.tablePatterns.push({
      name: 'wikia-gallery-volumes',
      priority: 1,
      detect: ($, element) => {
        return $(element).hasClass('wikia-gallery') &&
               $(element).find('.lightbox-caption').text().match(/Volume\s+\d+/i) !== null;
      },
      extract: ($, element, options) =>
        extractWikiaGalleryVolumes($, element, options, this.patterns)
    });

    this.tablePatterns.push({
      name: 'tabbed-gallery-volumes',
      priority: 2,
      detect: ($, element) => {
        const isTabbed = $(element).closest('.wds-tabber').length > 0;
        const hasGallery = $(element).find('.gallery, .wikia-gallery').length > 0;
        return isTabbed && hasGallery;
      },
      extract: ($, element, options) =>
        extractTabbedGalleryVolumes($, element, options, this.patterns)
    });

    // ====== Standard Table Patterns ======
    this.tablePatterns.push({
      name: 'standard-volume-table',
      priority: 3,
      detect: ($, element) => {
        if (!$(element).is('table')) return false;
        const headers = extractHeaders($, element, this.patterns);
        return headers.some(h => /volume|vol\./i.test(h)) &&
               headers.some(h => /chapter|ch\./i.test(h));
      },
      extract: ($, element, options) =>
        extractStandardVolumeTable($, element, options, this.patterns)
    });

    this.tablePatterns.push({
      name: 'chapter-only-table',
      priority: 4,
      detect: ($, element) => {
        if (!$(element).is('table')) return false;
        const headers = extractHeaders($, element, this.patterns);
        return headers.some(h => /chapter|ch\.|episode|ep\./i.test(h)) &&
               !headers.some(h => /volume|vol\./i.test(h));
      },
      extract: ($, element, options) =>
        extractChapterOnlyTable($, element, options, this.patterns)
    });

    // ====== Story Arc Patterns ======
    this.tablePatterns.push({
      name: 'story-arc-table',
      priority: 5,
      detect: ($, element) => {
        if (!$(element).is('table')) return false;
        const text = $(element).text().toLowerCase();
        return text.includes('arc') || text.includes('saga');
      },
      extract: ($, element, options) =>
        extractStoryArcTable($, element, options, this.patterns)
    });

    this.tablePatterns.push({
      name: 'nested-arc-chapters',
      priority: 6,
      detect: ($, element) => {
        return $(element).find('table table').length > 0 ||
               $(element).find('.arc-section').length > 0;
      },
      extract: ($, element, options) =>
        extractNestedArcChapters($, element, options, this.patterns)
    });

    // ====== Complex Patterns ======
    this.tablePatterns.push({
      name: 'multi-column-volumes',
      priority: 7,
      detect: ($, element) => {
        if (!$(element).is('table')) return false;
        const headers = extractHeaders($, element, this.patterns);
        // Check for multiple volume columns (e.g., Japanese and English releases)
        const volumeHeaders = headers.filter(h => /volume|vol\./i.test(h));
        return volumeHeaders.length > 1;
      },
      extract: ($, element, options) =>
        extractMultiColumnVolumes($, element, options, this.patterns)
    });

    this.tablePatterns.push({
      name: 'rowspan-volume-chapters',
      priority: 8,
      detect: ($, element) => {
        if (!$(element).is('table')) return false;
        // Check for rowspan attributes (volumes spanning multiple chapter rows)
        return $(element).find('td[rowspan], th[rowspan]').length > 0;
      },
      extract: ($, element, options) =>
        extractRowspanVolumeChapters($, element, options, this.patterns)
    });

    // ====== Special Formats ======
    this.tablePatterns.push({
      name: 'tankobon-list',
      priority: 9,
      detect: ($, element) => {
        const text = $(element).text().toLowerCase();
        return text.includes('tankobon') || text.includes('tankobon');
      },
      extract: ($, element, options) =>
        extractTankobon($, element, options, this.patterns)
    });

    this.tablePatterns.push({
      name: 'omnibus-editions',
      priority: 10,
      detect: ($, element) => {
        const text = $(element).text().toLowerCase();
        return text.includes('omnibus') || text.includes('3-in-1') || text.includes('2-in-1');
      },
      extract: ($, element, options) =>
        extractOmnibusEditions($, element, options)
    });
  }

  /**
   * Extract tables from the page
   */
  extractTables($: CheerioAPI, options: ExtractionOptions = {}): Promise<TableData[]> {
    const results: TableData[] = [];
    const candidates = this.findTableCandidates($);

    for (const candidate of candidates) {
      const pattern = this.identifyPattern($, candidate);

      if (pattern) {
        try {
          const data = pattern.extract($, candidate, options);
          if (data) {
            data.pattern = pattern.name;
            results.push(data);
          }
        } catch (error: unknown) {
          console.error(`Error extracting with pattern ${pattern.name}:`, error);
        }
      } else {
        // Try generic extraction
        const genericData = extractGenericTable($, candidate, options, this.patterns);
        if (genericData) {
          results.push(genericData);
        }
      }
    }

    // Merge related tables if requested
    if (options.mergeRelated) {
      return Promise.resolve(mergeRelatedTables(results));
    }

    return Promise.resolve(results);
  }

  /**
   * Find all potential table candidates
   */
  private findTableCandidates($: CheerioAPI): Element[] {
    const candidates: Element[] = [];
    const processedIds = new Set<string>();

    // Standard tables
    $('table').each((_, table) => {
      const id = $(table).attr('id');
      if (id && processedIds.has(id)) return;
      if (id) processedIds.add(id);

      if (isValidTable($, table)) {
        candidates.push(table);
      }
    });

    // Galleries
    $('.wikia-gallery, .gallery').each((_, gallery) => {
      if (containsVolumeInfo($, gallery, this.patterns)) {
        candidates.push(gallery);
      }
    });

    // Tabbed content
    $('.wds-tabber, .tabber').each((_, tabber) => {
      candidates.push(tabber);

      // Also add individual tab contents
      $(tabber).find('.wds-tab__content, .tabbertab').each((_, content) => {
        if (hasStructuredData($, content)) {
          candidates.push(content);
        }
      });
    });

    // Article sections with structured lists
    $('section, .mw-parser-output > div, .article-section').each((_, section) => {
      if (hasStructuredData($, section)) {
        candidates.push(section);
      }
    });

    // Collapsible sections
    $('.mw-collapsible, .collapsible').each((_, collapsible) => {
      if (containsTableData($, collapsible)) {
        candidates.push(collapsible);
      }
    });

    return candidates;
  }

  /**
   * Identify the best pattern for an element
   */
  private identifyPattern($: CheerioAPI, element: Element): TablePattern | null {
    // Sort patterns by priority
    const sortedPatterns = [...this.tablePatterns].sort((a, b) =>
      (a.priority ?? 999) - (b.priority ?? 999)
    );

    for (const pattern of sortedPatterns) {
      try {
        if (pattern.detect($, element)) {
          return pattern;
        }
      } catch (error: unknown) {
        console.error(`Error detecting pattern ${pattern.name}:`, error);
      }
    }

    return null;
  }

  /**
   * Extract gallery data (public API)
   */
  public extractGalleryData($: CheerioAPI): Promise<{ volumes: VolumeInfo[]; images: Array<{ url: string; alt: string; caption: string }> }> {
    return extractGalleryData($);
  }
}
