/**
 * Basic Type Validators
 *
 * Shared validators for primitive types and common patterns
 * used across external manga type guards.
 */

/**
 * Check if value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Check if value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Check if value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === "number";
}

/**
 * Check if value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/**
 * Check if value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Check if value is an array of strings
 */
export function isStringArray(value: unknown): value is string[] {
  return isArray(value) && value.every(isString);
}

/**
 * Check if property exists on object (optional)
 */
export function hasOptionalProperty(
  obj: Record<string, unknown>,
  prop: string
): boolean {
  return !(prop in obj) || obj[prop] !== undefined;
}

/**
 * Check if property exists and has specific type (optional)
 */
export function hasOptionalPropertyOfType<T>(
  obj: Record<string, unknown>,
  prop: string,
  typeGuard: (value: unknown) => value is T
): boolean {
  return !(prop in obj) || typeGuard(obj[prop]);
}

/**
 * Check if property exists and has specific type (required)
 */
export function hasRequiredPropertyOfType<T>(
  obj: Record<string, unknown>,
  prop: string,
  typeGuard: (value: unknown) => value is T
): boolean {
  return prop in obj && typeGuard(obj[prop]);
}

/**
 * Check if property exists (presence only, no type check)
 */
export function hasProperty(
  obj: Record<string, unknown>,
  prop: string
): boolean {
  return prop in obj;
}