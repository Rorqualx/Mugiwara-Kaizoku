/**
 * Chapter Creation Helpers
 *
 * Utility functions for safe property access and data parsing.
 * These helpers ensure type-safe operations on unknown objects
 * from various provider APIs.
 */

import { logger } from '@/utils/logger';

/**
 * Helper function to safely access properties on unknown objects
 *
 * @param obj - The unknown object to access
 * @param key - The property key to retrieve
 * @returns The property value or undefined if not accessible
 */
export function safeGet(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

/**
 * Truncate a string to a maximum length
 *
 * Ensures strings don't exceed database column limits (e.g., VARCHAR(255)).
 *
 * @param str - The string to truncate
 * @param maxLength - Maximum allowed length
 * @returns Truncated string
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  // Truncate and add ellipsis if there's room
  if (maxLength > 3) {
    return str.slice(0, maxLength - 3) + '...';
  }
  return str.slice(0, maxLength);
}

/**
 * Helper function to safely get a string value from an unknown object
 *
 * @param obj - The unknown object to access
 * @param key - The property key to retrieve
 * @param defaultValue - Default value if property is not a string
 * @param maxLength - Optional max length to truncate to (for VARCHAR columns)
 * @returns The string value or default
 */
export function safeGetString(obj: unknown, key: string, defaultValue: string = '', maxLength?: number): string {
  const value = safeGet(obj, key);
  const result = typeof value === 'string' ? value : defaultValue;
  return maxLength ? truncateString(result, maxLength) : result;
}

/**
 * Helper function to safely get a number value from an unknown object
 *
 * @param obj - The unknown object to access
 * @param key - The property key to retrieve
 * @param defaultValue - Default value if property is not a number
 * @returns The number value or default
 */
export function safeGetNumber(obj: unknown, key: string, defaultValue: number = 0): number {
  const value = safeGet(obj, key);
  return typeof value === 'number' ? value : defaultValue;
}

/**
 * Helper function to safely get a string value or undefined
 *
 * Useful for optional string properties where undefined is preferred over empty string.
 *
 * @param obj - The unknown object to access
 * @param key - The property key to retrieve
 * @param maxLength - Optional max length to truncate to (for VARCHAR columns)
 * @returns The string value or undefined if not a non-empty string
 */
export function safeGetStringOptional(obj: unknown, key: string, maxLength?: number): string | undefined {
  const value = safeGet(obj, key);
  if (typeof value === 'string' && value !== '') {
    return maxLength ? truncateString(value, maxLength) : value;
  }
  return undefined;
}

/**
 * Helper function to safely parse a number from unknown value
 *
 * Handles both number types and string representations.
 *
 * @param value - The unknown value to parse
 * @param defaultValue - Default value if parsing fails
 * @returns The parsed number or default
 */
export function parseNumber(value: unknown, defaultValue: number): number {
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Type guard for objects
 *
 * Verifies that a value is a non-null object that can be safely
 * accessed as a Record.
 *
 * @param value - The value to check
 * @returns True if value is a non-null object
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Helper function to parse release date strings into Date objects
 *
 * Handles various date formats including ordinal suffixes (1st, 2nd, 3rd, 21st).
 * Logs warnings for invalid dates to aid debugging.
 *
 * @param dateString - The date string to parse (may include ordinal suffixes)
 * @returns Parsed Date object or null for invalid dates
 */
export function parseReleaseDate(dateString: string | undefined | null): Date | null {
  if (!dateString) return null;

  try {
    // Strip ordinal suffixes (1st, 2nd, 3rd, 21st, etc.) before parsing
    // JavaScript's Date constructor doesn't handle ordinal suffixes
    const cleanedDate = dateString.replace(/(\d+)(st|nd|rd|th)/gi, '$1');

    const parsed = new Date(cleanedDate);
    if (isNaN(parsed.getTime())) {
      logger.warn(`Invalid release date format: "${dateString}" (cleaned: "${cleanedDate}")`);
      return null;
    }
    return parsed;
  } catch (error) {
    logger.error(`Failed to parse release date: "${dateString}"`, error);
    return null;
  }
}
