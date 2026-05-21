/**
 * Sources Type Guards
 *
 * This module contains type guards for validating source type objects,
 * ensuring type safety for unified sources, manga sources, source filters, and statistics.
 *
 * @module SourcesTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  UnifiedSource,
  MangaSource,
  SourceFilter,
  SourceStats
} from "@/types/sources";

/**
 * Type guard for UnifiedSource
 * Validates that an object conforms to the UnifiedSource interface
 */
export function isUnifiedSource(obj: unknown): obj is UnifiedSource {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["name"] === "string" &&
    typeof candidate["enabled"] === "boolean" &&
    typeof candidate["description"] === "string" &&
    typeof candidate["version"] === "string" &&
    typeof candidate["author"] === "string" &&
    "sourceType" in candidate &&
    (!("iconUrl" in candidate) || typeof candidate["iconUrl"] === "string") &&
    (!("lang" in candidate) || typeof candidate["lang"] === "string") &&
    (!("isNsfw" in candidate) || typeof candidate["isNsfw"] === "boolean") &&
    (!("isInstalled" in candidate) || typeof candidate["isInstalled"] === "boolean")
  );
}

/**
 * Type guard for MangaSource
 * Validates that an object conforms to the MangaSource interface
 */
export function isMangaSource(obj: unknown): obj is MangaSource {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["name"] === "string" &&
    typeof candidate["language"] === "string" &&
    typeof candidate["baseUrl"] === "string" &&
    Array.isArray(candidate["capabilities"]) &&
    typeof candidate["isActive"] === "boolean" &&
    typeof candidate["priority"] === "number"
  );
}

/**
 * Type guard for SourceFilter
 * Validates that an object conforms to the SourceFilter interface
 */
export function isSourceFilter(obj: unknown): obj is SourceFilter {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("language" in candidate) || typeof candidate["language"] === "string") &&
    (!("capability" in candidate) || "capability" in candidate) &&
    (!("isActive" in candidate) || typeof candidate["isActive"] === "boolean")
  );
}

/**
 * Type guard for SourceStats
 * Validates that an object conforms to the SourceStats interface
 */
export function isSourceStats(obj: unknown): obj is SourceStats {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["totalManga"] === "number" &&
    typeof candidate["totalChapters"] === "number" &&
    (!("lastSync" in candidate) || candidate["lastSync"] instanceof Date) &&
    typeof candidate["errorRate"] === "number"
  );
}