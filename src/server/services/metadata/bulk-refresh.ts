/**
 * Bulk metadata refresh: queue a chain for the titles a user selected and say
 * truthfully what happened to each of them.
 */
import { enqueueRefreshChain, type EnqueueJob } from '@/server/services/metadata/refresh-queue';

type PrismaClient = typeof import('@/server/db').prisma;

/**
 * - `queued`: every requested title is queued now or was already queued, and at least one is new.
 * - `partial`: some titles were queued and some could not be.
 * - `already_queued`: nothing new was queued because every title already has a refresh open.
 * - `failed`: nothing was queued and at least one title could not be.
 */
export type BulkRefreshOutcome = 'queued' | 'partial' | 'already_queued' | 'failed';

export interface BulkRefreshResult {
  /** True only when at least one title was put on the queue by this request. */
  success: boolean;
  outcome: BulkRefreshOutcome;
  /** Titles queued by this request. */
  successCount: number;
  alreadyQueuedCount: number;
  /** Titles that were neither queued nor already queued. */
  errorCount: number;
  /** Distinct titles the caller asked for, before any filtering. */
  totalCount: number;
  errors: string[] | null;
  message: string;
}

export interface BulkRefreshRequest {
  /** Ids exactly as the caller sent them. */
  requestedIds: readonly number[];
  /** The subset of `requestedIds` in the caller's library. */
  libraryIds: readonly number[];
  reidentify: boolean;
  userId: string;
}

function plural(count: number): string {
  return count === 1 ? 'title' : 'titles';
}

function outcomeOf(queued: number, alreadyQueued: number, failed: number): BulkRefreshOutcome {
  if (queued > 0) return failed > 0 ? 'partial' : 'queued';
  return failed > 0 ? 'failed' : 'already_queued';
}

/** One sentence for the toast; the counts always add up to `total`. */
export function describeBulkRefresh(
  counts: { queued: number; alreadyQueued: number; failed: number; total: number },
  firstError: string | null,
): string {
  const { queued, alreadyQueued, failed, total } = counts;
  const outcome = outcomeOf(queued, alreadyQueued, failed);
  if (outcome === 'already_queued') {
    return `Nothing new queued: ${total === 1 ? 'this title already has' : `all ${total} titles already have`} a metadata refresh waiting or running`;
  }
  const notes = [
    alreadyQueued > 0 ? `${alreadyQueued} already queued` : null,
    failed > 0 ? `${failed} failed` : null,
  ].filter((note): note is string => note !== null);
  const reason = firstError !== null ? `: ${firstError}` : '';
  if (outcome === 'failed') {
    const already = alreadyQueued > 0 ? ` (${alreadyQueued} already queued)` : '';
    return `No metadata refresh was queued for ${failed} of ${total} ${plural(total)}${already}${reason}`;
  }
  const suffix = notes.length > 0 ? ` (${notes.join(', ')})` : '';
  return `Queued ${queued} of ${total} ${plural(total)} for metadata refresh${suffix}${outcome === 'partial' ? reason : ''}`;
}

/**
 * Queue a refresh chain for the caller's titles.
 *
 * Every requested id ends up in exactly one of queued / already queued /
 * failed. Ids outside the caller's library and ids whose title is gone count
 * as failed with the same wording, so the answer does not reveal whether a
 * title exists in someone else's library.
 */
export async function queueBulkRefresh(
  db: PrismaClient,
  enqueue: EnqueueJob,
  request: BulkRefreshRequest,
): Promise<BulkRefreshResult> {
  const requested = [...new Set(request.requestedIds)];
  const inLibrary = new Set(request.libraryIds);
  const candidates = requested.filter((id) => inLibrary.has(id));

  const existing = candidates.length > 0
    ? await db.manga.findMany({ where: { id: { in: candidates } }, select: { id: true } })
    : [];
  const existingIds = new Set(existing.map((manga) => manga.id));
  const refreshable = candidates.filter((id) => existingIds.has(id));
  const errors = requested
    .filter((id) => !existingIds.has(id))
    .map((id) => `Manga ${id} is not in your library`);

  let queued: number[] = [];
  let alreadyQueued: number[] = [];
  let failedToQueue = 0;
  try {
    const chain = await enqueueRefreshChain(db, enqueue, refreshable, {
      forceRefresh: request.reidentify,
      initiatedByUserId: request.userId,
    });
    ({ queued, alreadyQueued } = chain);
    failedToQueue = chain.failed.length;
    if (chain.error !== null) errors.push(`Failed to queue metadata refresh: ${chain.error}`);
  } catch (error: unknown) {
    // Reading the open jobs failed, so nothing is known to be queued.
    failedToQueue = refreshable.length;
    errors.push(`Failed to queue metadata refresh: ${error instanceof Error ? error.message : String(error)}`);
  }

  const counts = {
    queued: queued.length,
    alreadyQueued: alreadyQueued.length,
    failed: requested.length - refreshable.length + failedToQueue,
    total: requested.length,
  };
  return {
    success: counts.queued > 0,
    outcome: outcomeOf(counts.queued, counts.alreadyQueued, counts.failed),
    successCount: counts.queued,
    alreadyQueuedCount: counts.alreadyQueued,
    errorCount: counts.failed,
    totalCount: counts.total,
    errors: errors.length > 0 ? errors : null,
    message: describeBulkRefresh(counts, errors[errors.length - 1] ?? null),
  };
}
