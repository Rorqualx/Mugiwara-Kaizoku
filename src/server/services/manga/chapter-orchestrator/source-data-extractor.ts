/**
 * Source Data Extraction
 * Extracts source data from provider metadata based on chapter source
 */

import { logger } from '@/utils/logger';

import type { ProviderMetadataRecord, SourceData } from './types';

/**
 * Extract source data from provider metadata using chapter source
 * Complexity: 3
 */
export function extractSourceData(
  providerMeta: ProviderMetadataRecord,
  chapterSource: string
): SourceData | undefined {
  // DEBUG: Log available keys in providerMeta
  logger.info('[extractSourceData] Looking for chapterSource:', {
    chapterSource,
    availableKeys: Object.keys(providerMeta),
    hasFandom: 'fandom' in providerMeta || 'FANDOM' in providerMeta,
  });

  const rawSourceData = providerMeta[chapterSource] ?? providerMeta[chapterSource.toUpperCase()];

  // DEBUG: Log what we found
  if (rawSourceData && typeof rawSourceData === 'object') {
    const sourceData = rawSourceData as SourceData;
    logger.info('[extractSourceData] Found source data:', {
      chapterSource,
      hasVolumeDetails: 'volumeDetails' in sourceData,
      hasVolumeData: 'volumeData' in sourceData,
      hasVolumeList: 'volumeList' in sourceData,
      hasChapters: 'chapters' in sourceData,
      hasChapterList: 'chapterList' in sourceData,
      volumeListLength: Array.isArray(sourceData.volumeList) ? sourceData.volumeList.length : 'N/A',
      chapterListLength: Array.isArray(sourceData.chapterList) ? sourceData.chapterList.length : 'N/A',
      keys: Object.keys(sourceData).slice(0, 15),
    });
  } else {
    logger.warn('[extractSourceData] No source data found for:', { chapterSource });
  }

  return rawSourceData && typeof rawSourceData === 'object' ? rawSourceData as SourceData : undefined;
}
