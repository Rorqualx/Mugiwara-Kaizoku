/** @jest-environment node */
import { describe, it, expect, jest } from '@jest/globals';
import { JobStatus, JobType } from '@prisma/client';

import {
  enqueueRefreshChain,
  findQueuedRefreshMangaIds,
  handOffRefreshChain,
  HANDOFF_RETRY_DELAYS_MS,
  mangaIdsInPayload,
  nextRefreshPayload,
  type EnqueueJob,
  type HandoffDeps,
} from '@/server/services/metadata/refresh-queue';

type Db = Parameters<typeof enqueueRefreshChain>[0];

function dbWithOpenJobs(payloads: unknown[]): Db {
  return { jobs: { findMany: jest.fn(async () => payloads.map((payload) => ({ payload }))) } } as unknown as Db;
}

interface JobRow {
  id: bigint;
  status: JobStatus;
  payload: unknown;
  initiated_by_user_id: string | null;
}

interface JobsWhere {
  status?: { in: JobStatus[] };
  id?: { not: bigint };
}

/**
 * A database made of job rows and existing title ids. `enqueue` appends a
 * pending row, so a second look at the queue sees what the first one queued.
 */
function fakeQueue(initial: JobRow[], existingTitles: number[]): {
  db: Db;
  rows: JobRow[];
  enqueue: jest.Mock<EnqueueJob>;
} {
  const rows = [...initial];
  const db = {
    jobs: {
      findMany: jest.fn(async (args: { where: JobsWhere; orderBy?: unknown }) => {
        const { status, id } = args.where;
        const matching = rows.filter((row) =>
          (status === undefined || status.in.includes(row.status))
          && (id === undefined || row.id !== id.not));
        return args.orderBy ? [...matching].sort((a, b) => Number(b.id - a.id)) : matching;
      }),
    },
    manga: {
      findMany: jest.fn(async (args: { where: { id: { in: number[] } } }) =>
        args.where.id.in.filter((id) => existingTitles.includes(id)).map((id) => ({ id }))),
    },
  } as unknown as Db;
  const enqueue = jest.fn<EnqueueJob>(async (_type, payload, options) => {
    const id = BigInt(rows.reduce((max, row) => Math.max(max, Number(row.id)), 0) + 1);
    rows.push({ id, status: JobStatus.pending, payload, initiated_by_user_id: options.initiatedByUserId ?? null });
    return id;
  });
  return { db, rows, enqueue };
}

/** A scheduler the test runs by hand. */
function manualScheduler(): { schedule: NonNullable<HandoffDeps['schedule']>; delays: number[]; runNext: () => Promise<void> } {
  const pending: Array<() => void> = [];
  const delays: number[] = [];
  return {
    schedule: (fn, delayMs) => { pending.push(fn); delays.push(delayMs); },
    delays,
    runNext: async () => {
      pending.shift()?.();
      // Let the retried hand-off (a few awaited queries) settle.
      for (let i = 0; i < 20; i++) await Promise.resolve();
    },
  };
}

const CIRCUIT_OPEN = 'Circuit breaker open for metadata_refresh. Too many recent failures.';

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

    expect(result).toEqual({ queued: [78, 47, 52], alreadyQueued: [], failed: [], error: null });
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

    expect(result).toEqual({ queued: [78], alreadyQueued: [47, 81, 52], failed: [], error: null });
    expect(enqueue).toHaveBeenCalledWith(
      JobType.metadata_refresh,
      { mangaId: 78, forceRefresh: true, remainingMangaIds: [] },
      { mangaId: 78, maxAttempts: 1 },
    );
  });

  it('queues nothing when every title already has a refresh open', async () => {
    const enqueue = jest.fn<EnqueueJob>(async () => 1n);
    const result = await enqueueRefreshChain(dbWithOpenJobs([{ mangaId: 78 }]), enqueue, [78], { forceRefresh: false });
    expect(result).toEqual({ queued: [], alreadyQueued: [78], failed: [], error: null });
    expect(enqueue).not.toHaveBeenCalled();
  });

  // Bug: the chain's one job was refused (circuit breaker open) and the caller
  // still reported the titles as queued-or-nothing with success: true.
  it('reports every title as failed, with the reason, when the queue refuses the job', async () => {
    const enqueue = jest.fn<EnqueueJob>(async () => { throw new Error(CIRCUIT_OPEN); });
    const result = await enqueueRefreshChain(dbWithOpenJobs([{ mangaId: 52 }]), enqueue, [78, 47, 52], { forceRefresh: false });
    expect(result).toEqual({ queued: [], alreadyQueued: [52], failed: [78, 47], error: CIRCUIT_OPEN });
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

  it('does not count the asking job itself as an open refresh', async () => {
    const { db } = fakeQueue([
      { id: 10n, status: JobStatus.active, payload: { mangaId: 1, remainingMangaIds: [2] }, initiated_by_user_id: null },
      { id: 11n, status: JobStatus.pending, payload: { mangaId: 3 }, initiated_by_user_id: null },
    ], [1, 2, 3]);
    expect([...await findQueuedRefreshMangaIds(db)].sort()).toEqual([1, 2, 3]);
    expect([...await findQueuedRefreshMangaIds(db, 10n)]).toEqual([3]);
  });
});

describe('handOffRefreshChain — the rest of a chain survives a refused enqueue', () => {
  const running = (payload: unknown): JobRow => ({ id: 10n, status: JobStatus.active, payload, initiated_by_user_id: 'user-1' });

  it('queues the rest of the chain, stepping over titles deleted while it waited', async () => {
    // A job row cannot reference a deleted title; the failed insert used to
    // strand everything queued behind it.
    const { db, enqueue } = fakeQueue([running({ mangaId: 1, remainingMangaIds: [2, 3, 4] })], [1, 4]);
    const warn = jest.fn();
    const outcome = await handOffRefreshChain(
      { db, enqueue, log: { warn, error: jest.fn() } },
      { mangaId: 2, forceRefresh: true, remainingMangaIds: [3, 4] },
      { initiatedByUserId: 'user-1', excludeJobId: 10n },
    );

    expect(outcome).toBe('queued');
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(
      JobType.metadata_refresh,
      { mangaId: 4, forceRefresh: true, remainingMangaIds: [] },
      { mangaId: 4, maxAttempts: 1, initiatedByUserId: 'user-1' },
    );
    expect(warn).toHaveBeenCalledWith('Metadata refresh skipped: manga 2, 3 no longer exists');
  });

  it('queues nothing when every remaining title was deleted', async () => {
    const { db, enqueue } = fakeQueue([], []);
    expect(await handOffRefreshChain({ db, enqueue }, { mangaId: 2, remainingMangaIds: [3] })).toBe('nothing_left');
    expect(enqueue).not.toHaveBeenCalled();
  });

  // Bug: the next link was enqueued once, in a `finally`. With the queue's
  // circuit breaker open the enqueue threw and the remaining ids existed only
  // in the archived payload of the job that had just finished.
  it('tries again after a delay when the queue refuses, and queues the chain exactly once', async () => {
    const { db, rows, enqueue } = fakeQueue([running({ mangaId: 1, remainingMangaIds: [2, 3] })], [1, 2, 3]);
    enqueue.mockRejectedValueOnce(new Error(CIRCUIT_OPEN)).mockRejectedValueOnce(new Error(CIRCUIT_OPEN));
    const timers = manualScheduler();
    const warn = jest.fn();

    const outcome = await handOffRefreshChain(
      { db, enqueue, schedule: timers.schedule, log: { warn, error: jest.fn() } },
      { mangaId: 2, forceRefresh: false, remainingMangaIds: [3] },
      { initiatedByUserId: 'user-1', excludeJobId: 10n },
    );
    expect(outcome).toBe('retrying');
    expect(rows).toHaveLength(1);

    await timers.runNext(); // refused again
    await timers.runNext(); // accepted
    await timers.runNext(); // nothing scheduled any more

    expect(timers.delays).toEqual(HANDOFF_RETRY_DELAYS_MS.slice(0, 2));
    const queuedJobs = rows.filter((row) => row.status === JobStatus.pending);
    expect(queuedJobs).toHaveLength(1);
    expect(queuedJobs[0]?.payload).toEqual({ mangaId: 2, forceRefresh: false, remainingMangaIds: [3] });
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('does not queue a second link when the refused enqueue had in fact inserted its row', async () => {
    const { db, rows, enqueue } = fakeQueue([running({ mangaId: 1, remainingMangaIds: [2, 3] })], [1, 2, 3]);
    // The row is written, then the call throws (for example while announcing the job).
    enqueue.mockImplementationOnce(async (_type, payload) => {
      rows.push({ id: 11n, status: JobStatus.pending, payload, initiated_by_user_id: 'user-1' });
      throw new Error('socket closed');
    });
    const timers = manualScheduler();

    const outcome = await handOffRefreshChain(
      { db, enqueue, schedule: timers.schedule },
      { mangaId: 2, remainingMangaIds: [3] },
      { excludeJobId: 10n },
    );
    expect(outcome).toBe('retrying');
    await timers.runNext();

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(rows.filter((row) => row.status === JobStatus.pending)).toHaveLength(1);
  });

  it('on a retry queues only the titles nobody queued in the meantime', async () => {
    const { db, rows, enqueue } = fakeQueue([], [2, 3, 4]);
    enqueue.mockRejectedValueOnce(new Error(CIRCUIT_OPEN));
    const timers = manualScheduler();
    await handOffRefreshChain({ db, enqueue, schedule: timers.schedule }, { mangaId: 2, remainingMangaIds: [3, 4] });

    // The user refreshes title 3 from another bulk action while the retry waits.
    rows.push({ id: 50n, status: JobStatus.pending, payload: { mangaId: 3 }, initiated_by_user_id: 'user-2' });
    await timers.runNext();

    expect(enqueue).toHaveBeenLastCalledWith(
      JobType.metadata_refresh,
      { mangaId: 2, forceRefresh: false, remainingMangaIds: [4] },
      { mangaId: 2, maxAttempts: 1 },
    );
  });

  it('retries when the database cannot be read, not only when the insert fails', async () => {
    const { db, enqueue } = fakeQueue([], [2]);
    (db.jobs.findMany as unknown as jest.Mock<() => Promise<never>>).mockRejectedValueOnce(new Error('pool timeout'));
    const timers = manualScheduler();

    expect(await handOffRefreshChain({ db, enqueue, schedule: timers.schedule }, { mangaId: 2 })).toBe('retrying');
    await timers.runNext();
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it('gives up after the last delay and logs the titles that were not refreshed, without throwing', async () => {
    const { db, enqueue } = fakeQueue([], [2, 3]);
    enqueue.mockRejectedValue(new Error(CIRCUIT_OPEN));
    const timers = manualScheduler();
    const error = jest.fn();
    const deps: HandoffDeps = { db, enqueue, schedule: timers.schedule, delaysMs: [10, 20], log: { warn: jest.fn(), error } };

    expect(await handOffRefreshChain(deps, { mangaId: 2, remainingMangaIds: [3] })).toBe('retrying');
    await timers.runNext();
    await timers.runNext();

    expect(timers.delays).toEqual([10, 20]);
    expect(enqueue).toHaveBeenCalledTimes(3);
    expect(error).toHaveBeenCalledWith(
      'Metadata refresh chain abandoned: these titles were not refreshed and are not queued',
      { mangaIds: [2, 3], attempt: 3, error: CIRCUIT_OPEN },
    );
  });

  it('keeps the deferral time when a busy job is put back', async () => {
    const { db, enqueue } = fakeQueue([running({ mangaId: 1, remainingMangaIds: [2] })], [1, 2]);
    const scheduledFor = new Date('2026-10-12T00:01:00Z');
    await handOffRefreshChain({ db, enqueue }, { mangaId: 1, remainingMangaIds: [2] }, { scheduledFor, excludeJobId: 10n });
    expect(enqueue).toHaveBeenCalledWith(
      JobType.metadata_refresh,
      { mangaId: 1, forceRefresh: false, remainingMangaIds: [2] },
      { mangaId: 1, maxAttempts: 1, scheduledFor },
    );
  });
});
