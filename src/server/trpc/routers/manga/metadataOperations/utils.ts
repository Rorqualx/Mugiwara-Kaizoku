/**
 * Metadata Operations Utilities
 *
 * Shared helper functions and type guards for metadata operations.
 * All modules import from this foundation module.
 *
 * Extracted from: metadataOperations.ts (lines 49-95)
 */

// ============================================================================
// Re-exported Types and Type Guards
// ============================================================================

// Types used across metadata operation modules
export type {
  RawProviderData,
  ProviderData,
  FandomData,
  PrismaContext,
  ProviderMetadataRecord,
  VolumeData,
  ChapterData,
} from '@/types/api/manga-router-types';

// Type guards used across metadata operation modules
export {
  isRawProviderData,
  isProviderMetadataRecord,
  isPrismaContext,
} from '@/types/api/manga-router-types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely access property on unknown object
 *
 * @param obj - The object to access
 * @param key - The property key to access
 * @returns The value at the key, or undefined if not accessible
 */
export function safeGet(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

/**
 * Type guard for objects
 *
 * @param value - The value to check
 * @returns True if value is a non-null object
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Safely get a string value from an unknown object
 *
 * @param obj - The object to access
 * @param key - The property key to access
 * @param defaultValue - Default value if property is not a string
 * @returns The string value or default
 */
export function safeGetString(obj: unknown, key: string, defaultValue: string = ''): string {
  const value = safeGet(obj, key);
  return typeof value === 'string' ? value : defaultValue;
}

/**
 * Safely get a number value from an unknown object
 *
 * @param obj - The object to access
 * @param key - The property key to access
 * @param defaultValue - Default value if property is not a number
 * @returns The number value or default
 */
export function safeGetNumber(obj: unknown, key: string, defaultValue: number = 0): number {
  const value = safeGet(obj, key);
  return typeof value === 'number' ? value : defaultValue;
}

/**
 * Safely get a string value or undefined (for use with ??)
 *
 * @param obj - The object to access
 * @param key - The property key to access
 * @returns The string value if non-empty, or undefined
 */
export function safeGetStringOptional(obj: unknown, key: string): string | undefined {
  const value = safeGet(obj, key);
  if (typeof value === 'string' && value !== '') {
    return value;
  }
  return undefined;
}

/**
 * Convert unknown error to Error instance
 *
 * Standardizes error handling across metadata operations by ensuring
 * all errors are wrapped in Error instances.
 *
 * @param error - The unknown error value
 * @returns An Error instance
 */
export function handleError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}
