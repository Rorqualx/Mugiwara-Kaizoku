/**
 * Sorting Helpers for Missing Chapters Table
 *
 * Extracted helper functions to reduce cyclomatic complexity.
 */

import type { MissingItem } from '@/types/search.types';

export type SortField = 'mangaTitle' | 'chapterNumber' | 'volumeNumber' | 'releaseDate' | 'pageCount' | 'downloadStatus';
export type SortDirection = 'asc' | 'desc';

/**
 * Parse chapter number to numeric value for sorting
 */
function parseChapterNumber(value: unknown): number {
  const str = typeof value === 'string' ? value : String(value ?? '');
  return parseFloat(str) || 0;
}

/**
 * Parse date to timestamp for sorting
 */
function parseDate(value: unknown): number {
  const dateValue = typeof value === 'string' || typeof value === 'number' || value instanceof Date ? value : '';
  return new Date(dateValue).getTime();
}

/**
 * Get sortable value from item field
 */
function getSortableValue(value: unknown, field: SortField): string | number {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return field === 'chapterNumber' || field === 'releaseDate' || field === 'pageCount' ? 0 : '';
  }

  // Special handling for chapterNumber
  if (field === 'chapterNumber') {
    return parseChapterNumber(value);
  }

  // Special handling for dates
  if (field === 'releaseDate') {
    return parseDate(value);
  }

  // Default: return as-is (already string or number)
  return value as string | number;
}

/**
 * Compare two items by field and direction
 */
export function sortItems(items: MissingItem[], field: SortField, direction: SortDirection): MissingItem[] {
  return [...items].sort((a, b) => {
    const aVal: unknown = (a as unknown as Record<string, unknown>)[field];
    const bVal: unknown = (b as unknown as Record<string, unknown>)[field];

    // Handle null/undefined - push to end
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    // Get comparable values
    const aCompare = getSortableValue(aVal, field);
    const bCompare = getSortableValue(bVal, field);

    // Compare
    if (aCompare < bCompare) return direction === 'asc' ? -1 : 1;
    if (aCompare > bCompare) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}
