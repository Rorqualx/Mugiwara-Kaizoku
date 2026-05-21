/**
 * ComicVine Extractor
 *
 * Extracts entities from ComicVine pages using multiple extraction strategies:
 * - Table metadata (publisher, year, themes from "Volume details" table)
 * - Volume metadata (title, summary, cover, concepts, genres)
 *
 * @module auto-labeling/parser-bridge/comicvine-extractor
 */

import * as cheerio from 'cheerio';

import type { EntityType } from '@/server/ml/features/dom-linearizer';
import { parseChaptersFromLists } from '@/server/services/comicvine/list-parser';
import { extractVolumeMetadata } from '@/server/services/comicvine/metadata-extractor';
import {
  extractPublisher,
  extractReleaseYear,
  extractThemesFromTable,
} from '@/server/services/comicvine/table-metadata-extractor';
import { parseChaptersFromText } from '@/server/services/comicvine/text-parser';
import type { ComicVineChapter } from '@/server/services/comicvine/types';
import {
  COMICVINE_ARTIST_LABELS,
  COMICVINE_WRITER_LABELS,
} from '@/server/shared/source-knowledge/field-patterns/comicvine-patterns';
import { normalizeStatusValue as normalizeStatusShared } from '@/server/shared/source-knowledge/normalizers/status-normalizer';
import { isComicVineUrl as isComicVineUrlShared } from '@/server/shared/source-knowledge/source-detection';
import { createLogger } from '@/utils/logger';

import { normalizeEntityValue } from './utils';

import type { ExtractedEntity } from '../types';


const logger = createLogger('auto-labeling:comicvine-extractor');

/**
 * Check if a URL is from ComicVine.
 * Delegates to shared source detection.
 */
export function isComicVineUrl(url: string): boolean {
  return isComicVineUrlShared(url);
}

/**
 * Extract entities from ComicVine HTML using specialized extractors.
 * Combines table metadata extraction with volume metadata extraction.
 */
export function extractFromComicVineHtml(html: string, url: string = ''): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const $ = cheerio.load(html);

  // Extract from "Volume details" table
  extractTableMetadata($, entities);

  // Extract volume metadata (title, summary, cover, concepts, genres)
  const volumeData = extractVolumeMetadata($, url);
  addVolumeDataEntities(volumeData, entities);

  // Extract additional metadata (issue count, status, creators)
  const additionalEntities = extractAdditionalMetadata($);
  entities.push(...additionalEntities);

  // Extract chapter-level data
  const chapterEntities = extractChapterData($);
  entities.push(...chapterEntities);

  logger.info('ComicVine extraction complete', { entityCount: entities.length, url });

  return entities;
}

/**
 * Extract metadata from ComicVine "Volume details" table.
 */
function extractTableMetadata($: cheerio.CheerioAPI, entities: ExtractedEntity[]): void {
  const publisher = extractPublisher($);
  if (publisher) {
    entities.push(createEntity('PUBLISHER', publisher, 0.9));
  }

  const releaseYear = extractReleaseYear($);
  if (releaseYear) {
    entities.push(createEntity('RELEASE_DATE', String(releaseYear), 0.85));
  }

  const themes = extractThemesFromTable($);
  // Sample 5 max - enough to detect patterns
  const themesToSample = themes.slice(0, 5);
  for (const theme of themesToSample) {
    entities.push(createEntity('THEMES', theme, 0.8));
  }
}

/**
 * Add volume metadata entities to the list.
 */
function addVolumeDataEntities(
  volumeData: ReturnType<typeof extractVolumeMetadata>,
  entities: ExtractedEntity[]
): void {
  if (volumeData.volumeTitle) {
    entities.push(createEntity('TITLE', volumeData.volumeTitle, 0.9));
  }

  if (volumeData.volumeSummary) {
    entities.push(createSummaryEntity(volumeData.volumeSummary));
  }

  if (volumeData.coverImage) {
    entities.push(createImageEntity(volumeData.coverImage));
  }

  addThemesFromVolume(volumeData.themes, entities);
  addGenresFromVolume(volumeData.genres, entities);

  if (volumeData.volumeNumber > 0) {
    entities.push(createEntity('VOLUME_NUMBER', String(volumeData.volumeNumber), 0.85));
  }

  if (volumeData.volumeId) {
    entities.push(createExternalIdEntity(volumeData.volumeId));
  }
}

/**
 * Add themes from volume data, avoiding duplicates.
 * Samples 5 max - enough to detect patterns.
 */
function addThemesFromVolume(themes: string[] | undefined, entities: ExtractedEntity[]): void {
  if (!themes || themes.length === 0) return;

  // Sample 5 max
  const themesToSample = themes.slice(0, 5);
  for (const theme of themesToSample) {
    const normalized = normalizeEntityValue(theme);
    const alreadyExists = entities.some(
      e => e.type === 'THEMES' && normalizeEntityValue(e.value) === normalized
    );
    if (!alreadyExists) {
      entities.push(createEntity('THEMES', theme, 0.75));
    }
  }
}

/**
 * Add genres from volume data.
 * Samples 5 max - enough to detect patterns.
 */
function addGenresFromVolume(genres: string[] | undefined, entities: ExtractedEntity[]): void {
  if (!genres || genres.length === 0) return;

  // Sample 5 max
  const genresToSample = genres.slice(0, 5);
  for (const genre of genresToSample) {
    entities.push(createEntity('GENRE', genre, 0.8));
  }
}

/**
 * Extract additional ComicVine-specific metadata from page.
 */
function extractAdditionalMetadata($: cheerio.CheerioAPI): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  const issueCount = extractIssueCount($);
  if (issueCount > 0) {
    entities.push(createEntity('CHAPTER_COUNT', String(issueCount), 0.8));
  }

  const status = extractStatus($);
  if (status) {
    entities.push({
      type: 'STATUS' as EntityType,
      value: status,
      normalizedValue: normalizeStatusValue(status),
      confidence: 0.75,
      source: 'parser',
    });
  }

  const writer = extractCreator($, 'writer');
  if (writer) {
    entities.push(createEntity('AUTHOR', writer, 0.85));
  }

  const artist = extractCreator($, 'artist');
  if (artist) {
    entities.push(createEntity('ARTIST', artist, 0.85));
  }

  return entities;
}

// ============================================================================
// Entity Creation Helpers
// ============================================================================

function createEntity(type: string, value: string, confidence: number): ExtractedEntity {
  return {
    type: type as EntityType,
    value,
    normalizedValue: normalizeEntityValue(value),
    confidence,
    source: 'parser',
  };
}

function createSummaryEntity(summary: string): ExtractedEntity {
  return {
    type: 'SERIES_SUMMARY' as EntityType,
    value: summary,
    normalizedValue: normalizeEntityValue(summary.substring(0, 100)),
    confidence: 0.85,
    source: 'parser',
  };
}

function createImageEntity(imageUrl: string): ExtractedEntity {
  return {
    type: 'COVER_IMAGE' as EntityType,
    value: imageUrl,
    normalizedValue: 'image_present',
    confidence: 0.9,
    source: 'parser',
  };
}

function createExternalIdEntity(volumeId: string): ExtractedEntity {
  return {
    type: 'EXTERNAL_ID' as EntityType,
    value: `comicvine:${volumeId}`,
    normalizedValue: volumeId,
    confidence: 0.95,
    source: 'parser',
  };
}

// ============================================================================
// Extraction Helpers
// ============================================================================

function extractIssueCount($: cheerio.CheerioAPI): number {
  // Pattern 1: Look for issue count in summary text
  const summaryText = $('body').text();
  const issueMatch = summaryText.match(/(\d+)\s+issues?/i);
  if (issueMatch?.[1]) return parseInt(issueMatch[1], 10);

  // Pattern 2: Count issue links
  const issueLinks = $('a[href*="/4000-"]').length;
  if (issueLinks > 0) return issueLinks;

  // Pattern 3: data-field
  const dataField = $('[data-field="count_of_issues"]').text().trim();
  if (dataField) {
    const count = parseInt(dataField, 10);
    if (!isNaN(count)) return count;
  }

  return 0;
}

function extractStatus($: cheerio.CheerioAPI): string | undefined {
  // Pattern 1: Look in Volume details table
  const statusFromTable = extractStatusFromTable($);
  if (statusFromTable) return statusFromTable;

  // Pattern 2: data-field
  const dataField = $('[data-field="status"]').text().trim();
  if (dataField) return dataField;

  // Pattern 3: Look for status keywords in page text
  return extractStatusFromText($);
}

function extractStatusFromTable($: cheerio.CheerioAPI): string | undefined {
  const tableCells = $('table th, table td').toArray();
  for (const cell of tableCells) {
    const text = $(cell).text().trim().toLowerCase();
    if (text === 'status') {
      const nextCell = $(cell).next('td');
      if (nextCell.length) return nextCell.text().trim();
    }
  }
  return undefined;
}

function extractStatusFromText($: cheerio.CheerioAPI): string | undefined {
  const bodyText = $('body').text().toLowerCase();
  if (bodyText.includes('ongoing') || bodyText.includes('currently running')) return 'Ongoing';
  if (bodyText.includes('completed') || bodyText.includes('concluded')) return 'Completed';
  if (bodyText.includes('cancelled') || bodyText.includes('canceled')) return 'Cancelled';
  return undefined;
}

function extractCreator($: cheerio.CheerioAPI, role: 'writer' | 'artist'): string | undefined {
  // Pattern 1: Look in details section
  const fromTable = extractCreatorFromTable($, role);
  if (fromTable) return fromTable;

  // Pattern 2: data-field
  const fieldName = role === 'writer' ? 'writers' : 'pencilers';
  const dataField = $(`[data-field="${fieldName}"] a`).first().text().trim();
  if (dataField) return dataField;

  return undefined;
}

function extractCreatorFromTable($: cheerio.CheerioAPI, role: 'writer' | 'artist'): string | undefined {
  const labels = role === 'writer'
    ? [...COMICVINE_WRITER_LABELS]
    : [...COMICVINE_ARTIST_LABELS];

  const tableCells = $('table th, table td, dt').toArray();
  for (const cell of tableCells) {
    const text = $(cell).text().trim().toLowerCase();
    if (labels.includes(text)) {
      const nextCell = $(cell).next('td, dd');
      if (nextCell.length) {
        const link = nextCell.find('a').first();
        return link.length ? link.text().trim() : nextCell.text().trim();
      }
    }
  }
  return undefined;
}

/**
 * Normalize status value - delegates to shared normalizer.
 */
function normalizeStatusValue(status: string): string {
  return normalizeStatusShared(status);
}

// ============================================================================
// Chapter Extraction
// ============================================================================

/**
 * Parse chapter number to sortable float.
 */
function parseChapterNumber(num: string): number {
  const parsed = parseFloat(num);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Extract chapter-level data from the page.
 * Uses both list-based and text-based parsing strategies.
 */
function extractChapterData($: cheerio.CheerioAPI): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  // Parse chapters from structured lists (ul/ol)
  const listChapters = parseChaptersFromLists($);

  // Parse chapters from unstructured text
  const bodyText = $('body').text();
  const textChapters = parseChaptersFromText(bodyText);

  // Merge chapters, preferring list-based (more reliable)
  const chapters = mergeChapters(listChapters, textChapters);

  if (chapters.length === 0) {
    return entities;
  }

  // Update chapter count if we found chapters
  entities.push(createEntity('CHAPTER_COUNT', String(chapters.length), 0.85));

  // Extract sample of chapters (5 max - enough to detect patterns)
  const chaptersToProcess = chapters.slice(0, 5);
  for (const chapter of chaptersToProcess) {
    addChapterEntities(chapter, entities);
  }

  // Detect chapter naming patterns
  const namingPattern = detectChapterNamingPattern(chapters);
  if (namingPattern) {
    entities.push({
      type: 'CHAPTER_NAMING_PATTERN' as EntityType,
      value: namingPattern,
      normalizedValue: namingPattern.toLowerCase(),
      confidence: 0.8,
      source: 'parser',
    });
  }

  logger.info('Chapter extraction complete', {
    listChapters: listChapters.length,
    textChapters: textChapters.length,
    totalChapters: chapters.length,
  });

  return entities;
}

/**
 * Merge chapters from list and text parsing, avoiding duplicates.
 */
function mergeChapters(
  listChapters: ComicVineChapter[],
  textChapters: ComicVineChapter[]
): ComicVineChapter[] {
  const seen = new Map<string, ComicVineChapter>();

  // Add list chapters first (higher priority)
  for (const chapter of listChapters) {
    const key = chapter.number;
    if (!seen.has(key)) {
      seen.set(key, chapter);
    }
  }

  // Add text chapters if not already found
  for (const chapter of textChapters) {
    const key = chapter.number;
    if (!seen.has(key)) {
      seen.set(key, chapter);
    }
  }

  // Sort by chapter number
  return Array.from(seen.values()).sort((a, b) => {
    return parseChapterNumber(a.number) - parseChapterNumber(b.number);
  });
}

/**
 * Add entities for a single chapter.
 */
function addChapterEntities(chapter: ComicVineChapter, entities: ExtractedEntity[]): void {
  // Chapter title
  if (chapter.title) {
    entities.push({
      type: 'CHAPTER_TITLE' as EntityType,
      value: chapter.title,
      normalizedValue: normalizeEntityValue(chapter.title),
      confidence: 0.8,
      source: 'parser',
    });
  }

  // Special chapter markers
  if (chapter.isFinalChapter) {
    entities.push({
      type: 'CHAPTER_MARKER' as EntityType,
      value: 'Final Chapter',
      normalizedValue: 'final',
      confidence: 0.9,
      source: 'parser',
    });
  }

  if (chapter.isEpilogue) {
    entities.push({
      type: 'CHAPTER_MARKER' as EntityType,
      value: `Epilogue${chapter.epilogueNumber ? ` ${chapter.epilogueNumber}` : ''}`,
      normalizedValue: 'epilogue',
      confidence: 0.85,
      source: 'parser',
    });
  }

  if (chapter.isSpecial) {
    entities.push({
      type: 'CHAPTER_MARKER' as EntityType,
      value: `Special: ${chapter.title}`,
      normalizedValue: 'special',
      confidence: 0.8,
      source: 'parser',
    });
  }
}

/**
 * Detect the chapter naming pattern used in the manga.
 */
function detectChapterNamingPattern(chapters: ComicVineChapter[]): string | undefined {
  if (chapters.length === 0) return undefined;

  // Check for common prefixes
  const prefixCounts = new Map<string, number>();
  for (const chapter of chapters) {
    const prefix = chapter.prefix ?? 'Chapter';
    prefixCounts.set(prefix, (prefixCounts.get(prefix) ?? 0) + 1);
  }

  // Find dominant prefix
  let dominantPrefix = 'Chapter';
  let maxCount = 0;
  for (const [prefix, count] of prefixCounts) {
    if (count > maxCount) {
      dominantPrefix = prefix;
      maxCount = count;
    }
  }

  // Check for Roman numerals
  const hasRomanNumerals = chapters.some(c => c.romanNumeral);

  if (dominantPrefix !== 'Chapter') {
    return hasRomanNumerals ? `${dominantPrefix} (Roman)` : dominantPrefix;
  }

  return hasRomanNumerals ? 'Chapter (Roman)' : 'Chapter';
}
