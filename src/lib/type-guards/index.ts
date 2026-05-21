/**
 * Type Guard Utilities for Safe Type Narrowing
 *
 * @deprecated This file is deprecated and will be removed in a future version.
 * Please migrate to the centralized type guard location: @/utils/type-guards
 *
 * Purpose: Replace unsafe `as any` assertions with proper type guards
 * Usage: Import and use to safely narrow unknown types
 *
 * @example
 * // Before (unsafe):
 * const data = JSON.parse(str) as any;
 * console.log(data.title);
 *
 * // After (safe):
 * const data: unknown = JSON.parse(str);
 * if (hasProperty(data, 'title') && typeof data.title === 'string') {
 *   console.log(data.title);
 * }
 */

// ============================================================================
// Generic Property Checking
// ============================================================================

/**
 * Type guard to check if an unknown value has a specific property
 *
 * @param obj - The value to check
 * @param key - The property key to look for
 * @returns True if obj is an object with the specified property
 *
 * @example
 * if (hasProperty(data, 'title')) {
 *   // TypeScript knows data.title exists (type unknown)
 *   if (typeof data.title === 'string') {
 *     console.log(data.title);
 *   }
 * }
 */
export function hasProperty<K extends string>(
  obj: unknown,
  key: K,
): obj is Record<K, unknown> {
  return typeof obj === 'object' && obj !== null && key in obj;
}

/**
 * Type guard to check if an unknown value has multiple specific properties
 *
 * @param obj - The value to check
 * @param keys - Array of property keys to look for
 * @returns True if obj is an object with all specified properties
 *
 * @example
 * if (hasProperties(data, ['id', 'title', 'author'])) {
 *   // TypeScript knows data.id, data.title, data.author all exist
 *   console.log(data.id, data.title, data.author);
 * }
 */
export function hasProperties<K extends string>(
  obj: unknown,
  keys: readonly K[],
): obj is Record<K, unknown> {
  return (
    typeof obj === 'object' && obj !== null && keys.every((key) => key in obj)
  );
}

// ============================================================================
// Specific Type Checks
// ============================================================================

/**
 * Type guard to check if a value is a plain object (not null, not array)
 *
 * @param obj - The value to check
 * @returns True if obj is a Record<string, unknown>
 *
 * @example
 * if (isRecord(data)) {
 *   // TypeScript knows data is Record<string, unknown>
 *   Object.keys(data).forEach(key => console.log(data[key]));
 * }
 */
export function isRecord(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}

/**
 * Type guard to check if a value is a string-to-string record
 *
 * @param obj - The value to check
 * @returns True if obj is Record<string, string>
 *
 * @example
 * if (isStringRecord(headers)) {
 *   // All values are guaranteed to be strings
 *   const contentType = headers['Content-Type'];
 * }
 */
export function isStringRecord(obj: unknown): obj is Record<string, string> {
  return isRecord(obj) && Object.values(obj).every((v) => typeof v === 'string');
}

/**
 * Type guard to check if a value is a string-to-number record
 *
 * @param obj - The value to check
 * @returns True if obj is Record<string, number>
 *
 * @example
 * if (isNumberRecord(stats)) {
 *   // All values are guaranteed to be numbers
 *   const total = stats.views + stats.downloads;
 * }
 */
export function isNumberRecord(obj: unknown): obj is Record<string, number> {
  return isRecord(obj) && Object.values(obj).every((v) => typeof v === 'number');
}

/**
 * Type guard to check if a value is a string-to-boolean record
 *
 * @param obj - The value to check
 * @returns True if obj is Record<string, boolean>
 */
export function isBooleanRecord(
  obj: unknown,
): obj is Record<string, boolean> {
  return (
    isRecord(obj) && Object.values(obj).every((v) => typeof v === 'boolean')
  );
}

// ============================================================================
// Array Type Guards
// ============================================================================

/**
 * Type guard to check if a value is an array of strings
 *
 * @param value - The value to check
 * @returns True if value is string[]
 *
 * @example
 * if (isStringArray(tags)) {
 *   tags.forEach(tag => console.log(tag.toUpperCase()));
 * }
 */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * Type guard to check if a value is an array of numbers
 *
 * @param value - The value to check
 * @returns True if value is number[]
 *
 * @example
 * if (isNumberArray(ids)) {
 *   const sum = ids.reduce((acc, id) => acc + id, 0);
 * }
 */
export function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number');
}

/**
 * Type guard to check if a value is an array of booleans
 *
 * @param value - The value to check
 * @returns True if value is boolean[]
 */
export function isBooleanArray(value: unknown): value is boolean[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'boolean')
  );
}

/**
 * Type guard to check if a value is an array of objects
 *
 * @param value - The value to check
 * @returns True if value is Record<string, unknown>[]
 *
 * @example
 * if (isRecordArray(items)) {
 *   items.forEach(item => console.log(Object.keys(item)));
 * }
 */
export function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isRecord);
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Type guard to check if a value is an Error instance
 *
 * @param value - The value to check
 * @returns True if value is an Error
 *
 * @example
 * try {
 *   // some operation
 * } catch (error: unknown) {
 *   if (isError(error)) {
 *     logger.error(error.message);
 *   }
 * }
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Extract a safe error message from an unknown error value
 *
 * @param error - The error value (can be anything thrown)
 * @returns A string error message
 *
 * @example
 * try {
 *   // some operation
 * } catch (error: unknown) {
 *   const message = getErrorMessage(error);
 *   logger.error(message);
 * }
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) return error.message;
  if (typeof error === 'string') return error;
  if (hasProperty(error, 'message') && typeof error.message === 'string') {
    return error.message;
  }
  return String(error);
}

/**
 * Extract error stack trace if available
 *
 * @param error - The error value
 * @returns Stack trace string or undefined
 */
export function getErrorStack(error: unknown): string | undefined {
  if (isError(error)) return error.stack;
  if (hasProperty(error, 'stack') && typeof error.stack === 'string') {
    return error.stack;
  }
  return undefined;
}

// ============================================================================
// Common Structure Guards
// ============================================================================

/**
 * Type guard for objects with a title property
 *
 * @param obj - The value to check
 * @returns True if obj has a string title property
 *
 * @example
 * if (hasTitle(manga)) {
 *   console.log(manga.title);
 * }
 */
export function hasTitle(obj: unknown): obj is { title: string } {
  return hasProperty(obj, 'title') && typeof obj.title === 'string';
}

/**
 * Type guard for objects with an id property
 *
 * @param obj - The value to check
 * @returns True if obj has a numeric or string id property
 *
 * @example
 * if (hasId(entity)) {
 *   const id = entity.id;
 * }
 */
export function hasId(obj: unknown): obj is { id: number | string } {
  return (
    hasProperty(obj, 'id') &&
    (typeof obj.id === 'number' || typeof obj.id === 'string')
  );
}

/**
 * Type guard for objects with both id and title properties
 *
 * @param obj - The value to check
 * @returns True if obj has both id and title
 */
export function hasIdAndTitle(
  obj: unknown,
): obj is { id: number | string; title: string } {
  return hasId(obj) && hasTitle(obj);
}

/**
 * Type guard for objects with a name property
 *
 * @param obj - The value to check
 * @returns True if obj has a string name property
 */
export function hasName(obj: unknown): obj is { name: string } {
  return hasProperty(obj, 'name') && typeof obj.name === 'string';
}

/**
 * Type guard for objects with a description property
 *
 * @param obj - The value to check
 * @returns True if obj has a string description property
 */
export function hasDescription(obj: unknown): obj is { description: string } {
  return (
    hasProperty(obj, 'description') && typeof obj.description === 'string'
  );
}

// ============================================================================
// Nullability Guards
// ============================================================================

/**
 * Type guard to filter out null and undefined values
 *
 * @param value - The value to check
 * @returns True if value is not null or undefined
 *
 * @example
 * const items = [1, null, 2, undefined, 3];
 * const validItems = items.filter(isDefined); // [1, 2, 3]
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard to check if a value is null or undefined
 *
 * @param value - The value to check
 * @returns True if value is null or undefined
 */
export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

// ============================================================================
// Primitive Type Guards
// ============================================================================

/**
 * Type guard for non-empty strings
 *
 * @param value - The value to check
 * @returns True if value is a non-empty string
 *
 * @example
 * if (isNonEmptyString(title)) {
 *   // title is guaranteed to have at least one character
 *   console.log(title);
 * }
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard for positive numbers
 *
 * @param value - The value to check
 * @returns True if value is a positive number (> 0)
 */
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && value > 0 && !Number.isNaN(value);
}

/**
 * Type guard for non-negative numbers
 *
 * @param value - The value to check
 * @returns True if value is a non-negative number (>= 0)
 */
export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && !Number.isNaN(value);
}

/**
 * Type guard for integer numbers
 *
 * @param value - The value to check
 * @returns True if value is an integer
 */
export function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

// ============================================================================
// URL and Date Guards
// ============================================================================

/**
 * Type guard to check if a string is a valid URL
 *
 * @param value - The value to check
 * @returns True if value is a valid URL string
 *
 * @example
 * if (isValidUrl(coverImage)) {
 *   fetch(coverImage);
 * }
 */
export function isValidUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard to check if a value is a valid Date
 *
 * @param value - The value to check
 * @returns True if value is a valid Date instance
 */
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

// ============================================================================
// Function Guards
// ============================================================================

/**
 * Type guard to check if a value is a function
 *
 * @param value - The value to check
 * @returns True if value is a function
 */
export function isFunction(
  value: unknown,
): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}
