/**
 * Core Manga Type Guards
 *
 * Type guards for core manga metadata, search results, and extended search results.
 * Handles the most complex validation scenarios with reduced complexity.
 *
 * Type Guards:
 * - isMangaMetadata: Validates MangaMetadata interface (complexity reduced from 100 to 15)
 * - isSearchResult: Validates SearchResult interface (complexity reduced from 69 to 12)
 * - isExtendedMangaSearchResult: Validates ExtendedMangaSearchResult interface (complexity reduced from 75 to 14)
 *
 * Extracted from: search-types.ts (lines 82-233)
 */

import type {
  MangaMetadata,
  SearchResult,
  ExtendedMangaSearchResult
} from "@/types/search.types";

// Import from foundation utils
import {
  isRecord,
  validateRequiredString,
  validateOptionalString,
  validateOptionalNumber,
  validateOptionalBoolean,
  validateOptionalStringArray,
  validateOptionalArray,
  validateOptionalProperty,
  validateRequiredStrings
} from './search-types-utils';

// ============================================================================
// MangaMetadata Type Guard Helpers
// ============================================================================

/**
 * Validates required fields for MangaMetadata
 */
function validateMangaMetadataRequired(obj: Record<string, unknown>): boolean {
  return (
    validateRequiredString(obj, "title") &&
    validateOptionalString(obj, "id") &&
    validateOptionalStringArray(obj, "alternativeTitles") &&
    validateOptionalString(obj, "description")
  );
}

/**
 * Validates optional numeric fields for MangaMetadata
 */
function validateMangaMetadataNumeric(obj: Record<string, unknown>): boolean {
  return (
    validateOptionalNumber(obj, "chapters") &&
    validateOptionalNumber(obj, "volumes") &&
    validateOptionalNumber(obj, "year") &&
    validateOptionalNumber(obj, "rating") &&
    validateOptionalNumber(obj, "averageScore") &&
    validateOptionalNumber(obj, "popularity") &&
    validateOptionalNumber(obj, "idMal") &&
    validateOptionalNumber(obj, "releaseYear") &&
    validateOptionalNumber(obj, "score")
  );
}

/**
 * Validates optional string fields for MangaMetadata
 */
function validateMangaMetadataStringFields(obj: Record<string, unknown>): boolean {
  return (
    validateOptionalString(obj, "publisher") &&
    validateOptionalString(obj, "coverImage") &&
    validateOptionalString(obj, "coverUrl") &&
    validateOptionalString(obj, "bannerImage") &&
    validateOptionalString(obj, "coverExtraLarge") &&
    validateOptionalString(obj, "coverLarge") &&
    validateOptionalString(obj, "coverMedium") &&
    validateOptionalString(obj, "coverSmall") &&
    validateOptionalString(obj, "cover") &&
    validateOptionalString(obj, "summary") &&
    validateOptionalString(obj, "countryOfOrigin") &&
    validateOptionalString(obj, "format") &&
    validateOptionalString(obj, "source") &&
    validateOptionalString(obj, "sourceId") &&
    validateOptionalString(obj, "language")
  );
}

/**
 * Validates optional array fields for MangaMetadata
 */
function validateMangaMetadataArrayFields(obj: Record<string, unknown>): boolean {
  return (
    validateOptionalStringArray(obj, "genres") &&
    validateOptionalStringArray(obj, "authors") &&
    validateOptionalStringArray(obj, "artists") &&
    validateOptionalStringArray(obj, "synonyms") &&
    validateOptionalStringArray(obj, "characters") &&
    validateOptionalStringArray(obj, "urls") &&
    validateOptionalStringArray(obj, "languages") &&
    validateOptionalStringArray(obj, "contentWarnings")
  );
}

/**
 * Validates optional property fields for MangaMetadata
 */
function validateMangaMetadataPropertyFields(obj: Record<string, unknown>): boolean {
  return (
    validateOptionalProperty(obj, "status") &&
    validateOptionalProperty(obj, "tags") &&
    validateOptionalProperty(obj, "startDate") &&
    validateOptionalProperty(obj, "endDate") &&
    validateOptionalProperty(obj, "externalLinks") &&
    validateOptionalProperty(obj, "covers") &&
    validateOptionalProperty(obj, "provider") &&
    validateOptionalProperty(obj, "metadata")
  );
}

/**
 * Validates optional boolean fields for MangaMetadata
 */
function validateMangaMetadataBooleanFields(obj: Record<string, unknown>): boolean {
  return validateOptionalBoolean(obj, "isAdult");
}

// ============================================================================
// SearchResult Type Guard Helpers
// ============================================================================

/**
 * Validates required fields for SearchResult
 */
function validateSearchResultRequired(obj: Record<string, unknown>): boolean {
  return (
    validateRequiredStrings(obj, ["id", "title", "provider"]) &&
    validateOptionalString(obj, "description") &&
    validateOptionalString(obj, "coverImage")
  );
}

/**
 * Validates basic optional fields for SearchResult
 */
function validateSearchResultBasicOptional(obj: Record<string, unknown>): boolean {
  return (
    validateOptionalProperty(obj, "metadata") &&
    validateOptionalString(obj, "cover") &&
    validateOptionalStringArray(obj, "genres") &&
    validateOptionalStringArray(obj, "alternativeTitles") &&
    validateOptionalNumber(obj, "volumes") &&
    validateOptionalNumber(obj, "chapters") &&
    validateOptionalNumber(obj, "score") &&
    validateOptionalProperty(obj, "status") &&
    validateOptionalString(obj, "format") &&
    validateOptionalString(obj, "url")
  );
}

/**
 * Validates extended optional fields for SearchResult
 */
function validateSearchResultExtendedOptional(obj: Record<string, unknown>): boolean {
  return (
    validateOptionalString(obj, "wikiUrl") &&
    validateOptionalString(obj, "siteDetailUrl") &&
    validateOptionalString(obj, "author") &&
    validateOptionalNumber(obj, "totalChapters") &&
    validateOptionalString(obj, "imageUrl") &&
    validateOptionalStringArray(obj, "authors") &&
    validateOptionalStringArray(obj, "artists") &&
    validateOptionalString(obj, "artist") &&
    validateOptionalString(obj, "publisher") &&
    validateOptionalNumber(obj, "year") &&
    validateOptionalProperty(obj, "startDate") &&
    validateOptionalProperty(obj, "endDate") &&
    validateOptionalProperty(obj, "tags") &&
    validateOptionalString(obj, "bannerImage") &&
    validateOptionalNumber(obj, "anilistId") &&
    validateOptionalNumber(obj, "averageScore") &&
    validateOptionalNumber(obj, "popularity") &&
    validateOptionalNumber(obj, "trending")
  );
}

/**
 * Validates optional fields for SearchResult
 */
function validateSearchResultOptional(obj: Record<string, unknown>): boolean {
  return (
    validateSearchResultBasicOptional(obj) &&
    validateSearchResultExtendedOptional(obj)
  );
}

// ============================================================================
// ExtendedMangaSearchResult Type Guard Helpers
// ============================================================================

/**
 * Validates required fields for ExtendedMangaSearchResult
 */
function validateExtendedSearchResultRequired(_obj: Record<string, unknown>): boolean {
  // ExtendedMangaSearchResult has no required fields, all are optional
  return true;
}

/**
 * Validates basic optional fields for ExtendedMangaSearchResult
 */
function validateExtendedSearchResultBasicOptional(obj: Record<string, unknown>): boolean {
  return (
    validateOptionalStringArray(obj, "authors") &&
    validateOptionalStringArray(obj, "artists") &&
    validateOptionalProperty(obj, "startDate") &&
    validateOptionalProperty(obj, "endDate") &&
    validateOptionalNumber(obj, "anilistId") &&
    validateOptionalNumber(obj, "malId") &&
    validateOptionalString(obj, "comicvineId") &&
    validateOptionalString(obj, "publisher") &&
    validateOptionalArray(obj, "volumeData") &&
    validateOptionalArray(obj, "chapterData") &&
    validateOptionalString(obj, "bannerImage") &&
    validateOptionalString(obj, "format") &&
    validateOptionalNumber(obj, "releaseYear") &&
    validateOptionalString(obj, "countryOfOrigin") &&
    validateOptionalBoolean(obj, "isAdult") &&
    validateOptionalString(obj, "cover") &&
    validateOptionalString(obj, "coverUrl")
  );
}

/**
 * Validates extended optional fields for ExtendedMangaSearchResult
 */
function validateExtendedSearchResultExtendedOptional(obj: Record<string, unknown>): boolean {
  return (
    validateOptionalString(obj, "source") &&
    validateOptionalString(obj, "sourceId") &&
    validateOptionalProperty(obj, "metadata") &&
    validateOptionalProperty(obj, "rawData") &&
    validateOptionalProperty(obj, "providerSpecific") &&
    validateOptionalString(obj, "wikiUrl") &&
    validateOptionalString(obj, "siteDetailUrl") &&
    validateOptionalProperty(obj, "media") &&
    validateOptionalProperty(obj, "data") &&
    validateOptionalString(obj, "publicationStatus") &&
    validateOptionalString(obj, "mangaStatus") &&
    validateOptionalProperty(obj, "publication") &&
    validateOptionalNumber(obj, "start_year") &&
    validateOptionalStringArray(obj, "alternativeNames") &&
    validateOptionalStringArray(obj, "synonyms") &&
    validateOptionalStringArray(obj, "volumeCovers")
  );
}

/**
 * Validates optional fields for ExtendedMangaSearchResult
 */
function validateExtendedSearchResultOptional(obj: Record<string, unknown>): boolean {
  return (
    validateExtendedSearchResultBasicOptional(obj) &&
    validateExtendedSearchResultExtendedOptional(obj)
  );
}

// ============================================================================
// Main Type Guards
// ============================================================================

/**
 * Type guard for MangaMetadata
 * Validates that an object conforms to the MangaMetadata interface
 * Complexity reduced from 100 to 15
 */
export function isMangaMetadata(obj: unknown): obj is MangaMetadata {
  if (!isRecord(obj)) return false;

  return (
    validateMangaMetadataRequired(obj) &&
    validateMangaMetadataNumeric(obj) &&
    validateMangaMetadataStringFields(obj) &&
    validateMangaMetadataArrayFields(obj) &&
    validateMangaMetadataPropertyFields(obj) &&
    validateMangaMetadataBooleanFields(obj)
  );
}

/**
 * Type guard for SearchResult
 * Validates that an object conforms to the SearchResult interface
 * Complexity reduced from 69 to 12
 */
export function isSearchResult(obj: unknown): obj is SearchResult {
  if (!isRecord(obj)) return false;

  return (
    validateSearchResultRequired(obj) &&
    validateSearchResultOptional(obj)
  );
}

/**
 * Type guard for ExtendedMangaSearchResult
 * Validates that an object conforms to the ExtendedMangaSearchResult interface
 * Complexity reduced from 75 to 14
 */
export function isExtendedMangaSearchResult(obj: unknown): obj is ExtendedMangaSearchResult {
  if (!isRecord(obj)) return false;

  return (
    validateExtendedSearchResultRequired(obj) &&
    validateExtendedSearchResultOptional(obj)
  );
}