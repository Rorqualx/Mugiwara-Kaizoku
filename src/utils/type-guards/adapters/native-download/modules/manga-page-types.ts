/**
 * Manga Page Types Type Guards
 *
 * This module contains type guards for validating manga page type objects,
 * ensuring type safety for manga page components and related data structures.
 *
 * @module MangaPageTypesTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  MangaWithRelations,
  ChapterWithManga,
  MangaPageProps,
  MangaDetailProps
} from "@/types/manga-page-types";

/**
 * Type guard for MangaWithRelations
 * Validates that an object conforms to the MangaWithRelations interface
 */
export function isMangaWithRelations(obj: unknown): obj is MangaWithRelations {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("metadata" in candidate) || "metadata" in candidate) &&
    "library" in candidate &&
    Array.isArray(candidate["chapters"])
  );
}

/**
 * Type guard for ChapterWithManga
 * Validates that an object conforms to the ChapterWithManga interface
 */
export function isChapterWithManga(obj: unknown): obj is ChapterWithManga {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "manga" in candidate
  );
}

/**
 * Type guard for MangaPageProps
 * Validates that an object conforms to the MangaPageProps interface
 */
export function isMangaPageProps(obj: unknown): obj is MangaPageProps {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "manga" in candidate &&
    Array.isArray(candidate["chapters"])
  );
}

/**
 * Type guard for MangaDetailProps
 * Validates that an object conforms to the MangaDetailProps interface
 */
export function isMangaDetailProps(obj: unknown): obj is MangaDetailProps {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["mangaId"] === "number" &&
    (!("onUpdate" in candidate) || "onUpdate" in candidate)
  );
}