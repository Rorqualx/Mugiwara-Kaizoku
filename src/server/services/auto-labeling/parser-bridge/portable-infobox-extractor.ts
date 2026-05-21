/* eslint-disable no-param-reassign -- Functions intentionally mutate data parameter to populate infobox data */
/**
 * Portable Infobox HTML Extractor
 *
 * Extracts entities directly from Fandom portable-infobox HTML components.
 * This handles the modern Fandom infobox format (.portable-infobox) which
 * uses data-source attributes for semantic field identification.
 *
 * Used as fallback when the adaptive parser doesn't find structured data.
 *
 * @module auto-labeling/parser-bridge/portable-infobox-extractor
 */

import { load, type CheerioAPI } from 'cheerio';

import type { EntityType } from '@/server/ml/features/dom-linearizer';
import { FANDOM_DATA_SOURCE_MAP, FANDOM_LABEL_MAP } from '@/server/shared/source-knowledge/field-patterns/fandom-patterns';
import { createLogger } from '@/utils/logger';

import { normalizeEntityValue, normalizeStatusValue } from './utils';

import type { ExtractedEntity } from '../types';


const logger = createLogger('auto-labeling:portable-infobox-extractor');

// ============================================================================
// Types
// ============================================================================

interface ExtractedInfoboxData {
  title?: string;
  author?: string;
  artist?: string;
  publisher?: string;
  magazine?: string;
  chapters?: number;
  volumes?: number;
  status?: string;
  releaseDate?: string;
  genres?: string[];
  coverImage?: string;
  demographic?: string;
  alternativeTitles?: string[];
}

// ============================================================================
// Detection
// ============================================================================

/**
 * Check if the HTML contains a portable infobox.
 */
export function hasPortableInfobox(html: string): boolean {
  const $ = load(html);
  return $('.portable-infobox').length > 0 || $('aside.portable-infobox').length > 0;
}

/**
 * Check if this is an individual volume detail page (not a listing page).
 */
export function isVolumeDetailPage(html: string): boolean {
  const $ = load(html);
  const titleText = $('#firstHeading, .page-header__title, h1').first().text().trim();

  // Check if page title matches "Volume N" or "Vol. N" pattern
  const isVolumeTitle = /^(?:Volume|Vol\.?)\s*\d+$/i.test(titleText);

  // Check for infobox presence
  const hasInfobox = $('.portable-infobox, .infobox, aside[role="complementary"]').length > 0;

  return isVolumeTitle && hasInfobox;
}

/**
 * Check if this is an individual chapter detail page.
 */
export function isChapterDetailPage(html: string): boolean {
  const $ = load(html);
  const titleText = $('#firstHeading, .page-header__title, h1').first().text().trim();

  // Check if page title indicates a chapter page
  const isChapterTitle = /^Chapter\s*\d+/i.test(titleText);

  // Check for infobox with chapter-specific fields
  const hasChapterInfobox = $('.portable-infobox .pi-item[data-source="chapter"]').length > 0 ||
    $('.portable-infobox .pi-item[data-source="volume"]').length > 0;

  return isChapterTitle || hasChapterInfobox;
}

// ============================================================================
// Main Extraction
// ============================================================================

/**
 * Extract entities from portable infobox HTML.
 */
export function extractFromPortableInfobox(html: string, url: string = ''): ExtractedEntity[] {
  const $ = load(html);
  const infoboxSelector = '.portable-infobox, aside.portable-infobox';

  if ($(infoboxSelector).length === 0) {
    logger.debug('No portable infobox found', { url });
    return [];
  }

  // Extract data from infobox
  const data = extractInfoboxData($, infoboxSelector);

  // Convert to entities
  const entities = convertToEntities(data);

  // Extract page title if not in infobox
  if (!data.title) {
    const pageTitle = extractPageTitle($);
    if (pageTitle) {
      entities.push(createEntity('TITLE', pageTitle, 0.85));
    }
  }

  // Extract chapter list from content (for volume pages)
  const chapterEntities = extractChapterListFromContent($);
  entities.push(...chapterEntities);

  logger.info('Portable infobox extraction complete', {
    url,
    entityCount: entities.length,
    hasTitle: !!data.title,
    hasAuthor: !!data.author,
    hasCover: !!data.coverImage,
  });

  return entities;
}

// ============================================================================
// Infobox Data Extraction
// ============================================================================

/**
 * Extract all data from portable infobox.
 */
function extractInfoboxData($: CheerioAPI, infoboxSelector: string): ExtractedInfoboxData {
  const data: ExtractedInfoboxData = {};

  // Method 1: Extract from data-source attributes (modern Fandom)
  extractByDataSource($, infoboxSelector, data);

  // Method 2: Extract from pi-data-label/pi-data-value pairs
  extractByLabels($, infoboxSelector, data);

  // Method 3: Extract cover image
  extractCoverImage($, infoboxSelector, data);

  // Method 4: Extract title from infobox header
  extractInfoboxTitle($, infoboxSelector, data);

  return data;
}

/**
 * Extract data using data-source attributes.
 */
function extractByDataSource(
  $: CheerioAPI,
  infoboxSelector: string,
  data: ExtractedInfoboxData
): void {
  // Map of data-source values to our fields (from shared source-knowledge layer)
  const dataSourceMap = FANDOM_DATA_SOURCE_MAP as Record<string, keyof ExtractedInfoboxData>;

  $(`${infoboxSelector} .pi-item[data-source]`).each((_, item) => {
    const $item = $(item);
    const source = $item.attr('data-source')?.toLowerCase();
    if (!source) return;

    const value = $item.find('.pi-data-value').text().trim() || $item.text().trim();
    if (!value) return;

    const field = dataSourceMap[source];
    if (!field) return;

    // Handle numeric fields
    if (field === 'chapters' || field === 'volumes') {
      const numMatch = value.match(/(\d+)/);
      if (numMatch?.[1]) {
        data[field] = parseInt(numMatch[1], 10);
      }
    }
    // Handle array fields
    else if (field === 'genres') {
      const genres = value.split(/[,&]|\band\b/i).map(g => g.trim()).filter(g => g.length > 0);
      data.genres = genres;
    }
    else if (field === 'alternativeTitles') {
      data.alternativeTitles ??= [];
      data.alternativeTitles.push(value);
    }
    // Handle string fields (only set if not already set)
    else if (!data[field]) {
      (data as Record<string, unknown>)[field] = value;
    }
  });
}

/**
 * Extract data from label/value pairs.
 */
function extractByLabels(
  $: CheerioAPI,
  infoboxSelector: string,
  data: ExtractedInfoboxData
): void {
  // Map of label texts to our fields (from shared source-knowledge layer)
  const labelMap = FANDOM_LABEL_MAP as Record<string, keyof ExtractedInfoboxData>;

  $(`${infoboxSelector} .pi-item`).each((_, item) => {
    const $item = $(item);
    const label = $item.find('.pi-data-label').text().trim().toLowerCase();
    const value = $item.find('.pi-data-value').text().trim();

    if (!label || !value) return;

    const field = labelMap[label];
    if (!field) return;

    // Skip if already set
    if (data[field] !== undefined) return;

    // Handle numeric fields
    if (field === 'chapters' || field === 'volumes') {
      const numMatch = value.match(/(\d+)/);
      if (numMatch?.[1]) {
        data[field] = parseInt(numMatch[1], 10);
      }
    }
    // Handle array fields
    else if (field === 'genres') {
      const genres = value.split(/[,&]|\band\b/i).map(g => g.trim()).filter(g => g.length > 0);
      data.genres = genres;
    }
    // Handle string fields
    else {
      (data as Record<string, unknown>)[field] = value;
    }
  });
}

/**
 * Extract cover image from infobox.
 */
function extractCoverImage(
  $: CheerioAPI,
  infoboxSelector: string,
  data: ExtractedInfoboxData
): void {
  // Look for image in various locations
  const $img = $(`${infoboxSelector} .pi-image img, ${infoboxSelector} .pi-image-collection img, ${infoboxSelector} img`).first();

  let src = $img.attr('data-src') ?? $img.attr('src');

  if (src) {
    // Clean up thumbnail URLs to get full image
    src = src.replace(/\/revision\/.*$/, '');
    src = src.replace(/\/scale-to-width-down\/\d+/, '');
    data.coverImage = src;
  }
}

/**
 * Extract title from infobox header.
 */
function extractInfoboxTitle(
  $: CheerioAPI,
  infoboxSelector: string,
  data: ExtractedInfoboxData
): void {
  if (data.title) return;

  // Look for title in header
  const $header = $(`${infoboxSelector} .pi-title, ${infoboxSelector} .pi-header, ${infoboxSelector} h2.pi-item`).first();
  if ($header.length > 0) {
    const title = $header.text().trim();
    if (title && title.length < 200) {
      data.title = title;
    }
  }
}

/**
 * Extract page title from heading.
 */
function extractPageTitle($: CheerioAPI): string | undefined {
  const $title = $('#firstHeading, .page-header__title, h1').first();
  const title = $title.text().trim();

  // Filter out "Volume N" type titles
  if (/^(?:Volume|Vol\.?|Chapter)\s*\d+$/i.test(title)) {
    return undefined;
  }

  return title.length > 0 ? title : undefined;
}

// ============================================================================
// Content Extraction
// ============================================================================

/**
 * Extract chapter list from page content (for volume detail pages).
 */
function extractChapterListFromContent($: CheerioAPI): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const chapters: string[] = [];

  // Look for chapter list under "Chapters" header
  const $chaptersHeader = $('h2, h3').filter((_, h) => {
    const text = $(h).text().toLowerCase();
    return text.includes('chapter') && !text.includes('information');
  });

  $chaptersHeader.each((_, header) => {
    // Find the next list after the header
    const $nextList = $(header).nextUntil('h2, h3', 'ul, ol').first();

    $nextList.find('li').each((_, li) => {
      const text = $(li).text().trim();
      const $link = $(li).find('a').first();

      // Extract chapter title
      let chapterTitle = text;
      if ($link.length > 0) {
        chapterTitle = $link.text().trim() || text;
      }

      if (chapterTitle && chapterTitle.length < 200) {
        chapters.push(chapterTitle);
      }
    });
  });

  // If we found chapters, add chapter count and sample titles
  if (chapters.length > 0) {
    entities.push({
      type: 'CHAPTER_COUNT' as EntityType,
      value: String(chapters.length),
      normalizedValue: String(chapters.length),
      confidence: 0.85,
      source: 'parser',
    });

    // Sample 3 chapter titles
    for (const title of chapters.slice(0, 3)) {
      entities.push(createEntity('CHAPTER_TITLE', title, 0.8));
    }
  }

  return entities;
}

// ============================================================================
// Entity Conversion
// ============================================================================

/**
 * Convert extracted data to entities.
 */
function convertToEntities(data: ExtractedInfoboxData): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const baseConfidence = 0.9;

  if (data.title) {
    entities.push(createEntity('TITLE', data.title, baseConfidence));
  }

  if (data.author) {
    entities.push(createEntity('AUTHOR', data.author, baseConfidence));
  }

  if (data.artist) {
    entities.push(createEntity('ARTIST', data.artist, baseConfidence));
  }

  if (data.publisher) {
    entities.push(createEntity('PUBLISHER', data.publisher, baseConfidence * 0.9));
  }

  if (data.magazine) {
    entities.push(createEntity('MAGAZINE', data.magazine, baseConfidence * 0.9));
  }

  if (data.status) {
    entities.push({
      type: 'STATUS' as EntityType,
      value: data.status,
      normalizedValue: normalizeStatusValue(data.status),
      confidence: baseConfidence * 0.85,
      source: 'parser',
    });
  }

  if (data.releaseDate) {
    entities.push(createEntity('RELEASE_DATE', data.releaseDate, baseConfidence * 0.85));
  }

  if (data.demographic) {
    entities.push(createEntity('DEMOGRAPHIC', data.demographic, baseConfidence * 0.9));
  }

  if (data.chapters !== undefined && data.chapters > 0) {
    entities.push({
      type: 'CHAPTER_COUNT' as EntityType,
      value: String(data.chapters),
      normalizedValue: String(data.chapters),
      confidence: baseConfidence * 0.9,
      source: 'parser',
    });
  }

  if (data.volumes !== undefined && data.volumes > 0) {
    entities.push({
      type: 'VOLUME_COUNT' as EntityType,
      value: String(data.volumes),
      normalizedValue: String(data.volumes),
      confidence: baseConfidence * 0.9,
      source: 'parser',
    });
  }

  if (data.coverImage) {
    entities.push({
      type: 'COVER_IMAGE' as EntityType,
      value: data.coverImage,
      normalizedValue: 'image_present',
      confidence: baseConfidence * 0.95,
      source: 'parser',
    });
  }

  // Genres (sample 5 max)
  if (data.genres) {
    for (const genre of data.genres.slice(0, 5)) {
      entities.push(createEntity('GENRE', genre, baseConfidence * 0.8));
    }
  }

  // Alternative titles
  if (data.alternativeTitles) {
    for (const altTitle of data.alternativeTitles.slice(0, 5)) {
      entities.push(createEntity('ALT_TITLE', altTitle, baseConfidence * 0.85));
    }
  }

  return entities;
}

/**
 * Create an entity with standard normalization.
 */
function createEntity(
  type: EntityType,
  value: string,
  confidence: number
): ExtractedEntity {
  return {
    type,
    value,
    normalizedValue: normalizeEntityValue(value),
    confidence,
    source: 'parser',
  };
}
