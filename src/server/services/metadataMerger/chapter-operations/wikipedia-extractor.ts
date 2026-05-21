/**
 * Wikipedia Chapter Extractor
 *
 * Extracts chapter data from Wikipedia provider metadata.
 * Handles both stored volumeList data and on-demand Wikipedia page fetching.
 */

import { logger } from '@/utils/logger';

import { isRecord, getUnknownProperty } from '../utils';

import type { ChapterExtractionResult, ExtractedChapter } from './types';

/**
 * Extract chapters from Wikipedia provider data
 *
 * @param providerData - Wikipedia provider metadata
 * @returns Chapter extraction result with chapters array and shouldRecreate flag
 */
export async function extractWikipediaChapters(
  providerData: unknown
): Promise<ChapterExtractionResult> {
  const chapterData: ExtractedChapter[] = [];

  if (!isRecord(providerData)) {
    logger.info('Wikipedia provider data is not a record');
    return { chapters: [], shouldRecreate: false };
  }

  // Check for volumeList in direct and nested metadata locations
  const volumeListDirect = getUnknownProperty(providerData, 'volumeList');
  const metadataObj = getUnknownProperty(providerData, 'metadata');
  const volumeListMeta = isRecord(metadataObj) ? getUnknownProperty(metadataObj, 'volumeList') : undefined;

  const volumeList = volumeListDirect ?? volumeListMeta;

  if (volumeList !== undefined) {
    // Extract from stored volumeList
    const extracted = extractFromVolumeList(volumeList);
    chapterData.push(...extracted);

    if (chapterData.length > 0) {
      logger.info(`Extracted ${chapterData.length} chapters from Wikipedia data`);
      return { chapters: chapterData, shouldRecreate: true };
    }
  } else {
    // Try to fetch Wikipedia page if not stored
    const fetched = await fetchAndExtractFromWikipedia(providerData);
    chapterData.push(...fetched);

    if (chapterData.length > 0) {
      logger.info(`Extracted ${chapterData.length} chapters from fetched Wikipedia data`);
      return { chapters: chapterData, shouldRecreate: true };
    }
  }

  return { chapters: [], shouldRecreate: false };
}

/**
 * Extract chapters from stored volumeList
 */
function extractFromVolumeList(volumeList: unknown): ExtractedChapter[] {
  const chapters: ExtractedChapter[] = [];

  if (!Array.isArray(volumeList)) {
    return chapters;
  }

  logger.info(`Found Wikipedia volume data with ${volumeList.length} volumes`);

  for (const volume of volumeList) {
    if (!isRecord(volume)) continue;

    const volumeChapters = getUnknownProperty(volume, 'chapters');
    if (!Array.isArray(volumeChapters)) continue;

    for (const chapter of volumeChapters) {
      if (!isRecord(chapter)) continue;

      const chapterTitle = getUnknownProperty(chapter, 'title');
      const titleStr = typeof chapterTitle === 'string' ? chapterTitle : '';

      // Skip romanization entries
      if (!titleStr || titleStr.toLowerCase().includes('hepburn') || titleStr.toLowerCase().includes('ja-latn')) {
        continue;
      }

      chapters.push({
        title: titleStr,
        volumeNumber: getUnknownProperty(volume, 'volumeNumber') as number | undefined,
        chapterNumber: (getUnknownProperty(chapter, 'chapterNumber') ?? getUnknownProperty(chapter, 'number')) as number | undefined,
        releaseDate: getUnknownProperty(chapter, 'releaseDate') as Date | string | null | undefined
      });
    }
  }

  return chapters;
}

/**
 * Fetch Wikipedia page and extract chapters
 */
async function fetchAndExtractFromWikipedia(providerData: Record<string, unknown>): Promise<ExtractedChapter[]> {
  const chapters: ExtractedChapter[] = [];

  logger.info('Wikipedia chapter data not stored, attempting to fetch');

  try {
    const urlValue = getUnknownProperty(providerData, 'url');
    const sourceValue = getUnknownProperty(providerData, 'source');
    const wikipediaUrl = urlValue ?? sourceValue;

    if (!wikipediaUrl) {
      logger.info('No Wikipedia URL found in provider data');
      return chapters;
    }

    const urlStr = typeof wikipediaUrl === 'string' ? wikipediaUrl : '';

    // Verify it's actually a Wikipedia URL
    if (!urlStr.includes('wikipedia.org')) {
      logger.info('URL is not a Wikipedia URL');
      return chapters;
    }

    logger.info(`Fetching Wikipedia page: ${urlStr}`);

    // Import required modules
    const axios = (await import('axios')).default;
    // TODO: FandomTableParser module is not available, using placeholder
    const parseVolumeTables = (_html: string): unknown[] => [];

    // Fetch the Wikipedia page
    const response = await axios.get(urlStr, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 30000
    });

    const html: unknown = response.data;
    const volumes = parseVolumeTables(typeof html === 'string' ? html : '');

    if (volumes.length === 0) {
      logger.info('No volumes parsed from Wikipedia page');
      return chapters;
    }

    logger.info(`Parsed ${volumes.length} volumes from Wikipedia`);

    // Extract chapters from parsed volumes
    for (const volume of volumes) {
      if (!isRecord(volume)) continue;

      const volumeChapters = getUnknownProperty(volume, 'chapters');
      if (!Array.isArray(volumeChapters)) continue;

      for (const chapter of volumeChapters) {
        if (!isRecord(chapter)) continue;

        const chapterTitle = getUnknownProperty(chapter, 'title');
        const titleStr = String(chapterTitle ?? '');

        // Skip romanization entries
        if (!titleStr || titleStr.toLowerCase().includes('hepburn') || titleStr.toLowerCase().includes('ja-latn')) {
          continue;
        }

        chapters.push({
          title: titleStr,
          volumeNumber: getUnknownProperty(volume, 'volumeNumber') as number | undefined,
          chapterNumber: (getUnknownProperty(chapter, 'chapterNumber') ?? getUnknownProperty(chapter, 'number')) as number | undefined,
          releaseDate: getUnknownProperty(chapter, 'releaseDate') as Date | string | null | undefined
        });
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error fetching Wikipedia chapter data: ${errorMessage}`);
  }

  return chapters;
}
