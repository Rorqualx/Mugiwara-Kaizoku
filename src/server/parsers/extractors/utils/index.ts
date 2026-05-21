/**
 * Shared Extraction Utilities
 * 
 * Common utility functions used across all extractors to eliminate duplication.
 * These utilities provide consistent parsing logic for volumes, chapters, and metadata.
 */
import * as _cheerio from 'cheerio';

import { cleanImageUrl, resolveUrl } from '@/server/utils/image-processing';
import { logger } from '@/utils/logger';

import type { CheerioAPI, Cheerio } from 'cheerio';
import type { AnyNode } from 'domhandler';
// ============================================================================
// Type Definitions
// ============================================================================
export interface ExtractedVolume {
  volumeNumber: number;
  title?: string;
  coverImage?: string;
  isbn?: string;
  releaseDate?: string;
  pageCount?: number;
  chapters?: ExtractedChapter[];
}
export interface ExtractedChapter {
  chapterNumber: string;
  title?: string;
  volumeNumber?: number;
  releaseDate?: string;
  url?: string;
  pageCount?: number;
}
export interface ExtractionContext {
  source?: 'fandom' | 'wikipedia' | 'mangadex' | 'anilist' | 'comicvine';
  language?: string;
  baseUrl?: string;
}
// ============================================================================
// Volume Extraction Utilities
// ============================================================================
/**
 * Extract volume number from text using various patterns
 */
export function extractVolumeNumber(text: string): number | null {
  if (!text) return null;
  // Common volume patterns
  const patterns = [
    /Volume\s+(\d+(?:\.\d+)?)/i,
    /Vol\.?\s*(\d+(?:\.\d+)?)/i,
    /Tome\s+(\d+)/i,
    /Tomo\s+(\d+)/i,
    /Band\s+(\d+)/i,
    /Book\s+(\d+)/i,
    /Part\s+(\d+)/i,
    /\bV(\d+)\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return parseFloat(match[1]);
    }
  }
  // Check for standalone number in volume context
  const standaloneMatch = text.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
  if (standaloneMatch?.[1]) {
    return parseFloat(standaloneMatch[1]);
  }
  return null;
}
/**
 * Parse volume from table row or element
 */
export function parseVolumeFromElement(
  $: CheerioAPI,
  element: Cheerio<AnyNode>,
  context: ExtractionContext = {}
): ExtractedVolume | null {
  try {
    const text = element.text().trim();
    const volumeNumber = extractVolumeNumber(text);
    // Use explicit null check to allow Volume 0 (for prequels like JJK 0)
    if (volumeNumber === null) return null;
    const volume: ExtractedVolume = {
      volumeNumber
    };
    // Extract title
    const titleElement = element.find('[class*="title"], h3, h4, strong').first();
    if (titleElement.length) {
      volume["title"] = titleElement.text().trim();
    }
    // Extract cover image
    const imgElement = element.find('img').first();
    if (imgElement.length) {
      volume.coverImage = cleanImageUrl(imgElement.attr('src'), context.baseUrl);
    }
    // Extract ISBN
    const isbnMatch = text.match(/ISBN[:\s]*([\d-]+)/i);
    if (isbnMatch?.[1] !== undefined) {
      volume.isbn = isbnMatch[1];
    }
    // Extract release date
    const dateMatch = text.match(/\b(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\w+\s+\d{1,2},?\s+\d{4})\b/);
    if (dateMatch?.[1] !== undefined) {
      volume.releaseDate = dateMatch[1];
    }
    return volume;
  } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('Error parsing volume from element:', errorMessage);
    return null;
  }
}
// ============================================================================
// Chapter Extraction Utilities
// ============================================================================
/**
 * Extract chapter number from text using various patterns
 */
export function extractChapterNumber(text: string): string | null {
  if (!text) return null;
  // Common chapter patterns
  const patterns = [
    /Chapter\s+(\d+(?:\.\d+)?)/i,
    /Ch\.?\s*(\d+(?:\.\d+)?)/i,
    /Episode\s+(\d+(?:\.\d+)?)/i,
    /Ep\.?\s*(\d+(?:\.\d+)?)/i,
    /C(\d+(?:\.\d+)?)\b/i,
    /#\s*(\d+(?:\.\d+)?)/,
    /No\.?\s*(\d+(?:\.\d+)?)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1] !== undefined) {
      return match[1];
    }
  }
  // Check for chapter ranges
  const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch?.[1] !== undefined && rangeMatch[2] !== undefined) {
    return `${rangeMatch[1]}-${rangeMatch[2]}`;
  }
  // Check for standalone number in chapter context
  const standaloneMatch = text.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
  if (standaloneMatch?.[1] !== undefined) {
    return standaloneMatch[1];
  }
  return null;
}
/**
 * Parse chapter from table row or element
 */
export function parseChapterFromElement(
  $: CheerioAPI,
  element: Cheerio<AnyNode>,
  context: ExtractionContext = {}
): ExtractedChapter | null {
  try {
    const text = element.text().trim();
    const chapterNumber = extractChapterNumber(text);
    if (!chapterNumber) return null;
    const chapter: ExtractedChapter = {
      chapterNumber
    };
    // Extract title
    const titleElement = element.find('[class*="title"], a[href*="chapter"], strong').first();
    if (titleElement.length) {
      const title = titleElement.text().trim();
      // Remove chapter number from title if present
      chapter["title"] = title.replace(/^(Chapter|Ch\.?)\s*\d+[\s:.-]*/, '').trim();
    }
    // Extract URL
    const linkElement = element.find('a[href]').first();
    const href = linkElement.attr('href');
    if (linkElement.length && href !== undefined) {
      chapter.url = resolveUrl(href, context.baseUrl);
    }
    // Extract volume number if present
    const volumeMatch = text.match(/Volume\s+(\d+)/i);
    if (volumeMatch?.[1]) {
      chapter.volumeNumber = parseInt(volumeMatch[1], 10);
    }
    // Extract release date
    const dateMatch = text.match(/\b(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\w+\s+\d{1,2},?\s+\d{4})\b/);
    if (dateMatch?.[1] !== undefined) {
      chapter.releaseDate = dateMatch[1];
    }
    return chapter;
  } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('Error parsing chapter from element:', errorMessage);
    return null;
  }
}
// ============================================================================
// Table Parsing Utilities
// ============================================================================
/**
 * Detect if a table contains volume information
 */
export function isVolumeTable($: CheerioAPI, table: Cheerio<AnyNode>): boolean {
  const headerText = table.find('thead, tr:first-child').text().toLowerCase();
  const volumeKeywords = ['volume', 'vol', 'tome', 'tomo', 'band', 'book'];
  return volumeKeywords.some(keyword => headerText.includes(keyword));
}
/**
 * Detect if a table contains chapter information
 */
export function isChapterTable($: CheerioAPI, table: Cheerio<AnyNode>): boolean {
  const headerText = table.find('thead, tr:first-child').text().toLowerCase();
  const chapterKeywords = ['chapter', 'ch', 'episode', 'ep', 'chapitre'];
  return chapterKeywords.some(keyword => headerText.includes(keyword));
}
/**
 * Extract volumes from a table
 */
export function extractVolumesFromTable(
  $: CheerioAPI,
  table: Cheerio<AnyNode>,
  context: ExtractionContext = {}
): ExtractedVolume[] {
  const volumes: ExtractedVolume[] = [];
  table.find('tbody tr, tr').each((_, row) => {
    const volume = parseVolumeFromElement($, $(row), context);
    if (volume) {
      volumes.push(volume);
    }
  });
  return volumes;
}
/**
 * Extract chapters from a table
 */
export function extractChaptersFromTable(
  $: CheerioAPI,
  table: Cheerio<AnyNode>,
  context: ExtractionContext = {}
): ExtractedChapter[] {
  const chapters: ExtractedChapter[] = [];
  table.find('tbody tr, tr').each((_, row) => {
    const chapter = parseChapterFromElement($, $(row), context);
    if (chapter) {
      chapters.push(chapter);
    }
  });
  return chapters;
}
// ============================================================================
// Image Utilities
// ============================================================================
// Image URL cleaning is now handled by the unified image-processing module
// Re-exported here for backward compatibility
export { cleanImageUrl } from '@/server/utils/image-processing';
/**
 * Extract all images from an element
 */
export function extractImages(
  $: CheerioAPI,
  container: Cheerio<AnyNode>,
  context: ExtractionContext = {}
): string[] {
  const images: string[] = [];
  container.find('img').each((_, img) => {
    const src = $(img).attr('src') ?? $(img).attr('data-src');
    if (src) {
      const cleanUrl = cleanImageUrl(src, context.baseUrl);
      if (cleanUrl && !images.includes(cleanUrl)) {
        images.push(cleanUrl);
      }
    }
  });
  return images;
}
// ============================================================================
// URL Utilities
// ============================================================================
// URL resolution is now handled by the unified image-processing module
// Re-exported here for backward compatibility
export { resolveUrl } from '@/server/utils/image-processing';
// ============================================================================
// Text Cleaning Utilities
// ============================================================================
/**
 * Clean and normalize text
 */
export function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\t+/g, ' ')
    .replace(/\[.*?\]/g, '') // Remove citations
    .replace(/\(.*?\)/g, '') // Remove parenthetical notes
    .trim();
}
/**
 * Extract clean title from text
 */
export function extractTitle(text: string): string {
  // Remove common prefixes
  const cleaned = text
    .replace(/^(Volume|Vol\.?|Chapter|Ch\.?|Episode|Ep\.?)\s*\d+[\s:.-]*/i, '')
    .replace(/^(Part|Book|Tome|Tomo)\s*\d+[\s:.-]*/i, '')
    .trim();
  // Remove quotes if present
  return cleaned.replace(/^["']|["']$/g, '');
}
// ============================================================================
// Export All Utilities
// ============================================================================
export default {
  // Volume utilities
  extractVolumeNumber,
  parseVolumeFromElement,
  extractVolumesFromTable,
  isVolumeTable,
  // Chapter utilities
  extractChapterNumber,
  parseChapterFromElement,
  extractChaptersFromTable,
  isChapterTable,
  // Image utilities
  cleanImageUrl,
  extractImages,
  // URL utilities
  resolveUrl,
  // Text utilities
  cleanText,
  extractTitle
};