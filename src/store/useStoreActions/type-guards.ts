/**
 * Type Guards Module
 *
 * Type guard functions for runtime validation.
 * Split from monolithic validator to reduce cyclomatic complexity.
 *
 * Extracted from: useStoreActions.ts (lines 200-267)
 */

/**
 * Valid metadata type for manga updates
 */
export interface ValidMetadata {
  title?: string;
  status?: string;
  coverUrl?: string;
  description?: string;
  authors?: string[];
  genres?: string[];
  tags?: string[];
  chapters?: number;
  volumes?: number;
}

/**
 * Check if value is a Record object
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Validate optional string field
 */
function isStringOrNull(value: unknown): boolean {
  return value === null || value === undefined || typeof value === 'string';
}

/**
 * Validate optional number field
 */
function isNumberOrNull(value: unknown): boolean {
  return value === null || value === undefined || typeof value === 'number';
}

/**
 * Validate optional array field
 */
function isArrayOrNull(value: unknown): boolean {
  return value === null || value === undefined || Array.isArray(value);
}

/**
 * Validate metadata object structure
 *
 * Checks that all fields (if present) have correct types.
 * Uses helper validators to keep complexity under 20.
 */
export function isValidMetadata(obj: unknown): obj is ValidMetadata {
  if (!isRecord(obj)) {
    return false;
  }

  // Validate string fields
  const stringFields = ['title', 'status', 'coverUrl', 'description'] as const;
  for (const field of stringFields) {
    if (field in obj && !isStringOrNull(obj[field])) {
      return false;
    }
  }

  // Validate array fields
  const arrayFields = ['authors', 'genres', 'tags'] as const;
  for (const field of arrayFields) {
    if (field in obj && !isArrayOrNull(obj[field])) {
      return false;
    }
  }

  // Validate number fields
  const numberFields = ['chapters', 'volumes'] as const;
  for (const field of numberFields) {
    if (field in obj && !isNumberOrNull(obj[field])) {
      return false;
    }
  }

  return true;
}
