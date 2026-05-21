/**
 * Type guards for manga components
 * Eliminates unsafe double casts by providing type-safe conversions
 */

import type { MangaWithRelations } from '@/types/manga-page-types';

import type { Manga, Chapter, Library, Metadata } from '@prisma/client';

/**
 * Type guard to check if an object is MangaWithRelations
 */
export function isMangaWithRelations(obj: unknown): obj is MangaWithRelations {
  if (!obj || typeof obj !== 'object') return false;

  const manga = obj as Record<string, unknown>;

  return (
    typeof manga['id'] === 'number' &&
    typeof manga['title'] === 'string' &&
    (manga['library'] === null || typeof manga['library'] === 'object') &&
    Array.isArray(manga['chapters'])
  );
}

/**
 * Safely converts unknown to MangaWithRelations
 * Returns undefined if conversion fails
 */
export function toMangaWithRelations(obj: unknown): MangaWithRelations | undefined {
  if (isMangaWithRelations(obj)) {
    return obj;
  }
  return undefined;
}

/**
 * Type for manga with chapters
 */
export interface MangaWithChapters extends Manga {
  chapters?: Chapter[];
  metadata?: Metadata | null;
  library?: Library;
}

/**
 * Type guard for MangaWithChapters
 */
export function isMangaWithChapters(obj: unknown): obj is MangaWithChapters {
  if (!obj || typeof obj !== 'object') return false;

  const manga = obj as Record<string, unknown>;

  return (
    typeof manga['id'] === 'number' &&
    typeof manga['title'] === 'string' &&
    (manga['chapters'] === null || Array.isArray(manga['chapters']))
  );
}

/**
 * Safely converts array to MangaWithChapters[]
 */
export function toMangaWithChaptersArray(arr: unknown): MangaWithChapters[] {
  if (!Array.isArray(arr)) return [];

  return arr.filter(isMangaWithChapters);
}
