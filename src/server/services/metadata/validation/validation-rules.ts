/**
 * Metadata Validation Rules
 *
 * Business logic validators for metadata fields.
 * Extracted from validation-service.ts to reduce complexity.
 */

import type {
  MetadataValidationError,
  MetadataValidationWarning,
  PartialUnifiedMetadata
} from './types';

/**
 * Validate volume count
 */
export function validateVolumeCount(
  volumes: number | null | undefined,
  warnings: MetadataValidationWarning[]
): void {
  if (volumes && volumes > 1000) {
    warnings.push({
      field: 'volumes',
      message: `Volume count (${volumes}) seems unusually high`,
      severity: 'warning',
      suggestion: 'This might be a year or page count mistakenly used as volume count'
    });
  }
}

/**
 * Validate chapter/volume consistency
 */
export function validateChapterVolumeConsistency(
  chapters: number | null | undefined,
  volumes: number | null | undefined,
  warnings: MetadataValidationWarning[]
): void {
  if (chapters && volumes && chapters < volumes) {
    warnings.push({
      field: 'chapters',
      message: `Chapter count (${chapters}) is less than volume count (${volumes})`,
      severity: 'warning',
      suggestion: 'Usually there are multiple chapters per volume'
    });
  }
}

/**
 * Validate date consistency
 */
export function validateDateConsistency(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined,
  errors: MetadataValidationError[]
): void {
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      errors.push({
        field: 'dates',
        message: 'Start date is after end date',
        severity: 'error'
      });
    }
  }
}

/**
 * Validate release year consistency
 */
export function validateReleaseYearConsistency(
  releaseYear: number | null | undefined,
  startDate: Date | string | null | undefined,
  warnings: MetadataValidationWarning[]
): void {
  if (releaseYear && startDate) {
    const startYear = new Date(startDate).getFullYear();
    if (Math.abs(startYear - releaseYear) > 1) {
      warnings.push({
        field: 'releaseYear',
        message: `Release year (${releaseYear}) doesn't match start date year (${startYear})`,
        severity: 'warning'
      });
    }
  }
}

/**
 * Validate title field
 */
export function validateTitle(
  title: string | undefined,
  errors: MetadataValidationError[]
): void {
  if (!title || title.trim() === '') {
    errors.push({
      field: 'title',
      message: 'Title is required',
      severity: 'critical'
    });
  }
}

/**
 * Validate adult content warnings
 */
export function validateAdultContentWarnings(
  isAdult: boolean | undefined,
  contentWarnings: string[] | undefined,
  warnings: MetadataValidationWarning[]
): void {
  if (isAdult && (!contentWarnings || contentWarnings.length === 0)) {
    warnings.push({
      field: 'contentWarnings',
      message: 'Adult content flagged but no content warnings provided',
      severity: 'warning',
      suggestion: 'Consider adding appropriate content warnings'
    });
  }
}

/**
 * Validate score range
 */
export function validateScoreRange(
  averageScore: number | null | undefined,
  errors: MetadataValidationError[]
): void {
  if (averageScore !== null && averageScore !== undefined) {
    if (averageScore < 0 || averageScore > 100) {
      errors.push({
        field: 'averageScore',
        message: `Average score (${averageScore}) must be between 0 and 100`,
        severity: 'error'
      });
    }
  }
}

/**
 * Calculate metadata completeness
 */
export function calculateCompleteness(metadata: PartialUnifiedMetadata): number {
  const fields = [
    'title', 'description', 'covers', 'status', 'format',
    'volumes', 'chapters', 'authors', 'genres', 'startDate',
    'publisher', 'alternativeTitles', 'tags', 'averageScore',
    'externalIds', 'bannerImage', 'endDate', 'releaseYear'
  ];

  let filledFields = 0;
  let totalWeight = 0;

  const weights: Record<string, number> = {
    title: 3,
    description: 2,
    covers: 2,
    status: 1,
    format: 1,
    volumes: 1,
    chapters: 1,
    authors: 2,
    genres: 1,
    startDate: 1,
    publisher: 1,
    alternativeTitles: 0.5,
    tags: 0.5,
    averageScore: 0.5,
    externalIds: 1,
    bannerImage: 0.5,
    endDate: 0.5,
    releaseYear: 0.5
  };

  for (const field of fields) {
    const weight = weights[field] ?? 1;
    totalWeight += weight;

    const value = metadata[field as keyof PartialUnifiedMetadata];
    if (value !== null && value !== undefined) {
      if (Array.isArray(value) && value.length > 0) {
        filledFields += weight;
      } else if (typeof value === 'object' && Object.keys(value).length > 0) {
        filledFields += weight;
      } else if (typeof value === 'string' && value.trim() !== '') {
        filledFields += weight;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        filledFields += weight;
      } else if (value instanceof Date) {
        filledFields += weight;
      }
    }
  }

  return totalWeight > 0 ? filledFields / totalWeight : 0;
}

/**
 * Calculate confidence score
 */
export function calculateConfidence(
  metadata: PartialUnifiedMetadata,
  errors: MetadataValidationError[],
  warnings: MetadataValidationWarning[]
): number {
  let confidence = 1.0;

  // Reduce for errors/warnings
  confidence -= errors.length * 0.1;
  confidence -= warnings.length * 0.05;

  // Reduce for missing important fields
  if (!metadata.description || metadata.description.trim() === '') {
    confidence -= 0.1;
  }

  const covers = metadata.covers;
  const coversWithOriginal = covers as { original?: string } | undefined;
  if (!covers || typeof covers !== 'object' || !('original' in covers) || coversWithOriginal?.original === '/cover-not-found.jpg') {
    confidence -= 0.1;
  }

  if (!metadata.authors || metadata.authors.length === 0) {
    confidence -= 0.05;
  }

  if (!metadata.genres || metadata.genres.length === 0) {
    confidence -= 0.05;
  }

  return Math.max(0, Math.min(1, confidence));
}
