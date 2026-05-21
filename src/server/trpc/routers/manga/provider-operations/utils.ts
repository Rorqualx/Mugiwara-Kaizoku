/**
 * Provider Operations Utilities Module
 *
 * Shared helper functions, type definitions, and validation schemas
 * used across all provider operation modules.
 *
 * Extracted from: providerOperations.ts (lines 1-147)
 */

import { z } from 'zod';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper function to safely access properties on unknown objects
 * @param obj - The object to access
 * @param key - The property key to retrieve
 * @returns The value at the key, or undefined if not accessible
 */
export function safeGet(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

/**
 * Helper function to safely get a string value from an unknown object
 * @param obj - The object to access
 * @param key - The property key to retrieve
 * @param defaultValue - The default value if not a string (defaults to '')
 * @returns The string value or the default
 */
export function safeGetString(obj: unknown, key: string, defaultValue: string = ''): string {
  const value = safeGet(obj, key);
  return typeof value === 'string' ? value : defaultValue;
}


/**
 * Helper function to safely get a string value or undefined (for use with ??)
 * @param obj - The object to access
 * @param key - The property key to retrieve
 * @returns The string value or undefined if not a non-empty string
 */
export function safeGetStringOptional(obj: unknown, key: string): string | undefined {
  const value = safeGet(obj, key);
  if (typeof value === 'string' && value !== '') {
    return value;
  }
  return undefined;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for checking if a value is a record object
 * @param value - The value to check
 * @returns True if the value is a non-null object
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Type guard to check if an unknown object is MangaSearchResult-like
 * @param item - The item to check
 * @returns True if the item is a non-null object (partial MangaSearchResult)
 */
export function isMangaLike(item: unknown): item is Partial<MangaSearchResult> {
  return item !== null && typeof item === 'object';
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Interface for search result items returned by providers
 */
export interface MangaSearchResult {
  id?: string;
  title?: string;
  cover?: string;
  coverImage?: string;
  description?: string;
  status?: string;
  alternativeTitles?: string[];
  score?: number;
  popularity?: number;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  genres?: string[];
}

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Schema for provider confirmation search
 */
export const providerConfirmationSearchSchema = z.object({
  title: z.string(),
  providers: z.array(z.string())
});

/**
 * Schema for binding manga to AniList (legacy)
 */
export const bindSchema = z.object({
  mangaId: z.number(),
  anilistId: z.string(),
  title: z.string(),
  detail: z.string()
});

/**
 * Schema for binding manga to a generic provider
 */
export const bindProviderSchema = z.object({
  mangaId: z.number(),
  provider: z.enum(['comicvine', 'fandom', 'wikipedia', 'anilist', 'mangadex']),
  providerId: z.string(),
  fetchMetadata: z.boolean().optional().default(true)
});

/**
 * Schema for merging metadata from multiple providers
 */
export const mergeMetadataFromProvidersSchema = z.object({
  mangaId: z.number(),
  fieldSelections: z.array(z.object({
    field: z.string(),
    provider: z.string(),
    value: z.unknown()
  }))
});

/**
 * Schema for updating provider preferences
 */
export const updateProviderPreferencesSchema = z.object({
  id: z.number(),
  preferences: z.record(z.object({
    provider: z.string(),
    value: z.unknown()
  }))
});
