/**
 * URL Extraction Utilities
 *
 * Functions for extracting URLs from provider metadata.
 *
 * @module components/addManga/steps/wizard/volumes-chapters/utils/url-extraction
 */

import { isRecord, hasProperty } from '../types';

// ============================================================================
// Helper Functions
// ============================================================================

/** Helper to get non-empty string or undefined */
function getNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Extract URL from direct metadata properties */
function extractDirectUrls(
  metadata: Record<string, unknown>
): { siteDetailUrl: string | undefined; url: string | undefined } {
  const siteDetailUrl = hasProperty(metadata, 'siteDetailUrl')
    ? getNonEmptyString(metadata['siteDetailUrl'])
    : undefined;
  const url = hasProperty(metadata, 'url')
    ? getNonEmptyString(metadata['url'])
    : undefined;
  return { siteDetailUrl, url };
}

/** Extract site URL from a raw data object */
function extractUrlFromRawData(
  rawData: Record<string, unknown>
): string | undefined {
  // Check for snake_case first (API response)
  const siteUrl = hasProperty(rawData, 'site_detail_url')
    ? getNonEmptyString(rawData['site_detail_url'])
    : undefined;
  // Then camelCase (transformed data)
  const siteDetailUrl = hasProperty(rawData, 'siteDetailUrl')
    ? getNonEmptyString(rawData['siteDetailUrl'])
    : undefined;
  const url = hasProperty(rawData, 'url')
    ? getNonEmptyString(rawData['url'])
    : undefined;

  return siteUrl ?? siteDetailUrl ?? url;
}

/** Extract URL from rawData nested property */
function extractRawDataUrls(
  metadata: Record<string, unknown>
): string | undefined {
  // Check metadata.rawData (top-level rawData on the metadata object)
  const rawData =
    hasProperty(metadata, 'rawData') && isRecord(metadata['rawData'])
      ? metadata['rawData']
      : undefined;

  if (rawData) {
    const foundUrl = extractUrlFromRawData(rawData);
    if (foundUrl) return foundUrl;
  }

  // Also check metadata.metadata.rawData (nested metadata from provider)
  const nestedMetadata =
    hasProperty(metadata, 'metadata') && isRecord(metadata['metadata'])
      ? metadata['metadata']
      : undefined;

  if (nestedMetadata) {
    const nestedRawData =
      hasProperty(nestedMetadata, 'rawData') && isRecord(nestedMetadata['rawData'])
        ? nestedMetadata['rawData']
        : undefined;

    if (nestedRawData) {
      const foundUrl = extractUrlFromRawData(nestedRawData);
      if (foundUrl) return foundUrl;
    }
  }

  return undefined;
}

/** Construct ComicVine URL from ID */
function constructComicVineUrlFromId(
  metadata: Record<string, unknown>
): string | undefined {
  const id = hasProperty(metadata, 'id') ? metadata['id'] : undefined;
  const sourceId = hasProperty(metadata, 'sourceId') ? metadata['sourceId'] : undefined;
  const comicVineId = hasProperty(metadata, 'comicVineId') ? metadata['comicVineId'] : undefined;

  const idValue = id ?? sourceId ?? comicVineId;
  if (idValue === undefined || idValue === null) return undefined;

  const numericId = typeof idValue === 'number' ? idValue : parseInt(String(idValue), 10);
  if (isNaN(numericId) || numericId <= 0) return undefined;

  return `https://comicvine.gamespot.com/volume/4050-${numericId}/`;
}

/**
 * Construct Fandom URL from ID
 * ID format: "wiki-name:page-id" (e.g., "sakamoto-days:mw-194")
 * Also handles title-based construction when title looks like a page path
 *
 * NOTE: We preserve the "(Manga)" suffix if present because many wiki pages
 * are named with this suffix (e.g., "Sakamoto_Days_(Manga)").
 */
function constructFandomUrlFromId(
  metadata: Record<string, unknown>
): string | undefined {
  const id = hasProperty(metadata, 'id') ? metadata['id'] : undefined;
  const title = hasProperty(metadata, 'title') ? metadata['title'] : undefined;

  // Try to parse ID in format "wiki-name:page-id"
  if (typeof id === 'string' && id.includes(':')) {
    const [wikiName] = id.split(':');
    if (wikiName && wikiName.length > 0) {
      // Use the title to construct the page path
      const pageTitle = typeof title === 'string' ? title : wikiName;
      // Convert title to wiki URL format: replace spaces with underscores
      // Keep any suffix like "(Manga)" as wiki pages often use this naming convention
      const pagePath = pageTitle.replace(/\s+/g, '_');
      return `https://${wikiName}.fandom.com/wiki/${encodeURIComponent(pagePath)}`;
    }
  }

  return undefined;
}

// ============================================================================
// Main URL Extraction Functions
// ============================================================================

/**
 * Extract Fandom URL from metadata
 * Checks multiple locations where the URL might be stored:
 * - Direct properties: url, wikiUrl
 * - rawData: rawData.url, rawData.wikiUrl
 * - metadata: metadata.url, metadata.wikiUrl
 */
// eslint-disable-next-line complexity -- URL extraction checking 9+ possible storage locations; defensive handling for inconsistent data sources
export function extractFandomUrl(
  fandomMetadata: Record<string, unknown> | undefined
): string | undefined {
  if (!fandomMetadata) return undefined;

  // Check direct properties first
  const directUrl = hasProperty(fandomMetadata, 'url') ? fandomMetadata['url'] : undefined;
  const directWikiUrl = hasProperty(fandomMetadata, 'wikiUrl') ? fandomMetadata['wikiUrl'] : undefined;

  if (typeof directUrl === 'string' && directUrl.includes('fandom.com')) return directUrl;
  if (typeof directWikiUrl === 'string' && directWikiUrl.includes('fandom.com')) return directWikiUrl;

  // Check rawData nested properties
  const rawData = hasProperty(fandomMetadata, 'rawData') && isRecord(fandomMetadata['rawData'])
    ? fandomMetadata['rawData']
    : undefined;
  if (rawData) {
    const rawDataUrl = hasProperty(rawData, 'url') ? rawData['url'] : undefined;
    const rawDataWikiUrl = hasProperty(rawData, 'wikiUrl') ? rawData['wikiUrl'] : undefined;
    if (typeof rawDataUrl === 'string' && rawDataUrl.includes('fandom.com')) return rawDataUrl;
    if (typeof rawDataWikiUrl === 'string' && rawDataWikiUrl.includes('fandom.com')) return rawDataWikiUrl;
  }

  // Check metadata nested properties
  const metadata = hasProperty(fandomMetadata, 'metadata') && isRecord(fandomMetadata['metadata'])
    ? fandomMetadata['metadata']
    : undefined;
  if (metadata) {
    const metadataUrl = hasProperty(metadata, 'url') ? metadata['url'] : undefined;
    const metadataWikiUrl = hasProperty(metadata, 'wikiUrl') ? metadata['wikiUrl'] : undefined;
    if (typeof metadataUrl === 'string' && metadataUrl.includes('fandom.com')) return metadataUrl;
    if (typeof metadataWikiUrl === 'string' && metadataWikiUrl.includes('fandom.com')) return metadataWikiUrl;
  }

  // Fallback: return any string URL even without fandom.com check
  const result = directUrl ?? directWikiUrl;
  if (typeof result === 'string') return result;

  // Final fallback: construct URL from Fandom ID
  return constructFandomUrlFromId(fandomMetadata);
}

/**
 * Extract ComicVine URL from metadata
 *
 * Checks multiple locations where the URL might be stored:
 * - Direct siteDetailUrl/url property
 * - rawData.siteDetailUrl (from API response)
 * - rawData.url
 * - Construct from ID if available (fallback)
 */
export function extractComicVineUrl(
  comicvineMetadata: Record<string, unknown> | undefined
): string | undefined {
  if (!comicvineMetadata) return undefined;

  // Try direct properties first
  const { siteDetailUrl, url } = extractDirectUrls(comicvineMetadata);
  const directUrl = siteDetailUrl ?? url;
  if (directUrl) return directUrl;

  // Try rawData nested properties
  const rawDataUrl = extractRawDataUrls(comicvineMetadata);
  if (rawDataUrl) return rawDataUrl;

  // Fallback: construct from ID
  return constructComicVineUrlFromId(comicvineMetadata);
}

/**
 * Extract Wikipedia URL from metadata
 */
export function extractWikipediaUrl(
  wikipediaMetadata: Record<string, unknown> | undefined
): string | undefined {
  if (!wikipediaMetadata) return undefined;

  const rawData =
    hasProperty(wikipediaMetadata, 'rawData') && isRecord(wikipediaMetadata['rawData'])
      ? wikipediaMetadata['rawData']
      : undefined;
  const directUrl = hasProperty(wikipediaMetadata, 'wikipediaUrl')
    ? wikipediaMetadata['wikipediaUrl']
    : undefined;
  const rawDataUrl =
    rawData && hasProperty(rawData, 'wikipediaUrl') ? rawData['wikipediaUrl'] : undefined;
  const result = directUrl ?? rawDataUrl;

  return typeof result === 'string' ? result : undefined;
}
