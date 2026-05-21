/**
 * Fandom Search Result Validator
 *
 * Handles validation and transformation of Fandom wiki search results.
 * Extracts Fandom-specific fields like wiki URLs, metadata, and other enriched fields.
 *
 * Extracted from: SearchResultValidator.ts (lines 862-1279)
 */


import { MetadataProvider, MangaPublicationStatus } from '@prisma/client';

import type { SearchResult } from '@/types/search-types/core-search.types';
import { logger } from '@/utils/logger';


import { cleanHtmlDescription } from './utils';

// ============================================================================
// Parameter Interfaces
// ============================================================================

/** Fandom metadata extraction parameters */
interface FandomMetadataInput {
  volumes: number | undefined;
  chapters: number | undefined;
  authors: string[] | undefined;
  artists: string[] | undefined;
  alternativeTitles: string[] | undefined;
  startDate: unknown;
  endDate: unknown;
  year: number | undefined;
  publisher: unknown;
  magazine: unknown;
  demographic: unknown;
  published: unknown;
  format: unknown;
  description: string | undefined;
}

/** Optional fields for Fandom result */
interface FandomOptionalFields {
  coverUrl: string | undefined;
  description: string | undefined;
  status: unknown;
  alternativeTitles: string[] | undefined;
  genres: string[] | undefined;
  volumes: number | undefined;
  chapters: number | undefined;
  authors: string[] | undefined;
  artists: string[] | undefined;
  startDate: unknown;
  endDate: unknown;
  year: number | undefined;
  publisher: unknown;
  magazine: unknown;
  demographic: unknown;
  published: unknown;
  format: unknown;
  wikiUrl: string | undefined;
}

/** Extended search result with Fandom-specific fields */
interface FandomExtendedSearchResult extends SearchResult {
  magazine?: unknown;
  demographic?: unknown;
  published?: unknown;
  needsEnrichment?: boolean;
}

// ============================================================================
// Fandom Validator
// ============================================================================

export class FandomValidator {
  /** Extract cover URL from Fandom raw data */
  private static extractFandomCover(rawData: Record<string, unknown>): string | undefined {
    const coverUrl = rawData["thumbnail"] ?? rawData["imageUrl"] ?? rawData["image"] ?? rawData["coverImage"] ?? rawData["cover"];
    return typeof coverUrl === 'string' ? coverUrl : undefined;
  }

  /** Extract wiki URL from Fandom raw data */
  private static extractFandomWikiUrl(rawData: Record<string, unknown>): string | undefined {
    const wikiUrl = rawData["wikiUrl"] ?? rawData["url"] ?? rawData["sourceUrl"] ?? rawData["providerUrl"];
    return typeof wikiUrl === 'string' ? wikiUrl : undefined;
  }

  /** Extract metadata object from Fandom raw data */
  private static extractFandomMetadata(rawData: Record<string, unknown>): Record<string, unknown> {
    return rawData["metadata"] && typeof rawData["metadata"] === 'object'
      ? (rawData["metadata"] as Record<string, unknown>)
      : {};
  }

  /**
   * Extract authors from Fandom raw data or metadata
   *
   * @param rawData - Raw API data
   * @param metadata - Metadata object
   * @returns Array of author names or undefined
   */
  private static extractFandomAuthors(rawData: Record<string, unknown>, metadata: Record<string, unknown>): string[] | undefined {
    if (Array.isArray(rawData["authors"]) && rawData["authors"].length > 0) {
      return rawData["authors"] as string[];
    }
    if (typeof rawData["author"] === 'string' && rawData["author"]) {
      return [rawData["author"]];
    }
    if (Array.isArray(metadata["authors"]) && metadata["authors"].length > 0) {
      return metadata["authors"] as string[];
    }
    if (typeof metadata["author"] === 'string' && metadata["author"]) {
      return [metadata["author"] as string];
    }
    return undefined;
  }

  /**
   * Extract artists from Fandom raw data or metadata
   *
   * @param rawData - Raw API data
   * @param metadata - Metadata object
   * @returns Array of artist names or undefined
   */
  private static extractFandomArtists(rawData: Record<string, unknown>, metadata: Record<string, unknown>): string[] | undefined {
    if (Array.isArray(rawData["artists"]) && rawData["artists"].length > 0) {
      return rawData["artists"] as string[];
    }
    if (typeof rawData["artist"] === 'string' && rawData["artist"]) {
      return [rawData["artist"]];
    }
    if (Array.isArray(metadata["artists"]) && metadata["artists"].length > 0) {
      return metadata["artists"] as string[];
    }
    if (typeof metadata["artist"] === 'string' && metadata["artist"]) {
      return [metadata["artist"] as string];
    }
    return undefined;
  }

  /**
   * Extract date information from Fandom raw data
   *
   * @param rawData - Raw API data
   * @param metadata - Metadata object
   * @returns Object containing startDate, endDate, published, and year
   */
  private static extractFandomDates(
    rawData: Record<string, unknown>,
    metadata: Record<string, unknown>
  ): {
    startDate: unknown;
    endDate: unknown;
    published: unknown;
    year: number | undefined;
  } {
    const startDate = rawData["startDate"] ?? metadata["startDate"];
    const endDate = rawData["endDate"] ?? metadata["endDate"];
    const published = rawData["published"] ?? metadata["published"];

    const yearVal = rawData["year"] ?? metadata["year"];
    const year = typeof yearVal === 'number'
      ? yearVal
      : (startDate && typeof startDate === 'string'
        ? parseInt(startDate.substring(0, 4), 10)
        : undefined);

    return { startDate, endDate, published, year };
  }

  /**
   * Extract volumes and chapters from Fandom raw data
   *
   * @param rawData - Raw API data
   * @param metadata - Metadata object
   * @param baseResult - Base search result
   * @returns Object containing volumes and chapters
   */
  private static extractFandomVolumesChapters(
    rawData: Record<string, unknown>,
    metadata: Record<string, unknown>,
    baseResult: SearchResult
  ): {
    volumes: number | undefined;
    chapters: number | undefined;
  } {
    const volumes = typeof rawData["volumes"] === 'number'
      ? rawData["volumes"]
      : typeof metadata["volumes"] === 'number'
        ? metadata["volumes"]
        : baseResult.volumes;

    const chapters = typeof rawData["chapters"] === 'number'
      ? rawData["chapters"]
      : typeof metadata["chapters"] === 'number'
        ? metadata["chapters"]
        : baseResult["chapters"];

    return { volumes, chapters };
  }

  /**
   * Extract alternative titles from Fandom raw data
   *
   * @param rawData - Raw API data
   * @param metadata - Metadata object
   * @returns Array of alternative titles or undefined
   */
  private static extractFandomAlternativeTitles(
    rawData: Record<string, unknown>,
    metadata: Record<string, unknown>
  ): string[] | undefined {
    if (Array.isArray(rawData["alternativeTitles"])) {
      return rawData["alternativeTitles"].filter((t): t is string => typeof t === 'string');
    }
    if (Array.isArray(metadata["alternativeTitles"])) {
      return (metadata["alternativeTitles"] as unknown[]).filter((t): t is string => typeof t === 'string');
    }
    return undefined;
  }

  /**
   * Extract genres from Fandom raw data
   *
   * @param rawData - Raw API data
   * @param metadata - Metadata object
   * @param baseResult - Base search result
   * @returns Array of genre names or undefined
   */
  private static extractFandomGenres(
    rawData: Record<string, unknown>,
    metadata: Record<string, unknown>,
    baseResult: SearchResult
  ): string[] | undefined {
    if (Array.isArray(rawData["genres"])) {
      return rawData["genres"].filter((g): g is string => typeof g === 'string');
    }
    if (Array.isArray(metadata["genres"])) {
      return (metadata["genres"] as unknown[]).filter((g): g is string => typeof g === 'string');
    }
    return baseResult["genres"];
  }

  /**
   * Extract description from Fandom raw data
   *
   * @param rawData - Raw API data
   * @param metadata - Metadata object
   * @param baseResult - Base search result
   * @returns Cleaned description or undefined
   */
  private static extractFandomDescription(
    rawData: Record<string, unknown>,
    metadata: Record<string, unknown>,
    baseResult: SearchResult
  ): string | undefined {
    if (typeof rawData["description"] === 'string' && rawData["description"] !== 'No description available') {
      return cleanHtmlDescription(rawData["description"]);
    }
    if (typeof metadata["description"] === 'string' && metadata["description"] !== 'No description available') {
      return cleanHtmlDescription(metadata["description"] as string);
    }
    return baseResult["description"];
  }

  /**
   * Build core fields (cover, description, status, alternativeTitles)
   *
   * @param fields - Fields to add
   * @returns Partial search result with core fields
   */
  private static buildCoreFields(fields: FandomOptionalFields): Partial<FandomExtendedSearchResult> {
    const result: Partial<FandomExtendedSearchResult> = {};

    if (fields.coverUrl) {
      result.cover = fields.coverUrl;
      result.coverImage = fields.coverUrl;
    }
    if (fields.description) {
      result.description = fields.description;
    }
    if (fields.status) {
      result.status = fields.status as MangaPublicationStatus;
    }
    if (fields.alternativeTitles) {
      result.alternativeTitles = fields.alternativeTitles;
    }

    return result;
  }

  /**
   * Build count fields (genres, volumes, chapters)
   *
   * @param fields - Fields to add
   * @returns Partial search result with count fields
   */
  private static buildCountFields(fields: FandomOptionalFields): Partial<FandomExtendedSearchResult> {
    const result: Partial<FandomExtendedSearchResult> = {};

    if (fields.genres) {
      result.genres = fields.genres;
    }
    if (fields.volumes !== undefined) {
      result.volumes = fields.volumes;
    }
    if (fields.chapters !== undefined) {
      result.chapters = fields.chapters;
    }

    return result;
  }

  /**
   * Build creator fields (authors, artists) with first author/artist handling
   *
   * @param fields - Fields to add
   * @returns Partial search result with creator fields
   */
  private static buildCreatorFields(fields: FandomOptionalFields): Partial<FandomExtendedSearchResult> {
    const result: Partial<FandomExtendedSearchResult> = {};

    if (fields.authors && fields.authors.length > 0) {
      const firstAuthor = fields.authors[0];
      result.authors = fields.authors;
      if (firstAuthor !== undefined) {
        result.author = firstAuthor;
      }
    }
    if (fields.artists && fields.artists.length > 0) {
      const firstArtist = fields.artists[0];
      result.artists = fields.artists;
      if (firstArtist !== undefined) {
        result.artist = firstArtist;
      }
    }

    return result;
  }

  /**
   * Build date fields (startDate, endDate, year)
   *
   * @param fields - Fields to add
   * @returns Partial search result with date fields
   */
  private static buildDateFields(fields: FandomOptionalFields): Partial<FandomExtendedSearchResult> {
    const result: Partial<FandomExtendedSearchResult> = {};

    if (fields.startDate) {
      result.startDate = fields.startDate;
    }
    if (fields.endDate) {
      result.endDate = fields.endDate;
    }
    if (fields.year !== undefined) {
      result.year = fields.year;
    }

    return result;
  }

  /**
   * Build publication fields (publisher, magazine, demographic, published, format, wikiUrl)
   *
   * @param fields - Fields to add
   * @returns Partial search result with publication fields
   */
  private static buildPublicationFields(fields: FandomOptionalFields): Partial<FandomExtendedSearchResult> {
    const result: Partial<FandomExtendedSearchResult> = {};

    if (typeof fields.publisher === 'string' && fields.publisher) {
      result.publisher = fields.publisher;
    }
    if (fields.magazine) {
      result.magazine = fields.magazine;
    }
    if (fields.demographic) {
      result.demographic = fields.demographic;
    }
    if (fields.published) {
      result.published = fields.published;
    }
    if (typeof fields.format === 'string' && fields.format) {
      result.format = fields.format;
    }
    if (fields.wikiUrl) {
      result.wikiUrl = fields.wikiUrl;
      result.url = fields.wikiUrl;
    }

    return result;
  }

  /**
   * Build Fandom optional fields object (FIXED: No parameter mutation)
   *
   * This method replaces addFandomOptionalFields to avoid no-param-reassign linting issues.
   * Instead of mutating an input object, it returns a new partial object with the built fields.
   *
   * @param fields - Fields to add
   * @returns Partial search result with all optional fields built
   */
  private static buildFandomOptionalFields(fields: FandomOptionalFields): Partial<FandomExtendedSearchResult> {
    return {
      ...this.buildCoreFields(fields),
      ...this.buildCountFields(fields),
      ...this.buildCreatorFields(fields),
      ...this.buildDateFields(fields),
      ...this.buildPublicationFields(fields),
    };
  }

  /**
   * Build Fandom metadata object
   *
   * @param metadata - Base metadata object
   * @param extractedData - Extracted data from raw data
   * @param wikiUrl - Wiki URL
   * @returns Complete metadata object
   */
  private static buildFandomMetadata(
    metadata: Record<string, unknown>,
    extractedData: FandomMetadataInput,
    wikiUrl: string | undefined
  ): Record<string, unknown> {
    return {
      ...metadata,
      volumes: extractedData.volumes,
      chapters: extractedData.chapters,
      authors: extractedData.authors,
      artists: extractedData.artists,
      alternativeTitles: extractedData.alternativeTitles,
      startDate: extractedData.startDate,
      endDate: extractedData.endDate,
      year: extractedData.year,
      publisher: extractedData.publisher,
      magazine: extractedData.magazine,
      demographic: extractedData.demographic,
      published: extractedData.published,
      format: extractedData.format,
      author: extractedData.authors && extractedData.authors.length > 0 ? extractedData.authors[0] : metadata["author"],
      artist: extractedData.artists && extractedData.artists.length > 0 ? extractedData.artists[0] : metadata["artist"],
      description: extractedData.description,
      wikiUrl,
      url: wikiUrl
    };
  }

  /**
   * Create a Fandom-specific search result
   *
   * @param baseResult - Base search result entity
   * @param rawData - Raw API data
   * @returns Fandom search result
   */
  public static createResult(baseResult: SearchResult, rawData: Record<string, unknown>): SearchResult {
    // Log what we're receiving from Fandom
    logger.info('[FandomValidator] Processing Fandom raw data:', {
      id: rawData["id"],
      title: rawData["title"],
      hasMetadata: 'metadata' in rawData,
      metadataKeys: rawData["metadata"] && typeof rawData["metadata"] === 'object'
        ? Object.keys(rawData["metadata"] as Record<string, unknown>)
        : [],
      hasAuthors: 'authors' in rawData || 'author' in rawData,
      hasArtists: 'artists' in rawData || 'artist' in rawData,
      hasAlternativeTitles: 'alternativeTitles' in rawData,
      hasStartDate: 'startDate' in rawData,
      hasEndDate: 'endDate' in rawData,
      hasPublisher: 'publisher' in rawData,
      hasVolumes: 'volumes' in rawData,
      hasChapters: 'chapters' in rawData
    });

    // Extract fields using helper methods
    const coverUrl = this.extractFandomCover(rawData);
    const wikiUrl = this.extractFandomWikiUrl(rawData);
    const metadata = this.extractFandomMetadata(rawData);
    const authors = this.extractFandomAuthors(rawData, metadata);
    const artists = this.extractFandomArtists(rawData, metadata);
    const { startDate, endDate, published, year } = this.extractFandomDates(rawData, metadata);
    const { volumes, chapters } = this.extractFandomVolumesChapters(rawData, metadata, baseResult);
    const alternativeTitles = this.extractFandomAlternativeTitles(rawData, metadata);
    const genres = this.extractFandomGenres(rawData, metadata, baseResult);
    const description = this.extractFandomDescription(rawData, metadata, baseResult);

    // Extract publisher and other metadata fields
    const publisher = rawData["publisher"] ?? metadata["publisher"];
    const magazine = rawData["magazine"] ?? metadata["magazine"];
    const demographic = rawData["demographic"] ?? metadata["demographic"];
    const status = rawData["status"] ?? metadata["status"] ?? baseResult["status"];
    const format = rawData["format"] ?? metadata["format"];

    // Build optional fields (no mutation!)
    const optionalFields = this.buildFandomOptionalFields({
      coverUrl,
      description,
      status,
      alternativeTitles,
      genres,
      volumes,
      chapters,
      authors,
      artists,
      startDate,
      endDate,
      year,
      publisher,
      magazine,
      demographic,
      published,
      format,
      wikiUrl
    });

    // Build final result using spreading (no mutation!)
    const result: FandomExtendedSearchResult = {
      ...baseResult,
      ...optionalFields,
      provider: MetadataProvider.FANDOM,
      metadata: this.buildFandomMetadata(metadata, {
        volumes,
        chapters,
        authors,
        artists,
        alternativeTitles,
        startDate,
        endDate,
        year,
        publisher,
        magazine,
        demographic,
        published,
        format,
        description
      }, wikiUrl)
    };

    // Preserve needsEnrichment flag if present
    if (rawData["needsEnrichment"] === true) {
      result.needsEnrichment = true;
    }

    // Log the created result for debugging
    logger.info('[FandomValidator] Created Fandom result:', {
      id: result.id,
      title: result.title,
      hasDescription: !!result.description,
      authors: result.authors,
      artists: result.artists,
      alternativeTitles: result.alternativeTitles,
      startDate: result.startDate,
      endDate: result.endDate,
      volumes: result.volumes,
      chapters: result.chapters,
      publisher: result.publisher
    });

    return result;
  }
}
