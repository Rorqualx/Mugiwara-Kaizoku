/**
 * Metadata Merger Module
 *
 * Provides utilities to merge metadata from multiple providers into a single
 * consolidated MangaMetadata object. Uses first-non-null strategy with
 * array deduplication.
 *
 * Extracted from metadataService.ts (lines 509-620) with complexity reduction.
 * Original complexity: 28
 * Target complexity: <20
 *
 * Strategy: Extract helper functions to reduce nesting and branching in main function.
 *
 * @module metadata-merger
 */

// ============================================================================
// Imports
// ============================================================================

import { MangaPublicationStatus } from '@prisma/client';

import type { MangaMetadata } from '@/types/search.types';



// ============================================================================
// Types
// ============================================================================

/**
 * Provider metadata result structure
 */
export interface ProviderMetadataResult {
  provider: string;
  metadata: MangaMetadata;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Merge a string field from source to target (first non-empty wins)
 *
 * @param target - Target metadata object to merge into
 * @param source - Source metadata object to merge from
 * @param field - Field name to merge
 */
function mergeStringField<T extends Record<string, unknown>>(
  target: T,
  source: T,
  field: keyof T
): void {
  if (!target[field] && source[field]) {
    // eslint-disable-next-line no-param-reassign -- Intentional mutation for merge algorithm
    target[field] = source[field];
  }
}

/**
 * Merge a number field from source to target (first non-null wins)
 *
 * @param target - Target metadata object to merge into
 * @param source - Source metadata object to merge from
 * @param field - Field name to merge
 */
function mergeNumberField<T extends Record<string, unknown>>(
  target: T,
  source: T,
  field: keyof T
): void {
  if (!target[field] && source[field]) {
    // eslint-disable-next-line no-param-reassign -- Intentional mutation for merge algorithm
    target[field] = source[field];
  }
}

/**
 * Merge an array field with accumulation (deduplication happens later)
 *
 * @param source - Source metadata object to merge from
 * @param field - Field name to merge
 * @param accumulated - Array to accumulate values into
 */
function mergeArrayField<T extends Record<string, unknown>>(
  source: T,
  field: keyof T,
  accumulated: string[]
): void {
  if (Array.isArray(source[field])) {
    accumulated.push(...(source[field] as string[]));
  }
}

/**
 * Merge status field (prefer non-UNKNOWN values)
 *
 * @param target - Target metadata object to merge into
 * @param source - Source metadata object to merge from
 */
function mergeStatusField(
  target: { status?: MangaPublicationStatus | string | undefined },
  source: { status?: MangaPublicationStatus | string | undefined }
): void {
  if (source.status && target.status === MangaPublicationStatus.UNKNOWN) {
    // eslint-disable-next-line no-param-reassign -- Intentional mutation for merge algorithm
    target.status = source.status;
  }
}

/**
 * Deduplicate array and assign to target
 *
 * @param target - Target metadata object to merge into
 * @param field - Field name to assign deduplicated array to
 * @param items - Array to deduplicate
 */
function deduplicateArray<T extends Record<string, unknown>>(
  target: T,
  field: keyof T,
  items: string[]
): void {
  if (items.length > 0) {
    // eslint-disable-next-line no-param-reassign -- Intentional mutation for merge algorithm
    target[field] = items.filter((value, index, self) => self.indexOf(value) === index) as T[keyof T];
  }
}

/**
 * Process scalar fields for a single metadata result
 *
 * @param mergedMetadata - Target metadata object to merge into
 * @param meta - Source metadata object to merge from
 */
function processScalarFields(
  mergedMetadata: MangaMetadata,
  meta: MangaMetadata
): void {
  mergeStringField(mergedMetadata, meta, 'title');
  mergeStringField(mergedMetadata, meta, 'description');
  mergeStringField(mergedMetadata, meta, 'coverUrl');
  mergeNumberField(mergedMetadata, meta, 'year');
  mergeStatusField(mergedMetadata, meta);
}

/**
 * Process array fields for a single metadata result
 *
 * @param meta - Source metadata object to merge from
 * @param authors - Array to accumulate authors into
 * @param genres - Array to accumulate genres into
 */
function processArrayFields(
  meta: MangaMetadata,
  authors: string[],
  genres: string[]
): void {
  mergeArrayField(meta, 'authors', authors);
  mergeArrayField(meta, 'genres', genres);
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Merge metadata from multiple providers
 *
 * Combines metadata objects using first-non-null strategy for scalar fields
 * and deduplication for arrays. Processes providers in reverse order so
 * first provider takes precedence.
 *
 * This is a pure function with no side effects - error handling should be
 * done by the caller.
 *
 * @param results - Array of provider metadata results
 * @returns Merged MangaMetadata or null if no valid data
 */
export function mergeProviderMetadata(
  results: ProviderMetadataResult[]
): MangaMetadata | null {
  if (results.length === 0) {
    return null;
  }

  // Initialize with defaults
  const mergedMetadata: MangaMetadata = {
    title: 'Unknown',
    status: MangaPublicationStatus.UNKNOWN,
    alternativeTitles: [],
    description: '',
    authors: [],
    artists: [],
    genres: [],
    tags: [],
    coverUrl: ''
  };

  // Arrays to accumulate
  const authors: string[] = [];
  const genres: string[] = [];

  // Process in reverse order (first provider wins)
  for (let i = results.length - 1; i >= 0; i--) {
    const result = results[i];
    if (!result?.metadata) {
      continue;
    }

    const meta = result.metadata;

    // Merge scalar fields
    processScalarFields(mergedMetadata, meta);

    // Accumulate arrays
    processArrayFields(meta, authors, genres);
  }

  // Deduplicate and assign arrays
  deduplicateArray(mergedMetadata, 'authors', authors);
  deduplicateArray(mergedMetadata, 'genres', genres);

  return Object.keys(mergedMetadata).length > 1 ? mergedMetadata : null;
}
