/**
 * ID Conversion Utilities
 *
 * Single source of truth for ID type conversions and operations.
 * Provides consistent handling of string and numeric IDs across the application.
 */

import { ValidationError } from './errors';

import type { ID, NumericID, StringID } from '../types/common';

/**
 * Re-export ID types from common
 */
export type { ID, NumericID, StringID } from '../types/common';


/**
 * Checks if a value is a valid ID (string or number)
 *
 * @param value - Value to check
 * @returns True if value is a valid ID
 */
export function isValidId(value: unknown): value is ID {
  if (typeof value === 'number') {
    return !isNaN(value) && isFinite(value);
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return false;
}

/**
 * Converts an ID to a number
 * Safe version with default value fallback
 *
 * @param id - The ID to convert
 * @param defaultValue - Default value if conversion fails (default: 0)
 * @returns The ID as a number or the default value
 */
export function toNumberId(id: unknown, defaultValue: number = 0): NumericID {
  try {
    if (id === null) {
      return defaultValue;
    }

    if (typeof id === 'number' && !isNaN(id) && isFinite(id)) {
      return id;
    }

    if (typeof id === 'string') {
      const parsed = parseInt(id, 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }

    return defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Converts an ID to a string
 *
 * @param id - The ID to convert
 * @param defaultValue - Default value if conversion fails
 * @returns The ID as a string
 */
export function toStringId(id: unknown, defaultValue: string = ''): StringID {
  if (id === null) {
    return defaultValue;
  }

  if (typeof id === 'string') {
    return id.trim() || defaultValue;
  }

  if (typeof id === 'number' && !isNaN(id) && isFinite(id)) {
    return String(id);
  }

  return defaultValue;
}


/**
 * Safely converts an ID to a number with null fallback
 *
 * @param id - The ID to convert
 * @returns The ID as a number or null
 */
export function safeIdToNumber(id: ID | null | undefined): NumericID | null {
  if (id === null) {
    return null;
  }

  const result = toNumberId(id, -1);
  return result === -1 ? null : result;
}

/**
 * Checks if two IDs are equivalent (handles type differences)
 *
 * @param id1 - First ID to compare
 * @param id2 - Second ID to compare
 * @returns True if the IDs are equivalent
 */
export function areIdsEqual(id1: unknown, id2: unknown): boolean {
  // Quick path for same type comparison
  if (id1 === id2) {
    return true;
  }

  // Handle null/undefined
  if (id1 === null || id2 === null) {
    return false;
  }

  // String comparison
  if (typeof id1 === 'string' && typeof id2 === 'string') {
    return id1 === id2;
  }

  // Number comparison
  if (typeof id1 === 'number' && typeof id2 === 'number') {
    return id1 === id2;
  }

  // Mixed type comparison - convert both to strings
  return toStringId(id1) === toStringId(id2);
}

/**
 * Validates an ID and returns it, or throws an error
 *
 * @param id - The ID to validate
 * @param errorMessage - Custom error message
 * @returns The validated ID
 * @throws ValidationError if the ID is invalid
 */
export function validateIdOrThrow(id: unknown, errorMessage?: string): ID {
  if (isValidId(id)) {
    return id;
  }

  throw new ValidationError(
    errorMessage ?? `Invalid ID: ${JSON.stringify(id)}`
  );
}

/**
 * Validates a numeric ID and throws if invalid
 *
 * @param id - The ID to validate
 * @param errorMessage - Custom error message
 * @returns The validated numeric ID
 * @throws ValidationError if the ID is invalid
 */
export function validateNumericId(id: unknown, errorMessage?: string): NumericID {
  const numericId = toNumberId(id, -1);

  if (numericId <= 0 || !isFinite(numericId)) {
    throw new ValidationError(
      errorMessage ?? `Invalid numeric ID: ${JSON.stringify(id)}`
    );
  }

  return numericId;
}

/**
 * Converts an array of IDs to numeric IDs
 *
 * @param ids - Array of IDs to convert
 * @returns Array of numeric IDs
 */
export function convertIdArray(ids: ID[]): NumericID[] {
  return ids.map(id => toNumberId(id));
}

/**
 * Converts an array of IDs to string IDs
 *
 * @param ids - Array of IDs to convert
 * @returns Array of string IDs
 */
export function convertIdArrayToString(ids: ID[]): StringID[] {
  return ids.map(id => toStringId(id));
}

/**
 * Finds an item in an array by ID
 *
 * @param items - Array of items to search
 * @param id - ID to find
 * @param idSelector - Function to extract ID from an item
 * @returns The found item or undefined
 */
export function findById<T>(
  items: T[],
  id: unknown,
  idSelector: (item: T) => unknown
): T | undefined {
  if (!Array.isArray(items) || !isValidId(id)) {
    return undefined;
  }

  return items.find(item => areIdsEqual(idSelector(item), id));
}

/**
 * Filters an array of items by ID
 *
 * @param items - Array of items to filter
 * @param id - ID to filter by
 * @param idSelector - Function to extract ID from an item
 * @returns Filtered array
 */
export function filterById<T>(
  items: T[],
  id: unknown,
  idSelector: (item: T) => unknown
): T[] {
  if (!Array.isArray(items) || !isValidId(id)) {
    return [];
  }

  return items.filter(item => areIdsEqual(idSelector(item), id));
}

/**
 * Creates a predicate function for finding items by ID
 *
 * @param targetId - The ID to search for
 * @param idSelector - Function to extract ID from item
 * @returns Predicate function
 */
export function createIdPredicate<T>(
  targetId: unknown,
  idSelector: (item: T) => unknown
): (item: T) => boolean {
  return (item: T): boolean => {
    return areIdsEqual(idSelector(item), targetId);
  };
}

/**
 * Creates a function to find items by ID with type safety
 *
 * @param idSelector - Function to extract ID from item
 * @returns Finder function
 */
export function createIdFinder<T>(idSelector: (item: T) => unknown): (items: T[], id: unknown) => T | undefined {
  return (items: T[], id: unknown): T | undefined => {
    return findById(items, id, idSelector);
  };
}

/**
 * Creates a function to filter items by ID with type safety
 *
 * @param idSelector - Function to extract ID from item
 * @returns Filter function
 */
export function createIdFilter<T>(idSelector: (item: T) => unknown): (items: T[], id: unknown) => T[] {
  return (items: T[], id: unknown): T[] => {
    return filterById(items, id, idSelector);
  };
}

/**
 * Extracts a manga ID from a manga object with type safety
 * @param manga - Manga object or ID
 * @returns Numeric ID for API calls
 */
export function extractMangaId(manga: unknown): number {
  if (manga === null) {
    return -1;
  }

  // If manga is already a number or string (direct ID)
  if (typeof manga === 'number') {
    return manga;
  }
  if (typeof manga === 'string') {
    const parsed = parseInt(manga, 10);
    return isNaN(parsed) ? -1 : parsed;
  }

  // If manga is an object with an id property
  if (typeof manga === 'object' && 'id' in manga) {
    const id = (manga as { id: unknown }).id;
    if (typeof id === 'number') {
      return id;
    }
    if (typeof id === 'string') {
      const parsed = toNumberId(id, -1);
      return parsed === -1 ? -1 : parsed;
    }
  }
  return -1;
}

/**
 * Creates a unique string key from multiple IDs
 * Useful for creating unique React keys or cache keys
 */
export function createCompositeKey(...ids: ID[]): string {
  return ids.map(id => toStringId(id)).join(':');
}

/**
 * Checks if an ID is positive (greater than 0)
 * Useful for validating database IDs
 */
export function isPositiveId(id: ID): boolean {
  if (typeof id === 'number') {
    return id > 0;
  }
  const num = toNumberId(id, -1);
  return num > 0;
}

/**
 * Extracts provider-specific ID from a result object
 */
export function extractProviderSpecificId(result: unknown, provider: string): string | undefined {
  if (!result || typeof result !== 'object') {
    return undefined;
  }

  // Check for sourceId with provider prefix
  if ('sourceId' in result && typeof (result as { sourceId?: unknown }).sourceId === 'string') {
    const sourceId = (result as { sourceId: string }).sourceId;
    if (sourceId.startsWith(`${provider}:`)) {
      return sourceId.split(':')[1];
    }
    return sourceId;
  }

  // Check for id with direct provider properties
  if (provider in result && isValidId((result as Record<string, unknown>)[provider])) {
    const id = (result as Record<string, unknown>)[provider];
    return toStringId(id as ID);
  }

  // Fallback to regular id
  if ('id' in result && isValidId((result as { id?: unknown }).id)) {
    return toStringId((result as { id: ID }).id);
  }
  return undefined;
}

/**
 * Generates a provider-specific ID by combining provider name and ID
 */
export function createProviderSpecificId(provider: string, id: ID): string {
  return `${provider}:${toStringId(id)}`;
}

/**
 * Safely extracts an ID from an object with an id property
 * Returns a default value if the object doesn't have a valid ID
 */
export function extractId(obj: unknown, defaultId: ID = -1): ID {
  if (!obj || typeof obj !== 'object' || !('id' in obj)) {
    return defaultId;
  }
  const id = (obj as { id: unknown }).id;
  return isValidId(id) ? id : defaultId;
}

/**
 * Parse ID from various formats
 * @param value - Value to parse as ID
 * @param defaultId - Default value if parsing fails
 * @returns Parsed ID or default value
 */
export function parseId(value: unknown, defaultId: ID = -1): ID {
  if (isValidId(value)) {
    return value;
  }
  return defaultId;
}

