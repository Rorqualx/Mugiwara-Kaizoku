/**
 * External Manga Types Type Guards
 *
 * This module contains type guards for validating external manga type objects,
 * ensuring type safety for integration with external manga services.
 *
 * @module ExternalMangaTypesTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  ExternalAnilistManga,
  ExternalSuwayomiManga,
  ExternalMALManga,
  ExternalKitsuManga
} from "@/types/manga/external";

import {
  validateRequiredAnilistFields,
  validateOptionalAnilistFields,
  validateAnilistTitle
} from "./external-manga-validators/anilist-validators";
import {
  validateRequiredKitsuFields,
  validateOptionalKitsuFields
} from "./external-manga-validators/kitsu-validators";
import {
  validateRequiredMALFields,
  validateOptionalMALFields
} from "./external-manga-validators/mal-validators";
import {
  validateRequiredSuwayomiFields,
  validateOptionalSuwayomiFields,
  validateSuwayomiLastChapterRead
} from "./external-manga-validators/suwayomi-validators";
import { isObject } from "./shared-validators/basic-validators";

/**
 * Type guard for ExternalAnilistManga
 * Validates that an object conforms to the ExternalAnilistManga interface
 */
export function isExternalAnilistManga(obj: unknown): obj is ExternalAnilistManga {
  if (!isObject(obj)) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  // Validate title structure if present
  if ("title" in candidate && !validateAnilistTitle(candidate["title"])) {
    return false;
  }

  return (
    validateRequiredAnilistFields(candidate) &&
    validateOptionalAnilistFields(candidate)
  );
}

/**
 * Type guard for ExternalSuwayomiManga
 * Validates that an object conforms to the ExternalSuwayomiManga interface
 */
export function isExternalSuwayomiManga(obj: unknown): obj is ExternalSuwayomiManga {
  if (!isObject(obj)) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  // Validate last chapter read structure if present
  if ("lastChapterRead" in candidate && !validateSuwayomiLastChapterRead(candidate["lastChapterRead"])) {
    return false;
  }

  return (
    validateRequiredSuwayomiFields(candidate) &&
    validateOptionalSuwayomiFields(candidate)
  );
}

/**
 * Type guard for ExternalMALManga
 * Validates that an object conforms to the ExternalMALManga interface
 */
export function isExternalMALManga(obj: unknown): obj is ExternalMALManga {
  if (!isObject(obj)) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateRequiredMALFields(candidate) &&
    validateOptionalMALFields(candidate)
  );
}

/**
 * Type guard for ExternalKitsuManga
 * Validates that an object conforms to the ExternalKitsuManga interface
 */
export function isExternalKitsuManga(obj: unknown): obj is ExternalKitsuManga {
  if (!isObject(obj)) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateRequiredKitsuFields(candidate) &&
    validateOptionalKitsuFields(candidate)
  );
}