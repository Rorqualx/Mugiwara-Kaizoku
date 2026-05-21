/**
 * Component Types 2 Type Guards
 *
 * This module contains additional type guards for validating component type objects,
 * specifically for manga display and grid styling.
 *
 * @module ComponentTypes2TypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type { MangaDisplay, GridStyle } from "@/types/componentTypes";

/**
 * Type guard for MangaDisplay
 * Validates that an object conforms to the MangaDisplay interface
 */
export function isMangaDisplay(obj: unknown): obj is MangaDisplay {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "number" &&
    typeof candidate["title"] === "string" &&
    typeof candidate["source"] === "string" &&
    typeof candidate["interval"] === "string" &&
    (!("metadata" in candidate) || "metadata" in candidate) &&
    (!("chapters" in candidate) || Array.isArray(candidate["chapters"])) &&
    (!("library" in candidate) || "library" in candidate)
  );
}

/**
 * Type guard for GridStyle
 * Validates that an object conforms to the GridStyle interface
 */
export function isGridStyle(obj: unknown): obj is GridStyle {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["cols"] === "number" &&
    (!("spacing" in candidate) || "spacing" in candidate) &&
    (!("className" in candidate) || typeof candidate["className"] === "string")
  );
}