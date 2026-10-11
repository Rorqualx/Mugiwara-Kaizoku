/**
 * Queued metadata refresh: one job per title, chained.
 *
 * A bulk refresh enqueues a single job that carries the rest of the batch in
 * `remainingMangaIds`; the handler refreshes its title and then enqueues the
 * next link. Titles therefore run one after another in a single worker slot
 * instead of taking every slot at once, and each job stays well inside the
 * queue's 30-minute limit.
 *
 * The enqueue function is passed in: the job handler cannot import the queue
 * manager statically (the queue manager imports the handlers).
 */
import { JobStatus, JobType } from '@prisma/client';
import { z } from 'zod';

import type { EnqueueOptions } from '@/server/queue/modules/types';

type PrismaClient = typeof import('@/server/db').prisma;

export const MetadataRefreshPayloadSchema = z.object({
  mangaId: z.number(),
  /** Re-identify: clear automatic bindings before refreshing. */
  forceRefresh: z.boolean().optional(),
  remainingMangaIds: z.array(z.number()).optional(),
});

export type MetadataRefreshPayload = z.infer<typeof MetadataRefreshPayloadSchema>;

export type EnqueueJob = (jobType: JobType, payload: unknown, options: EnqueueOptions) => Promise<bigint>;

const REFRESH_JOB_TYPES: JobType[] = [JobType.metadata_refresh, JobType.metadata_update, JobType.metadata_sync];
const OPEN_STATUSES: JobStatus[] = [JobStatus.pending, JobStatus.active, JobStatus.retrying];

/**
 * A failed refresh is not retried automatically: the pipeline already retries
 * its providers, and a second full run of a title that fails deterministically
 * only delays the rest of the chain.
 */
const REFRESH_MAX_ATTEMPTS = 1;

/** Every title a payload still has to refresh, head first. */
export function mangaIdsInPayload(payload: unknown): number[] {
  const parsed = MetadataRefreshPayloadSchema.safeParse(payload);
  if (!parsed.success) return [];
  return [parsed.data.mangaId, ...(parsed.data.remainingMangaIds ?? [])];
}

/** The payload for the rest of the chain, or null when this was the last title. */
export function nextRefreshPayload(payload: MetadataRefreshPayload): MetadataRefreshPayload | null {
  const [next, ...rest] = payload.remainingMangaIds ?? [];
  if (next === undefined) return null;
  return { mangaId: next, forceRefresh: payload.forceRefresh ?? false, remainingMangaIds: rest };
}

/** Titles that already have a refresh waiting or running. */
export async function findQueuedRefreshMangaIds(db: PrismaClient): Promise<Set<number>> {
  const open = await db.jobs.findMany({
    where: { job_type: { in: REFRESH_JOB_TYPES }, status: { in: OPEN_STATUSES } },
    select: { payload: true },
  });
  return new Set(open.flatMap((job) => mangaIdsInPayload(job.payload)));
}

/** Enqueue one link of a refresh chain. */
export function enqueueRefreshJob(
  enqueue: EnqueueJob,
  payload: MetadataRefreshPayload,
  options: { initiatedByUserId?: string | null; scheduledFor?: Date } = {},
): Promise<bigint> {
  return enqueue(JobType.metadata_refresh, payload, {
    mangaId: payload.mangaId,
    maxAttempts: REFRESH_MAX_ATTEMPTS,
    ...(options.initiatedByUserId ? { initiatedByUserId: options.initiatedByUserId } : {}),
    ...(options.scheduledFor ? { scheduledFor: options.scheduledFor } : {}),
  });
}

export interface RefreshChainResult {
  /** Titles put on the queue, in run order. */
  queued: number[];
  /** Titles left out because a refresh for them is already waiting or running. */
  alreadyQueued: number[];
}

/**
 * Queue a refresh for each title, skipping any that already has one open.
 * Duplicate ids in the request are collapsed.
 */
export async function enqueueRefreshChain(
  db: PrismaClient,
  enqueue: EnqueueJob,
  mangaIds: readonly number[],
  options: { forceRefresh: boolean; initiatedByUserId?: string | null },
): Promise<RefreshChainResult> {
  const open = await findQueuedRefreshMangaIds(db);
  const unique = [...new Set(mangaIds)];
  const queued = unique.filter((id) => !open.has(id));
  const alreadyQueued = unique.filter((id) => open.has(id));

  const [head, ...rest] = queued;
  if (head !== undefined) {
    await enqueueRefreshJob(
      enqueue,
      { mangaId: head, forceRefresh: options.forceRefresh, remainingMangaIds: rest },
      { initiatedByUserId: options.initiatedByUserId ?? null },
    );
  }
  return { queued, alreadyQueued };
}
