import { ChapterStatus } from '@prisma/client';

import { toNumberId } from "./id-converters";
/**
 * Utility functions for chapter management
 * 
 * This module provides functions for:
 * - Formatting chapter titles consistently
 * - Creating chapter database entries from local files
 * - Handling chapter metadata and relationships
 * 
 * The utilities handle various edge cases and provide consistent
 * chapter formatting across the application.
 * 
 * @module chapter
 */

import type { ChapterCreateInput } from '../types/chapter-metadata';
import type { ChapterFromLocal } from './client/frontendHelpers';
import type { Manga as MangaEntity } from '@prisma/client';

/**
 * Formats a chapter title based on its index
 * 
 * Generates a standardized chapter title format using a zero-based index.
 * This ensures consistent chapter naming throughout the application.
 * 
 * Edge Cases:
 * - Handles zero-based indexing (adds 1 for display)
 * - Safe for any numeric index value
 * 
 * @param {number} index - The zero-based index of the chapter
 * @returns {string} Formatted chapter title (e.g., "Chapter 1" for index 0)
 * 
 * @example
 * ```typescript
 * // Basic usage
 * formatChapterTitle(0);  // returns "Chapter 1"
 * formatChapterTitle(9);  // returns "Chapter 10"
 * 
 * // With large numbers
 * formatChapterTitle(999);  // returns "Chapter 1000"
 * 
 * // With negative numbers (though not recommended)
 * formatChapterTitle(-1);  // returns "Chapter 0"
 * ```
 */
export function formatChapterTitle(index: number): string {
  return `Chapter ${index + 1}`;
}

/**
 * Creates a chapter database input object from local file information
 * 
 * This function transforms local chapter information into a format suitable
 * for database insertion. It handles:
 * - Title formatting
 * - Default values
 * - Manga relationship connections
 * 
 * Error Handling:
 * - Provides defaults for missing index (0)
 * - Provides defaults for missing size (0)
 * - Uses formatted title if original title is missing
 * - Ensures valid manga connection
 *
 * @param {ChapterFromLocal} localChapter - Local chapter information from the filesystem
 * @param {Pick<MangaEntity, 'id'>} manga - Manga object or object containing manga ID
 * @returns {ChapterCreateInput} Chapter object ready for database insertion
 * 
 * @example
 * ```typescript
 * // Creating a chapter with complete information
 * const chapter = createChapterFromLocal({
 *   fileName: "chapter_001.cbz",
 *   title: "The Beginning",
 *   index: 0,
 *   size: 1024000
 * }, { id: 1 });
 * 
 * // Creating a chapter with minimal information
 * const minimalChapter = createChapterFromLocal({
 *   fileName: "chapter.cbz"
 * }, { id: 1 });
 * 
 * // Creating a chapter with custom title
 * const customChapter = createChapterFromLocal({
 *   fileName: "special_chapter.cbz",
 *   title: "Special: Summer Festival",
 *   index: 5,
 *   size: 2048000
 * }, { id: 1 });
 * ```
 */
export function createChapterFromLocal(localChapter: ChapterFromLocal, manga: Pick<MangaEntity, 'id'>): ChapterCreateInput {
  // Use provided title or generate one from index
  const title: string = localChapter["title"] ?? formatChapterTitle(localChapter.index);
  const result: ChapterCreateInput = {
    fileName: localChapter.fileName,
    index: localChapter.index,
    size: localChapter.size,
    mangaId: typeof manga["id"] === 'string' ? toNumberId(manga["id"]) : manga["id"],
    // Convert ID to number
    title,
    downloadStatus: ChapterStatus.PENDING // Add required downloadStatus field
  };
  return result;
}