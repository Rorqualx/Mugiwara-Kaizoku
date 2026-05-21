/**
 * Table Extractor - Arc Extractors
 *
 * Functions for extracting story arc data from tables
 * including arc headers and nested chapter structures.
 *
 * Extracted from: TableExtractor.ts (lines 569-656)
 */

import type { PatternLibrary } from '@/server/parsers/patterns/PatternLibrary';

import {
  isArcHeader,
  extractChapterFromRow,
  extractChaptersFromElement,
} from './utils';

import type {
  CheerioAPI,
  Element,
  StoryArc,
  TableData,
  ExtractionOptions,
} from './types';

// ============================================================================
// Arc Extractors
// ============================================================================

/**
 * Extract story arc table
 * Handles tables with arc headers and chapter rows
 */
export function extractStoryArcTable(
  $: CheerioAPI,
  table: Element,
  _options: ExtractionOptions,
  patterns: PatternLibrary
): TableData | null {
  const arcs: StoryArc[] = [];
  let currentArc: StoryArc | null = null;

  $(table).find('tr').each((_, row) => {
    const $row = $(row);
    const cells = $row.find('td, th');

    // Check if this is an arc header row
    if (isArcHeader($, row, patterns)) {
      // Save previous arc
      if (currentArc && currentArc.chapters.length > 0) {
        arcs.push(currentArc);
      }

      // Extract arc name
      const arcName = cells.first().text().trim();
      currentArc = {
        name: arcName.replace(/\s+(Arc|Saga|Story)$/i, ''),
        chapters: []
      };

      // Extract arc metadata from header
      const arcText = $row.text();
      const chapterRange = arcText.match(/Chapter(?:s)?\s+([\d.-]+)\s*[-\u2013]\s*([\d.-]+)/i);
      if (chapterRange?.[1] && chapterRange[2]) {
        currentArc.startChapter = chapterRange[1];
        currentArc.endChapter = chapterRange[2];
      }
    } else if (currentArc) {
      // Extract chapter from row
      const chapterData = extractChapterFromRow($, cells, patterns);
      if (chapterData) {
        chapterData.arcName = currentArc.name;
        currentArc.chapters.push(chapterData);
      }
    }
  });

  // Add last arc if it has chapters
  // TypeScript doesn't track loop mutations, so currentArc is narrowed to `never` here
  const finalArc = currentArc as StoryArc | null;
  if (finalArc !== null && finalArc.chapters.length > 0) {
    arcs.push(finalArc);
  }

  return arcs.length > 0 ? {
    type: 'arc',
    arcs,
    confidence: 0.85
  } : null;
}

/**
 * Extract nested arc chapters
 * Handles nested structures with arc sections
 */
export function extractNestedArcChapters(
  $: CheerioAPI,
  element: Element,
  _options: ExtractionOptions,
  patterns: PatternLibrary
): TableData | null {
  const arcs: StoryArc[] = [];

  // Find arc sections
  $(element).find('.arc-section, .story-arc, [class*="arc"]').each((_, section) => {
    const $section = $(section);
    const arcName = $section.find('h2, h3, .arc-title').first().text().trim();

    if (arcName) {
      const arc: StoryArc = {
        name: arcName,
        chapters: []
      };

      // Find chapters in this arc
      $section.find('table, ul, .chapter-list').each((_, list) => {
        const chapters = extractChaptersFromElement($, list, patterns);
        arc.chapters.push(...chapters);
      });

      if (arc.chapters.length > 0) {
        arcs.push(arc);
      }
    }
  });

  return arcs.length > 0 ? {
    type: 'arc',
    arcs,
    pattern: 'nested-arcs',
    confidence: 0.8
  } : null;
}
