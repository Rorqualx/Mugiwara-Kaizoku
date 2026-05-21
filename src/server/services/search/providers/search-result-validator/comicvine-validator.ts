/**
 * ComicVine Search Result Validator
 *
 * Handles validation and transformation of ComicVine search results.
 * Extracts ComicVine-specific fields like publisher, issues, person credits, genres, and characters.
 *
 * Extracted from: SearchResultValidator.ts (lines 603-860)
 */


import { MetadataProvider } from '@prisma/client';

import type { SearchResult, ComicVineSearchResult } from '@/types/search.types';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';


import { cleanHtmlDescription } from './utils';

import type { MangaPublicationStatus } from '@prisma/client';

// ============================================================================
// Resource Type Constants
// ============================================================================

/**
 * ComicVine resource type for volume/series pages
 * These pages contain aggregated series information
 */
export const COMICVINE_RESOURCE_VOLUME = '4050' as const;

/**
 * ComicVine resource type for issue pages
 * These pages contain individual issue information
 */
export const COMICVINE_RESOURCE_ISSUE = '4000' as const;

/**
 * ComicVine resource type union
 */
export type ComicVineResourceType = typeof COMICVINE_RESOURCE_VOLUME | typeof COMICVINE_RESOURCE_ISSUE;

// ============================================================================
// Parameter Interfaces
// ============================================================================

/**
 * Input parameters for building ComicVine metadata
 * Consolidates multiple parameters to reduce function parameter count
 */
interface ComicVineMetadataInput {
  issueCount: unknown;
  actualChapters: number | undefined;
  authors: string[] | undefined;
  artists: string[] | undefined;
  genreNames: string[] | undefined;
  themeNames: string[] | undefined;
  publisherName: string;
  startYear: unknown;
  characterNames: string[] | undefined;
  rawData: Record<string, unknown>;
}

/**
 * Extracted metadata fields for ComicVine result building
 */
interface ComicVineMetadataFields {
  startYear: unknown;
  issueCount: unknown;
  status: string | undefined;
  actualChapters: number | undefined;
}

/**
 * Extracted credits (authors and artists)
 */
interface ComicVineCredits {
  authors: string[] | undefined;
  artists: string[] | undefined;
}

/**
 * Options for building optional fields
 */
interface BuildOptionalFieldsOptions {
  rawData: Record<string, unknown>;
  baseResult: SearchResult;
  coverUrl: string | undefined;
  cleanDescription: string | undefined;
  metadataFields: ComicVineMetadataFields;
  credits: ComicVineCredits;
  genreNames: string[] | undefined;
  themeNames: string[] | undefined;
  characterNames: string[] | undefined;
}

// ============================================================================
// ComicVine Validator
// ============================================================================

export class ComicVineValidator {
  /**
   * Extract person credits (authors/artists) from ComicVine person_credits array
   *
   * Filters credits by role and extracts person names from credit objects.
   *
   * @param personCredits - Array of person credit objects from ComicVine API
   * @param roleFilter - Predicate function to filter credits by role
   * @returns Array of credit names or undefined if none found
   */
  private static extractPersonCredits(
    personCredits: Array<unknown> | undefined,
    roleFilter: (role: string) => boolean
  ): string[] | undefined {
    if (!personCredits) return undefined;

    const credits = personCredits
      .filter((credit: unknown) => {
        if (!credit || typeof credit !== 'object') return false;
        const creditObj = credit as Record<string, unknown>;
        const role = creditObj['role'];
        if (typeof role !== 'string') return false;
        return roleFilter(role.toLowerCase());
      })
      .map((credit: unknown) => {
        const creditObj = credit as Record<string, unknown>;
        return creditObj['name'];
      })
      .filter((name): name is string => typeof name === 'string');

    return credits.length > 0 ? credits : undefined;
  }

  /**
   * Extract genre names from ComicVine genres array
   *
   * Maps genre objects to their names and filters out non-string values.
   *
   * @param genres - Array of genre objects from ComicVine API
   * @returns Array of genre names or undefined if none found
   */
  private static extractGenres(genres: Array<unknown> | undefined): string[] | undefined {
    if (!genres) return undefined;

    const genreNames = genres
      .map((genre: unknown) => {
        if (!genre || typeof genre !== 'object') return genre;
        const genreObj = genre as Record<string, unknown>;
        return genreObj['name'] || genre;
      })
      .filter((name): name is string => typeof name === 'string');

    return genreNames.length > 0 ? genreNames : undefined;
  }

  /**
   * Extract character names from ComicVine characters array
   *
   * Maps character objects to their names, limits to first 10 characters
   * to prevent excessive data inclusion.
   *
   * @param characters - Array of character objects from ComicVine API
   * @returns Array of character names (up to 10) or undefined if none found
   */
  private static extractCharacters(characters: Array<unknown> | undefined): string[] | undefined {
    if (!characters) return undefined;

    const characterNames = characters
      .map((char: unknown) => {
        if (!char || typeof char !== 'object') return char;
        const charObj = char as Record<string, unknown>;
        return charObj['name'] || char;
      })
      .filter((name): name is string => typeof name === 'string')
      .slice(0, 10);

    return characterNames.length > 0 ? characterNames : undefined;
  }

  /**
   * Extract concept names from ComicVine concepts array as themes
   *
   * ComicVine stores thematic elements as "concepts" (e.g., "Action", "Adventure",
   * "Supernatural", "Time Travel", "Magic"). These map well to the "themes" field.
   *
   * @param concepts - Array of concept objects from ComicVine API
   * @returns Array of concept/theme names or undefined if none found
   */
  private static extractConcepts(concepts: Array<unknown> | undefined): string[] | undefined {
    if (!concepts) return undefined;

    const conceptNames = concepts
      .map((concept: unknown) => {
        if (!concept || typeof concept !== 'object') return concept;
        const conceptObj = concept as Record<string, unknown>;
        return conceptObj['name'] || concept;
      })
      .filter((name): name is string => typeof name === 'string');

    return conceptNames.length > 0 ? conceptNames : undefined;
  }

  /**
   * Extract resource type from ComicVine site_detail_url
   *
   * ComicVine uses different resource type codes:
   * - 4050: Volume/series pages (preferred for manga)
   * - 4000: Issue pages (individual chapters/volumes)
   *
   * @param rawData - Raw API data from ComicVine
   * @returns Resource type code or null if not detected
   */
  public static extractResourceType(rawData: Record<string, unknown>): ComicVineResourceType | null {
    const siteUrl =
      typeof rawData['site_detail_url'] === 'string'
        ? rawData['site_detail_url']
        : typeof rawData['siteDetailUrl'] === 'string'
          ? rawData['siteDetailUrl']
          : null;

    if (!siteUrl) return null;

    // Match pattern: /4050-{id}/ for volumes or /4000-{id}/ for issues
    if (siteUrl.includes('/4050-')) {
      return COMICVINE_RESOURCE_VOLUME;
    }
    if (siteUrl.includes('/4000-')) {
      return COMICVINE_RESOURCE_ISSUE;
    }

    return null;
  }

  /**
   * Check if this result is a volume/series page (4050)
   *
   * Volume pages are preferred for manga as they contain aggregated series info.
   *
   * @param rawData - Raw API data from ComicVine
   * @returns True if this is a volume page
   */
  public static isVolumePage(rawData: Record<string, unknown>): boolean {
    return this.extractResourceType(rawData) === COMICVINE_RESOURCE_VOLUME;
  }

  /**
   * Check if this result is an issue page (4000)
   *
   * @param rawData - Raw API data from ComicVine
   * @returns True if this is an issue page
   */
  public static isIssuePage(rawData: Record<string, unknown>): boolean {
    return this.extractResourceType(rawData) === COMICVINE_RESOURCE_ISSUE;
  }

  /**
   * Extract cover URL from ComicVine image object
   *
   * Tries multiple image URL fields in order of preference:
   * super_url > large_url > medium_url > screen_url > original_url
   *
   * @param rawData - Raw API data from ComicVine
   * @returns Cover URL string or undefined
   */
  private static extractCover(rawData: Record<string, unknown>): string | undefined {
    const imageObj = rawData["image"] as Record<string, unknown> | undefined;
    const coverUrl =
      imageObj?.["super_url"] ||
      imageObj?.["large_url"] ||
      imageObj?.["medium_url"] ||
      imageObj?.["screen_url"] ||
      imageObj?.["original_url"];
    return typeof coverUrl === 'string' ? coverUrl : undefined;
  }

  /**
   * Extract publisher name from ComicVine publisher object
   *
   * @param rawData - Raw API data from ComicVine
   * @returns Publisher name or empty string
   */
  private static extractPublisher(rawData: Record<string, unknown>): string {
    const publisher = rawData["publisher"] as Record<string, unknown> | undefined;
    return typeof publisher?.["name"] === 'string' ? publisher["name"] : '';
  }

  /**
   * Extract metadata fields from ComicVine raw data
   *
   * Consolidates extraction of multiple metadata fields into a single object.
   *
   * @param rawData - Raw API data from ComicVine
   * @returns Object containing start year, issue count, status, and actual chapters
   */
  private static extractMetadataFields(rawData: Record<string, unknown>): ComicVineMetadataFields {
    return {
      startYear: rawData["start_year"],
      issueCount: rawData["count_of_issues"],
      status: typeof rawData["status"] === 'string' ? rawData["status"] : undefined,
      actualChapters: typeof rawData["chapters"] === 'number' ? rawData["chapters"] : undefined
    };
  }

  /**
   * Extract author and artist credits from ComicVine data
   *
   * Searches person_credits for writers/story creators and artists/pencillers.
   *
   * @param rawData - Raw API data from ComicVine
   * @returns Object containing authors and artists arrays
   */
  private static extractCredits(rawData: Record<string, unknown>): ComicVineCredits {
    const personCredits = rawData["person_credits"] as Array<unknown> | undefined;

    const authors = this.extractPersonCredits(
      personCredits,
      (role) => role.includes('writer') || role.includes('story')
    );

    const artists = this.extractPersonCredits(
      personCredits,
      (role) => role.includes('artist') || role.includes('pencil')
    );

    return { authors, artists };
  }

  /**
   * Build complete title with volume information
   *
   * Appends issue count and publisher name to base title for display context.
   *
   * @param baseTitle - Base title from search result
   * @param issueCount - Number of issues (displayed as "X issues")
   * @param publisherName - Publisher name
   * @returns Complete formatted title
   */
  private static buildTitle(
    baseTitle: string,
    issueCount: unknown,
    publisherName: string
  ): string {
    const titleParts: string[] = [baseTitle];

    if (issueCount) {
      titleParts.push(`(${issueCount} issues)`);
    }
    if (publisherName) {
      titleParts.push(`(${publisherName})`);
    }

    return titleParts.join(' ');
  }

  /**
   * Build core ComicVine result object with required fields
   *
   * Creates the base result structure with id, title, provider, volumeId, and publisher.
   *
   * @param baseResult - Base search result from utils
   * @param rawData - Raw API data from ComicVine
   * @param completeTitle - Complete title with volume information
   * @param publisherName - Publisher name
   * @returns Core ComicVineSearchResult object
   */
  private static buildCoreResult(
    baseResult: SearchResult,
    rawData: Record<string, unknown>,
    completeTitle: string,
    publisherName: string
  ): ComicVineSearchResult {
    return {
      id: baseResult.id,
      title: completeTitle,
      type: 'manga',
      provider: MetadataProvider.COMICVINE,
      volumeId: typeof rawData["id"] === 'number' ? rawData["id"] : toNumberId(baseResult.id),
      comicvineId: baseResult["id"],
      publisher: publisherName
    };
  }

  /**
   * Build cover image fields
   */
  private static buildCoverFields(
    coverUrl: string | undefined,
    baseResult: SearchResult
  ): Partial<ComicVineSearchResult> {
    const fields: Partial<ComicVineSearchResult> = {};

    const finalCover = typeof coverUrl === 'string' ? coverUrl : baseResult.cover;
    if (finalCover) fields.cover = finalCover;

    const finalCoverImage = typeof coverUrl === 'string' ? coverUrl : baseResult.coverImage;
    if (finalCoverImage) fields.coverImage = finalCoverImage;

    logger.debug('[ComicVine] buildCoverFields result:', {
      inputCoverUrl: coverUrl,
      inputCoverUrlType: typeof coverUrl,
      baseResultCover: baseResult.cover,
      finalCover,
      finalCoverImage,
      fieldsSet: Object.keys(fields)
    });

    return fields;
  }

  /**
   * Build volume and chapter count fields
   */
  private static buildCountFields(
    metadataFields: ComicVineMetadataFields,
    baseResult: SearchResult
  ): Partial<ComicVineSearchResult> {
    const fields: Partial<ComicVineSearchResult> = {};

    if (metadataFields.status) {
      fields.status = metadataFields.status as MangaPublicationStatus;
    }

    const finalVolumes =
      typeof metadataFields.issueCount === 'number'
        ? metadataFields.issueCount
        : baseResult.volumes;
    if (finalVolumes !== undefined) fields.volumes = finalVolumes;

    if (metadataFields.actualChapters !== undefined) {
      fields.chapters = metadataFields.actualChapters;
    }

    return fields;
  }

  /**
   * Build ComicVine-specific API fields
   */
  private static buildComicVineApiFields(
    rawData: Record<string, unknown>,
    metadataFields: ComicVineMetadataFields
  ): Partial<ComicVineSearchResult> {
    const fields: Partial<ComicVineSearchResult> = {};

    if (typeof rawData["deck"] === 'string') fields.deck = rawData["deck"];

    const issuesCountVal =
      typeof rawData["count_of_issues"] === 'number'
        ? rawData["count_of_issues"]
        : typeof rawData["issuesCount"] === 'number'
          ? rawData["issuesCount"]
          : undefined;
    if (issuesCountVal !== undefined) fields.issuesCount = issuesCountVal;

    const siteDetailUrl =
      typeof rawData["site_detail_url"] === 'string'
        ? rawData["site_detail_url"]
        : typeof rawData["siteDetailUrl"] === 'string'
          ? rawData["siteDetailUrl"]
          : undefined;
    if (siteDetailUrl) fields.siteDetailUrl = siteDetailUrl;

    const yearVal = metadataFields.startYear ? Number(metadataFields.startYear) : undefined;
    if (yearVal !== undefined) fields.year = yearVal;

    return fields;
  }

  /**
   * Build a fallback description from metadata when no deck/description exists
   *
   * Creates a description in the format "Volume {year} ({issues} issues) ({publisher})"
   * to help users differentiate between different editions (e.g., Shueisha vs Viz).
   *
   * @param metadataFields - Metadata fields containing startYear and issueCount
   * @param publisherName - Publisher name (e.g., "Shueisha", "Viz")
   * @returns Fallback description string or undefined if insufficient data
   */
  private static buildFallbackDescription(
    metadataFields: ComicVineMetadataFields,
    publisherName: string
  ): string | undefined {
    const parts: string[] = [];

    // Start with "Volume" prefix if we have a year
    if (metadataFields.startYear) {
      parts.push(`Volume ${metadataFields.startYear}`);
    }

    // Add issue count
    if (metadataFields.issueCount) {
      parts.push(`(${metadataFields.issueCount} issues)`);
    }

    // Add publisher
    if (publisherName) {
      parts.push(`(${publisherName})`);
    }

    // Only return if we have meaningful info
    return parts.length > 0 ? parts.join(' ') : undefined;
  }

  /**
   * Add optional fields to ComicVine result
   *
   * Builds and returns partial object with optional fields to merge into result.
   * No mutation - returns new object for immutability.
   *
   * @param options - Options for building optional fields
   * @returns Partial result object with optional fields
   */
  private static buildOptionalFields(
    options: BuildOptionalFieldsOptions
  ): Partial<ComicVineSearchResult> {
    const fields: Partial<ComicVineSearchResult> = {};

    if (options.cleanDescription) {
      fields.description = options.cleanDescription;
    } else {
      // If no description, create a fallback from metadata (year, issues, publisher)
      // This helps users differentiate between editions like Shueisha vs Viz
      const publisherName = typeof options.rawData["publisher"] === 'object' && options.rawData["publisher"]
        ? (options.rawData["publisher"] as Record<string, unknown>)["name"]
        : undefined;
      const fallbackDescription = this.buildFallbackDescription(
        options.metadataFields,
        typeof publisherName === 'string' ? publisherName : ''
      );
      if (fallbackDescription) {
        fields.description = fallbackDescription;
      }
    }

    const coverFields = this.buildCoverFields(options.coverUrl, options.baseResult);
    Object.assign(fields, coverFields);

    const countFields = this.buildCountFields(options.metadataFields, options.baseResult);
    Object.assign(fields, countFields);

    if (options.credits.authors) fields.authors = options.credits.authors;
    if (options.credits.artists) fields.artists = options.credits.artists;

    const finalGenres = options.genreNames ?? options.baseResult.genres;
    if (finalGenres) fields.genres = finalGenres;

    // Add themes from concepts
    if (options.themeNames) {
      (fields as Record<string, unknown>)['themes'] = options.themeNames;
    }

    const apiFields = this.buildComicVineApiFields(options.rawData, options.metadataFields);
    Object.assign(fields, apiFields);

    return fields;
  }

  /**
   * Build ComicVine metadata object for storage
   *
   * Consolidates metadata using interface to manage parameters.
   * Preserves all extracted and raw data for rich metadata.
   *
   * @param input - ComicVine metadata input parameters
   * @returns Complete metadata object
   */
  private static buildMetadata(input: ComicVineMetadataInput): Record<string, unknown> {
    return {
      volumes: input.issueCount,
      chapters: input.actualChapters,
      volumeData: [],
      chapterData: [],
      authors: input.authors ?? [],
      artists: input.artists ?? [],
      tags: input.genreNames ?? [],
      themes: input.themeNames ?? [],
      bannerImage: null,
      format: 'manga',
      publisher: input.publisherName,
      startYear: input.startYear,
      characters: input.characterNames ?? [],
      rawData: input.rawData
    };
  }

  /**
   * Create a ComicVine-specific search result
   *
   * Main orchestration function that transforms base result with ComicVine-specific data.
   * Low complexity due to helper methods handling extraction and building logic.
   *
   * @param baseResult - Base search result entity
   * @param rawData - Raw API data from ComicVine
   * @returns ComicVine search result with all extracted and transformed fields
   */
  public static createResult(
    baseResult: SearchResult,
    rawData: Record<string, unknown>
  ): ComicVineSearchResult {
    logger.debug('[ComicVine] Processing raw data:', {
      id: rawData["id"],
      hasDescription: 'description' in rawData,
      hasDeck: 'deck' in rawData,
      hasImage: 'image' in rawData,
      imageType: typeof rawData["image"],
      imageData: rawData["image"]
    });

    // Extract all data
    const coverUrl = this.extractCover(rawData);
    const publisherName = this.extractPublisher(rawData);
    const metadataFields = this.extractMetadataFields(rawData);
    const credits = this.extractCredits(rawData);

    // Process description
    const description = rawData["deck"] || rawData["description"] || baseResult.description;
    const cleanDescription =
      typeof description === 'string' ? cleanHtmlDescription(description) : undefined;

    // Extract genres, concepts (themes), and characters
    const genres = rawData["genres"] as Array<unknown> | undefined;
    const genreNames = this.extractGenres(genres);
    const concepts = rawData["concepts"] as Array<unknown> | undefined;
    const themeNames = this.extractConcepts(concepts);
    const characters = rawData["characters"] as Array<unknown> | undefined;
    const characterNames = this.extractCharacters(characters);

    // Debug logging for concepts/themes extraction
    logger.debug('[ComicVine Validator] Concepts extraction:', {
      hasConcepts: !!concepts,
      conceptsCount: concepts?.length ?? 0,
      conceptsRaw: concepts?.slice(0, 5),
      extractedThemes: themeNames,
      themesCount: themeNames?.length ?? 0
    });

    // Build title and core result
    const completeTitle = this.buildTitle(
      baseResult.title,
      metadataFields.issueCount,
      publisherName
    );
    const result = this.buildCoreResult(baseResult, rawData, completeTitle, publisherName);

    // Add optional fields
    const optionalFields = this.buildOptionalFields({
      rawData,
      baseResult,
      coverUrl,
      cleanDescription,
      metadataFields,
      credits,
      genreNames,
      themeNames,
      characterNames
    });

    // Build metadata
    result.metadata = this.buildMetadata({
      issueCount: metadataFields.issueCount,
      actualChapters: metadataFields.actualChapters,
      authors: credits.authors,
      artists: credits.artists,
      genreNames,
      themeNames,
      publisherName,
      startYear: metadataFields.startYear,
      characterNames,
      rawData
    });

    const finalResult = { ...result, ...optionalFields };

    logger.debug('[ComicVine] Created result:', {
      id: finalResult.id,
      title: finalResult.title,
      hasCover: !!finalResult.cover,
      cover: finalResult.cover,
      hasCoverImage: !!finalResult.coverImage,
      coverImage: finalResult.coverImage,
      extractedCoverUrl: coverUrl,
      optionalFieldsKeys: Object.keys(optionalFields)
    });

    return finalResult;
  }
}
