/**
 * Fandom Chapter Extractor
 *
 * Extracts chapter data from Fandom provider metadata.
 * Handles both 'volumeData' (wizard import) and 'volumeDetails' (legacy) field names.
 */

import { logger } from '@/utils/logger';

import { isRecord, getUnknownProperty } from '../utils';

import type { ChapterExtractionResult, ExtractedChapter } from './types';

/**
 * Extract chapters from Fandom provider data
 *
 * @param providerData - Fandom provider metadata
 * @returns Chapter extraction result with chapters array and shouldRecreate flag
 */
export function extractFandomChapters(providerData: unknown): ChapterExtractionResult {
  if (!isRecord(providerData)) {
    logger.info('Fandom provider data is not a record');
    return { chapters: [], shouldRecreate: false };
  }

  logger.info('[DEBUG] Entering Fandom chapter extraction');

  // Check both 'volumeData' (from wizard import) and 'volumeDetails' (legacy) field names
  const volumeDataDirect = getUnknownProperty(providerData, 'volumeData');
  const volumeDetailsDirect = getUnknownProperty(providerData, 'volumeDetails');
  const metadataFandom = getUnknownProperty(providerData, 'metadata');
  const volumeDataMeta = isRecord(metadataFandom) ? getUnknownProperty(metadataFandom, 'volumeData') : undefined;
  const volumeDetailsMeta = isRecord(metadataFandom) ? getUnknownProperty(metadataFandom, 'volumeDetails') : undefined;

  logger.info('[DEBUG] Field check results:', {
    volumeDataDirect: volumeDataDirect
      ? `Array(${Array.isArray(volumeDataDirect) ? volumeDataDirect.length : 'not array'})`
      : 'not found',
    volumeDetailsDirect: volumeDetailsDirect
      ? `Array(${Array.isArray(volumeDetailsDirect) ? volumeDetailsDirect.length : 'not array'})`
      : 'not found',
    volumeDataMeta: volumeDataMeta
      ? `Array(${Array.isArray(volumeDataMeta) ? volumeDataMeta.length : 'not array'})`
      : 'not found',
    volumeDetailsMeta: volumeDetailsMeta
      ? `Array(${Array.isArray(volumeDetailsMeta) ? volumeDetailsMeta.length : 'not array'})`
      : 'not found'
  });

  const volumeDetails = volumeDataDirect ?? volumeDetailsDirect ?? volumeDataMeta ?? volumeDetailsMeta;

  if (!volumeDetails) {
    // Log metadata counts if available
    logMetadataCounts(providerData, metadataFandom);
    return { chapters: [], shouldRecreate: false };
  }

  const selectedSource = volumeDataDirect ? 'volumeDataDirect' :
                        volumeDetailsDirect ? 'volumeDetailsDirect' :
                        volumeDataMeta ? 'volumeDataMeta' : 'volumeDetailsMeta';

  logger.info(`[DEBUG] Using field: ${selectedSource}`);

  return extractFromVolumeDetails(volumeDetails);
}

/**
 * Extract chapters from volume details array
 */
function extractFromVolumeDetails(volumeDetails: unknown): ChapterExtractionResult {
  const chapterData: ExtractedChapter[] = [];

  if (!Array.isArray(volumeDetails)) {
    logger.warn('[DEBUG] Volume details is not an array');
    return { chapters: [], shouldRecreate: false };
  }

  const volumeLength = volumeDetails.length;
  logger.info(`Found Fandom volume data with ${volumeLength} volumes`);

  let volumeCount = 0;
  let chapterCount = 0;

  for (const volume of volumeDetails) {
    if (!isRecord(volume)) continue;

    volumeCount++;

    const volumeNum = getUnknownProperty(volume, 'volumeNumber') ?? getUnknownProperty(volume, 'number');
    const chapters = getUnknownProperty(volume, 'chapters');

    logger.info(`[DEBUG] Processing volume ${volumeNum}: ${Array.isArray(chapters) ? chapters.length : 0} chapters`);

    if (!Array.isArray(chapters)) continue;

    for (const chapter of chapters) {
      if (!isRecord(chapter)) continue;

      chapterCount++;

      const chapterTitle = getUnknownProperty(chapter, 'title');
      const chapterNum = getUnknownProperty(chapter, 'chapterNumber') ?? getUnknownProperty(chapter, 'number');

      chapterData.push({
        title: (chapterTitle ?? `Chapter ${chapterNum}`) as string,
        volumeNumber: (getUnknownProperty(volume, 'volumeNumber') ?? getUnknownProperty(volume, 'number')) as number | undefined,
        chapterNumber: chapterNum as number | undefined,
        url: getUnknownProperty(chapter, 'url') as string | undefined,
        coverImage: getUnknownProperty(chapter, 'coverImage') as string | null | undefined,
        description: getUnknownProperty(chapter, 'summary') as string | null | undefined,
        pages: getUnknownProperty(chapter, 'pages') as number | undefined,
        releaseDate: getUnknownProperty(chapter, 'releaseDate') as Date | string | null | undefined,
        alternativeTitles: getUnknownProperty(chapter, 'alternativeTitles') as string[] | undefined
      });
    }
  }

  logger.info(`[DEBUG] Processed ${volumeCount} volumes, extracted ${chapterCount} chapters`);

  if (chapterData.length > 0) {
    logger.info(`[DEBUG] Setting shouldRecreateChapters=true with ${chapterData.length} chapters`);
    logger.info(`Extracted ${chapterData.length} chapters from Fandom data`);
    return { chapters: chapterData, shouldRecreate: true };
  }

  logger.warn('[DEBUG] No chapters extracted from Fandom volumeDetails despite having volumes');
  return { chapters: [], shouldRecreate: false };
}

/**
 * Log metadata counts if detailed volume data is not available
 */
function logMetadataCounts(
  providerData: Record<string, unknown>,
  metadataFandom: unknown
): void {
  const chaptersDirect = getUnknownProperty(providerData, 'chapters');
  const chaptersMeta = isRecord(metadataFandom) ? getUnknownProperty(metadataFandom, 'chapters') : undefined;
  const chapterCount = chaptersDirect ?? chaptersMeta;

  const volumesDirect = getUnknownProperty(providerData, 'volumes');
  const volumesMeta = isRecord(metadataFandom) ? getUnknownProperty(metadataFandom, 'volumes') : undefined;
  const volumeCount = volumesDirect ?? volumesMeta;

  if (chapterCount ?? volumeCount) {
    logger.info(
      `Fandom has metadata counts: ${chapterCount} chapters, ${volumeCount} volumes, but no detailed volume data`
    );
    // Note: We don't recreate chapters here as we don't have the detailed info
    // The counts will be updated in the metadata table through the updates object
  }
}
