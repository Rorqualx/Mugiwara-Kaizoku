/**
 * Fandom Structure Detector
 *
 * Detects the HTML structure type of Fandom wiki pages to determine
 * the best parsing strategy (gallery style, table style, navigation, etc.)
 *
 * Extracted from: fandomTableParser.ts (lines 44-77)
 */

import * as cheerio from 'cheerio';

import { logger } from '@/utils/logger';

import { WikiStructureType } from './fandom-types';

/**
 * Detects the HTML structure type of a Fandom wiki page
 *
 * Priority order: Tables > Mixed > Gallery > Navigation > Unknown
 * This ensures pages with chapters in tables aren't misclassified as gallery-style
 */
export function detectWikiStructure(html: string): WikiStructureType {
  const $ = cheerio.load(html);

  // Check for various structural indicators
  const hasGalleries = $('.wikia-gallery, .gallery').length > 0;

  // Separate detection for list-based vs table-based chapters
  const hasChapterInLists = $(
    'ul li a[href*="/wiki/Chapter_"], ul li a[title*="Chapter "]'
  ).length > 0;

  const hasChapterInTables = $(
    'td a[href*="/wiki/Chapter_"], td a[title*="Chapter "]'
  ).length > 0;

  const hasVolumeTables = $('table:contains("Volume"):not(.navbox):not(.infobox)').length > 0;
  const hasNavTables = $('.navbox, .mw-collapsible').length > 0;

  // Detect arc-based tables (Sakamoto Days: "Story Arcs", "Arc X")
  const hasArcTables = $(
    'table:contains("Arc"):not(.navbox):not(.infobox), ' +
    'table th:contains("Arc"), table th:contains("Saga")'
  ).length > 0;

  // Detect chapter ranges in gallery captions (e.g., "Chapters 1-15")
  const hasChapterRangesInGallery = $(
    '.wikia-gallery .lightbox-caption, .gallery .gallerytext'
  ).filter(function() {
    const text = $(this).text();
    return /Chapters?\s+\d+\s*[-\u2013\u2014]\s*\d+/i.test(text);
  }).length > 0;

  logger.debug('[detectWikiStructure] Detection indicators:', {
    hasGalleries,
    hasChapterInLists,
    hasChapterInTables,
    hasVolumeTables,
    hasArcTables,
    hasChapterRangesInGallery,
    hasNavTables
  });

  // Determine structure type based on indicators
  // Priority: Tables > Mixed > Gallery > Navigation > Unknown

  // 1. TABLES_WITH_CHAPTERS - Tables have chapters (even with galleries)
  if ((hasVolumeTables || hasArcTables) && hasChapterInTables) {
    logger.info('Detected wiki structure: TABLES_WITH_CHAPTERS (table-based chapters)');
    return WikiStructureType.TABLES_WITH_CHAPTERS;
  }

  // 2. TABLES_WITH_CHAPTERS - Volume tables with chapter ranges in gallery
  if (hasVolumeTables && hasChapterRangesInGallery) {
    logger.info('Detected wiki structure: TABLES_WITH_CHAPTERS (chapter ranges in gallery)');
    return WikiStructureType.TABLES_WITH_CHAPTERS;
  }

  // 3. GALLERY_WITH_LISTS - Pure gallery style (chapters in ul/li, NOT in tables)
  if (hasGalleries && hasChapterInLists && !hasChapterInTables) {
    logger.info('Detected wiki structure: GALLERY_WITH_LISTS (Fire Force style)');
    return WikiStructureType.GALLERY_WITH_LISTS;
  }

  // 4. MIXED_STRUCTURE - Both gallery and tables have chapters
  if (hasGalleries && hasChapterInLists && hasChapterInTables) {
    logger.info('Detected wiki structure: MIXED_STRUCTURE (chapters in both)');
    return WikiStructureType.MIXED_STRUCTURE;
  }

  // 5. TABLES_WITH_CHAPTERS - Just volume/arc tables
  if (hasVolumeTables || hasArcTables) {
    logger.info('Detected wiki structure: TABLES_WITH_CHAPTERS (volume/arc tables)');
    return WikiStructureType.TABLES_WITH_CHAPTERS;
  }

  // 6. NAVIGATION_TABLES - Only nav tables (no galleries, no volume/arc tables - already ruled out above)
  if (hasNavTables && !hasGalleries) {
    logger.info('Detected wiki structure: NAVIGATION_TABLES');
    return WikiStructureType.NAVIGATION_TABLES;
  }

  // 7. MIXED_STRUCTURE - Galleries with nav tables (no volume/arc tables - already ruled out above)
  if (hasGalleries && hasNavTables) {
    logger.info('Detected wiki structure: MIXED_STRUCTURE');
    return WikiStructureType.MIXED_STRUCTURE;
  }

  logger.info('Detected wiki structure: UNKNOWN');
  return WikiStructureType.UNKNOWN;
}
