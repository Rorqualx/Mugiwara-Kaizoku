/**
 * Dynamic Wiki Parser - Utilities Module
 *
 * Helper functions for image extraction, caching, content detection,
 * and confidence calculation used across extraction modules.
 *
 * Extracted from: DynamicWikiParser.ts
 */

import {
  StructureType,
  type StructureMetadata,
  type DynamicSelectors,
} from './types';

import type { CheerioAPI, Cheerio } from 'cheerio';
import type { AnyNode } from 'domhandler';


// ============================================================================
// Image Extraction
// ============================================================================

/**
 * Extract image URL from an img element
 */
export function extractImageUrl(img: Cheerio<AnyNode>): string | undefined {
  if (!img.length) return undefined;
  
  let url = img.attr('src') ?? img.attr('data-src') ?? img.attr('data-image-key');

  if (url) {
    // Handle protocol-relative URLs
    if (url.startsWith('//')) {
      url = 'https:' + url;
    }

    // Handle data URIs (skip them)
    if (url.startsWith('data:')) {
      // Try to get the actual image URL from data attributes
      const actualUrl = img.attr('data-src') ?? img.parent().attr('href');
      if (actualUrl && !actualUrl.startsWith('data:')) {
        url = actualUrl;
      } else {
        return undefined;
      }
    }
    
    // Handle Fandom image URLs
    if (url.includes('/revision/latest')) {
      // Get higher quality version
      url = url.replace(/\/scale-to-width-down\/\d+/, '');
    }
  }
  
  return url;
}

// ============================================================================
// Caching
// ============================================================================

/**
 * Generate cache key from URL
 */
export function getCacheKey(url: string): string {
  return url.replace(/[?#].*$/, '').toLowerCase();
}

// ============================================================================
// Table Helpers
// ============================================================================

/**
 * Extract data from a table row based on headers
 */
export function extractTableRow(
  $: CheerioAPI, 
  cells: Cheerio<AnyNode>, 
  headers: string[]
): unknown {
  const item: Record<string, unknown> = {};

  cells.each((index: number, cell: unknown) => {
    const $cell = $(cell as AnyNode);
    const header = headers[index]?.toLowerCase() ?? `col${index}`;

    // Extract links if present
    const link = $cell.find('a').first();
    if (link.length) {
      item[`${header}_link`] = link.attr('href');
      item[`${header}_text`] = link.text().trim();
    }

    item[header] = $cell.text().trim();
  });

  return item;
}

// ============================================================================
// Link Classification
// ============================================================================

/**
 * Classify a link based on URL and text content
 */
export function classifyLink(url: string, text: string): string {
  if (/volume/i.test(url) || /volume/i.test(text)) return 'volume';
  if (/chapter/i.test(url) || /chapter/i.test(text)) return 'chapter';
  if (/character/i.test(url) || /character/i.test(text)) return 'character';
  return 'unknown';
}

// ============================================================================
// Content Detection
// ============================================================================

/**
 * Check if page has volume-related content
 */
export function hasVolumeContent($: CheerioAPI): boolean {
  const content = $('#mw-content-text').text();
  return /volume|vol\./i.test(content);
}

/**
 * Check if page has chapter-related content
 */
export function hasChapterContent($: CheerioAPI): boolean {
  const content = $('#mw-content-text').text();
  return /chapter|ch\./i.test(content);
}

/**
 * Check if page has structured tables with headers
 */
export function hasStructuredTables($: CheerioAPI): boolean {
  const tables = $('table').not('.navbox, .infobox');
  return tables.filter((_, table) => {
    const $table = $(table);
    const rows = $table.find('tr').length;
    const hasHeaders = $table.find('th').length > 0;
    return rows > 3 && hasHeaders;
  }).length > 0;
}

/**
 * Check if page uses definition list structure
 */
export function hasDefinitionListStructure($: CheerioAPI): boolean {
  const dls = $('dl');
  return dls.filter((_, dl) => {
    const $dl = $(dl);
    return $dl.find('dt').length > 2 && $dl.find('dd').length > 2;
  }).length > 0;
}

// ============================================================================
// Confidence Calculation
// ============================================================================

/**
 * Calculate confidence score based on structure analysis
 */
export function calculateConfidence(
  type: StructureType, 
  metadata: StructureMetadata,
  selectors: DynamicSelectors
): number {
  let confidence = 0.5;
  
  // Boost confidence based on structure clarity
  if (type !== StructureType.UNKNOWN) confidence += 0.2;
  if (metadata.hasVolumes || metadata.hasChapters) confidence += 0.1;
  if (selectors.content.length > 0) confidence += 0.1;
  if (metadata.tableCount > 0 || metadata.listCount > 0) confidence += 0.1;
  
  return Math.min(1, confidence);
}
