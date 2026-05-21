/**
 * Table Extractor - Chapter Extractors
 *
 * Functions for extracting chapter data from chapter-only tables.
 *
 * Extracted from: TableExtractor.ts (lines 511-564)
 */

import type { PatternLibrary } from '@/server/parsers/patterns/PatternLibrary';

import {
  extractHeaders,
  mapHeaderIndices,
} from './utils';

import type {
  CheerioAPI,
  Element,
  ChapterInfo,
  TableData,
  ExtractionOptions,
} from './types';

// ============================================================================
// Chapter Extractors
// ============================================================================

/**
 * Extract chapter-only table
 * Handles tables with chapter columns but no volume columns
 */
export function extractChapterOnlyTable(
  $: CheerioAPI,
  table: Element,
  _options: ExtractionOptions,
  patterns: PatternLibrary
): TableData | null {
  const headers = extractHeaders($, table, patterns);
  const indices = mapHeaderIndices(headers);
  const chapters: ChapterInfo[] = [];

  $(table).find('tr').each((rowIndex, row) => {
    if (rowIndex === 0 && headers.length > 0) return;

    const cells = $(row).find('td, th').map((_, cell) =>
      $(cell).text().trim()
    ).get();

    const chapterIndex = indices.chapter;
    if (chapterIndex !== -1) {
      const chapterMatch = patterns.match(cells[chapterIndex] ?? '', 'chapter');

      if (chapterMatch) {
        const chapterTitleIndex = indices.chapterTitle;
        const titleText = chapterTitleIndex !== -1 ? cells[chapterTitleIndex] : undefined;
        const chapter: ChapterInfo = {
          chapterNumber: chapterMatch.value.toString()
        };
        if (titleText) {
          chapter.title = titleText;
        }

        // Extract release date
        const releaseDateIndex = indices.releaseDate;
        if (releaseDateIndex !== -1) {
          const dateMatch = patterns.match(cells[releaseDateIndex] ?? '', 'date');
          if (dateMatch) {
            chapter.releaseDate = dateMatch.value.toString();
          }
        }

        // Extract URL if present
        const link = $(row).find('a[href*="Chapter"], a[href*="chapter"]').first();
        const href = link.attr('href');
        if (link.length > 0 && href) {
          chapter.url = href;
        }

        chapters.push(chapter);
      }
    }
  });

  return chapters.length > 0 ? {
    type: 'chapter',
    chapters,
    headers,
    confidence: 0.9
  } : null;
}
