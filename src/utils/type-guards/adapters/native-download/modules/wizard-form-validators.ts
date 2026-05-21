/**
 * Wizard Form Data Type Validators
 *
 * Decomposed type guards for validating WizardFormData objects.
 * Extracted from universal-import-wizard.ts (lines 170-236)
 */

import type { WizardFormData } from "@/types/universalImportWizard.types";

import {
  hasOptionalProperty,
  isStringArray,
  isNumberArray
} from './universal-import-wizard/utils';

/**
 * Check if property exists on object
 */
function propertyExists(obj: Record<string, unknown>, key: string): boolean {
  return key in obj;
}

/**
 * Check if property has specific type
 */
function hasPropertyType(
  obj: Record<string, unknown>,
  key: string,
  type: "string" | "number" | "boolean" | "object" | "array"
): boolean {
  return hasOptionalProperty(obj, key, type);
}

/**
 * Check if property is an array
 */
function isArray(obj: Record<string, unknown>, key: string): boolean {
  return hasOptionalProperty(obj, key, "array");
}

/**
 * Validate basic information properties
 */
export function validateWizardFormBasicInfo(candidate: Record<string, unknown>): boolean {
  return (
    typeof candidate["title"] === "string" &&
    isStringArray(candidate["alternativeTitles"]) &&
    (!propertyExists(candidate, "alternativeNames") || isStringArray(candidate["alternativeNames"])) &&
    (!propertyExists(candidate, "description") || hasPropertyType(candidate, "description", "string")) &&
    (!propertyExists(candidate, "descriptionRaw") || hasPropertyType(candidate, "descriptionRaw", "string")) &&
    (!propertyExists(candidate, "synopsis") || hasPropertyType(candidate, "synopsis", "string")) &&
    (!propertyExists(candidate, "synopsisRaw") || hasPropertyType(candidate, "synopsisRaw", "string")) &&
    (!propertyExists(candidate, "plot") || hasPropertyType(candidate, "plot", "string")) &&
    (!propertyExists(candidate, "background") || hasPropertyType(candidate, "background", "string")) &&
    (!propertyExists(candidate, "history") || hasPropertyType(candidate, "history", "string")) &&
    (!propertyExists(candidate, "descriptions") || propertyExists(candidate, "descriptions"))
  );
}

/**
 * Validate media-related properties
 */
export function validateWizardFormMedia(candidate: Record<string, unknown>): boolean {
  return (
    (!propertyExists(candidate, "coverUrl") || hasPropertyType(candidate, "coverUrl", "string")) &&
    (!propertyExists(candidate, "bannerUrl") || hasPropertyType(candidate, "bannerUrl", "string")) &&
    (!propertyExists(candidate, "covers") || propertyExists(candidate, "covers")) &&
    (!propertyExists(candidate, "status") || propertyExists(candidate, "status")) &&
    (!propertyExists(candidate, "format") || hasPropertyType(candidate, "format", "string"))
  );
}

/**
 * Validate metadata properties
 */
export function validateWizardFormMetadata(candidate: Record<string, unknown>): boolean {
  return (
    (!propertyExists(candidate, "publisher") || hasPropertyType(candidate, "publisher", "string")) &&
    (!propertyExists(candidate, "demographic") || hasPropertyType(candidate, "demographic", "string")) &&
    (!propertyExists(candidate, "startDate") || hasPropertyType(candidate, "startDate", "string")) &&
    (!propertyExists(candidate, "endDate") || hasPropertyType(candidate, "endDate", "string")) &&
    (!propertyExists(candidate, "releaseYear") || propertyExists(candidate, "releaseYear")) &&
    (!propertyExists(candidate, "country") || hasPropertyType(candidate, "country", "string")) &&
    (!propertyExists(candidate, "language") || hasPropertyType(candidate, "language", "string")) &&
    (!propertyExists(candidate, "averageScore") || hasPropertyType(candidate, "averageScore", "number")) &&
    (!propertyExists(candidate, "popularity") || hasPropertyType(candidate, "popularity", "number")) &&
    (!propertyExists(candidate, "publication") || propertyExists(candidate, "publication"))
  );
}

/**
 * Validate content classification properties
 */
export function validateWizardFormContent(candidate: Record<string, unknown>): boolean {
  return (
    (!propertyExists(candidate, "genres") || isStringArray(candidate["genres"])) &&
    (!propertyExists(candidate, "themes") || isStringArray(candidate["themes"])) &&
    (!propertyExists(candidate, "tags") || isStringArray(candidate["tags"])) &&
    (!propertyExists(candidate, "reception") || hasPropertyType(candidate, "reception", "string")) &&
    (!propertyExists(candidate, "isAdult") || hasPropertyType(candidate, "isAdult", "boolean")) &&
    (!propertyExists(candidate, "author") || hasPropertyType(candidate, "author", "string")) &&
    (!propertyExists(candidate, "illustrator") || hasPropertyType(candidate, "illustrator", "string")) &&
    (!propertyExists(candidate, "authors") || isStringArray(candidate["authors"])) &&
    (!propertyExists(candidate, "artists") || isStringArray(candidate["artists"]))
  );
}

/**
 * Validate volumes and chapters properties
 */
export function validateWizardFormVolumesChapters(candidate: Record<string, unknown>): boolean {
  return (
    (!propertyExists(candidate, "volumeInfo") || hasPropertyType(candidate, "volumeInfo", "string")) &&
    (!propertyExists(candidate, "volumes") || isArray(candidate, "volumes")) &&
    (!propertyExists(candidate, "chapters") || isArray(candidate, "chapters")) &&
    (!propertyExists(candidate, "selectedVolumes") ||
      (isArray(candidate, "selectedVolumes") &&
       isNumberArray(candidate["selectedVolumes"]))) &&
    (!propertyExists(candidate, "selectedChapters") || isArray(candidate, "selectedChapters"))
  );
}

/**
 * Validate external IDs and links
 */
export function validateWizardFormExternalIds(candidate: Record<string, unknown>): boolean {
  return (
    (!propertyExists(candidate, "externalIds") || propertyExists(candidate, "externalIds")) &&
    (!propertyExists(candidate, "externalLinks") || isStringArray(candidate["externalLinks"])) &&
    (!propertyExists(candidate, "anilistId") || hasPropertyType(candidate, "anilistId", "string")) &&
    (!propertyExists(candidate, "myAnimeListId") || hasPropertyType(candidate, "myAnimeListId", "string")) &&
    (!propertyExists(candidate, "comicVineId") || hasPropertyType(candidate, "comicVineId", "string")) &&
    (!propertyExists(candidate, "wikipediaUrl") || hasPropertyType(candidate, "wikipediaUrl", "string")) &&
    (!propertyExists(candidate, "fandomUrl") || hasPropertyType(candidate, "fandomUrl", "string"))
  );
}

/**
 * Validate provider information
 */
export function validateWizardFormProviderInfo(candidate: Record<string, unknown>): boolean {
  return (
    (!propertyExists(candidate, "searchProvider") || hasPropertyType(candidate, "searchProvider", "string")) &&
    (!propertyExists(candidate, "selectedSource") || hasPropertyType(candidate, "selectedSource", "string")) &&
    (!propertyExists(candidate, "selectedSourceId") || hasPropertyType(candidate, "selectedSourceId", "string")) &&
    (!propertyExists(candidate, "metadataProvider") || hasPropertyType(candidate, "metadataProvider", "string")) &&
    (!propertyExists(candidate, "cachedSearchResults") || isArray(candidate, "cachedSearchResults")) &&
    (!propertyExists(candidate, "metadata") || propertyExists(candidate, "metadata")) &&
    (!propertyExists(candidate, "providerMetadata") || propertyExists(candidate, "providerMetadata")) &&
    (!propertyExists(candidate, "fieldSelections") || propertyExists(candidate, "fieldSelections")) &&
    (!propertyExists(candidate, "downloadSettings") || propertyExists(candidate, "downloadSettings"))
  );
}

/**
 * Type guard for WizardFormData
 * Validates that an object conforms to the WizardFormData interface
 *
 * Decomposed from original 65-condition function
 */
export function isWizardFormData(obj: unknown): obj is WizardFormData {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateWizardFormBasicInfo(candidate) &&
    validateWizardFormMedia(candidate) &&
    validateWizardFormMetadata(candidate) &&
    validateWizardFormContent(candidate) &&
    validateWizardFormVolumesChapters(candidate) &&
    validateWizardFormExternalIds(candidate) &&
    validateWizardFormProviderInfo(candidate)
  );
}