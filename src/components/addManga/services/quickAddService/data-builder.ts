/**
 * Quick Add Service - Data Builder
 *
 * Handles construction of form data and source metadata for import operations.
 * Transforms search results and field selections into wizard-compatible data structures.
 *
 * @module components/addManga/services/quickAddService/data-builder
 */

import { findBestMatchingResult } from '@/components/addManga/utils/result-matching';
import type { ExtendedMangaSearchResult } from '@/types/search.types';
import type { WizardFormData } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';


import type { AutoSelectResult, FetchedVolumeData, FieldSelectionMap, VolumesDataObject } from './types';

// ============================================================================
// Form Data Construction
// ============================================================================

/**
 * Construct wizard form data from search result and field selections
 *
 * Uses values from fieldSelections (which contain preferred provider data)
 * when available, falling back to searchResult values.
 */
export function constructFormData(
  searchResult: ExtendedMangaSearchResult,
  fieldSelections: FieldSelectionMap
): Partial<WizardFormData> {
  // Log what field selections we're applying
  logger.info('[data-builder] Applying field selections to form data', {
    fieldCount: Object.keys(fieldSelections).length,
    fields: Object.entries(fieldSelections).map(([field, sel]) => ({
      field,
      source: sel.source,
      hasValue: sel.value !== undefined && sel.value !== null && sel.value !== ''
    }))
  });

  return {
    title: getFieldValue('title', fieldSelections, searchResult.title),
    description: getFieldValue('description', fieldSelections, searchResult.description),
    coverUrl: getFieldValue('coverImage', fieldSelections, searchResult.coverImage ?? searchResult.cover),
    bannerUrl: getFieldValue('bannerImage', fieldSelections, searchResult.bannerImage),
    status: getFieldValue('status', fieldSelections, searchResult.status) as string | undefined,
    genres: getFieldValue('genres', fieldSelections, searchResult.genres),
    tags: getTagsValue(fieldSelections, searchResult),
    authors: getFieldValue('authors', fieldSelections, searchResult.authors),
    artists: getFieldValue('artists', fieldSelections, searchResult.artists),
    publisher: getFieldValue('publisher', fieldSelections, searchResult.publisher),
    format: getFieldValue('format', fieldSelections, searchResult.format),
    volumes: getFieldValue('volumes', fieldSelections, searchResult.volumes),
    chapters: getFieldValue('chapters', fieldSelections, searchResult.chapters),
    startDate: getDateValue('startDate', fieldSelections, typeof searchResult.startDate === 'string' ? searchResult.startDate : undefined),
    endDate: getDateValue('endDate', fieldSelections, typeof searchResult.endDate === 'string' ? searchResult.endDate : undefined),
    averageScore: getFieldValue('averageScore', fieldSelections, searchResult.averageScore),
    popularity: getFieldValue('popularity', fieldSelections, searchResult.popularity),
    alternativeTitles: getFieldValue('alternativeTitles', fieldSelections, searchResult.alternativeTitles),
    selectedSourceId: String(searchResult.id),
    searchProvider: searchResult.provider,
    externalIds: {
      anilistId: searchResult.anilistId !== undefined ? String(searchResult.anilistId) : '',
      malId: searchResult.malId !== undefined ? String(searchResult.malId) : '',
      comicVineId: searchResult.comicvineId ?? '',
      kitsuId: '',
      mangaUpdatesId: ''
    },
    fieldSelections
  } as Partial<WizardFormData>;
}

/**
 * Get field value from selections or fallback
 */
function getFieldValue<T>(fieldName: string, fieldSelections: FieldSelectionMap, fallback: T): T {
  const selection = fieldSelections[fieldName];
  if (selection?.value !== undefined && selection.value !== null && selection.value !== '') {
    return selection.value as T;
  }
  return fallback;
}

/**
 * Convert date values to string format
 * Handles: string dates, Date objects, and {year, month, day} objects from AniList
 */
function getDateValue(
  fieldName: string,
  fieldSelections: FieldSelectionMap,
  fallback: string | undefined
): string | undefined {
  const selection = fieldSelections[fieldName];
  const value: unknown = selection?.value ?? fallback;

  // Handle null/undefined/empty
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  // String date
  if (typeof value === 'string') {
    return value;
  }

  // Object types (Date or AniList date object)
  if (typeof value === 'object') {
    return convertDateObjectToString(fieldName, value as Record<string, unknown>);
  }

  // Unknown format - log and skip
  logger.info('[data-builder] Unknown date format', { fieldName, valueType: typeof value });
  return undefined;
}

/**
 * Convert a date object to string format
 */
function convertDateObjectToString(fieldName: string, value: Record<string, unknown>): string | undefined {
  // AniList-style date object: {year: number, month: number, day: number}
  if ('year' in value) {
    const dateObj = value as { year?: number | null; month?: number | null; day?: number | null };
    if (dateObj.year) {
      const year = dateObj.year;
      const month = dateObj.month ? String(dateObj.month).padStart(2, '0') : '01';
      const day = dateObj.day ? String(dateObj.day).padStart(2, '0') : '01';
      return `${year}-${month}-${day}`;
    }
    return undefined;
  }

  // Date object (check for getTime method which is unique to Date)
  if ('getTime' in value && typeof value['getTime'] === 'function') {
    return (value as unknown as Date).toISOString().split('T')[0]; // YYYY-MM-DD
  }

  // Unknown object format
  logger.info('[data-builder] Unknown date object format', { fieldName });
  return undefined;
}

/**
 * Get tags value with special processing for tag objects
 */
function getTagsValue(
  fieldSelections: FieldSelectionMap,
  searchResult: ExtendedMangaSearchResult
): string[] {
  const selection = fieldSelections['tags'];
  if (selection?.value !== undefined && selection.value !== null) {
    const tags = selection.value;
    if (Array.isArray(tags)) {
      return tags.map(t => typeof t === 'string' ? t : (t as { name: string }).name);
    }
  }
  // Fallback to searchResult tags
  if (Array.isArray(searchResult.tags)) {
    return searchResult.tags.map(t => typeof t === 'string' ? t : (t as { name: string }).name);
  }
  return [];
}

// ============================================================================
// Sources Metadata Building
// ============================================================================

/**
 * Build sources metadata from search results using smart matching
 *
 * IMPORTANT: If user has explicitly selected a result for a provider,
 * use that selection instead of title-based matching to preserve the
 * user's specific choice (e.g., correct language edition).
 */
export function buildSourcesMetadata(
  searchResult: ExtendedMangaSearchResult,
  allSearchResults: Record<string, ExtendedMangaSearchResult[]> | undefined,
  userSelectedMetadata?: Record<string, unknown>
): Record<string, unknown> {
  const sourcesMetadata: Record<string, unknown> = {};

  logger.debug('[data-builder] buildSourcesMetadata called', {
    primaryProvider: searchResult.provider,
    allSearchResultsKeys: allSearchResults ? Object.keys(allSearchResults) : [],
    userSelectedMetadataKeys: userSelectedMetadata ? Object.keys(userSelectedMetadata) : []
  });

  // Add primary provider metadata
  const primaryProvider = searchResult.provider;
  sourcesMetadata[primaryProvider] = {
    ...searchResult,
    rawData: searchResult.rawData,
    providerSpecific: searchResult.providerSpecific
  };

  // Add other provider metadata if available
  if (!allSearchResults) return sourcesMetadata;

  for (const [provider, results] of Object.entries(allSearchResults)) {
    // Skip if already have metadata for this provider
    if (sourcesMetadata[provider]) continue;

    const providerResult = getProviderMetadata(provider, results, searchResult, userSelectedMetadata);
    if (providerResult) {
      sourcesMetadata[provider] = providerResult.metadata;
    }
  }

  return sourcesMetadata;
}

/**
 * Get metadata for a single provider, prioritizing user selection over matching
 */
function getProviderMetadata(
  provider: string,
  results: ExtendedMangaSearchResult[],
  searchResult: ExtendedMangaSearchResult,
  userSelectedMetadata?: Record<string, unknown>
): { metadata: unknown; source: 'user-selected' | 'matched' } | null {
  const normalizedProvider = provider.toLowerCase();

  // PRIORITY 1: Use user's explicitly selected result for this provider
  const userSelection = userSelectedMetadata?.[provider] ?? userSelectedMetadata?.[normalizedProvider];
  if (userSelection && typeof userSelection === 'object') {
    const selectionData = userSelection as Record<string, unknown>;
    logger.debug('[data-builder] FOUND user-selected metadata for provider', {
      provider,
      title: selectionData['title'],
      id: selectionData['id']
    });
    return { metadata: userSelection, source: 'user-selected' };
  }

  // PRIORITY 2: Fall back to smart matching if no explicit selection
  const matchResult = findBestMatchingResult(searchResult, results, provider, {
    useProviderIds: true,
    useNormalizedTitle: true,
    useAlternativeTitles: true,
    similarityThreshold: 0.7,
    fallbackToFirst: true
  });

  if (matchResult) {
    logger.debug('[data-builder] Added source metadata for provider via matching', {
      provider,
      matchStrategy: matchResult.strategy,
      matchTitle: matchResult.result.title
    });
    return { metadata: matchResult.result, source: 'matched' };
  }

  return null;
}

// ============================================================================
// Auto Selection
// ============================================================================

/**
 * Auto-select all available volumes and chapters using fetched data
 *
 * @param searchResult - The primary search result
 * @param fetchedVolumeData - Volume data fetched from providers
 * @returns Selected volumes, chapters, and volumesData structure for import
 */
export function autoSelectVolumesChapters(
  searchResult: ExtendedMangaSearchResult,
  fetchedVolumeData: FetchedVolumeData | null
): AutoSelectResult {
  const selectedVolumes: (number | string)[] = [];
  const selectedChapters: unknown[] = [];

  // Use fetched volume data if available
  if (fetchedVolumeData && fetchedVolumeData.totalVolumes > 0) {
    return buildResultFromFetchedData(fetchedVolumeData, selectedVolumes);
  }

  // Fallback to search result volume count
  return buildResultFromSearchResult(searchResult, selectedVolumes, selectedChapters);
}

/**
 * Build auto-select result from fetched volume data
 */
function buildResultFromFetchedData(
  fetchedVolumeData: FetchedVolumeData,
  selectedVolumes: (number | string)[]
): AutoSelectResult {
  // Select all volumes from fetched data
  for (let i = 1; i <= fetchedVolumeData.totalVolumes; i++) {
    selectedVolumes.push(i);
  }

  // Cast to extended type to access secondary provider data
  type ExtendedData = FetchedVolumeData & {
    comicVineData?: FetchedVolumeData;
    fandomData?: FetchedVolumeData;
    secondaryData?: FetchedVolumeData;
  };
  const extendedData = fetchedVolumeData as ExtendedData;

  // Build volumesData structure with fetched details INCLUDING provider
  const volumesData: VolumesDataObject = {
    totalVolumes: fetchedVolumeData.totalVolumes,
    totalChapters: fetchedVolumeData.totalChapters,
    provider: fetchedVolumeData.provider
  };

  // Preserve secondary provider data for multi-source imports
  if (extendedData.comicVineData) {
    volumesData.comicVineData = extendedData.comicVineData;
  }
  if (extendedData.fandomData) {
    volumesData.fandomData = extendedData.fandomData;
  }
  if (extendedData.secondaryData) {
    volumesData.secondaryData = extendedData.secondaryData;
  }

  // Include volume details if available
  if (fetchedVolumeData.volumeDetails && fetchedVolumeData.volumeDetails.length > 0) {
    volumesData.volumes = fetchedVolumeData.volumeDetails;
  }

  logger.info('[data-builder] Using fetched volume data', {
    provider: fetchedVolumeData.provider,
    totalVolumes: fetchedVolumeData.totalVolumes,
    totalChapters: fetchedVolumeData.totalChapters,
    hasVolumeDetails: volumesData.volumes !== undefined,
    hasComicVineData: !!volumesData.comicVineData,
    hasFandomData: !!volumesData.fandomData,
    hasSecondaryData: !!volumesData.secondaryData
  });

  return { selectedVolumes, selectedChapters: [], volumesData };
}

/**
 * Build auto-select result from search result fallback
 */
function buildResultFromSearchResult(
  searchResult: ExtendedMangaSearchResult,
  selectedVolumes: (number | string)[],
  selectedChapters: unknown[]
): AutoSelectResult {
  const volumeCount = searchResult.volumes ?? 0;
  if (volumeCount > 0) {
    for (let i = 1; i <= volumeCount; i++) {
      selectedVolumes.push(i);
    }
  }

  // Build basic volumesData from search result (no provider - using search result fallback)
  const volumesData: VolumesDataObject = {};
  if (volumeCount > 0) {
    volumesData.totalVolumes = volumeCount;
  }
  if (searchResult.chapters !== undefined && searchResult.chapters > 0) {
    volumesData.totalChapters = searchResult.chapters;
  }

  return { selectedVolumes, selectedChapters, volumesData };
}
