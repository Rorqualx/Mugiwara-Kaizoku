/**
 * Chapter Metadata Type Guards
 *
 * This module contains type guards for validating chapter metadata objects,
 * ensuring type safety for chapter-related operations.
 *
 * @module ChapterMetadataTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type { FandomChapter, ChapterUpdateInput, ChapterCreateInput } from "@/types/chapter-metadata";

import {
  isOptionalString,
  isOptionalNumber,
  isRequiredString,
  isRequiredNumber,
  hasProperty,
  validateResolutionProperties,
  validateBasicChapterProperties,
  validateOptionalChapterProperties
} from "./chapter-metadata-utils";

/**
 * Type guard for FandomChapter
 * Validates that an object conforms to the FandomChapter interface
 */
export function isFandomChapter(obj: unknown): obj is FandomChapter {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["number"] === "number" &&
    typeof candidate["title"] === "string" &&
    isOptionalString(candidate, "description") &&
    isOptionalNumber(candidate, "volume")
  );
}

/**
 * Type guard for ChapterUpdateInput
 * Validates that an object conforms to the ChapterUpdateInput interface
 */
export function isChapterUpdateInput(obj: unknown): obj is ChapterUpdateInput {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateBasicChapterProperties(candidate) &&
    hasProperty(candidate, "downloadStatus") &&
    validateOptionalChapterProperties(candidate) &&
    validateResolutionProperties(candidate) &&
    isOptionalNumber(candidate, "mangaId")
  );
}

/**
 * Type guard for ChapterCreateInput
 * Validates that an object conforms to the ChapterCreateInput interface
 */
export function isChapterCreateInput(obj: unknown): obj is ChapterCreateInput {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    isRequiredNumber(candidate, "mangaId") &&
    isRequiredString(candidate, "fileName") &&
    isOptionalNumber(candidate, "index") &&
    isRequiredString(candidate, "title") &&
    isRequiredNumber(candidate, "size") &&
    hasProperty(candidate, "downloadStatus") &&
    validateOptionalChapterProperties(candidate) &&
    validateResolutionProperties(candidate)
  );
}
