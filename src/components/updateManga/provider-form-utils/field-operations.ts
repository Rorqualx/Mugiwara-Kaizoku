/**
 * Provider Form Utils - Field Operations
 *
 * Field value extraction and formatting with complexity reduction.
 * Functions refactored to use field-specific helpers for better maintainability.
 *
 * Extracted from: providerFormUtils.ts (lines 292-428)
 * Refactored: Complexity reduced from 31/12 to <10 per function
 */

import type { MangaWithRelations, MangaMetadata } from './types';
import type { Manga as MangaEntity } from '@prisma/client';

// ============================================================================
// Helper Functions for getFieldValue (4 helpers)
// ============================================================================

/**
 * Extracts field value from metadata object
 */
function getMetadataFieldValue(
  metadata: Record<string, unknown>,
  field: string
): unknown {
  if (field in metadata) {
    return metadata[field];
  }
  return undefined;
}

/**
 * Gets cover/coverUrl field with fallback logic
 */
function getCoverFieldValue(manga: Record<string, unknown>): unknown {
  // Check metadata first
  if ('metadata' in manga && manga['metadata'] && typeof manga['metadata'] === 'object') {
    const metadata = manga['metadata'] as Record<string, unknown>;
    const coverUrl = metadata['coverUrl'] ?? metadata['cover'];
    if (coverUrl !== undefined) return coverUrl;
  }

  // Check root level
  if ('coverUrl' in manga) return manga['coverUrl'];
  if ('cover' in manga) return manga['cover'];

  return undefined;
}

/**
 * Gets description/summary field with fallback logic
 */
function getDescriptionFieldValue(manga: Record<string, unknown>, field: string): unknown {
  // Check metadata first
  if ('metadata' in manga && manga['metadata'] && typeof manga['metadata'] === 'object') {
    const metadata = manga['metadata'] as Record<string, unknown>;

    if (field === 'summary') {
      return metadata['summary'] ?? metadata['description'];
    }
    if (field === 'description') {
      return metadata['description'] ?? metadata['summary'];
    }
  }

  // Check root level
  if (field === 'summary' && 'summary' in manga) {
    return manga['summary'];
  }
  if (field === 'description' && 'description' in manga) {
    return manga['description'];
  }

  return undefined;
}

/**
 * Gets field value from root level of manga object
 */
function getRootFieldValue(manga: Record<string, unknown>, field: string): unknown {
  if (field in manga) {
    return manga[field];
  }
  return undefined;
}

// ============================================================================
// Main Function: getFieldValue (Complexity: ~8 after refactoring)
// ============================================================================

/**
 * Safely gets a field value from a manga object with type safety
 *
 * Complexity reduced from 31 to 8 by delegating to field-specific helpers.
 *
 * @param manga - The manga object to get a field value from
 * @param field - The field name to get
 * @returns The field value or undefined if not found
 */
export function getFieldValue(
  manga: MangaEntity | MangaWithRelations | MangaMetadata | Record<string, unknown> | null | undefined,
  field: string
): unknown {
  if (!manga) return undefined;

  const mangaRecord = manga as Record<string, unknown>;

  // Handle special fields with dedicated logic
  if (field === 'coverUrl' || field === 'cover') {
    return getCoverFieldValue(mangaRecord);
  }

  if (field === 'summary' || field === 'description') {
    return getDescriptionFieldValue(mangaRecord, field);
  }

  // Check in metadata first (for MangaWithRelations)
  if ('metadata' in mangaRecord && mangaRecord['metadata'] && typeof mangaRecord['metadata'] === 'object') {
    const value = getMetadataFieldValue(
      mangaRecord['metadata'] as Record<string, unknown>,
      field
    );
    if (value !== undefined) return value;
  }

  // Check special fields at root level
  if (field === 'title' && 'title' in mangaRecord) {
    return mangaRecord['title'];
  }
  if (field === 'status' && 'status' in mangaRecord) {
    return mangaRecord['status'];
  }

  // Check root level for other fields
  return getRootFieldValue(mangaRecord, field);
}

// ============================================================================
// Helper Functions for formatFieldValue (3 helpers)
// ============================================================================

/**
 * Formats string values with truncation for long descriptions
 */
function formatStringValue(field: string, value: string): string {
  if ((field === 'description' || field === 'summary') && value.length > 100) {
    return `${value.substring(0, 100)}...`;
  }
  return value;
}

/**
 * Formats array values based on array content type
 */
function formatArrayValue(field: string, value: unknown[]): string {
  // Handle empty arrays
  if (value.length === 0) {
    return 'None';
  }

  // Handle arrays of strings
  if (value.every(item => typeof item === 'string')) {
    return value.join(', ');
  }

  // Handle arrays of objects with name property (tags)
  if (value.every(item => typeof item === 'object' && item !== null && 'name' in item)) {
    return value.map(item => (item as { name: string }).name).join(', ');
  }

  // Handle arrays of objects with role and name (staff)
  if (
    field === 'staff' &&
    value.every(item => typeof item === 'object' && item !== null && 'role' in item && 'name' in item)
  ) {
    return value
      .map(item => {
        const staffItem = item as { role: string; name: string };
        return `${staffItem.role}: ${staffItem.name}`;
      })
      .join(', ');
  }

  // Handle generic arrays
  return value
    .map(item => (typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item)))
    .join(', ');
}

/**
 * Formats object values to JSON string
 */
function formatObjectValue(value: object): string {
  return JSON.stringify(value);
}

// ============================================================================
// Main Function: formatFieldValue (Complexity: ~6 after refactoring)
// ============================================================================

/**
 * Safely formats a field value for display with appropriate type handling
 *
 * Complexity reduced from ~12 to 6 by delegating to type-specific formatters.
 *
 * @param field - The field name (for field-specific formatting)
 * @param value - The value to format
 * @returns Formatted string representation of the value
 */
export function formatFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  // Handle string values
  if (typeof value === 'string') {
    return formatStringValue(field, value);
  }

  // Handle numeric values
  if (typeof value === 'number') {
    return String(value);
  }

  // Handle date values
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }

  // Handle array values
  if (Array.isArray(value)) {
    return formatArrayValue(field, value);
  }

  // Handle objects
  if (typeof value === 'object') {
    return formatObjectValue(value);
  }

  // Fallback for other types
  return String(value);
}
