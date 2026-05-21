/**
 * Build metadata from parsed Fandom data
 */

import type { ProviderMetadata } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';

/**
 * Infer publication status from dates when not directly available
 */
function inferStatusFromDates(startDate: unknown, endDate: unknown): string {
  const endDateStr = typeof endDate === 'string' ? endDate : undefined;
  const startDateStr = typeof startDate === 'string' ? startDate : undefined;

  // If we have an end date, it's completed
  if (endDateStr) {
    return 'COMPLETED';
  }

  // If we have a start date but no end date
  if (startDateStr) {
    const startDateObj = new Date(startDateStr);
    if (!isNaN(startDateObj.getTime()) && startDateObj > new Date()) {
      return 'UPCOMING';
    }
    return 'ONGOING';
  }

  return '';
}

/**
 * Build metadata from parsed Fandom data
 */
// eslint-disable-next-line complexity -- Complex Fandom metadata extraction from parsed data
export function buildMetadataFromParsedData(
  data: Record<string, unknown>,
  result: Record<string, unknown>,
  url: string
): ProviderMetadata {
  const metadata = {
    id: result['id'] ?? data['id'] ?? '',
    sourceId: result['sourceId'] ?? result['id'] ?? '',
    title: data['title'] ?? result['title'] ?? '',
    description: data['description'] ?? result['description'] ?? '',
    synopsis: data['synopsis'] ?? data['description'] ?? '',
    status: data['status'] ?? result['status'] ?? inferStatusFromDates(data['startDate'], data['endDate']),
    format: data['format'] ?? result['format'] ?? 'MANGA',
    genres: data['genres'] ?? result['genres'] ?? [],
    authors: data['authors'] ?? (data['author'] ? [data['author']] : []),
    artists: data['artists'] ?? (data['artist'] ? [data['artist']] : []),
    publisher: data['publisher'] ?? '',
    demographic: data['demographic'] ?? '',
    startDate: data['startDate'] ?? '',
    endDate: data['endDate'] ?? '',
    coverImage: data['coverImage'] ?? result['coverImage'] ?? '',
    alternativeTitles: data['alternativeTitles'] ?? [],
    url: url,
    wikiUrl: url,
    volumesListUrl: data['volumesListUrl'] ?? '',
    volumes: data['volumes'] ?? 0,
    chapters: data['chapters'] ?? 0,
    volumeData: data['volumeDetails'] ?? [],
    chapterData: data['chapterData'] ?? [],
    gallery: data['gallery'] ?? [],
    rawData: {}
  };

  // Store chapter data in rawData if not in volumeData
  const volumeDataArray = Array.isArray(metadata.volumeData) ? metadata.volumeData : [];
  const chaptersData = data['chapters'];
  if (volumeDataArray.length === 0 && Array.isArray(chaptersData)) {
    logger.info('[Fandom] Found chapters array in parsed data, storing in metadata.rawData');
    metadata.rawData = { chapters: chaptersData };
  }

  return metadata as ProviderMetadata;
}
