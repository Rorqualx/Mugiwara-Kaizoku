/**
 * Manga Transaction Type Guards
 *
 * This module contains type guards for validating manga transaction type objects,
 * ensuring type safety for manga data transactions and client-side operations.
 *
 * @module MangaTransactionTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  ChapterClient,
  OutOfSyncChapterClient,
  MangaClient,
  MangaTransactionClient
} from "@/types/manga-transaction";

/**
 * Type guard for ChapterClient
 * Validates that an object conforms to the ChapterClient interface
 */
export function isChapterClient(obj: unknown): obj is ChapterClient {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "delete" in candidate
  );
}

/**
 * Type guard for OutOfSyncChapterClient
 * Validates that an object conforms to the OutOfSyncChapterClient interface
 */
export function isOutOfSyncChapterClient(obj: unknown): obj is OutOfSyncChapterClient {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "delete" in candidate
  );
}

/**
 * Type guard for MangaClient
 * Validates that an object conforms to the MangaClient interface
 */
export function isMangaClient(obj: unknown): obj is MangaClient {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "update" in candidate
  );
}

/**
 * Type guard for MangaTransactionClient
 * Validates that an object conforms to the MangaTransactionClient interface
 */
export function isMangaTransactionClient(obj: unknown): obj is MangaTransactionClient {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "chapter" in candidate &&
    "outOfSyncChapter" in candidate &&
    "manga" in candidate
  );
}