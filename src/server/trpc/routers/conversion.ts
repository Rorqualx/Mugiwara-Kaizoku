/**
 * Conversion Router
 *
 * tRPC router for file format conversion operations.
 * Provides endpoints for creating, executing, and managing conversion jobs.
 *
 * @module conversion-router
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { getConversionService, ConverterFactory } from '@/server/services/conversion';
import { conversionFormatSchema } from '@/server/services/conversion/BaseConverter';
import { checkFfmpegAvailable } from '@/server/services/conversion/utils/audio-extractor';
import { logger } from '@/utils/logger';

import { protectedProcedure } from '../procedures';
import { router } from '../trpc';
import type {} from '@prisma/client';

/**
 * Validation schemas
 */

const createConversionJobSchema = z.object({
  mangaId: z.number().int().positive(),
  chapterId: z.number().int().positive(),
  sourceFile: z.string().min(1),
  targetFile: z.string().min(1),
  sourceFormat: conversionFormatSchema,
  targetFormat: conversionFormatSchema,
  priority: z.number().int().min(1).max(100).optional().default(50),
  maxAttempts: z.number().int().min(1).max(10).optional().default(3),
  quality: z.number().int().min(1).max(100).optional(),
  compression: z.number().int().min(0).max(9).optional(),
  bitrate: z.string().regex(/^\d+k$/i, 'bitrate must look like "192k"').optional(),
  metadata: z.record(z.unknown()).optional()
});

const jobIdSchema = z.object({
  jobId: z.string().min(1)
});

const getPendingJobsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(10)
});

const conversionFormatsSchema = z.object({
  sourceFormat: conversionFormatSchema,
  targetFormat: conversionFormatSchema
});

/**
 * Conversion Router
 *
 * Exposes format conversion functionality via tRPC endpoints
 */
export const conversionRouter = router({
  /**
   * Create a new conversion job
   */
  createJob: protectedProcedure
    .input(createConversionJobSchema)
    .mutation(async ({ input }) => {
      try {
        logger.info('[ConversionRouter] Creating conversion job', {
          mangaId: input.mangaId,
          chapterId: input.chapterId,
          sourceFormat: input.sourceFormat,
          targetFormat: input.targetFormat
        });

        const conversionService = getConversionService();

        const result = await conversionService.createConversionJob({
          mangaId: input.mangaId,
          chapterId: input.chapterId,
          sourceFile: input.sourceFile,
          targetFile: input.targetFile,
          sourceFormat: input.sourceFormat,
          targetFormat: input.targetFormat,
          priority: input.priority,
          maxAttempts: input.maxAttempts,
          ...(input.quality !== undefined ? { quality: input.quality } : {}),
          ...(input.compression !== undefined ? { compression: input.compression } : {}),
          ...(input.bitrate !== undefined ? { bitrate: input.bitrate } : {}),
          ...(input.metadata !== undefined ? { metadata: input.metadata } : {})
        });

        if (result.status === 'error') {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error.message
          });
        }

        if (result.status !== 'success') {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Unexpected result status'
          });
        }

        // Note: realtime emit happens inside FormatConversionService.createConversionJob
        // — emitting here too would double-fire the 'jobs:conversion' channel.
        return {
          jobId: result.data,
          message: 'Conversion job created successfully'
        };
      } catch (error: unknown) {
        logger.error('[ConversionRouter] Failed to create conversion job', error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create conversion job'
        });
      }
    }),

  /**
   * Execute a conversion job
   */
  executeJob: protectedProcedure
    .input(jobIdSchema)
    .mutation(async ({ input }) => {
      try {
        logger.info('[ConversionRouter] Executing conversion job', {
          jobId: input.jobId
        });

        const conversionService = getConversionService();

        const result = await conversionService.executeConversionJob(input.jobId);

        if (result.status === 'error') {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error.message
          });
        }

        if (result.status !== 'success') {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Unexpected result status'
          });
        }

        // Note: realtime emit happens inside FormatConversionService.executeConversionJob.
        return {
          success: true,
          result: {
            outputPath: result.data.outputPath,
            fileSize: result.data.fileSize,
            pageCount: result.data.pageCount,
            duration: result.data.duration
          }
        };
      } catch (error: unknown) {
        logger.error('[ConversionRouter] Failed to execute conversion job', error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to execute conversion job'
        });
      }
    }),

  /**
   * Get conversion job status
   */
  getJobStatus: protectedProcedure
    .input(jobIdSchema)
    .query(async ({ input }) => {
      try {
        const conversionService = getConversionService();

        const result = await conversionService.getJobStatus(input.jobId);

        if (result.status === 'error') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: result.error.message
          });
        }

        if (result.status !== 'success') {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Unexpected result status'
          });
        }

        return result.data;
      } catch (error: unknown) {
        logger.error('[ConversionRouter] Failed to get job status', error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get job status'
        });
      }
    }),

  /**
   * Cancel a conversion job
   */
  cancelJob: protectedProcedure
    .input(jobIdSchema)
    .mutation(async ({ input }) => {
      try {
        logger.info('[ConversionRouter] Cancelling conversion job', {
          jobId: input.jobId
        });

        const conversionService = getConversionService();

        const result = await conversionService.cancelJob(input.jobId);

        if (result.status === 'error') {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error.message
          });
        }

        // Note: realtime emit happens inside FormatConversionService.cancelJob
        // (status: 'cancelled' on the canonical channel).
        return {
          success: true,
          message: 'Conversion job cancelled successfully'
        };
      } catch (error: unknown) {
        logger.error('[ConversionRouter] Failed to cancel job', error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to cancel job'
        });
      }
    }),

  /**
   * Get pending conversion jobs
   */
  getPendingJobs: protectedProcedure
    .input(getPendingJobsSchema)
    .query(async ({ input }) => {
      try {
        const conversionService = getConversionService();

        const result = await conversionService.getPendingJobs(input.limit);

        if (result.status === 'error') {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error.message
          });
        }

        if (result.status !== 'success') {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Unexpected result status'
          });
        }

        return {
          jobIds: result.data,
          count: result.data.length
        };
      } catch (error: unknown) {
        logger.error('[ConversionRouter] Failed to get pending jobs', error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get pending jobs'
        });
      }
    }),

  /**
   * Get conversion statistics
   */
  getStatistics: protectedProcedure
    .query(async () => {
      try {
        const conversionService = getConversionService();
        const serviceStats = await conversionService.getStatistics();
        const factoryStats = ConverterFactory.getStatistics();

        return {
          service: serviceStats,
          factory: factoryStats
        };
      } catch (error: unknown) {
        logger.error('[ConversionRouter] Failed to get statistics', error);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get statistics'
        });
      }
    }),

  /**
   * Check if a conversion is supported
   */
  isConversionSupported: protectedProcedure
    .input(conversionFormatsSchema)
    .query(({ input }) => {
      try {
        const isSupported = ConverterFactory.isConversionSupported(
          input.sourceFormat,
          input.targetFormat
        );

        return {
          supported: isSupported,
          sourceFormat: input.sourceFormat,
          targetFormat: input.targetFormat
        };
      } catch (error: unknown) {
        logger.error('[ConversionRouter] Failed to check conversion support', error);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to check conversion support'
        });
      }
    }),

  /**
   * Get all supported formats
   */
  getSupportedFormats: protectedProcedure
    .query(() => {
      try {
        const sourceFormats = ConverterFactory.getSupportedSourceFormats();
        const targetFormats = ConverterFactory.getSupportedTargetFormats();

        return {
          sourceFormats,
          targetFormats
        };
      } catch (error: unknown) {
        logger.error('[ConversionRouter] Failed to get supported formats', error);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get supported formats'
        });
      }
    }),

  /**
   * Get registered converters
   */
  getConverters: protectedProcedure
    .query(() => {
      try {
        const converters = ConverterFactory.getRegisteredConverters();

        return {
          converters,
          count: converters.length
        };
      } catch (error: unknown) {
        logger.error('[ConversionRouter] Failed to get converters', error);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get converters'
        });
      }
    }),

  /**
   * Check if FFmpeg is available
   */
  checkFfmpegStatus: protectedProcedure
    .query(async () => {
      try {
        const result = await checkFfmpegAvailable();

        if (result.status === 'error') {
          return {
            available: false,
            error: result.error.message
          };
        }

        // Extract the boolean value from the success result
        const isAvailable = result.status === 'success' && result.data === true;

        return {
          available: isAvailable,
          error: null
        };
      } catch (error: unknown) {
        logger.error('[ConversionRouter] Failed to check FFmpeg status', error);

        return {
          available: false,
          error: error instanceof Error ? error.message : 'Failed to check FFmpeg status'
        };
      }
    })
});

export type ConversionRouter = typeof conversionRouter;
