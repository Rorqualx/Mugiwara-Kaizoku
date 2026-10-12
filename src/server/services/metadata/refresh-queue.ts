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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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

/**
 * Titles that already have a refresh waiting or running.
 *
 * @param excludeJobId - the job asking, when it asks from inside its own
 *   handler: it is still `active` and its payload names the very titles it is
 *   about to hand on.
 */
export async function findQueuedRefreshMangaIds(db: PrismaClient, excludeJobId?: bigint): Promise<Set<number>> {
  const open = await db.jobs.findMany({
    where: {
      job_type: { in: REFRESH_JOB_TYPES },
      status: { in: OPEN_STATUSES },
      ...(excludeJobId !== undefined ? { id: { not: excludeJobId } } : {}),
    },
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
  /** Titles that should have been queued but were not: the queue refused the job. */
  failed: number[];
  /** Why the queue refused, or null when it did not. */
  error: string | null;
}

/**
 * Queue a refresh for each title, skipping any that already has one open.
 * Duplicate ids in the request are collapsed.
 *
 * A refused enqueue is reported in the result, not thrown: the whole chain
 * rides on one job, so the caller needs to know that none of it was queued
 * and still needs the already-queued list.
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
  if (head === undefined) return { queued, alreadyQueued, failed: [], error: null };

  try {
    await enqueueRefreshJob(
      enqueue,
      { mangaId: head, forceRefresh: options.forceRefresh, remainingMangaIds: rest },
      { initiatedByUserId: options.initiatedByUserId ?? null },
    );
  } catch (error: unknown) {
    return { queued: [], alreadyQueued, failed: queued, error: errorMessage(error) };
  }
  return { queued, alreadyQueued, failed: [], error: null };
}

// ---------------------------------------------------------------------------
// Handing a chain on from inside a job
// ---------------------------------------------------------------------------

/**
 * Waits between attempts to hand a chain on. They add up to nineteen minutes;
 * the queue's circuit breaker, the usual reason an enqueue is refused, closes
 * five minutes after the last failed job.
 */
export const HANDOFF_RETRY_DELAYS_MS: readonly number[] = [30_000, 60_000, 120_000, 330_000, 600_000];

export type HandoffOutcome =
  /** A job for the rest of the chain is on the queue. */
  | 'queued'
  /** Nothing left to do: every title is gone or already has a refresh open. */
  | 'nothing_left'
  /** The attempt failed; another one is scheduled in this process. */
  | 'retrying'
  /** Every attempt failed; the titles are logged and need a new bulk refresh. */
  | 'abandoned';

export interface HandoffLog {
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
}

export interface HandoffDeps {
  db: PrismaClient;
  enqueue: EnqueueJob;
  /** Runs `fn` after `delayMs`. Defaults to an unref'd timer. */
  schedule?: (fn: () => void, delayMs: number) => void;
  delaysMs?: readonly number[];
  log?: HandoffLog;
}

export interface HandoffOptions {
  initiatedByUserId?: string | null;
  scheduledFor?: Date;
  /** The job doing the handing on; its own payload is not counted as "already queued". */
  excludeJobId?: bigint;
}

function scheduleUnref(fn: () => void, delayMs: number): void {
  const timer = setTimeout(fn, delayMs);
  timer.unref();
}

/**
 * The part of a payload that still needs a job: titles that exist and that no
 * other open refresh job covers. A deleted title cannot be referenced by a job
 * row (the insert would fail and strand everything behind it), and a title
 * another job covers would be refreshed twice.
 */
async function outstandingPayload(
  deps: HandoffDeps,
  payload: MetadataRefreshPayload,
  excludeJobId: bigint | undefined,
): Promise<MetadataRefreshPayload | null> {
  const ids = [...new Set(mangaIdsInPayload(payload))];
  const [open, existing] = await Promise.all([
    findQueuedRefreshMangaIds(deps.db, excludeJobId),
    deps.db.manga.findMany({ where: { id: { in: ids } }, select: { id: true } }),
  ]);
  const existingIds = new Set(existing.map((manga) => manga.id));
  const gone = ids.filter((id) => !existingIds.has(id));
  if (gone.length > 0) {
    deps.log?.warn(`Metadata refresh skipped: manga ${gone.join(', ')} no longer exists`);
  }
  const [head, ...rest] = ids.filter((id) => existingIds.has(id) && !open.has(id));
  if (head === undefined) return null;
  return { mangaId: head, forceRefresh: payload.forceRefresh ?? false, remainingMangaIds: rest };
}

/**
 * Put the rest of a chain on the queue from inside a job, and keep trying if
 * the queue refuses.
 *
 * Never throws: it is called from a `finally`, where a throw would replace the
 * refresh's own error and fail a job whose title was refreshed. When an
 * attempt fails (the queue's circuit breaker is open, the database is briefly
 * unreachable) the ids would otherwise survive only in the finished job's
 * payload, so another attempt is scheduled. Every attempt first drops titles
 * that another open job already covers, which is what keeps a retry from
 * creating a second link when the "failed" enqueue did insert its row.
 */
export async function handOffRefreshChain(
  deps: HandoffDeps,
  payload: MetadataRefreshPayload,
  options: HandoffOptions = {},
  attempt = 0,
): Promise<HandoffOutcome> {
  const delays = deps.delaysMs ?? HANDOFF_RETRY_DELAYS_MS;
  try {
    const outstanding = await outstandingPayload(deps, payload, options.excludeJobId);
    if (!outstanding) return 'nothing_left';
    await enqueueRefreshJob(deps.enqueue, outstanding, {
      initiatedByUserId: options.initiatedByUserId ?? null,
      ...(options.scheduledFor ? { scheduledFor: options.scheduledFor } : {}),
    });
    return 'queued';
  } catch (error: unknown) {
    const meta = { mangaIds: mangaIdsInPayload(payload), attempt: attempt + 1, error: errorMessage(error) };
    const delayMs = delays[attempt];
    if (delayMs === undefined) {
      deps.log?.error('Metadata refresh chain abandoned: these titles were not refreshed and are not queued', meta);
      return 'abandoned';
    }
    deps.log?.warn(`Metadata refresh chain could not be handed on; trying again in ${delayMs / 1000}s`, meta);
    (deps.schedule ?? scheduleUnref)(() => {
      void handOffRefreshChain(deps, payload, options, attempt + 1);
    }, delayMs);
    return 'retrying';
  }
}
