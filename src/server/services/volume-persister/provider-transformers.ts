/**
 * Provider-specific Volume Data Transformers
 *
 * Handles transformation of provider-specific volume data formats
 * (ComicVine, Fandom) to the standard EnhancedVolumeData format.
 *
 * @module volume-persister/provider-transformers
 */

import type { EnhancedVolumeData } from '@/types/search-types/metadata.types';
import { logger } from '@/utils/logger';

// ============================================================================
// Chapter Number Extraction
// ============================================================================

/**
 * Extract chapter number from chapter object
 */
function extractChapterNumber(ch: Record<string, unknown>): number | undefined {
  if (typeof ch['number'] === 'number') return ch['number'];
  if (typeof ch['chapterNumber'] === 'number') return ch['chapterNumber'];
  if (typeof ch['chapterNumber'] === 'string') {
    const parsed = parseFloat(ch['chapterNumber']);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

/**
 * Compute chapter range from chapters array
 */
function computeChapterRange(chapters: Array<Record<string, unknown>>): { start?: number; end?: number } {
  const chapterNumbers: number[] = [];
  for (const ch of chapters) {
    const num = extractChapterNumber(ch);
    if (num !== undefined) chapterNumbers.push(num);
  }
  if (chapterNumbers.length === 0) return {};
  return { start: Math.min(...chapterNumbers), end: Math.max(...chapterNumbers) };
}

// ============================================================================
// Fandom Transformers
// ============================================================================

/**
 * Transform a single Fandom chapter to EnhancedChapterReference
 */
function transformFandomChapter(ch: Record<string, unknown>): NonNullable<EnhancedVolumeData['chapters']>[number] {
  const result: NonNullable<EnhancedVolumeData['chapters']>[number] = {
    number: extractChapterNumber(ch) ?? 0,
  };
  const title = ch['title'] as string | undefined;
  const url = ch['url'] as string | undefined;
  const coverImage = (ch['coverImage'] ?? ch['coverImageUrl']) as string | undefined;
  const summary = (ch['summary'] ?? ch['description']) as string | undefined;
  const releaseDate = ch['releaseDate'] as string | undefined;
  const pages = (ch['pages'] ?? ch['pageCount']) as number | undefined;

  if (title) result.title = title;
  if (url) result.url = url;
  if (coverImage) result.coverImage = coverImage;
  if (summary) result.summary = summary;
  if (releaseDate) result.releaseDate = releaseDate;
  if (pages) result.pages = pages;

  return result;
}

/**
 * Transform Fandom volume data to EnhancedVolumeData format
 *
 * Maps FandomVolumeDetail format to EnhancedVolumeData:
 * - Computes chapterStart/chapterEnd from chapters array
 * - Maps volumeNumber → number
 * - Maps chapterCount → totalChapters
 */
export function transformFandomVolumeData(volumes: unknown[]): EnhancedVolumeData[] {
  return volumes.map((vol) => {
    const fandomVol = vol as Record<string, unknown>;
    const chapters = fandomVol['chapters'] as Array<Record<string, unknown>> | undefined;
    const range = chapters?.length ? computeChapterRange(chapters) : {};

    const result: EnhancedVolumeData = {
      number: (fandomVol['number'] ?? fandomVol['volumeNumber'] ?? 0) as number,
    };

    // Conditionally add optional fields only if they have values
    const title = fandomVol['title'] as string | undefined;
    const description = fandomVol['description'] as string | undefined;
    const coverImage = (fandomVol['coverImage'] ?? fandomVol['coverImageUrl']) as string | undefined;
    const releaseDate = fandomVol['releaseDate'] as string | undefined;
    const isbn = fandomVol['isbn'] as string | undefined;
    const totalChapters = (fandomVol['totalChapters'] ?? fandomVol['chapterCount'] ?? chapters?.length) as number | undefined;

    if (title) result.title = title;
    if (description) result.description = description;
    if (coverImage) result.coverImage = coverImage;
    if (releaseDate) result.releaseDate = releaseDate;
    if (isbn) result.isbn = isbn;
    if (totalChapters) result.totalChapters = totalChapters;
    if (range.start !== undefined) result.chapterStart = range.start;
    if (range.end !== undefined) result.chapterEnd = range.end;
    if (chapters) result.chapters = chapters.map(transformFandomChapter);

    return result;
  });
}

/**
 * Extract Fandom volume data from various possible locations
 */
export function extractFandomVolumeData(meta: Record<string, unknown>): unknown[] {
  // Check fandom_chapters.metadata.volumeDetails
  const fandomChapters = meta['fandom_chapters'] as Record<string, unknown> | undefined;
  const fcMetadata = fandomChapters?.['metadata'] as Record<string, unknown> | undefined;
  if (Array.isArray(fcMetadata?.['volumeDetails'])) {
    logger.debug('[extractFandomVolumeData] Found at fandom_chapters.metadata.volumeDetails');
    return fcMetadata['volumeDetails'] as unknown[];
  }

  // Check FANDOM (uppercase key)
  const fandomUpper = meta['FANDOM'] as Record<string, unknown> | undefined;
  const upperData = fandomUpper?.['volumeDetails'] ?? fandomUpper?.['volumeList'] ?? fandomUpper?.['volumes'];
  if (Array.isArray(upperData)) {
    logger.debug('[extractFandomVolumeData] Found at FANDOM.*');
    return upperData;
  }

  // Check fandom (lowercase key)
  const fandomLower = meta['fandom'] as Record<string, unknown> | undefined;
  const lowerData = fandomLower?.['volumeDetails'] ?? fandomLower?.['volumeData'];
  if (Array.isArray(lowerData)) {
    logger.debug('[extractFandomVolumeData] Found at fandom.*');
    return lowerData;
  }

  // Check direct volumeDetails at root
  if (Array.isArray(meta['volumeDetails'])) {
    logger.debug('[extractFandomVolumeData] Found at root volumeDetails');
    return meta['volumeDetails'];
  }

  return [];
}

// ============================================================================
// ComicVine Transformers
// ============================================================================

/**
 * Transform ComicVine volume data to EnhancedVolumeData format
 *
 * Maps ComicVine-specific field names to standard EnhancedVolumeData fields:
 * - volumeSummary → description
 * - volumeNumber → number
 * - volumeTitle → title
 * - coverImageUrl → coverImage
 */
export function transformComicVineVolumeData(volumes: unknown[]): EnhancedVolumeData[] {
  return volumes.map((vol) => {
    const cvVol = vol as Record<string, unknown>;
    return {
      ...cvVol,
      // Map ComicVine field names to EnhancedVolumeData field names
      description: (cvVol['description'] as string | undefined) ?? (cvVol['volumeSummary'] as string | undefined),
      number: (cvVol['number'] as number | undefined) ?? (cvVol['volumeNumber'] as number | undefined) ?? 0,
      title: (cvVol['title'] as string | undefined) ?? (cvVol['volumeTitle'] as string | undefined),
      coverImage: (cvVol['coverImage'] as string | undefined) ?? (cvVol['coverImageUrl'] as string | undefined),
      // Also map themes and genres which may be present
      themes: cvVol['themes'] as string[] | undefined,
      genres: cvVol['genres'] as string[] | undefined,
    } as EnhancedVolumeData;
  });
}
