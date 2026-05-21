/**
 * Utility Functions for Confirmation Data Builder
 *
 * Common utility functions for data processing and cleanup.
 *
 * @module components/addManga/form/confirmation-data-builder/utilities
 */

/**
 * Helper to remove undefined values from an object for exactOptionalPropertyTypes
 *
 * @param obj - Object to filter
 * @returns Object with undefined values removed
 */
export function removeUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}
