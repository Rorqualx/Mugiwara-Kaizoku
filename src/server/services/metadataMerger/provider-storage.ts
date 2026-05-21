/**
 * Provider Storage Module
 *
 * Functions for storing and retrieving provider metadata.
 * Handles extraction from rawProviderData, stored metadata,
 * and fresh API fetches.
 *
 * Extracted from: metadataMerger.ts
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import { searchProviderRegistry } from '../search/registerProviders';

import {
  isRecord,
  getUnknownProperty,
  RawProviderDataSchema,
  StoredMetadataSchema
} from './utils';
import {
  persistNormalizedVolumes,
  extractVolumeDataFromProvider
} from './volume-persister';

import type { Prisma } from '@prisma/client';


// ============================================================================
// Provider Key Helpers
// ============================================================================

/**
 * Get possible key variations for a provider name
 *
 * Different providers may have multiple key formats in stored metadata
 * (e.g., 'fandom' vs 'fandom_selected').
 *
 * @param provider - Provider name
 * @returns Array of possible key variations
 */
function getProviderKeys(provider: string): string[] {
  const baseKey = provider.toLowerCase();

  switch (baseKey) {
    case 'fandom':
      return ['fandom', 'fandom_selected'];
    case 'comicvine':
      return ['comicvine', 'comicvine_chapters', 'comicvine_volumes'];
    case 'wikipedia':
      return ['wikipedia', 'wikipedia_chapters'];
    default:
      return [baseKey];
  }
}

// ============================================================================
// Provider Metadata Extraction
// ============================================================================

/**
 * Extract provider metadata from rawProviderData (wizard import)
 *
 * Priority 1: This is the source of truth for wizard imports.
 *
 * @param rawProviderData - Raw provider data from manga record
 * @param uniqueProviders - Set of provider names to extract
 * @returns Object with metadata and success flag
 */
function extractFromRawProviderData(
  rawProviderData: unknown,
  uniqueProviders: Set<string>
): { metadata: Record<string, unknown>; success: boolean } {
  if (!rawProviderData) {
    return { metadata: {}, success: false };
  }

  try {
    // Parse rawProviderData if it's a JSON string
    const parsedRawData: unknown = typeof rawProviderData === 'string'
      ? (() => {
          try {
            const parsed: unknown = JSON.parse(rawProviderData as string);
            return parsed;
          } catch {
            return null;
          }
        })()
      : rawProviderData;

    // Validate structure
    const rawDataResult = RawProviderDataSchema.safeParse(parsedRawData);
    if (!rawDataResult.success) {
      logger.warn('Invalid rawProviderData format:', rawDataResult.error);
      return { metadata: {}, success: false };
    }

    const rawData = rawDataResult.data;
    const rawProviderMeta = rawData.providerMetadata;

    if (!isRecord(rawProviderMeta)) {
      return { metadata: {}, success: false };
    }

    // Extract provider metadata
    logger.info('Found providerMetadata in rawProviderData (wizard import data)');
    const metadata: Record<string, unknown> = {};
    let foundAny = false;

    for (const provider of uniqueProviders) {
      const providerKey = provider.toUpperCase();
      const providerData = getUnknownProperty(rawProviderMeta, provider) ?? getUnknownProperty(rawProviderMeta, providerKey);

      if (providerData) {
        metadata[provider] = providerData;
        foundAny = true;
        logger.info(`Using ${provider} metadata from rawProviderData (wizard import)`);
      }
    }

    return { metadata, success: foundAny };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error parsing rawProviderData:', errorMessage);
    return { metadata: {}, success: false };
  }
}

/**
 * Extract import profile from stored metadata
 *
 * @param storedMeta - Parsed stored metadata
 * @returns Import profile or null
 */
function extractImportProfile(storedMeta: unknown): unknown {
  if (!isRecord(storedMeta)) {
    return null;
  }

  const storedProfile = getUnknownProperty(storedMeta, 'importProfile');
  if (!isRecord(storedProfile)) {
    return null;
  }

  logger.info('Using import profile from stored metadata:', {
    primarySource: getUnknownProperty(storedProfile, 'primarySource'),
    chapterSource: getUnknownProperty(storedProfile, 'chapterSource'),
    volumeSource: getUnknownProperty(storedProfile, 'volumeSource')
  });

  return storedProfile;
}

/**
 * Extract provider-specific metadata using key variations
 *
 * @param storedMeta - Parsed stored metadata
 * @param uniqueProviders - Set of provider names to extract
 * @returns Map of provider metadata
 */
function extractProviderSpecificMetadata(
  storedMeta: unknown,
  uniqueProviders: Set<string>
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};

  if (!isRecord(storedMeta)) {
    return metadata;
  }

  for (const provider of uniqueProviders) {
    const providerKeys = getProviderKeys(provider);
    for (const key of providerKeys) {
      const data = getUnknownProperty(storedMeta, key);
      if (data) {
        metadata[provider] = data;
        logger.info(`Using stored ${provider} metadata (key: ${key})`);
        if (isRecord(data)) {
          logger.info(`${provider} metadata contains: volumes=${getUnknownProperty(data, 'volumes')}, chapters=${getUnknownProperty(data, 'chapters')}`);
        }
        break;
      }
    }
  }

  return metadata;
}

/**
 * Extract provider metadata from stored providerMetadata field
 *
 * Priority 2: Stored metadata from previous fetches or imports.
 *
 * @param mangaProviderMetadata - Stored provider metadata from manga record
 * @param uniqueProviders - Set of provider names to extract
 * @returns Object with metadata and import profile
 */
function extractFromStoredMetadata(
  mangaProviderMetadata: unknown,
  uniqueProviders: Set<string>
): { metadata: Record<string, unknown>; importProfile: unknown } {
  if (!mangaProviderMetadata) {
    return { metadata: {}, importProfile: null };
  }

  try {
    // Parse stored metadata if it's a JSON string
    const parsedStoredMeta: unknown = typeof mangaProviderMetadata === 'string'
      ? (() => {
          try {
            const parsed: unknown = JSON.parse(mangaProviderMetadata as string);
            return parsed;
          } catch {
            return null;
          }
        })()
      : mangaProviderMetadata;

    // Validate structure
    const storedMetaResult = StoredMetadataSchema.safeParse(parsedStoredMeta);
    if (!storedMetaResult.success) {
      logger.warn('Invalid stored metadata format:', storedMetaResult.error);
      return { metadata: {}, importProfile: null };
    }

    const storedMeta = storedMetaResult.data;

    // Extract import profile and provider metadata
    const importProfile = extractImportProfile(storedMeta);
    const metadata = extractProviderSpecificMetadata(storedMeta, uniqueProviders);

    return { metadata, importProfile };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error parsing stored provider metadata:', errorMessage);
    return { metadata: {}, importProfile: null };
  }
}

/**
 * Extract and prioritize provider metadata from multiple sources
 *
 * Priority order:
 * 1. rawProviderData (wizard import - source of truth)
 * 2. manga.providerMetadata (stored from previous fetches)
 * 3. Fresh API fetch (handled separately by fetchFreshProviderMetadata)
 *
 * @param manga - Manga record with metadata
 * @param uniqueProviders - Set of provider names to fetch
 * @param forceRefresh - Whether to fetch fresh data from APIs
 * @returns Object with providerMetadata map and flags
 */
export function extractStoredProviderMetadata(
  manga: unknown,
  uniqueProviders: Set<string>,
  forceRefresh: boolean
): Promise<{
  providerMetadata: Record<string, unknown>;
  usedRawProviderData: boolean;
  importProfile: unknown;
}> {
  // Get raw provider data
  const rawProviderData = isRecord(manga) ? getUnknownProperty(manga, 'rawProviderData') : undefined;

  // PRIORITY 1: Try rawProviderData (wizard import)
  const rawResult = extractFromRawProviderData(rawProviderData, uniqueProviders);
  if (rawResult.success) {
    return Promise.resolve({
      providerMetadata: rawResult.metadata,
      usedRawProviderData: true,
      importProfile: null
    });
  }

  // PRIORITY 2: Try stored metadata (if not force refreshing)
  if (!forceRefresh) {
    const mangaProviderMetadata = isRecord(manga) ? getUnknownProperty(manga, 'providerMetadata') : undefined;
    const storedResult = extractFromStoredMetadata(mangaProviderMetadata, uniqueProviders);
    return Promise.resolve({
      providerMetadata: storedResult.metadata,
      usedRawProviderData: false,
      importProfile: storedResult.importProfile
    });
  }

  // PRIORITY 3: Force refresh - return empty and let caller fetch fresh
  logger.info('Force refresh enabled - fetching fresh metadata from all providers');
  return Promise.resolve({
    providerMetadata: {},
    usedRawProviderData: false,
    importProfile: null
  });
}

// ============================================================================
// Fresh Metadata Fetching
// ============================================================================

/**
 * Provider instance interface for type safety
 */
interface ProviderInstance {
  search: (title: string) => Promise<unknown[]>;
  getMetadata?: (id: string) => Promise<unknown>;
}

/**
 * Find the best matching result from search results
 *
 * Matches exact title (case-insensitive) or returns the first result.
 *
 * @param searchResults - Array of search results
 * @param mangaTitle - Title to match against
 * @returns Best matching result or null
 */
function findBestMatch(searchResults: unknown[], mangaTitle: string): unknown | null {
  if (searchResults.length === 0) {
    return null;
  }

  const exactMatch = searchResults.find((r) =>
    isRecord(r) &&
    typeof getUnknownProperty(r, 'title') === 'string' &&
    String(getUnknownProperty(r, 'title')).toLowerCase() === mangaTitle.toLowerCase()
  );

  return exactMatch ?? searchResults[0] ?? null;
}

/**
 * Fetch full metadata from provider if available
 *
 * Falls back to the match if full metadata fetch fails.
 *
 * @param providerInstance - Provider instance with getMetadata method
 * @param match - The matched search result
 * @param provider - Provider name for logging
 * @returns Full metadata or the original match
 */
async function fetchFullMetadataIfAvailable(
  providerInstance: ProviderInstance,
  match: unknown,
  provider: string
): Promise<unknown> {
  // Check if provider supports full metadata fetch
  if (!providerInstance.getMetadata || !isRecord(match)) {
    if (isRecord(match)) {
      logger.info(`Found metadata from ${provider}: ${getUnknownProperty(match, 'title')}`);
    }
    return match;
  }

  const matchId = getUnknownProperty(match, 'id');
  if (!matchId) {
    if (isRecord(match)) {
      logger.info(`Found metadata from ${provider}: ${getUnknownProperty(match, 'title')}`);
    }
    return match;
  }

  try {
    logger.info(`Fetching full metadata from ${provider} for ID: ${matchId}`);
    const fullMetadata = await providerInstance.getMetadata(String(matchId));
    if (isRecord(fullMetadata)) {
      logger.info(`Got full metadata from ${provider}: ${getUnknownProperty(fullMetadata, 'title')}`);
    }
    return fullMetadata;
  } catch (metadataError: unknown) {
    logger.warn(`Failed to get full metadata from ${provider}, using search result:`, metadataError);
    return match;
  }
}

/**
 * Attempt direct metadata lookup by bound provider ID
 *
 * @param providerInstance - Provider instance with getMetadata method
 * @param provider - Provider name for logging
 * @param boundId - Bound provider ID
 * @returns Metadata result or null if lookup failed
 */
async function fetchMetadataByBoundId(
  providerInstance: ProviderInstance,
  provider: string,
  boundId: string
): Promise<{ provider: string; metadata: unknown } | null> {
  if (!providerInstance.getMetadata) return null;

  try {
    logger.info(`Fetching metadata from ${provider} by bound ID: ${boundId}`);
    const directMetadata = await providerInstance.getMetadata(boundId);
    if (directMetadata && isRecord(directMetadata)) {
      logger.info(`Got metadata from ${provider} via bound ID: ${getUnknownProperty(directMetadata, 'title')}`);
      return { provider, metadata: directMetadata };
    }
    return null;
  } catch (idError: unknown) {
    logger.warn(`Direct ID lookup failed for ${provider} (${boundId}), falling back to title search: ${idError instanceof Error ? idError.message : String(idError)}`);
    return null;
  }
}

/**
 * Fetch metadata from a single provider
 *
 * When a bound provider ID is available, uses direct ID lookup via getMetadata()
 * instead of title-based search. This ensures the correct edition/language is returned.
 *
 * @param provider - Provider name
 * @param mangaTitle - Title to search for
 * @param boundId - Optional bound provider ID for direct lookup
 * @returns Metadata or null if not found
 */
async function fetchSingleProviderMetadata(
  provider: string,
  mangaTitle: string,
  boundId?: string
): Promise<{ provider: string; metadata: unknown } | null> {
  try {
    const providerInstance = searchProviderRegistry.get(provider) as ProviderInstance | undefined;
    if (!providerInstance) {
      logger.warn(`Provider ${provider} not found in registry`);
      return null;
    }

    // Try direct ID lookup first when a bound ID exists
    if (boundId) {
      const directResult = await fetchMetadataByBoundId(providerInstance, provider, boundId);
      if (directResult) return directResult;
    }

    // Fall back to title search
    logger.info(`Fetching metadata from ${provider} for: ${mangaTitle}`);
    const searchResults = await providerInstance.search(mangaTitle);

    const bestMatch = findBestMatch(searchResults, mangaTitle);
    if (!bestMatch) {
      logger.warn(`No results from ${provider} for: ${mangaTitle}`);
      return null;
    }

    const metadata = await fetchFullMetadataIfAvailable(providerInstance, bestMatch, provider);
    return { provider, metadata };
  } catch (error: unknown) {
    logger.error(`Error fetching from ${provider}:`, error);
    return null;
  }
}

/**
 * Extract bound provider IDs from stored providerMetadata
 *
 * Reads the `providerId` field from each provider's binding entry.
 * These IDs are set when users explicitly bind a manga to a provider.
 *
 * @param storedProviderMetadata - Raw providerMetadata from the manga record
 * @returns Map of provider name to bound ID
 */
export function extractBoundProviderIds(storedProviderMetadata: unknown): Record<string, string> {
  const boundIds: Record<string, string> = {};

  const parsed: unknown = typeof storedProviderMetadata === 'string'
    ? (() => { try { return JSON.parse(storedProviderMetadata as string) as unknown; } catch { return null; } })()
    : storedProviderMetadata;

  if (!isRecord(parsed)) return boundIds;

  for (const [key, value] of Object.entries(parsed)) {
    if (!isRecord(value)) continue;
    const providerId = getUnknownProperty(value, 'providerId');
    if (typeof providerId === 'string' && providerId) {
      // Normalize keys to lowercase for consistent lookup (provider names are always lowercase)
      boundIds[key.toLowerCase()] = providerId;
    }
  }

  return boundIds;
}

/**
 * Fetch fresh provider metadata from APIs
 *
 * Only fetches for providers that:
 * 1. Don't already have data in providerMetadata map
 * 2. forceRefresh is enabled
 *
 * When bound provider IDs exist, uses direct ID lookup instead of title search
 * to ensure the correct edition/language is returned.
 *
 * @param providers - Set of provider names to fetch from
 * @param providerMetadata - Existing metadata map (will be mutated with new data)
 * @param mangaTitle - Manga title for searching
 * @param forceRefresh - Whether to fetch fresh data
 * @param boundIds - Optional map of provider name to bound ID for direct lookup
 * @returns Promise that resolves when all fetches complete
 */
/* eslint-disable no-param-reassign -- Function intentionally mutates providerMetadata parameter */
export async function fetchFreshProviderMetadata(
  providers: Set<string>,
  providerMetadata: Record<string, unknown>,
  mangaTitle: string,
  forceRefresh: boolean,
  boundIds?: Record<string, string>
): Promise<void> {
  // Build list of providers that need fetching
  const providersToFetch: string[] = [];

  for (const provider of providers) {
    if (providerMetadata[provider]) {
      logger.info(`Skipping ${provider} - already have metadata from rawProviderData or stored data`);
      continue;
    }
    if (!forceRefresh) {
      continue;
    }
    providersToFetch.push(provider);
  }

  if (providersToFetch.length === 0) {
    return;
  }

  // Fetch all providers in parallel, using bound IDs when available
  const results = await Promise.all(
    providersToFetch.map(provider =>
      fetchSingleProviderMetadata(provider, mangaTitle, boundIds?.[provider])
    )
  );

  // Apply results to metadata map
  for (const result of results) {
    if (result) {
      providerMetadata[result.provider] = result.metadata;
    }
  }
}
/* eslint-enable no-param-reassign */

// ============================================================================
// Provider Metadata Storage
// ============================================================================

/**
 * Parse and return existing provider metadata entries that are NOT present in newMetadata.
 * Preserves bindings for providers like wikipedia/mangadex when only anilist/comicvine are refreshed.
 */
function getPreservedProviderBindings(
  mangaProviderMetadata: unknown,
  newMetadata: Record<string, unknown>
): Record<string, unknown> {
  if (!mangaProviderMetadata) return {};

  const existingMeta: unknown = typeof mangaProviderMetadata === 'string'
    ? (() => { try { return JSON.parse(mangaProviderMetadata as string) as unknown; } catch { return null; } })()
    : mangaProviderMetadata;

  if (!isRecord(existingMeta)) return {};

  const preserved: Record<string, unknown> = {};
  const existingRecord = existingMeta as Record<string, unknown>;
  for (const [key, value] of Object.entries(existingRecord)) {
    if (!(key in newMetadata)) {
      preserved[key] = value;
    }
  }
  return preserved;
}

/**
 * Extract gallery images from multiple sources with priority fallback.
 * Checks rawProviderData, stored providerMetadata, and importProfile in order.
 */
function extractGalleryImages(
  rawProviderData: unknown,
  mangaProviderMetadata: unknown,
  importProfile: unknown
): unknown[] {
  const gallery =
    // PRIORITY 1: Top-level in rawProviderData (source of truth)
    (rawProviderData && typeof rawProviderData === 'object' && 'selectedGalleryImages' in rawProviderData
      ? (rawProviderData as Record<string, unknown>)['selectedGalleryImages']
      : undefined) ??
    // PRIORITY 2: Top-level in existing providerMetadata (new location)
    (mangaProviderMetadata && typeof mangaProviderMetadata === 'object' && 'selectedGalleryImages' in mangaProviderMetadata
      ? (mangaProviderMetadata as Record<string, unknown>)['selectedGalleryImages']
      : undefined) ??
    // PRIORITY 3: Nested in importProfile.mediaSelections (old location)
    (importProfile && isRecord(importProfile) && isRecord(getUnknownProperty(importProfile, 'mediaSelections'))
      ? getUnknownProperty(getUnknownProperty(importProfile, 'mediaSelections'), 'galleryImages')
      : undefined) ??
    [];

  return Array.isArray(gallery) ? gallery : [];
}

/**
 * Store provider metadata with preservation of existing data
 *
 * Preserves gallery images and import profile while updating provider metadata.
 * Handles backward compatibility for multiple storage locations of gallery images.
 *
 * @param mangaId - Database manga ID
 * @param manga - Current manga record
 * @param providerMetadata - Provider metadata to store
 * @param importProfile - Import profile to preserve (if any)
 * @param forceRefresh - Whether this is a force refresh operation
 */
export async function storeProviderMetadata(
  mangaId: number,
  manga: unknown,
  providerMetadata: Record<string, unknown>,
  importProfile: unknown,
  forceRefresh: boolean
): Promise<void> {
  // Skip if there's no data to store
  if (Object.keys(providerMetadata).length === 0) {
    logger.info('Skipping provider metadata storage (no metadata to store)');
    return;
  }

  // When not force-refreshing (e.g. wizard import), only store if there's NEW provider data
  // not yet persisted. This prevents overwriting existing data but allows wizard enrichment.
  if (!forceRefresh) {
    const existingMeta = isRecord(manga) ? getUnknownProperty(manga, 'providerMetadata') : undefined;
    const parsedExisting: unknown = typeof existingMeta === 'string'
      ? (() => { try { return JSON.parse(existingMeta as string) as unknown; } catch { return null; } })()
      : existingMeta;

    const hasNewData = Object.keys(providerMetadata).some(key =>
      !isRecord(parsedExisting) || getUnknownProperty(parsedExisting, key) === undefined
    );

    if (!hasNewData) {
      logger.info('Skipping provider metadata storage (no new provider data to persist)');
      return;
    }
    logger.info('Storing new provider metadata from wizard import (non-force-refresh)');
  }

  // Preserve the import profile when storing refreshed metadata
  const metadataToStore: Record<string, unknown> = { ...providerMetadata };
  if (importProfile) {
    metadataToStore['importProfile'] = importProfile;
  }

  // Extract variables from manga for preservation
  const rawProviderData = isRecord(manga) ? getUnknownProperty(manga, 'rawProviderData') : undefined;
  const mangaProviderMetadata = isRecord(manga) ? getUnknownProperty(manga, 'providerMetadata') : undefined;

  // Preserve existing provider bindings not included in this refresh
  const preserved = getPreservedProviderBindings(mangaProviderMetadata, metadataToStore);
  Object.assign(metadataToStore, preserved);

  // Preserve user-selected gallery images during metadata refresh
  const existingGalleryImages = extractGalleryImages(rawProviderData, mangaProviderMetadata, importProfile);
  if (existingGalleryImages.length > 0) {
    metadataToStore['selectedGalleryImages'] = existingGalleryImages;
    logger.info(`Preserved ${existingGalleryImages.length} user-selected gallery images during refresh`);
  }

  logger.info('Storing refreshed provider metadata back to database');
  await prisma.manga.update({
    where: { id: mangaId },
    data: {
      providerMetadata: metadataToStore as Prisma.InputJsonValue
    }
  });

  // Persist volumes to normalized Volume tables
  await persistVolumesToNormalizedTables(mangaId, providerMetadata);
}

/**
 * Persist volume data from provider metadata to normalized Volume tables
 *
 * Extracts volumeData from each provider and persists to the Volume model
 * with associated junction tables (creators, characters, themes, etc.).
 *
 * @param mangaId - Database manga ID
 * @param providerMetadata - Provider metadata containing volumeData
 */
async function persistVolumesToNormalizedTables(
  mangaId: number,
  providerMetadata: Record<string, unknown>
): Promise<void> {
  const providers: Array<'comicvine' | 'fandom' | 'anilist' | 'wikipedia'> = [
    'comicvine',
    'fandom',
    'anilist',
    'wikipedia'
  ];

  // Build list of persistence operations (parallel-safe with error isolation)
  const persistPromises = providers
    .filter(provider => {
      const metadata = providerMetadata[provider];
      if (!metadata) return false;
      const volumeData = extractVolumeDataFromProvider(metadata, provider);
      return volumeData.length > 0;
    })
    .map(async (provider) => {
      const metadata = providerMetadata[provider];
      const volumeData = extractVolumeDataFromProvider(metadata, provider);

      try {
        const result = await persistNormalizedVolumes({
          mangaId,
          volumes: volumeData,
          source: provider
        });

        logger.info(
          `Persisted ${provider} volumes: created=${result.created}, ` +
          `updated=${result.updated}, linkedChapters=${result.linkedChapters}`
        );
        return result;
      } catch (error) {
        logger.error(`Failed to persist ${provider} volumes for manga ${mangaId}:`, error);
        // Don't fail the entire operation if volume persistence fails
        return null;
      }
    });

  // Execute all persistence operations in parallel
  await Promise.allSettled(persistPromises);
}
