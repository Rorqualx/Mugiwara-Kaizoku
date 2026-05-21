/**
 * Metadata Field Processors
 *
 * Helper functions for processing different field types during sanitization.
 * Extracted to reduce complexity in the main sanitize method.
 *
 * Each function returns processed fields as a new object to avoid parameter mutation.
 */

import { MangaPublicationStatus, MangaFormat } from '@prisma/client';

import {
  sanitizeString,
  sanitizeStringArray,
  sanitizeNumber,
  sanitizeScore,
  sanitizeYear,
  sanitizeDate,
  sanitizeEnum
} from './sanitization-utils';

/**
 * Process string fields - returns new object with sanitized string values
 */
export function processStringFields(
  input: Record<string, unknown>
): Record<string, string> {
  const result: Record<string, string> = {};
  const stringFields = ['id', 'title', 'description', 'summary', 'bannerImage',
    'publisher', 'serialization', 'countryOfOrigin', 'originalLanguage', 'ageRating'];

  for (const field of stringFields) {
    if (typeof input[field] === 'string') {
      result[field] = sanitizeString(input[field] as string);
    }
  }
  return result;
}

/**
 * Process array fields - returns new object with sanitized arrays
 */
export function processArrayFields(
  input: Record<string, unknown>
): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  if (Array.isArray(input['alternativeTitles'])) {
    result['alternativeTitles'] = (input['alternativeTitles'] as unknown[])
      .filter(t => typeof t === 'string')
      .map(t => sanitizeString(t as string))
      .filter(t => t.length > 0);
  }

  if (Array.isArray(input['genres'])) {
    result['genres'] = sanitizeStringArray(input['genres'] as unknown[]);
  }

  if (Array.isArray(input['themes'])) {
    result['themes'] = sanitizeStringArray(input['themes'] as unknown[]);
  }

  if (Array.isArray(input['demographics'])) {
    result['demographics'] = sanitizeStringArray(input['demographics'] as unknown[]);
  }

  if (Array.isArray(input['contentWarnings'])) {
    result['contentWarnings'] = sanitizeStringArray(input['contentWarnings'] as unknown[]);
  }

  return result;
}

/**
 * Process number fields - returns new object with sanitized numbers
 */
export function processNumberFields(
  input: Record<string, unknown>
): Record<string, number | null> {
  const result: Record<string, number | null> = {};

  if (input['volumes'] !== undefined) {
    result['volumes'] = sanitizeNumber(input['volumes']);
  }

  if (input['chapters'] !== undefined) {
    result['chapters'] = sanitizeNumber(input['chapters']);
  }

  if (input['averageScore'] !== undefined) {
    result['averageScore'] = sanitizeScore(input['averageScore']);
  }

  if (input['popularity'] !== undefined) {
    result['popularity'] = sanitizeNumber(input['popularity']);
  }

  if (input['releaseYear'] !== undefined) {
    result['releaseYear'] = sanitizeYear(input['releaseYear']);
  }

  return result;
}

/**
 * Process date fields - returns new object with sanitized dates
 */
export function processDateFields(
  input: Record<string, unknown>
): Record<string, Date | string | null> {
  const result: Record<string, Date | string | null> = {};

  if (input['startDate'] !== undefined) {
    result['startDate'] = sanitizeDate(input['startDate']);
  }

  if (input['endDate'] !== undefined) {
    result['endDate'] = sanitizeDate(input['endDate']);
  }

  return result;
}

/**
 * Process enum fields - returns new object with sanitized enums
 */
export function processEnumFields(
  input: Record<string, unknown>
): Record<string, MangaPublicationStatus | MangaFormat | null> {
  const result: Record<string, MangaPublicationStatus | MangaFormat | null> = {};

  if (input['status'] !== undefined) {
    const status = sanitizeEnum(input['status'], MangaPublicationStatus);
    // Convert undefined to null for type safety
    result['status'] = status ?? null;
  }

  if (input['format'] !== undefined) {
    const format = sanitizeEnum(input['format'], MangaFormat);
    // Convert undefined to null for type safety
    result['format'] = format ?? null;
  }

  return result;
}

/**
 * Process boolean fields - returns new object with boolean values
 */
export function processBooleanFields(
  input: Record<string, unknown>
): Record<string, boolean> {
  const result: Record<string, boolean> = {};

  if (input['isAdult'] !== undefined) {
    result['isAdult'] = Boolean(input['isAdult']);
  }

  return result;
}

/**
 * Process complex object fields (pass through) - returns new object
 */
export function processComplexFields(
  input: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const complexFields = ['covers', 'authors', 'artists', 'staff', 'characters',
    'tags', 'rankings', 'externalIds', 'externalLinks',
    'providerMetadata', 'metadataQuality'];

  for (const field of complexFields) {
    if (input[field] !== undefined) {
      result[field] = input[field];
    }
  }

  return result;
}

/**
 * Merge all processed fields into a single sanitized object
 */
export function mergeProcessedFields(
  input: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...processStringFields(input),
    ...processArrayFields(input),
    ...processNumberFields(input),
    ...processDateFields(input),
    ...processEnumFields(input),
    ...processBooleanFields(input),
    ...processComplexFields(input)
  };
}
