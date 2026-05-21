/**
 * URL Parsing Utilities Module
 *
 * Shared helper functions, type definitions, and interfaces
 * used across all URL parsing modules.
 *
 * Extracted from: urlParsingService.ts (lines 11-29)
 */

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely access property on unknown object
 *
 * @param obj - Object to access property from
 * @param key - Property key to access
 * @returns The property value if found, undefined otherwise
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
 * @param value - Value to check
 * @returns True if value is a non-null object
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Configuration interface for URL parsing service
 *
 * Contains mutation hooks for various metadata providers.
 */
export interface UrlParsingServiceConfig {
  parseUrlMutation: unknown;
  fetchAnilistMutation: unknown;
  fetchFandomMutation: unknown;
  parseFandomUrlMutation: unknown;
  fetchComicvineMutation: unknown;
}
