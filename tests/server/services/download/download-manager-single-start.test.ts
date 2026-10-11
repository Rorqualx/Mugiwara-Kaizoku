import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DownloadMethod, DownloadMode } from '@prisma/client';

import type { PrismaClient } from '@prisma/client';

const checkForDuplicateJob = jest.fn<() => Promise<{ isDuplicate: boolean; existingJobId?: number }>>();

jest.mock('@/server/services/download/downloadManager/duplicate-check', () => ({ checkForDuplicateJob }));
jest.mock('@/server/services/download/downloadManager/validation', () => ({
  validateDownloadRequest: jest.fn(() => Promise.resolve({ status: 'success', data: undefined })),
}));
jest.mock('@/server/services/download/clientDownload', () => ({ ClientDownloadService: jest.fn() }));
jest.mock('@/server/services/prowlarr/mangaSearch', () => ({ ProwlarrMangaSearch: jest.fn() }));
jest.mock('@/server/services/realtime', () => ({
  realtimeEmitter: { emitDownloadStarted: jest.fn(), emitDownloadProgress: jest.fn() },
}));

import { DownloadManager } from '@/server/services/download/downloadManager/download-manager';
import { isSuccess } from '@/utils/async-result';

describe('DownloadManager starts a job once', () => {
  const steps: string[] = [];
  const updateMany = jest.fn<() => Promise<{ count: number }>>();
  const findFirst = jest.fn<() => Promise<null>>();
  const tx = {
    $executeRaw: jest.fn(() => { steps.push('lock'); return Promise.resolve(1); }),
    $queryRaw: jest.fn(() => { steps.push('insert'); return Promise.resolve([{ id: 77n }]); }),
  };
  const client = {
    jobs: { updateMany, findFirst },
    $transaction: jest.fn((run: (t: typeof tx) => Promise<unknown>) => run(tx)),
  };
  let manager: DownloadManager;

  beforeEach(() => {
    steps.length = 0;
    updateMany.mockReset();
    findFirst.mockReset();
    findFirst.mockResolvedValue(null);
    checkForDuplicateJob.mockReset();
    checkForDuplicateJob.mockImplementation(() => { steps.push('check'); return Promise.resolve({ isDuplicate: false }); });
    tx.$executeRaw.mockClear();
    tx.$queryRaw.mockClear();
    manager = new DownloadManager(client as unknown as PrismaClient);
  });

  describe('processTask', () => {
    it('does nothing when the job has already left pending', async () => {
      updateMany.mockResolvedValue({ count: 0 });

      const result = await manager.processTask(5);

      expect(isSuccess(result)).toBe(true);
      expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 5n, status: 'pending' } }));
      expect(findFirst).not.toHaveBeenCalled();
    });

    it('runs the job when it wins the claim', async () => {
      updateMany.mockResolvedValue({ count: 1 });

      await manager.processTask(5);

      expect(findFirst).toHaveBeenCalledTimes(1);
    });

    it('does not claim again a job the worker already claimed', async () => {
      await manager.processTask(5, { claimedByWorker: true });

      expect(updateMany).not.toHaveBeenCalled();
      expect(findFirst).toHaveBeenCalledTimes(1);
    });
  });

  describe('processDownloadRequest', () => {
    const request = {
      mangaId: 9,
      chapterIds: [1, 2],
      method: DownloadMethod.PROWLARR,
      mode: DownloadMode.MANUAL,
    };

    it('checks for a duplicate and inserts under one per-manga lock', async () => {
      // The microtask start loses the claim so the test ends at the insert.
      updateMany.mockResolvedValue({ count: 0 });

      const result = await manager.processDownloadRequest(request);

      expect(steps).toEqual(['lock', 'check', 'insert']);
      expect(isSuccess(result) && result.data.taskId).toBe(77);
    });

    it('returns the existing job without inserting when a duplicate is found under the lock', async () => {
      checkForDuplicateJob.mockImplementation(() => { steps.push('check'); return Promise.resolve({ isDuplicate: true, existingJobId: 41 }); });

      const result = await manager.processDownloadRequest(request);

      expect(steps).toEqual(['lock', 'check']);
      expect(isSuccess(result) && result.data.taskId).toBe(41);
    });
  });
});
