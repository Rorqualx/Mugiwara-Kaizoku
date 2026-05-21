/**
 * Generic Chapter Creation
 *
 * Creates placeholder chapters from counts or arrays.
 * Provides flexible chapter creation for various data sources.
 */

import { isPrismaContext } from '@/types/api/manga-router-types';
import { logger } from '@/utils/logger';

import { safeGetNumber, safeGetString, safeGetStringOptional, isRecord, truncateString } from './helpers';

// Database column limits (VARCHAR(255))
const MAX_TITLE_LENGTH = 255;
const MAX_FILENAME_LENGTH = 255;

import type { ChapterToCreate } from './types';

/** Check if a title is likely English using language tag + content heuristics */
function isLikelyEnglishTitle(title: string, language?: string): boolean {
  if (!title) return false;
  if (language && language !== 'en') return false;
  // Reject accented characters common in French/other European languages
  if (/[àâãäåçéèêëìíîïñòóôõöùúûüýÿœæ]/i.test(title)) return false;
  // Reject CJK characters
  if (/[\u3000-\u9FFF\uAC00-\uD7AF]/.test(title)) return false;
  return true;
}

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
  const volumes = volumeCount ?? Math.ceil(chapterCount / 10);
  const chaptersPerVolume = Math.ceil(chapterCount / volumes);
  const batchSize = 50;
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
    if (chapters.length === batchSize || i === chapterCount) {
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

/** Try multiple keys, returning the first non-zero number or null */
function getFirstValidNumber(obj: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const val = safeGetNumber(obj, key);
    if (val !== 0) return val;
  }
  return null;
}

/** Build a single chapter record from a raw chapter object */
function buildChapterRecord(chapter: Record<string, unknown>, index: number, mangaId: number): ChapterToCreate {
  const chapterNum = getFirstValidNumber(chapter, 'chapterNumber', 'number') ?? (index + 1);
  const indexNum = getFirstValidNumber(chapter, 'index') ?? (index + 1);
  const volumeNum = getFirstValidNumber(chapter, 'volume', 'volumeNumber');

  const language = (chapter['language'] ?? chapter['translatedLanguage']) as string | undefined;
  const candidateTitle = safeGetStringOptional(chapter, 'title') ?? safeGetStringOptional(chapter, 'name');
  const titleIsEnglish = candidateTitle && isLikelyEnglishTitle(candidateTitle, language);
  const rawTitle = titleIsEnglish ? candidateTitle : `Chapter ${chapterNum}`;
  const rawFileName = safeGetString(chapter, 'fileName', `chapter-${chapterNum}.cbz`);

  return {
    mangaId,
    fileName: truncateString(rawFileName, MAX_FILENAME_LENGTH),
    index: indexNum,
    chapterNumber: chapterNum,
    title: truncateString(rawTitle, MAX_TITLE_LENGTH),
    alternativeTitles: [],
    size: safeGetNumber(chapter, 'size', 0),
    downloadStatus: 'PENDING' as const,
    volume: volumeNum,
    releaseDate: null,
    downloadUrl: safeGetStringOptional(chapter, 'url') ?? safeGetStringOptional(chapter, 'downloadUrl') ?? null,
    coverImage: safeGetStringOptional(chapter, 'coverUrl') ?? safeGetStringOptional(chapter, 'cover') ?? safeGetStringOptional(chapter, 'coverImage') ?? null,
    description: safeGetStringOptional(chapter, 'description') ?? safeGetStringOptional(chapter, 'summary') ?? null,
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
  const batchSize = 50;
  const chapters: ChapterToCreate[] = [];

  // Sequential batching is intentional to avoid overwhelming the database with concurrent inserts
  for (let i = 0; i < chapterData.length; i++) {
    const chapter = chapterData[i];
    if (!isRecord(chapter)) continue;

    chapters.push(buildChapterRecord(chapter, i, mangaId));

    // Create batch when size reached or at the end
    if (chapters.length === batchSize || i === chapterData.length - 1) {
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
