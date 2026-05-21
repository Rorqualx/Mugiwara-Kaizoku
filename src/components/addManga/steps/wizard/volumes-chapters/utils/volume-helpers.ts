/**
 * Volume Helper Functions
 *
 * Basic extraction and utility functions for working with volume data.
 * These functions extract common fields from volume objects across different providers.
 *
 * @module volume-helpers
 */

import { stripHtml } from '@/lib/html-sanitizer';

import { isRecord, hasProperty } from '../index';

import { getVolumeFromSource, getStringField } from './volume-data-extraction';

import type { ChapterDetails, VolumeDetails, VolumeFieldSources } from '../components/VolumeDetailsDrawer';

// ============================================================================
// Basic Value Extraction Functions
// ============================================================================

/** Extract volume number from volume object */
export function getVolumeNumber(volume: Record<string, unknown>, index: number): number | string {
  const volumeNumberProp = hasProperty(volume, 'volumeNumber') ? volume['volumeNumber'] : undefined;
  const numberProp = hasProperty(volume, 'number') ? volume['number'] : undefined;

  if (typeof volumeNumberProp === 'number' || typeof volumeNumberProp === 'string') {
    return volumeNumberProp;
  }
  if (typeof numberProp === 'number' || typeof numberProp === 'string') {
    return numberProp;
  }
  return index + 1;
}

/** Extract cover image URL from volume object */
export function getCoverImageUrl(volume: Record<string, unknown>): string | null {
  // Check multiple field names - different parsers use different names
  const coverImageUrl = hasProperty(volume, 'coverImageUrl') ? volume['coverImageUrl'] : undefined;
  const coverImage = hasProperty(volume, 'coverImage') ? volume['coverImage'] : undefined;
  const cover = hasProperty(volume, 'cover') ? volume['cover'] : undefined;

  if (typeof coverImageUrl === 'string') return coverImageUrl;
  if (typeof coverImage === 'string') return coverImage;
  if (typeof cover === 'string') return cover;
  return null;
}

/**
 * Check if a title is a generic placeholder like "Volume 1"
 */
export function isGenericTitle(title: string | null, volumeNum: number | string): boolean {
  if (!title) return true;
  const numStr = String(volumeNum);
  const generic = [
    `Volume ${numStr}`,
    `Vol ${numStr}`,
    `Vol. ${numStr}`
  ];
  return generic.includes(title);
}

/** Extract title from volume object */
export function getTitle(volume: Record<string, unknown>): string | null {
  const title = hasProperty(volume, 'title') ? volume['title'] : undefined;
  return typeof title === 'string' ? title : null;
}

/** Extract description or summary text from volume object, stripping HTML tags */
export function getDescriptionText(volume: Record<string, unknown>): string | null {
  const description = hasProperty(volume, 'description') ? volume['description'] : undefined;
  const summary = hasProperty(volume, 'summary') ? volume['summary'] : undefined;

  // Get the raw text
  let text: string | null = null;
  if (typeof description === 'string') text = description;
  else if (typeof summary === 'string') text = summary;

  // Strip HTML tags (ComicVine and other providers may return HTML)
  if (text) {
    return stripHtml(text);
  }
  return null;
}

/** Get chapter count from volume object */
export function getChapterCount(volume: Record<string, unknown>): number | null {
  const chapterCount = hasProperty(volume, 'chapterCount') ? volume['chapterCount'] : undefined;
  const chapters = hasProperty(volume, 'chapters') && Array.isArray(volume['chapters'])
    ? volume['chapters']
    : null;

  if (typeof chapterCount === 'number') return chapterCount;
  if (chapters) return chapters.length;
  return null;
}

/** Extract release date from volume object */
export function getReleaseDate(volume: Record<string, unknown>): string | null {
  const releaseDate = hasProperty(volume, 'releaseDate') ? volume['releaseDate'] : undefined;

  if (typeof releaseDate === 'string' && releaseDate.length > 0) {
    // Format date for display
    try {
      const date = new Date(releaseDate);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      }
    } catch {
      // Return raw date if parsing fails
    }
    return releaseDate;
  }
  return null;
}

/** Extract source/provider from volume object */
export function getSource(volume: Record<string, unknown>): string | null {
  const source = hasProperty(volume, 'source') ? volume['source'] : undefined;
  const provider = hasProperty(volume, 'provider') ? volume['provider'] : undefined;

  if (typeof source === 'string') return source;
  if (typeof provider === 'string') return provider;
  return null;
}

/** Extract page count from volume object */
export function getPageCount(volume: Record<string, unknown>): number | null {
  const pageCount = hasProperty(volume, 'pageCount') ? volume['pageCount'] : undefined;

  if (typeof pageCount === 'number') return pageCount;
  return null;
}

/** Extract publisher from volume object */
export function getPublisher(volume: Record<string, unknown>): string | null {
  const publisher = hasProperty(volume, 'publisher') ? volume['publisher'] : undefined;

  if (typeof publisher === 'string' && publisher.length > 0) return publisher;
  return null;
}

/** Extract chapters array from volume object */
export function getChaptersArray(volume: Record<string, unknown>): ChapterDetails[] | null {
  const chapters = hasProperty(volume, 'chapters') ? volume['chapters'] : undefined;
  if (!Array.isArray(chapters)) return null;

  const result: ChapterDetails[] = [];

  for (const ch of chapters) {
    if (!isRecord(ch)) continue;

    const number = hasProperty(ch, 'number') ? ch['number'] : undefined;
    const title = hasProperty(ch, 'title') ? ch['title'] : undefined;
    const releaseDate = hasProperty(ch, 'releaseDate') ? ch['releaseDate'] : undefined;

    // Require at least a number
    if (typeof number !== 'number' && typeof number !== 'string') continue;

    const chapterDetails: ChapterDetails = { number };
    if (typeof title === 'string') chapterDetails.title = title;
    if (typeof releaseDate === 'string') chapterDetails.releaseDate = releaseDate;

    result.push(chapterDetails);
  }

  return result.length > 0 ? result : null;
}

// ============================================================================
// Chapter Selection Functions
// ============================================================================

/**
 * Get chapter identifier for selection tracking
 * Uses the same logic as ChapterList.tsx for consistency across providers
 * Returns URL if available, otherwise returns the entire chapter object
 */
export function getChapterId(chapter: Record<string, unknown>): unknown {
  const url = hasProperty(chapter, 'url') ? chapter['url'] : undefined;
  return url ?? chapter;
}

/**
 * Compare two chapter identifiers for equality
 * Handles multiple comparison strategies for cross-provider compatibility:
 * 1. String comparison (URLs)
 * 2. URL property comparison (objects with url)
 * 3. Chapter number comparison (objects without url)
 * 4. Reference equality (fallback)
 */
export function areChaptersEqual(chA: unknown, chB: unknown): boolean {
  // Both are strings (URLs)
  if (typeof chA === 'string' && typeof chB === 'string') {
    return chA === chB;
  }
  // Both are objects
  if (isRecord(chA) && isRecord(chB)) {
    // Compare by URL if available
    const urlA = hasProperty(chA, 'url') ? chA['url'] : undefined;
    const urlB = hasProperty(chB, 'url') ? chB['url'] : undefined;
    if (urlA && urlB) {
      return urlA === urlB;
    }
    // Compare by chapter number as fallback
    const numA = hasProperty(chA, 'number') ? chA['number'] :
                hasProperty(chA, 'chapterNumber') ? chA['chapterNumber'] : undefined;
    const numB = hasProperty(chB, 'number') ? chB['number'] :
                hasProperty(chB, 'chapterNumber') ? chB['chapterNumber'] : undefined;
    if (numA !== undefined && numB !== undefined) {
      return String(numA) === String(numB);
    }
    // Reference equality as last resort
    return chA === chB;
  }
  return false;
}

/** Extract chapter identifiers from volume object
 * Works with all providers:
 * - Fandom/ComicVine: Returns URLs
 * - Wikipedia: Returns chapter objects (no URLs available)
 */
export function getChapterIdentifiers(volume: Record<string, unknown>): unknown[] {
  const chapters = hasProperty(volume, 'chapters') ? volume['chapters'] : undefined;
  if (!Array.isArray(chapters)) return [];

  const identifiers: unknown[] = [];
  for (const ch of chapters) {
    if (!isRecord(ch)) continue;
    identifiers.push(getChapterId(ch));
  }
  return identifiers;
}

// ============================================================================
// Volume Details Conversion
// ============================================================================

/** Convert volume record to VolumeDetails for drawer display */
export function toVolumeDetails(volume: Record<string, unknown>, index: number): VolumeDetails {
  const getStringOrNull = (key: string): string | null => {
    const val = hasProperty(volume, key) ? volume[key] : undefined;
    return typeof val === 'string' && val.length > 0 ? val : null;
  };
  const getNumberOrNull = (key: string): number | null => {
    const val = hasProperty(volume, key) ? volume[key] : undefined;
    return typeof val === 'number' ? val : null;
  };

  const chapters = getChaptersArray(volume);

  return {
    number: getVolumeNumber(volume, index),
    title: getStringOrNull('title'),
    subtitle: getStringOrNull('subtitle'),
    alternativeTitle: getStringOrNull('alternativeTitle'),
    description: getStringOrNull('description'),
    summary: getStringOrNull('summary'),
    isbn: getStringOrNull('isbn'),
    isbn13: getStringOrNull('isbn13'),
    publisher: getStringOrNull('publisher'),
    pageCount: getNumberOrNull('pageCount'),
    releaseDate: getStringOrNull('releaseDate'),
    coverImage: getCoverImageUrl(volume),
    chapterStart: getNumberOrNull('chapterStart'),
    chapterEnd: getNumberOrNull('chapterEnd'),
    totalChapters: getNumberOrNull('totalChapters'),
    chapters: chapters,
    source: getSource(volume),
    sourceUrl: getStringOrNull('sourceUrl'),
  };
}

// ============================================================================
// Field Extraction Functions
// ============================================================================

/** Check if source is "primary" (search all sources for best data) */
export function isPrimarySource(source: string): boolean {
  return source === 'primary' || source === '';
}

export interface ExtractedVolumeFields {
  coverImageUrl: string | null;
  coverSource: string | null;
  descriptionText: string | null;
  summarySource: string | null;
  title: string | null;
  titleSource: string | null;
}

/**
 * Helper: Try to find a volume from preferred source, then fall back to other sources
 * Returns both the volume data and which source it came from
 */
function findVolumeFromSources(
  preferredSource: string,
  volumeNumber: number | string,
  selectedSourcesMetadata: Record<string, unknown>
): { volume: Record<string, unknown>; source: string } | null {
  // Try preferred source first
  if (!isPrimarySource(preferredSource)) {
    const sourceVolume = getVolumeFromSource(preferredSource, volumeNumber, selectedSourcesMetadata);
    if (sourceVolume) return { volume: sourceVolume, source: preferredSource };
  }

  // Fallback: try other sources with volumeData (fandom, wikipedia, comicvine)
  const fallbackOrder = ['fandom', 'wikipedia', 'comicvine'];
  for (const fallbackSource of fallbackOrder) {
    if (fallbackSource === preferredSource.toLowerCase()) continue;
    const fallbackVolume = getVolumeFromSource(fallbackSource, volumeNumber, selectedSourcesMetadata);
    if (fallbackVolume) return { volume: fallbackVolume, source: fallbackSource };
  }

  return null;
}

/** Extract a specific field from a source with fallback */
function extractFieldFromSource(
  preferredSource: string,
  volumeNumber: number | string,
  selectedSourcesMetadata: Record<string, unknown>,
  ...fieldNames: string[]
): { value: string | null; source: string } | null {
  const result = findVolumeFromSources(preferredSource, volumeNumber, selectedSourcesMetadata);
  if (!result) return null;

  const extracted = getStringField(result.volume, ...fieldNames);
  if (!extracted) return null;

  return { value: extracted, source: result.source };
}

/**
 * Extracts volume fields from the appropriate sources based on field preferences.
 * Tries the specified source first, then falls back to other sources with volumeData.
 * This ensures titles and summaries are displayed even when the primary source
 * (e.g., AniList) has no volumeData.
 */
export function extractVolumeFields(
  volume: Record<string, unknown>,
  volumeNumber: number | string,
  volumeFieldSources: VolumeFieldSources | undefined,
  selectedSourcesMetadata: Record<string, unknown> | undefined
): ExtractedVolumeFields {
  const baseSource = getSource(volume);

  // Default values from base volume (displayVolumes data)
  let coverImageUrl = getCoverImageUrl(volume);
  let coverSource = baseSource;
  let descriptionText = getDescriptionText(volume);
  let summarySource = baseSource;
  let title = getTitle(volume);
  let titleSource = baseSource;

  // Early return if no overrides available
  if (!volumeFieldSources || !selectedSourcesMetadata) {
    return { coverImageUrl, coverSource, descriptionText, summarySource, title, titleSource };
  }

  // Cover - try specified source, fallback to others
  if (!isPrimarySource(volumeFieldSources.volumeCover)) {
    const coverResult = extractFieldFromSource(
      volumeFieldSources.volumeCover, volumeNumber, selectedSourcesMetadata,
      'coverImageUrl', 'coverImage', 'cover'
    );
    if (coverResult) {
      coverImageUrl = coverResult.value;
      coverSource = coverResult.source;
    }
  }

  // Summary/Description - try specified source, fallback to others
  if (!isPrimarySource(volumeFieldSources.volumeSummary)) {
    const summaryResult = extractFieldFromSource(
      volumeFieldSources.volumeSummary, volumeNumber, selectedSourcesMetadata,
      'description', 'summary'
    );
    if (summaryResult) {
      descriptionText = summaryResult.value;
      summarySource = summaryResult.source;
    }
  }

  // Title - try specified source, fallback to others
  if (!isPrimarySource(volumeFieldSources.volumeTitle)) {
    const titleResult = extractFieldFromSource(
      volumeFieldSources.volumeTitle, volumeNumber, selectedSourcesMetadata,
      'title'
    );
    if (titleResult) {
      title = titleResult.value;
      titleSource = titleResult.source;
    }
  }

  return { coverImageUrl, coverSource, descriptionText, summarySource, title, titleSource };
}
