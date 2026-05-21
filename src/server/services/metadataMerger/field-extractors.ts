/**
 * Field Extractors Module
 *
 * Functions for extracting specific metadata fields from provider data.
 * Each function takes provider data, manga record, and updates object,
 * returning an updated object with the extracted field.
 *
 * Extracted from: metadataMerger.ts
 */

import type { UnifiedMangaMetadata } from '@/types/search-types/metadata.types';
import { logger } from '@/utils/logger';

import { ProviderFieldMappingService } from './provider-field-mapping';
import {
  isRecord,
  getUnknownProperty,
  isValidCount,
  normalizeStatus,
  processDate
} from './utils';

// ============================================================================
// Unified Schema Field Extraction
// ============================================================================

/**
 * Extract unified metadata from provider data using field mapping
 *
 * Uses the ProviderFieldMappingService to map provider-specific data
 * to the unified metadata schema.
 *
 * @param provider - Provider name
 * @param providerData - Raw provider data
 * @returns Partial UnifiedMangaMetadata with mapped fields
 */
export function extractUnifiedMetadata(
  provider: string,
  providerData: Record<string, unknown>
): Partial<UnifiedMangaMetadata> {
  try {
    return ProviderFieldMappingService.mapProviderDataToUnifiedSchema(provider, providerData);
  } catch (error: unknown) {
    logger.error(`Error extracting unified metadata from ${provider}: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

// ============================================================================
// Field Extraction Functions
// ============================================================================

/**
 * Extract volumes field from provider data
 *
 * Special handling for ComicVine which stores volumes as issues arrays.
 *
 * @param data - Provider metadata
 * @param provider - Provider name
 * @param updates - Updates object to copy from
 * @returns Updated object with volumes field
 */
export function extractVolumesField(
  data: unknown,
  provider: string,
  updates: Record<string, unknown>
): Record<string, unknown> {
  // Special handling for ComicVine - check nested metadata structure
  let volumes = isRecord(data)
    ? getUnknownProperty(data, 'volumes') ?? getUnknownProperty(data, 'volumeCount') ?? getUnknownProperty(data, 'totalVolumes') ?? getUnknownProperty(data, 'totalIssues')
    : undefined;

  // For ComicVine, check if issues array exists in various locations
  if (provider === 'comicvine' && !volumes) {
    if (isRecord(data) && Array.isArray(getUnknownProperty(data, 'issues'))) {
      const issues = getUnknownProperty(data, 'issues');
      volumes = Array.isArray(issues) ? issues.length : undefined;
      logger.info(`ComicVine: Found ${volumes} issues in data.issues`);
    } else {
      // Check if data is nested in providerData
      const metadata = isRecord(data) ? getUnknownProperty(data, 'metadata') : undefined;
      if (isRecord(metadata) && Array.isArray(getUnknownProperty(metadata, 'issues'))) {
        const issues = getUnknownProperty(metadata, 'issues');
        volumes = Array.isArray(issues) ? issues.length : undefined;
        logger.info(`ComicVine: Found ${volumes} issues in metadata.issues`);
      } else if (Array.isArray(getUnknownProperty(data, 'issues'))) {
        const issues = getUnknownProperty(data, 'issues');
        volumes = Array.isArray(issues) ? issues.length : undefined;
        logger.info(`ComicVine: Found ${volumes} issues in providerData.issues`);
      }
    }
  } else if (!volumes && isRecord(data)) {
    const issues = getUnknownProperty(data, 'issues');
    if (Array.isArray(issues)) {
      volumes = issues.length;
    }
  }

  logger.info(`Field 'volumes' from provider '${provider}': raw value = ${volumes}`);
  if (isValidCount(volumes)) {
    logger.info(`Setting volumes to ${volumes} from ${provider}`);
    return { ...updates, volumes };
  }
  logger.warn(`Invalid volume count ${volumes} from ${provider}`);
  return updates;
}

/**
 * Extract chapters field from provider data
 *
 * @param data - Provider metadata
 * @param provider - Provider name
 * @param updates - Updates object to copy from
 * @returns Updated object with chapters field
 */
export function extractChaptersField(
  data: unknown,
  provider: string,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const chapters = isRecord(data)
    ? getUnknownProperty(data, 'chapters') ?? getUnknownProperty(data, 'chapterCount') ?? getUnknownProperty(data, 'totalChapters')
    : undefined;

  logger.info(`Field 'chapters' from provider '${provider}': raw value = ${chapters}`);
  if (isValidCount(chapters)) {
    logger.info(`Setting chapters to ${chapters} from ${provider}`);
    return { ...updates, chapters };
  }
  logger.warn(`Invalid chapter count ${chapters} from ${provider}`);
  return updates;
}

/**
 * Extract description field from provider data
 *
 * Preserves both description and summary/synopsis fields separately.
 * - description: Main description (from AniList, etc.)
 * - summary/synopsis: Alternative description field
 *
 * @param data - Provider metadata
 * @param manga - Current manga record (for fallback)
 * @param updates - Updates object to copy from
 * @returns Updated object with description and summary fields
 */
export function extractDescriptionField(
  data: unknown,
  manga: unknown,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const description = isRecord(data)
    ? getUnknownProperty(data, 'description')
    : undefined;

  const synopsis = isRecord(data)
    ? getUnknownProperty(data, 'synopsis') ?? getUnknownProperty(data, 'summary')
    : undefined;

  const mangaMetadata = isRecord(manga) ? getUnknownProperty(manga, 'metadata') : undefined;
  const mangaDescription = isRecord(mangaMetadata) ? getUnknownProperty(mangaMetadata, 'description') : undefined;
  const mangaSummary = isRecord(mangaMetadata) ? getUnknownProperty(mangaMetadata, 'summary') : undefined;

  const result = { ...updates };

  // Keep description as description (don't route to summary)
  const finalDescription = description ?? mangaDescription;
  if (finalDescription) {
    result['description'] = finalDescription;
  }

  // Keep synopsis/summary as summary
  const finalSummary = synopsis ?? mangaSummary;
  if (finalSummary) {
    result['summary'] = finalSummary;
  }

  // If only one exists, use it for both fields to ensure data availability
  if (finalDescription && !finalSummary) {
    result['summary'] = finalDescription;
  } else if (finalSummary && !finalDescription) {
    result['description'] = finalSummary;
  }

  return result;
}

/**
 * Extract cover image fields from provider data
 *
 * Handles cover, coverLarge, coverMedium, coverSmall fields.
 *
 * @param data - Provider metadata
 * @param updates - Updates object to copy from
 * @returns Updated object with cover fields
 */
export function extractCoverFields(
  data: unknown,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const coverUrl = isRecord(data)
    ? getUnknownProperty(data, 'cover') ?? getUnknownProperty(data, 'coverUrl') ?? getUnknownProperty(data, 'coverImage')
    : undefined;

  const imageData = isRecord(data) ? getUnknownProperty(data, 'image') : undefined;
  const imageMediumUrl = isRecord(imageData) ? getUnknownProperty(imageData, 'medium_url') : undefined;
  const cover = coverUrl ?? imageMediumUrl;

  if (cover) {
    return {
      ...updates,
      cover,
      coverLarge: (isRecord(data) ? getUnknownProperty(data, 'coverLarge') : undefined) ?? cover,
      coverMedium: (isRecord(data) ? getUnknownProperty(data, 'coverMedium') : undefined) ?? cover,
      coverSmall: (isRecord(data) ? getUnknownProperty(data, 'coverSmall') : undefined) ?? cover
    };
  }
  return updates;
}

/**
 * Extract status field from provider data
 *
 * @param data - Provider metadata
 * @param manga - Current manga record (for fallback)
 * @param updates - Updates object to copy from
 * @returns Updated object with status field
 */
export function extractStatusField(
  data: unknown,
  manga: unknown,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const status = isRecord(data) ? getUnknownProperty(data, 'status') : undefined;
  const mangaMeta = isRecord(manga) ? getUnknownProperty(manga, 'metadata') : undefined;
  const mangaStatus = isRecord(mangaMeta) ? getUnknownProperty(mangaMeta, 'status') : undefined;

  return { ...updates, status: normalizeStatus(status) ?? mangaStatus ?? 'UNKNOWN' };
}

/**
 * Extract authors field from provider data
 *
 * @param data - Provider metadata
 * @param manga - Current manga record (for fallback)
 * @param updates - Updates object to copy from
 * @returns Updated object with authors field
 */
export function extractAuthorsField(
  data: unknown,
  manga: unknown,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const authors = isRecord(data) ? getUnknownProperty(data, 'authors') : undefined;
  const mangaMeta = isRecord(manga) ? getUnknownProperty(manga, 'metadata') : undefined;
  const mangaAuthors = isRecord(mangaMeta) ? getUnknownProperty(mangaMeta, 'authors') : undefined;

  return { ...updates, authors: authors ?? mangaAuthors ?? [] };
}

/**
 * Extract artists field from provider data
 *
 * @param data - Provider metadata
 * @param manga - Current manga record (for fallback)
 * @param updates - Updates object to copy from
 * @returns Updated object with artists field
 */
export function extractArtistsField(
  data: unknown,
  manga: unknown,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const artists = isRecord(data) ? getUnknownProperty(data, 'artists') : undefined;
  const mangaMeta = isRecord(manga) ? getUnknownProperty(manga, 'metadata') : undefined;
  const mangaArtists = isRecord(mangaMeta) ? getUnknownProperty(mangaMeta, 'artists') : undefined;

  return { ...updates, artists: artists ?? mangaArtists ?? [] };
}

/**
 * Extract genres field from provider data
 *
 * @param data - Provider metadata
 * @param manga - Current manga record (for fallback)
 * @param updates - Updates object to copy from
 * @returns Updated object with genres field
 */
export function extractGenresField(
  data: unknown,
  manga: unknown,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const genres = isRecord(data) ? getUnknownProperty(data, 'genres') : undefined;
  const mangaMeta = isRecord(manga) ? getUnknownProperty(manga, 'metadata') : undefined;
  const mangaGenres = isRecord(mangaMeta) ? getUnknownProperty(mangaMeta, 'genres') : undefined;

  return { ...updates, genres: genres ?? mangaGenres ?? [] };
}

/**
 * Extract tags field from provider data
 *
 * @param data - Provider metadata
 * @param manga - Current manga record (for fallback)
 * @param updates - Updates object to copy from
 * @returns Updated object with tags field
 */
export function extractTagsField(
  data: unknown,
  manga: unknown,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const tags = isRecord(data) ? getUnknownProperty(data, 'tags') : undefined;
  const mangaMeta = isRecord(manga) ? getUnknownProperty(manga, 'metadata') : undefined;
  const mangaTags = isRecord(mangaMeta) ? getUnknownProperty(mangaMeta, 'tags') : undefined;

  return { ...updates, tags: tags ?? mangaTags ?? [] };
}

/**
 * Extract publisher field from provider data
 *
 * @param data - Provider metadata
 * @param manga - Current manga record (for fallback)
 * @param updates - Updates object to copy from
 * @returns Updated object with publisher field
 */
export function extractPublisherField(
  data: unknown,
  manga: unknown,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const publisher = isRecord(data) ? getUnknownProperty(data, 'publisher') : undefined;
  const mangaMeta = isRecord(manga) ? getUnknownProperty(manga, 'metadata') : undefined;
  const mangaPublisher = isRecord(mangaMeta) ? getUnknownProperty(mangaMeta, 'publisher') : undefined;

  return { ...updates, publisher: publisher ?? mangaPublisher };
}

/**
 * Extract startDate field from provider data
 *
 * @param data - Provider metadata
 * @param updates - Updates object to copy from
 * @returns Updated object with startDate field
 */
export function extractStartDateField(
  data: unknown,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const startDate = isRecord(data)
    ? getUnknownProperty(data, 'startDate') ?? getUnknownProperty(data, 'start_date')
    : undefined;

  if (startDate) {
    return { ...updates, startDate: processDate(startDate, 'startDate') };
  }
  return updates;
}

/**
 * Extract endDate field from provider data
 *
 * @param data - Provider metadata
 * @param updates - Updates object to copy from
 * @returns Updated object with endDate field
 */
export function extractEndDateField(
  data: unknown,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const endDate = isRecord(data)
    ? getUnknownProperty(data, 'endDate') ?? getUnknownProperty(data, 'end_date')
    : undefined;

  if (endDate) {
    return { ...updates, endDate: processDate(endDate, 'endDate') };
  }
  return updates;
}

/**
 * Extract releaseYear field from provider data
 *
 * Maps to startDate if not already set.
 *
 * @param data - Provider metadata
 * @param updates - Updates object to copy from
 * @returns Updated object with startDate field
 */
export function extractReleaseYearField(
  data: unknown,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const releaseYear = isRecord(data)
    ? getUnknownProperty(data, 'releaseYear') ?? getUnknownProperty(data, 'start_year')
    : undefined;

  if (releaseYear && !updates['startDate']) {
    return { ...updates, startDate: new Date(Number(releaseYear), 0, 1) };
  }
  return updates;
}

/**
 * Extract idMal field from provider data
 *
 * @param data - Provider metadata
 * @param manga - Current manga record (for fallback)
 * @param updates - Updates object to copy from
 * @returns Updated object with idMal field
 */
export function extractIdMalField(
  data: unknown,
  manga: unknown,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const idMal = isRecord(data)
    ? getUnknownProperty(data, 'idMal') ?? getUnknownProperty(data, 'mal_id')
    : undefined;

  const mangaMeta = isRecord(manga) ? getUnknownProperty(manga, 'metadata') : undefined;
  const mangaIdMal = isRecord(mangaMeta) ? getUnknownProperty(mangaMeta, 'idMal') : undefined;

  return { ...updates, idMal: idMal ?? mangaIdMal };
}

/**
 * Extract idAnilist field from provider data
 *
 * Also adds AniList URL to urls array if not present.
 *
 * @param data - Provider metadata
 * @param manga - Current manga record (for fallback)
 * @param updates - Updates object to copy from
 * @returns Updated object with urls field
 */
export function extractIdAnilistField(
  data: unknown,
  manga: unknown,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const anilistId = isRecord(data)
    ? getUnknownProperty(data, 'id') ?? getUnknownProperty(data, 'anilistId') ?? getUnknownProperty(data, 'idAnilist')
    : undefined;

  const mangaMeta = isRecord(manga) ? getUnknownProperty(manga, 'metadata') : undefined;
  const mangaUrls = isRecord(mangaMeta) ? getUnknownProperty(mangaMeta, 'urls') : undefined;
  const hasAnilistUrl = Array.isArray(mangaUrls) && mangaUrls.some((url: unknown) =>
    typeof url === 'string' && url.includes('anilist.co')
  );

  if (anilistId && !hasAnilistUrl) {
    const currentUrls: unknown[] = Array.isArray(mangaUrls) ? (mangaUrls as unknown[]).slice() : [];
    return { ...updates, urls: [...currentUrls, `https://anilist.co/manga/${anilistId}`] };
  }
  return updates;
}

/**
 * Extract averageScore field from provider data
 *
 * @param data - Provider metadata
 * @param manga - Current manga record (for fallback)
 * @param updates - Updates object to copy from
 * @returns Updated object with averageScore field
 */
export function extractAverageScoreField(
  data: unknown,
  manga: unknown,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const averageScore = isRecord(data)
    ? getUnknownProperty(data, 'averageScore') ?? getUnknownProperty(data, 'average_score')
    : undefined;

  const mangaMeta = isRecord(manga) ? getUnknownProperty(manga, 'metadata') : undefined;
  const mangaAvgScore = isRecord(mangaMeta) ? getUnknownProperty(mangaMeta, 'averageScore') : undefined;

  return { ...updates, averageScore: averageScore ?? mangaAvgScore };
}

/**
 * Extract popularity field from provider data
 *
 * @param data - Provider metadata
 * @param manga - Current manga record (for fallback)
 * @param updates - Updates object to copy from
 * @returns Updated object with popularity field
 */
export function extractPopularityField(
  data: unknown,
  manga: unknown,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const popularity = isRecord(data) ? getUnknownProperty(data, 'popularity') : undefined;
  const mangaMeta = isRecord(manga) ? getUnknownProperty(manga, 'metadata') : undefined;
  const mangaPopularity = isRecord(mangaMeta) ? getUnknownProperty(mangaMeta, 'popularity') : undefined;

  return { ...updates, popularity: popularity ?? mangaPopularity };
}

/**
 * Extract bannerImage field from provider data
 *
 * @param data - Provider metadata
 * @param manga - Current manga record (for fallback)
 * @param updates - Updates object to copy from
 * @returns Updated object with bannerImage field
 */
export function extractBannerImageField(
  data: unknown,
  manga: unknown,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const bannerImage = isRecord(data)
    ? getUnknownProperty(data, 'bannerImage') ?? getUnknownProperty(data, 'banner_image')
    : undefined;

  const mangaMeta = isRecord(manga) ? getUnknownProperty(manga, 'metadata') : undefined;
  const mangaBanner = isRecord(mangaMeta) ? getUnknownProperty(mangaMeta, 'bannerImage') : undefined;

  return { ...updates, bannerImage: bannerImage ?? mangaBanner };
}

/**
 * Extract format field from provider data
 *
 * @param data - Provider metadata
 * @param manga - Current manga record (for fallback)
 * @param updates - Updates object to copy from
 * @returns Updated object with format field
 */
export function extractFormatField(
  data: unknown,
  manga: unknown,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const format = isRecord(data) ? getUnknownProperty(data, 'format') : undefined;
  const mangaMeta = isRecord(manga) ? getUnknownProperty(manga, 'metadata') : undefined;
  const mangaFormat = isRecord(mangaMeta) ? getUnknownProperty(mangaMeta, 'format') : undefined;

  return { ...updates, format: format ?? mangaFormat };
}

/**
 * Extract synonyms/alternativeTitles field from provider data
 *
 * @param data - Provider metadata
 * @param manga - Current manga record (for fallback)
 * @param updates - Updates object to copy from
 * @returns Updated object with synonyms field
 */
export function extractSynonymsField(
  data: unknown,
  manga: unknown,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const synonyms = isRecord(data)
    ? getUnknownProperty(data, 'alternativeTitles') ?? getUnknownProperty(data, 'synonyms')
    : undefined;

  const mangaMeta = isRecord(manga) ? getUnknownProperty(manga, 'metadata') : undefined;
  const mangaSynonyms = isRecord(mangaMeta) ? getUnknownProperty(mangaMeta, 'synonyms') : undefined;

  return { ...updates, synonyms: synonyms ?? mangaSynonyms ?? [] };
}

/**
 * Helper function to extract ComicVine themes from concepts field
 */
function extractComicVineThemes(data: Record<string, unknown>): string[] {
  const concepts = getUnknownProperty(data, 'concepts') ??
    getUnknownProperty(data, 'concept_credits');
  if (!Array.isArray(concepts)) return [];

  return concepts
    .map((c: unknown) => {
      if (typeof c === 'string') return c;
      if (!isRecord(c)) return null;
      const name = getUnknownProperty(c, 'name');
      return typeof name === 'string' ? name : null;
    })
    .filter((t): t is string => t !== null && t.length > 0);
}

/**
 * Helper function to extract AniList themes from tags field
 */
function extractAniListThemes(data: Record<string, unknown>): string[] {
  const tags = getUnknownProperty(data, 'tags');
  if (!Array.isArray(tags)) return [];

  const themeCategories = ['Theme', 'Setting', 'Demographic'];
  return tags
    .filter((tag: unknown) => {
      if (!isRecord(tag)) return false;
      const category = getUnknownProperty(tag, 'category');
      return typeof category === 'string' && themeCategories.includes(category);
    })
    .map((tag: unknown) => {
      if (!isRecord(tag)) return null;
      const name = getUnknownProperty(tag, 'name');
      return typeof name === 'string' ? name : null;
    })
    .filter((t): t is string => t !== null && t.length > 0);
}

/**
 * Helper function to extract Fandom themes
 */
function extractFandomThemes(data: Record<string, unknown>): string[] {
  const fandomThemes = getUnknownProperty(data, 'themes') ??
    getUnknownProperty(data, 'categories');
  if (!Array.isArray(fandomThemes)) return [];

  return fandomThemes.filter((t): t is string => typeof t === 'string');
}

/**
 * Extract themes field from provider data
 *
 * Themes represent conceptual elements like "Action", "Adventure", "Supernatural".
 * For ComicVine, these come from the "concepts" field.
 * For AniList, these come from the "tags" field filtered by category.
 * For Fandom, these are extracted from wiki page categories.
 *
 * @param data - Provider metadata
 * @param provider - Provider name for source-specific handling
 * @param manga - Current manga record (for fallback)
 * @param updates - Updates object to copy from
 * @returns Updated object with themes field
 */
export function extractThemesField(
  data: unknown,
  provider: string,
  manga: unknown,
  updates: Record<string, unknown>
): Record<string, unknown> {
  let themes: string[] = [];

  if (isRecord(data)) {
    // Direct themes array
    const directThemes = getUnknownProperty(data, 'themes');
    if (Array.isArray(directThemes)) {
      themes = directThemes.filter((t): t is string => typeof t === 'string');
    }

    // ComicVine: Extract from concepts field
    if (provider === 'comicvine' && themes.length === 0) {
      themes = extractComicVineThemes(data);
      if (themes.length > 0) {
        logger.info(`ComicVine: Extracted ${themes.length} themes from concepts`);
      }
    }

    // AniList: Extract from tags with theme-related categories
    if (provider === 'anilist' && themes.length === 0) {
      themes = extractAniListThemes(data);
      if (themes.length > 0) {
        logger.info(`AniList: Extracted ${themes.length} themes from tags`);
      }
    }

    // Fandom: May have themes in various places
    if (provider === 'fandom' && themes.length === 0) {
      themes = extractFandomThemes(data);
      if (themes.length > 0) {
        logger.info(`Fandom: Extracted ${themes.length} themes`);
      }
    }

    // Check nested metadata object
    if (themes.length === 0) {
      const metadata = getUnknownProperty(data, 'metadata');
      if (isRecord(metadata)) {
        const nestedThemes = getUnknownProperty(metadata, 'themes');
        if (Array.isArray(nestedThemes)) {
          themes = nestedThemes.filter((t): t is string => typeof t === 'string');
        }
      }
    }
  }

  // Fallback to existing manga themes
  if (themes.length === 0) {
    const mangaMeta = isRecord(manga) ? getUnknownProperty(manga, 'metadata') : undefined;
    const mangaThemes = isRecord(mangaMeta) ? getUnknownProperty(mangaMeta, 'themes') : undefined;
    if (Array.isArray(mangaThemes)) {
      themes = mangaThemes.filter((t): t is string => typeof t === 'string');
    }
  }

  if (themes.length > 0) {
    logger.info(`Setting themes to ${themes.join(', ')} from ${provider}`);
  }

  return { ...updates, themes };
}

/**
 * Extract characters field from provider data
 *
 * @param data - Provider metadata
 * @param provider - Provider name for source-specific handling
 * @param manga - Current manga record (for fallback)
 * @param updates - Updates object to copy from
 * @returns Updated object with characters field
 */
export function extractCharactersField(
  data: unknown,
  provider: string,
  manga: unknown,
  updates: Record<string, unknown>
): Record<string, unknown> {
  let characters: string[] = [];

  if (isRecord(data)) {
    // Direct characters array
    const directChars = getUnknownProperty(data, 'characters') ??
      getUnknownProperty(data, 'character_credits');

    if (Array.isArray(directChars)) {
      characters = directChars
        .map((c: unknown) => {
          if (typeof c === 'string') return c;
          if (!isRecord(c)) return null;
          const name = getUnknownProperty(c, 'name');
          return typeof name === 'string' ? name : null;
        })
        .filter((c): c is string => c !== null && c.length > 0)
        .slice(0, 20); // Limit to top 20 characters

      if (characters.length > 0) {
        logger.info(`${provider}: Extracted ${characters.length} characters`);
      }
    }
  }

  // Fallback to existing manga characters
  if (characters.length === 0) {
    const mangaMeta = isRecord(manga) ? getUnknownProperty(manga, 'metadata') : undefined;
    const mangaChars = isRecord(mangaMeta) ? getUnknownProperty(mangaMeta, 'characters') : undefined;
    if (Array.isArray(mangaChars)) {
      characters = mangaChars
        .map((c: unknown) => {
          if (typeof c === 'string') return c;
          if (!isRecord(c)) return null;
          const name = getUnknownProperty(c, 'name');
          return typeof name === 'string' ? name : null;
        })
        .filter((c): c is string => c !== null);
    }
  }

  return { ...updates, characters };
}

/**
 * Interface for categorizing creator types
 */
interface CreatorCategories {
  authors: Set<string>;
  artists: Set<string>;
  editors: Set<string>;
  colorists: Set<string>;
  letterers: Set<string>;
  coverArtists: Set<string>;
}

/**
 * Categorize a creator by their role
 *
 * @param role - Role string to analyze
 * @param name - Creator name to add
 * @param categories - Categories object to update
 */
function categorizeCreatorByRole(
  role: string,
  name: string,
  categories: CreatorCategories
): void {
  const lowerRole = role.toLowerCase();

  if (lowerRole.includes('writer') || lowerRole.includes('author') || lowerRole.includes('story')) {
    categories.authors.add(name);
  }
  if (lowerRole.includes('artist') || lowerRole.includes('pencil') || lowerRole.includes('ink') || lowerRole.includes('illustrat')) {
    categories.artists.add(name);
  }
  if (lowerRole.includes('editor')) {
    categories.editors.add(name);
  }
  if (lowerRole.includes('color')) {
    categories.colorists.add(name);
  }
  if (lowerRole.includes('letter')) {
    categories.letterers.add(name);
  }
  if (lowerRole.includes('cover')) {
    categories.coverArtists.add(name);
  }
}

/**
 * Extract creator credits (person_credits) from provider data
 *
 * Maps roles like WRITER, ARTIST, EDITOR to appropriate fields.
 *
 * @param data - Provider metadata
 * @param provider - Provider name
 * @param manga - Current manga record (for fallback)
 * @param updates - Updates object to copy from
 * @returns Updated object with enhanced creator fields
 */
export function extractCreatorCreditsField(
  data: unknown,
  provider: string,
  manga: unknown,
  updates: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...updates };

  if (!isRecord(data)) {
    return result;
  }

  // Get person credits (ComicVine format)
  const personCredits = getUnknownProperty(data, 'person_credits') ??
    getUnknownProperty(data, 'creators') ??
    getUnknownProperty(data, 'staff');

  if (!Array.isArray(personCredits)) {
    return result;
  }

  const categories: CreatorCategories = {
    authors: new Set<string>(),
    artists: new Set<string>(),
    editors: new Set<string>(),
    colorists: new Set<string>(),
    letterers: new Set<string>(),
    coverArtists: new Set<string>(),
  };

  for (const person of personCredits) {
    if (!isRecord(person)) continue;

    const nameValue = getUnknownProperty(person, 'name');
    const name = typeof nameValue === 'string' ? nameValue : null;
    if (!name) continue;

    const roleValue = getUnknownProperty(person, 'role');
    const role = typeof roleValue === 'string' ? roleValue : '';

    categorizeCreatorByRole(role, name, categories);
  }

  // Build result from Sets
  if (categories.authors.size > 0) {
    result['authors'] = [...categories.authors];
    logger.info(`${provider}: Extracted ${categories.authors.size} authors from person_credits`);
  }
  if (categories.artists.size > 0) {
    result['artists'] = [...categories.artists];
    logger.info(`${provider}: Extracted ${categories.artists.size} artists from person_credits`);
  }

  // Store extended creator info in a structured field for providerMetadata
  if (categories.editors.size > 0 || categories.colorists.size > 0 ||
      categories.letterers.size > 0 || categories.coverArtists.size > 0) {
    result['extendedCreators'] = {
      editors: [...categories.editors],
      colorists: [...categories.colorists],
      letterers: [...categories.letterers],
      coverArtists: [...categories.coverArtists]
    };
    logger.info(`${provider}: Extracted extended creator credits`);
  }

  return result;
}
