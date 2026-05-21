/**
 * Metadata Sanitization Utilities
 *
 * Helper functions for sanitizing and normalizing metadata values.
 * Extracted from validation-service.ts to reduce complexity.
 */

/**
 * Sanitize string value
 */
export function sanitizeString(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Sanitize string array
 */
export function sanitizeStringArray(array: unknown[]): string[] {
  return array
    .filter(item => typeof item === 'string')
    .map(item => sanitizeString(item as string))
    .filter(item => item.length > 0);
}

/**
 * Sanitize number value
 */
export function sanitizeNumber(value: unknown): number | null {
  if (value === null) return null;
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) return null;
  return num;
}

/**
 * Sanitize score value (0-100 range)
 */
export function sanitizeScore(value: unknown): number | null {
  const num = sanitizeNumber(value);
  if (num === null) return null;
  return Math.max(0, Math.min(100, num));
}

/**
 * Sanitize year value
 */
export function sanitizeYear(value: unknown): number | null {
  const num = sanitizeNumber(value);
  if (num === null) return null;
  // Check for reasonable year range
  const currentYear = new Date().getFullYear();
  if (num < 1900 || num > currentYear + 10) {
    return null;
  }
  return num;
}

/**
 * Sanitize date value
 */
export function sanitizeDate(value: unknown): Date | null {
  if (value === null) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/**
 * Sanitize enum value
 */
export function sanitizeEnum<T extends Record<string, string>>(
  value: unknown,
  enumType: T
): T[keyof T] | undefined {
  if (typeof value !== 'string') return undefined;
  const enumValues = Object.values(enumType);
  if (enumValues.includes(value)) {
    return value as T[keyof T];
  }
  // Try case-insensitive match
  const upperValue = value.toUpperCase();
  const match = enumValues.find(v => v.toUpperCase() === upperValue);
  return match as T[keyof T] | undefined;
}
