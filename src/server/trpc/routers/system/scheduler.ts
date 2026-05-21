/**
 * System Scheduler Router
 *
 * Handles auto-download scheduler configuration.
 *
 * Procedures:
 * - getAutoDownloadSchedulerInterval: Get current scheduler interval
 * - setAutoDownloadSchedulerInterval: Update scheduler interval
 *
 * Extracted from: system.ts (lines 1376-1455)
 *
 * @module system/scheduler
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { getGlobalConfigService } from '@/server/services/config/globalConfigService';
import { eventEmitter } from '@/server/services/eventEmitter';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { configReader } from '@/server/utils/configReader';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logging';

/** Scheduler interval response type */
interface SchedulerIntervalResponse {
  interval: number;
  intervalHours: number;
}

/** Set scheduler interval success response type */
interface SetSchedulerIntervalSuccess extends SchedulerIntervalResponse {
  message: string;
}

/** Auto-download scheduler interface for dynamic import */
interface AutoDownloadSchedulerModule {
  autoDownloadScheduler: {
    setInterval: (seconds: number) => void;
  };
}

// Both procedures are intentionally `protectedProcedure` (not `adminProcedure`):
// per-user scheduler tuning is allowed by design.
export const systemSchedulerRouter = router({
  /**
   * Gets the current auto-download scheduler interval from the Config table.
   * @returns Current interval in seconds and hours
   */
  getAutoDownloadSchedulerInterval: protectedProcedure.query(
    async (): Promise<SchedulerIntervalResponse> => {
      try {
        const interval = await configReader.getNumber('scheduler.autoDownload.interval', 86400);
        return { interval, intervalHours: interval / 3600 };
      } catch (error: unknown) {
        logger.error(
          `Failed to get auto-download scheduler interval: ${error instanceof Error ? error.message : String(error)}`
        );
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get scheduler interval'
        });
      }
    }
  ),

  /**
   * Sets the auto-download scheduler interval and restarts the scheduler.
   * @param input.intervalSeconds - New interval (min: 300s, max: 604800s)
   * @returns Updated interval and success message
   */
  setAutoDownloadSchedulerInterval: protectedProcedure
    .input(
      z.object({
        intervalSeconds: z
          .number()
          .min(300, 'Interval must be at least 5 minutes (300 seconds)')
          .max(604800, 'Interval cannot exceed 7 days (604800 seconds)')
      })
    )
    .mutation(
      async ({ input }): Promise<AsyncResult<SetSchedulerIntervalSuccess, Error>> => {
        try {
          const { intervalSeconds } = input;
          const intervalHours = intervalSeconds / 3600;

          logger.info(`Updating auto-download scheduler interval to ${intervalSeconds}s (${intervalHours}h)`);

          // Get ConfigService and initialize if needed
          const configService = getGlobalConfigService();
          if (!configService.isInitialized()) {
            await configService.initialize();
          }

          // Update the interval in Config table
          await configService.set('scheduler.autoDownload.interval', intervalSeconds);

          // Update the running scheduler with the new interval
          const schedulerModule = await import(
            '@/server/queue/autoDownloadScheduler'
          ) as AutoDownloadSchedulerModule;
          schedulerModule.autoDownloadScheduler.setInterval(intervalSeconds);

          logger.info(`Auto-download scheduler interval updated successfully`);

          // Emit notification
          await eventEmitter.emit('system:warning', {
            message: `Auto-download scheduler interval updated to ${intervalSeconds}s (${intervalHours}h)`,
            context: 'scheduler-config'
          });

          // Emit WebSocket event for real-time sync
          void realtimeEmitter.emitSystemEvent({
            eventType: 'scheduler:updated',
            source: 'system-scheduler',
            message: `Auto-download scheduler interval updated to ${intervalHours.toFixed(1)} hours`,
            data: {
              intervalSeconds,
              intervalHours,
            },
          });

          return createSuccessResult({
            interval: intervalSeconds,
            intervalHours,
            message: `Scheduler interval updated to ${intervalSeconds} seconds (${intervalHours.toFixed(1)} hours)`
          });
        } catch (error: unknown) {
          logger.error(
            `Failed to set auto-download scheduler interval: ${error instanceof Error ? error.message : String(error)}`
          );
          return createErrorResult(
            error instanceof Error ? error : new Error('Failed to set scheduler interval')
          );
        }
      }
    )
});
