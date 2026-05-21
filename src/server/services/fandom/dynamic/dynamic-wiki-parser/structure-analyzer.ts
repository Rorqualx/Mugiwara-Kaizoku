/**
 * Dynamic Wiki Parser - Structure Analyzer Module
 *
 * Analyzes wiki page structure to determine extraction strategy.
 * Detects structure type, extracts metadata, generates selectors.
 *
 * Extracted from: DynamicWikiParser.ts (lines 176-308)
 */

import {
  generateTableSelectors,
  generateTabbedSelectors,
  generateDefinitionListSelectors,
  generateGallerySelectors,
  generateCollapsibleSelectors,
  generateCategorySelectors,
  generateGenericSelectors,
  generateFallbackSelectors,
  generateVolumeSelectors,
  generateChapterSelectors,
} from './selector-generators';
import {
  StructureType,
  type StructureMetadata,
  type DynamicSelectors,
  type ContentPatterns,
  type SelectorStrategy,
} from './types';
import {
  hasVolumeContent,
  hasChapterContent,
  hasStructuredTables,
  hasDefinitionListStructure,
} from './utils';

import type { CheerioAPI } from 'cheerio';


// ============================================================================
// Structure Metadata Extraction
// ============================================================================

/**
 * Extract metadata about the page structure
 *
 * @param $ - Cheerio API instance loaded with page HTML
 * @returns Metadata describing page structure characteristics
 */
export function extractStructureMetadata($: CheerioAPI): StructureMetadata {
  const tables = $('table').not('.navbox, .infobox');
  const lists = $('ul, ol, dl').not('.toc, .navigation');
  const links = $('a[href]');
  const content = $('#mw-content-text, .mw-parser-output').first();

  return {
    hasVolumes: hasVolumeContent($),
    hasChapters: hasChapterContent($),
    hasTabs: $('.tabber, .wds-tabber, .tabbertab').length > 0,
    hasCollapsibles: $('.mw-collapsible, .collapsible').length > 0,
    hasGallery: $('.gallery, .wikia-gallery').length > 0,
    hasInfobox: $('.infobox, .portable-infobox').length > 0,
    tableCount: tables.length,
    listCount: lists.length,
    linkDensity: links.length / Math.max(1, content.text().length / 100)
  };
}

// ============================================================================
// Structure Type Detection
// ============================================================================

/**
 * Detect the primary structure type of the page using priority-based detection
 */
export function detectStructureType($: CheerioAPI, metadata: StructureMetadata): StructureType {
  // Check for Fire Force specific pattern: tabs AND volume tables
  if (metadata.hasTabs && metadata.tableCount > 10 && $('a[href*="/wiki/Volume_"]').length > 0) {
    return StructureType.HYBRID; // Hybrid tab+table structure
  }

  // Priority-based detection
  if (metadata.hasTabs) {
    return StructureType.TABBED_INTERFACE;
  }

  if (metadata.hasCollapsibles && metadata.tableCount > 2) {
    return StructureType.COLLAPSIBLE_SECTIONS;
  }

  if (metadata.hasGallery && metadata.hasVolumes) {
    return StructureType.GALLERY_BASED;
  }

  if (metadata.tableCount > 0 && hasStructuredTables($)) {
    return StructureType.TABLE_BASED;
  }

  if ($('dl').length > 0 && hasDefinitionListStructure($)) {
    return StructureType.DEFINITION_LIST;
  }

  if ($('.category-page, #mw-pages').length > 0) {
    return StructureType.CATEGORY_PAGE;
  }

  if (metadata.tableCount > 0 && metadata.listCount > 0) {
    return StructureType.HYBRID;
  }

  return StructureType.UNKNOWN;
}

// ============================================================================
// Dynamic Selector Generation
// ============================================================================

/**
 * Generate dynamic selectors based on structure type for content extraction
 */
export function generateDynamicSelectors(
  $: CheerioAPI,
  type: StructureType,
  metadata: StructureMetadata
): DynamicSelectors {
  const selectors: DynamicSelectors = {
    content: [] as SelectorStrategy[],
    fallbacks: [] as SelectorStrategy[],
    contextual: new Map<string, SelectorStrategy[]>()
  };

  switch (type) {
    case StructureType.TABLE_BASED:
      selectors.content = generateTableSelectors($);
      break;
    case StructureType.TABBED_INTERFACE:
      selectors.content = generateTabbedSelectors($);
      break;
    case StructureType.DEFINITION_LIST:
      selectors.content = generateDefinitionListSelectors($);
      break;
    case StructureType.GALLERY_BASED:
      selectors.content = generateGallerySelectors($);
      break;
    case StructureType.COLLAPSIBLE_SECTIONS:
      selectors.content = generateCollapsibleSelectors($);
      break;
    case StructureType.CATEGORY_PAGE:
      selectors.content = generateCategorySelectors($);
      break;
    default:
      selectors.content = generateGenericSelectors($);
  }

  // Always add fallback selectors
  selectors.fallbacks = generateFallbackSelectors($);

  // Add contextual selectors for specific content types
  if (metadata.hasVolumes) {
    selectors.contextual.set('volumes', generateVolumeSelectors($));
  }

  if (metadata.hasChapters) {
    selectors.contextual.set('chapters', generateChapterSelectors($));
  }

  return selectors;
}

// ============================================================================
// Content Pattern Detection
// ============================================================================

/**
 * Detect content patterns for extracting volumes, chapters, dates, numbers, and links
 */
export function detectContentPatterns(_$: CheerioAPI): ContentPatterns {
  return {
    volumePattern: /Volume\s*(\d+)|Vol\.\s*(\d+)/gi,
    chapterPattern: /Chapter\s*(\d+(?:\.\d+)?)|Ch\.\s*(\d+(?:\.\d+)?)/gi,
    datePattern: /(\d{4}[-/]\d{1,2}[-/]\d{1,2})|(\w+\s+\d{1,2},?\s+\d{4})/gi,
    numberPattern: /\d+(?:\.\d+)?/g,
    linkPattern: /https?:\/\/[^\s]+/gi
  };
}
