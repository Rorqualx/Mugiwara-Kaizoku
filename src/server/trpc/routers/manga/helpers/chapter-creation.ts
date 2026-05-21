/**
 * Manga Router Chapter Creation
 *
 * Functions for creating generic placeholder chapters and chapters
 * from array data.
 *
 * Extracted from: helpers.ts (lines 736-838)
 */

import { isPrismaContext } from '@/types/api/manga-router-types';
import { logger } from '@/utils/logger';

import {
  isRecord,
  safeGetNumber,
  safeGetString,
  safeGetStringOptional
} from './type-guards';

import type { ChapterToCreate } from './types';


// ============================================================================
// Constants
// ============================================================================

/**
 * Batch size for database operations
 * Balances performance with database resource usage
 */
const BATCH_SIZE = 50;

/**
 * Default chapters per volume when volume count is not specified
 */
const DEFAULT_CHAPTERS_PER_VOLUME = 10;

// ============================================================================
// Internal Helper Functions
// ============================================================================

/**
 * Create placeholder chapters from a count
 *
 * Generates sequential placeholder chapters distributed across volumes.
 * Useful when only the chapter count is known without detailed metadata.
 *
 * @param context - Prisma context for database operations
 * @param mangaId - ID of the manga to associate chapters with
 * @param chapterCount - Number of chapters to create
 * @param volumeCount - Optional volume count for distribution
 */
async function createPlaceholderChaptersFromCount(
  context: unknown,
  mangaId: number,
  chapterCount: number,
  volumeCount?: number | null
): Promise<void> {
  logger.info(`Creating ${chapterCount} placeholder chapters for manga`);
  const volumes = volumeCount ?? Math.ceil(chapterCount / DEFAULT_CHAPTERS_PER_VOLUME);
  const chaptersPerVolume = Math.ceil(chapterCount / volumes);
  const chapters: ChapterToCreate[] = [];

  // Sequential batching is intentional to avoid overwhelming the database with concurrent inserts
  for (let i = 1; i <= chapterCount; i++) {
    const volumeNumber = Math.ceil(i / chaptersPerVolume);
    chapters.push({
      mangaId,
      fileName: `v${volumeNumber.toString().padStart(2, '0')}-c${i.toString().padStart(3, '0')}.cbz`,
      index: i,
      chapterNumber: i,
      title: `Chapter ${i}`,
      alternativeTitles: [],
      size: 0,
      downloadStatus: 'PENDING' as const,
      volume: volumeNumber,
      downloadUrl: null,
      coverImage: null,
      description: null,
      releaseDate: null,
      pageCount: null,
      monitored: true,
      updatedAt: new Date()
    });

    // Create batch when size reached or at the end
    if (chapters.length === BATCH_SIZE || i === chapterCount) {
      if (isPrismaContext(context)) {
        // eslint-disable-next-line no-await-in-loop
        await context.prisma.chapter.createMany({
          data: chapters,
          skipDuplicates: true,
        });
      }
      logger.debug(`Created chapters ${i - chapters.length + 1} to ${i}`);
      chapters.length = 0; // Clear for next batch
    }
  }
  logger.info(`Successfully created ${chapterCount} placeholder chapters`);
}

/**
 * Build a single chapter object from raw chapter data
 *
 * Extracts and normalizes chapter properties from various naming conventions.
 *
 * @param chapter - Raw chapter data object
 * @param mangaId - ID of the manga to associate chapter with
 * @param arrayIndex - Index position in the source array
 * @returns Normalized chapter object ready for database insertion
 */
function buildChapterFromData(
  chapter: Record<string, unknown>,
  mangaId: number,
  arrayIndex: number
): ChapterToCreate {
  const chapterNum = safeGetNumber(chapter, 'chapterNumber') ||
    safeGetNumber(chapter, 'number') ||
    (arrayIndex + 1);
  const indexNum = safeGetNumber(chapter, 'index') || (arrayIndex + 1);
  const volumeNum = safeGetNumber(chapter, 'volume') ||
    safeGetNumber(chapter, 'volumeNumber') ||
    null;

  return {
    mangaId,
    fileName: safeGetString(chapter, 'fileName', `chapter-${chapterNum}.cbz`),
    index: indexNum,
    chapterNumber: chapterNum,
    title: safeGetStringOptional(chapter, 'title') ??
      safeGetStringOptional(chapter, 'name') ??
      `Chapter ${chapterNum}`,
    alternativeTitles: [],
    size: safeGetNumber(chapter, 'size', 0),
    downloadStatus: 'PENDING' as const,
    volume: volumeNum,
    releaseDate: null,
    downloadUrl: safeGetStringOptional(chapter, 'url') ??
      safeGetStringOptional(chapter, 'downloadUrl') ??
      null,
    coverImage: safeGetStringOptional(chapter, 'coverUrl') ??
      safeGetStringOptional(chapter, 'cover') ??
      safeGetStringOptional(chapter, 'coverImage') ??
      null,
    description: safeGetStringOptional(chapter, 'description') ??
      safeGetStringOptional(chapter, 'summary') ??
      null,
    pageCount: null,
    monitored: true,
    updatedAt: new Date()
  };
}

/**
 * Create chapters from an array of chapter objects
 *
 * Processes an array of chapter objects with flexible property names.
 * Handles various naming conventions (chapterNumber/number, title/name, etc.).
 *
 * @param context - Prisma context for database operations
 * @param mangaId - ID of the manga to associate chapters with
 * @param chapterData - Array of chapter objects
 */
async function createChaptersFromArray(
  context: unknown,
  mangaId: number,
  chapterData: unknown[]
): Promise<void> {
  logger.info(`Creating ${chapterData.length} chapters from provided data`);
  const chapters: ChapterToCreate[] = [];

  // Sequential batching is intentional to avoid overwhelming the database with concurrent inserts
  for (let i = 0; i < chapterData.length; i++) {
    const chapter = chapterData[i];
    if (!isRecord(chapter)) continue;

    chapters.push(buildChapterFromData(chapter, mangaId, i));

    // Create batch when size reached or at the end
    if (chapters.length === BATCH_SIZE || i === chapterData.length - 1) {
      if (isPrismaContext(context)) {
        // eslint-disable-next-line no-await-in-loop
        await context.prisma.chapter.createMany({
          data: chapters,
          skipDuplicates: true,
        });
      }
      logger.debug(`Created batch of ${chapters.length} chapters`);
      chapters.length = 0; // Clear for next batch
    }
  }
  logger.info(`Successfully created ${chapterData.length} chapters from data`);
}

// ============================================================================
// Exported Functions
// ============================================================================

/**
 * Create generic placeholder chapters from count or array
 *
 * Handles two scenarios:
 * 1. Creating placeholder chapters from a simple count (e.g., 50 chapters)
 * 2. Creating chapters from a generic array of chapter objects
 *
 * @param context - Prisma context for database operations
 * @param mangaId - ID of the manga to associate chapters with
 * @param chapterData - Either a number (count) or array of chapter objects
 * @param volumeCount - Optional volume count for distributing chapters
 */
export async function createGenericChapters(
  context: unknown,
  mangaId: number,
  chapterData: number | unknown[],
  volumeCount?: number | null
): Promise<void> {
  if (typeof chapterData === 'number') {
    await createPlaceholderChaptersFromCount(context, mangaId, chapterData, volumeCount);
  } else if (Array.isArray(chapterData)) {
    await createChaptersFromArray(context, mangaId, chapterData);
  }
}
