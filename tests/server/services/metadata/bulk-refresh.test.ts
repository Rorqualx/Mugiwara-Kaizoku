/** @jest-environment node */
import { describe, it, expect, jest } from '@jest/globals';
import { JobType } from '@prisma/client';

import { bulkRefreshNotice } from '@/components/library/utils/bulkRefreshNotice';
import { queueBulkRefresh, type BulkRefreshResult } from '@/server/services/metadata/bulk-refresh';
import type { EnqueueJob } from '@/server/services/metadata/refresh-queue';
import { filterMangaIdsToLibrary } from '@/server/trpc/routers/_shared/library-access';

type Db = Parameters<typeof queueBulkRefresh>[0];
type AccessDb = Parameters<typeof filterMangaIdsToLibrary>[0];

interface World {
  /** Titles that exist. */
  titles: number[];
  /** Titles in user-1's library. */
  memberships: number[];
  /** Payloads of refresh jobs already waiting or running. */
  openJobs: unknown[];
}

function fakeDb(world: World): Db & AccessDb {
  return {
    libraryMembership: {
      findMany: jest.fn(async (args: { where: { userId: string; mangaId: { in: number[] } } }) =>
        (args.where.userId === 'user-1' ? world.memberships : [])
          .filter((id) => args.where.mangaId.in.includes(id))
          .map((mangaId) => ({ mangaId }))),
    },
    manga: {
      findMany: jest.fn(async (args: { where: { id: { in: number[] } } }) =>
        args.where.id.in.filter((id) => world.titles.includes(id)).map((id) => ({ id }))),
    },
    jobs: { findMany: jest.fn(async () => world.openJobs.map((payload) => ({ payload }))) },
  } as unknown as Db & AccessDb;
}

/** What the bulkRefreshMetadata procedure does with its input. */
async function bulkRefresh(
  world: World,
  mangaIds: number[],
  enqueue: EnqueueJob,
  reidentify = false,
): Promise<BulkRefreshResult> {
  const db = fakeDb(world);
  const libraryIds = await filterMangaIdsToLibrary(db, 'user-1', mangaIds);
  return queueBulkRefresh(db, enqueue, { requestedIds: mangaIds, libraryIds, reidentify, userId: 'user-1' });
}

const accept = (): jest.Mock<EnqueueJob> => jest.fn<EnqueueJob>(async () => 1n);
const CIRCUIT_OPEN = 'Circuit breaker open for metadata_refresh. Too many recent failures.';

describe('bulk refresh — the answer says what happened to every selected title', () => {
  it('queues one chain for the selected titles and reports success', async () => {
    const enqueue = accept();
    const result = await bulkRefresh({ titles: [1, 2, 3], memberships: [1, 2, 3], openJobs: [] }, [1, 2, 3], enqueue);

    expect(result).toEqual({
      success: true,
      outcome: 'queued',
      successCount: 3,
      alreadyQueuedCount: 0,
      errorCount: 0,
      totalCount: 3,
      errors: null,
      message: 'Queued 3 of 3 titles for metadata refresh',
    });
    expect(enqueue).toHaveBeenCalledWith(
      JobType.metadata_refresh,
      { mangaId: 1, forceRefresh: false, remainingMangaIds: [2, 3] },
      { mangaId: 1, maxAttempts: 1, initiatedByUserId: 'user-1' },
    );
  });

  it('passes the re-identify choice down the chain', async () => {
    const enqueue = accept();
    await bulkRefresh({ titles: [1], memberships: [1], openJobs: [] }, [1], enqueue, true);
    expect(enqueue.mock.calls[0]?.[1]).toEqual({ mangaId: 1, forceRefresh: true, remainingMangaIds: [] });
  });

  // Bug: the queue refused the job (circuit breaker open), the procedure
  // swallowed the error and returned success: true with "Queued 0 of N", and
  // the page showed that in a green toast.
  it('is not a success when the queue refuses the job, and carries the reason', async () => {
    const enqueue = jest.fn<EnqueueJob>(async () => { throw new Error(CIRCUIT_OPEN); });
    const result = await bulkRefresh({ titles: [1, 2], memberships: [1, 2], openJobs: [] }, [1, 2], enqueue);

    expect(result.success).toBe(false);
    expect(result.outcome).toBe('failed');
    expect(result).toMatchObject({ successCount: 0, alreadyQueuedCount: 0, errorCount: 2, totalCount: 2 });
    expect(result.errors).toEqual([`Failed to queue metadata refresh: ${CIRCUIT_OPEN}`]);
    expect(result.message).toBe(
      `No metadata refresh was queued for 2 of 2 titles: Failed to queue metadata refresh: ${CIRCUIT_OPEN}`,
    );
    expect(bulkRefreshNotice(result)).toMatchObject({ kind: 'error', title: 'Bulk Refresh Failed', keepSelection: true });
  });

  it('is not a success when the open jobs cannot be read', async () => {
    const world = { titles: [1], memberships: [1], openJobs: [] };
    const db = fakeDb(world);
    (db.jobs.findMany as unknown as jest.Mock<() => Promise<never>>).mockRejectedValueOnce(new Error('pool timeout'));
    const result = await queueBulkRefresh(db, accept(), { requestedIds: [1], libraryIds: [1], reidentify: false, userId: 'user-1' });

    expect(result).toMatchObject({ success: false, outcome: 'failed', errorCount: 1, totalCount: 1 });
    expect(result.errors).toEqual(['Failed to queue metadata refresh: pool timeout']);
  });

  // Bug: "already queued" was a suffix on a green "Queued 0 of N" message.
  it('says nothing new was queued when every title already has a refresh open', async () => {
    const enqueue = accept();
    const world = { titles: [1, 2], memberships: [1, 2], openJobs: [{ mangaId: 1, remainingMangaIds: [2] }] };
    const result = await bulkRefresh(world, [1, 2], enqueue);

    expect(enqueue).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      success: false, outcome: 'already_queued', successCount: 0, alreadyQueuedCount: 2, errorCount: 0, errors: null,
    });
    expect(result.message).toBe('Nothing new queued: all 2 titles already have a metadata refresh waiting or running');
    expect(bulkRefreshNotice(result)).toMatchObject({ kind: 'info', title: 'Metadata Refresh Already Queued', keepSelection: false });
  });

  // Bug: ids outside the caller's library were dropped before counting, so
  // "Queued 1 of 1" was reported for a request of three.
  it('never queues a title outside the caller\'s library and counts it as failed', async () => {
    const enqueue = accept();
    const world = { titles: [1, 2, 3], memberships: [1], openJobs: [] };
    const result = await bulkRefresh(world, [1, 2, 3], enqueue);

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0]?.[1]).toEqual({ mangaId: 1, forceRefresh: false, remainingMangaIds: [] });
    expect(result).toMatchObject({ success: true, outcome: 'partial', successCount: 1, errorCount: 2, totalCount: 3 });
    expect(result.errors).toEqual(['Manga 2 is not in your library', 'Manga 3 is not in your library']);
    expect(bulkRefreshNotice(result)).toEqual({
      kind: 'info',
      title: 'Metadata Refresh Partly Queued',
      message: 'Queued 1 of 3 titles for metadata refresh (2 failed): Manga 3 is not in your library (and 1 more problem)',
      keepSelection: true,
    });
  });

  it('gives a title that does not exist the same answer as one in someone else\'s library', async () => {
    const result = await bulkRefresh({ titles: [2], memberships: [], openJobs: [] }, [2, 999], accept());
    expect(result).toMatchObject({ success: false, outcome: 'failed', errorCount: 2, totalCount: 2 });
    expect(result.errors).toEqual(['Manga 2 is not in your library', 'Manga 999 is not in your library']);
  });

  it('counts a title selected twice once, and the counts add up to the total', async () => {
    const world = { titles: [1, 2, 3], memberships: [1, 2, 3], openJobs: [{ mangaId: 2 }] };
    const result = await bulkRefresh(world, [1, 1, 2, 3, 4], accept());

    expect(result).toMatchObject({ outcome: 'partial', successCount: 2, alreadyQueuedCount: 1, errorCount: 1, totalCount: 4 });
    expect(result.successCount + result.alreadyQueuedCount + result.errorCount).toBe(result.totalCount);
    expect(result.message).toBe(
      'Queued 2 of 4 titles for metadata refresh (1 already queued, 1 failed): Manga 4 is not in your library',
    );
  });

  it('shows a green toast only when titles were queued', () => {
    const base = { message: 'm', errors: null };
    expect(bulkRefreshNotice({ ...base, outcome: 'queued' }).kind).toBe('success');
    expect(bulkRefreshNotice({ ...base, outcome: 'partial' }).kind).toBe('info');
    expect(bulkRefreshNotice({ ...base, outcome: 'already_queued' }).kind).toBe('info');
    expect(bulkRefreshNotice({ ...base, outcome: 'failed' }).kind).toBe('error');
  });
});
