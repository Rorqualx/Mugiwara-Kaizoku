/**
 * Type-safe property access utilities
 *
 * These functions provide safe, validated access to object properties
 * without using unsafe type assertions.
 *
 * @module safe-access
 */

/**
 * Safely get a string property from an object
 * @param obj - Object to get property from
 * @param key - Property key to access
 * @returns The string value if found and valid, undefined otherwise
 */
export function getStringProperty(
  obj: Record<string, unknown>,
  key: string
): string | undefined {
  const value = obj[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Safely get a number property from an object
 * @param obj - Object to get property from
 * @param key - Property key to access
 * @returns The number value if found and valid, undefined otherwise
 */
export function getNumberProperty(
  obj: Record<string, unknown>,
  key: string
): number | undefined {
  const value = obj[key];
  return typeof value === 'number' ? value : undefined;
}

/**
 * Safely get a boolean property from an object
 * @param obj - Object to get property from
 * @param key - Property key to access
 * @returns The boolean value if found and valid, undefined otherwise
 */
export function getBooleanProperty(
  obj: Record<string, unknown>,
  key: string
): boolean | undefined {
  const value = obj[key];
  return typeof value === 'boolean' ? value : undefined;
}

/**
 * Safely get a string array property from an object
 * @param obj - Object to get property from
 * @param key - Property key to access
 * @returns The string array if found and valid, undefined otherwise
 */
export function getStringArrayProperty(
  obj: Record<string, unknown>,
  key: string
): string[] | undefined {
  const value = obj[key];
  if (!Array.isArray(value)) return undefined;
  if (!value.every(v => typeof v === 'string')) return undefined;
  return value;
}

/**
 * Generic safe property access with custom validator
 * @param obj - Object to get property from
 * @param key - Property key to access
 * @param validator - Type guard function to validate the value
 * @returns The validated value if found and valid, undefined otherwise
 */
export function getProperty<T>(
  obj: Record<string, unknown>,
  key: string,
  validator: (value: unknown) => value is T
): T | undefined {
  const value = obj[key];
  return validator(value) ? value : undefined;
}

/**
 * Safely get an unknown property from an object
 * This is a type-safe replacement for unsafe property access
 * Returns the raw value as unknown, requiring further validation
 *
 * @param obj - Object to get property from (can be unknown)
 * @param key - Property key to access
 * @returns The value as unknown if the object is a record, undefined otherwise
 */
export function getUnknownProperty(
  obj: unknown,
  key: string
): unknown {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return undefined;
  }
  return (obj as Record<string, unknown>)[key];
}
