/**
 * Kitsu External Manga Type Guards
 *
 * This module contains type guards for validating ExternalKitsuManga objects.
 * This type guard was already low complexity but is included for consistency.
 *
 * @module KitsuExternalMangaTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type { ExternalKitsuManga } from "@/types/manga/external";

import {
  isRecord,
  hasOptionalProperty,
  validateRequiredStrings,
} from "./utils";


/**
 * Type guard for ExternalKitsuManga
 * Validates that an object conforms to the ExternalKitsuManga interface
 */
export function isExternalKitsuManga(obj: unknown): obj is ExternalKitsuManga {
  if (!isRecord(obj)) {
    return false;
  }

  const candidate = obj;

  return (
    validateRequiredStrings(obj, ["id"]) &&
    "type" in candidate &&
    hasOptionalProperty(candidate, "links") &&
    hasOptionalProperty(candidate, "attributes") &&
    hasOptionalProperty(candidate, "relationships")
  );
}