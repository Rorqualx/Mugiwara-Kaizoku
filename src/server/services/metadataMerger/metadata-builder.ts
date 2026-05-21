/**
 * Metadata Builder Module
 *
 * Functions for building and transforming metadata objects.
 * Handles configuration, parsing, and field mapping.
 *
 * Extracted from: metadataMerger.ts
 */

import { DEFAULT_FIELD_PRIORITIES } from '@/types/search-types/configuration.types';
import type { UnifiedMangaMetadata } from '@/types/search.types';
import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';

import {
  isRecord,
  getUnknownProperty,
  type ExtendedProviderMetadata,
  MangaPublicationStatus,
  MangaFormat
} from './utils';


import type { MergeConfig } from '../metadata/unified-merger';


// ============================================================================
// Configuration & Parsing
// ============================================================================

/**
 * Build merger priorities from user preferences
 *
 * Converts user's field provider preferences into merger priority config.
 * Uses the 'description' field preference as the general priority order,
 * since description is a core field that reflects overall preference.
 *
 * @param preferences - User's field provider preferences (field -> provider array)
 * @returns Array of provider priorities for the merger
 */
function buildPrioritiesFromPreferences(
  preferences?: Record<string, string[]>
): Array<{ provider: string; priority: number }> {
  // Get the priority order - use description as representative, fall back to defaults
  const prefs = preferences ?? DEFAULT_FIELD_PRIORITIES;
  const providerOrder = prefs['description'] ?? DEFAULT_FIELD_PRIORITIES['description'] ?? ['anilist', 'mangadex', 'comicvine', 'fandom', 'wikipedia'];

  // Convert to priority format (first = highest priority = 100, decrement by 10)
  return providerOrder.map((provider, index) => ({
    provider: provider.toLowerCase(),
    priority: 100 - (index * 10)
  }));
}

/**
 * Get merger configuration, optionally using user preferences
 *
 * @param preferences - Optional user field provider preferences
 * @returns Merger configuration with priorities based on preferences
 */
export function getMergerConfig(preferences?: Record<string, string[]>): MergeConfig {
  return {
    priorities: buildPrioritiesFromPreferences(preferences),
    conflictResolution: 'highest_priority',
    mergeArrays: true,
    deduplicateArrays: true,
    preferNonNull: true
  };
}

/**
 * Get default configuration for UnifiedMetadataMerger
 *
 * @deprecated Use getMergerConfig(preferences) instead to respect user preferences
 * @returns Default merger configuration using DEFAULT_FIELD_PRIORITIES
 */
export function getDefaultMergerConfig(): MergeConfig {
  return getMergerConfig();
}

/**
 * Parse provider metadata from JSON to ExtendedProviderMetadata type
 *
 * @param providerMetadata - The raw provider metadata from database
 * @returns Parsed ExtendedProviderMetadata or null if parsing fails
 */
export function parseProviderMetadata(providerMetadata: unknown): ExtendedProviderMetadata | null {
  try {
    if (!providerMetadata || typeof providerMetadata !== 'object') {
      return null;
    }

    // Type guard to ensure the object has required properties
    const metadata = providerMetadata as Record<string, unknown>;

    // Ensure required id field exists
    if (!metadata["id"]) {
      return null;
    }

    return {
      id: toStringId(metadata["id"]),
      preferences: metadata["preferences"],
      metadataProvenance: metadata["MetadataProvenance"],
      rawMetadata: metadata["rawMetadata"],
      lastFetched: metadata["lastFetched"],
      ...metadata
    };
  }
  catch (error: unknown) {
    logger.error(`Error parsing provider metadata: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Get possible key variations for a provider name
 *
 * Different providers may have multiple key formats in stored metadata
 * (e.g., 'fandom' vs 'fandom_selected').
 *
 * @param provider - Provider name
 * @returns Array of possible key variations
 */
export function getProviderKeys(provider: string): string[] {
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
// Field Building
// ============================================================================

/**
 * Field extractor function signature
 */
type FieldExtractor = (
  data: unknown,
  updates: Record<string, unknown>
) => Record<string, unknown>;

type FieldExtractorWithProvider = (
  data: unknown,
  provider: string,
  updates: Record<string, unknown>
) => Record<string, unknown>;

type FieldExtractorWithManga = (
  data: unknown,
  manga: unknown,
  updates: Record<string, unknown>
) => Record<string, unknown>;

type FieldExtractorWithProviderAndManga = (
  data: unknown,
  provider: string,
  manga: unknown,
  updates: Record<string, unknown>
) => Record<string, unknown>;

/**
 * Field extractor mapping type
 */
interface FieldExtractorMap {
  [field: string]: (
    data: unknown,
    provider: string,
    manga: unknown,
    updates: Record<string, unknown>,
    extractors: FieldExtractors
  ) => Record<string, unknown>;
}

/**
 * Field extractors interface
 */
interface FieldExtractors {
  extractVolumesField: FieldExtractorWithProvider;
  extractChaptersField: FieldExtractorWithProvider;
  extractDescriptionField: FieldExtractorWithManga;
  extractCoverFields: FieldExtractor;
  extractStatusField: FieldExtractorWithManga;
  extractAuthorsField: FieldExtractorWithManga;
  extractArtistsField: FieldExtractorWithManga;
  extractGenresField: FieldExtractorWithManga;
  extractTagsField: FieldExtractorWithManga;
  extractThemesField: FieldExtractorWithProviderAndManga;
  extractPublisherField: FieldExtractorWithManga;
  extractStartDateField: FieldExtractor;
  extractEndDateField: FieldExtractor;
  extractReleaseYearField: FieldExtractor;
  extractIdMalField: FieldExtractorWithManga;
  extractIdAnilistField: FieldExtractorWithManga;
  extractAverageScoreField: FieldExtractorWithManga;
  extractPopularityField: FieldExtractorWithManga;
  extractBannerImageField: FieldExtractorWithManga;
  extractFormatField: FieldExtractorWithManga;
  extractSynonymsField: FieldExtractorWithManga;
}

/**
 * Get field extractor mapping
 */
function getFieldExtractorMap(): FieldExtractorMap {
  return {
    title: () => ({}), // Don't update title during refresh
    volumes: (data, provider, _manga, updates, extractors) => extractors.extractVolumesField(data, provider, updates),
    chapters: (data, provider, _manga, updates, extractors) => extractors.extractChaptersField(data, provider, updates),
    description: (data, _provider, manga, updates, extractors) => extractors.extractDescriptionField(data, manga, updates),
    cover: (data, _provider, _manga, updates, extractors) => extractors.extractCoverFields(data, updates),
    status: (data, _provider, manga, updates, extractors) => extractors.extractStatusField(data, manga, updates),
    authors: (data, _provider, manga, updates, extractors) => extractors.extractAuthorsField(data, manga, updates),
    artists: (data, _provider, manga, updates, extractors) => extractors.extractArtistsField(data, manga, updates),
    genres: (data, _provider, manga, updates, extractors) => extractors.extractGenresField(data, manga, updates),
    tags: (data, _provider, manga, updates, extractors) => extractors.extractTagsField(data, manga, updates),
    themes: (data, _provider, manga, updates, extractors) => extractors.extractThemesField(data, _provider, manga, updates),
    publisher: (data, _provider, manga, updates, extractors) => extractors.extractPublisherField(data, manga, updates),
    startDate: (data, _provider, _manga, updates, extractors) => extractors.extractStartDateField(data, updates),
    endDate: (data, _provider, _manga, updates, extractors) => extractors.extractEndDateField(data, updates),
    releaseYear: (data, _provider, _manga, updates, extractors) => extractors.extractReleaseYearField(data, updates),
    idMal: (data, _provider, manga, updates, extractors) => extractors.extractIdMalField(data, manga, updates),
    idAnilist: (data, _provider, manga, updates, extractors) => extractors.extractIdAnilistField(data, manga, updates),
    averageScore: (data, _provider, manga, updates, extractors) => extractors.extractAverageScoreField(data, manga, updates),
    popularity: (data, _provider, manga, updates, extractors) => extractors.extractPopularityField(data, manga, updates),
    bannerImage: (data, _provider, manga, updates, extractors) => extractors.extractBannerImageField(data, manga, updates),
    format: (data, _provider, manga, updates, extractors) => extractors.extractFormatField(data, manga, updates),
    alternativeTitles: (data, _provider, manga, updates, extractors) => extractors.extractSynonymsField(data, manga, updates),
    synonyms: (data, _provider, manga, updates, extractors) => extractors.extractSynonymsField(data, manga, updates)
  };
}

/**
 * Build field updates from provider data
 *
 * For each field in selectedProviders, extract the data from the corresponding
 * provider's metadata and map it to the correct Metadata model field.
 *
 * This implements the per-field provider selection feature where users can
 * choose different providers for different metadata fields.
 *
 * @param selectedProviders - Map of field name to provider name
 * @param providerMetadata - Map of provider name to provider metadata
 * @param manga - Current manga record (for fallback values)
 * @param extractors - Object containing field extractor functions
 * @returns Metadata updates object
 */
export function buildFieldUpdates(
  selectedProviders: Record<string, string>,
  providerMetadata: Record<string, unknown>,
  manga: unknown,
  extractors: FieldExtractors
): Record<string, unknown> {
  let updates: Record<string, unknown> = {};
  const extractorMap = getFieldExtractorMap();

  for (const [field, provider] of Object.entries(selectedProviders)) {
    const providerData = providerMetadata[provider];
    if (!providerData) {
      logger.warn(`No data from ${provider} for field ${field}`);
      continue;
    }

    // Extract data (handle both direct data and nested metadata)
    const data = isRecord(providerData) && getUnknownProperty(providerData, 'metadata')
      ? getUnknownProperty(providerData, 'metadata')
      : providerData;

    // Get extractor for this field
    const extractor = extractorMap[field];
    if (extractor) {
      updates = extractor(data, provider, manga, updates, extractors);
    } else {
      logger.debug(`Skipping extraction for unknown field: ${field}`);
    }
  }

  return updates;
}

/**
 * Convert field updates to UnifiedMangaMetadata format
 *
 * Maps the updates object (from buildFieldUpdates) to the
 * UnifiedMangaMetadata interface expected by the persistence service.
 *
 * @param updates - Updates object from buildFieldUpdates
 * @param manga - Current manga record (for fallback values)
 * @returns Partial UnifiedMangaMetadata object
 */
export function buildUnifiedMetadataFromUpdates(
  updates: Record<string, unknown>,
  manga: unknown
): Partial<UnifiedMangaMetadata> {
  const unifiedMetadata: Partial<UnifiedMangaMetadata> = {
    ...buildBasicMetadataFields(updates, manga),
    ...buildCoverFields(updates),
    ...buildArrayFields(updates),
    ...buildDateFields(updates),
    ...buildNumericMetadataFields(updates),
    ...buildIdFields(updates)
  };

  return unifiedMetadata;
}

/**
 * Build basic metadata fields (title, description, status, format, publisher)
 */
function buildBasicMetadataFields(
  updates: Record<string, unknown>,
  manga: unknown
): Partial<UnifiedMangaMetadata> {
  const unified: Partial<UnifiedMangaMetadata> = {};

  // Title (from updates or manga.title)
  const title = typeof updates['title'] === 'string' ? updates['title'] :
                (isRecord(manga) ? String(getUnknownProperty(manga, 'title') ?? '') : '');
  if (title) unified['title'] = title;

  // Description (updates.summary -> description)
  if (typeof updates['summary'] === 'string') {
    unified['description'] = updates['summary'];
  }

  // Status
  if (typeof updates['status'] === 'string') {
    unified['status'] = updates['status'] as MangaPublicationStatus;
  }

  // Format
  if (typeof updates['format'] === 'string') {
    unified['format'] = updates['format'] as MangaFormat;
  }

  // Publisher
  if (typeof updates['publisher'] === 'string') {
    unified['publisher'] = updates['publisher'];
  }

  return unified;
}

/**
 * Build cover fields
 */
function buildCoverFields(updates: Record<string, unknown>): Partial<UnifiedMangaMetadata> {
  const unified: Partial<UnifiedMangaMetadata> = {};

  // Cover image
  if (typeof updates['cover'] === 'string') {
    unified['coverImage'] = updates['cover'];
  }

  // Banner image
  if (typeof updates['bannerImage'] === 'string') {
    unified['bannerImage'] = updates['bannerImage'];
  }

  // Build covers object if we have size variants
  const covers: Partial<{ extraLarge?: string; large?: string; medium?: string; small?: string }> = {};
  if (typeof updates['coverExtraLarge'] === 'string') covers['extraLarge'] = updates['coverExtraLarge'];
  if (typeof updates['coverLarge'] === 'string') covers['large'] = updates['coverLarge'];
  if (typeof updates['coverMedium'] === 'string') covers['medium'] = updates['coverMedium'];
  if (typeof updates['coverSmall'] === 'string') covers['small'] = updates['coverSmall'];
  if (Object.keys(covers).length > 0) {
    unified['covers'] = covers as { extraLarge?: string; large?: string; medium?: string; small?: string };
  }

  return unified;
}

/**
 * Build array fields (authors, artists, genres, tags, characters, synonyms)
 */
function buildArrayFields(updates: Record<string, unknown>): Partial<UnifiedMangaMetadata> {
  const unified: Partial<UnifiedMangaMetadata> = {};

  // Simple arrays
  if (Array.isArray(updates['authors'])) unified['authors'] = updates['authors'] as string[];
  if (Array.isArray(updates['artists'])) unified['artists'] = updates['artists'] as string[];
  if (Array.isArray(updates['genres'])) unified['genres'] = updates['genres'] as string[];

  // Tags (convert to TagInfo[] format if needed)
  if (Array.isArray(updates['tags'])) {
    unified['tags'] = (updates['tags'] as string[]).map(tag => ({ name: tag }));
  }

  // Characters
  if (Array.isArray(updates['characters'])) {
    unified['characters'] = (updates['characters'] as string[]).map(char => ({ name: char }));
  }

  // Synonyms (updates.synonyms -> alternativeTitles)
  if (Array.isArray(updates['synonyms'])) {
    unified['alternativeTitles'] = updates['synonyms'] as string[];
  }

  return unified;
}

/**
 * Build date fields
 */
function buildDateFields(updates: Record<string, unknown>): Partial<UnifiedMangaMetadata> {
  const unified: Partial<UnifiedMangaMetadata> = {};

  if (updates['startDate'] instanceof Date) {
    unified['startDate'] = updates['startDate'].toISOString();
  }
  if (updates['endDate'] instanceof Date) {
    unified['endDate'] = updates['endDate'].toISOString();
  }

  return unified;
}

/**
 * Build numeric fields
 */
function buildNumericMetadataFields(updates: Record<string, unknown>): Partial<UnifiedMangaMetadata> {
  const unified: Partial<UnifiedMangaMetadata> = {};

  if (typeof updates['chapters'] === 'number') unified['chapterCount'] = updates['chapters'];
  if (typeof updates['volumes'] === 'number') unified['volumeCount'] = updates['volumes'];
  if (typeof updates['averageScore'] === 'number') unified['averageScore'] = updates['averageScore'];
  if (typeof updates['popularity'] === 'number') unified['popularity'] = updates['popularity'];

  return unified;
}

/**
 * Build ID fields (external IDs and links)
 */
function buildIdFields(updates: Record<string, unknown>): Partial<UnifiedMangaMetadata> {
  const unified: Partial<UnifiedMangaMetadata> = {};

  // External IDs
  const externalIds: Partial<{ anilistId?: number; malId?: number }> = {};
  if (typeof updates['idAnilist'] === 'number') externalIds['anilistId'] = updates['idAnilist'];
  if (typeof updates['idMal'] === 'number') externalIds['malId'] = updates['idMal'];
  if (Object.keys(externalIds).length > 0) {
    unified['externalIds'] = externalIds as { anilistId?: number; malId?: number };
  }

  // External links (updates.urls)
  if (Array.isArray(updates['urls'])) {
    unified['externalLinks'] = (updates['urls'] as string[]).map(url => ({ url }));
  }

  return unified;
}

/**
 * Build metadata provenance map from selected providers
 *
 * Tracks which provider supplied which field for audit trail.
 *
 * @param selectedProviders - Map of field name to provider name(s)
 * @returns Provenance map of field to provider
 */
export function buildMetadataProvenance(
  selectedProviders: Map<string, string[]> | Record<string, string>
): Record<string, string> {
  const provenance: Record<string, string> = {};

  // Field name mapping (updates field -> UnifiedMangaMetadata field)
  const fieldMapping: Record<string, string> = {
    'summary': 'description',
    'cover': 'coverImage',
    'synonyms': 'alternativeTitles',
    'chapters': 'chapterCount',
    'volumes': 'volumeCount',
    'idMal': 'externalIds.malId',
    'idAnilist': 'externalIds.anilistId'
  };

  // Handle both Map and Record types
  const entries = selectedProviders instanceof Map
    ? Array.from(selectedProviders.entries())
    : Object.entries(selectedProviders);

  // Build provenance for each field
  for (const [field, providers] of entries) {
    // Handle both string and string[] provider values
    const provider = Array.isArray(providers) ? providers[0] : providers;

    if (provider) {
      // Use mapped field name if available, otherwise use original
      const targetField = fieldMapping[field] ?? field;
      provenance[targetField] = provider;
    }
  }

  return provenance;
}
