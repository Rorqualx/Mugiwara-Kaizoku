/**
 * Provider-Specific Data Extractor
 *
 * Extracts provider-specific metadata fields based on the source provider.
 * Supports: ComicVine, AniList, Fandom, Wikipedia
 *
 * Extracted from: type-adapters.ts (lines 294-347)
 */

import type { ProviderSpecificData } from './utils';

// ============================================================================
// Provider-Specific Extractors
// ============================================================================

/**
 * Extract ComicVine-specific data
 * @param resultObj - The search result object
 * @returns Provider-specific data object
 */
function extractComicVineData(resultObj: Record<string, unknown>): ProviderSpecificData {
  const data: ProviderSpecificData = {};

  if (resultObj['issues']) data['issues'] = resultObj['issues'];
  if (resultObj['issueCount'] !== undefined) data['issueCount'] = resultObj['issueCount'];
  if (resultObj['creators']) data['creators'] = resultObj['creators'];
  if (resultObj['siteDetailUrl']) data['siteDetailUrl'] = resultObj['siteDetailUrl'];
  if (resultObj['deck']) data['deck'] = resultObj['deck'];
  if (resultObj['characters']) data['characters'] = resultObj['characters'];

  return data;
}

/**
 * Extract AniList-specific data
 * @param resultObj - The search result object
 * @returns Provider-specific data object
 */
function extractAniListData(resultObj: Record<string, unknown>): ProviderSpecificData {
  const data: ProviderSpecificData = {};

  if (resultObj['mediaId'] !== undefined) data['mediaId'] = resultObj['mediaId'];
  if (resultObj['idMal'] !== undefined) data['idMal'] = resultObj['idMal'];
  if (resultObj['siteUrl']) data['siteUrl'] = resultObj['siteUrl'];

  // Check in rawData too
  const rawData = resultObj['rawData'] as Record<string, unknown> | undefined;
  if (rawData?.['mediaId']) data['mediaId'] = rawData['mediaId'];

  return data;
}

/**
 * Extract Fandom-specific data
 * @param resultObj - The search result object
 * @returns Provider-specific data object
 */
function extractFandomData(resultObj: Record<string, unknown>): ProviderSpecificData {
  const data: ProviderSpecificData = {};

  if (resultObj['wikiUrl']) data['wikiUrl'] = resultObj['wikiUrl'];
  if (resultObj['volumeList']) data['volumeList'] = resultObj['volumeList'];
  if (resultObj['parsedFromWiki'] !== undefined) data['parsedFromWiki'] = resultObj['parsedFromWiki'];

  return data;
}

/**
 * Extract Wikipedia-specific data
 * @param resultObj - The search result object
 * @returns Provider-specific data object
 */
function extractWikipediaData(resultObj: Record<string, unknown>): ProviderSpecificData {
  const data: ProviderSpecificData = {};

  if (resultObj['wikipediaUrl']) data['wikipediaUrl'] = resultObj['wikipediaUrl'];
  if (resultObj['infoboxData']) data['infoboxData'] = resultObj['infoboxData'];
  if (resultObj['volumeList']) data['volumeList'] = resultObj['volumeList'];

  return data;
}

/**
 * Extract common fields present across providers
 * @param resultObj - The search result object
 * @returns Common provider data
 */
function extractCommonFields(resultObj: Record<string, unknown>): ProviderSpecificData {
  const data: ProviderSpecificData = {};

  // Store raw data if present
  if (resultObj['rawData']) {
    data['raw'] = resultObj['rawData'];
  }

  return data;
}

/**
 * Apply fallback character extraction
 * @param resultObj - The search result object
 * @param data - Accumulated provider data
 * @returns Updated provider data with character fallback applied
 */
function applyCharacterFallback(resultObj: Record<string, unknown>, data: ProviderSpecificData): ProviderSpecificData {
  // Check for characters in various locations
  if (resultObj['characters'] && !data['characters']) {
    return { ...data, characters: resultObj['characters'] };
  }
  return data;
}

/**
 * Merge provider-specific fields from nested providerSpecific object
 * @param resultObj - The search result object
 * @param data - Accumulated provider data
 * @returns Updated provider data with merged fields
 */
function mergeProviderSpecificFields(resultObj: Record<string, unknown>, data: ProviderSpecificData): ProviderSpecificData {
  // Store any provider-specific fields from providerSpecific
  if (resultObj['providerSpecific']) {
    return { ...data, ...(resultObj['providerSpecific'] as Record<string, unknown>) };
  }
  return data;
}

// ============================================================================
// Main Extractor
// ============================================================================

/**
 * Extract provider-specific data from search result
 *
 * Different providers include unique fields that don't fit
 * the unified schema. This function preserves that data.
 *
 * Supported providers:
 * - ComicVine: issues, issueCount, creators, siteDetailUrl, deck, characters
 * - AniList: mediaId, idMal, siteUrl
 * - Fandom: wikiUrl, volumeList, parsedFromWiki
 * - Wikipedia: wikipediaUrl, infoboxData, volumeList
 *
 * @param result - The search result object
 * @param provider - The provider name (case-insensitive)
 * @returns Provider-specific data object
 */
export function extractProviderData(result: unknown, provider: string): ProviderSpecificData {
  const resultObj = result as Record<string, unknown>;

  // Extract common fields
  let data = extractCommonFields(resultObj);

  // Extract provider-specific data
  const providerKey = provider.toLowerCase();
  let providerData: ProviderSpecificData = {};

  if (providerKey === 'comicvine') {
    providerData = extractComicVineData(resultObj);
  } else if (providerKey === 'anilist') {
    providerData = extractAniListData(resultObj);
  } else if (providerKey === 'fandom') {
    providerData = extractFandomData(resultObj);
  } else if (providerKey === 'wikipedia') {
    providerData = extractWikipediaData(resultObj);
  }

  // Merge provider-specific data
  data = { ...data, ...providerData };

  // Apply fallbacks and merge additional fields
  data = applyCharacterFallback(resultObj, data);
  data = mergeProviderSpecificFields(resultObj, data);

  return data;
}
