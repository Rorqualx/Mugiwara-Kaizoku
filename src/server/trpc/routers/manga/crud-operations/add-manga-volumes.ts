/**
 * Add Manga Volume Persistence
 *
 * Helper functions for persisting volumes during manga import.
 * Ensures volume data (including ISBN) is saved to the normalized Volume table
 * during initial import, not just during metadata refresh.
 *
 * Volume Merging Strategy:
 * - User's selected source is ALWAYS prioritized for all fields
 * - Other providers only used as fallback for missing fields
 * - No hardcoded provider preferences that override user selection
 */

import {
  persistNormalizedVolumes,
  extractVolumeDataFromProvider
} from '@/server/services/metadataMerger/volume-persister';
import { DEFAULT_FIELD_PRIORITIES } from '@/types/search-types/configuration.types';
import type { EnhancedVolumeData } from '@/types/search-types/metadata.types';
import { logger } from '@/utils/logger';


// ============================================================================
// Types
// ============================================================================

type ProviderName = 'wikipedia' | 'fandom' | 'comicvine' | 'anilist';

/** All supported provider names for validation */
const ALL_PROVIDERS: ProviderName[] = ['wikipedia', 'fandom', 'comicvine', 'anilist'];

/**
 * Get provider fallback order from user preferences
 * Uses 'volumes' field preferences, falling back to defaults
 */
function getProviderFallbackOrder(preferences?: Record<string, string[]>): ProviderName[] {
  // Use user's volume preferences if available
  const volumePrefs = preferences?.['volumes'];
  if (volumePrefs && Array.isArray(volumePrefs) && volumePrefs.length > 0) {
    return volumePrefs.filter((p): p is ProviderName =>
      ['wikipedia', 'fandom', 'comicvine', 'anilist'].includes(p)
    );
  }
  // Fall back to DEFAULT_FIELD_PRIORITIES for volumes
  const defaultPrefs = DEFAULT_FIELD_PRIORITIES['volumes'];
  if (defaultPrefs && defaultPrefs.length > 0) {
    return defaultPrefs.filter((p): p is ProviderName =>
      ['wikipedia', 'fandom', 'comicvine', 'anilist'].includes(p)
    );
  }
  // Ultimate fallback
  return ['comicvine', 'anilist', 'fandom', 'wikipedia'];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Type guard to check if value is a record
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Extract provider metadata from rawProviderData
 */
function extractProviderMetadataFromRaw(
  rawProviderData: unknown
): Record<string, unknown> | null {
  if (!isRecord(rawProviderData)) {
    return null;
  }

  const providerMetadata = rawProviderData['providerMetadata'];
  if (!isRecord(providerMetadata)) {
    return null;
  }

  return providerMetadata;
}

/**
 * Check if a value is non-empty (not null, undefined, or empty string)
 */
function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  return true;
}

/**
 * Get the best value for a field from multiple provider volumes
 * Prioritizes the user's selected source first, then falls back using user preferences
 *
 * @param field - The field name to extract
 * @param providerVolumes - Map of provider volumes
 * @param userSelectedSource - The user's selected source (prioritized)
 * @param preferences - User's field provider preferences for fallback ordering
 * @returns The best value found, or undefined
 */
function getBestFieldValue<T>(
  field: string,
  providerVolumes: Map<ProviderName, EnhancedVolumeData>,
  userSelectedSource: ProviderName | null,
  preferences?: Record<string, string[]>
): T | undefined {
  // Get fallback order from user preferences
  const fallbackOrder = getProviderFallbackOrder(preferences);

  // Build provider order: user's selection first, then preference-based fallbacks
  const providerOrder: ProviderName[] = [];

  // User's selected source is ALWAYS first priority
  if (userSelectedSource && fallbackOrder.includes(userSelectedSource)) {
    providerOrder.push(userSelectedSource);
  }

  // Add remaining providers in preference order as fallbacks
  for (const provider of fallbackOrder) {
    if (!providerOrder.includes(provider)) {
      providerOrder.push(provider);
    }
  }

  // Try providers in order
  for (const provider of providerOrder) {
    const volume = providerVolumes.get(provider);
    if (volume) {
      const value = volume[field as keyof EnhancedVolumeData];
      if (hasValue(value)) {
        return value as T;
      }
    }
  }

  return undefined;
}

/**
 * Merge volumes from multiple providers into a single complete volume
 * Builds object conditionally to comply with exactOptionalPropertyTypes
 *
 * @param volumeNumber - The volume number being merged
 * @param providerVolumes - Map of provider volumes for this volume number
 * @param userSelectedSource - The user's selected source (prioritized for all fields)
 * @param preferences - User's field provider preferences for fallback ordering
 */
function mergeVolume(
  volumeNumber: number,
  providerVolumes: Map<ProviderName, EnhancedVolumeData>,
  userSelectedSource: ProviderName | null,
  preferences?: Record<string, string[]>
): EnhancedVolumeData {
  // Track which providers contributed to this volume
  const sources = Array.from(providerVolumes.keys());

  // Build merged object with only fields that have values
  // Use Record<string, unknown> to build, then cast to EnhancedVolumeData
  const merged: Record<string, unknown> = {
    number: volumeNumber,
  };

  // Helper to add field only if it has a value
  const addIfPresent = (field: string, value: unknown): void => {
    if (hasValue(value)) {
      merged[field] = value;
    }
  };

  // Add optional fields only if they have values
  // User's selected source is prioritized for ALL fields
  addIfPresent('title', getBestFieldValue<string>('title', providerVolumes, userSelectedSource, preferences));
  addIfPresent('subtitle', getBestFieldValue<string>('subtitle', providerVolumes, userSelectedSource, preferences));
  addIfPresent('alternativeTitle', getBestFieldValue<string>('alternativeTitle', providerVolumes, userSelectedSource, preferences));
  addIfPresent('description', getBestFieldValue<string>('description', providerVolumes, userSelectedSource, preferences));
  addIfPresent('summary', getBestFieldValue<string>('summary', providerVolumes, userSelectedSource, preferences));
  addIfPresent('isbn', getBestFieldValue<string>('isbn', providerVolumes, userSelectedSource, preferences));
  addIfPresent('isbn13', getBestFieldValue<string>('isbn13', providerVolumes, userSelectedSource, preferences));
  addIfPresent('publisher', getBestFieldValue<string>('publisher', providerVolumes, userSelectedSource, preferences));
  addIfPresent('pageCount', getBestFieldValue<number>('pageCount', providerVolumes, userSelectedSource, preferences));
  addIfPresent('releaseDate', getBestFieldValue<string>('releaseDate', providerVolumes, userSelectedSource, preferences));
  addIfPresent('coverImage', getBestFieldValue<string>('coverImage', providerVolumes, userSelectedSource, preferences));
  addIfPresent('chapterStart', getBestFieldValue<number>('chapterStart', providerVolumes, userSelectedSource, preferences));
  addIfPresent('chapterEnd', getBestFieldValue<number>('chapterEnd', providerVolumes, userSelectedSource, preferences));
  addIfPresent('totalChapters', getBestFieldValue<number>('totalChapters', providerVolumes, userSelectedSource, preferences));
  addIfPresent('sourceId', getBestFieldValue<string>('sourceId', providerVolumes, userSelectedSource, preferences));
  addIfPresent('sourceUrl', getBestFieldValue<string>('sourceUrl', providerVolumes, userSelectedSource, preferences));

  logger.debug(`[mergeVolume] Volume ${volumeNumber} merged from: ${sources.join(', ')}, user source: ${userSelectedSource ?? 'none'}`);

  return merged as unknown as EnhancedVolumeData;
}

// ============================================================================
// Volume Extraction Helpers
// ============================================================================

/**
 * Build combined metadata from raw provider data and direct provider metadata
 */
function buildCombinedMetadata(
  rawProviderData: unknown,
  providerMetadata: unknown
): Record<string, unknown> {
  const combined: Record<string, unknown> = {};

  const rawMeta = extractProviderMetadataFromRaw(rawProviderData);
  if (rawMeta) {
    Object.assign(combined, rawMeta);
  }

  if (isRecord(providerMetadata)) {
    Object.assign(combined, providerMetadata);
  }

  return combined;
}

/**
 * Extract volumes from all providers in combined metadata
 */
function extractVolumesFromAllProviders(
  combinedMetadata: Record<string, unknown>
): Map<ProviderName, EnhancedVolumeData[]> {
  const providerVolumesMap: Map<ProviderName, EnhancedVolumeData[]> = new Map();

  for (const provider of ALL_PROVIDERS) {
    const metadata = combinedMetadata[provider];
    if (!metadata) continue;

    const volumeData = extractVolumeDataFromProvider(metadata, provider);
    if (volumeData.length > 0) {
      providerVolumesMap.set(provider, volumeData);
      logger.info(`[extractVolumes] Found ${volumeData.length} volumes from ${provider}`);
    }
  }

  return providerVolumesMap;
}

/**
 * Group volumes by volume number across all providers
 */
function groupVolumesByNumber(
  providerVolumesMap: Map<ProviderName, EnhancedVolumeData[]>
): Map<number, Map<ProviderName, EnhancedVolumeData>> {
  const volumesByNumber: Map<number, Map<ProviderName, EnhancedVolumeData>> = new Map();

  for (const [provider, volumes] of providerVolumesMap) {
    for (const vol of volumes) {
      const volNum = vol.number;
      if (typeof volNum !== 'number' || volNum < 0) continue;

      if (!volumesByNumber.has(volNum)) {
        volumesByNumber.set(volNum, new Map());
      }
      volumesByNumber.get(volNum)?.set(provider, vol);
    }
  }

  return volumesByNumber;
}

/**
 * Merge and sort volumes from grouped provider data
 *
 * @param volumesByNumber - Map of volume numbers to provider volumes
 * @param userSelectedSource - The user's selected source (prioritized for all fields)
 * @param preferences - User's field provider preferences for fallback ordering
 */
function mergeAndSortVolumes(
  volumesByNumber: Map<number, Map<ProviderName, EnhancedVolumeData>>,
  userSelectedSource: ProviderName | null,
  preferences?: Record<string, string[]>
): EnhancedVolumeData[] {
  const merged: EnhancedVolumeData[] = [];

  for (const [volNum, providerVolumes] of volumesByNumber) {
    merged.push(mergeVolume(volNum, providerVolumes, userSelectedSource, preferences));
  }

  return merged.sort((a, b) => a.number - b.number);
}

/**
 * Log sample volume for debugging
 */
function logSampleVolume(volumes: EnhancedVolumeData[]): void {
  if (volumes.length === 0) return;

  const sample = volumes[0];
  logger.info(`[persistVolumes] Sample merged volume:`, {
    number: sample?.number,
    title: sample?.title,
    isbn: sample?.isbn,
    description: sample?.description ? `${sample.description.substring(0, 50)}...` : null,
    coverImage: sample?.coverImage ? 'present' : null,
    releaseDate: sample?.releaseDate
  });
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Persist volumes from import data to normalized Volume table
 *
 * This function:
 * 1. Extracts volume data from all available providers
 * 2. Merges volumes by number, using best values from each provider
 * 3. Persists the merged volumes to the database
 *
 * @param mangaId - ID of the manga to persist volumes for
 * @param rawProviderData - Raw provider data from import
 * @param providerMetadata - Provider metadata from import
 * @param source - User's selected source provider
 * @param preferences - User's field provider preferences for fallback ordering
 */
export async function persistVolumesFromImport(
  mangaId: number,
  rawProviderData: unknown,
  providerMetadata: unknown,
  source: string,
  preferences?: Record<string, string[]>
): Promise<void> {
  logger.info(`[persistVolumesFromImport] Starting intelligent volume merge for manga ${mangaId}`);

  // Debug: Log incoming data structure
  const rawDataKeys = isRecord(rawProviderData) ? Object.keys(rawProviderData) : [];
  const providerMetaKeys = isRecord(providerMetadata) ? Object.keys(providerMetadata) : [];
  logger.info(`[persistVolumesFromImport] Input data keys:`, {
    rawProviderDataKeys: rawDataKeys.slice(0, 10),
    providerMetadataKeys: providerMetaKeys,
    source
  });

  // Check if providerMetadata has fandom data with volumeDetails
  if (isRecord(providerMetadata)) {
    const fandomData = providerMetadata['fandom'] ?? providerMetadata['FANDOM'];
    if (isRecord(fandomData)) {
      const fandomVolDetails = fandomData['volumeDetails'];
      logger.info(`[persistVolumesFromImport] Fandom data check:`, {
        hasFandomKey: !!fandomData,
        fandomKeys: Object.keys(fandomData).slice(0, 10),
        hasVolumeDetails: !!fandomVolDetails,
        volumeDetailsLength: Array.isArray(fandomVolDetails) ? fandomVolDetails.length : 0
      });
    }
  }

  // Step 1: Build combined metadata
  const combinedMetadata = buildCombinedMetadata(rawProviderData, providerMetadata);
  if (Object.keys(combinedMetadata).length === 0) {
    logger.info(`[persistVolumesFromImport] No provider metadata found, skipping`);
    return;
  }

  // Debug: Log combined metadata structure
  logger.info(`[persistVolumesFromImport] Combined metadata keys:`, {
    keys: Object.keys(combinedMetadata),
    hasFandom: !!combinedMetadata['fandom'],
    hasAnilist: !!combinedMetadata['anilist'],
    hasWikipedia: !!combinedMetadata['wikipedia']
  });

  // Step 2: Extract volumes from all providers
  const providerVolumesMap = extractVolumesFromAllProviders(combinedMetadata);
  if (providerVolumesMap.size === 0) {
    logger.info(`[persistVolumesFromImport] No volume data found from any provider`);
    return;
  }

  // Normalize user's selected source
  const normalizedSource = source.toLowerCase() as ProviderName;
  const userSelectedSource = ALL_PROVIDERS.includes(normalizedSource) ? normalizedSource : null;

  // Step 3: Group and merge volumes (user's selection is prioritized for all fields)
  const volumesByNumber = groupVolumesByNumber(providerVolumesMap);
  const mergedVolumes = mergeAndSortVolumes(volumesByNumber, userSelectedSource, preferences);

  logger.info(`[persistVolumesFromImport] Merged ${mergedVolumes.length} volumes from ${providerVolumesMap.size} providers`);
  logSampleVolume(mergedVolumes);

  // Step 4: Persist to database
  // Use the source passed in from the caller (respects user selection or import profile)
  const contributingProviders = Array.from(providerVolumesMap.keys());
  const effectiveSource = userSelectedSource ?? 'anilist';

  logger.info(`[persistVolumesFromImport] Using source '${effectiveSource}' (passed: '${source}', contributors: ${contributingProviders.join(', ')})`);

  try {
    const result = await persistNormalizedVolumes({
      mangaId,
      volumes: mergedVolumes,
      source: effectiveSource
    });

    logger.info(
      `[persistVolumesFromImport] Persisted: created=${result.created}, ` +
      `updated=${result.updated}, linkedChapters=${result.linkedChapters}`
    );
  } catch (error) {
    logger.error(`[persistVolumesFromImport] Failed to persist volumes:`, error);
  }
}
