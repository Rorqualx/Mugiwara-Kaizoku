import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const queryRaw = jest.fn<() => Promise<unknown[]>>();
const executeRaw = jest.fn<() => Promise<number>>();

jest.mock('@/server/db', () => ({
  prisma: { $queryRaw: queryRaw, $executeRaw: executeRaw },
}));

import { PostgreSQLQueueWorker } from '@/server/queue/PostgreSQLQueueWorker';

interface WorkerInternals {
  processJobs: () => Promise<void>;
  processJob: (job: unknown) => Promise<void>;
  isShuttingDown: boolean;
}

function claimedJob(id: number): { id: bigint; attempt_count: number; job_type: string } {
  return { id: BigInt(id), attempt_count: 1, job_type: 'metadata_refresh' };
}

describe('PostgreSQLQueueWorker claim pass', () => {
  let worker: PostgreSQLQueueWorker;
  let internals: WorkerInternals;
  let releaseClaim: (rows: unknown[]) => void;
  let processJob: jest.SpiedFunction<WorkerInternals['processJob']>;

  beforeEach(() => {
    queryRaw.mockReset();
    executeRaw.mockReset();
    executeRaw.mockResolvedValue(0);
    queryRaw.mockImplementation(() => new Promise<unknown[]>((resolve) => { releaseClaim = resolve; }));

    worker = new PostgreSQLQueueWorker({ maxConcurrency: 3, batchSize: 10, enableNotifications: false });
    internals = worker as unknown as WorkerInternals;
    // The jobs themselves never finish, so their slots stay taken.
    processJob = jest.spyOn(internals, 'processJob').mockReturnValue(new Promise<void>(() => undefined));
  });

  it('runs one claim at a time when passes overlap', async () => {
    const first = internals.processJobs();
    const second = internals.processJobs();
    await second;

    expect(queryRaw).toHaveBeenCalledTimes(1);

    releaseClaim([claimedJob(1), claimedJob(2), claimedJob(3)]);
    await first;

    expect(processJob).toHaveBeenCalledTimes(3);
  });

  it('starts every job it claimed', async () => {
    const pass = internals.processJobs();
    releaseClaim([claimedJob(1), claimedJob(2), claimedJob(3)]);
    await pass;

    expect(processJob).toHaveBeenCalledTimes(3);
    expect(executeRaw).not.toHaveBeenCalled();

    // All slots are now taken: the next pass does not claim at all.
    await internals.processJobs();
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('hands claimed jobs back when shutdown begins during the claim', async () => {
    const pass = internals.processJobs();
    internals.isShuttingDown = true;
    releaseClaim([claimedJob(1), claimedJob(2)]);
    await pass;

    expect(processJob).not.toHaveBeenCalled();
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(worker.getStats().activeJobs).toBe(0);
  });
});
