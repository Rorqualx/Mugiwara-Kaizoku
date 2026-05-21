/**
 * @jest-environment node
 *
 * Unit tests for ConversionJobWorker
 * Tests background job processing, concurrency, and worker lifecycle
 */


import { ConversionStatus } from '@prisma/client';

import { prisma } from '@/server/db';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';


import { ConversionJobWorker } from '../ConversionJobWorker';
import { getConversionService } from '../index';

// Mock prisma
jest.mock('@/server/db', () => ({
  prisma: {
    conversionJob: {
      updateMany: jest.fn(),
      groupBy: jest.fn(),
      update: jest.fn()
    },
    $queryRaw: jest.fn(),
    config: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn()
    }
  }
}));

// Mock conversion service
jest.mock('../index', () => ({
  getConversionService: jest.fn()
}));

// Mock logger
jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    child: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn(),
    })),
  },
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn(),
  })),
}));

describe('ConversionJobWorker', () => {
  let worker: ConversionJobWorker;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(async () => {
    if (worker['isRunning']) {
      await worker.stop();
    }
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      worker = new ConversionJobWorker();

      const stats = worker.getStats();
      expect(stats.jobsProcessed).toBe(0);
      expect(stats.jobsFailed).toBe(0);
    });

    it('should accept custom configuration', () => {
      worker = new ConversionJobWorker({
        batchSize: 10,
        maxConcurrency: 5,
        pollInterval: 5000
      });

      expect(worker['config'].batchSize).toBe(10);
      expect(worker['config'].maxConcurrency).toBe(5);
      expect(worker['config'].pollInterval).toBe(5000);
    });

    it('should generate unique worker ID', () => {
      const worker1 = new ConversionJobWorker();
      const worker2 = new ConversionJobWorker();

      expect(worker1['workerId']).not.toBe(worker2['workerId']);
    });
  });

  describe('start', () => {
    it('should start the worker', async () => {
      worker = new ConversionJobWorker();

      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      await worker.start();

      expect(worker['isRunning']).toBe(true);
    });

    it('should throw error if already running', async () => {
      worker = new ConversionJobWorker();

      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      await worker.start();

      await expect(worker.start()).rejects.toThrow('already running');
    });

    it('should start polling on start', async () => {
      worker = new ConversionJobWorker({ pollInterval: 1000 });

      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      await worker.start();

      expect(worker['pollTimer']).not.toBeNull();
    });
  });

  describe('stop', () => {
    it('should stop the worker gracefully', async () => {
      worker = new ConversionJobWorker();

      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      await worker.start();
      await worker.stop();

      expect(worker['isRunning']).toBe(false);
      expect(worker['pollTimer']).toBeNull();
    });

    it('should wait for active jobs to complete', async () => {
      worker = new ConversionJobWorker();

      (prisma.$queryRaw as jest.Mock).mockResolvedValue([
        {
          id: 'job-1',
          mangaId: 1,
          chapterId: 10,
          sourceFilePath: '/test/source.cbz',
          targetFilePath: '/test/target.pdf',
          sourceFormat: 'cbz',
          targetFormat: 'pdf',
          attempts: 0,
          maxAttempts: 3
        }
      ]);

      const mockService = {
        executeConversionJob: jest.fn().mockImplementation(async () => {
          // Simulate async work without setTimeout to avoid timer issues
          await Promise.resolve();
          return createSuccessResult({ success: true });
        })
      };

      (getConversionService as jest.Mock).mockReturnValue(mockService);

      await worker.start();

      // Allow microtasks to process (job processing starts)
      await Promise.resolve();
      await Promise.resolve();

      // Stop worker - should wait for active jobs
      await worker.stop();

      expect(worker['isRunning']).toBe(false);
      expect(worker['activeJobs'].size).toBe(0);
    });

    it('should not throw if not running', async () => {
      worker = new ConversionJobWorker();

      // Should complete without throwing
      await expect(worker.stop()).resolves.toBeUndefined();
    });
  });

  describe('job claiming', () => {
    it('should claim jobs using SKIP LOCKED', async () => {
      worker = new ConversionJobWorker({ batchSize: 5 });

      const mockJobs = [
        { id: 'job-1', mangaId: 1, chapterId: 10, sourceFilePath: '/test/1.cbz' },
        { id: 'job-2', mangaId: 2, chapterId: 20, sourceFilePath: '/test/2.cbz' }
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockJobs);

      await worker['claimJobs']();

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(worker['activeJobs'].size).toBe(2);
      expect(worker['activeJobs'].has('job-1')).toBe(true);
      expect(worker['activeJobs'].has('job-2')).toBe(true);
    });

    it('should handle empty job queue', async () => {
      worker = new ConversionJobWorker();

      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const jobs = await worker['claimJobs']();

      expect(jobs).toHaveLength(0);
      expect(worker['activeJobs'].size).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      worker = new ConversionJobWorker();

      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Database error'));

      const jobs = await worker['claimJobs']();

      expect(jobs).toHaveLength(0);
    });
  });

  describe('job processing', () => {
    it('should process jobs successfully', async () => {
      worker = new ConversionJobWorker();

      const mockJob = {
        id: 'job-1',
        mangaId: 1,
        chapterId: 10,
        sourceFilePath: '/test/source.cbz',
        targetFilePath: '/test/target.pdf',
        sourceFormat: 'cbz',
        targetFormat: 'pdf',
        attempts: 0,
        maxAttempts: 3
      };

      const mockService = {
        executeConversionJob: jest.fn().mockResolvedValue(
          createSuccessResult({ success: true, processingTimeMs: 100 })
        )
      };

      (getConversionService as jest.Mock).mockReturnValue(mockService);

      await worker['processJob'](mockJob);

      expect(mockService.executeConversionJob).toHaveBeenCalledWith('job-1');
      expect(worker.getStats().jobsProcessed).toBe(1);
    });

    it('should handle job failures', async () => {
      worker = new ConversionJobWorker();

      const mockJob = {
        id: 'job-1',
        mangaId: 1,
        chapterId: 10,
        sourceFilePath: '/test/source.cbz',
        targetFilePath: '/test/target.pdf',
        sourceFormat: 'cbz',
        targetFormat: 'pdf',
        attempts: 0,
        maxAttempts: 3
      };

      const mockService = {
        executeConversionJob: jest.fn().mockResolvedValue(
          createErrorResult(new Error('Conversion failed'))
        )
      };

      (getConversionService as jest.Mock).mockReturnValue(mockService);
      (prisma.conversionJob.update as jest.Mock).mockResolvedValue(mockJob);

      await worker['processJob'](mockJob);

      expect(worker.getStats().jobsFailed).toBe(1);
      expect(prisma.conversionJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: expect.objectContaining({
          status: ConversionStatus.PENDING, // Retry
          attempts: 1,
          errorMessage: 'Conversion failed'
        })
      });
    });

    it('should mark job as FAILED after max retries', async () => {
      worker = new ConversionJobWorker();

      const mockJob = {
        id: 'job-1',
        mangaId: 1,
        chapterId: 10,
        sourceFilePath: '/test/source.cbz',
        targetFilePath: '/test/target.pdf',
        sourceFormat: 'cbz',
        targetFormat: 'pdf',
        attempts: 2,
        maxAttempts: 3
      };

      const mockService = {
        executeConversionJob: jest.fn().mockResolvedValue(
          createErrorResult(new Error('Conversion failed'))
        )
      };

      (getConversionService as jest.Mock).mockReturnValue(mockService);
      (prisma.conversionJob.update as jest.Mock).mockResolvedValue(mockJob);

      await worker['processJob'](mockJob);

      expect(prisma.conversionJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: expect.objectContaining({
          status: ConversionStatus.FAILED, // No more retries
          attempts: 3,
          completedAt: expect.any(Date)
        })
      });
    });

    it('should remove job from active set after processing', async () => {
      worker = new ConversionJobWorker();

      const mockJob = {
        id: 'job-1',
        mangaId: 1,
        chapterId: 10,
        sourceFilePath: '/test/source.cbz',
        targetFilePath: '/test/target.pdf',
        sourceFormat: 'cbz',
        targetFormat: 'pdf',
        attempts: 0,
        maxAttempts: 3
      };

      const mockService = {
        executeConversionJob: jest.fn().mockResolvedValue(
          createSuccessResult({ success: true })
        )
      };

      (getConversionService as jest.Mock).mockReturnValue(mockService);

      worker['activeJobs'].add('job-1');

      await worker['processJob'](mockJob);

      expect(worker['activeJobs'].has('job-1')).toBe(false);
    });

    it('should emit job:completed event on success', async () => {
      worker = new ConversionJobWorker();

      const mockJob = {
        id: 'job-1',
        mangaId: 1,
        chapterId: 10,
        sourceFilePath: '/test/source.cbz',
        targetFilePath: '/test/target.pdf',
        sourceFormat: 'cbz',
        targetFormat: 'pdf',
        attempts: 0,
        maxAttempts: 3
      };

      const mockService = {
        executeConversionJob: jest.fn().mockResolvedValue(
          createSuccessResult({ success: true })
        )
      };

      (getConversionService as jest.Mock).mockReturnValue(mockService);

      const completedHandler = jest.fn();
      worker.on('job:completed', completedHandler);

      await worker['processJob'](mockJob);

      expect(completedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          job: mockJob
        })
      );
    });

    it('should emit job:failed event on failure', async () => {
      worker = new ConversionJobWorker();

      const mockJob = {
        id: 'job-1',
        mangaId: 1,
        chapterId: 10,
        sourceFilePath: '/test/source.cbz',
        targetFilePath: '/test/target.pdf',
        sourceFormat: 'cbz',
        targetFormat: 'pdf',
        attempts: 0,
        maxAttempts: 3
      };

      const mockService = {
        executeConversionJob: jest.fn().mockResolvedValue(
          createErrorResult(new Error('Conversion failed'))
        )
      };

      (getConversionService as jest.Mock).mockReturnValue(mockService);
      (prisma.conversionJob.update as jest.Mock).mockResolvedValue(mockJob);

      const failedHandler = jest.fn();
      worker.on('job:failed', failedHandler);

      await worker['processJob'](mockJob);

      expect(failedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          job: mockJob,
          error: 'Conversion failed',
          willRetry: true
        })
      );
    });
  });

  describe('concurrency control', () => {
    it('should respect maxConcurrency limit', async () => {
      worker = new ConversionJobWorker({ maxConcurrency: 2 });

      const mockJobs = [
        { id: 'job-1', mangaId: 1, chapterId: 10 },
        { id: 'job-2', mangaId: 2, chapterId: 20 },
        { id: 'job-3', mangaId: 3, chapterId: 30 }
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockJobs);

      const mockService = {
        executeConversionJob: jest.fn().mockResolvedValue(
          createSuccessResult({ success: true })
        )
      };

      (getConversionService as jest.Mock).mockReturnValue(mockService);

      await worker.start();
      await worker['processJobs']();

      // Should only process 2 jobs concurrently
      expect(worker['processingPromises'].length).toBeLessThanOrEqual(2);
    });
  });

  describe('recoverStaleJobs', () => {
    it('should recover stale processing jobs', async () => {
      (prisma.conversionJob.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

      const count = await ConversionJobWorker.recoverStaleJobs(30);

      expect(count).toBe(3);
      expect(prisma.conversionJob.updateMany).toHaveBeenCalledWith({
        where: {
          status: ConversionStatus.PROCESSING,
          updatedAt: { lt: expect.any(Date) }
        },
        data: {
          status: ConversionStatus.PENDING,
          updatedAt: expect.any(Date)
        }
      });
    });

    it('should handle database errors', async () => {
      (prisma.conversionJob.updateMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const count = await ConversionJobWorker.recoverStaleJobs();

      expect(count).toBe(0);
    });
  });

  describe('getQueueMetrics', () => {
    it('should return queue metrics', async () => {
      (prisma.conversionJob.groupBy as jest.Mock).mockResolvedValue([
        { status: ConversionStatus.PENDING, _count: { _all: 5 } },
        { status: ConversionStatus.PROCESSING, _count: { _all: 2 } },
        { status: ConversionStatus.COMPLETED, _count: { _all: 10 } },
        { status: ConversionStatus.FAILED, _count: { _all: 1 } }
      ]);

      const metrics = await ConversionJobWorker.getQueueMetrics();

      expect(metrics).toEqual({
        pending: 5,
        processing: 2,
        completed: 10,
        failed: 1,
        cancelled: 0
      });
    });
  });

  describe('getStats', () => {
    it('should return worker statistics', async () => {
      worker = new ConversionJobWorker();

      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      await worker.start();

      const stats = worker.getStats();

      expect(stats).toHaveProperty('jobsProcessed');
      expect(stats).toHaveProperty('jobsFailed');
      expect(stats).toHaveProperty('startTime');
      expect(stats).toHaveProperty('uptime');
      expect(stats).toHaveProperty('throughput');
    });

    it('should calculate throughput correctly', async () => {
      worker = new ConversionJobWorker();

      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      await worker.start();

      // Simulate processing jobs
      worker['stats'].jobsProcessed = 10;

      const stats = worker.getStats();

      expect(stats.throughput).toBeGreaterThanOrEqual(0);
    });
  });
});
