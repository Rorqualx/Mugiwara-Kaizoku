/**
 * Chapter Database Operations
 *
 * Database operations for batch chapter creation.
 */

import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { isPrismaContext } from '@/types/api/manga-router-types';
import { logger } from '@/utils/logger';

import { isRecord } from './helpers';

import type { ChapterToCreate } from './types';

/**
 * Create chapters in database in batches
 */
export async function batchCreateChaptersInDatabase(
  context: unknown,
  chapters: ChapterToCreate[]
): Promise<void> {
  const batchSize = 50;
  let mangaId: number | undefined;

  // Deduplicate by (mangaId, chapterNumber) before inserting
  const seen = new Set<string>();
  const deduped = chapters.filter(ch => {
    const key = `${ch.mangaId}:${ch.chapterNumber}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (deduped.length < chapters.length) {
    logger.info(`[batchCreateChapters] Deduped ${chapters.length - deduped.length} duplicate chapters`);
  }

  for (let i = 0; i < deduped.length; i += batchSize) {
    const batch = deduped.slice(i, i + batchSize);
    logger.info(`[batchCreateChapters] Creating batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(deduped.length/batchSize)}: ${batch.length} chapters`);
    if (isPrismaContext(context)) {
      // Capture mangaId from first chapter for event emission
      mangaId ??= batch[0]?.mangaId;

      // eslint-disable-next-line no-await-in-loop
      await context.prisma.chapter.createMany({
        data: batch,
        skipDuplicates: true  // Prevents unique constraint errors on (mangaId, index)
      });
      logger.info(`[batchCreateChapters] Batch ${Math.floor(i/batchSize) + 1} created successfully`);
    } else {
      logger.error(`[batchCreateChapters] Cannot create chapters - context or prisma is missing!`, {
        hasContext: !!context,
        contextIsRecord: isRecord(context),
        hasPrisma: isRecord(context) && !!context['prisma']
      });
    }
  }

  // Emit real-time event after all chapters are created
  if (mangaId !== undefined && deduped.length > 0) {
    logger.info(`[batchCreateChapters] Emitting chapters_updated event for manga ${mangaId} (${deduped.length} chapters created)`);
    await realtimeEmitter.emitMangaUpdate({
      mangaId,
      action: 'chapters_updated',
      data: { chaptersCreated: deduped.length }
    });
  }
}
