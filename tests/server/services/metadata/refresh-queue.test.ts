/** @jest-environment node */
import { describe, it, expect, jest } from '@jest/globals';
import { JobType } from '@prisma/client';

import {
  enqueueRefreshChain,
  mangaIdsInPayload,
  nextRefreshPayload,
  type EnqueueJob,
} from '@/server/services/metadata/refresh-queue';

type Db = Parameters<typeof enqueueRefreshChain>[0];

function dbWithOpenJobs(payloads: unknown[]): Db {
  return { jobs: { findMany: jest.fn(async () => payloads.map((payload) => ({ payload }))) } } as unknown as Db;
}

describe('refresh chain — a bulk refresh runs its titles one after another', () => {
  // Why this exists: bulk refresh queued one job per title with
  // forceRefresh: true, and the handler was a stub that did nothing. Wired to
  // the real pipeline as-is it would have taken every worker slot and
  // re-identified the whole library.
  it('queues one job that carries the rest of the batch', async () => {
    const enqueue = jest.fn<EnqueueJob>(async () => 1n);
    const result = await enqueueRefreshChain(dbWithOpenJobs([]), enqueue, [78, 47, 52], {
      forceRefresh: false, initiatedByUserId: 'user-1',
    });

    expect(result).toEqual({ queued: [78, 47, 52], alreadyQueued: [] });
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(
      JobType.metadata_refresh,
      { mangaId: 78, forceRefresh: false, remainingMangaIds: [47, 52] },
      { mangaId: 78, maxAttempts: 1, initiatedByUserId: 'user-1' },
    );
  });

  it('skips titles that are already waiting, running, or further down another chain', async () => {
    const enqueue = jest.fn<EnqueueJob>(async () => 1n);
    const open = [{ mangaId: 47, remainingMangaIds: [81] }, { mangaId: 52 }];
    const result = await enqueueRefreshChain(dbWithOpenJobs(open), enqueue, [78, 47, 81, 52, 78], { forceRefresh: true });

    expect(result).toEqual({ queued: [78], alreadyQueued: [47, 81, 52] });
    expect(enqueue).toHaveBeenCalledWith(
      JobType.metadata_refresh,
      { mangaId: 78, forceRefresh: true, remainingMangaIds: [] },
      { mangaId: 78, maxAttempts: 1 },
    );
  });

  it('queues nothing when every title already has a refresh open', async () => {
    const enqueue = jest.fn<EnqueueJob>(async () => 1n);
    const result = await enqueueRefreshChain(dbWithOpenJobs([{ mangaId: 78 }]), enqueue, [78], { forceRefresh: false });
    expect(result).toEqual({ queued: [], alreadyQueued: [78] });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('hands on the next title and keeps the re-identify choice', () => {
    expect(nextRefreshPayload({ mangaId: 78, forceRefresh: true, remainingMangaIds: [47, 52] }))
      .toEqual({ mangaId: 47, forceRefresh: true, remainingMangaIds: [52] });
    expect(nextRefreshPayload({ mangaId: 52, remainingMangaIds: [] })).toBeNull();
    expect(nextRefreshPayload({ mangaId: 52 })).toBeNull();
  });

  it('reads no titles out of a payload it does not understand', () => {
    expect(mangaIdsInPayload({ title: 'no id' })).toEqual([]);
    expect(mangaIdsInPayload(null)).toEqual([]);
    expect(mangaIdsInPayload({ mangaId: 5, remainingMangaIds: [6] })).toEqual([5, 6]);
  });
});
