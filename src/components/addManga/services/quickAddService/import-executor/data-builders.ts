/**
 * Import Executor - Data Building Helpers
 *
 * Functions for building volume data, external IDs, and display sources.
 *
 * @module components/addManga/services/quickAddService/import-executor/data-builders
 */

import { logger } from '@/utils/logger';

import type { FetchedVolumeData, PerformImportOptions } from '../types';

// ============================================================================
// Volumes Data Building
// ============================================================================

/**
 * Build volumes data object from volumesData and searchResult
 */
export function buildVolumesDataObject(
  volumesData: PerformImportOptions['volumesData'],
  searchResult: PerformImportOptions['searchData']['searchResult']
): { volumes?: unknown[]; totalVolumes?: number; totalChapters?: number } {
  const volumesDataObj: { volumes?: unknown[]; totalVolumes?: number; totalChapters?: number } = {};

  if (volumesData.volumes && volumesData.volumes.length > 0) {
    volumesDataObj.volumes = volumesData.volumes;
  }

  const totalVolumes = volumesData.totalVolumes ?? searchResult.volumes;
  if (totalVolumes !== undefined && totalVolumes > 0) {
    volumesDataObj.totalVolumes = totalVolumes;
  }

  const totalChapters = volumesData.totalChapters ?? searchResult.chapters;
  if (totalChapters !== undefined && totalChapters > 0) {
    volumesDataObj.totalChapters = totalChapters;
  }

  logger.debug('[import-executor] Building volumesDataObj', {
    totalVolumes: volumesDataObj.totalVolumes,
    totalChapters: volumesDataObj.totalChapters,
    hasVolumesArray: !!volumesDataObj.volumes,
    provider: volumesData.provider
  });

  return volumesDataObj;
}

// ============================================================================
// External IDs Building
// ============================================================================

/**
 * Build external IDs object from search result
 */
export function buildExternalIds(
  searchResult: PerformImportOptions['searchData']['searchResult']
): { anilistId?: string; malId?: string; comicVineId?: string } {
  const externalIdsObj: { anilistId?: string; malId?: string; comicVineId?: string } = {};

  if (searchResult.anilistId !== undefined) {
    externalIdsObj.anilistId = String(searchResult.anilistId);
  }
  if (searchResult.malId !== undefined) {
    externalIdsObj.malId = String(searchResult.malId);
  }
  if (searchResult.comicvineId !== undefined) {
    externalIdsObj.comicVineId = searchResult.comicvineId;
  }

  return externalIdsObj;
}

// ============================================================================
// Display Source Determination
// ============================================================================

/**
 * Determine volume and chapter display sources
 */
export function determineDisplaySources(
  volumesData: PerformImportOptions['volumesData'],
  providerPreferences: PerformImportOptions['providerPreferences'],
  fallbackProvider: string
): { volumeDisplaySource: string; chapterDisplaySource: string } {
  const fetchedProvider = volumesData.provider;

  // providerPreferences always has values, but we prefer fetchedProvider if preferences are empty
  const volumePreference = providerPreferences.volumeProvider;
  const chapterPreferenceFromSettings = providerPreferences.chapterProvider;

  const fandomHasChapterUrls = checkFandomHasChapterUrls(volumesData);
  const chapterPreference = fandomHasChapterUrls ? 'fandom' : chapterPreferenceFromSettings;

  // Use preference first, then fetched provider, then fallback
  const volumeDisplaySource = selectDisplaySource(volumePreference, fetchedProvider, fallbackProvider);
  const chapterDisplaySource = selectDisplaySource(chapterPreference, fetchedProvider, fallbackProvider);

  logger.debug('[import-executor] Display source resolution', {
    volumePreference,
    chapterPreferenceFromSettings,
    fandomHasChapterUrls,
    volumeDisplaySource,
    chapterDisplaySource
  });

  return { volumeDisplaySource, chapterDisplaySource };
}

/**
 * Select display source with fallback chain
 */
function selectDisplaySource(preference: string, fetchedProvider: string | undefined, fallback: string): string {
  // If preference is a non-empty string, use it
  if (preference && preference.length > 0) {
    return preference;
  }
  // Otherwise try fetched provider
  if (fetchedProvider && fetchedProvider.length > 0) {
    return fetchedProvider;
  }
  // Final fallback
  return fallback;
}

/**
 * Check if Fandom data has chapters with URLs
 */
function checkFandomHasChapterUrls(volumesData: PerformImportOptions['volumesData']): boolean {
  const fandomVolumes = volumesData.fandomData?.volumes;
  if (!fandomVolumes) return false;

  return fandomVolumes.some((vol: unknown) => {
    const v = vol as Record<string, unknown>;
    const chapters = v['chapters'] as unknown[] | undefined;
    return volumeHasChapterUrls(chapters);
  });
}

/**
 * Check if chapters array has entries with URLs
 */
function volumeHasChapterUrls(chapters: unknown[] | undefined): boolean {
  if (!chapters) return false;
  return chapters.some((ch: unknown) => {
    const c = ch as Record<string, unknown>;
    return c['url'] !== undefined && c['url'] !== null && c['url'] !== '';
  });
}

// ============================================================================
// Provider Data Injection
// ============================================================================

/**
 * Inject provider data into sources metadata
 * Returns the updated metadata object
 */
export function injectProviderData(
  volumesData: PerformImportOptions['volumesData'],
  sourcesMetadata: Record<string, unknown>
): Record<string, unknown> {
  const fetchedProvider = volumesData.provider;
  let result = { ...sourcesMetadata };

  // Inject primary fetched data
  if (fetchedProvider && volumesData.volumes && volumesData.volumes.length > 0) {
    const primaryData: FetchedVolumeData = {
      provider: fetchedProvider,
      volumes: volumesData.volumes,
      totalVolumes: volumesData.totalVolumes ?? 0,
      totalChapters: volumesData.totalChapters ?? 0
    };
    result = applyProviderData(fetchedProvider, primaryData, result);
  }

  // Inject secondary provider data
  if (volumesData.comicVineData && volumesData.comicVineData.provider !== fetchedProvider) {
    result = applyProviderData('comicvine', volumesData.comicVineData, result);
  }
  if (volumesData.fandomData && volumesData.fandomData.provider !== fetchedProvider) {
    result = applyProviderData('fandom', volumesData.fandomData, result);
  }
  if (volumesData.secondaryData && volumesData.secondaryData.provider !== fetchedProvider) {
    result = applyProviderData(volumesData.secondaryData.provider, volumesData.secondaryData, result);
  }

  return result;
}

/**
 * Apply provider data to sources metadata
 * Returns a new metadata object with the provider data applied
 */
function applyProviderData(
  provider: string,
  data: FetchedVolumeData,
  sourcesMetadata: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...sourcesMetadata };
  const providerKey = Object.keys(result).find(
    k => k.toLowerCase() === provider.toLowerCase()
  );

  if (providerKey) {
    const existingMetadata = result[providerKey] as Record<string, unknown>;
    result[providerKey] = {
      ...existingMetadata,
      volumeDetails: data.volumes,
      volumeData: data.volumes,
      totalVolumes: data.totalVolumes,
      totalChapters: data.totalChapters
    };
  } else {
    result[provider] = {
      volumeDetails: data.volumes,
      volumeData: data.volumes,
      totalVolumes: data.totalVolumes,
      totalChapters: data.totalChapters
    };
  }

  return result;
}

// ============================================================================
// Provider Filtering
// ============================================================================

/**
 * Keep only the providers we actually need for chapter/volume creation
 *
 * Instead of sending ALL provider data, only send:
 * 1. The volume display source provider (for volume data)
 * 2. The chapter display source provider (for chapter data)
 * 3. The primary search result provider (for metadata)
 *
 * This can significantly reduce payload size while keeping all necessary data.
 */
export function filterToUsedProviders(
  sourcesMetadata: Record<string, unknown>,
  volumeSource: string,
  chapterSource: string,
  primaryProvider: string
): Record<string, unknown> {
  const neededProviders = new Set([
    volumeSource.toLowerCase(),
    chapterSource.toLowerCase(),
    primaryProvider.toLowerCase()
  ]);

  const result: Record<string, unknown> = {};

  for (const [provider, data] of Object.entries(sourcesMetadata)) {
    if (neededProviders.has(provider.toLowerCase())) {
      result[provider] = data;
    }
  }

  return result;
}

// ============================================================================
// Final Data Building
// ============================================================================

/**
 * Build final volumes data object
 */
export function buildFinalVolumesData(
  displayVolumes: Array<Record<string, unknown>>,
  volumesDataObj: { volumes?: unknown[]; totalVolumes?: number; totalChapters?: number }
): { volumes?: unknown[]; totalVolumes?: number; totalChapters?: number } {
  const calculatedTotalChapters = calculateTotalChapters(displayVolumes);

  const result: { volumes?: unknown[]; totalVolumes?: number; totalChapters?: number } = {};

  // Only set properties if they have values (for exactOptionalPropertyTypes)
  const volumes = displayVolumes.length > 0 ? displayVolumes : volumesDataObj.volumes;
  if (volumes !== undefined) {
    result.volumes = volumes;
  }

  const totalVolumes = displayVolumes.length > 0 ? displayVolumes.length : volumesDataObj.totalVolumes;
  if (totalVolumes !== undefined) {
    result.totalVolumes = totalVolumes;
  }

  const totalChapters = calculatedTotalChapters > 0 ? calculatedTotalChapters : volumesDataObj.totalChapters;
  if (totalChapters !== undefined) {
    result.totalChapters = totalChapters;
  }

  return result;
}

/**
 * Calculate total chapters from display volumes
 */
function calculateTotalChapters(displayVolumes: Array<Record<string, unknown>>): number {
  return displayVolumes.reduce((sum: number, vol) => {
    const chapters = vol['chapters'];
    const chapterCount = vol['chapterCount'] as number | undefined;
    return sum + (Array.isArray(chapters) ? chapters.length : (chapterCount ?? 0));
  }, 0);
}
