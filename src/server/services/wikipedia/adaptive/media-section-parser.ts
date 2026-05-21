/**
 * Wikipedia Media Section Parser
 *
 * Extracts manga volume/chapter data from Media, Manga, and Publication
 * sections within main Wikipedia articles. Handles cases where there's
 * no dedicated "List of X chapters" page.
 *
 * @module wikipedia/adaptive/media-section-parser
 */

import * as cheerio from 'cheerio';

import type { MediaSectionData, PublicationInfo } from './types';
import type { WikipediaVolume, WikipediaChapter } from '../wikipedia/types';
import type { AnyNode, Element } from 'domhandler';

// ============================================================================
// Constants
// ============================================================================

/** Section IDs to look for manga data */
const MANGA_SECTION_IDS = ['Manga', 'Media', 'Publication', 'Volumes', 'Chapters', 'Written_works'];

/** Patterns for extracting volume counts */
const VOLUME_COUNT_PATTERNS = [
  /(\d+)\s*(?:tank[oō]bon|volumes?)/i,
  /volumes?[:\s]+(\d+)/i,
  /(\d+)\s*volumes?\s*(?:released|published)/i,
];

/** Patterns for extracting chapter counts */
const CHAPTER_COUNT_PATTERNS = [
  /(\d+)\s*chapters?/i,
  /chapters?[:\s]+(\d+)/i,
  /(\d+)\s*chapters?\s*(?:released|published)/i,
];

/** Patterns for publication status */
const STATUS_PATTERNS: { pattern: RegExp; status: string }[] = [
  { pattern: /\b(?:ongoing|serializing|currently\s+running)\b/i, status: 'Ongoing' },
  { pattern: /\b(?:finished|completed|ended|concluded)\b/i, status: 'Finished' },
  { pattern: /\b(?:hiatus|on\s+hold|suspended)\b/i, status: 'Hiatus' },
  { pattern: /\b(?:cancelled|discontinued|canceled)\b/i, status: 'Cancelled' },
];

// ============================================================================
// Main Parsing Functions
// ============================================================================

/**
 * Extract manga data from Media/Manga sections.
 */
export function parseMediaSection(html: string): MediaSectionData {
  const $ = cheerio.load(html);

  const section = findMangaSection($);
  if (!section) {
    return createEmptyMediaSectionData();
  }

  const rawText = section.text();
  const publicationInfo = extractPublicationInfo(section, $);
  const volumes = parseInlineVolumeTable(section, $);
  const chapters = parseInlineChapterData(section, $);

  return {
    volumeCount: publicationInfo.volumes,
    chapterCount: publicationInfo.chapters,
    startDate: publicationInfo.startDate,
    endDate: publicationInfo.endDate,
    publisher: publicationInfo.publisher,
    magazine: publicationInfo.magazine,
    status: publicationInfo.status,
    volumes,
    chapters,
    rawText: rawText.substring(0, 1000),
  };
}

/**
 * Find the manga/media section in the page.
 */
export function findMangaSection($: cheerio.CheerioAPI): cheerio.Cheerio<Element> | null {
  for (const sectionId of MANGA_SECTION_IDS) {
    const $headline = $(`#${sectionId}, .mw-headline#${sectionId}`);
    if ($headline.length === 0) continue;

    const sectionContent = collectSectionContent($, $headline);
    if (sectionContent) return sectionContent;
  }

  // Try to find by text content
  const textMatch = findSectionByText($);
  if (textMatch) return textMatch;

  return null;
}

/**
 * Find section by text content in headers.
 */
function findSectionByText($: cheerio.CheerioAPI): cheerio.Cheerio<Element> | null {
  let found: cheerio.Cheerio<Element> | null = null;

  $('h2 .mw-headline, h3 .mw-headline').each((_, el) => {
    if (found) return;
    const text = $(el).text().toLowerCase();
    if (text === 'manga' || text === 'media' || text.includes('publication')) {
      const content = collectSectionContent($, $(el));
      if (content) found = content;
    }
  });

  return found;
}

/**
 * Collect content for a section.
 */
function collectSectionContent(
  $: cheerio.CheerioAPI,
  $headline: cheerio.Cheerio<AnyNode>
): cheerio.Cheerio<Element> | null {
  const $header = $headline.closest('h2, h3');
  if ($header.length === 0) return null;

  const elements: string[] = [];
  let $current = $header.next();
  const headerLevel = $header.prop('tagName');

  while ($current.length > 0) {
    const tagName = $current.prop('tagName') ?? '';
    if (shouldStopCollection(headerLevel ?? '', tagName)) break;

    const htmlContent = $.html($current);
    if (htmlContent) elements.push(htmlContent);
    $current = $current.next();
  }

  if (elements.length === 0) return null;

  const wrapper = cheerio.load(`<div class="section-content">${elements.join('')}</div>`);
  return wrapper('.section-content') as cheerio.Cheerio<Element>;
}

/**
 * Check if we should stop collecting section content.
 */
function shouldStopCollection(headerLevel: string, tagName: string): boolean {
  if (headerLevel === 'H2' && tagName === 'H2') return true;
  if (headerLevel === 'H3' && (tagName === 'H2' || tagName === 'H3')) return true;
  return false;
}

// ============================================================================
// Publication Info Extraction
// ============================================================================

/**
 * Extract publication information from section.
 */
function extractPublicationInfo(
  section: cheerio.Cheerio<Element>,
  $: cheerio.CheerioAPI
): PublicationInfo {
  const text = section.text();

  return {
    volumes: extractVolumeCount(text),
    chapters: extractChapterCount(text),
    startDate: extractStartDate(section),
    endDate: extractEndDate(section),
    publisher: extractPublisher(section, $),
    magazine: extractMagazine(section, $),
    demographic: extractDemographic(text),
    status: extractStatus(text),
  };
}

/**
 * Extract volume count from text.
 */
export function extractVolumeCount(text: string): number | null {
  for (const pattern of VOLUME_COUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const count = parseInt(match[1], 10);
      if (!isNaN(count) && count > 0 && count < 1000) return count;
    }
  }
  return null;
}

/**
 * Extract chapter count from text.
 */
export function extractChapterCount(text: string): number | null {
  for (const pattern of CHAPTER_COUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const count = parseInt(match[1], 10);
      if (!isNaN(count) && count > 0 && count < 10000) return count;
    }
  }
  return null;
}

/**
 * Extract start date.
 */
function extractStartDate(section: cheerio.Cheerio<Element>): string | null {
  const text = section.text();

  const patterns = [
    /(?:began|started|serialized?)\s*(?:on|in|from)?\s*(\w+\s+\d{1,2},?\s+\d{4})/i,
    /(\w+\s+\d{4})\s*[–-]\s*(?:\w+\s+\d{4}|present)/i,
    /(\d{4})\s*[–-]\s*(?:\d{4}|present)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return null;
}

/**
 * Extract end date.
 */
function extractEndDate(section: cheerio.Cheerio<Element>): string | null {
  const text = section.text();

  if (/present|ongoing/i.test(text)) return null;

  const patterns = [
    /(?:ended|finished|concluded)\s*(?:on|in)?\s*(\w+\s+\d{1,2},?\s+\d{4})/i,
    /\w+\s+\d{4}\s*[–-]\s*(\w+\s+\d{4})/i,
    /\d{4}\s*[–-]\s*(\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return null;
}

/**
 * Extract publisher.
 */
function extractPublisher(
  section: cheerio.Cheerio<Element>,
  _$: cheerio.CheerioAPI
): string | null {
  const publisherLink = section.find('a[href*="publisher"], a[href*="Shueisha"], a[href*="Kodansha"]');
  if (publisherLink.length > 0) return publisherLink.first().text().trim();

  const text = section.text();
  const match = text.match(/(?:published|publisher)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (match?.[1]) return match[1].trim();

  return null;
}

/**
 * Extract magazine.
 */
function extractMagazine(
  section: cheerio.Cheerio<Element>,
  _$: cheerio.CheerioAPI
): string | null {
  const magazineLink = section.find('a[href*="magazine"], a[href*="Weekly"], a[href*="Monthly"]');
  if (magazineLink.length > 0) return magazineLink.first().text().trim();

  const text = section.text();
  const match = text.match(/(?:serialized?\s+in|magazine)[:\s]+([^,\n]+)/i);
  if (match?.[1]) return match[1].trim();

  return null;
}

/**
 * Extract demographic.
 */
function extractDemographic(text: string): string | null {
  const demographics = ['shōnen', 'shounen', 'shonen', 'seinen', 'shōjo', 'shoujo', 'josei'];
  const lowerText = text.toLowerCase();

  for (const demo of demographics) {
    if (lowerText.includes(demo)) {
      return demo.charAt(0).toUpperCase() + demo.slice(1);
    }
  }

  return null;
}

/**
 * Extract publication status.
 */
function extractStatus(text: string): string | null {
  for (const { pattern, status } of STATUS_PATTERNS) {
    if (pattern.test(text)) return status;
  }
  return null;
}

// ============================================================================
// Volume/Chapter Table Parsing
// ============================================================================

/**
 * Parse inline volume tables from section.
 */
function parseInlineVolumeTable(
  section: cheerio.Cheerio<Element>,
  $: cheerio.CheerioAPI
): WikipediaVolume[] {
  const volumes: WikipediaVolume[] = [];
  const tables = section.find('table.wikitable');

  if (tables.length === 0) return volumes;

  tables.each((_, table) => {
    const parsedVolumes = parseVolumeTableRows($(table), $);
    volumes.push(...parsedVolumes);
  });

  return volumes;
}

/**
 * Parse volume rows from a table.
 */
function parseVolumeTableRows(
  $table: cheerio.Cheerio<Element>,
  $: cheerio.CheerioAPI
): WikipediaVolume[] {
  const volumes: WikipediaVolume[] = [];
  const headers = extractTableHeaders($table, $);

  $table.find('tr').slice(1).each((_, row) => {
    const volume = parseVolumeRow($(row), headers, $);
    if (volume) volumes.push(volume);
  });

  return volumes;
}

/**
 * Extract table headers.
 */
function extractTableHeaders(
  $table: cheerio.Cheerio<Element>,
  $: cheerio.CheerioAPI
): string[] {
  const headers: string[] = [];
  $table.find('tr').first().find('th').each((_, th) => {
    headers.push($(th).text().trim().toLowerCase());
  });
  return headers;
}

/**
 * Parse a single volume row.
 */
function parseVolumeRow(
  $row: cheerio.Cheerio<Element>,
  headers: string[],
  $: cheerio.CheerioAPI
): WikipediaVolume | null {
  const cells = $row.find('td');
  if (cells.length === 0) return null;

  const numberIndex = findColumnIndex(headers, ['no', '#', 'vol', 'volume']);
  const cellIndex = numberIndex >= 0 ? numberIndex : 0;
  const numberText = cells.eq(cellIndex).text().trim();

  const volumeNumber = extractNumber(numberText);
  if (!volumeNumber) return null;

  const title = extractCellText(cells, headers, ['title', 'name'], $);
  const originalReleaseDate = extractCellText(cells, headers, ['release', 'date', 'published'], $);
  const isbn = extractCellText(cells, headers, ['isbn'], $);

  const volume: WikipediaVolume = {
    number: volumeNumber,
    chapters: [],
  };

  if (title) volume.title = title;
  if (originalReleaseDate) volume.originalReleaseDate = originalReleaseDate;
  if (isbn) volume.isbn = isbn;

  return volume;
}

/**
 * Find column index by possible header names.
 */
function findColumnIndex(headers: string[], possibleNames: string[]): number {
  for (const name of possibleNames) {
    const index = headers.findIndex(h => h.includes(name));
    if (index >= 0) return index;
  }
  return -1;
}

/**
 * Extract text from a cell by column name.
 */
function extractCellText(
  cells: cheerio.Cheerio<Element>,
  headers: string[],
  possibleNames: string[],
  _$: cheerio.CheerioAPI
): string | undefined {
  const index = findColumnIndex(headers, possibleNames);
  if (index < 0) return undefined;
  if (index >= cells.length) return undefined;
  const text = cells.eq(index).text().trim();
  return text.length > 0 ? text : undefined;
}

/**
 * Extract a number from text.
 */
function extractNumber(text: string): number | null {
  const match = text.match(/\d+/);
  if (!match?.[0]) return null;
  const num = parseInt(match[0], 10);
  return isNaN(num) ? null : num;
}

/**
 * Parse inline chapter data from section.
 */
function parseInlineChapterData(
  section: cheerio.Cheerio<Element>,
  $: cheerio.CheerioAPI
): WikipediaChapter[] {
  const chapters: WikipediaChapter[] = [];

  section.find('a[href*="Chapter"], a[href*="chapter"]').each((_, link) => {
    const $link = $(link);
    const text = $link.text().trim();
    const href = $link.attr('href') ?? '';

    const chapterNum = extractChapterNumber(text, href);
    if (chapterNum !== null) {
      chapters.push({
        number: chapterNum,
        title: text,
      });
    }
  });

  return deduplicateChapters(chapters);
}

/**
 * Extract chapter number from text or href.
 */
function extractChapterNumber(text: string, href: string): number | null {
  const textMatch = text.match(/(?:chapter|ch\.?)\s*(\d+)/i);
  if (textMatch?.[1]) return parseInt(textMatch[1], 10);

  const hrefMatch = href.match(/Chapter[_\s]?(\d+)/i);
  if (hrefMatch?.[1]) return parseInt(hrefMatch[1], 10);

  return null;
}

/**
 * Deduplicate chapters by number.
 */
function deduplicateChapters(chapters: WikipediaChapter[]): WikipediaChapter[] {
  const seen = new Set<string | number>();
  return chapters.filter(ch => {
    if (seen.has(ch.number)) return false;
    seen.add(ch.number);
    return true;
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create empty media section data.
 */
function createEmptyMediaSectionData(): MediaSectionData {
  return {
    volumeCount: null,
    chapterCount: null,
    startDate: null,
    endDate: null,
    publisher: null,
    magazine: null,
    status: null,
    volumes: [],
    chapters: [],
    rawText: '',
  };
}

/**
 * Check if section has useful manga data.
 */
export function hasUsefulMangaData(section: cheerio.Cheerio<Element>): boolean {
  const text = section.text();

  const hasVolumes = VOLUME_COUNT_PATTERNS.some(p => p.test(text));
  const hasChapters = CHAPTER_COUNT_PATTERNS.some(p => p.test(text));
  const hasTables = section.find('table.wikitable').length > 0;

  return hasVolumes || hasChapters || hasTables;
}
