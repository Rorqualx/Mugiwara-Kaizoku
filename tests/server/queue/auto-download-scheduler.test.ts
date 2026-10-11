import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const findMany = jest.fn<() => Promise<unknown[]>>();

jest.mock('@/server/db', () => ({
  prisma: { autoDownloadRule: { findMany, update: jest.fn() } },
}));
jest.mock('@/server/services/library/releaseDispatcher/dispatch', () => ({
  runUnifiedReleaseSearch: jest.fn(),
}));
jest.mock('@/server/queue/workers/autoDownloadWorker', () => ({
  processAutoDownload: jest.fn(),
}));

import { AutoDownloadScheduler } from '@/server/queue/autoDownloadScheduler';

describe('AutoDownloadScheduler.start', () => {
  let scheduler: AutoDownloadScheduler;
  let releaseFirstPass: (rows: unknown[]) => void;

  beforeEach(() => {
    findMany.mockReset();
    findMany.mockImplementation(() => new Promise<unknown[]>((resolve) => { releaseFirstPass = resolve; }));
    scheduler = new AutoDownloadScheduler(3600);
  });

  afterEach(() => {
    releaseFirstPass([]);
    scheduler.stop();
  });

  it('resolves without waiting for the first pass over the rules', async () => {
    const started = await Promise.race([
      scheduler.start().then(() => 'started'),
      new Promise<string>((resolve) => { setTimeout(() => { resolve('still waiting'); }, 200); }),
    ]);

    expect(started).toBe('started');
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('does not begin a second pass when started again while the first is running', async () => {
    await scheduler.start();
    await scheduler.start();

    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
