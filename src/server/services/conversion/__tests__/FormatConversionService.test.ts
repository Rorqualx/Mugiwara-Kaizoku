/**
 * @jest-environment node
 *
 * Unit tests for FormatConversionService
 * Tests job creation, execution, status tracking, and database integration
 */

// Mock ConverterFactory BEFORE imports
// NOTE: Bun requires factory functions for jest.mock()
const mockGetConverter = jest.fn();
const mockIsConversionSupported = jest.fn();
const mockRegisterConverter = jest.fn();
const mockUnregisterConverter = jest.fn();
const mockGetConvertersForFormats = jest.fn();
const mockGetConverterByName = jest.fn();
const mockGetRegisteredConverters = jest.fn();
const mockGetSupportedSourceFormats = jest.fn();
const mockGetSupportedTargetFormats = jest.fn();
const mockClearConverters = jest.fn();
const mockGetStatistics = jest.fn();

jest.mock('../ConverterFactory', () => ({
  ConverterFactory: {
    getConverter: mockGetConverter,
    registerConverter: mockRegisterConverter,
    unregisterConverter: mockUnregisterConverter,
    getConvertersForFormats: mockGetConvertersForFormats,
    isConversionSupported: mockIsConversionSupported,
    getConverterByName: mockGetConverterByName,
    getRegisteredConverters: mockGetRegisteredConverters,
    getSupportedSourceFormats: mockGetSupportedSourceFormats,
    getSupportedTargetFormats: mockGetSupportedTargetFormats,
    clearConverters: mockClearConverters,
    getStatistics: mockGetStatistics
  }
}));

// Mock prisma
jest.mock('../../../db', () => ({
  prisma: {
    conversionJob: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    }
  }
}));

// Imports after mocks

import { ConversionStatus } from '@prisma/client';

import { prisma } from '@/server/db';
import { AsyncResult, createSuccessResult, createErrorResult } from '@/utils/async-result';


import { BaseConverter, ConversionOptions, ConversionResult } from '../BaseConverter';
import { FormatConversionService } from '../FormatConversionService';

// Test converter
class MockConverter extends BaseConverter {
  constructor() {
    super('MockConverter');
  }

  getSupportedSourceFormats(): ('cbz' | 'pdf' | 'epub' | 'cbr' | 'zip')[] {
    return ['cbz'];
  }

  getSupportedTargetFormats(): ('cbz' | 'pdf' | 'epub' | 'cbr' | 'zip')[] {
    return ['pdf'];
  }

  protected doConvert(options: ConversionOptions): Promise<AsyncResult<ConversionResult, Error>> {
    return Promise.resolve(createSuccessResult({
      outputPath: options.targetFile,
      fileSize: 1024,
      pageCount: 10,
      duration: 100
    }));
  }
}

describe('FormatConversionService', () => {
  let service: FormatConversionService;
  let mockConverter: MockConverter;

  beforeEach(() => {
    service = new FormatConversionService();
    mockConverter = new MockConverter();

    // Mock the convert method to bypass file validation
    mockConverter.convert = jest.fn().mockResolvedValue(
      createSuccessResult({
        outputPath: '/test/target.pdf',
        fileSize: 1024,
        pageCount: 10,
        duration: 100
      })
    );

    jest.clearAllMocks();

    // Default mocks for ConverterFactory
    mockIsConversionSupported.mockReturnValue(true);
    mockGetConverter.mockReturnValue(
      createSuccessResult(mockConverter)
    );
  });

  describe('createConversionJob', () => {
    it('should create a new conversion job', async () => {
      const mockJob = {
        id: 'job-123',
        mangaId: 1,
        chapterId: 10,
        sourceFilePath: '/test/source.cbz',
        targetFilePath: '/test/target.pdf',
        sourceFormat: 'cbz',
        targetFormat: 'pdf',
        status: ConversionStatus.PENDING,
        priority: 5,
        attempts: 0,
        maxAttempts: 3,
        errorMessage: null,
        progress: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null
      };

      (prisma.conversionJob.create as jest.Mock).mockResolvedValue(mockJob);

      const result = await service.createConversionJob({
        mangaId: 1,
        chapterId: 10,
        sourceFile: '/test/source.cbz',
        targetFile: '/test/target.pdf',
        sourceFormat: 'cbz',
        targetFormat: 'pdf',
        priority: 5,
        maxAttempts: 3
      });

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.data).toBe('job-123');
      }

      expect(prisma.conversionJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          mangaId: 1,
          chapterId: 10,
          sourceFilePath: '/test/source.cbz',
          sourceFormat: 'cbz',
          targetFormat: 'pdf',
          status: 'PENDING',
          priority: 5,
          maxAttempts: 3,
          progress: 0
        })
      });
    });

    it('should handle database errors', async () => {
      (prisma.conversionJob.create as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await service.createConversionJob({
        mangaId: 1,
        chapterId: 10,
        sourceFile: '/test/source.cbz',
        targetFile: '/test/target.pdf',
        sourceFormat: 'cbz',
        targetFormat: 'pdf'
      });

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error.message).toContain('Database connection failed');
      }
    });

    it('should reject unsupported conversion formats', async () => {
      mockIsConversionSupported.mockReturnValue(false);

      const result = await service.createConversionJob({
        mangaId: 1,
        chapterId: 10,
        sourceFile: '/test/source.cbz',
        targetFile: '/test/target.xyz',
        sourceFormat: 'cbz',
        targetFormat: 'xyz'
      });

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error.message).toContain('not supported');
      }
    });

    it('should use default values for optional fields', async () => {
      const mockJob = {
        id: 'job-123',
        status: ConversionStatus.PENDING,
        priority: 5,
        maxAttempts: 3
      };

      (prisma.conversionJob.create as jest.Mock).mockResolvedValue(mockJob);

      await service.createConversionJob({
        mangaId: 1,
        chapterId: 10,
        sourceFile: '/test/source.cbz',
        targetFile: '/test/target.pdf',
        sourceFormat: 'cbz',
        targetFormat: 'pdf'
      });

      expect(prisma.conversionJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          priority: 50,
          maxAttempts: 3
        })
      });
    });
  });

  describe('executeConversionJob', () => {
    const mockJob = {
      id: 'job-123',
      mangaId: 1,
      chapterId: 10,
      sourceFilePath: '/test/source.cbz',
      targetFilePath: '/test/target.pdf',
      sourceFormat: 'cbz',
      targetFormat: 'pdf',
      status: ConversionStatus.PROCESSING,
      priority: 5,
      attempts: 0,
      maxAttempts: 3,
      errorMessage: null,
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null
    };

    beforeEach(() => {
      (prisma.conversionJob.findUnique as jest.Mock).mockResolvedValue(mockJob);
      (prisma.conversionJob.update as jest.Mock).mockResolvedValue(mockJob);
    });

    it('should successfully execute a conversion job', async () => {
      const result = await service.executeConversionJob('job-123');

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.data.outputPath).toBeDefined();
      }

      // Should update status to COMPLETED
      expect(prisma.conversionJob.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: expect.objectContaining({
          status: ConversionStatus.COMPLETED,
          progress: 100
        })
      });
    });

    it('should return error if job not found', async () => {
      (prisma.conversionJob.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.executeConversionJob('non-existent');

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error.message).toContain('not found');
      }
    });

    it('should return error if no converter available', async () => {
      mockGetConverter.mockReturnValue(
        createErrorResult(new Error('No converter available'))
      );

      const result = await service.executeConversionJob('job-123');

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error.message).toContain('No converter available');
      }

      // Should update job with error
      expect(prisma.conversionJob.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: expect.objectContaining({
          status: ConversionStatus.FAILED,
          errorMessage: expect.stringContaining('No converter available')
        })
      });
    });

    it('should handle conversion errors and update job status', async () => {
      // Create converter that fails
      const failingConverter = new MockConverter();
      failingConverter.convert = jest.fn().mockResolvedValue(
        createErrorResult(new Error('Conversion failed'))
      );

      mockGetConverter.mockReturnValue(
        createSuccessResult(failingConverter)
      );

      const result = await service.executeConversionJob('job-123');

      expect(result.status).toBe('error');

      // Should update job with failure (on first retry, status is PENDING not FAILED)
      expect(prisma.conversionJob.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: expect.objectContaining({
          status: ConversionStatus.PENDING,
          errorMessage: 'Conversion failed'
        })
      });
    });

    it('should track progress updates', async () => {
      let progressCallback: ((progress: number) => void) | undefined;

      // Intercept the progress callback
      mockConverter.convert = jest.fn().mockImplementation((options: ConversionOptions) => {
        progressCallback = options.onProgress;
        if (progressCallback) {
          progressCallback(25);
          progressCallback(50);
          progressCallback(75);
          progressCallback(100);
        }
        return createSuccessResult({
          outputPath: options.targetFile,
          fileSize: 1024,
          pageCount: 10,
          duration: 100
        });
      });

      mockGetConverter.mockReturnValue(
        createSuccessResult(mockConverter)
      );

      await service.executeConversionJob('job-123');

      // Should have updated progress multiple times
      const updateCalls = (prisma.conversionJob.update as jest.Mock).mock.calls as Array<[{ data: { progress?: number } }]>;
      const progressUpdates = updateCalls.filter(call =>
        call[0].data.progress !== undefined && call[0].data.progress < 100
      );

      expect(progressUpdates.length).toBeGreaterThan(0);
    });

    it('should increment attempt counter on failure', async () => {
      const failingConverter = new MockConverter();
      failingConverter.convert = jest.fn().mockResolvedValue(
        createErrorResult(new Error('Conversion failed'))
      );

      mockGetConverter.mockReturnValue(
        createSuccessResult(failingConverter)
      );

      (prisma.conversionJob.findUnique as jest.Mock).mockResolvedValue({
        ...mockJob,
        attempts: 1
      });

      await service.executeConversionJob('job-123');

      // Check that attempts is incremented in the PROCESSING update
      expect(prisma.conversionJob.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: expect.objectContaining({
          status: ConversionStatus.PROCESSING,
          attempts: { increment: 1 }
        })
      });
    });

    it('should set completedAt timestamp on completion', async () => {
      await service.executeConversionJob('job-123');

      expect(prisma.conversionJob.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: expect.objectContaining({
          status: ConversionStatus.COMPLETED,
          completedAt: expect.any(Date)
        })
      });
    });
  });

  describe('getJobStatus', () => {
    it('should return job status', async () => {
      const mockJob = {
        id: 'job-123',
        status: ConversionStatus.PROCESSING,
        progress: 50,
        errorMessage: null,
        attempts: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (prisma.conversionJob.findUnique as jest.Mock).mockResolvedValue(mockJob);

      const result = await service.getJobStatus('job-123');

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.data.status).toBe('PROCESSING');
        expect(result.data.progress).toBe(50);
      }
    });

    it('should return error if job not found', async () => {
      (prisma.conversionJob.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getJobStatus('non-existent');

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error.message).toContain('not found');
      }
    });
  });

  describe('cancelJob', () => {
    it('should cancel a pending job', async () => {
      const mockJob = {
        id: 'job-123',
        status: ConversionStatus.PENDING
      };

      (prisma.conversionJob.update as jest.Mock).mockResolvedValue({
        ...mockJob,
        status: ConversionStatus.CANCELLED
      });

      const result = await service.cancelJob('job-123');

      expect(result.status).toBe('success');
      expect(prisma.conversionJob.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: expect.objectContaining({
          status: ConversionStatus.CANCELLED
        })
      });
    });

    it('should cancel completed jobs (implementation does not check status)', async () => {
      const mockJob = {
        id: 'job-123',
        status: ConversionStatus.COMPLETED
      };

      (prisma.conversionJob.update as jest.Mock).mockResolvedValue({
        ...mockJob,
        status: ConversionStatus.CANCELLED
      });

      const result = await service.cancelJob('job-123');

      expect(result.status).toBe('success');
      expect(prisma.conversionJob.update).toHaveBeenCalledWith({
        where: { id: 'job-123' },
        data: expect.objectContaining({
          status: ConversionStatus.CANCELLED
        })
      });
    });

    it('should handle database errors when cancelling', async () => {
      (prisma.conversionJob.update as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const result = await service.cancelJob('job-123');

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error.message).toContain('Database error');
      }
    });
  });

  describe('getPendingJobs', () => {
    it('should return pending jobs', async () => {
      const mockJobs = [
        { id: 'job-1' },
        { id: 'job-2' }
      ];

      (prisma.conversionJob.findMany as jest.Mock).mockResolvedValue(mockJobs);

      const result = await service.getPendingJobs();

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.data).toHaveLength(2);
        expect(result.data).toEqual(['job-1', 'job-2']);
      }
    });

    it('should respect limit parameter', async () => {
      (prisma.conversionJob.findMany as jest.Mock).mockResolvedValue([]);

      await service.getPendingJobs(20);

      expect(prisma.conversionJob.findMany).toHaveBeenCalledWith({
        where: { status: ConversionStatus.PENDING },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        take: 20,
        select: { id: true }
      });
    });

    it('should order by priority and creation time', async () => {
      (prisma.conversionJob.findMany as jest.Mock).mockResolvedValue([]);

      await service.getPendingJobs();

      expect(prisma.conversionJob.findMany).toHaveBeenCalledWith({
        where: { status: ConversionStatus.PENDING },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        take: 10,
        select: { id: true }
      });
    });
  });

  describe('getStatistics', () => {
    it('should return service statistics', async () => {
      (prisma.conversionJob.count as jest.Mock).mockResolvedValue(0);

      const stats = await service.getStatistics();

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('processing');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('cancelled');
    });
  });
});
