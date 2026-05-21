/**
 * AniList Search Result Validator
 *
 * Handles validation and transformation of AniList search results.
 * Extracts AniList-specific fields like staff, tags, banner images, etc.
 *
 * Extracted from: SearchResultValidator.ts (lines 266-601)
 */


import { MetadataProvider } from '@prisma/client';

import type { SearchResult, AniListSearchResult } from '@/types/search.types';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';


import { cleanHtmlDescription } from './utils';

import type { MangaPublicationStatus } from '@prisma/client';

// ============================================================================
// Parameter Interfaces (Fix max-params ESLint violation)
// ============================================================================

/**
 * Input parameters for building AniList final values
 */
interface AniListFinalValuesInput {
  rawData: Record<string, unknown>;
  baseResult: SearchResult;
  coverUrl: string | undefined;
  title: string;
  synonyms: string[] | undefined;
  authors: string[];
  artists: string[];
}

/**
 * Return type for buildAniListFinalValues method
 */
interface AniListFinalValues {
  finalTitle: string;
  finalCover: string | undefined;
  finalCoverImage: string | undefined;
  finalStatus: MangaPublicationStatus | undefined;
  format: string | undefined;
  finalAltTitles: string[] | undefined;
  finalChapters: number | undefined;
  finalVolumes: number | undefined;
  averageScore: number | undefined;
  popularity: number | undefined;
  trending: number | undefined;
  finalScore: number | undefined;
  finalAuthors: string[] | undefined;
  finalArtists: string[] | undefined;
  bannerImage: string | undefined;
}

/**
 * Input parameters for building AniList optional fields
 */
interface AniListOptionalFieldsInput {
  finalValues: AniListFinalValues;
  cleanedDescription: string | undefined;
  year: number | undefined;
  startDate: Record<string, unknown> | undefined;
  endDate: Record<string, unknown> | undefined;
  tags: unknown[] | undefined;
}

// ============================================================================
// AniList Validator Class
// ============================================================================

/**
 * Validator for AniList search results
 * Provides helper methods and main factory method for creating AniList results
 */
export class AniListValidator {
  /**
   * Extract name from staff node object
   *
   * @param node - Staff node object from AniList API
   * @returns Extracted name string or empty string
   */
  private static extractNameFromStaffNode(node: unknown): string {
    if (!node || typeof node !== 'object') return '';
    const nodeObj = node as Record<string, unknown>;
    const name = nodeObj['name'];
    if (!name || typeof name !== 'object') return '';
    const nameObj = name as Record<string, unknown>;
    return (typeof nameObj['full'] === 'string' ? nameObj['full'] : '') ||
           (typeof nameObj['native'] === 'string' ? nameObj['native'] : '');
  }

  /**
   * Extract staff by role from staff edges array
   *
   * @param staffEdges - Array of staff edge objects from AniList API
   * @param roleFilter - Role string to filter by (e.g., 'Story', 'Art')
   * @returns Array of staff names matching the role filter
   */
  private static extractStaffByRole(staffEdges: unknown[], roleFilter: string): string[] {
    return staffEdges
      .filter((edge: unknown) => {
        if (!edge || typeof edge !== 'object') return false;
        const edgeObj = edge as Record<string, unknown>;
        const role = edgeObj['role'];
        return typeof role === 'string' && role.includes(roleFilter);
      })
      .map((edge: unknown) => {
        const edgeObj = edge as Record<string, unknown>;
        const node = edgeObj['node'];
        return this.extractNameFromStaffNode(node);
      })
      .filter(Boolean);
  }

  /**
   * Extract cover image URL from AniList coverImage object
   *
   * @param rawData - Raw API data
   * @returns Cover URL string or undefined
   */
  private static extractAniListCover(rawData: Record<string, unknown>): string | undefined {
    const coverImage = rawData["coverImage"] as Record<string, unknown> | undefined;
    const coverUrl = coverImage?.["extraLarge"] ?? coverImage?.["large"] ?? coverImage?.["medium"];
    return typeof coverUrl === 'string' ? coverUrl : undefined;
  }

  /**
   * Extract title from AniList title object
   *
   * @param rawData - Raw API data
   * @param baseTitle - Fallback title from base result
   * @returns Extracted title string
   */
  private static extractAniListTitle(rawData: Record<string, unknown>, baseTitle: string): string {
    const titleObj = rawData["title"] as Record<string, unknown> | undefined;
    const title = titleObj?.["english"] ?? titleObj?.["romaji"] ?? titleObj?.["native"] ?? baseTitle;
    return typeof title === 'string' ? title : baseTitle;
  }

  /**
   * Extract date information from AniList raw data
   *
   * @param rawData - Raw API data
   * @returns Object containing startDate, endDate, and year
   */
  private static extractAniListDates(rawData: Record<string, unknown>): {
    startDate: Record<string, unknown> | undefined;
    endDate: Record<string, unknown> | undefined;
    year: number | undefined;
  } {
    const startDate = rawData["startDate"] as Record<string, unknown> | undefined;
    const endDate = rawData["endDate"] as Record<string, unknown> | undefined;
    const year = startDate?.["year"] as number | undefined;

    return { startDate, endDate, year };
  }

  /**
   * Extract and process tags from AniList raw data
   *
   * @param rawData - Raw API data
   * @returns Array of processed tag names or undefined
   */
  private static extractAniListTags(rawData: Record<string, unknown>): unknown[] | undefined {
    if (!Array.isArray(rawData["tags"])) return undefined;

    return rawData["tags"].map((tag: unknown) => {
      if (!tag || typeof tag !== 'object') return tag;
      const tagObj = tag as Record<string, unknown>;
      return tagObj['name'] ?? tag;
    }).filter(Boolean);
  }

  /**
   * Extract authors and artists from staff field or direct fields
   *
   * @param rawData - Raw API data
   * @returns Object containing authors and artists arrays
   */
  private static extractAniListStaff(rawData: Record<string, unknown>): {
    authors: string[];
    artists: string[];
  } {
    let authors: string[] = [];
    let artists: string[] = [];

    // First check if they're already extracted (from a previous validation)
    if (Array.isArray(rawData["authors"]) && rawData["authors"].length > 0) {
      authors = rawData["authors"] as string[];
    }
    if (Array.isArray(rawData["artists"]) && rawData["artists"].length > 0) {
      artists = rawData["artists"] as string[];
    }

    // If not found, try to extract from staff field
    if (authors.length === 0 || artists.length === 0) {
      if (rawData["staff"] && typeof rawData["staff"] === 'object' && 'edges' in rawData["staff"]) {
        const staffObj = rawData["staff"] as Record<string, unknown>;
        const staffEdges = staffObj['edges'];
        if (Array.isArray(staffEdges)) {
          if (authors.length === 0) {
            authors = this.extractStaffByRole(staffEdges, 'Story');
          }
          if (artists.length === 0) {
            artists = this.extractStaffByRole(staffEdges, 'Art');
          }
        }
      }
    }

    return { authors, artists };
  }

  /**
   * Build AniList metadata object from raw data
   *
   * @param rawData - Raw API data
   * @returns Metadata object with all preserved fields
   */
  private static buildAniListMetadata(rawData: Record<string, unknown>): Record<string, unknown> {
    return {
      volumes: rawData["volumes"],
      chapters: rawData["chapters"],
      bannerImage: rawData["bannerImage"],
      format: rawData["format"],
      idMal: rawData["idMal"],
      startDate: rawData["startDate"],
      endDate: rawData["endDate"],
      tags: rawData["tags"],
      staff: rawData["staff"],
      characters: rawData["characters"],
      externalLinks: rawData["externalLinks"],
      countryOfOrigin: rawData["countryOfOrigin"],
      isAdult: rawData["isAdult"],
      source: rawData["source"],
      synonyms: rawData["synonyms"],
      relations: rawData["relations"],
      recommendations: rawData["recommendations"],
      stats: rawData["stats"],
      favourites: rawData["favourites"],
      meanScore: rawData["meanScore"],
      updatedAt: rawData["updatedAt"],
      siteUrl: rawData["siteUrl"]
    };
  }

  /**
   * Build final values for AniList result from raw data and base result
   * Fixes max-params ESLint violation by accepting parameter interface
   *
   * @param input - Input parameters interface
   * @returns Object containing all final values for AniList result
   */
  private static buildAniListFinalValues(
    input: AniListFinalValuesInput
  ): AniListFinalValues {
    const { rawData, baseResult, coverUrl, title, synonyms, authors, artists } = input;
    const averageScore = typeof rawData["averageScore"] === 'number' ? rawData["averageScore"] : undefined;

    return {
      finalTitle: title,
      finalCover: coverUrl ?? baseResult.cover,
      finalCoverImage: coverUrl ?? baseResult.coverImage,
      finalStatus: typeof rawData["status"] === 'string' ? (rawData["status"] as MangaPublicationStatus) : (baseResult.status as MangaPublicationStatus | undefined),
      format: typeof rawData["format"] === 'string' ? rawData["format"] : undefined,
      finalAltTitles: (synonyms && synonyms.length > 0) ? synonyms : baseResult.alternativeTitles,
      finalChapters: typeof rawData["chapters"] === 'number' ? rawData["chapters"] : baseResult.chapters,
      finalVolumes: typeof rawData["volumes"] === 'number' ? rawData["volumes"] : baseResult.volumes,
      averageScore,
      popularity: typeof rawData["popularity"] === 'number' ? rawData["popularity"] : undefined,
      trending: typeof rawData["trending"] === 'number' ? rawData["trending"] : undefined,
      finalScore: averageScore,
      finalAuthors: authors.length > 0 ? authors : undefined,
      finalArtists: artists.length > 0 ? artists : undefined,
      bannerImage: typeof rawData["bannerImage"] === 'string' ? rawData["bannerImage"] : undefined
    };
  }

  /**
   * Build AniList optional fields object (immutable approach)
   * Fixes no-param-reassign ESLint violation by returning new object
   *
   * @param input - Input parameters interface
   * @returns Object containing all optional fields for AniList result
   */
  private static buildAniListOptionalFields(
    input: AniListOptionalFieldsInput
  ): Partial<AniListSearchResult> {
    const { finalValues, cleanedDescription, year, startDate, endDate, tags } = input;
    const fields: Partial<AniListSearchResult> = {};

    if (cleanedDescription) fields.description = cleanedDescription;
    if (finalValues.finalCover) fields.cover = finalValues.finalCover;
    if (finalValues.finalCoverImage) fields.coverImage = finalValues.finalCoverImage;
    if (finalValues.finalStatus) fields.status = finalValues.finalStatus;
    if (finalValues.format) fields.format = finalValues.format;
    if (finalValues.finalAltTitles) fields.alternativeTitles = finalValues.finalAltTitles;
    if (finalValues.finalChapters !== undefined) fields.chapters = finalValues.finalChapters;
    if (finalValues.finalVolumes !== undefined) fields.volumes = finalValues.finalVolumes;
    if (finalValues.averageScore !== undefined) fields.averageScore = finalValues.averageScore;
    if (finalValues.popularity !== undefined) fields.popularity = finalValues.popularity;
    if (finalValues.trending !== undefined) fields.trending = finalValues.trending;
    if (finalValues.finalScore !== undefined) fields.score = finalValues.finalScore;
    if (finalValues.finalAuthors) fields.authors = finalValues.finalAuthors;
    if (finalValues.finalArtists) fields.artists = finalValues.finalArtists;
    if (year !== undefined) fields.year = year;
    if (startDate) fields.startDate = startDate;
    if (endDate) fields.endDate = endDate;
    if (finalValues.bannerImage) fields.bannerImage = finalValues.bannerImage;
    if (tags) fields.tags = tags;

    return fields;
  }

  /**
   * Create an AniList-specific search result
   *
   * @param baseResult - Base search result entity
   * @param rawData - Raw API data
   * @returns AniList search result
   */
  public static createResult(baseResult: SearchResult, rawData: Record<string, unknown>): AniListSearchResult {
    logger.info('AniListValidator: Processing AniList raw data:', {
      id: rawData["id"],
      title: rawData["title"],
      hasChapters: 'chapters' in rawData,
      chapters: rawData["chapters"],
      hasVolumes: 'volumes' in rawData,
      volumes: rawData["volumes"],
      hasBannerImage: 'bannerImage' in rawData,
      bannerImage: rawData["bannerImage"],
      hasStaff: 'staff' in rawData,
      hasTags: 'tags' in rawData,
      hasAverageScore: 'averageScore' in rawData,
      averageScore: rawData["averageScore"],
      hasPopularity: 'popularity' in rawData,
      popularity: rawData["popularity"]
    });

    // Extract fields using helper methods
    const coverUrl = this.extractAniListCover(rawData);
    const title = this.extractAniListTitle(rawData, baseResult.title);
    const { startDate, endDate, year } = this.extractAniListDates(rawData);
    const { authors, artists } = this.extractAniListStaff(rawData);
    const tags = this.extractAniListTags(rawData);

    // Debug: Log extracted authors/artists
    logger.info('[AniListValidator] Staff extraction result:', {
      rawDataStaff: rawData["staff"] ? 'present' : 'missing',
      staffEdgesCount: (rawData["staff"] as Record<string, unknown> | undefined)?.["edges"] ?
        (Array.isArray((rawData["staff"] as Record<string, unknown>)["edges"]) ?
          ((rawData["staff"] as Record<string, unknown>)["edges"] as unknown[]).length : 0) : 0,
      extractedAuthors: authors,
      extractedArtists: artists,
      authorsCount: authors.length,
      artistsCount: artists.length,
    });

    // Extract synonyms (alternative titles) from AniList
    const synonyms = Array.isArray(rawData["synonyms"])
      ? rawData["synonyms"].filter((s): s is string => typeof s === 'string')
      : undefined;

    // Clean description if it exists
    const cleanedDescription = typeof rawData["description"] === 'string'
      ? cleanHtmlDescription(rawData["description"])
      : baseResult.description;

    // Build final values using helper method
    const finalValues = this.buildAniListFinalValues({
      rawData,
      baseResult,
      coverUrl,
      title,
      synonyms,
      authors,
      artists
    });

    // Build optional fields using helper method (no mutation!)
    const optionalFields = this.buildAniListOptionalFields({
      finalValues,
      cleanedDescription,
      year,
      startDate,
      endDate,
      tags
    });

    // Build result object using spread operator (immutable approach)
    const result: AniListSearchResult = {
      ...baseResult,
      ...optionalFields,
      provider: MetadataProvider.ANILIST,
      title: finalValues.finalTitle,
      anilistId: typeof rawData["anilistId"] === 'number'
        ? rawData["anilistId"]
        : typeof rawData["id"] === 'number'
          ? rawData["id"]
          : toNumberId(baseResult.id),
      metadata: this.buildAniListMetadata(rawData)
    };

    return result;
  }
}
