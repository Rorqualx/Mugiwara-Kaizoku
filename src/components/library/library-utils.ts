/**
 * Library Utility Functions
 *
 * Helper functions for library size calculations and formatting.
 * Extracted from ResponsiveLibraryList for better maintainability.
 *
 * @module components/library/library-utils
 */
import type { LibraryWithRelations } from '@/types/search.types';

/**
 * Calculate the total size of a library by summing all chapter sizes
 *
 * @param library - The library with manga and chapter relations
 * @returns Total size in bytes
 */
export function calculateLibrarySize(library: LibraryWithRelations): number {
  return library.Manga.reduce((sum: number, manga) => {
    const mangaSize = manga.Chapter.reduce((chSum: number, chapter) => {
      const size = chapter.size;
      return chSum + (typeof size === 'number' ? size : 0);
    }, 0);
    return sum + mangaSize;
  }, 0);
}

/**
 * Calculate sizes for multiple libraries at once
 * Useful for batch calculations to avoid repeated iterations
 *
 * @param libraries - Array of libraries to calculate sizes for
 * @returns Record mapping library ID to total size in bytes
 */
export function calculateLibrarySizes(
  libraries: LibraryWithRelations[]
): Record<string | number, number> {
  const sizes: Record<string | number, number> = {};
  libraries.forEach(library => {
    sizes[library.id] = calculateLibrarySize(library);
  });
  return sizes;
}
