/**
 * AniList Types Type Guards
 *
 * This module contains type guards for validating AniList extension type objects,
 * ensuring type safety for AniList API integration and media format handling.
 *
 * @module AniListTypesTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  AniListSearchResult,
  AniListMediaFormat,
  AniListMediaStatus
} from "@/types/extensions/anilist.types";

/**
 * Type guard for AniListSearchResult
 * Validates that an object conforms to the AniListSearchResult interface
 */
export function isAniListSearchResult(obj: unknown): obj is AniListSearchResult {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["anilistId"] === "number" &&
    (!("format" in candidate) || typeof candidate["format"] === "string") &&
    (!("episodes" in candidate) || typeof candidate["episodes"] === "number") &&
    (!("season" in candidate) || typeof candidate["season"] === "string") &&
    (!("seasonYear" in candidate) || typeof candidate["seasonYear"] === "number") &&
    (!("averageScore" in candidate) || typeof candidate["averageScore"] === "number") &&
    (!("popularity" in candidate) || typeof candidate["popularity"] === "number") &&
    (!("isAdult" in candidate) || typeof candidate["isAdult"] === "boolean")
  );
}

/**
 * Type guard for AniListMediaFormat
 * Validates that an object conforms to the AniListMediaFormat interface
 */
export function isAniListMediaFormat(obj: unknown): obj is AniListMediaFormat {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "TV" in candidate &&
    "TV_SHORT" in candidate &&
    "MOVIE" in candidate &&
    "SPECIAL" in candidate &&
    "OVA" in candidate &&
    "ONA" in candidate &&
    "MUSIC" in candidate &&
    "MANGA" in candidate &&
    "NOVEL" in candidate &&
    "ONE_SHOT" in candidate
  );
}

/**
 * Type guard for AniListMediaStatus
 * Validates that an object conforms to the AniListMediaStatus interface
 */
export function isAniListMediaStatus(obj: unknown): obj is AniListMediaStatus {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "FINISHED" in candidate &&
    "RELEASING" in candidate &&
    "NOT_YET_RELEASED" in candidate &&
    "CANCELLED" in candidate &&
    "HIATUS" in candidate
  );
}