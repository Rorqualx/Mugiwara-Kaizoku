/**
 * Array Utility Functions
 * 
 * This module provides type-safe utility functions for working with arrays.
 * These functions help prevent common issues when dealing with potentially 
 * undefined or null arrays, and provide type guards for ensuring type safety.
 */

/**
 * Type guard to check if a value is an array
 * 
 * @param value - Value to check
 * @returns True if the value is an array
 * 
 * @example
 * ```ts
 * if (isArray(value)) {
 *   // value is definitely an array here
 *   value.forEach(item => logger.info(item));
 * }
 * ```
 */
export function isArray<T = unknown>(value: unknown): value is Array<T> {
  return Array.isArray(value);
}

/**
 * Type guard to check if a value is a non-empty array
 * 
 * @param value - Value to check
 * @returns True if the value is a non-empty array
 * 
 * @example
 * ```ts
 * if (isNonEmptyArray(items)) {
 *   // items is definitely a non-empty array here
 *   const first = items[0]; // Safe access
 * }
 * ```
 */
export function isNonEmptyArray<T = unknown>(value: unknown): value is [T, ...T[]] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Type guard to check if all elements in an array match a predicate
 * 
 * @param array - Array to check
 * @param predicate - Function to test each element
 * @returns True if all elements match the predicate
 * 
 * @example
 * ```ts
 * const isAllStrings = allMatch(array, (item): item is string => typeof item === 'string');
 * if (isAllStrings) {
 *   // array is definitely string[] here
 *   array.map(item => item.toUpperCase());
 * }
 * ```
 */
export function allMatch<T, R extends T>(
  array: T[], 
  predicate: (item: T) => item is R
): array is R[] {
  return array.every(predicate);
}

/**
 * Type guard to check if any element in an array matches a predicate
 * 
 * @param array - Array to check
 * @param predicate - Function to test each element
 * @returns True if any element matches the predicate
 * 
 * @example
 * ```ts
 * if (anyMatch(array, (item): item is number => typeof item === 'number')) {
 *   // At least one item is a number
 *   const numbers = array.filter((item): item is number => typeof item === 'number');
 * }
 * ```
 */
export function anyMatch<T, R extends T>(
  array: T[], 
  predicate: (item: T) => item is R
): boolean {
  return array.some(predicate);
}

/**
 * Safely gets an element from an array at the specified index
 * Returns undefined if the array is null/undefined or index is out of bounds
 * 
 * @param array - Array to get element from
 * @param index - Index of the element
 * @returns Element at the specified index or undefined
 * 
 * @example
 * ```ts
 * const firstItem = safeArrayGet(items, 0);
 * if (firstItem) {
 *   logger.info(firstItem);
 * }
 * ```
 */
export function safeArrayGet<T>(array: T[] | null | undefined, index: number): T | undefined {
  if (!array || index < 0 || index >= array.length) {
    return undefined;
  }
  return array[index];
}

/**
 * Gets the first element of an array or undefined if array is empty/null/undefined
 * 
 * @param array - Array to get first element from
 * @returns First element or undefined
 * 
 * @example
 * ```ts
 * const first = firstOrUndefined(items);
 * if (first) {
 *   logger.info(first);
 * }
 * ```
 */
export function firstOrUndefined<T>(array: T[] | null | undefined): T | undefined {
  return safeArrayGet(array, 0);
}

/**
 * Gets the last element of an array or undefined if array is empty/null/undefined
 * 
 * @param array - Array to get last element from
 * @returns Last element or undefined
 * 
 * @example
 * ```ts
 * const last = lastOrUndefined(items);
 * if (last) {
 *   logger.info(last);
 * }
 * ```
 */
export function lastOrUndefined<T>(array: T[] | null | undefined): T | undefined {
  if (!array || array.length === 0) {
    return undefined;
  }
  return array[array.length - 1];
}

/**
 * Ensures a value is an array
 * - If value is an array, returns it
 * - If value is null or undefined, returns an empty array
 * - Otherwise, returns an array with the value as the only element
 * 
 * @param value - Value to ensure is an array
 * @returns Array containing the value or empty array
 * 
 * @example
 * ```ts
 * const items = ensureArray(possiblyUndefined);
 * items.forEach(item => logger.info(item)); // Safe to use array methods
 * ```
 */
export function ensureArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/**
 * Filters null and undefined values from an array
 * 
 * @param array - Array to filter
 * @returns Array with null and undefined values removed
 * 
 * @example
 * ```ts
 * const validItems = filterNullish(items);
 * // validItems contains only non-null, non-undefined values
 * ```
 */
export function filterNullish<T>(array: (T | null | undefined)[]): T[] {
  return array.filter((item): item is T => item !== null);
}

/**
 * Creates a type-safe mapper function for mapping an array of unknown values
 * 
 * @param array - Array to map
 * @param predicate - Function to test each element
 * @param mapper - Function to map matching elements
 * @param defaultValue - Value to use for non-matching elements
 * @returns Mapped array
 * 
 * @example
 * ```ts
 * const items = ['1', 2, '3', 4];
 * const doubled = typeSafeMap(
 *   items,
 *   (item): item is number => typeof item === 'number',
 *   item => item * 2,
 *   0
 * );
 * // doubled = [0, 4, 0, 8]
 * ```
 */
export function typeSafeMap<T, R extends T, U>(
  array: unknown[],
  predicate: (item: unknown) => item is R,
  mapper: (item: R) => U,
  defaultValue: U
): U[] {
  return array.map(item => {
    if (predicate(item)) {
      return mapper(item);
    }
    return defaultValue;
  });
}

/**
 * Safely joins an array with a separator
 * Returns empty string if array is null/undefined
 * 
 * @param array - Array to join
 * @param separator - Separator to use
 * @returns Joined string or empty string
 * 
 * @example
 * ```ts
 * const csv = safeJoin(items, ',');
 * ```
 */
export function safeJoin(
  array: (string | number | boolean | null | undefined)[] | null | undefined, 
  separator: string = ','
): string {
  if (!array) {
    return '';
  }
  return array
    .filter(item => item !== null)
    .join(separator);
}

/**
 * Checks if two arrays have the same elements
 * Order does not matter
 * 
 * @param array1 - First array
 * @param array2 - Second array
 * @param compareFn - Optional function to compare elements
 * @returns True if arrays have the same elements
 * 
 * @example
 * ```ts
 * if (hasSameElements([1, 2, 3], [3, 2, 1])) {
 *   logger.info('Arrays have the same elements');
 * }
 * ```
 */
export function hasSameElements<T>(
  array1: T[] | null | undefined,
  array2: T[] | null | undefined,
  compareFn: (a: T, b: T) => boolean = (a, b) => a === b
): boolean {
  if (!array1 && !array2) {
    return true;
  }
  if (!array1 || !array2) {
    return false;
  }
  if (array1.length !== array2.length) {
    return false;
  }
  
  return array1.every(item1 => {
    return array2.some(item2 => compareFn(item1, item2));
  });
}

/**
 * Chunks an array into smaller arrays of the specified size
 * 
 * @param array - Array to chunk
 * @param size - Size of each chunk
 * @returns Array of chunks
 * 
 * @example
 * ```ts
 * const chunks = chunk([1, 2, 3, 4, 5], 2);
 * // chunks = [[1, 2], [3, 4], [5]]
 * ```
 */
export function chunk<T>(array: T[], size: number): T[][] {
  if (!array.length || size <= 0) {
    return [];
  }
  
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  
  return chunks;
}