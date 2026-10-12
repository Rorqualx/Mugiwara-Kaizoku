/**
 * handleMetadataRefresh: one queued title at a time, the chain handed on
 * whatever happens to the title, and a refused enqueue survived.
 *
 * The queue, the database and the pipeline are mocked.
 *
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { JobStatus, JobType, type jobs } from '@prisma/client';

interface JobRow { id: bigint; status: JobStatus; payload: unknown }
interface TitleRow { id: number; title: string; providerMetadata: unknown }
type Enqueue = (jobType: JobType, payload: unknown, options: Record<string, unknown>) => Promise<bigint>;
type RunRefresh = (db: unknown, manga: TitleRow, forceRefresh: boolean) => Promise<unknown>;
type EmitProgress = (mangaId: number, phase: string, index: number, message: string, error?: string) => Promise<void>;

const world: { titles: TitleRow[]; openJobs: JobRow[] } = { titles: [], openJobs: [] };

const mockEnqueue = jest.fn<Enqueue>();
const mockRunMetadataRefresh = jest.fn<RunRefresh>();
const mockEmitRefreshProgress = jest.fn<EmitProgress>();
const mockEmitMangaUpdate = jest.fn(async () => undefined);
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

jest.mock('@/server/db', () => ({
  prisma: {
    manga: {
      findUnique: jest.fn(async (args: { where: { id: number } }) =>
        world.titles.find((title) => title.id === args.where.id) ?? null),
      findMany: jest.fn(async (args: { where: { id: { in: number[] } } }) =>
        world.titles.filter((title) => args.where.id.in.includes(title.id)).map(({ id }) => ({ id }))),
    },
    jobs: {
      findMany: jest.fn(async (args: { where: { id?: { not: bigint } } }) =>
        world.openJobs.filter((row) => row.id !== args.where.id?.not)),
    },
  },
}));
jest.mock('@/server/queue/queueManager', () => ({
  queueManager: { enqueue: (...args: Parameters<Enqueue>) => mockEnqueue(...args) },
}));
jest.mock('@/server/trpc/routers/manga/metadataOperations/refresh/run-refresh', () => ({
  TOTAL_REFRESH_PHASES: 10,
  runMetadataRefresh: (...args: Parameters<RunRefresh>) => mockRunMetadataRefresh(...args),
  emitRefreshProgress: (...args: Parameters<EmitProgress>) => mockEmitRefreshProgress(...args),
}));
jest.mock('@/server/services/realtime/RealtimeEventEmitter', () => ({
  realtimeEmitter: {
    emitSystemEvent: jest.fn(async () => undefined),
    emitMangaUpdate: (...args: unknown[]) => mockEmitMangaUpdate(...(args as [])),
  },
}));
jest.mock('@/utils/logger', () => ({ logger: mockLogger }));

import { handleMetadataRefresh } from '@/server/queue/handlers/metadata';

const CIRCUIT_OPEN = 'Circuit breaker open for metadata_refresh. Too many recent failures.';

function job(id: number, payload: unknown): jobs {
  // The handler reads id, payload and initiated_by_user_id only.
  const row = { id: BigInt(id), payload, initiated_by_user_id: 'user-1', job_type: JobType.metadata_refresh };
  world.openJobs.push({ id: row.id, status: JobStatus.active, payload });
  return row as unknown as jobs;
}

function title(id: number): TitleRow {
  return { id, title: `Title ${id}`, providerMetadata: null };
}

/** A promise the test settles by hand. */
function deferred(): { promise: Promise<unknown>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<unknown>((done) => { resolve = () => done({}); });
  return { promise, resolve };
}

beforeEach(() => {
  world.titles = [title(1), title(2), title(3)];
  world.openJobs = [];
  mockEnqueue.mockReset().mockResolvedValue(99n);
  mockRunMetadataRefresh.mockReset().mockResolvedValue({});
  mockEmitRefreshProgress.mockReset().mockResolvedValue(undefined);
  jest.useRealTimers();
});

describe('handleMetadataRefresh', () => {
  it('refreshes its title, keeping bindings unless re-identify was asked for, then queues the next link', async () => {
    await handleMetadataRefresh(job(10, { mangaId: 1, remainingMangaIds: [2, 3] }));

    expect(mockRunMetadataRefresh).toHaveBeenCalledTimes(1);
    expect(mockRunMetadataRefresh.mock.calls[0]?.[1]).toEqual(title(1));
    expect(mockRunMetadataRefresh.mock.calls[0]?.[2]).toBe(false);
    expect(mockEmitRefreshProgress).toHaveBeenCalledWith(1, 'completed', 10, 'Metadata refresh complete');
    expect(mockEmitMangaUpdate).toHaveBeenCalledWith({ mangaId: 1, action: 'metadata_updated', data: { title: 'Title 1' } });
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockEnqueue).toHaveBeenCalledWith(
      JobType.metadata_refresh,
      { mangaId: 2, forceRefresh: false, remainingMangaIds: [3] },
      { mangaId: 2, maxAttempts: 1, initiatedByUserId: 'user-1' },
    );
  });

  it('carries re-identify through to the pipeline and the next link', async () => {
    await handleMetadataRefresh(job(10, { mangaId: 1, forceRefresh: true, remainingMangaIds: [2] }));
    expect(mockRunMetadataRefresh.mock.calls[0]?.[2]).toBe(true);
    expect(mockEnqueue.mock.calls[0]?.[1]).toEqual({ mangaId: 2, forceRefresh: true, remainingMangaIds: [] });
  });

  it('queues nothing after the last title of a chain', async () => {
    await handleMetadataRefresh(job(10, { mangaId: 3, remainingMangaIds: [] }));
    expect(mockRunMetadataRefresh).toHaveBeenCalledTimes(1);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('rejects a payload without a title id and queues nothing', async () => {
    await expect(handleMetadataRefresh(job(10, { remainingMangaIds: [2] }))).rejects.toThrow('Invalid job payload');
    expect(mockRunMetadataRefresh).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  // A title deleted while the batch waited must not stop the batch.
  it('skips its own title when it was deleted, without failing, and still hands the chain on', async () => {
    world.titles = [title(2), title(3)];
    await expect(handleMetadataRefresh(job(10, { mangaId: 1, remainingMangaIds: [2, 3] }))).resolves.toBeUndefined();

    expect(mockRunMetadataRefresh).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith('Metadata refresh skipped: manga 1 no longer exists');
    expect(mockEnqueue.mock.calls[0]?.[1]).toEqual({ mangaId: 2, forceRefresh: false, remainingMangaIds: [3] });
  });

  // A job row cannot reference a deleted title: the insert fails and used to
  // strand everything queued behind it.
  it('steps over deleted titles further down the chain', async () => {
    world.titles = [title(1), title(3)];
    await handleMetadataRefresh(job(10, { mangaId: 1, remainingMangaIds: [2, 3] }));
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockEnqueue.mock.calls[0]?.[1]).toEqual({ mangaId: 3, forceRefresh: false, remainingMangaIds: [] });
    expect(mockEnqueue.mock.calls[0]?.[2]).toMatchObject({ mangaId: 3 });
  });

  it('hands the chain on when its title fails, reports the failure, and frees the slot', async () => {
    mockRunMetadataRefresh.mockRejectedValueOnce(new Error('AniList unreachable'));

    await expect(handleMetadataRefresh(job(10, { mangaId: 1, remainingMangaIds: [2, 3] }))).rejects.toThrow('AniList unreachable');

    expect(mockEmitRefreshProgress).toHaveBeenCalledWith(1, 'error', 0, 'Metadata refresh failed', 'AniList unreachable');
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockEnqueue.mock.calls[0]?.[1]).toEqual({ mangaId: 2, forceRefresh: false, remainingMangaIds: [3] });

    // The slot is free again: the next job runs instead of deferring itself.
    world.openJobs = [];
    await handleMetadataRefresh(job(11, { mangaId: 2, remainingMangaIds: [] }));
    expect(mockRunMetadataRefresh).toHaveBeenCalledTimes(2);
  });

  // Bug: with the queue's circuit breaker open the enqueue in `finally` threw.
  // That replaced the title's own error, failed jobs whose title had been
  // refreshed, and left the remaining ids only in the archived payload.
  it('does not fail a refreshed title when the queue refuses the next link, and tries the link again later', async () => {
    jest.useFakeTimers();
    mockEnqueue.mockRejectedValueOnce(new Error(CIRCUIT_OPEN));

    await expect(handleMetadataRefresh(job(10, { mangaId: 1, remainingMangaIds: [2, 3] }))).resolves.toBeUndefined();
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Metadata refresh chain could not be handed on; trying again in 30s',
      { mangaIds: [2, 3], attempt: 1, error: CIRCUIT_OPEN },
    );

    world.openJobs = []; // job 10 has finished by the time the retry fires
    await jest.advanceTimersByTimeAsync(30_000);

    expect(mockEnqueue).toHaveBeenCalledTimes(2);
    expect(mockEnqueue.mock.calls[1]?.[1]).toEqual({ mangaId: 2, forceRefresh: false, remainingMangaIds: [3] });
    expect(mockRunMetadataRefresh).toHaveBeenCalledTimes(1);
  });

  it('keeps the title\'s own error when the queue also refuses the next link', async () => {
    jest.useFakeTimers();
    mockRunMetadataRefresh.mockRejectedValueOnce(new Error('AniList unreachable'));
    mockEnqueue.mockRejectedValueOnce(new Error(CIRCUIT_OPEN));

    await expect(handleMetadataRefresh(job(10, { mangaId: 1, remainingMangaIds: [2] }))).rejects.toThrow('AniList unreachable');

    world.openJobs = [];
    await jest.advanceTimersByTimeAsync(30_000);
    expect(mockEnqueue).toHaveBeenCalledTimes(2);
    expect(mockEnqueue.mock.calls[1]?.[1]).toEqual({ mangaId: 2, forceRefresh: false, remainingMangaIds: [] });
  });

  describe('while another refresh is running', () => {
    it('puts itself back a minute later with its whole chain, runs no pipeline, and leaves the slot alone', async () => {
      const first = deferred();
      mockRunMetadataRefresh.mockReturnValueOnce(first.promise);
      const running = handleMetadataRefresh(job(10, { mangaId: 1, remainingMangaIds: [] }));
      await new Promise((tick) => setImmediate(tick)); // job 10 is now inside the pipeline

      const before = Date.now();
      await handleMetadataRefresh(job(11, { mangaId: 2, forceRefresh: true, remainingMangaIds: [3] }));

      expect(mockRunMetadataRefresh).toHaveBeenCalledTimes(1);
      expect(mockEnqueue).toHaveBeenCalledTimes(1);
      const [type, payload, options] = mockEnqueue.mock.calls[0] ?? [];
      expect(type).toBe(JobType.metadata_refresh);
      expect(payload).toEqual({ mangaId: 2, forceRefresh: true, remainingMangaIds: [3] });
      expect(options).toMatchObject({ mangaId: 2, maxAttempts: 1, initiatedByUserId: 'user-1' });
      const delay = (options?.['scheduledFor'] as Date).getTime() - before;
      expect(delay).toBeGreaterThanOrEqual(60_000);
      expect(delay).toBeLessThan(65_000);

      // Still busy: a third job defers too, and the first one then finishes normally.
      await handleMetadataRefresh(job(12, { mangaId: 3 }));
      expect(mockRunMetadataRefresh).toHaveBeenCalledTimes(1);
      first.resolve();
      await running;
    });

    // Bug: the deferring job has a single attempt, so a refused re-enqueue
    // failed it and dropped its title and every title behind it.
    it('does not fail, and tries the deferral again, when the queue refuses it', async () => {
      const first = deferred();
      mockRunMetadataRefresh.mockReturnValueOnce(first.promise);
      const running = handleMetadataRefresh(job(10, { mangaId: 1, remainingMangaIds: [] }));
      await new Promise((tick) => setImmediate(tick));

      jest.useFakeTimers();
      mockEnqueue.mockRejectedValueOnce(new Error(CIRCUIT_OPEN));
      await expect(handleMetadataRefresh(job(11, { mangaId: 2, remainingMangaIds: [3] }))).resolves.toBeUndefined();
      expect(mockEnqueue).toHaveBeenCalledTimes(1);

      world.openJobs = world.openJobs.filter((row) => row.id !== 11n); // job 11 has finished
      await jest.advanceTimersByTimeAsync(30_000);

      expect(mockEnqueue).toHaveBeenCalledTimes(2);
      expect(mockEnqueue.mock.calls[1]?.[1]).toEqual({ mangaId: 2, forceRefresh: false, remainingMangaIds: [3] });
      first.resolve();
      await running;
    });

    it('does not put itself back when another open job already covers its titles', async () => {
      const first = deferred();
      mockRunMetadataRefresh.mockReturnValueOnce(first.promise);
      const running = handleMetadataRefresh(job(10, { mangaId: 1, remainingMangaIds: [] }));
      await new Promise((tick) => setImmediate(tick));

      // The same job was recovered and claimed twice, and the first run already deferred itself.
      world.openJobs.push({ id: 20n, status: JobStatus.pending, payload: { mangaId: 2, remainingMangaIds: [3] } });
      await handleMetadataRefresh(job(11, { mangaId: 2, remainingMangaIds: [3] }));

      expect(mockEnqueue).not.toHaveBeenCalled();
      first.resolve();
      await running;
    });
  });
});
