import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const claimJobs = jest.fn<(limit: number, workerId: string) => Promise<{ id: string }[]>>();

jest.mock('@/server/services/conversion/ConversionJobWorker/worker-claim', () => ({ claimJobs }));
jest.mock('@/server/services/conversion/ConversionJobWorker/worker-retry', () => ({
  getQueueMetrics: jest.fn(),
  persistJobFailure: jest.fn(),
  recoverStaleJobs: jest.fn(),
}));
jest.mock('@/server/services/conversion/index', () => ({ getConversionService: jest.fn() }));

import { ConversionJobWorker } from '@/server/services/conversion/ConversionJobWorker';

interface WorkerInternals {
  processJobs: () => Promise<void>;
  processJob: (job: unknown) => Promise<void>;
}

describe('ConversionJobWorker claim pass', () => {
  let internals: WorkerInternals;
  let processJob: jest.SpiedFunction<WorkerInternals['processJob']>;

  beforeEach(() => {
    claimJobs.mockReset();
    const worker = new ConversionJobWorker({ batchSize: 5, maxConcurrency: 3 });
    internals = worker as unknown as WorkerInternals;
    processJob = jest.spyOn(internals, 'processJob').mockReturnValue(new Promise<void>(() => undefined));
  });

  it('claims no more jobs than it has free slots, and starts all of them', async () => {
    claimJobs.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]);
    await internals.processJobs();

    expect(claimJobs).toHaveBeenLastCalledWith(3, expect.any(String));
    expect(processJob).toHaveBeenCalledTimes(2);

    claimJobs.mockResolvedValueOnce([{ id: 'c' }]);
    await internals.processJobs();

    expect(claimJobs).toHaveBeenLastCalledWith(1, expect.any(String));
    expect(processJob).toHaveBeenCalledTimes(3);

    // Full: no further claim.
    await internals.processJobs();
    expect(claimJobs).toHaveBeenCalledTimes(2);
  });

  it('runs one claim at a time when passes overlap', async () => {
    let releaseClaim: (rows: { id: string }[]) => void = () => undefined;
    claimJobs.mockImplementationOnce(() => new Promise((resolve) => { releaseClaim = resolve; }));

    const first = internals.processJobs();
    await internals.processJobs();
    expect(claimJobs).toHaveBeenCalledTimes(1);

    releaseClaim([{ id: 'a' }]);
    await first;
    expect(processJob).toHaveBeenCalledTimes(1);
  });
});
