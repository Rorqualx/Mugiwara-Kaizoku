/**
 * `searchChapters` — auto-download fan-out.
 *
 * `protectedProcedure` so anonymous callers cannot trigger bandwidth/disk-
 * spending downloads. Concurrency is capped (`SEARCH_CONCURRENCY`) because
 * `triggerManga` runs a real release search per call (Prowlarr, MangaDex,
 * etc.) — unbounded fan-out would hammer external providers.
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { autoDownloadScheduler } from '@/server/queue/autoDownloadScheduler';
import { EventType, EventSource } from '@/server/services/events/eventTypes';
import { protectedProcedure } from '@/server/trpc/procedures';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import { logInfo, logError } from '@/utils/system-event-logger';

const SEARCH_CONCURRENCY = 5;

async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = Array.from<PromiseSettledResult<R>>({ length: items.length });
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      const item = items[idx] as T;
      try {
        // eslint-disable-next-line no-await-in-loop -- worker-pool pattern: each worker pulls sequentially from the shared cursor; the `limit` workers run in parallel via Promise.all below
        results[idx] = { status: 'fulfilled', value: await fn(item) };
      } catch (reason) {
        results[idx] = { status: 'rejected', reason };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

const searchChaptersInput = z.object({
  chapterIds: z.array(z.union([z.string(), z.number()]).transform((val) => toNumberId(val))).optional(),
  mangaIds: z.array(z.union([z.string(), z.number()]).transform((val) => toNumberId(val))).optional()
});

async function resolveTargetMangaIds(input: z.infer<typeof searchChaptersInput>): Promise<number[]> {
  let targetMangaIds: number[] = [];
  if (input.chapterIds && input.chapterIds.length > 0) {
    const chapters = await prisma.chapter.findMany({
      where: { id: { in: input.chapterIds } },
      select: { mangaId: true }
    });
    targetMangaIds = [...new Set(chapters.map(ch => ch.mangaId))];
  }
  if (input.mangaIds && input.mangaIds.length > 0) {
    targetMangaIds = [...new Set([...targetMangaIds, ...input.mangaIds])];
  }
  return targetMangaIds;
}

export const searchChapters = protectedProcedure.input(searchChaptersInput).mutation(async ({ input }) => {
  try {
    const targetMangaIds = await resolveTargetMangaIds(input);
    if (targetMangaIds.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No manga or chapters specified'
      });
    }

    logger.info(`[searchChapters] Triggering auto-download for ${targetMangaIds.length} manga (concurrency=${SEARCH_CONCURRENCY})`);

    const results = await mapConcurrent(
      targetMangaIds,
      SEARCH_CONCURRENCY,
      (mangaId) => autoDownloadScheduler.triggerManga(mangaId)
    );
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;

    void logInfo(`Triggered search for ${succeeded} manga`, EventType.USER_ACTION, EventSource.SYSTEM, {
      details: { mangaIds: targetMangaIds, succeeded, failed }
    });

    return { success: true, triggered: succeeded, failed };
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    void logError('Failed to trigger chapter search', EventSource.SYSTEM, errorMessage, {
      details: { input }
    });
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to trigger chapter search'
    });
  }
});
