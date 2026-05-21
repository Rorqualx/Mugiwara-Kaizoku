/**
 * Reader Types Type Guards
 *
 * This module contains type guards for validating reader type objects,
 * ensuring type safety for manga reading functionality, file handling, and user preferences.
 *
 * @module ReaderTypesTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  MangaFile,
  FileMetadata,
  ReaderSettings,
  ReadingHistoryItem,
  Bookmark,
  RenderOptions,
  ImageFilters,
  ReaderState,
  ReadingProgress,
  GestureHandlers,
  ChapterFile,
  DoublePageState,
  DoublePageUrls
} from "@/types/reader/reader-types";

/**
 * Type guard for MangaFile
 * Validates that an object conforms to the MangaFile interface
 */
export function isMangaFile(obj: unknown): obj is MangaFile {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["mangaId"] === "number" &&
    typeof candidate["chapterId"] === "number" &&
    typeof candidate["chapterTitle"] === "string" &&
    "blob" in candidate &&
    "format" in candidate &&
    typeof candidate["totalPages"] === "number" &&
    typeof candidate["fileSize"] === "number" &&
    (!("metadata" in candidate) || "metadata" in candidate)
  );
}

/**
 * Type guard for FileMetadata
 * Validates that an object conforms to the FileMetadata interface
 */
export function isFileMetadata(obj: unknown): obj is FileMetadata {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("title" in candidate) || typeof candidate["title"] === "string") &&
    (!("author" in candidate) || typeof candidate["author"] === "string") &&
    (!("publisher" in candidate) || typeof candidate["publisher"] === "string") &&
    (!("year" in candidate) || typeof candidate["year"] === "number") &&
    (!("tags" in candidate) || Array.isArray(candidate["tags"]) && candidate["tags"].every((x: unknown) => typeof x === "string"))
  );
}

/**
 * Type guard for ReaderSettings
 * Validates that an object conforms to the ReaderSettings interface
 */
export function isReaderSettings(obj: unknown): obj is ReaderSettings {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "readingMode" in candidate &&
    "readingDirection" in candidate &&
    typeof candidate["backgroundColor"] === "string" &&
    "fitMode" in candidate &&
    typeof candidate["showToolbar"] === "boolean" &&
    typeof candidate["preloadPages"] === "number" &&
    typeof candidate["doublePageOffset"] === "boolean" &&
    typeof candidate["brightness"] === "number" &&
    typeof candidate["contrast"] === "number" &&
    typeof candidate["enableGestures"] === "boolean" &&
    typeof candidate["enableKeyboard"] === "boolean" &&
    typeof candidate["clickNavigation"] === "boolean" &&
    typeof candidate["smoothScrolling"] === "boolean" &&
    typeof candidate["panelDetection"] === "boolean" &&
    typeof candidate["ocrEnabled"] === "boolean"
  );
}

/**
 * Type guard for ReadingHistoryItem
 * Validates that an object conforms to the ReadingHistoryItem interface
 */
export function isReadingHistoryItem(obj: unknown): obj is ReadingHistoryItem {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["mangaId"] === "number" &&
    typeof candidate["chapterId"] === "number" &&
    typeof candidate["timestamp"] === "number" &&
    (!("page" in candidate) || typeof candidate["page"] === "number")
  );
}

/**
 * Type guard for Bookmark
 * Validates that an object conforms to the Bookmark interface
 */
export function isBookmark(obj: unknown): obj is Bookmark {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "string" &&
    typeof candidate["mangaId"] === "number" &&
    typeof candidate["chapterId"] === "number" &&
    typeof candidate["page"] === "number" &&
    (!("note" in candidate) || typeof candidate["note"] === "string") &&
    typeof candidate["createdAt"] === "number"
  );
}

/**
 * Type guard for RenderOptions
 * Validates that an object conforms to the RenderOptions interface
 */
export function isRenderOptions(obj: unknown): obj is RenderOptions {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["zoom"] === "number" &&
    "offset" in candidate &&
    "mode" in candidate &&
    "fitMode" in candidate &&
    (!("filters" in candidate) || "filters" in candidate)
  );
}

/**
 * Type guard for ImageFilters
 * Validates that an object conforms to the ImageFilters interface
 */
export function isImageFilters(obj: unknown): obj is ImageFilters {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("brightness" in candidate) || typeof candidate["brightness"] === "number") &&
    (!("contrast" in candidate) || typeof candidate["contrast"] === "number") &&
    (!("saturation" in candidate) || typeof candidate["saturation"] === "number") &&
    (!("blur" in candidate) || typeof candidate["blur"] === "number") &&
    (!("sharpen" in candidate) || typeof candidate["sharpen"] === "boolean")
  );
}

/**
 * Type guard for ReaderState
 * Validates that an object conforms to the ReaderState interface
 */
export function isReaderState(obj: unknown): obj is ReaderState {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "currentFile" in candidate &&
    typeof candidate["currentPage"] === "number" &&
    typeof candidate["totalPages"] === "number" &&
    typeof candidate["isLoading"] === "boolean" &&
    "error" in candidate &&
    "settings" in candidate &&
    Array.isArray(candidate["history"]) &&
    Array.isArray(candidate["bookmarks"])
  );
}

/**
 * Type guard for ReadingProgress
 * Validates that an object conforms to the ReadingProgress interface
 */
export function isReadingProgress(obj: unknown): obj is ReadingProgress {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["mangaId"] === "number" &&
    typeof candidate["chapterId"] === "number" &&
    typeof candidate["currentPage"] === "number" &&
    typeof candidate["totalPages"] === "number" &&
    candidate["lastReadAt"] instanceof Date &&
    (!("completedAt" in candidate) || "completedAt" in candidate)
  );
}

/**
 * Type guard for GestureHandlers
 * Validates that an object conforms to the GestureHandlers interface
 */
export function isGestureHandlers(obj: unknown): obj is GestureHandlers {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("onSwipeLeft" in candidate) || "onSwipeLeft" in candidate) &&
    (!("onSwipeRight" in candidate) || "onSwipeRight" in candidate) &&
    (!("onPinchZoom" in candidate) || "onPinchZoom" in candidate) &&
    (!("onPan" in candidate) || "onPan" in candidate) &&
    (!("onDoubleTap" in candidate) || "onDoubleTap" in candidate)
  );
}

/**
 * Type guard for ChapterFile
 * Validates that an object conforms to the ChapterFile interface
 */
export function isChapterFile(obj: unknown): obj is ChapterFile {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["filePath"] === "string" &&
    "format" in candidate &&
    typeof candidate["pageCount"] === "number" &&
    typeof candidate["title"] === "string"
  );
}

/**
 * Type guard for DoublePageState
 * Validates that an object conforms to the DoublePageState interface
 */
export function isDoublePageState(obj: unknown): obj is DoublePageState {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["showDouble"] === "boolean" &&
    typeof candidate["currentLeftPage"] === "number" &&
    typeof candidate["currentRightPage"] === "number" &&
    typeof candidate["offset"] === "boolean"
  );
}

/**
 * Type guard for DoublePageUrls
 * Validates that an object conforms to the DoublePageUrls interface
 */
export function isDoublePageUrls(obj: unknown): obj is DoublePageUrls {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "left" in candidate &&
    "right" in candidate
  );
}