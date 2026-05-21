/**
 * ML Data Extractors
 *
 * Helper functions for extracting data from ML pattern recognition results.
 * Reduces complexity of convertMLResultsToContent method.
 */

import { isRecord } from './types';

import type { VolumeInfo, ChapterInfo, ExtractedMetadata, TableData } from './types';


/**
 * Extract volume information from ML recognition data
 */
export function extractVolumesFromMLData(data: Record<string, unknown>): VolumeInfo[] {
  const volumes: VolumeInfo[] = [];
  const volumeData = data['volume'];

  if (!Array.isArray(volumeData)) {
    return volumes;
  }

  for (const item of volumeData) {
    if (!isRecord(item) || !item['volumeNumber']) {
      continue;
    }

    const title = item['title'] as string | undefined;
    const coverImage = item['coverImage'] as string | undefined;
    volumes.push({
      volumeNumber: item['volumeNumber'] as number,
      chapters: [],
      ...(title !== undefined && { title }),
      ...(coverImage !== undefined && { coverImage }),
    });
  }

  return volumes;
}

/**
 * Extract chapter information from ML recognition data
 */
export function extractChaptersFromMLData(data: Record<string, unknown>): ChapterInfo[] {
  const chapters: ChapterInfo[] = [];
  const chapterData = data['chapter'];

  if (!Array.isArray(chapterData)) {
    return chapters;
  }

  for (const item of chapterData) {
    if (!isRecord(item) || !item['chapterNumber']) {
      continue;
    }

    const title = item['title'] as string | undefined;
    const url = item['url'] as string | undefined;
    chapters.push({
      chapterNumber: String(item['chapterNumber']),
      ...(title !== undefined && { title }),
      ...(url !== undefined && { url }),
    });
  }

  return chapters;
}

/**
 * Extract metadata from ML infobox data
 * @param normalizeStatus - Function to normalize status strings to enum values
 */
export function extractMetadataFromMLInfobox(
  data: Record<string, unknown>,
  normalizeStatus: (status: string | undefined) => ExtractedMetadata['status'] | undefined
): ExtractedMetadata {
  const infobox = data['infobox'];

  if (!Array.isArray(infobox) || infobox.length === 0) {
    return {};
  }

  const infoboxData: unknown = infobox[0];

  if (!isRecord(infoboxData)) {
    return {};
  }

  const metadata: ExtractedMetadata = {};

  if (typeof infoboxData['author'] === 'string') {
    metadata.author = infoboxData['author'].split(',').map((s: string) => s.trim());
  }

  if (typeof infoboxData['artist'] === 'string') {
    metadata.artist = infoboxData['artist'].split(',').map((s: string) => s.trim());
  }

  if (typeof infoboxData['publisher'] === 'string') {
    metadata.publisher = infoboxData['publisher'];
  }

  if (typeof infoboxData['magazine'] === 'string') {
    metadata.magazine = infoboxData['magazine'];
  }

  if (typeof infoboxData['demographic'] === 'string') {
    metadata.demographic = infoboxData['demographic'];
  }

  if (typeof infoboxData['genres'] === 'string') {
    metadata.genres = infoboxData['genres'].split(',').map((s: string) => s.trim());
  }

  const normalizedStatus = normalizeStatus(
    typeof infoboxData['status'] === 'string' ? infoboxData['status'] : undefined
  );
  if (normalizedStatus) {
    metadata.status = normalizedStatus;
  }

  if (typeof infoboxData['original_run'] === 'string') {
    metadata.originalRun = infoboxData['original_run'];
  }

  return metadata;
}

/**
 * Extract cover image URL from ML recognition data
 */
export function extractCoverFromMLData(data: Record<string, unknown>): string | undefined {
  const coverImages = data['coverImage'];

  if (!Array.isArray(coverImages) || coverImages.length === 0) {
    return undefined;
  }

  const firstImage: unknown = coverImages[0];

  if (!isRecord(firstImage)) {
    return undefined;
  }

  return firstImage['url'] as string | undefined;
}

/**
 * Extract table data from ML recognition data
 */
export function extractTablesFromMLData(data: Record<string, unknown>): TableData[] {
  const tables: TableData[] = [];
  const tableData = data['table'];

  if (!Array.isArray(tableData)) {
    return tables;
  }

  for (const item of tableData) {
    if (!isRecord(item)) {
      continue;
    }

    tables.push({
      type: 'generic',
      headers: Array.isArray(item['headers']) ? item['headers'] as string[] : [],
      rows: Array.isArray(item['rows']) ? item['rows'] as string[][] : []
    });
  }

  return tables;
}
