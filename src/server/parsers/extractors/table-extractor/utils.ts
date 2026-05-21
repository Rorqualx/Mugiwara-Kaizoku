/**
 * Table Extractor - Utility Functions
 *
 * Shared helper functions for table extraction including
 * header parsing, image extraction, and data manipulation.
 *
 * Extracted from: TableExtractor.ts (lines 999-1367)
 */

import type { PatternLibrary } from '@/server/parsers/patterns/PatternLibrary';

import type {
  CheerioAPI,
  Cheerio,
  Element,
  VolumeInfo,
  ChapterInfo,
  TableData,
} from './types';

// ============================================================================
// Header Indices Type
// ============================================================================

/**
 * Mapping of header names to column indices
 */
export interface HeaderIndices {
  volume: number;
  title: number;
  chapter: number;
  chapterTitle: number;
  isbn: number;
  releaseDate: number;
  coverImage: number;
}

// ============================================================================
// Header Extraction
// ============================================================================

/**
 * Extract table headers from thead or first row
 */
export function extractHeaders(
  $: CheerioAPI,
  table: Element,
  patterns: PatternLibrary
): string[] {
  const headers: string[] = [];

  // Try thead first
  const $thead = $(table).find('thead');
  if ($thead.length > 0) {
    $thead.find('th, td').each((_, cell) => {
      headers.push($(cell).text().trim());
    });
  }

  // If no thead, try first row
  if (headers.length === 0) {
    $(table).find('tr:first-child').find('th, td').each((_, cell) => {
      const text = $(cell).text().trim();
      // Check if it looks like a header
      if (text && !patterns.match(text, 'volume') && !patterns.match(text, 'chapter')) {
        headers.push(text);
      }
    });
  }

  return headers;
}

/**
 * Map header names to column indices
 */
export function mapHeaderIndices(headers: string[]): HeaderIndices {
  const indices: HeaderIndices = {
    volume: -1,
    title: -1,
    chapter: -1,
    chapterTitle: -1,
    isbn: -1,
    releaseDate: -1,
    coverImage: -1
  };

  headers.forEach((header, index) => {
    if (/volume|vol\.?(?:\s|$)/i.test(header)) {
      indices.volume = index;
    } else if (/title|name/i.test(header) && indices.title === -1) {
      indices.title = index;
    } else if (/chapter|ch\.?(?:\s|$)|episode|ep\.?(?:\s|$)/i.test(header)) {
      indices.chapter = index;
    } else if (/chapter.*title|episode.*title/i.test(header)) {
      indices.chapterTitle = index;
    } else if (/isbn/i.test(header)) {
      indices.isbn = index;
    } else if (/date|release/i.test(header)) {
      indices.releaseDate = index;
    } else if (/cover|image/i.test(header)) {
      indices.coverImage = index;
    }
  });

  return indices;
}

// ============================================================================
// Table Validation
// ============================================================================

/**
 * Check if element is a valid table with manga content
 */
export function isValidTable($: CheerioAPI, table: Element): boolean {
  const $table = $(table);

  // Must have at least 2 rows
  if ($table.find('tr').length < 2) return false;

  // Must have some text content
  const text = $table.text();
  if (!text || text.trim().length < 10) return false;

  // Check for manga-related content
  const hasMangaContent = /volume|chapter|episode|arc|saga|tankMbon/i.test(text);

  return hasMangaContent;
}

/**
 * Check if element contains volume information
 */
export function containsVolumeInfo(
  $: CheerioAPI,
  element: Element,
  patterns: PatternLibrary
): boolean {
  const text = $(element).text();
  return patterns.match(text, 'volume') !== null;
}

/**
 * Check if element has structured data
 */
export function hasStructuredData($: CheerioAPI, element: Element): boolean {
  const $el = $(element);

  return $el.find('table').length > 0 ||
         $el.find('ul li').length > 5 ||
         $el.find('.gallery').length > 0 ||
         $el.find('[data-volume], [data-chapter]').length > 0;
}

/**
 * Check if element contains table data
 */
export function containsTableData($: CheerioAPI, element: Element): boolean {
  return $(element).find('table, .wikia-gallery, .gallery').length > 0;
}

// ============================================================================
// Image Extraction
// ============================================================================

/**
 * Clean image URL by removing thumbnail parameters and ensuring HTTPS
 */
export function cleanImageUrl(url: string): string {
  if (!url) return '';

  // Remove thumbnail parameters
  let cleanedUrl = url.replace(/\/revision\/latest.*/, '');
  cleanedUrl = cleanedUrl.replace(/\/scale-to-width-down\/\d+/, '');

  // Ensure HTTPS
  if (cleanedUrl.startsWith('//')) {
    cleanedUrl = 'https:' + cleanedUrl;
  }

  return cleanedUrl;
}

/**
 * Extract gallery image URL from an element
 */
export function extractGalleryImage($: CheerioAPI, item: Element): string {
  const $item = $(item);

  // Try multiple selectors
  const selectors = [
    'img',
    'a.image img',
    '.thumb img',
    '[data-src]',
    'noscript img'
  ];

  for (const selector of selectors) {
    const $img = $item.find(selector).first();
    if ($img.length > 0) {
      const url = $img.attr('src') ?? $img.attr('data-src') ?? $img.attr('data-original');
      if (url) {
        return cleanImageUrl(url);
      }
    }
  }

  // Try parent link
  const $link = $item.find('a[href*=".jpg"], a[href*=".png"], a[href*=".webp"]').first();
  if ($link.length > 0) {
    return cleanImageUrl($link.attr('href') ?? '');
  }

  return '';
}

/**
 * Extract image URL from a table cell
 */
export function extractCellImage($: CheerioAPI, cell: Element | undefined): string {
  if (!cell) return '';
  return extractGalleryImage($, cell);
}

// ============================================================================
// Chapter Parsing
// ============================================================================

/**
 * Parse chapter range string into individual chapter info objects
 */
export function parseChapterRange(
  range: string,
  volumeNumber: number,
  patterns: PatternLibrary
): ChapterInfo[] {
  const chapters: ChapterInfo[] = [];

  // Parse range like "1-10" or "1.5-10.5"
  const match = range.match(/([\d.]+)\s*[-\u2013]\s*([\d.]+)/);
  if (match?.[1] && match[2]) {
    const start = parseFloat(match[1]);
    const end = parseFloat(match[2]);

    for (let i = Math.floor(start); i <= Math.floor(end); i++) {
      chapters.push({
        chapterNumber: i.toString(),
        volumeNumber
      });
    }
  } else {
    // Single chapter
    const chapterMatch = patterns.match(range, 'chapter');
    if (chapterMatch) {
      chapters.push({
        chapterNumber: chapterMatch.value.toString(),
        volumeNumber
      });
    }
  }

  return chapters;
}

/**
 * Check if row is an arc header
 */
export function isArcHeader(
  $: CheerioAPI,
  row: Element,
  patterns: PatternLibrary
): boolean {
  const $row = $(row);

  // Check for arc indicators
  const text = $row.text().toLowerCase();
  const hasArcKeyword = /\barc\b|\bsaga\b|\bstory\b/.test(text);

  // Check for header-like styling
  const hasHeaderStyling = $row.find('th').length > 0 ||
                          ($row.attr('class') ?? '').includes('header') ||
                          $row.find('td[colspan]').length > 0;

  // Check if it's not a regular data row
  const lacksChapterNumber = patterns.match(text, 'chapter') === null;

  return hasArcKeyword && (hasHeaderStyling || lacksChapterNumber);
}

/**
 * Extract chapter information from a table row
 */
export function extractChapterFromRow(
  $: CheerioAPI,
  cells: Cheerio<Element>,
  patterns: PatternLibrary
): ChapterInfo | null {
  let chapterNumber: string | null = null;
  let title: string | null = null;

  // Look for chapter number in cells
  cells.each((_: number, cell: Element) => {
    const text = $(cell).text().trim();

    if (!chapterNumber) {
      const match = patterns.match(text, 'chapter');
      if (match) {
        chapterNumber = match.value.toString();
      }
    }

    // Extract title (usually in a different cell)
    if (chapterNumber && !title && text && !text.includes(chapterNumber)) {
      title = text;
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (chapterNumber !== null) {
    const chapter: ChapterInfo = {
      chapterNumber
    };
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (title !== null) {
      chapter.title = title;
    }
    return chapter;
  }

  return null;
}

/**
 * Extract chapters from any element (table or list)
 * Note: For table extraction, use the dedicated table extractor module
 */
export function extractChaptersFromElement(
  $: CheerioAPI,
  element: Element,
  patterns: PatternLibrary
): ChapterInfo[] {
  const chapters: ChapterInfo[] = [];

  // Try list extraction (table extraction should be handled by dedicated module)
  $(element).find('li, .chapter-item').each((_, item) => {
    const text = $(item).text();
    const chapterMatch = patterns.match(text, 'chapter');

    if (chapterMatch) {
      const titleText = text.replace(/Chapter\s+[\d.]+:?\s*/i, '').trim();
      const chapter: ChapterInfo = {
        chapterNumber: chapterMatch.value.toString()
      };
      if (titleText) {
        chapter.title = titleText;
      }
      chapters.push(chapter);
    }
  });

  return chapters;
}

// ============================================================================
// Table Merging
// ============================================================================

/**
 * Check if two tables are related (one has volumes, other has chapters)
 */
export function areTablesRelated(table1: TableData, table2: TableData): boolean {
  // Check if one has volumes and other has chapters
  if ((table1.type === 'volume' && table2.type === 'chapter') ||
      (table1.type === 'chapter' && table2.type === 'volume')) {
    return true;
  }

  return false;
}

/**
 * Assign chapters to their respective volumes based on volume number
 */
export function assignChaptersToVolumes(
  volumes: VolumeInfo[],
  chapters: ChapterInfo[]
): void {
  for (const chapter of chapters) {
    if (chapter.volumeNumber) {
      const volume = volumes.find(v => v.volumeNumber === chapter.volumeNumber);
      if (volume) {
        volume.chapters.push(chapter);
      }
    }
  }
}

/**
 * Merge related tables (e.g., volume table with chapter table)
 */
export function mergeRelatedTables(tables: TableData[]): TableData[] {
  const merged: TableData[] = [];
  const used = new Set<number>();

  for (let i = 0; i < tables.length; i++) {
    if (used.has(i)) continue;

    const current = tables[i];
    if (!current) continue;

    // Look for related tables
    for (let j = i + 1; j < tables.length; j++) {
      if (used.has(j)) continue;

      const other = tables[j];
      if (!other) continue;

      // Check if tables are related
      if (areTablesRelated(current, other)) {
        // Merge tables
        if (current.volumes && other.chapters) {
          // Assign chapters to volumes
          assignChaptersToVolumes(current.volumes, other.chapters);
        } else if (current.chapters && other.volumes) {
          // Assign chapters to volumes
          assignChaptersToVolumes(other.volumes, current.chapters);
          current.volumes = other.volumes;
        }

        used.add(j);
      }
    }

    merged.push(current);
    used.add(i);
  }

  return merged;
}
