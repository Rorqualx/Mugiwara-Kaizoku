/**
 * Metadata Job Handlers
 */

import { jobs } from '@prisma/client';

import { prisma } from '@/server/db';
import {
  enqueueRefreshJob,
  MetadataRefreshPayloadSchema,
  nextRefreshPayload,
  type EnqueueJob,
  type MetadataRefreshPayload,
} from '@/server/services/metadata/refresh-queue';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import {
  emitRefreshProgress,
  runMetadataRefresh,
  TOTAL_REFRESH_PHASES,
} from '@/server/trpc/routers/manga/metadataOperations/refresh/run-refresh';
import { processSingleton } from '@/server/utils/process-singleton';
import { logger } from '@/utils/logger';

/** How long a refresh job waits before trying again while another one runs. */
const BUSY_RETRY_DELAY_MS = 60_000;

/**
 * Queued refreshes run one at a time in this process. Each one makes dozens
 * of provider calls and hundreds of queries; three in parallel (the worker's
 * slot count) would starve the request pool and trip provider rate limits.
 */
const refreshSlot = processSingleton('metadata-refresh-slot', () => ({ busy: false }));

async function getEnqueue(): Promise<EnqueueJob> {
  // Dynamic import keeps this handler out of the queueManager module graph
  // (handlers/index.ts is imported BY queueManager).
  const { queueManager } = await import('../queueManager');
  return (jobType, payload, options) => queueManager.enqueue(jobType, payload, options);
}

/** Refresh one title; a missing title is skipped so the chain can go on. */
async function refreshOne(payload: MetadataRefreshPayload): Promise<void> {
  const { mangaId } = payload;
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { id: true, title: true, providerMetadata: true },
  });
  if (!manga) {
    logger.warn(`Metadata refresh skipped: manga ${mangaId} no longer exists`);
    return;
  }

  try {
    await runMetadataRefresh(prisma, manga, payload.forceRefresh ?? false);
    await emitRefreshProgress(mangaId, 'completed', TOTAL_REFRESH_PHASES, 'Metadata refresh complete');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await emitRefreshProgress(mangaId, 'error', 0, 'Metadata refresh failed', message);
    throw error;
  }

  void realtimeEmitter.emitMangaUpdate({
    mangaId,
    action: 'metadata_updated',
    data: { title: manga.title },
  });
}

/**
 * The next link of the chain whose title still exists. A title deleted while
 * the batch was waiting is stepped over: a job row cannot reference it, and
 * the failed insert would strand everything queued behind it.
 */
async function nextExistingTitle(payload: MetadataRefreshPayload): Promise<MetadataRefreshPayload | null> {
  let next = nextRefreshPayload(payload);
  while (next) {
    // eslint-disable-next-line no-await-in-loop -- walks the chain until a title exists; normally the first
    const exists = await prisma.manga.findUnique({ where: { id: next.mangaId }, select: { id: true } });
    if (exists) return next;
    logger.warn(`Metadata refresh skipped: manga ${next.mangaId} no longer exists`);
    next = nextRefreshPayload(next);
  }
  return null;
}

export async function handleMetadataRefresh(job: jobs): Promise<void> {
  const result = MetadataRefreshPayloadSchema.safeParse(job.payload);

  if (!result.success) {
    logger.error('Invalid metadata refresh payload:', result.error);
    throw new Error(`Invalid job payload: ${result.error.message}`);
  }

  const payload = result.data;
  const { mangaId } = payload;
  const initiatedByUserId = job.initiated_by_user_id;
  const enqueue = await getEnqueue();

  if (refreshSlot.busy) {
    // Hand the slot back and come round again rather than hold it while waiting.
    await enqueueRefreshJob(enqueue, payload, {
      initiatedByUserId,
      scheduledFor: new Date(Date.now() + BUSY_RETRY_DELAY_MS),
    });
    logger.info(`Metadata refresh for manga ${mangaId} deferred: another refresh is running`, { jobId: String(job.id) });
    return;
  }

  refreshSlot.busy = true;
  logger.info(`Processing metadata refresh for manga ${mangaId}`, {
    jobId: String(job.id),
    forceRefresh: payload.forceRefresh ?? false,
    remaining: payload.remainingMangaIds?.length ?? 0,
  });
  void realtimeEmitter.emitSystemEvent({
    eventType: 'job:metadata_refresh:started',
    source: 'metadataHandler',
    message: `Metadata refresh started for manga ${mangaId}`,
    data: { jobId: String(job.id), mangaId, forceRefresh: payload.forceRefresh ?? false },
  });

  try {
    await refreshOne(payload);
    logger.info(`Metadata refresh completed for manga ${mangaId}`);
  } finally {
    refreshSlot.busy = false;
    // One title failing must not strand the rest of the batch.
    const next = await nextExistingTitle(payload);
    if (next) {
      await enqueueRefreshJob(enqueue, next, { initiatedByUserId });
    }
  }
}
