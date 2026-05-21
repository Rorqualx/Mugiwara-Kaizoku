import type { ProviderMetadata, Volume, Chapter } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';

/**
 * Helper functions for extractBasicMetadata
 * Extracted to reduce complexity and improve maintainability
 */

interface MetadataSource {
  [key: string]: unknown;
}

/**
 * Extract title from result or metadata
 */
export function extractTitle(result: MetadataSource, metadata: MetadataSource): string {
  return (result['title'] ?? metadata['title'] ?? '') as string;
}

/**
 * Extract description/synopsis from result or metadata
 */
export function extractDescription(result: MetadataSource, metadata: MetadataSource): string {
  return (
    (result['description'] ?? (metadata['description'] ?? result['synopsis'])) ??
    metadata['synopsis'] ??
    ''
  ) as string;
}

/**
 * Extract status from result or metadata
 */
export function extractStatus(result: MetadataSource, metadata: MetadataSource): string {
  return (result['status'] ?? metadata['status'] ?? '') as string;
}

/**
 * Extract format/type from result or metadata
 */
export function extractFormat(result: MetadataSource, metadata: MetadataSource): string {
  return ((result['format'] ?? (result['type'] ?? metadata['format'])) ?? metadata['type'] ?? '') as string;
}

/**
 * Extract genres from result or metadata
 */
export function extractGenres(result: MetadataSource, metadata: MetadataSource): string[] {
  return (result['genres'] ?? metadata['genres'] ?? []) as string[];
}

/**
 * Extract tags from result or metadata
 */
export function extractTags(result: MetadataSource, metadata: MetadataSource): string[] {
  return (result['tags'] ?? metadata['tags'] ?? []) as string[];
}

/**
 * Extract authors from result or metadata
 */
export function extractAuthors(result: MetadataSource, metadata: MetadataSource): string[] {
  return (
    result['authors'] ??
    metadata['authors'] ??
    (result['author'] ? [result['author']] : [])
  ) as string[];
}

/**
 * Extract artists from result or metadata
 */
export function extractArtists(result: MetadataSource, metadata: MetadataSource): string[] {
  return (
    result['artists'] ??
    metadata['artists'] ??
    (result['artist'] ? [result['artist']] : [])
  ) as string[];
}

/**
 * Extract publisher name from a value that may be string or object
 * ComicVine returns { id, name }, other sources return string directly
 */
function extractPublisherName(publisher: unknown): string {
  if (typeof publisher === 'string') {
    return publisher;
  }
  if (publisher && typeof publisher === 'object' && 'name' in publisher) {
    const pubObj = publisher as { name: unknown };
    if (typeof pubObj.name === 'string') {
      return pubObj.name;
    }
  }
  return '';
}

/**
 * Extract publisher from result or metadata
 * Handles both string publishers and object publishers like { id, name }
 */
export function extractPublisher(result: MetadataSource, metadata: MetadataSource): string {
  const pub = result['publisher'] ?? metadata['publisher'];
  const extracted = extractPublisherName(pub);
  if (extracted) return extracted;
  // Fallback to deck (ComicVine short description) if no publisher
  return (result['deck'] ?? '') as string;
}

/**
 * Extract start date from result or metadata
 */
export function extractStartDate(result: MetadataSource, metadata: MetadataSource): string {
  return (
    (result['startDate'] ?? (metadata['startDate'] ?? result['releaseDate'])) ??
    metadata['releaseDate'] ??
    ''
  ) as string;
}

/**
 * Extract end date from result or metadata
 */
export function extractEndDate(result: MetadataSource, metadata: MetadataSource): string {
  return (result['endDate'] ?? metadata['endDate'] ?? '') as string;
}

/**
 * Extract cover image from result or metadata
 */
export function extractCoverImage(result: MetadataSource, metadata: MetadataSource): string | undefined {
  return (
    (result['coverImage'] ?? (result['coverUrl'] ?? metadata['coverImage'])) ??
    metadata['coverUrl'] ??
    ''
  ) as string | undefined;
}

/**
 * Extract banner image from result or metadata
 */
export function extractBannerImage(result: MetadataSource, metadata: MetadataSource): string | undefined {
  return (result['bannerImage'] ?? metadata['bannerImage'] ?? '') as string | undefined;
}

/**
 * Extract URL from result or metadata
 */
export function extractUrl(result: MetadataSource, metadata: MetadataSource): string | undefined {
  return (result['url'] ?? metadata['url'] ?? '') as string | undefined;
}

/**
 * Extract siteDetailUrl from result or metadata (ComicVine uses this for volume detail pages)
 * Checks both camelCase and snake_case variants
 */
export function extractSiteDetailUrl(result: MetadataSource, metadata: MetadataSource): string | undefined {
  const url = (
    result['siteDetailUrl'] ??
    result['site_detail_url'] ??
    metadata['siteDetailUrl'] ??
    metadata['site_detail_url'] ??
    ''
  ) as string;
  return url || undefined;
}

/**
 * Extract wikiUrl from result or metadata
 */
export function extractWikiUrl(result: MetadataSource, metadata: MetadataSource): string | undefined {
  const url = (result['wikiUrl'] ?? metadata['wikiUrl'] ?? '') as string;
  return url || undefined;
}

/**
 * Extract siteUrl from result or metadata
 */
export function extractSiteUrl(result: MetadataSource, metadata: MetadataSource): string | undefined {
  const url = (result['siteUrl'] ?? metadata['siteUrl'] ?? '') as string;
  return url || undefined;
}

/**
 * Extract alternative titles from result or metadata
 */
export function extractAlternativeTitles(result: MetadataSource, metadata: MetadataSource): string[] {
  return (result['alternativeTitles'] ?? metadata['alternativeTitles'] ?? []) as string[];
}

/**
 * Extract volumes count from result or metadata
 * For ComicVine, issues map to volumes
 */
export function extractVolumesCount(result: MetadataSource, metadata: MetadataSource): number {
  if (typeof result['volumes'] === 'number') {
    return result['volumes'];
  }
  if (typeof metadata['volumes'] === 'number') {
    return metadata['volumes'];
  }
  if (typeof result['issuesCount'] === 'number') {
    return result['issuesCount'];
  }
  return 0;
}

/**
 * Extract chapters count from result or metadata
 */
export function extractChaptersCount(result: MetadataSource, metadata: MetadataSource): number {
  if (typeof result['chapters'] === 'number') {
    return result['chapters'];
  }
  if (typeof metadata['chapters'] === 'number') {
    return metadata['chapters'];
  }
  return 0;
}

/**
 * Extract volume data array from result or metadata
 */
export function extractVolumeData(result: MetadataSource, metadata: MetadataSource): Volume[] {
  if (Array.isArray(result['volumeData'])) {
    return result['volumeData'] as Volume[];
  }
  if (Array.isArray(metadata['volumeData'])) {
    return metadata['volumeData'] as Volume[];
  }
  return [];
}

/**
 * Extract chapter data array from result or metadata
 */
export function extractChapterData(result: MetadataSource, metadata: MetadataSource): Chapter[] {
  if (Array.isArray(result['chapterData'])) {
    return result['chapterData'] as Chapter[];
  }
  if (Array.isArray(metadata['chapterData'])) {
    return metadata['chapterData'] as Chapter[];
  }
  return [];
}

/**
 * Log ComicVine-specific metadata for debugging
 */
export function logComicVineMetadata(result: MetadataSource, metadata: MetadataSource): void {
  if (result['provider'] === 'COMICVINE' || result['provider'] === 'comicvine') {
    logger.info('📚 [ComicVine] Extracting basic metadata:', {
      hasIssuesCount: 'issuesCount' in result,
      issuesCount: result['issuesCount'],
      hasVolumes: 'volumes' in result,
      volumes: result['volumes'],
      hasChapters: 'chapters' in result,
      chapters: result['chapters'],
      hasMetadata: !!metadata,
      metadataVolumes: metadata['volumes'],
      metadataChapters: metadata['chapters'],
      publisher: result['publisher'] ?? metadata['publisher'],
      allKeys: Object.keys(result),
      hasResultVolumeData: Array.isArray(result['volumeData']),
      resultVolumeDataLength: Array.isArray(result['volumeData']) ? (result['volumeData'] as unknown[]).length : 0,
      hasResultMetadataVolumeData: Array.isArray(metadata['volumeData']),
      resultMetadataVolumeDataLength: Array.isArray(metadata['volumeData'])
        ? (metadata['volumeData'] as unknown[]).length
        : 0,
      hasMetadataVolumeData: Array.isArray(metadata['volumeData']),
      metadataVolumeDataLength: Array.isArray(metadata['volumeData'])
        ? (metadata['volumeData'] as unknown[]).length
        : 0,
      volumeDataSample: Array.isArray(metadata['volumeData']) ? (metadata['volumeData'] as unknown[])[0] : undefined
    });
  }
}

/**
 * Build complete ProviderMetadata object from extracted fields
 */
export function buildProviderMetadata(
  result: MetadataSource,
  metadata: MetadataSource
): ProviderMetadata {
  return {
    id: (result['id'] ?? '') as string,
    sourceId: (result['sourceId'] ?? result['id'] ?? '') as string,
    title: extractTitle(result, metadata),
    description: extractDescription(result, metadata),
    status: extractStatus(result, metadata),
    format: extractFormat(result, metadata),
    genres: extractGenres(result, metadata),
    tags: extractTags(result, metadata),
    authors: extractAuthors(result, metadata),
    artists: extractArtists(result, metadata),
    publisher: extractPublisher(result, metadata),
    startDate: extractStartDate(result, metadata),
    endDate: extractEndDate(result, metadata),
    coverImage: extractCoverImage(result, metadata),
    bannerImage: extractBannerImage(result, metadata),
    url: extractUrl(result, metadata),
    siteDetailUrl: extractSiteDetailUrl(result, metadata),
    wikiUrl: extractWikiUrl(result, metadata),
    siteUrl: extractSiteUrl(result, metadata),
    alternativeTitles: extractAlternativeTitles(result, metadata),
    volumes: extractVolumesCount(result, metadata),
    chapters: extractChaptersCount(result, metadata),
    volumeData: extractVolumeData(result, metadata),
    chapterData: extractChapterData(result, metadata)
  } as ProviderMetadata;
}
