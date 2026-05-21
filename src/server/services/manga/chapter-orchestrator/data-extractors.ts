/**
 * Data Extraction Helpers for Chapter Orchestrator
 * Extracts chapter data from various source structures
 */

import { logger } from '@/utils/logger';

import { isRecord, safeGet } from './type-guards';

import type { ChapterEnrichment, SourceData } from './types';

/**
 * Extract issues from source data (ComicVine, etc.)
 * Complexity: 5
 */
export function extractIssues(sourceData: SourceData): unknown[] | undefined {
  const issues = sourceData.rawData?.issues ?? sourceData.metadata?.issues ?? sourceData.issues;
  return Array.isArray(issues) ? issues : undefined;
}

/**
 * Extract chapters from source data
 * Supports multiple provider formats including Wikipedia's chapterList
 * Complexity: 5
 */
export function extractChapters(sourceData: SourceData): unknown[] | undefined {
  // Check standard properties first, then Wikipedia-specific chapterList
  const chapters = sourceData.chapters ?? sourceData.rawData?.chapters ?? sourceData.metadata?.chapters ?? sourceData.chapterList;
  return Array.isArray(chapters) ? chapters : undefined;
}

/**
 * Extract volume data from source data
 * Supports multiple provider formats including Wikipedia's volumeList
 * Complexity: 3
 */
export function extractVolumeData(sourceData: SourceData): unknown[] | undefined {
  // Check standard volumeData first, then Wikipedia-specific volumeList
  const volumeData = sourceData.volumeData ?? sourceData.volumeList;
  return Array.isArray(volumeData) ? volumeData : undefined;
}

/**
 * Extract Fandom-specific data from source data
 * Complexity: 3
 */
export function extractFandomData(sourceData: SourceData): unknown | undefined {
  // DEBUG: Log what's available in sourceData
  logger.info('[extractFandomData] Checking sourceData:', {
    keys: Object.keys(sourceData),
    hasVolumeDetails: 'volumeDetails' in sourceData,
    hasVolumeData: 'volumeData' in sourceData,
    volumeDetailsType: typeof sourceData.volumeDetails,
    volumeDataType: typeof sourceData.volumeData,
    volumeDetailsIsArray: Array.isArray(sourceData.volumeDetails),
    volumeDataIsArray: Array.isArray(sourceData.volumeData),
    volumeDetailsLength: Array.isArray(sourceData.volumeDetails) ? sourceData.volumeDetails.length : 'N/A',
    volumeDataLength: Array.isArray(sourceData.volumeData) ? sourceData.volumeData.length : 'N/A',
  });

  const result = sourceData.volumeDetails ?? sourceData.volumeData;

  logger.info('[extractFandomData] Result:', {
    found: !!result,
    isArray: Array.isArray(result),
    length: Array.isArray(result) ? result.length : 'N/A',
  });

  return result;
}

/**
 * Build chapter enrichment from a single chapter record
 * Complexity: 8
 */
export function buildChapterEnrichment(chapter: Record<string, unknown>): ChapterEnrichment {
  const enrichment: ChapterEnrichment = {};

  const description = safeGet(chapter, 'description') ?? safeGet(chapter, 'summary');
  if (description) enrichment.summary = String(description);

  const coverImage = safeGet(chapter, 'coverImageUrl') ?? safeGet(chapter, 'coverUrl') ?? safeGet(chapter, 'coverImage');
  if (coverImage) enrichment.coverImage = String(coverImage);

  const pages = safeGet(chapter, 'pages');
  if (pages && typeof pages === 'number') enrichment.pages = pages;

  const releaseDate = safeGet(chapter, 'releaseDate');
  if (releaseDate) enrichment.releaseDate = String(releaseDate);

  const url = safeGet(chapter, 'url');
  if (url) enrichment.url = String(url);

  const title = safeGet(chapter, 'title');
  if (title) enrichment.title = String(title);

  const alternativeTitles = safeGet(chapter, 'alternativeTitles');
  if (Array.isArray(alternativeTitles)) enrichment.alternativeTitles = alternativeTitles.map(String);

  return enrichment;
}

/**
 * Process a single chapter and return enrichment entry
 * Complexity: 5
 */
export function processChapterEnrichment(
  chapter: unknown,
  chapterIndex: number
): { chapterNum: number; enrichment: ChapterEnrichment } | null {
  if (!isRecord(chapter)) return null;

  const chapterNumber = safeGet(chapter, 'chapterNumber') ?? safeGet(chapter, 'number') ?? chapterIndex;
  const enrichment = buildChapterEnrichment(chapter);

  if (Object.keys(enrichment).length > 0) {
    const chapterNum = typeof chapterNumber === 'number' ? chapterNumber : parseInt(String(chapterNumber), 10);
    return { chapterNum, enrichment };
  }

  return null;
}
