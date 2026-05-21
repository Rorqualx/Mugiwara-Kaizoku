/**
 * Universal Import Wizard Volume and Chapter Guards Module
 *
 * Type guards and validation functions for Volume, Chapter, and related data structures.
 *
 * Extracted from: universal-import-wizard.ts
 */

import {
  isRecord,
  safeGetString,
  safeGetNumber,
  hasRequiredProperty,
  hasOptionalProperty,
  validateArray,
  type Volume,
  type Chapter,
  type VolumesData
} from "./utils";

// ============================================================================
// Chapter Type Guards
// ============================================================================

/**
 * Type guard for Chapter object
 */
export function isChapter(value: unknown): value is Chapter {
  if (!isRecord(value)) {
    return false;
  }

  // Required properties
  if (!hasRequiredProperty(value, "number", "number")) return false;
  if (!hasRequiredProperty(value, "title", "string")) return false;

  // Optional properties
  if (!hasOptionalProperty(value, "chapterNumber", "number")) return false;
  if (!hasOptionalProperty(value, "volume", "number")) return false;
  if (!hasOptionalProperty(value, "url", "string")) return false;
  if (!hasOptionalProperty(value, "releaseDate", "string")) return false;
  if (!hasOptionalProperty(value, "pageCount", "number")) return false;
  if (!hasOptionalProperty(value, "coverImageUrl", "string")) return false;
  if (!hasOptionalProperty(value, "coverUrl", "string")) return false;
  if (!hasOptionalProperty(value, "coverImage", "string")) return false;
  if (!hasOptionalProperty(value, "cover", "string")) return false;
  if (!hasOptionalProperty(value, "summary", "string")) return false;
  if (!hasOptionalProperty(value, "description", "string")) return false;
  if (!hasOptionalProperty(value, "synopsis", "string")) return false;
  if (!hasOptionalProperty(value, "detailsFetched", "boolean")) return false;

  return true;
}

/**
 * Type guard for Chapter array
 */
export function isChapterArray(value: unknown): value is Chapter[] {
  return validateArray(value, isChapter);
}

// ============================================================================
// Volume Type Guards
// ============================================================================

/**
 * Type guard for Volume object
 */
export function isVolume(value: unknown): value is Volume {
  if (!isRecord(value)) {
    return false;
  }

  // Required properties
  if (!hasRequiredProperty(value, "id", "string")) return false;
  if (!hasRequiredProperty(value, "number", "number")) return false;
  if (!hasRequiredProperty(value, "title", "string")) return false;
  if (!hasRequiredProperty(value, "chapters", "array")) return false;

  // Validate chapters array
  const chapters = value["chapters"];
  if (!Array.isArray(chapters) || !chapters.every(isChapter)) {
    return false;
  }

  // Optional properties
  if (!hasOptionalProperty(value, "coverUrl", "string")) return false;
  if (!hasOptionalProperty(value, "releaseDate", "string")) return false;
  if (!hasOptionalProperty(value, "totalChapters", "number")) return false;
  if (!hasOptionalProperty(value, "downloadedChapters", "number")) return false;
  if (!hasOptionalProperty(value, "readChapters", "number")) return false;
  if (!hasOptionalProperty(value, "provider", "string")) return false;
  if (!hasOptionalProperty(value, "metadata", "object")) return false;

  return true;
}

/**
 * Type guard for Volume array
 */
export function isVolumeArray(value: unknown): value is Volume[] {
  return validateArray(value, isVolume);
}

// ============================================================================
// VolumesData Type Guards
// ============================================================================

/**
 * Type guard for VolumesData object
 */
export function isVolumesData(value: unknown): value is VolumesData {
  if (!isRecord(value)) {
    return false;
  }

  // Required properties
  if (!hasRequiredProperty(value, "volumes", "array")) return false;
  if (!hasRequiredProperty(value, "totalVolumes", "number")) return false;
  if (!hasRequiredProperty(value, "totalChapters", "number")) return false;

  // Validate volumes array
  const volumes = value["volumes"];
  if (!Array.isArray(volumes) || !volumes.every(isVolume)) {
    return false;
  }

  // Optional properties
  if (!hasOptionalProperty(value, "downloadedVolumes", "number")) return false;
  if (!hasOptionalProperty(value, "downloadedChapters", "number")) return false;
  if (!hasOptionalProperty(value, "readVolumes", "number")) return false;
  if (!hasOptionalProperty(value, "readChapters", "number")) return false;
  if (!hasOptionalProperty(value, "provider", "string")) return false;
  if (!hasOptionalProperty(value, "metadata", "object")) return false;

  return true;
}

// ============================================================================
// Chapter Validation Utilities
// ============================================================================

/**
 * Validate chapter data with detailed error reporting
 */
export function validateChapterData(data: unknown): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isRecord(data)) {
    errors.push("Chapter data must be an object");
    return { isValid: false, errors };
  }

  // Check required fields
  if (safeGetNumber(data, "number") === undefined) errors.push("Missing required field: number");
  if (!safeGetString(data, "title")) errors.push("Missing required field: title");

  // Validate chapter number
  const chapterNumber = safeGetNumber(data, "number");
  if (chapterNumber !== undefined && chapterNumber < 0) {
    errors.push("Chapter number must be non-negative");
  }

  // Validate volume number (optional)
  const volumeNumber = safeGetNumber(data, "volume");
  if (volumeNumber !== undefined && volumeNumber < 0) {
    errors.push("Volume number must be non-negative");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate volume data with detailed error reporting
 */
export function validateVolumeData(data: unknown): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isRecord(data)) {
    errors.push("Volume data must be an object");
    return { isValid: false, errors };
  }

  // Check required fields
  if (!safeGetString(data, "id")) errors.push("Missing required field: id");
  if (!safeGetString(data, "title")) errors.push("Missing required field: title");
  if (safeGetNumber(data, "number") === undefined) errors.push("Missing required field: number");

  // Validate volume number
  const volumeNumber = safeGetNumber(data, "number");
  if (volumeNumber !== undefined && volumeNumber < 0) {
    errors.push("Volume number must be non-negative");
  }

  // Validate chapters array
  const chapters = (data as Record<string, unknown>)["chapters"];
  if (!Array.isArray(chapters)) {
    errors.push("Chapters must be an array");
  } else {
    chapters.forEach((chapter, index) => {
      const chapterValidation = validateChapterData(chapter);
      if (!chapterValidation.isValid) {
        errors.push(`Chapter ${index}: ${chapterValidation.errors.join(", ")}`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate volumes data with detailed error reporting
 */
export function validateVolumesData(data: unknown): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isRecord(data)) {
    errors.push("Volumes data must be an object");
    return { isValid: false, errors };
  }

  // Check required fields
  if (!hasRequiredProperty(data, "volumes", "array")) errors.push("Missing required field: volumes");
  if (safeGetNumber(data, "totalVolumes") === undefined) errors.push("Missing required field: totalVolumes");
  if (safeGetNumber(data, "totalChapters") === undefined) errors.push("Missing required field: totalChapters");

  // Validate volumes array
  const volumes = (data as Record<string, unknown>)["volumes"];
  if (Array.isArray(volumes)) {
    volumes.forEach((volume, index) => {
      const volumeValidation = validateVolumeData(volume);
      if (!volumeValidation.isValid) {
        errors.push(`Volume ${index}: ${volumeValidation.errors.join(", ")}`);
      }
    });
  }

  // Validate totals consistency
  const totalVolumes = safeGetNumber(data, "totalVolumes");
  const totalChapters = safeGetNumber(data, "totalChapters");
  
  if (totalVolumes !== undefined && totalVolumes < 0) {
    errors.push("Total volumes must be non-negative");
  }
  
  if (totalChapters !== undefined && totalChapters < 0) {
    errors.push("Total chapters must be non-negative");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// ============================================================================
// Chapter/Volume Filtering and Sorting
// ============================================================================

/**
 * Filter chapters by volume number
 */
export function filterChaptersByVolume(chapters: Chapter[], volumeNumber: number): Chapter[] {
  return chapters.filter(chapter => chapter.volume === volumeNumber);
}

/**
 * Sort chapters by chapter number
 */
export function sortChaptersByNumber(chapters: Chapter[]): Chapter[] {
  return [...chapters].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
}

/**
 * Sort volumes by volume number
 */
export function sortVolumesByNumber(volumes: Volume[]): Volume[] {
  return [...volumes].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
}

/**
 * Get unique volume numbers from chapters
 */
export function getUniqueVolumeNumbers(chapters: Chapter[]): number[] {
  const volumeNumbers = chapters.map(chapter => chapter.volume).filter((v): v is number => v !== undefined);
  return [...new Set(volumeNumbers)].sort((a, b) => a - b);
}

/**
 * Group chapters by volume
 */
export function groupChaptersByVolume(chapters: Chapter[]): Record<number, Chapter[]> {
  const grouped: Record<number, Chapter[]> = {};
  
  // First pass: group chapters by volume
  for (const chapter of chapters) {
    const volumeNumber = chapter.volume;
    if (volumeNumber === undefined) continue;

    // Initialize array if needed, then push
    const existingGroup = grouped[volumeNumber];
    if (existingGroup) {
      existingGroup.push(chapter);
    } else {
      grouped[volumeNumber] = [chapter];
    }
  }
  
  // Second pass: sort chapters within each volume
  const result: Record<number, Chapter[]> = {};
  for (const [volumeNumberStr, volumeChapters] of Object.entries(grouped)) {
    const volumeNumber = Number(volumeNumberStr);
    result[volumeNumber] = sortChaptersByNumber(volumeChapters);
  }
  
  return result;
}