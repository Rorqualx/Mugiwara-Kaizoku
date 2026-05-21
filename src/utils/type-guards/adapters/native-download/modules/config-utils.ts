/**
 * Configuration Type Guard Utilities
 *
 * Shared helper functions and validation utilities used across all
 * configuration type guard modules.
 *
 * Extracted from: config-types.ts
 */

// ============================================================================
// Property Validation Helpers
// ============================================================================

/**
 * Check if an object has a specific property
 */
export function hasProperty<T extends string>(
  obj: unknown,
  key: T
): obj is Record<T, unknown> {
  return obj !== null && obj !== undefined && typeof obj === 'object' && key in obj;
}

/**
 * Check if an optional property exists and passes validation
 */
export function isOptionalProperty<T>(
  obj: unknown,
  key: string,
  validator: (value: unknown) => value is T
): boolean {
  return !hasProperty(obj, key) || validator((obj as Record<string, unknown>)[key]);
}

/**
 * Check if a required property exists and passes validation
 */
export function isRequiredProperty<T>(
  obj: unknown,
  key: string,
  validator: (value: unknown) => value is T
): boolean {
  return hasProperty(obj, key) && validator((obj as Record<string, unknown>)[key]);
}

// ============================================================================
// Type Validators
// ============================================================================

/**
 * Check if value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Check if value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * Check if value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Check if value is a Date object or valid date string
 */
export function isDate(value: unknown): value is Date {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return !Number.isNaN(date.getTime());
  }
  return false;
}

/**
 * Check if value is an array of strings
 */
export function isArrayOfStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

/**
 * Check if value is an array of numbers
 */
export function isArrayOfNumbers(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(isNumber);
}

/**
 * Check if value is an array of booleans
 */
export function isArrayOfBooleans(value: unknown): value is boolean[] {
  return Array.isArray(value) && value.every(isBoolean);
}

/**
 * Check if value is an array of a specific type
 */
export function isArrayOfType<T>(
  value: unknown,
  validator: (item: unknown) => item is T
): value is T[] {
  return Array.isArray(value) && value.every(validator);
}

/**
 * Check if value is a record with string keys
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Check if value is a record with specific key-value types
 */
export function isRecordOfType<T>(
  value: unknown,
  validator: (item: unknown) => item is T
): value is Record<string, T> {
  if (!isRecord(value)) {
    return false;
  }
  
  return Object.values(value).every(validator);
}

// ============================================================================
// Complex Type Validators
// ============================================================================

/**
 * Check if value is a valid URL string
 */
export function isUrl(value: unknown): value is string {
  if (!isString(value)) {
    return false;
  }
  
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if value is a valid email string
 */
export function isEmail(value: unknown): value is string {
  if (!isString(value)) {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Check if value is a valid port number
 */
export function isPort(value: unknown): value is number {
  return isNumber(value) && value >= 1 && value <= 65535;
}

/**
 * Check if value is a valid hostname
 */
export function isHostname(value: unknown): value is string {
  if (!isString(value)) {
    return false;
  }
  
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return hostnameRegex.test(value) && value.length <= 253;
}

// ============================================================================
// Configuration-Specific Validators
// ============================================================================

/**
 * Check if value is a valid authentication type
 */
export function isAuthType(value: unknown): value is 'basic' | 'bearer' | 'none' {
  return isString(value) && ['basic', 'bearer', 'none'].includes(value);
}

/**
 * Check if value is a valid protocol
 */
export function isProtocol(value: unknown): value is 'http' | 'https' {
  return isString(value) && ['http', 'https'].includes(value);
}

/**
 * Check if value is a valid SSL verification option
 */
export function isSslVerification(value: unknown): value is boolean | 'strict' | 'none' {
  return isBoolean(value) || (isString(value) && ['strict', 'none'].includes(value));
}

/**
 * Check if value is a valid timeout value
 */
export function isTimeout(value: unknown): value is number {
  return isNumber(value) && value >= 0 && value <= 300000; // 5 minutes max
}

/**
 * Check if value is a valid retry count
 */
export function isRetryCount(value: unknown): value is number {
  return isNumber(value) && value >= 0 && value <= 10;
}

/**
 * Check if value is a valid priority value
 */
export function isPriority(value: unknown): value is number {
  return isNumber(value) && value >= 1 && value <= 10;
}

/**
 * Check if value is a valid sync interval
 */
export function isSyncInterval(value: unknown): value is number {
  return isNumber(value) && value >= 0 && value <= 1440; // 24 hours max
}

// ============================================================================
// Composite Validators
// ============================================================================

/**
 * Validate a configuration object with required and optional properties
 */
export function validateConfig<T>(
  candidate: unknown,
  required: Record<string, (value: unknown) => value is unknown>,
  optional: Record<string, (value: unknown) => value is unknown> = {}
): candidate is T {
  if (!isRecord(candidate)) {
    return false;
  }

  // Check required properties
  for (const [key, validator] of Object.entries(required)) {
    if (!isRequiredProperty(candidate, key, validator)) {
      return false;
    }
  }

  // Check optional properties (must be valid if present)
  for (const [key, validator] of Object.entries(optional)) {
    if (hasProperty(candidate, key) && !validator((candidate as Record<string, unknown>)[key])) {
      return false;
    }
  }

  return true;
}

/**
 * Validate an array configuration with item validation
 */
export function validateArrayConfig<T>(
  candidate: unknown,
  itemValidator: (value: unknown) => value is T
): candidate is T[] {
  return isArrayOfType(candidate, itemValidator);
}

/**
 * Validate a record configuration with value validation
 */
export function validateRecordConfig<T>(
  candidate: unknown,
  valueValidator: (value: unknown) => value is T
): candidate is Record<string, T> {
  return isRecordOfType(candidate, valueValidator);
}
