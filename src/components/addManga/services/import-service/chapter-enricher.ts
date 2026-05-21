/**
 * Chapter Enricher Module
 *
 * Handles enriching chapters with cached metadata from external providers.
 * Extracts complex chapter enrichment logic to reduce cyclomatic complexity
 * of volume processing.
 *
 * Extracted from: importService.ts prepareVolumes method (lines 418-438)
 */

import { getUnknownProperty } from '@/utils/type-guards/safe-access';

import { isRecord } from './utils';

/**
 * Enrich a single chapter with cached metadata
 *
 * Merges cached metadata with chapter data, ensuring cached data doesn't
 * override critical chapter fields.
 *
 * @param chapter - Raw chapter data
 * @param chapterMetadataCache - Cache of metadata by chapter URL
 * @returns Enriched chapter data
 */
// eslint-disable-next-line complexity -- Complex chapter enrichment with multiple metadata sources
function enrichChapter(
  chapter: unknown,
  chapterMetadataCache: Map<string, unknown>
): unknown {
  if (!isRecord(chapter)) return chapter;

  const chapterUrl = getUnknownProperty(chapter, 'url');
  const cachedDataRaw = (typeof chapterUrl === 'string' && chapterUrl)
    ? chapterMetadataCache.get(chapterUrl)
    : null;
  const cachedData = isRecord(cachedDataRaw) ? cachedDataRaw : null;
  const chapterNum = getUnknownProperty(chapter, 'number') ?? getUnknownProperty(chapter, 'chapterNumber');

  return {
    ...chapter,
    // Merge cached data FIRST, then chapter data (so chapter data takes priority)
    ...(cachedData ?? {}),
    // Ensure critical fields from cached data are preserved
    title: getUnknownProperty(chapter, 'title')
      ?? (cachedData ? getUnknownProperty(cachedData, 'title') : null)
      ?? `Chapter ${chapterNum}`,
    coverImageUrl: getUnknownProperty(chapter, 'coverImageUrl')
      ?? (cachedData ? getUnknownProperty(cachedData, 'coverImageUrl') : null)
      ?? getUnknownProperty(chapter, 'coverUrl'),
    summary: getUnknownProperty(chapter, 'summary')
      ?? (cachedData ? getUnknownProperty(cachedData, 'summary') : null)
      ?? (cachedData ? getUnknownProperty(cachedData, 'description') : null)
      ?? getUnknownProperty(chapter, 'description'),
    description: getUnknownProperty(chapter, 'description')
      ?? (cachedData ? getUnknownProperty(cachedData, 'description') : null)
      ?? (cachedData ? getUnknownProperty(cachedData, 'summary') : null)
      ?? getUnknownProperty(chapter, 'summary'),
    number: getUnknownProperty(chapter, 'number') ?? getUnknownProperty(chapter, 'chapterNumber'),
    chapterNumber: getUnknownProperty(chapter, 'chapterNumber') ?? getUnknownProperty(chapter, 'number'),
    selected: true
  };
}

/**
 * Enrich multiple chapters with cached metadata
 *
 * @param chapters - Array of raw chapter data
 * @param chapterMetadataCache - Cache of metadata by chapter URL
 * @returns Array of enriched chapter data
 */
export function enrichChaptersWithMetadata(
  chapters: unknown[],
  chapterMetadataCache: Map<string, unknown>
): unknown[] {
  return chapters.map((chapter: unknown) => enrichChapter(chapter, chapterMetadataCache));
}
