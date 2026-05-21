// @file-size-justified: Core tRPC router — splitting procedures across files breaks router type inference
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { schedule as scheduleChapterCheck } from '@/server/queue/checkChapters';
import { checkOutOfSyncChapters } from '@/server/queue/checkOutOfSyncChapters';
import { enqueueFixOutOfSyncChaptersTask } from '@/server/queue/fixOutOfSyncChapters';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure, publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import { logInfo, EventType, EventSource } from '@/utils/system-event-logger';

// ============================================================================
// Zod Schemas
// ============================================================================

const idSchema = z.object({
  id: z.number()
});

const mangaIdSchema = z.object({
  mangaId: z.number()
});

const autoDownloadConfigSchema = z.object({
  enabled: z.boolean(),
  checkInterval: z.number().int().positive(),
  minQuality: z.string().optional(),
  maxSize: z.number().int().positive().optional(),
  preferredGroups: z.array(z.string()).optional(),
  excludeGroups: z.array(z.string()).optional(),
  format: z.enum(['raw', 'cbz', 'pdf']).optional(),
  language: z.string().optional(),
});

// ============================================================================
// Router Definition
// ============================================================================

export const monitoringRouter = router({
  /**
   * Get auto-download configuration for a manga
   */
  getAutoDownloadConfig: publicProcedure
    .input(mangaIdSchema)
    .query(async ({ input, ctx }): Promise<{
      enabled: boolean;
      checkInterval: number;
      minQuality?: string;
      maxSize?: number;
      preferredGroups?: string[];
      excludeGroups?: string[];
      language?: string;
      format?: string;
    }> => {
      const { mangaId } = input;
      logger.info(`Getting auto-download config for manga ${mangaId}`);

      const rule = await ctx.prisma.autoDownloadRule.findUnique({
        where: { mangaId }
      });

      if (!rule) {
        // Return default config if no rule exists
        return {
          enabled: false,
          checkInterval: 3600,
          minQuality: 'medium',
          maxSize: 100 * 1024 * 1024,
          preferredGroups: [],
          excludeGroups: [],
          language: 'en',
          format: 'cbz'
        };
      }

      const result: {
        enabled: boolean;
        checkInterval: number;
        minQuality?: string;
        maxSize?: number;
        preferredGroups?: string[];
        excludeGroups?: string[];
        language?: string;
        format?: string;
      } = {
        enabled: rule.enabled,
        checkInterval: rule.checkInterval,
        preferredGroups: rule.preferredGroups,
        excludeGroups: rule.excludeGroups,
      };

      if (rule.minQuality !== null) result.minQuality = rule.minQuality;
      if (rule.maxSize !== null) result.maxSize = rule.maxSize;
      if (rule.language !== null) result.language = rule.language;
      if (rule.format !== null) result.format = rule.format;

      return result;
    }),

  /**
   * Configure auto-download settings for a manga
   */
  configureAutoDownload: protectedProcedure
    .input(z.object({
      mangaId: z.number(),
      config: autoDownloadConfigSchema
    }))
    .mutation(async ({ input, ctx }): Promise<{ success: boolean; enabled: boolean }> => {
      const { mangaId, config } = input;
      logger.info(`Configuring auto-download for manga ${mangaId}`);

      const rule = await ctx.prisma.autoDownloadRule.upsert({
        where: { mangaId },
        create: {
          mangaId,
          enabled: config.enabled,
          checkInterval: config.checkInterval,
          minQuality: config.minQuality ?? null,
          maxSize: config.maxSize ?? null,
          preferredGroups: config.preferredGroups ?? [],
          excludeGroups: config.excludeGroups ?? [],
          language: config.language ?? null,
          format: config.format ?? null
        },
        update: {
          enabled: config.enabled,
          checkInterval: config.checkInterval,
          minQuality: config.minQuality ?? null,
          maxSize: config.maxSize ?? null,
          preferredGroups: config.preferredGroups ?? [],
          excludeGroups: config.excludeGroups ?? [],
          language: config.language ?? null,
          format: config.format ?? null
        }
      });

      // Emit WebSocket event for auto-download configuration
      void realtimeEmitter.emitSystemEvent({
        eventType: 'monitoring:rule:configured',
        source: 'monitoringOperations',
        message: `Auto-download ${config.enabled ? 'enabled' : 'disabled'} for manga`,
        data: { mangaId, enabled: config.enabled, checkInterval: config.checkInterval }
      });

      return {
        success: true,
        enabled: rule.enabled
      };
    }),

  /**
   * Toggle monitoring for all chapters in a manga (auto-download rule)
   */
  toggleMonitoring: protectedProcedure
    .input(z.object({
      mangaId: z.number(),
      enabled: z.boolean()
    }))
    .mutation(async ({ input, ctx }): Promise<{ success: boolean; enabled: boolean }> => {
      const { mangaId, enabled } = input;
      logger.info(`Toggling monitoring for manga ${mangaId} to ${enabled}`);

      const rule = await ctx.prisma.autoDownloadRule.upsert({
        where: { mangaId },
        create: {
          mangaId,
          enabled,
          checkInterval: 3600
        },
        update: {
          enabled
        }
      });

      // Emit WebSocket event for monitoring toggle
      void realtimeEmitter.emitSystemEvent({
        eventType: 'monitoring:toggled',
        source: 'monitoringOperations',
        message: `Monitoring ${enabled ? 'enabled' : 'disabled'} for manga`,
        data: { mangaId, enabled }
      });

      return {
        success: true,
        enabled: rule.enabled
      };
    }),

  /**
   * Toggle monitoring for all chapters in a series (manga-wide)
   */
  toggleSeriesMonitoring: protectedProcedure
    .input(z.object({
      mangaId: z.number(),
      monitored: z.boolean()
    }))
    .mutation(async ({ input, ctx }): Promise<{ success: boolean; monitored: boolean; updatedCount: number }> => {
      const { mangaId, monitored } = input;
      logger.info(`Toggling series monitoring for manga ${mangaId} to ${monitored}`);

      const result = await ctx.prisma.chapter.updateMany({
        where: { mangaId },
        data: { monitored }
      });

      logger.info(`Updated ${result.count} chapters for manga ${mangaId}`);

      // Emit WebSocket event for series monitoring toggle
      void realtimeEmitter.emitSystemEvent({
        eventType: 'monitoring:series:toggled',
        source: 'monitoringOperations',
        message: `Series monitoring ${monitored ? 'enabled' : 'disabled'} for ${result.count} chapters`,
        data: { mangaId, monitored, updatedCount: result.count }
      });

      return {
        success: true,
        monitored,
        updatedCount: result.count
      };
    }),

  /**
   * Toggle monitoring for all chapters in a specific volume
   */
  toggleVolumeMonitoring: protectedProcedure
    .input(z.object({
      mangaId: z.number(),
      volumeNumber: z.number(),
      monitored: z.boolean()
    }))
    .mutation(async ({ input, ctx }): Promise<{ success: boolean; monitored: boolean; updatedCount: number }> => {
      const { mangaId, volumeNumber, monitored } = input;
      logger.info(`Toggling volume ${volumeNumber} monitoring for manga ${mangaId} to ${monitored}`);

      const result = await ctx.prisma.chapter.updateMany({
        where: {
          mangaId,
          volume: volumeNumber
        },
        data: { monitored }
      });

      logger.info(`Updated ${result.count} chapters in volume ${volumeNumber} for manga ${mangaId}`);

      // Emit WebSocket event for volume monitoring toggle
      void realtimeEmitter.emitSystemEvent({
        eventType: 'monitoring:volume:toggled',
        source: 'monitoringOperations',
        message: `Volume ${volumeNumber} monitoring ${monitored ? 'enabled' : 'disabled'}`,
        data: { mangaId, volumeNumber, monitored, updatedCount: result.count }
      });

      return {
        success: true,
        monitored,
        updatedCount: result.count
      };
    }),

  /**
   * Toggle monitoring for a single chapter
   */
  toggleChapterMonitoring: protectedProcedure
    .input(z.object({
      chapterId: z.number(),
      monitored: z.boolean()
    }))
    .mutation(async ({ input, ctx }): Promise<{ success: boolean; monitored: boolean; chapterId: number }> => {
      const { chapterId, monitored } = input;
      logger.info(`Toggling chapter ${chapterId} monitoring to ${monitored}`);

      const result = await ctx.prisma.chapter.update({
        where: { id: chapterId },
        data: { monitored }
      });

      // Emit WebSocket event for chapter monitoring toggle
      void realtimeEmitter.emitChapterUpdate({
        chapterId,
        mangaId: result.mangaId,
        action: 'updated',
        data: { monitored, field: 'monitoring' }
      });

      return {
        success: true,
        monitored: result.monitored,
        chapterId: result.id
      };
    }),

  /**
   * Get monitoring statistics for a manga
   *
   * Returns aggregate monitoring stats for series, volumes, and individual chapters
   */
  getMonitoringStats: publicProcedure
    .input(z.object({
      mangaId: z.number(),
      volumeNumber: z.number().optional()
    }))
    .query(async ({ input, ctx }): Promise<{
      mangaId: number;
      volumeNumber?: number;
      monitoredCount: number;
      totalCount: number;
      allMonitored: boolean;
      noneMonitored: boolean;
      someMonitored: boolean;
      volumeStats?: Array<{
        volumeNumber: number;
        monitoredCount: number;
        totalCount: number;
        allMonitored: boolean;
        noneMonitored: boolean;
        someMonitored: boolean;
      }>;
    }> => {
      const { mangaId, volumeNumber } = input;

      if (volumeNumber !== undefined) {
        // Get stats for a specific volume
        const chapters = await ctx.prisma.chapter.findMany({
          where: {
            mangaId,
            volume: volumeNumber
          },
          select: {
            id: true,
            monitored: true,
            volume: true
          }
        });

        const monitoredCount = chapters.filter(ch => ch.monitored).length;
        const totalCount = chapters.length;

        return {
          mangaId,
          volumeNumber,
          monitoredCount,
          totalCount,
          allMonitored: totalCount > 0 && monitoredCount === totalCount,
          noneMonitored: monitoredCount === 0,
          someMonitored: monitoredCount > 0 && monitoredCount < totalCount
        };
      } else {
        // Get stats for entire series
        const chapters = await ctx.prisma.chapter.findMany({
          where: { mangaId },
          select: {
            id: true,
            monitored: true,
            volume: true
          }
        });

        const monitoredCount = chapters.filter(ch => ch.monitored).length;
        const totalCount = chapters.length;

        // Group by volume for volume-level stats
        const volumeStats = new Map<number, { monitored: number; total: number }>();
        chapters.forEach(ch => {
          const vol = ch.volume ?? -1;
          if (!volumeStats.has(vol)) {
            volumeStats.set(vol, { monitored: 0, total: 0 });
          }
          const stats = volumeStats.get(vol);
          if (stats) {
            stats.total++;
            if (ch.monitored) stats.monitored++;
          }
        });

        return {
          mangaId,
          monitoredCount,
          totalCount,
          allMonitored: totalCount > 0 && monitoredCount === totalCount,
          noneMonitored: monitoredCount === 0,
          someMonitored: monitoredCount > 0 && monitoredCount < totalCount,
          volumeStats: Array.from(volumeStats.entries()).map(([vol, stats]) => ({
            volumeNumber: vol,
            monitoredCount: stats.monitored,
            totalCount: stats.total,
            allMonitored: stats.total > 0 && stats.monitored === stats.total,
            noneMonitored: stats.monitored === 0,
            someMonitored: stats.monitored > 0 && stats.monitored < stats.total
          }))
        };
      }
    }),

  /**
   * Check for new chapters
   *
   * Schedules a chapter check for the specified manga, bypassing interval checks
   *
   * @param input Object containing manga ID
   * @returns Success result with message
   */
  checkForNewChapters: protectedProcedure
    .input(z.object({
      id: z.number()
    }))
    .mutation(async ({ input }): Promise<{ success: boolean; data: { message: string } }> => {
      const { id } = input;

      try {
        // Get manga with necessary relations
        const manga = await prisma.manga.findUnique({
          where: { id },
          include: {
            Library: true,
            Metadata: true,
            Chapter: true
          }
        });

        if (!manga) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Manga not found'
          });
        }

        // Schedule chapter check (force=true bypasses interval checks)
        await scheduleChapterCheck(manga, true);

        logger.info(`[checkForNewChapters] Scheduled chapter check for manga: ${manga.title}`);

        await logInfo(
          `Scheduled chapter check for ${manga.title}`,
          EventType.TASK_STARTED,
          EventSource.SYSTEM,
          {
            relatedEntityId: toStringId(id),
            relatedEntityType: 'manga',
            details: {
              mangaTitle: manga.title,
              forced: true
            }
          }
        );

        // Emit WebSocket event for chapter check queued
        void realtimeEmitter.emitSystemEvent({
          eventType: 'monitoring:check:queued',
          source: 'monitoringOperations',
          message: `Chapter check scheduled for ${manga.title}`,
          data: { mangaId: id, mangaTitle: manga.title }
        });

        return {
          success: true,
          data: {
            message: `Chapter check scheduled for ${manga.title}`
          }
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`[checkForNewChapters] Failed to schedule chapter check for manga ID ${id}: ${errorMessage}`);

        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to schedule chapter check: ${errorMessage}`
        });
      }
    }),

  /**
   * Check for out-of-sync chapters
   *
   * @param input Object containing manga ID
   * @returns Success message with count of out-of-sync chapters
   */
  checkOutOfSyncChapters: protectedProcedure
    .input(mangaIdSchema)
    .mutation(async ({ input, ctx }): Promise<{ success: boolean; message: string; outOfSyncCount: number }> => {
      const { mangaId } = input;
      logger.info(`Checking for out of sync chapters for manga ID ${mangaId}`);

      const manga = await ctx.prisma.manga.findUnique({
        where: {
          id: mangaId
        },
        include: {
          Chapter: true,
        }
      });

      if (!manga) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Manga not found.'
        });
      }

      try {
        // Check for out of sync chapters
        await checkOutOfSyncChapters(mangaId);
        const _updatedManga = await ctx.prisma.manga.findUnique({
          where: {
            id: mangaId
          },
          include: {
            Metadata: true,
            Library: true,
            Chapter: true
          }
        });
        const outOfSyncCount = 0; // OutOfSyncChapter model removed
        logger.info(`Successfully checked for out of sync chapters for manga ID ${mangaId}, found ${outOfSyncCount}`);

        // Emit WebSocket event for sync check completion
        void realtimeEmitter.emitSystemEvent({
          eventType: 'monitoring:sync:check:completed',
          source: 'monitoringOperations',
          message: `Found ${outOfSyncCount} out of sync chapters for ${manga.title}`,
          data: { mangaId, mangaTitle: manga.title, outOfSyncCount }
        });

        return {
          success: true,
          message: `Found ${outOfSyncCount} out of sync chapters for ${manga.title}`,
          outOfSyncCount: outOfSyncCount
        };
      } catch (error: unknown) {
        const _errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error checking for out of sync chapters for manga ID ${mangaId}: ${error instanceof Error ? error.message : String(error)}`);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to check for out of sync chapters: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }),

  /**
   * Fix out-of-sync chapters
   *
   * @param input Object containing manga ID
   * @returns Success message
   */
  fixOutOfSyncChapters: protectedProcedure
    .input(idSchema)
    .mutation(async ({ input, ctx }): Promise<{ success: boolean; message: string }> => {
      const { id } = input;
      logger.info(`Fixing out of sync chapters for manga ID ${id}`);

      const manga = await ctx.prisma.manga.findUnique({
        where: {
          id
        },
        include: {
        }
      });

      if (!manga) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Manga not found.'
        });
      }

      // Out-of-sync is now tracked via Job system - always proceed with fix attempt
      // Check if there are any pending FIX_OUT_OF_SYNC jobs for this manga
      try {
        // Enqueue the task to fix out of sync chapters
        await enqueueFixOutOfSyncChaptersTask(id);
        logger.info(`Successfully enqueued fix out of sync chapters task for manga ID ${id}`);

        // Emit WebSocket event for sync fix queued
        void realtimeEmitter.emitSystemEvent({
          eventType: 'monitoring:sync:fix:queued',
          source: 'monitoringOperations',
          message: `Started fixing out of sync chapters for ${manga.title}`,
          data: { mangaId: id, mangaTitle: manga.title }
        });

        return {
          success: true,
          message: `Started fixing out of sync chapters for ${manga.title}`
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error fixing out of sync chapters for manga ID ${id}: ${errorMessage}`);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fix out of sync chapters: ${errorMessage}`
        });
      }
    }),

  /**
   * Toggle monitoring for all chapters in multiple manga (bulk operation)
   */
  bulkToggleMonitoring: publicProcedure
    .input(z.object({
      mangaIds: z.array(z.number()),
      monitored: z.boolean()
    }))
    .mutation(async ({ input, ctx }): Promise<{
      success: boolean;
      totalUpdated: number;
      mangaCount: number;
      errors: string[];
    }> => {
      const { mangaIds, monitored } = input;
      const errors: string[] = [];
      let totalUpdated = 0;
      let successfulMangaCount = 0;

      logger.info(`Bulk toggling monitoring for ${mangaIds.length} manga to ${monitored}`);

      const updatePromises = mangaIds.map(async (mangaId) => {
        try {
          const result = await ctx.prisma.chapter.updateMany({
            where: { mangaId },
            data: { monitored }
          });

          totalUpdated += result.count;
          successfulMangaCount++;
          logger.info(`Updated ${result.count} chapters for manga ${mangaId} to monitored=${monitored}`);
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to update monitoring for manga ${mangaId}: ${errorMessage}`);
          logger.error(`Failed to update monitoring for manga ${mangaId}:`, { error: errorMessage });
        }
      });

      await Promise.all(updatePromises);

      logger.info('Bulk monitoring toggle complete', {
        totalUpdated,
        mangaCount: successfulMangaCount,
        errorCount: errors.length
      });

      // Emit WebSocket event for bulk monitoring toggle
      void realtimeEmitter.emitSystemEvent({
        eventType: 'monitoring:bulk:toggled',
        source: 'monitoringOperations',
        message: `Bulk monitoring ${monitored ? 'enabled' : 'disabled'} for ${successfulMangaCount} manga (${totalUpdated} chapters)`,
        data: { mangaCount: successfulMangaCount, totalUpdated, monitored, errorCount: errors.length }
      });

      return {
        success: true,
        totalUpdated,
        mangaCount: successfulMangaCount,
        errors
      };
    })
});
