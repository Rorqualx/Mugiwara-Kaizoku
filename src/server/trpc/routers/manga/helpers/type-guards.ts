/**
 * Manga Router Type Guards and Safe Getters
 *
 * Type guard functions and safe property accessors for handling
 * unknown data from various manga providers.
 *
 * Extracted from: helpers.ts (lines 240-343)
 */

import { DEFAULT_CHAPTER_LIMIT } from './types';

import type { MangaSearchResult } from './types';

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if an unknown object is MangaSearchResult-like
 */
export function isMangaLike(item: unknown): item is Partial<MangaSearchResult> {
  return item !== null && typeof item === 'object';
}

/**
 * Type guard for objects
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// ============================================================================
// Safe Getters
// ============================================================================

/**
 * Helper function to safely access properties on unknown objects
 */
export function safeGet(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

/**
 * Helper function to safely get a string value from an unknown object
 */
export function safeGetString(obj: unknown, key: string, defaultValue: string = ''): string {
  const value = safeGet(obj, key);
  return typeof value === 'string' ? value : defaultValue;
}

/**
 * Helper function to safely get a number value from an unknown object
 */
export function safeGetNumber(obj: unknown, key: string, defaultValue: number = 0): number {
  const value = safeGet(obj, key);
  return typeof value === 'number' ? value : defaultValue;
}

/**
 * Helper function to safely get a string value or undefined (for use with ??)
 */
export function safeGetStringOptional(obj: unknown, key: string): string | undefined {
  const value = safeGet(obj, key);
  if (typeof value === 'string' && value !== '') {
    return value;
  }
  return undefined;
}

/**
 * Helper function to safely parse a number from unknown value
 */
export function parseNumber(value: unknown, defaultValue: number): number {
  if (typeof value === 'number') {
    return value;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

// ============================================================================
// Relation Helpers
// ============================================================================

/**
 * Create manga relations include with optional chapter limit
 */
export function createMangaRelations(chapterLimit?: number): {
  Library: boolean;
  Chapter: { orderBy: { index: 'asc' }; take?: number };
  Metadata: boolean;
  _count: { select: { Chapter: boolean } };
} {
  return {
    Library: true,
    Chapter: {
      orderBy: {
        index: 'asc' as const
      },
      ...(chapterLimit && chapterLimit > 0 ? { take: chapterLimit } : {})
    },
    Metadata: true,
    _count: {
      select: {
        Chapter: true
      }
    }
  } as const;
}

/**
 * Default relations with standard limit
 */
export const includeMangaRelations = createMangaRelations(DEFAULT_CHAPTER_LIMIT);
