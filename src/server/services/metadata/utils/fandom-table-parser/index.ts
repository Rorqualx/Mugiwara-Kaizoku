/**
 * Fandom Table Parser - Main Aggregator
 *
 * Utilities for parsing volume tables, chapter tables, and extracting data
 * from Fandom wiki pages. Supports adaptive parsing based on HTML structure detection.
 *
 * Architecture:
 * - fandom-types.ts - Type definitions (0 functions)
 * - fandom-structure-detector.ts - Structure detection (1 function)
 * - fandom-gallery-parser.ts - Gallery parsing (2 functions)
 * - fandom-navigation-parser.ts - Navigation parsing (2 functions)
 * - fandom-merge-utils.ts - Data merging (2 functions)
 * - fandom-volume-parser.ts - Volume parsing (1 function)
 * - fandom-chapter-parser.ts - Chapter parsing (1 function)
 * - fandom-infobox-parser.ts - Infobox parsing (1 function)
 * - fandom-alternative-parser.ts - Alternative parsing (1 function)
 * - fandom-enhanced-parser.ts - Enhanced parsing (1 function)
 * - fandom-metadata-extractor.ts - Metadata extraction (2 functions)
 *
 * Total: 14 functions across 11 modules
 * Original: 1469 lines -> Refactored: ~100 lines (93% reduction in main file)
 */

// Re-export types
export * from './fandom-types';

// Re-export all parsing functions
export { detectWikiStructure } from './fandom-structure-detector';
export { parseGalleryWithLists, extractChaptersFromLists } from './fandom-gallery-parser';
export { parseNavigationTables, extractChaptersFromNavigation } from './fandom-navigation-parser';
export { mergeVolumeData, mergeChapterData } from './fandom-merge-utils';
export { parseVolumeTables } from './fandom-volume-parser';
export { parseChapterTables } from './fandom-chapter-parser';
export { parseInfoboxData } from './fandom-infobox-parser';
export { parseVolumeTablesAlternative } from './fandom-alternative-parser';
export { parseVolumeTablesEnhanced } from './fandom-enhanced-parser';
export { extractAlternateTitles, extractFullDescription } from './fandom-metadata-extractor';

// Import for parsePageAdaptive
import { logger } from '@/utils/logger';

import { parseVolumeTablesAlternative } from './fandom-alternative-parser';
import { parseChapterTables } from './fandom-chapter-parser';
import { parseGalleryWithLists, extractChaptersFromLists } from './fandom-gallery-parser';
import { mergeVolumeData, mergeChapterData } from './fandom-merge-utils';
import { parseNavigationTables, extractChaptersFromNavigation } from './fandom-navigation-parser';
import { detectWikiStructure } from './fandom-structure-detector';
import { WikiStructureType } from './fandom-types';
import { parseVolumeTables } from './fandom-volume-parser';


import type { VolumeData, ChapterData } from './fandom-types';

/**
 * Parsing hints from static analyzer
 */
export interface ParsePageHints {
  chapterConvention?: string | null;
  volumeSelectors?: string[];
  chapterSelectors?: string[];
  chapterUrlPattern?: string | null;
  checkCollapsible?: boolean;
  checkNestedLists?: boolean;
  hasJpEnTabs?: boolean;
  skipSelectors?: string[];
}

/**
 * Map static analyzer parser types to WikiStructureType
 */
function mapParserToStructureType(recommendedParser?: string): WikiStructureType | null {
  if (!recommendedParser) return null;

  switch (recommendedParser) {
    case 'bulleted-list':
    case 'arc-based':
      return WikiStructureType.GALLERY_WITH_LISTS;
    case 'table-adaptive':
    case 'plain-table':
    case 'numbered-table':
    case 'alternating-row':
    case 'numbered-row':
    case 'per-volume':
      return WikiStructureType.TABLES_WITH_CHAPTERS;
    case 'category-page':
      return WikiStructureType.NAVIGATION_TABLES;
    case 'hybrid':
      return WikiStructureType.MIXED_STRUCTURE;
    default:
      return null;
  }
}

/**
 * Adaptive parser that selects the best parsing strategy based on detected structure
 * @param html - Raw HTML content to parse
 * @param hints - Optional parsing hints from static analyzer
 * @param recommendedParser - Optional recommended parser type from static analyzer
 * @param wikiBaseUrl - Base URL of the wiki (e.g., https://dandadan.fandom.com)
 */
export function parsePageAdaptive(
  html: string,
  hints?: ParsePageHints,
  recommendedParser?: string,
  wikiBaseUrl?: string
): { volumes: VolumeData[]; chapters: ChapterData[] } {
  // Use hints from static analyzer if available, otherwise detect structure
  let structureType: WikiStructureType;

  const hintedStructure = mapParserToStructureType(recommendedParser);
  if (hintedStructure) {
    logger.info(`[parsePageAdaptive] Using hinted structure: ${hintedStructure} (from ${recommendedParser})`);
    structureType = hintedStructure;
  } else {
    structureType = detectWikiStructure(html);
    logger.info(`[parsePageAdaptive] Detected structure: ${structureType}`);
  }

  // Log hints if provided
  if (hints) {
    logger.debug('[parsePageAdaptive] Using parsing hints', {
      checkCollapsible: hints.checkCollapsible,
      checkNestedLists: hints.checkNestedLists,
      hasVolumeSelectors: hints.volumeSelectors?.length ?? 0,
      hasChapterSelectors: hints.chapterSelectors?.length ?? 0,
    });
  }

  switch (structureType) {
    case WikiStructureType.GALLERY_WITH_LISTS:
      return {
        volumes: parseGalleryWithLists(html),
        chapters: extractChaptersFromLists(html)
      };

    case WikiStructureType.TABLES_WITH_CHAPTERS:
      return {
        volumes: parseVolumeTables(html, wikiBaseUrl),
        chapters: parseChapterTables(html, wikiBaseUrl)
      };

    case WikiStructureType.NAVIGATION_TABLES:
      return {
        volumes: parseNavigationTables(html),
        chapters: extractChaptersFromNavigation(html)
      };

    case WikiStructureType.MIXED_STRUCTURE: {
      const galleryVolumes = parseGalleryWithLists(html);
      const tableVolumes = parseVolumeTables(html, wikiBaseUrl);
      const volumes = mergeVolumeData(galleryVolumes, tableVolumes);

      const listChapters = extractChaptersFromLists(html);
      const tableChapters = parseChapterTables(html, wikiBaseUrl);
      const chapters = mergeChapterData(listChapters, tableChapters);

      return { volumes, chapters };
    }

    default:
      return {
        volumes: parseVolumeTablesAlternative(html),
        chapters: parseChapterTables(html, wikiBaseUrl)
      };
  }
}
