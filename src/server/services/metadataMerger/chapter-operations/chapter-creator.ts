/**
 * Chapter Creator
 *
 * Database operations for creating chapters from extracted metadata.
 * Handles batch creation and proper updatedAt timestamps for Prisma.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import { isRecord, getUnknownProperty } from '../utils';

import type { ExtractedChapter } from './types';
import type { Prisma } from '@prisma/client';

/**
 * Create chapters in database from extracted chapter data
 *
 * Deletes existing chapters and creates new ones in batches.
 * Uses reduce pattern for sequential batch processing (ESLint no-await-in-loop compliance).
 *
 * @param mangaId - Database manga ID
 * @param chapterData - Array of extracted chapter data
 * @returns True if chapters were created successfully
 */
export async function createChaptersInDatabase(
  mangaId: number,
  chapterData: ExtractedChapter[]
): Promise<boolean> {
  if (chapterData.length === 0) {
    logger.info('No chapter data to create');
    return false;
  }

  logger.info(`[DEBUG] Starting chapter recreation for ${chapterData.length} chapters`);
  logger.info(`Recreating ${chapterData.length} chapters with detailed information`);

  try {
    // Delete existing chapters
    logger.info(`[DEBUG] Deleting existing chapters for manga ${mangaId}`);
    await prisma.chapter.deleteMany({
      where: { mangaId: mangaId }
    });
    logger.info('Deleted existing chapters');

    // Build chapter objects for creation
    logger.info('[DEBUG] Building chapter objects for creation');
    const chaptersToCreate = buildChapterObjects(mangaId, chapterData);

    // Create chapters in batches
    logger.info(`[DEBUG] Prepared ${chaptersToCreate.length} chapters for database insertion`);
    await createChaptersInBatches(chaptersToCreate);

    logger.info(`[DEBUG] All ${chaptersToCreate.length} chapters created successfully`);
    logger.info(`Successfully created ${chaptersToCreate.length} chapters with detailed information`);
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('[DEBUG] Error recreating chapters:', { errorMessage, errorStack });
    logger.error(`Error recreating chapters: ${errorMessage}`);
    return false;
  }
}

/**
 * Build chapter objects for Prisma creation
 */
function buildChapterObjects(
  mangaId: number,
  chapterData: ExtractedChapter[]
): Prisma.ChapterCreateManyInput[] {
  const chaptersToCreate: Prisma.ChapterCreateManyInput[] = [];

  for (let i = 0; i < chapterData.length; i++) {
    const chapter = chapterData[i];

    if (!isRecord(chapter)) {
      logger.warn(`[DEBUG] Skipping non-record chapter at index ${i}`);
      continue;
    }

    // Use the volumeNumber from the chapter data if available
    // For ComicVine, this is already set correctly per issue
    // For other providers, it should be included in the chapter data
    const volumeNumber = Number(getUnknownProperty(chapter, 'volumeNumber')) || Math.ceil((i + 1) / 10);
    const chapterNumber = getUnknownProperty(chapter, 'chapterNumber');

    const alternativeTitles = getUnknownProperty(chapter, 'alternativeTitles');
    const pages = getUnknownProperty(chapter, 'pages');
    const releaseDate = getUnknownProperty(chapter, 'releaseDate');

    chaptersToCreate.push({
      mangaId: mangaId,
      title: String(getUnknownProperty(chapter, 'title') ?? ''),
      alternativeTitles: Array.isArray(alternativeTitles) ? alternativeTitles as string[] : [],
      index: i + 1,
      chapterNumber: chapterNumber ? Number(chapterNumber) : null,
      fileName: `v${volumeNumber.toString().padStart(2, '0')}-c${(i + 1).toString().padStart(3, '0')}.cbz`,
      size: 0,
      downloadStatus: 'PENDING',
      volume: volumeNumber,
      coverImage: (typeof getUnknownProperty(chapter, 'coverImage') === 'string'
        ? getUnknownProperty(chapter, 'coverImage')
        : null) as string | null,
      description: (typeof getUnknownProperty(chapter, 'description') === 'string'
        ? getUnknownProperty(chapter, 'description')
        : null) as string | null,
      pageCount: pages ? Number(pages) : null,
      releaseDate: releaseDate ? new Date(String(releaseDate)) : null,
      downloadUrl: (getUnknownProperty(chapter, 'downloadUrl') ?? getUnknownProperty(chapter, 'url')) as string | null,
      // CRITICAL: Must explicitly set updatedAt for createMany (Prisma doesn't auto-populate @updatedAt in batch inserts)
      updatedAt: new Date()
    });
  }

  return chaptersToCreate;
}

/**
 * Create chapters in batches using reduce pattern
 */
async function createChaptersInBatches(
  chaptersToCreate: Prisma.ChapterCreateManyInput[]
): Promise<void> {
  const batchSize = 50;

  // Prepare batches array to avoid await-in-loop
  const batches: Array<{ data: Prisma.ChapterCreateManyInput[]; num: number }> = [];
  for (let i = 0; i < chaptersToCreate.length; i += batchSize) {
    batches.push({
      data: chaptersToCreate.slice(i, i + batchSize),
      num: Math.floor(i / batchSize) + 1
    });
  }

  logger.info(`[DEBUG] Creating ${chaptersToCreate.length} chapters in ${batches.length} batches of ${batchSize}`);

  // Process batches sequentially using reduce pattern to satisfy ESLint no-await-in-loop
  await batches.reduce(
    (prev, { data, num }) => prev.then(async () => {
      logger.info(`[DEBUG] Inserting batch ${num}/${batches.length} (${data.length} chapters)`);
      await prisma.chapter.createMany({ data, skipDuplicates: true });
      logger.info(`[DEBUG] Batch ${num}/${batches.length} inserted successfully`);
    }),
    Promise.resolve()
  );
}
