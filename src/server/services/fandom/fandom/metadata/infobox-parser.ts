/**
 * Fandom Infobox Parser
 *
 * Extracts metadata from wiki page infoboxes including author, artist,
 * publisher, dates, volume/chapter counts, alternative titles, and cover images.
 */

import type { MediaWikiPage } from '@/server/services/fandom/types';
import {
  FANDOM_AUTHOR_KEYS,
  FANDOM_ARTIST_KEYS,
  FANDOM_PUBLISHER_KEYS,
  FANDOM_MAGAZINE_KEYS,
} from '@/server/shared/source-knowledge/field-patterns/fandom-patterns';
import { logger } from '@/utils/logger';

const log = logger.child('FandomInfoboxParser');

export interface ParsedInfoboxData {
  author?: string;
  artist?: string;
  publisher?: string;
  magazine?: string;
  published?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  volumes?: number;
  chapters?: number;
  alternativeTitles?: string[];
  demographic?: string;
  genres?: string[];
  coverImage?: string;
}

interface ExtractedDates {
  published?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}

interface ExtractedCounts {
  volumes?: number;
  chapters?: number;
}

interface ParseInfoboxFn {
  (infoboxJson: string): Array<Record<string, unknown>> | null;
}

interface ExtractInfoboxDataFn {
  (infobox: Record<string, unknown>): Record<string, unknown>;
}

/**
 * Input type that allows undefined values explicitly
 */
type MetadataInput = {
  [K in keyof ParsedInfoboxData]?: ParsedInfoboxData[K] | undefined;
};

/**
 * Build metadata object by filtering undefined values
 */
function buildMetadata(fields: MetadataInput): ParsedInfoboxData {
  const result: ParsedInfoboxData = {};
  const entries = Object.entries(fields) as Array<[keyof ParsedInfoboxData, unknown]>;
  for (const [key, value] of entries) {
    if (value !== undefined && value !== null) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

/**
 * Parse infobox metadata from a wiki page
 */
export function parseInfoboxMetadata(
  page: MediaWikiPage,
  parseInfobox: ParseInfoboxFn,
  extractInfoboxData: ExtractInfoboxDataFn,
  wikiSubdomain: string,
  title: string
): ParsedInfoboxData {
  // Check pageprops for infoboxes
  if (!page.pageprops?.infoboxes) {
    return {};
  }

  const infoboxes = parseInfobox(page.pageprops.infoboxes);
  if (!infoboxes?.[0]) {
    return {};
  }

  const infoboxData = extractInfoboxData(infoboxes[0]);
  log.info('Extracted infobox data:', { keys: Object.keys(infoboxData) });

  const dates = extractDates(infoboxData);
  const pageWikitext = page.revisions?.[0]?.slots?.main?.['*'];
  const counts = extractVolumesChapters(infoboxData, pageWikitext);

  return buildMetadata({
    author: extractAuthor(infoboxData),
    artist: extractArtist(infoboxData),
    publisher: extractPublisher(infoboxData),
    magazine: extractMagazine(infoboxData),
    published: dates?.published,
    startDate: dates?.startDate,
    endDate: dates?.endDate,
    status: dates?.status,
    volumes: counts.volumes,
    chapters: counts.chapters,
    alternativeTitles: extractAlternativeTitles(infoboxData, title),
    demographic: extractDemographic(infoboxData),
    genres: extractGenres(infoboxData),
    coverImage: extractCoverImage(infoboxData, wikiSubdomain)
  });
}

/**
 * Look up the first matching key from a list of field keys.
 */
function lookupFirstMatch(
  infoboxData: Record<string, unknown>,
  keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const value = infoboxData[key];
    if (value !== undefined && value !== null) {
      return value as string;
    }
  }
  return undefined;
}

/**
 * Extract author from infobox data.
 * Uses shared field keys from source-knowledge layer.
 */
function extractAuthor(infoboxData: Record<string, unknown>): string | undefined {
  return lookupFirstMatch(infoboxData, FANDOM_AUTHOR_KEYS);
}

/**
 * Extract artist from infobox data.
 * Uses shared field keys from source-knowledge layer.
 */
function extractArtist(infoboxData: Record<string, unknown>): string | undefined {
  return lookupFirstMatch(infoboxData, FANDOM_ARTIST_KEYS);
}

/**
 * Extract publisher from infobox data.
 * Uses shared field keys from source-knowledge layer.
 */
function extractPublisher(infoboxData: Record<string, unknown>): string | undefined {
  return lookupFirstMatch(infoboxData, FANDOM_PUBLISHER_KEYS);
}

/**
 * Extract magazine from infobox data.
 * Uses shared field keys from source-knowledge layer.
 */
function extractMagazine(infoboxData: Record<string, unknown>): string | undefined {
  return lookupFirstMatch(infoboxData, FANDOM_MAGAZINE_KEYS);
}

/**
 * Extract and parse dates from infobox data
 */
function extractDates(infoboxData: Record<string, unknown>): ExtractedDates | null {
  const result: ExtractedDates = {};

  // Parse dates from "Original run" or "Published"
  const dateString = infoboxData['Original run'] ?? infoboxData['Published'] ?? infoboxData['Original Run'];
  if (dateString && typeof dateString === 'string') {
    result.published = dateString;
    const dates = parseDateRange(dateString);
    if (dates) {
      result.startDate = dates.start;
      result.endDate = dates.end;
      // Determine status based on dates
      if (dates.end && !['ongoing', 'present', 'current'].some(term =>
        dates.end.toLowerCase().includes(term))) {
        result.status = 'FINISHED';
      } else {
        result.status = 'ONGOING';
      }
    }
  }

  // If status explicitly provided, use it
  if (infoboxData['Status']) {
    const status = (infoboxData['Status'] as string).toLowerCase();
    if (status.includes('finished') || status.includes('completed')) {
      result.status = 'FINISHED';
    } else if (status.includes('ongoing') || status.includes('active')) {
      result.status = 'ONGOING';
    } else if (status.includes('hiatus')) {
      result.status = 'HIATUS';
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Parse a date range string into start and end dates
 */
function parseDateRange(dateString: string): { start: string; end: string } | null {
  if (!dateString) return null;

  // Handle various date formats
  const parts = dateString.split(/[-\u2013\u2014]/); // Handle different dash types
  if (parts.length >= 2 && parts[0] && parts[1]) {
    const startStr = parts[0].trim();
    const endStr = parts[1].trim();
    return {
      start: formatDateString(startStr),
      end: formatDateString(endStr)
    };
  } else if (parts.length === 1 && parts[0]) {
    // Only start date
    return {
      start: formatDateString(parts[0].trim()),
      end: 'present'
    };
  }
  return null;
}

/**
 * Format date string to a standard format
 */
function formatDateString(dateStr: string): string {
  // Return as-is for special terms
  if (['present', 'ongoing', 'current'].some(term => dateStr.toLowerCase().includes(term))) {
    return dateStr;
  }

  // Handle year-only dates (e.g., "2015")
  const yearOnlyMatch = dateStr.match(/^(\d{4})$/);
  if (yearOnlyMatch) {
    // For year-only, return as January 1st of that year
    return `${yearOnlyMatch[1]}-01-01`;
  }

  // Try to parse the date
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    // Return in YYYY-MM-DD format
    const parts = date.toISOString().split('T');
    return parts[0] ?? dateStr;
  }

  // Return original if can't parse
  return dateStr;
}

/**
 * Extract volumes and chapters counts from infobox data
 */
function extractVolumesChapters(
  infoboxData: Record<string, unknown>,
  pageWikitext?: string
): ExtractedCounts {
  const result: ExtractedCounts = {};

  // Parse volumes
  if (infoboxData['Volumes']) {
    const volStr = String(infoboxData['Volumes']);
    // Extract the first number found - handle cases like "34" or "34 (ongoing)"
    const volMatch = volStr.match(/(\d+)/);
    if (volMatch) {
      const volNum = parseInt(volMatch[1] ?? '0');
      if (!isNaN(volNum)) {
        result.volumes = volNum;
      }
    }
  }

  // Parse chapters
  if (!infoboxData['Chapters']) {
    return result;
  }

  const chapStr = String(infoboxData['Chapters']);
  const chapMatch = chapStr.match(/(\d+)/);
  if (!chapMatch) {
    return result;
  }

  let chapNum = parseInt(chapMatch[1] ?? '0');
  if (isNaN(chapNum)) {
    return result;
  }

  // Check if there's a Chapter 0 that might not be counted
  if (pageWikitext && hasChapterZeroInContent(pageWikitext)) {
    const chapterCountPattern = /(?:has|contains?)\s*(\d+)\s*chapters?/i;
    const countMatch = pageWikitext.match(chapterCountPattern);
    if (countMatch && parseInt(countMatch[1] ?? '0') === chapNum) {
      chapNum += 1;
    }
  }
  result.chapters = chapNum;

  return result;
}

/**
 * Check if a manga has Chapter 0 by searching wiki content
 */
export function hasChapterZeroInContent(wikitext?: string): boolean {
  if (!wikitext) return false;

  // Look for Chapter 0 mentions in the content
  const chapterZeroPatterns = [
    /Chapter\s+0(?:\s|:|\]|\)|,|$)/i,
    /Chapter\s+Zero/i,
    /Prologue.*Chapter\s+0/i,
    /\[\[Chapter\s+0[\]|]/i,
    // Link patterns like [[Chapter 0]] or [[Chapter 0|text]]
    /\[\[.*Chapter\s+0.*\]\]/i,
    // Common Chapter 0 title patterns
    /^\s*0\.\s+/m, // Lines starting with "0. "
    /Chapter\s+0\s*[-\u2013\u2014:]/i, // Chapter 0 followed by separator
    // Table of contents patterns
    /\|\s*0\s*\|/i, // |0| in tables
    /Chapter\s+0\s*\([^)]+\)/i, // Chapter 0 (subtitle)
    // Generic prologue patterns that might indicate Chapter 0
    /^Prologue(?:\s|:|$)/im,
    /\[\[Prologue\]\]/i
  ];

  for (const pattern of chapterZeroPatterns) {
    if (pattern.test(wikitext)) {
      return true;
    }
  }

  // Check if there's a list of chapters that starts with 0
  const chapterListMatch = wikitext.match(/Chapters?\s*[:=]?\s*([\d,\s-]+)/i);
  if (chapterListMatch?.[1]) {
    const numbers = chapterListMatch[1].match(/\d+/g);
    if (numbers?.[0] === '0') return true;
  }

  // Check for chapter list pages referenced in content
  if (wikitext.includes('[[List of Chapters]]') || wikitext.includes('[[Chapter 0]]')) {
    return true;
  }

  return false;
}

/**
 * Extract alternative titles from infobox data
 */
function extractAlternativeTitles(
  infoboxData: Record<string, unknown>,
  title: string
): string[] | undefined {
  // Fields to extract (in order of priority)
  const titleFields = [
    'Romaji', 'Kanji', 'Japanese',
    'JapTitle', 'KanjiTitle', 'RomajiTitle',
    'Japanese title', 'Japanese Title',
    'Original title', 'Native title', 'Translated title',
    'Alt title', 'Alternative title', 'Also known as'
  ];

  // Fields that should not match the main title
  const excludeIfMatchesTitle = ['English', 'English title'];

  const altTitles: unknown[] = [];

  // Collect from standard fields
  for (const field of titleFields) {
    if (infoboxData[field]) {
      altTitles.push(infoboxData[field]);
    }
  }

  // Collect from title-matching fields only if different
  for (const field of excludeIfMatchesTitle) {
    if (infoboxData[field] && infoboxData[field] !== title) {
      altTitles.push(infoboxData[field]);
    }
  }

  // Check Name field for Japanese text only
  const nameValue = infoboxData['Name'];
  if (nameValue && nameValue !== title && typeof nameValue === 'string') {
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(nameValue)) {
      altTitles.push(nameValue);
    }
  }

  // Remove duplicates and empty strings
  const uniqueAltTitles = [...new Set(
    altTitles.filter((t): t is string => typeof t === 'string' && t.trim() !== '')
  )];

  return uniqueAltTitles.length > 0 ? uniqueAltTitles : undefined;
}

/**
 * Extract demographic from infobox data
 */
function extractDemographic(infoboxData: Record<string, unknown>): string | undefined {
  return infoboxData['Demographic'] as string | undefined;
}

/**
 * Extract genres from infobox data (comma-separated string)
 */
function extractGenres(infoboxData: Record<string, unknown>): string[] | undefined {
  const genreValue = (infoboxData['Genre'] ??
    infoboxData['Genres'] ??
    infoboxData['Type'] ??
    infoboxData['Category']) as string | undefined;

  if (!genreValue || typeof genreValue !== 'string') return undefined;

  // Split by comma, ampersand, or 'and'
  const genres = genreValue
    .split(/[,&]|\band\b/i)
    .map(g => g.trim())
    .filter(g => g.length > 0 && g.length < 50);

  return genres.length > 0 ? genres : undefined;
}

/**
 * Extract cover image from infobox data
 */
function extractCoverImage(
  infoboxData: Record<string, unknown>,
  wikiSubdomain: string
): string | undefined {
  // Check multiple field name variations
  const imageFields = [
    'image', 'Image',
    'cover', 'Cover',
    'coverImage', 'CoverImage', 'cover_image',
    'Manga Cover', 'MangaCover', 'manga_cover',
    'Cover Image', 'cover image',
    'Series Image', 'SeriesImage', 'series_image',
    'Manga Image', 'MangaImage', 'manga_image',
    'Cover_Image', 'Series_Image', 'Manga_Image'
  ];

  let imageValue: string | undefined;

  // Check each field name variation
  for (const field of imageFields) {
    const value = infoboxData[field];
    if (value && typeof value === 'string' && value.trim()) {
      imageValue = value;
      break;
    }
  }

  if (imageValue) {
    return processImageUrl(imageValue, wikiSubdomain);
  }

  return undefined;
}

/**
 * Process image URL to get the best quality direct image URL
 * Handles multiple URL formats from Fandom wikis
 */
export function processImageUrl(imageValue: string, wikiSubdomain: string): string {
  if (imageValue.startsWith('https://') && imageValue.includes('/wiki/File:')) {
    // Extract filename from wiki file page URL
    const fileName = imageValue.split('/wiki/File:')[1];
    return fileName
      ? `https://${wikiSubdomain}.fandom.com/wiki/Special:FilePath/${fileName}`
      : imageValue;
  } else if (imageValue.startsWith('File:')) {
    // Handle File: prefix
    const fileName = imageValue.replace('File:', '');
    return `https://${wikiSubdomain}.fandom.com/wiki/Special:FilePath/${encodeURIComponent(fileName)}`;
  } else if (imageValue.startsWith('http')) {
    // Direct image URL - use as-is
    return imageValue;
  } else {
    // Assume it's a filename without prefix
    return `https://${wikiSubdomain}.fandom.com/wiki/Special:FilePath/${encodeURIComponent(imageValue)}`;
  }
}
