/**
 * Metadata Normalization Functions
 *
 * This module contains functions for normalizing and fixing common metadata issues,
 * such as converting string numbers to actual numbers, ensuring arrays are properly
 * formatted, and normalizing date formats.
 */

import type { NormalizedMetadata, NormalizedChapter } from './metadata-schemas';

/**
 * Normalizes array fields in metadata to ensure they are proper arrays
 *
 * @param metadata Metadata to normalize arrays for
 * @returns Metadata with normalized arrays
 */
function normalizeMetadataArrays(metadata: NormalizedMetadata): NormalizedMetadata {
  const fixed = { ...metadata };

  // Ensure arrays are arrays with safer type checking
  if (fixed.alternativeTitles && !Array.isArray(fixed.alternativeTitles)) {
    const titleValue = fixed.alternativeTitles;
    fixed.alternativeTitles = [typeof titleValue === 'string' ? titleValue : String(titleValue)];
  }

  if (fixed.genres && !Array.isArray(fixed.genres)) {
    const genreValue = fixed.genres;
    fixed.genres = [typeof genreValue === 'string' ? genreValue : String(genreValue)];
  }

  if (fixed.tags && !Array.isArray(fixed.tags)) {
    const tagValue = fixed.tags;
    fixed.tags = [typeof tagValue === 'string' ? tagValue : String(tagValue)];
  }

  return fixed;
}

/**
 * Normalizes numeric fields in metadata to ensure they are proper numbers
 *
 * @param metadata Metadata to normalize numbers for
 * @returns Metadata with normalized numbers
 */
function normalizeMetadataNumbers(metadata: NormalizedMetadata): NormalizedMetadata {
  const fixed = { ...metadata };

  // Convert string numbers to actual numbers with safer parsing
  const safeNumberParse = (value: string): number | undefined => {
    const parsed = Number(value);
    return isNaN(parsed) ? undefined : parsed;
  };

  if (fixed.volumes && typeof fixed.volumes === 'string') {
    const parsed = safeNumberParse(fixed.volumes);
    if (parsed !== undefined) fixed.volumes = parsed;
  }

  if (fixed.chapters && typeof fixed.chapters === 'string') {
    const parsed = safeNumberParse(fixed.chapters);
    if (parsed !== undefined) fixed.chapters = parsed;
  }

  if (fixed.pages && typeof fixed.pages === 'string') {
    const parsed = safeNumberParse(fixed.pages);
    if (parsed !== undefined) fixed.pages = parsed;
  }

  if (fixed.score && typeof fixed.score === 'string') {
    const parsed = safeNumberParse(fixed.score);
    if (parsed !== undefined) fixed.score = parsed;
  }

  if (fixed.popularity && typeof fixed.popularity === 'string') {
    const parsed = safeNumberParse(fixed.popularity);
    if (parsed !== undefined) fixed.popularity = parsed;
  }

  return fixed;
}

/**
 * Normalizes date fields in metadata to ensure they are in ISO format
 *
 * @param metadata Metadata to normalize dates for
 * @returns Metadata with normalized dates
 */
function normalizeMetadataDates(metadata: NormalizedMetadata): NormalizedMetadata {
  const fixed = { ...metadata };

  // Ensure dates are in ISO format
  if (fixed.startDate && !(fixed.startDate instanceof Date) && typeof fixed.startDate === 'string') {
    try {
      const date = new Date(fixed.startDate);
      if (!isNaN(date.getTime())) {
        fixed.startDate = date.toISOString();
      }
    } catch (e: unknown) {
      const _errorMessage = e instanceof Error ? e.message : String(e);
      // If we can't parse it, leave it as is
    }
  }

  if (fixed.endDate && !(fixed.endDate instanceof Date) && typeof fixed.endDate === 'string') {
    try {
      const date = new Date(fixed.endDate);
      if (!isNaN(date.getTime())) {
        fixed.endDate = date.toISOString();
      }
    } catch (e: unknown) {
      const _errorMessage = e instanceof Error ? e.message : String(e);
      // If we can't parse it, leave it as is
    }
  }

  return fixed;
}

/**
 * Helper function for fixing common metadata issues
 *
 * @param metadata Metadata to fix
 * @returns Fixed metadata
 */
export function fixMetadataIssues(metadata: NormalizedMetadata): NormalizedMetadata {
  const withArrays = normalizeMetadataArrays(metadata);
  const withNumbers = normalizeMetadataNumbers(withArrays);
  const withDates = normalizeMetadataDates(withNumbers);

  return withDates;
}

/**
 * Normalizes numeric fields in chapter to ensure they are proper numbers
 *
 * @param chapter Chapter to normalize numbers for
 * @returns Chapter with normalized numbers
 */
function normalizeChapterNumbers(chapter: NormalizedChapter): NormalizedChapter {
  const fixed = { ...chapter };

  // Convert string numbers to actual numbers with safer parsing
  const safeNumberParse = (value: string): number | undefined => {
    const parsed = Number(value);
    return isNaN(parsed) ? undefined : parsed;
  };

  if (fixed.pages && typeof fixed.pages === 'string') {
    const parsed = safeNumberParse(fixed.pages);
    if (parsed !== undefined) fixed.pages = parsed;
  }

  return fixed;
}

/**
 * Normalizes date fields in chapter to ensure they are in ISO format
 *
 * @param chapter Chapter to normalize dates for
 * @returns Chapter with normalized dates
 */
function normalizeChapterDates(chapter: NormalizedChapter): NormalizedChapter {
  const fixed = { ...chapter };

  // Ensure dates are in ISO format
  if (fixed.publishDate && !(fixed.publishDate instanceof Date) && typeof fixed.publishDate === 'string') {
    try {
      const date = new Date(fixed.publishDate);
      if (!isNaN(date.getTime())) {
        fixed.publishDate = date.toISOString();
      }
    } catch (e: unknown) {
      const _errorMessage = e instanceof Error ? e.message : String(e);
      // If we can't parse it, leave it as is
    }
  }

  if (fixed.createdAt && !(fixed.createdAt instanceof Date) && typeof fixed.createdAt === 'string') {
    try {
      const date = new Date(fixed.createdAt);
      if (!isNaN(date.getTime())) {
        fixed.createdAt = date.toISOString();
      }
    } catch (e: unknown) {
      const _errorMessage = e instanceof Error ? e.message : String(e);
      // If we can't parse it, leave it as is
    }
  }

  if (fixed.updatedAt && !(fixed.updatedAt instanceof Date) && typeof fixed.updatedAt === 'string') {
    try {
      const date = new Date(fixed.updatedAt);
      if (!isNaN(date.getTime())) {
        fixed.updatedAt = date.toISOString();
      }
    } catch (e: unknown) {
      const _errorMessage = e instanceof Error ? e.message : String(e);
      // If we can't parse it, leave it as is
    }
  }

  return fixed;
}

/**
 * Helper function for fixing common chapter issues
 *
 * @param chapter Chapter to fix
 * @returns Fixed chapter
 */
export function fixChapterIssues(chapter: NormalizedChapter): NormalizedChapter {
  const withNumbers = normalizeChapterNumbers(chapter);
  const withDates = normalizeChapterDates(withNumbers);

  return withDates;
}