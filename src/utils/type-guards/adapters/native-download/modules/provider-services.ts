/**
 * Provider Services Type Guards
 *
 * This module contains type guard utilities for provider service configurations
 * to reduce complexity in the main config-types module.
 *
 * @module ProviderServicesTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import {
  isOptionalString,
  isOptionalBoolean,
  isOptionalNumber,
  isOptionalDate,
  isOptionalStringArray
} from './base-settings';

/**
 * Validates that a value is a valid ComicVine configuration
 */
export function isValidComicVineConfig(candidate: Record<string, unknown>): boolean {
  return (
    isOptionalString(candidate["type"]) &&
    isOptionalString(candidate["apiKey"]) &&
    isOptionalString(candidate["baseUrl"]) &&
    isOptionalString(candidate["apiUrl"]) &&
    isOptionalBoolean(candidate["enabled"]) &&
    isOptionalNumber(candidate["rateLimit"]) &&
    isOptionalNumber(candidate["timeout"]) &&
    isOptionalBoolean(candidate["cacheEnabled"]) &&
    isOptionalNumber(candidate["cacheDuration"]) &&
    isOptionalString(candidate["userAgent"]) &&
    isOptionalBoolean(candidate["debug"]) &&
    isOptionalStringArray(candidate["excludedFields"]) &&
    isOptionalDate(candidate["lastSync"])
  );
}

/**
 * Validates that a value is a valid AniList configuration
 */
export function isValidAniListConfig(candidate: Record<string, unknown>): boolean {
  return (
    isOptionalString(candidate["type"]) &&
    isOptionalString(candidate["clientId"]) &&
    isOptionalString(candidate["clientSecret"]) &&
    isOptionalString(candidate["accessToken"]) &&
    isOptionalString(candidate["refreshToken"]) &&
    isOptionalString(candidate["baseUrl"]) &&
    isOptionalString(candidate["apiUrl"]) &&
    isOptionalBoolean(candidate["enabled"]) &&
    isOptionalNumber(candidate["rateLimit"]) &&
    isOptionalNumber(candidate["timeout"]) &&
    isOptionalBoolean(candidate["cacheEnabled"]) &&
    isOptionalNumber(candidate["cacheDuration"]) &&
    isOptionalString(candidate["userAgent"]) &&
    isOptionalBoolean(candidate["debug"]) &&
    isOptionalStringArray(candidate["excludedFields"]) &&
    isOptionalDate(candidate["lastSync"])
  );
}

/**
 * Validates that a value is a valid Fandom configuration
 */
export function isValidFandomConfig(candidate: Record<string, unknown>): boolean {
  return (
    isOptionalString(candidate["type"]) &&
    isOptionalString(candidate["baseUrl"]) &&
    isOptionalString(candidate["apiUrl"]) &&
    isOptionalBoolean(candidate["enabled"]) &&
    isOptionalNumber(candidate["rateLimit"]) &&
    isOptionalNumber(candidate["timeout"]) &&
    isOptionalBoolean(candidate["cacheEnabled"]) &&
    isOptionalNumber(candidate["cacheDuration"]) &&
    isOptionalString(candidate["userAgent"]) &&
    isOptionalBoolean(candidate["debug"]) &&
    isOptionalStringArray(candidate["excludedFields"]) &&
    isOptionalDate(candidate["lastSync"])
  );
}

/**
 * Validates that a value is a valid Wikipedia configuration
 */
export function isValidWikipediaConfig(candidate: Record<string, unknown>): boolean {
  return (
    isOptionalString(candidate["type"]) &&
    isOptionalString(candidate["baseUrl"]) &&
    isOptionalString(candidate["apiUrl"]) &&
    isOptionalBoolean(candidate["enabled"]) &&
    isOptionalNumber(candidate["rateLimit"]) &&
    isOptionalNumber(candidate["timeout"]) &&
    isOptionalBoolean(candidate["cacheEnabled"]) &&
    isOptionalNumber(candidate["cacheDuration"]) &&
    isOptionalString(candidate["userAgent"]) &&
    isOptionalBoolean(candidate["debug"]) &&
    isOptionalStringArray(candidate["excludedFields"]) &&
    isOptionalDate(candidate["lastSync"])
  );
}

/**
 * Validates that a value is a valid provider settings field
 */
export function isValidProviderField(candidate: Record<string, unknown>, field: string): boolean {
  return !(field in candidate) || field in candidate;
}

/**
 * Validates that a value is a valid provider settings
 */
export function isValidProviderSettings(candidate: Record<string, unknown>): boolean {
  return (
    isValidProviderField(candidate, "comicvine") &&
    isValidProviderField(candidate, "anilist") &&
    isValidProviderField(candidate, "fandom") &&
    isValidProviderField(candidate, "wikipedia") &&
    isValidProviderField(candidate, "native_download") &&
    isValidProviderField(candidate, "suwayomi") &&
    isValidProviderField(candidate, "prowlarr")
  );
}
