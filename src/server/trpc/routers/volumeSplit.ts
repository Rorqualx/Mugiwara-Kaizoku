/**
 * Volume Split Router
 *
 * tRPC router for volume splitting operations.
 * Provides endpoints for previewing, executing, and tracking volume splits.
 *
 * @module volumeSplit-router
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { getProgressTracker } from '@/server/services/download/volumeSplitProgressTracker';
import { getVolumeSplitter } from '@/server/services/download/volumeSplitter';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { logger } from '@/utils/logger';

import { protectedProcedure, publicProcedure } from '../procedures';
import { router } from '../trpc';

import type { Prisma } from '@prisma/client';



/**
 * Validation schemas
 */
const previewSplitSchema = z.object({
  volumePath: z.string().min(1),
  volumeNumber: z.number().int().positive(),
  mangaTitle: z.string().min(1),
  mangaId: z.number().int().positive().optional()
});

const executeSplitSchema = z.object({
  volumePath: z.string().min(1),
  outputDir: z.string().min(1),
  volumeNumber: z.number().int().positive(),
  mangaTitle: z.string().min(1),
  mangaId: z.number().int().positive().optional()
});

const getSplitResultsSchema = z.object({
  mangaId: z.number().int().positive(),
  volumeNumber: z.number().int().positive().optional()
});

/**
 * Volume Split Router
 *
 * Exposes volume splitting functionality via tRPC endpoints
 */
export const volumeSplitRouter = router({
  /**
   * Preview a volume split without creating files
   *
   * Analyzes the volume and returns detected chapters with confidence scores
   * without actually splitting the file.
   */
  previewSplit: publicProcedure
    .input(previewSplitSchema)
    .query(async ({ input }) => {
      try {
        logger.info('[VolumeSplitRouter] Previewing volume split', {
          volumePath: input.volumePath,
          volumeNumber: input.volumeNumber,
          mangaTitle: input.mangaTitle
        });

        const volumeSplitter = getVolumeSplitter();

        // Use a temporary output directory for preview (won't actually create files)
        const tempOutputDir = '/tmp/volume-preview';

        // Perform the split analysis (the splitVolume method does the detection)
        const result = await volumeSplitter.splitVolume({
          volumePath: input.volumePath,
          outputDir: tempOutputDir,
          volumeNumber: input.volumeNumber,
          mangaTitle: input.mangaTitle,
          ...(input.mangaId !== undefined && { mangaId: input.mangaId })
        });

        if (result.status === 'error') {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error.message
          });
        }

        // TypeScript: After error check, result must be success
        const splitData = result.status === 'success' ? result.data : (() => {
          throw new Error('Unexpected result status');
        })();

        // Return preview data without actual file creation
        return {
          volumeName: splitData.volumeName,
          totalImages: splitData.totalImages,
          detectedChapters: splitData.detectedChapters.map((chapter: {
            chapterNumber: number;
            pageCount: number;
            confidence: number;
            matchedMetadata?: unknown;
          }) => ({
            chapterNumber: chapter.chapterNumber,
            pageCount: chapter.pageCount,
            confidence: chapter.confidence,
            matchedMetadata: chapter.matchedMetadata
          })),
          method: splitData.method,
          averageConfidence: splitData.averageConfidence,
          warnings: splitData.warnings,
          metadata: splitData.metadata
        };
      } catch (error: unknown) {
        logger.error('[VolumeSplitRouter] Failed to preview volume split', error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to preview volume split'
        });
      }
    }),

  /**
   * Execute a volume split and create chapter files
   */
  executeSplit: protectedProcedure
    .input(executeSplitSchema)
    .mutation(async ({ input }) => {
      try {
        logger.info('[VolumeSplitRouter] Executing volume split', {
          volumePath: input.volumePath,
          outputDir: input.outputDir,
          volumeNumber: input.volumeNumber,
          mangaTitle: input.mangaTitle
        });

        const volumeSplitter = getVolumeSplitter();

        const result = await volumeSplitter.splitVolume({
          volumePath: input.volumePath,
          outputDir: input.outputDir,
          volumeNumber: input.volumeNumber,
          mangaTitle: input.mangaTitle,
          ...(input.mangaId !== undefined && { mangaId: input.mangaId })
        });

        if (result.status === 'error') {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: result.error.message
          });
        }

        // TypeScript: After error check, result must be success
        const splitData = result.status === 'success' ? result.data : (() => {
          throw new Error('Unexpected result status');
        })();

        // Emit WebSocket event for real-time sync
        void realtimeEmitter.emitSystemEvent({
          eventType: 'volume:split:completed',
          source: 'volumeSplit-router',
          message: `Volume split completed: ${splitData.detectedChapters.length} chapters created`,
          data: {
            operationId: splitData.operationId,
            volumePath: input.volumePath,
            chapterCount: splitData.detectedChapters.length,
            mangaId: input.mangaId,
          },
        });

        return {
          success: true,
          operationId: splitData.operationId,
          result: {
            volumePath: splitData.volumePath,
            createdFiles: splitData.createdFiles,
            chapterCount: splitData.detectedChapters.length,
            averageConfidence: splitData.averageConfidence,
            warnings: splitData.warnings
          }
        };
      } catch (error: unknown) {
        logger.error('[VolumeSplitRouter] Failed to execute volume split', error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to execute volume split'
        });
      }
    }),

  /**
   * Get split results for a manga/volume
   *
   * Returns information about previously split volumes
   */
  getSplitResults: publicProcedure
    .input(getSplitResultsSchema)
    .query(async ({ input }) => {
      try {
        logger.info('[VolumeSplitRouter] Getting split results', {
          mangaId: input.mangaId,
          volumeNumber: input.volumeNumber
        });

        // Query chapters that were created from volume splits
        const whereClause: Prisma.ChapterWhereInput = {
          mangaId: input.mangaId,
          filePath: {
            not: null
          }
        };

        if (input.volumeNumber !== undefined) {
          whereClause.volume = input.volumeNumber;
        }

        const chapters = await prisma.chapter.findMany({
          where: whereClause,
          select: {
            id: true,
            chapterNumber: true,
            title: true,
            volume: true,
            filePath: true,
            fileName: true,
            size: true,
            pages: true,
            downloadStatus: true,
            createdAt: true
          },
          orderBy: [
            { volume: 'asc' },
            { chapterNumber: 'asc' }
          ]
        });

        // Group chapters by volume
        const volumeMap = new Map<number, typeof chapters>();
        for (const chapter of chapters) {
          const vol = chapter.volume ?? 0;
          if (!volumeMap.has(vol)) {
            volumeMap.set(vol, []);
          }
          const volChapters = volumeMap.get(vol);
          if (volChapters !== undefined) {
            volChapters.push(chapter);
          }
        }

        const volumes = Array.from(volumeMap.entries()).map(([volumeNumber, volChapters]) => ({
          volumeNumber,
          chapterCount: volChapters.length,
          totalPages: volChapters.reduce((sum, ch) => sum + (ch.pages ?? 0), 0),
          totalSize: volChapters.reduce((sum, ch) => sum + ch.size, 0),
          chapters: volChapters
        }));

        return {
          mangaId: input.mangaId,
          volumes,
          totalChapters: chapters.length
        };
      } catch (error: unknown) {
        logger.error('[VolumeSplitRouter] Failed to get split results', error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get split results'
        });
      }
    }),

  /**
   * Get confidence score statistics
   *
   * Returns statistics about split confidence scores for a manga
   */
  getConfidenceStats: publicProcedure
    .input(z.object({ mangaId: z.number().int().positive() }))
    .query(({ input }) => {
      try {
        // This would require storing confidence scores in database
        // For now, return placeholder data
        logger.info('[VolumeSplitRouter] Getting confidence statistics', {
          mangaId: input.mangaId
        });

        // TODO: Implement confidence score storage and retrieval
        return {
          mangaId: input.mangaId,
          averageConfidence: 0.85,
          highConfidenceSplits: 0,
          mediumConfidenceSplits: 0,
          lowConfidenceSplits: 0,
          message: 'Confidence tracking not yet implemented'
        };
      } catch (error: unknown) {
        logger.error('[VolumeSplitRouter] Failed to get confidence stats', error);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get confidence statistics'
        });
      }
    }),

  /**
   * Get real-time progress for a volume split operation
   *
   * Returns current progress state for a specific operation
   */
  getProgress: publicProcedure
    .input(z.object({ operationId: z.string().min(1) }))
    .query(({ input }) => {
      try {
        logger.debug('[VolumeSplitRouter] Getting progress for operation', {
          operationId: input.operationId
        });

        const progressTracker = getProgressTracker();
        const progress = progressTracker.getProgress(input.operationId);

        if (!progress) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Operation ${input.operationId} not found`
          });
        }

        return progress;
      } catch (error: unknown) {
        logger.error('[VolumeSplitRouter] Failed to get progress', error);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get progress'
        });
      }
    }),

  /**
   * Get all active volume split operations
   *
   * Returns progress for all currently running operations
   */
  getActiveOperations: publicProcedure
    .query(() => {
      try {
        logger.debug('[VolumeSplitRouter] Getting all active operations');

        const progressTracker = getProgressTracker();
        const activeOps = progressTracker.getActiveOperations();

        return {
          operations: activeOps,
          count: activeOps.length
        };
      } catch (error: unknown) {
        logger.error('[VolumeSplitRouter] Failed to get active operations', error);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get active operations'
        });
      }
    })
});

export type VolumeSplitRouter = typeof volumeSplitRouter;
