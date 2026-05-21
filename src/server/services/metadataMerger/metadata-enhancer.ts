// @file-size-justified: Pre-existing large file - needs separate refactoring task to split
/**
 * Metadata Enhancer Module
 *
 * Functions for enhancing metadata with data from multiple providers.
 * Handles provider fetching, field merging, and database updates.
 *
 * Extracted from: metadataMerger.ts
 */



import { MangaPublicationStatus } from '@prisma/client';

import { prisma } from '@/server/db';
import type { ProviderMatcher } from '@/server/utils/providerMatcher';
import type { MangaMetadata } from '@/types/search.types';
import { ValidationError } from '@/utils/errors';
import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';


import { searchProviderRegistry } from '../search/registerProviders';

import {
  isRecord,
  getUnknownProperty,
  isValidCount,
  processDate,
} from './utils';

import type { ExtendedProviderMetadata } from './utils';
import type { MetadataConfigService } from '../metadata/configService';
import type { SearchResult } from '../search/types';
import type { Prisma } from '@prisma/client';


// ============================================================================
// Types
// ============================================================================

/**
 * Context for metadata enhancement operations
 * Contains dependencies needed for provider fetching and metadata parsing
 */
export interface MetadataEnhancerContext {
  parseProviderMetadata: (metadata: unknown) => ExtendedProviderMetadata | null;
  providerMatcher: ProviderMatcher;
  metadataConfigService: MetadataConfigService | null;
}

/**
 * Preferences loaded from database and config
 */
interface LoadedPreferences {
  userPreferences: Record<string, unknown>;
  fieldPreferences: Record<string, string>;
}

// ============================================================================
// Provider Fetching
// ============================================================================

/**
 * Get metadata from provider using an ID
 */
async function getMetadataById(
  providerId: string,
  provider: string,
  title?: string
): Promise<SearchResult | null> {
  const providerInstance = searchProviderRegistry.get(provider);
  if (!providerInstance) {
    return null;
  }

  if (!('getMetadata' in providerInstance) || typeof providerInstance.getMetadata !== 'function') {
    return null;
  }

  const result = await providerInstance.getMetadata(providerId, title);
  return {
    ...result,
    provider: isRecord(result) && result.provider ? String(result.provider) : provider
  } as SearchResult;
}

/**
 * Search for manga by title and get metadata
 */
async function searchAndGetMetadata(
  title: string,
  provider: string,
  context: MetadataEnhancerContext
): Promise<SearchResult | null> {
  const matchId = await context.providerMatcher.findMatch(title, provider);
  if (!matchId) {
    return null;
  }

  logger.info(`Found match on ${provider} with ID: ${matchId}`);
  return getMetadataById(matchId, provider);
}

/**
 * Extract provider ID from manga metadata
 */
function extractProviderId(
  manga: { providerMetadata?: unknown },
  context: MetadataEnhancerContext
): string | null {
  if (!manga.providerMetadata || typeof manga.providerMetadata !== 'object' || !('id' in manga.providerMetadata)) {
    return null;
  }

  const parsedMetadata = context.parseProviderMetadata(manga.providerMetadata);
  if (!parsedMetadata?.["id"]) {
    return null;
  }

  return toStringId(parsedMetadata["id"]);
}

/**
 * Fetch metadata for primary provider
 */
async function fetchPrimaryProviderMetadata(
  provider: string,
  manga: { id: number; title: string; providerMetadata?: unknown },
  context: MetadataEnhancerContext
): Promise<SearchResult | null> {
  // Try to use existing provider ID
  const providerId = extractProviderId(manga, context);
  if (providerId) {
    logger.info(`Using existing provider ID for ${provider}: ${providerId}`);
    return getMetadataById(providerId, provider, manga.title);
  }

  // Fall back to title search
  logger.info(`No provider ID found for ${provider}, searching by title: ${manga.title}`);
  return searchAndGetMetadata(manga.title, provider, context);
}

/**
 * Fetch metadata for non-primary provider
 */
async function fetchNonPrimaryProviderMetadata(
  provider: string,
  title: string,
  context: MetadataEnhancerContext
): Promise<SearchResult | null> {
  logger.info(`Searching for match on ${provider} by title: ${title}`);
  const result = await searchAndGetMetadata(title, provider, context);

  if (!result) {
    logger.info(`No match found on ${provider} for title: ${title}`);
  }

  return result;
}

/**
 * Fetch metadata from a specific provider
 *
 * @param provider - Provider name to fetch from
 * @param manga - Manga entity to fetch metadata for
 * @param isPrimary - Whether this is the primary provider
 * @param context - Context containing dependencies
 * @returns SearchResult or null if not found
 */
export async function fetchFromProvider(
  provider: string,
  manga: {
    id: number;
    title: string;
    providerMetadata?: unknown;
  },
  isPrimary: boolean,
  context: MetadataEnhancerContext
): Promise<SearchResult | null> {
  try {
    if (isPrimary) {
      return await fetchPrimaryProviderMetadata(provider, manga, context);
    }
    return await fetchNonPrimaryProviderMetadata(provider, manga.title, context);
  } catch (error: unknown) {
    logger.error(`Error fetching from provider ${provider}: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Get list of other providers to query
 *
 * @param primaryProvider - Primary provider name
 * @returns Array of other provider names
 */
export function getOtherProviders(primaryProvider: string): string[] {
  const allProviders = ['anilist', 'mangadex', 'comicvine', 'fandom', 'wikipedia'];
  return allProviders.filter((provider) => provider !== primaryProvider);
}

// ============================================================================
// Preference Loading Helpers
// ============================================================================

/**
 * Load field preferences from configuration service
 */
async function loadFieldPreferences(context: MetadataEnhancerContext): Promise<Record<string, string>> {
  try {
    if (context.metadataConfigService) {
      const fieldPreferences = await context.metadataConfigService.getFieldProviders();
      logger.debug(`Loaded field preferences from configuration service: ${JSON.stringify(fieldPreferences)}`);
      return fieldPreferences;
    }
    logger.warn('No metadata configuration service available, using default field preferences');
    return {};
  } catch (error: unknown) {
    logger.warn(`Error fetching field preferences: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

/**
 * Load user preferences for a specific manga
 */
async function loadUserPreferences(
  mangaId: number | undefined,
  context: MetadataEnhancerContext
): Promise<Record<string, unknown>> {
  if (!mangaId) {
    return {};
  }

  try {
    const manga = await prisma.manga.findUnique({
      where: { id: mangaId }
    });

    if (manga?.providerMetadata) {
      const parsedMetadata = context.parseProviderMetadata(manga.providerMetadata);
      if (parsedMetadata?.["preferences"]) {
        const prefs = parsedMetadata["preferences"];
        return isRecord(prefs) ? prefs : {};
      }
    }
    return {};
  } catch (error: unknown) {
    logger.warn(`Error fetching user preferences for manga ID ${mangaId}: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

/**
 * Load all preferences needed for metadata enhancement
 */
async function loadPreferences(
  mangaId: number | undefined,
  context: MetadataEnhancerContext
): Promise<LoadedPreferences> {
  const [fieldPreferences, userPreferences] = await Promise.all([
    loadFieldPreferences(context),
    loadUserPreferences(mangaId, context)
  ]);

  return { userPreferences, fieldPreferences };
}

// ============================================================================
// Field Update Helpers
// ============================================================================

/**
 * Options for shouldUpdateField function
 */
interface ShouldUpdateFieldOptions {
  field: string;
  provider: string;
  baseMetadata: Partial<MangaMetadata>;
  userPreferences: Record<string, unknown>;
  fieldPreferences: Record<string, string>;
  value: unknown;
  checkEmpty: boolean;
}

/**
 * Check if a field should be updated based on preferences
 */
function shouldUpdateField(options: ShouldUpdateFieldOptions): boolean {
  const { field, provider, baseMetadata, userPreferences, fieldPreferences, value, checkEmpty } = options;
  if (value === undefined) {
    return false;
  }

  const isEmpty = checkEmpty && (
    value === null ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'string' && value.trim() === '')
  );

  // Check user preference (highest priority)
  const userPref = userPreferences[field];
  const isUserPreferredProvider = userPref && isRecord(userPref) && getUnknownProperty(userPref, 'provider') === provider;

  // Check system-wide field preference
  const fieldPref = fieldPreferences[field];
  const isFieldPreferredProvider = fieldPref === provider;

  // Update if:
  // 1. User's preferred provider for this field, OR
  // 2. System-wide preferred provider and no user preference, OR
  // 3. Field is missing/empty and no preference exists
  const isFieldMissingOrEmpty = !(field in baseMetadata) ||
    baseMetadata[field as keyof MangaMetadata] === null ||
    isEmpty;

  const shouldUpdate = Boolean(
    isUserPreferredProvider ||
    (!userPref && isFieldPreferredProvider) ||
    (!userPref && !fieldPref && isFieldMissingOrEmpty)
  );

  return shouldUpdate;
}

/**
 * Shared context for metadata field updates
 */
interface MetadataUpdateContext {
  baseMetadata: Partial<MangaMetadata>;
  metadataProvenance: Record<string, string>;
  provider: string;
  userPreferences: Record<string, unknown>;
  fieldPreferences: Record<string, string>;
}

/**
 * Options for updateMetadataField function
 */
interface UpdateMetadataFieldOptions<T> extends MetadataUpdateContext {
  field: keyof MangaMetadata;
  value: T | undefined | null;
  checkEmpty?: boolean;
}

/**
 * Update a metadata field if conditions are met
 */
function updateMetadataField<T>(options: UpdateMetadataFieldOptions<T>): void {
  const {
    field,
    value,
    provider,
    baseMetadata,
    metadataProvenance,
    userPreferences,
    fieldPreferences,
    checkEmpty = true
  } = options;

  if (shouldUpdateField({
    field: field as string,
    provider,
    baseMetadata,
    userPreferences,
    fieldPreferences,
    value,
    checkEmpty
  })) {
    Object.assign(baseMetadata, { [field as string]: value });
    Object.assign(metadataProvenance, { [field as string]: provider });
  }
}

// ============================================================================
// Provider-Specific Validation
// ============================================================================

/**
 * Validate and extract chapters value for AniList provider
 */
function validateAniListChapters(additionalMetadata: SearchResult): number | null | undefined {
  let chaptersValue = additionalMetadata["chapters"];

  if ('rawData' in additionalMetadata && isRecord(additionalMetadata.rawData)) {
    const rawData = additionalMetadata.rawData as Record<string, unknown>;
    const startDate = rawData["startDate"];
    const endDate = rawData["endDate"];

    // Check if chapters is accidentally set to a date year
    if (isRecord(startDate) && 'year' in startDate && rawData["chapters"] === startDate["year"]) {
      logger.warn(`Detected AniList chapters incorrectly set to start year ${rawData["chapters"]}, skipping`);
      chaptersValue = undefined;
    }
    if (isRecord(endDate) && 'year' in endDate && rawData["chapters"] === endDate["year"]) {
      logger.warn(`Detected AniList chapters incorrectly set to end year ${rawData["chapters"]}, skipping`);
      chaptersValue = undefined;
    }

    // Use validated chapters from rawData if available
    const rawChapters = rawData["chapters"];
    if (rawChapters !== null && typeof rawChapters === 'number' && isValidCount(rawChapters)) {
      chaptersValue = rawChapters;
    }
  }

  return chaptersValue;
}

/**
 * Validate and extract volumes value for AniList provider
 */
function validateAniListVolumes(additionalMetadata: SearchResult): number | null | undefined {
  let volumesValue = additionalMetadata.volumes;

  if ('rawData' in additionalMetadata && isRecord(additionalMetadata.rawData)) {
    const rawData = additionalMetadata.rawData as Record<string, unknown>;
    const startDate = rawData["startDate"];
    const endDate = rawData["endDate"];

    // Check if volumes is accidentally set to a date year
    if (isRecord(startDate) && 'year' in startDate && rawData["volumes"] === startDate["year"]) {
      logger.warn(`Detected AniList volumes incorrectly set to start year ${rawData["volumes"]}, skipping`);
      volumesValue = undefined;
    }
    if (isRecord(endDate) && 'year' in endDate && rawData["volumes"] === endDate["year"]) {
      logger.warn(`Detected AniList volumes incorrectly set to end year ${rawData["volumes"]}, skipping`);
      volumesValue = undefined;
    }

    // Use validated volumes from rawData if available
    const rawVolumes = rawData["volumes"];
    if (rawVolumes !== null && typeof rawVolumes === 'number' && isValidCount(rawVolumes)) {
      volumesValue = rawVolumes;
    }
  }

  return volumesValue;
}

/**
 * Validate Fandom chapter count against existing metadata
 */
function validateFandomChapters(
  chaptersValue: number | null | undefined,
  baseMetadata: Partial<MangaMetadata>,
  metadataProvenance: Record<string, string>,
  provider: string
): void {
  if (chaptersValue === undefined || chaptersValue === null || !isValidCount(chaptersValue)) {
    return;
  }

  const existingChapters = baseMetadata["chapters"];
  if (existingChapters !== undefined) {
    const isReasonableCount = chaptersValue >= existingChapters * 0.8 && chaptersValue <= existingChapters * 1.2;
    if (isReasonableCount) {
      Object.assign(baseMetadata, { chapters: chaptersValue });
      Object.assign(metadataProvenance, { chapters: provider });
      logger.info(`Using Fandom chapter count: ${chaptersValue}`);
    } else {
      logger.warn(`Ignoring Fandom chapter count (${chaptersValue}) as it differs significantly from existing metadata (${existingChapters})`);
    }
  } else {
    // No existing metadata to validate against
    Object.assign(baseMetadata, { chapters: chaptersValue });
    Object.assign(metadataProvenance, { chapters: provider });
  }
}

/**
 * Validate Fandom volume count against existing metadata
 */
function validateFandomVolumes(
  volumesValue: number | null | undefined,
  baseMetadata: Partial<MangaMetadata>,
  metadataProvenance: Record<string, string>,
  provider: string
): void {
  if (volumesValue === undefined || volumesValue === null || !isValidCount(volumesValue)) {
    return;
  }

  const existingVolumes = baseMetadata.volumes;
  if (existingVolumes !== undefined && volumesValue > existingVolumes * 2) {
    logger.warn(`Ignoring Fandom volume count (${volumesValue}) as it seems unreasonably high compared to existing metadata (${existingVolumes})`);
  } else {
    Object.assign(baseMetadata, { volumes: volumesValue });
    Object.assign(metadataProvenance, { volumes: provider });
  }
}

// ============================================================================
// Field Update Operations
// ============================================================================

/**
 * Options for field update functions
 */
interface FieldUpdateOptions extends MetadataUpdateContext {
  additionalMetadata: SearchResult;
}

/**
 * Update cover image fields
 */
function updateCoverFields(options: FieldUpdateOptions): void {
  const { additionalMetadata, provider, baseMetadata, metadataProvenance, userPreferences, fieldPreferences } = options;
  const coverValue = additionalMetadata.cover ?? additionalMetadata.coverImage;

  const context = { provider, baseMetadata, metadataProvenance, userPreferences, fieldPreferences };
  updateMetadataField({ ...context, field: 'coverLarge' as keyof MangaMetadata, value: coverValue });
  updateMetadataField({ ...context, field: 'coverMedium' as keyof MangaMetadata, value: coverValue });
  updateMetadataField({ ...context, field: 'coverSmall' as keyof MangaMetadata, value: coverValue });
  updateMetadataField({ ...context, field: 'cover' as keyof MangaMetadata, value: coverValue });
}

/**
 * Update text and array fields
 */
function updateBasicFields(options: FieldUpdateOptions): void {
  const { additionalMetadata, provider, baseMetadata, metadataProvenance, userPreferences, fieldPreferences } = options;
  const context = { provider, baseMetadata, metadataProvenance, userPreferences, fieldPreferences };

  updateMetadataField({ ...context, field: 'summary' as keyof MangaMetadata, value: additionalMetadata["description"] });
  updateMetadataField({ ...context, field: 'status', value: additionalMetadata["status"] });
  updateMetadataField({ ...context, field: 'genres', value: additionalMetadata["genres"] });
  updateMetadataField({ ...context, field: 'synonyms' as keyof MangaMetadata, value: additionalMetadata["alternativeTitles"] });
}

/**
 * Update numeric fields (chapters and volumes)
 */
function updateNumericFields(options: FieldUpdateOptions): void {
  const { additionalMetadata, provider, baseMetadata, metadataProvenance, userPreferences, fieldPreferences } = options;
  const chaptersPreference = userPreferences['chapters'];
  const volumesPreference = userPreferences['volumes'];

  // Get validated values based on provider
  let chaptersValue = additionalMetadata["chapters"];
  let volumesValue = additionalMetadata.volumes;

  if (provider === 'anilist') {
    chaptersValue = validateAniListChapters(additionalMetadata);
    volumesValue = validateAniListVolumes(additionalMetadata);
  }

  const context = { provider, baseMetadata, metadataProvenance, userPreferences, fieldPreferences };

  // Handle Fandom-specific validation
  if (provider === 'fandom' && !chaptersPreference) {
    validateFandomChapters(chaptersValue, baseMetadata, metadataProvenance, provider);
  } else if (chaptersValue !== null && isValidCount(chaptersValue)) {
    updateMetadataField({ ...context, field: 'chapters', value: chaptersValue, checkEmpty: false });
  }

  if (provider === 'fandom' && !volumesPreference) {
    validateFandomVolumes(volumesValue, baseMetadata, metadataProvenance, provider);
  } else if (volumesValue !== null && isValidCount(volumesValue)) {
    updateMetadataField({ ...context, field: 'volumes', value: volumesValue, checkEmpty: false });
  }
}

/**
 * Extract date value for AniList provider
 */
function extractAniListDate(additionalMetadata: SearchResult, dateField: 'startDate' | 'endDate'): string | undefined {
  let dateValue: unknown = additionalMetadata[dateField];

  if ('rawData' in additionalMetadata && isRecord(additionalMetadata.rawData)) {
    const rawData = additionalMetadata.rawData as Record<string, unknown>;
    const rawDate = rawData[dateField];
    if (rawDate !== undefined) {
      dateValue = rawDate;
    }
  }

  return dateValue as string | undefined;
}

/**
 * Update date fields
 */
function updateDateFields(options: FieldUpdateOptions): void {
  const { additionalMetadata, provider, baseMetadata, metadataProvenance, userPreferences, fieldPreferences } = options;
  const context = { provider, baseMetadata, metadataProvenance, userPreferences, fieldPreferences };

  // Process start date
  let startDateToUse = additionalMetadata.startDate;
  if (provider === 'anilist') {
    startDateToUse = extractAniListDate(additionalMetadata, 'startDate');
  }
  const processedStartDate = processDate(startDateToUse, 'startDate');
  if (processedStartDate) {
    updateMetadataField({ ...context, field: 'startDate' as keyof MangaMetadata, value: processedStartDate });
  }

  // Process end date
  let endDateToUse = additionalMetadata.endDate;
  if (provider === 'anilist') {
    endDateToUse = extractAniListDate(additionalMetadata, 'endDate');
  }
  const processedEndDate = processDate(endDateToUse, 'endDate');
  if (processedEndDate) {
    updateMetadataField({ ...context, field: 'endDate' as keyof MangaMetadata, value: processedEndDate });
  }
}

/**
 * Update provider URLs
 */
function updateProviderUrls(
  additionalMetadata: SearchResult,
  provider: string,
  baseMetadata: Partial<MangaMetadata>,
  metadataProvenance: Record<string, string>
): void {
  if (!additionalMetadata["id"]) {
    return;
  }

  let providerUrl: string | null = null;
  if (provider === 'anilist') {
    providerUrl = `https://anilist.co/manga/${additionalMetadata["id"]}`;
  } else if (provider === 'comicvine') {
    providerUrl = `https://comicvine.gamespot.com/volume/4050-${additionalMetadata["id"]}/`;
  }

  if (providerUrl) {
    const urls = baseMetadata.urls;
    if (!urls) {
      Object.assign(baseMetadata, { urls: [providerUrl] });
    } else if (Array.isArray(urls) && !urls.includes(providerUrl)) {
      urls.push(providerUrl);
    }

    if (!metadataProvenance['urls']) {
      Object.assign(metadataProvenance, { urls: provider });
    } else {
      const currentUrls = metadataProvenance['urls'];
      Object.assign(metadataProvenance, { urls: `${currentUrls}, ${provider}` });
    }
  }
}

// ============================================================================
// Metadata Enhancement
// ============================================================================

/**
 * Options for enhanceMetadata function
 */
export interface EnhanceMetadataOptions {
  baseMetadata: Partial<MangaMetadata>;
  additionalMetadata: SearchResult;
  metadataProvenance: Record<string, string>;
  provider: string;
  context: MetadataEnhancerContext;
  mangaId?: number;
}

/**
 * Enhance base metadata with additional metadata
 */
export async function enhanceMetadata(options: EnhanceMetadataOptions): Promise<void> {
  const { baseMetadata, additionalMetadata, metadataProvenance, provider, context, mangaId } = options;

  // Load all preferences
  const { userPreferences, fieldPreferences } = await loadPreferences(mangaId, context);

  const fieldUpdateOptions: FieldUpdateOptions = {
    additionalMetadata,
    provider,
    baseMetadata,
    metadataProvenance,
    userPreferences,
    fieldPreferences
  };

  // Update all field categories
  updateCoverFields(fieldUpdateOptions);
  updateBasicFields(fieldUpdateOptions);
  updateNumericFields(fieldUpdateOptions);
  updateDateFields(fieldUpdateOptions);
  updateProviderUrls(additionalMetadata, provider, baseMetadata, metadataProvenance);
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Manga with metadata type
 */
type MangaWithMetadata = Prisma.MangaGetPayload<{
  include: { Metadata: true };
}>;

/**
 * Update manga metadata in database
 *
 * @param mangaId - Database manga ID
 * @param metadata - Metadata to update
 * @param metadataProvenance - Record of which provider provided which field
 * @returns Updated manga
 */
export async function updateMangaMetadata(
  mangaId: number,
  metadata: MangaMetadata,
  metadataProvenance: Record<string, string>
): Promise<unknown> {
  try {
    // Get manga from database
    const manga = await fetchMangaWithMetadata(mangaId);

    // Prepare updates
    const providerMetadata = buildProviderMetadata(manga, metadataProvenance);
    const metadataData = buildMetadataData(metadata, manga);

    // Perform database updates
    await upsertMetadata(manga, metadataData);
    await updateMangaProviderMetadata(mangaId, providerMetadata);

    // Return updated manga
    return await fetchMangaWithMetadata(mangaId);
  }
  catch (error: unknown) {
    logger.error(`Error updating manga metadata: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Fetch manga with metadata from database
 */
async function fetchMangaWithMetadata(mangaId: number): Promise<MangaWithMetadata> {
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    include: { Metadata: true }
  });

  if (!manga) {
    throw new ValidationError(`Manga with ID ${mangaId} not found`);
  }

  return manga;
}

/**
 * Build provider metadata with provenance
 */
function buildProviderMetadata(
  manga: { providerMetadata: unknown },
  metadataProvenance: Record<string, string>
): Record<string, unknown> {
  return {
    ...(isRecord(manga.providerMetadata) ? manga.providerMetadata : {}),
    metadataProvenance
  };
}

/**
 * Build metadata data for database update
 */
function buildMetadataData(
  metadata: MangaMetadata,
  manga: MangaWithMetadata
): Prisma.MetadataUpdateInput {
  return {
    ...buildCoverMetadata(metadata, manga),
    ...buildTextMetadata(metadata, manga),
    ...buildArrayMetadata(metadata, manga),
    ...buildNumericMetadata(metadata, manga),
    ...buildDateMetadata(metadata, manga),
    lastFetch: new Date()
  };
}

/**
 * Build cover-related metadata fields
 */
function buildCoverMetadata(
  metadata: MangaMetadata,
  manga: MangaWithMetadata
): Prisma.MetadataUpdateInput {
  const result: Prisma.MetadataUpdateInput = {
    cover: (metadata.coverImage ?? manga.Metadata?.cover) ?? ""
  };

  const coverLarge = metadata.coverLarge ?? manga.Metadata?.coverLarge;
  if (coverLarge !== undefined && coverLarge !== null) result.coverLarge = coverLarge;

  const coverMedium = metadata.coverMedium ?? manga.Metadata?.coverMedium;
  if (coverMedium !== undefined && coverMedium !== null) result.coverMedium = coverMedium;

  const coverSmall = metadata.coverSmall ?? manga.Metadata?.coverSmall;
  if (coverSmall !== undefined && coverSmall !== null) result.coverSmall = coverSmall;

  const bannerImage = metadata.bannerImage ?? manga.Metadata?.bannerImage;
  if (bannerImage !== undefined && bannerImage !== null) result.bannerImage = bannerImage;

  return result;
}

/**
 * Build text metadata fields
 */
function buildTextMetadata(
  metadata: MangaMetadata,
  manga: MangaWithMetadata
): Prisma.MetadataUpdateInput {
  const result: Prisma.MetadataUpdateInput = {
    summary: (metadata["description"] ?? manga.Metadata?.summary) ?? "",
    status: (metadata["status"] ?? manga.Metadata?.status ?? 'UNKNOWN') as MangaPublicationStatus
  };

  const format = metadata.format ?? manga.Metadata?.format;
  if (format !== undefined && format !== null) result.format = format;

  const countryOfOrigin = metadata.countryOfOrigin ?? manga.Metadata?.countryOfOrigin;
  if (countryOfOrigin !== undefined && countryOfOrigin !== null) result.countryOfOrigin = countryOfOrigin;

  const publisher = metadata.publisher ?? manga.Metadata?.publisher;
  if (publisher !== undefined && publisher !== null) result.publisher = publisher;

  return result;
}

/**
 * Build array metadata fields
 */
function buildArrayMetadata(
  metadata: MangaMetadata,
  manga: MangaWithMetadata
): Prisma.MetadataUpdateInput {
  const getArrayValue = (newVal: unknown, existingVal: string[] | null | undefined): string[] => {
    if (Array.isArray(newVal) && newVal.length > 0) {
      return newVal.filter((item): item is string => typeof item === 'string');
    }
    if (Array.isArray(existingVal)) return existingVal;
    return [];
  };

  return {
    genres: getArrayValue(metadata["genres"], manga.Metadata?.genres),
    authors: getArrayValue(metadata["authors"], manga.Metadata?.authors),
    artists: getArrayValue(metadata.artists, manga.Metadata?.artists),
    tags: getArrayValue(metadata["tags"], manga.Metadata?.tags),
    characters: getArrayValue(metadata.characters, manga.Metadata?.characters),
    synonyms: getArrayValue(metadata.synonyms, manga.Metadata?.synonyms),
    urls: getArrayValue(metadata.urls, manga.Metadata?.urls)
  };
}


/**
 * Helper to set a numeric field if defined
 * Intentionally mutates result parameter for builder pattern
 */
function setNumericField<K extends keyof Prisma.MetadataUpdateInput>(
  result: Prisma.MetadataUpdateInput,
  key: K,
  value: number | null | undefined
): void {
  if (value !== undefined && value !== null) {
    // Type is narrowed to number here
    const numericValue: number = value;
    // eslint-disable-next-line no-param-reassign -- intentional builder pattern mutation
    result[key] = numericValue as Prisma.MetadataUpdateInput[K];
  }
}

/**
 * Build numeric metadata fields
 */
function buildNumericMetadata(
  metadata: MangaMetadata,
  manga: MangaWithMetadata
): Prisma.MetadataUpdateInput {
  const result: Prisma.MetadataUpdateInput = {};

  setNumericField(result, 'chapters', metadata.chapters ?? manga.Metadata?.chapters);
  setNumericField(result, 'volumes', metadata.volumes ?? manga.Metadata?.volumes);
  setNumericField(result, 'idMal', metadata.idMal ?? manga.Metadata?.idMal);
  setNumericField(result, 'averageScore', metadata.averageScore ?? manga.Metadata?.averageScore);
  setNumericField(result, 'popularity', metadata.popularity ?? manga.Metadata?.popularity);

  return result;
}

/**
 * Build date metadata fields
 */
function buildDateMetadata(
  metadata: MangaMetadata,
  manga: MangaWithMetadata
): Prisma.MetadataUpdateInput {
  const result: Prisma.MetadataUpdateInput = {};

  const startDate = metadata.startDate ?? manga.Metadata?.startDate;
  if (startDate !== undefined && startDate !== null) result.startDate = startDate;

  const endDate = metadata.endDate ?? manga.Metadata?.endDate;
  if (endDate !== undefined && endDate !== null) result.endDate = endDate;

  return result;
}

/**
 * Update or create metadata in database
 */
async function upsertMetadata(
  manga: { id: number; metadataId: number | null },
  metadataData: Prisma.MetadataUpdateInput
): Promise<void> {
  if (manga.metadataId) {
    // Update existing metadata
    logger.info(`Updating metadata for manga ${manga.id}`);
    await prisma.metadata.update({
      where: { id: manga.metadataId },
      data: metadataData
    });
  } else {
    // Create new metadata and link to manga
    logger.info(`Creating new metadata for manga ${manga.id}`);
    const newMetadata = await prisma.metadata.create({
      data: {
        ...metadataData,
        manga: {
          connect: { id: manga.id }
        }
      } as Prisma.MetadataCreateInput
    });

    // Link metadata to manga
    await prisma.manga.update({
      where: { id: manga.id },
      data: { metadataId: newMetadata.id }
    });
  }
}

/**
 * Update manga provider metadata
 */
async function updateMangaProviderMetadata(
  mangaId: number,
  providerMetadata: Record<string, unknown>
): Promise<void> {
  await prisma.manga.update({
    where: { id: mangaId },
    data: { providerMetadata: providerMetadata as Prisma.InputJsonValue }
  });
}
