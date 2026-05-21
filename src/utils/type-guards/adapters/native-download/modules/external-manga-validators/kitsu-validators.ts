/**
 * Kitsu Manga Type Validators
 *
 * Modular validators for ExternalKitsuManga type guard decomposition
 */

import {
  isString,
  isObject,
  hasOptionalProperty,
  hasRequiredPropertyOfType
} from "../shared-validators/basic-validators";

/**
 * Validate required Kitsu manga fields
 */
export function validateRequiredKitsuFields(
  candidate: Record<string, unknown>
): boolean {
  return (
    hasRequiredPropertyOfType(candidate, "id", isString) &&
    hasRequiredPropertyOfType(candidate, "type", isString) &&
    candidate["type"] === "manga"
  );
}

/**
 * Validate optional Kitsu manga fields
 */
export function validateOptionalKitsuFields(
  candidate: Record<string, unknown>
): boolean {
  return (
    hasOptionalProperty(candidate, "links") &&
    hasOptionalProperty(candidate, "attributes") &&
    hasOptionalProperty(candidate, "relationships")
  );
}

/**
 * Validate Kitsu links structure
 */
export function validateKitsuLinks(
  links: unknown
): links is { self?: string } {
  if (!isObject(links)) return false;

  const linksObj = links as Record<string, unknown>;
  return hasOptionalProperty(linksObj, "self");
}

/**
 * Validate basic Kitsu attribute fields (strings and dates)
 */
function validateKitsuAttributesBasic(attrsObj: Record<string, unknown>): boolean {
  return (
    hasOptionalProperty(attrsObj, "createdAt") &&
    hasOptionalProperty(attrsObj, "updatedAt") &&
    hasOptionalProperty(attrsObj, "slug") &&
    hasOptionalProperty(attrsObj, "synopsis") &&
    hasOptionalProperty(attrsObj, "description") &&
    hasOptionalProperty(attrsObj, "startDate") &&
    hasOptionalProperty(attrsObj, "endDate") &&
    hasOptionalProperty(attrsObj, "nextRelease")
  );
}

/**
 * Validate title-related Kitsu attribute fields
 */
function validateKitsuAttributesTitles(attrsObj: Record<string, unknown>): boolean {
  return (
    hasOptionalProperty(attrsObj, "titles") &&
    hasOptionalProperty(attrsObj, "canonicalTitle") &&
    hasOptionalProperty(attrsObj, "abbreviatedTitles")
  );
}

/**
 * Validate rating-related Kitsu attribute fields
 */
function validateKitsuAttributesRatings(attrsObj: Record<string, unknown>): boolean {
  return (
    hasOptionalProperty(attrsObj, "averageRating") &&
    hasOptionalProperty(attrsObj, "ratingFrequencies") &&
    hasOptionalProperty(attrsObj, "popularityRank") &&
    hasOptionalProperty(attrsObj, "ratingRank") &&
    hasOptionalProperty(attrsObj, "ageRating") &&
    hasOptionalProperty(attrsObj, "ageRatingGuide")
  );
}

/**
 * Validate count and status Kitsu attribute fields
 */
function validateKitsuAttributesCounts(attrsObj: Record<string, unknown>): boolean {
  return (
    hasOptionalProperty(attrsObj, "userCount") &&
    hasOptionalProperty(attrsObj, "favoritesCount") &&
    hasOptionalProperty(attrsObj, "chapterCount") &&
    hasOptionalProperty(attrsObj, "volumeCount")
  );
}

/**
 * Validate image and metadata Kitsu attribute fields
 */
function validateKitsuAttributesMetadata(attrsObj: Record<string, unknown>): boolean {
  return (
    hasOptionalProperty(attrsObj, "coverImageTopOffset") &&
    hasOptionalProperty(attrsObj, "posterImage") &&
    hasOptionalProperty(attrsObj, "coverImage") &&
    hasOptionalProperty(attrsObj, "subtype") &&
    hasOptionalProperty(attrsObj, "status") &&
    hasOptionalProperty(attrsObj, "tba") &&
    hasOptionalProperty(attrsObj, "serialization") &&
    hasOptionalProperty(attrsObj, "mangaType")
  );
}

/**
 * Validate Kitsu attributes structure
 */
export function validateKitsuAttributes(
  attributes: unknown
): attributes is {
  createdAt?: string;
  updatedAt?: string;
  slug?: string;
  synopsis?: string;
  description?: string;
  coverImageTopOffset?: number;
  titles?: {
    en?: string;
    en_jp?: string;
    ja_jp?: string;
    en_us?: string;
  };
  canonicalTitle?: string;
  abbreviatedTitles?: string[];
  averageRating?: string;
  ratingFrequencies?: Record<string, string>;
  userCount?: number;
  favoritesCount?: number;
  startDate?: string;
  endDate?: string;
  nextRelease?: string | null;
  popularityRank?: number;
  ratingRank?: number;
  ageRating?: 'G' | 'PG' | 'R' | 'R18';
  ageRatingGuide?: string;
  subtype?: string;
  status?: 'current' | 'finished' | 'tba' | 'unreleased' | 'upcoming';
  tba?: string;
  posterImage?: {
    tiny?: string;
    small?: string;
    medium?: string;
    large?: string;
    original?: string;
  };
  coverImage?: {
    tiny?: string;
    small?: string;
    large?: string;
    original?: string;
  };
  chapterCount?: number;
  volumeCount?: number;
  serialization?: string;
  mangaType?: string;
} {
  if (!isObject(attributes)) return false;

  const attrsObj = attributes as Record<string, unknown>;
  return (
    validateKitsuAttributesBasic(attrsObj) &&
    validateKitsuAttributesTitles(attrsObj) &&
    validateKitsuAttributesRatings(attrsObj) &&
    validateKitsuAttributesCounts(attrsObj) &&
    validateKitsuAttributesMetadata(attrsObj)
  );
}