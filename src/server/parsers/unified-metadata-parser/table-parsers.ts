/**
 * Table Parsers
 *
 * Functions for parsing volume/chapter tables and galleries from HTML.
 * Consolidates source-specific methods into unified parsers.
 *
 * Extracted from: UnifiedMetadataParser.ts (lines 642-804)
 * Deduplicated: parseWikipediaTables and parseGenericTables -> parseTables
 */

import { processVolumeRow, processChapterRow, findColumnIndices } from './table-row-processors';

import type { VolumeInfo, ChapterInfo, TableData, ParsedContent } from './types';
import type { CheerioAPI, Cheerio } from 'cheerio';
import type { AnyNode } from 'domhandler';


// ============================================================================
// Local Pattern Library (minimal patterns needed for table/gallery parsing)
// ============================================================================

const VOLUME_PATTERNS: RegExp[] = [
  /Volume\s+(\d+\.?\d*)/i,
  /Vol\.?\s*(\d+)/i,
  /Tome\s+(\d+)/i,
  /第(\d+)巻/,
];

/**
 * Match volume number from text
 */
function matchVolumeNumber(text: string): number | null {
  for (const pattern of VOLUME_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return parseInt(match[1], 10);
  }
  return null;
}

// ============================================================================
// Local Extraction Utilities (minimal utilities needed for table/gallery parsing)
// ============================================================================

/**
 * Clean wiki markup and HTML from text
 */
function cleanText(text: string | undefined): string {
  if (!text) return '';

  return text
    // Remove wiki links [[Link|Text]] -> Text
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    // Remove templates {{template}}
    .replace(/\{\{[^}]+\}\}/g, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, '')
    // Remove bold/italic markup
    .replace(/'{2,}/g, '')
    // Clean whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clean and normalize image URLs
 */
function cleanImageUrl(url: string | undefined): string {
  if (!url) return '';

  let cleanedUrl = url;

  // Remove query parameters that affect image size
  cleanedUrl = cleanedUrl.replace(/\/revision\/latest.*/, '');
  cleanedUrl = cleanedUrl.replace(/\/scale-to-width-down\/\d+/, '');
  cleanedUrl = cleanedUrl.replace(/\?cb=\d+/, '');

  // Handle thumbnail URLs
  if (cleanedUrl.includes('/thumb/')) {
    // Extract original from thumbnail URL
    const parts = cleanedUrl.split('/');
    const filename = parts[parts.length - 1];
    if (filename?.match(/^\d+px-/)) {
      parts.pop(); // Remove thumbnail filename
      cleanedUrl = parts.join('/');
    }
  }

  // Ensure HTTPS
  cleanedUrl = cleanedUrl.replace(/^http:/, 'https:');

  // Handle protocol-relative URLs
  if (cleanedUrl.startsWith('//')) {
    cleanedUrl = 'https:' + cleanedUrl;
  }

  return cleanedUrl;
}

/**
 * Extract image URL with multiple fallback attributes
 */
function extractImageUrl($: CheerioAPI, element: AnyNode | Cheerio<AnyNode>, selectors: string[]): string {
  for (const selector of selectors) {
    const $img = $(element).find(selector).first();
    if ($img.length === 0) continue;

    // Try multiple attributes
    const attrs = ['src', 'data-src', 'data-original', 'data-image-url', 'data-lazy-src'];
    for (const attr of attrs) {
      const url = $img.attr(attr);
      if (url) return cleanImageUrl(url);
    }

    // Try parent link
    const parentLink = $img.parent('a').attr('href');
    if (parentLink && /\.(jpg|jpeg|png|gif|webp)/i.test(parentLink)) {
      return cleanImageUrl(parentLink);
    }
  }
  return '';
}

// ============================================================================
// Table Header Extraction
// ============================================================================

/**
 * Extract table headers from a table element
 *
 * @param $ - Cheerio API instance
 * @param $table - Cheerio table element
 * @returns Array of header strings
 */
export function extractTableHeaders($: CheerioAPI, $table: Cheerio<AnyNode>): string[] {
  const headers: string[] = [];

  // Try thead first
  $table.find('thead th, thead td').each((_: number, cell: AnyNode) => {
    headers.push(cleanText($(cell).text()));
  });

  // If no thead, try first row
  if (headers.length === 0) {
    $table.find('tr:first-child th, tr:first-child td').each((_: number, cell: AnyNode) => {
      headers.push(cleanText($(cell).text()));
    });
  }

  return headers;
}

// ============================================================================
// Structured Table Parsing
// ============================================================================

/**
 * Parse a structured table into TableData format
 *
 * @param $ - Cheerio API instance
 * @param $table - Cheerio table element
 * @returns Parsed TableData with type, headers, and rows
 */
export function parseStructuredTable($: CheerioAPI, $table: Cheerio<AnyNode>): TableData {
  const headers = extractTableHeaders($, $table);
  const rows: string[][] = [];

  $table.find('tr').each((index: number, row: AnyNode) => {
    if (index === 0 && headers.length > 0) return; // Skip header row

    const cells: string[] = [];
    $(row).find('td, th').each((_: number, cell: AnyNode) => {
      cells.push(cleanText($(cell).text()));
    });

    if (cells.length > 0) {
      rows.push(cells);
    }
  });

  // Determine table type
  let type: TableData['type'] = 'generic';
  if (headers.some(h => /volume/i.test(h))) type = 'volume';
  else if (headers.some(h => /chapter/i.test(h))) type = 'chapter';

  return { type, headers, rows };
}

// ============================================================================
// Volume/Chapter Extraction from Tables
// ============================================================================

/**
 * Extract volume information from a table
 *
 * @param $ - Cheerio API instance
 * @param $table - Cheerio table element
 * @param volumes - Array to append extracted volumes to
 */
export function extractVolumesFromTable(
  $: CheerioAPI,
  $table: Cheerio<AnyNode>,
  volumes: VolumeInfo[]
): void {
  const headers = extractTableHeaders($, $table);
  const indices = findColumnIndices(headers);

  $table.find('tr').each((index: number, row: AnyNode) => {
    if (index === 0) return; // Skip header

    const cells = $(row).find('td, th').map((_: number, cell: AnyNode) =>
      cleanText($(cell).text())
    ).get();

    const volume = processVolumeRow(cells, indices);
    if (volume) volumes.push(volume);
  });
}

/**
 * Extract chapter information from a table
 *
 * @param $ - Cheerio API instance
 * @param $table - Cheerio table element
 * @param chapters - Array to append extracted chapters to
 */
export function extractChaptersFromTable(
  $: CheerioAPI,
  $table: Cheerio<AnyNode>,
  chapters: ChapterInfo[]
): void {
  const headers = extractTableHeaders($, $table);
  const indices = findColumnIndices(headers);

  $table.find('tr').each((index: number, row: AnyNode) => {
    if (index === 0) return; // Skip header

    const cells = $(row).find('td, th').map((_: number, cell: AnyNode) =>
      cleanText($(cell).text())
    ).get();

    const chapter = processChapterRow(cells, indices);
    if (chapter) chapters.push(chapter);
  });
}

// ============================================================================
// Unified Table Parsing
// ============================================================================

/**
 * Parse all volume/chapter tables from a page
 *
 * This is a unified function that consolidates the former:
 * - parseFandomTables
 * - parseWikipediaTables
 * - parseGenericTables
 *
 * All three methods had identical logic, so they've been deduplicated.
 *
 * @param $ - Cheerio API instance
 * @param result - ParsedContent to append extracted data to
 */
export function parseTables($: CheerioAPI, result: ParsedContent): void {
  $('table').each((_, table) => {
    const $table = $(table);

    // Skip small tables
    if ($table.find('tr').length < 3) return;

    // Check if it's a volume/chapter table
    const headers = extractTableHeaders($, $table);
    const isVolumeTable = headers.some(h => /volume/i.test(h));
    const isChapterTable = headers.some(h => /chapter/i.test(h));

    if (isVolumeTable || isChapterTable) {
      const data = parseStructuredTable($, $table);
      result.tables.push(data);

      // Extract volumes/chapters from table
      if (isVolumeTable) {
        extractVolumesFromTable($, $table, result.volumes);
      }
      if (isChapterTable) {
        extractChaptersFromTable($, $table, result.chapters);
      }
    }
  });
}

// ============================================================================
// Gallery Parsing
// ============================================================================

/**
 * Parse volume galleries (Fandom-style)
 *
 * Extracts volume information from gallery elements including cover images.
 *
 * @param $ - Cheerio API instance
 * @param result - ParsedContent to append extracted data to
 */
export function parseGalleries($: CheerioAPI, result: ParsedContent): void {
  $('.wikia-gallery, .gallery').each((_, gallery) => {
    const $gallery = $(gallery);

    $gallery.find('.wikia-gallery-item, .gallerybox').each((_, item) => {
      const $item = $(item);
      const caption = cleanText($item.find('.lightbox-caption, .gallerytext').text());

      // Check if it's a volume
      const volumeNum = matchVolumeNumber(caption);
      if (volumeNum !== null) {
        const imageUrl = extractImageUrl($, item, ['img']);

        // Find or create volume
        let volume = result.volumes.find(v => v.volumeNumber === volumeNum);
        if (!volume) {
          volume = {
            volumeNumber: volumeNum,
            title: caption,
            chapters: []
          };
          result.volumes.push(volume);
        }

        if (imageUrl && !volume.coverImage) {
          volume.coverImage = imageUrl;
        }
      }
    });
  });
}
