/**
 * Metadata Extraction for Bootstrap Labeling
 *
 * Extracts structured metadata values from HTML using CSS selectors.
 *
 * @module ml/training/bootstrap-labeler/metadata-extraction
 */

import * as cheerio from 'cheerio';

import { extractAuthorArtistFromProse, isNavigationPattern } from './prose-extractors';
import { detectSourceType, getSelectorsWithFallback } from './source-selectors';

import type { ExtractedValues } from './types';

// ============================================================================
// Main Extraction Function
// ============================================================================

export function extractMetadataValues(html: string, url: string): ExtractedValues {
  const $ = cheerio.load(html);
  const sourceType = detectSourceType(url);
  const selectors = getSelectorsWithFallback(sourceType);

  // Fallback to prose patterns for author/artist on chapter pages
  const proseResult = extractAuthorArtistFromProse($);
  return {
    title: extractValidatedTitle($, selectors.title),
    altTitles: collectArrayValues($, selectors.altTitles),
    author: findFirstMatchingText($, selectors.author) ?? proseResult.author,
    artist: findFirstMatchingText($, selectors.artist) ?? proseResult.artist,
    status: findFirstMatchingText($, selectors.status),
    genres: extractGenresWithSelectors($, selectors.genres),
    summary: extractSummaryWithSelectors($, selectors.summary),
    volumeCount: extractCountWithSelectors($, selectors.volumeCount),
    chapterCount: extractCountWithSelectors($, selectors.chapterCount),
    publisher: findFirstMatchingText($, selectors.publisher),
    magazine: findFirstMatchingText($, selectors.magazine),
    demographic: findFirstMatchingText($, selectors.demographic),
    releaseDate: findFirstMatchingText($, selectors.releaseDate),
    themes: collectArrayValues($, selectors.themes),
    tags: collectArrayValues($, selectors.tags),
    format: extractValidatedFormat($, selectors.format),
    characters: collectArrayValues($, selectors.characters),
  };
}

// ============================================================================
// Field Extraction Helpers
// ============================================================================

function findFirstMatchingText($: cheerio.CheerioAPI, selectors: string[]): string | undefined {
  for (const sel of selectors) {
    try {
      const text = $(sel).first().text().trim();
      if (text) return text;
    } catch {
      // Selector may be invalid for this page, continue to next
    }
  }
  return undefined;
}

function extractValidatedTitle($: cheerio.CheerioAPI, selectors: string[]): string | undefined {
  for (const sel of selectors) {
    try {
      const text = $(sel).first().text().trim();
      if (text && isValidTitle(text)) {
        return text;
      }
    } catch {
      // Selector may be invalid for this page, continue to next
    }
  }
  return undefined;
}

function extractGenresWithSelectors($: cheerio.CheerioAPI, selectors: string[]): string[] {
  for (const sel of selectors) {
    try {
      const genres = collectGenresFromElements($, sel);
      if (genres.length > 0) return genres;
    } catch {
      // Selector may be invalid, continue
    }
  }
  return [];
}

// ============================================================================
// Title Validation
// ============================================================================

const TITLE_BLACKLIST = new Set([
  'manga', 'anime', 'wiki', 'fandom', 'media',
  'category', 'categories', 'article', 'articles',
  'page', 'pages', 'content', 'series', 'home',
  'edit', 'view', 'history', 'talk', 'source', 'help',
  'community', 'explore', 'main page', 'random',
  'search', 'navigation', 'menu', 'sidebar',
  'volume', 'volumes', 'chapter', 'chapters',
  'tankoubon', 'light novel', 'web manga', 'one-shot',
  'untitled', 'no title', 'n/a', 'unknown', 'tba', 'tbd',
]);

function isValidTitle(title: string): boolean {
  const normalized = title.toLowerCase().trim();
  if (normalized.length < 2 || normalized.length > 200) return false;
  if (TITLE_BLACKLIST.has(normalized)) return false;
  if (/^https?:\/\/|\.com|\.org|\.net/i.test(normalized)) return false;
  if (/^(view|edit|add|remove|delete|back|next|previous|click|tap)/i.test(normalized)) return false;
  if (/^[\d\s\-_.,!?]+$/.test(normalized)) return false;
  return true;
}

// ============================================================================
// Format Validation & Extraction
// ============================================================================

/** Resource type names and navigation text that should NOT be treated as format values */
const FORMAT_BLACKLIST = new Set([
  'volume', 'issue', 'series', 'character', 'person', 'team',
  'publisher', 'concept', 'location', 'object', 'story arc',
  // Navigation/breadcrumb fragments
  'volume »', '»',
]);

function isValidFormat(format: string): boolean {
  const normalized = format.toLowerCase().trim();
  if (normalized.length < 2 || normalized.length > 50) return false;
  if (FORMAT_BLACKLIST.has(normalized)) return false;
  // Reject if it's just a resource type name with breadcrumb symbols
  if (/^(volume|issue|series)\s*[»→]/i.test(normalized)) return false;
  return true;
}

function extractValidatedFormat($: cheerio.CheerioAPI, selectors: string[]): string | undefined {
  for (const sel of selectors) {
    try {
      const text = $(sel).first().text().trim();
      if (text && isValidFormat(text)) return text;
    } catch {
      // Selector may be invalid, continue
    }
  }
  return undefined;
}

// ============================================================================
// Genre Validation & Extraction
// ============================================================================

const GENRE_BLACKLIST = new Set([
  'media', 'manga', 'anime', 'wiki', 'fandom', 'category', 'categories',
  'article', 'articles', 'page', 'pages', 'content', 'series',
  'english', 'japanese', '日本語', '日本', 'chinese', 'korean',
  'edit', 'view', 'history', 'talk', 'source', 'help',
  'community', 'explore', 'main page', 'random',
  'tankoubon', 'light novel', 'web manga', 'one-shot', 'webtoon',
  'doujinshi', 'anthology', 'spin-off', 'spinoff',
]);

function isValidGenre(genre: string): boolean {
  const normalized = genre.toLowerCase().trim();
  if (normalized.length < 2 || normalized.length > 50) return false;
  if (GENRE_BLACKLIST.has(normalized)) return false;
  if (/^(view|edit|add|remove|delete|back|next|previous)/i.test(normalized)) return false;
  return true;
}

function parseGenreText(text: string): string[] {
  return text
    .split(/[,、]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && isValidGenre(part));
}

function addUniqueGenres(genres: string[], newGenres: string[]): void {
  for (const genre of newGenres) {
    if (!genres.includes(genre)) {
      genres.push(genre);
    }
  }
}

function collectGenresFromElements($: cheerio.CheerioAPI, selector: string): string[] {
  const genres: string[] = [];
  const elements = $(selector).toArray();

  for (const el of elements) {
    const text = $(el).text().trim();
    if (text) {
      const parsed = parseGenreText(text);
      addUniqueGenres(genres, parsed);
    }
  }

  return genres;
}

// ============================================================================
// Summary Validation & Extraction
// ============================================================================

const SUMMARY_INVALID_PATTERNS = [
  /^browse\s+all\b/i,
  /\bwiki\.?\s*$/i,
  /^welcome\s+to\s+(the\s+)?\w+\s+wiki/i,
  /^this\s+(category|page)\s+(contains|lists|shows)/i,
  /^(click|tap)\s+(here|below)/i,
  /^(view|see|read)\s+(all|more)\b/i,
  /\bcategory\s*:\s*/i,
  /^pages\s+in\s+category/i,
  /^the\s+following\s+\d+\s+pages/i,
  /^subcategories/i,
  /^this\s+article\s+(is|has|needs)/i,
  /^this\s+page\s+(is|has|needs)/i,
  /\[(edit|source|history)\]/i,
  /^to\s+(add|edit|view|browse)/i,
  /^for\s+(more|a\s+list|other)/i,
];

function isValidSummary(summary: string): boolean {
  if (summary.length < 80) return false;
  if (summary.length > 5000) return false;

  for (const pattern of SUMMARY_INVALID_PATTERNS) {
    if (pattern.test(summary)) return false;
  }

  const periodCount = (summary.match(/\.\s/g) ?? []).length;
  if (periodCount < 1 && summary.length < 200) {
    return false;
  }

  return true;
}

function extractSummaryWithSelectors($: cheerio.CheerioAPI, selectors: string[]): string | undefined {
  for (const sel of selectors) {
    try {
      const text = $(sel).first().text().trim();
      if (text && text.length > 50 && isValidSummary(text)) {
        return text;
      }
    } catch {
      // Selector may be invalid, continue
    }
  }
  return undefined;
}

// ============================================================================
// Count & Array Extraction
// ============================================================================

function extractCountWithSelectors($: cheerio.CheerioAPI, selectors: string[]): number | undefined {
  for (const sel of selectors) {
    try {
      const text = $(sel).first().text().trim();
      const match = text.match(/(\d+)/);
      const matchedNum = match?.[1];
      if (matchedNum) return parseInt(matchedNum, 10);
    } catch {
      // Selector may be invalid, continue
    }
  }
  return undefined;
}

function collectArrayValues($: cheerio.CheerioAPI, selectors: string[]): string[] {
  for (const sel of selectors) {
    const values = collectValuesFromSelector($, sel);
    if (values.length > 0) return values;
  }
  return [];
}

function collectValuesFromSelector($: cheerio.CheerioAPI, selector: string): string[] {
  const values: string[] = [];
  try {
    const elements = $(selector).toArray();
    for (const el of elements) {
      const text = $(el).text().trim();
      if (text && !values.includes(text) && !isNavigationPattern(text)) {
        values.push(text);
      }
    }
  } catch {
    // Selector may be invalid, return empty
  }
  return values;
}
