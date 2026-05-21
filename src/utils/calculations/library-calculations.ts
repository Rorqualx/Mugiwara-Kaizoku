/**
 * Library Size Calculation Utilities
 *
 * Provides optimized functions for calculating library and manga sizes.
 * These utilities are designed to work with the LibraryWithRelations type
 * and handle various data structures for chapter sizes.
 */

import type { LibraryWithRelations, MangaWithRelations } from '@/types/search.types';

/**
 * Calculates the total size of all chapters in a library
 *
 * Aggregates the size of all chapters across all manga in the library.
 * Chapter sizes are guaranteed to be defined (default: 0) from Prisma schema.
 *
 * @param library - The library with its related manga and chapters
 * @returns The total size in bytes of all chapters in the library
 */
export function calculateLibrarySize(library: LibraryWithRelations): number {
  if (library['Manga'].length === 0) {
    return 0;
  }

  return library['Manga'].reduce((sum: number, manga) => {
    const mangaSize = calculateMangaSize(manga);
    return sum + mangaSize;
  }, 0 as number);
}

/**
 * Calculates the total size of all chapters in a manga
 *
 * @param manga - The manga with its chapters
 * @returns The total size in bytes of all chapters
 */
export function calculateMangaSize(manga: MangaWithRelations): number {
  if (manga["Chapter"].length === 0) {
    return 0;
  }

  type ChapterType = MangaWithRelations['Chapter'][number];

  return manga["Chapter"].reduce((sum: number, chapter: ChapterType) => {
    // chapter.size is always defined (defaults to 0 in Prisma schema)
    return sum + chapter.size;
  }, 0);
}

/**
 * Calculates sizes for multiple libraries efficiently
 *
 * @param libraries - Array of libraries to calculate sizes for
 * @returns A map of library ID to total size
 */
export function calculateLibrarySizes(libraries: LibraryWithRelations[]): Map<string | number, number> {
  const sizes = new Map<string | number, number>();

  libraries.forEach(library => {
    sizes.set(library["id"], calculateLibrarySize(library));
  });

  return sizes;
}

/**
 * Gets the size of a specific chapter from MangaWithRelations
 *
 * @param chapter - The chapter object from Prisma
 * @returns The size in bytes (always defined, defaults to 0)
 */
export function getChapterSize(chapter: MangaWithRelations['Chapter'][number]): number {
  return chapter.size;
}