/**
 * Pattern Change Notification Processor
 *
 * Sends notifications for release pattern changes.
 * Uses batch processing to avoid await-in-loop violations.
 *
 * Extracted from: calendarNotificationWorker.ts (lines 315-381)
 */

import { prisma } from '@/server/db';
import { NotificationService } from '@/server/services/notifications/NotificationService';
import { createSuccessResult, createErrorResult, isSuccess } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { createLogger } from '@/utils/logger';

import {
  isNotificationSent,
  markNotificationSent,
  processNotificationsInBatch,
  getPatternChangeMessage
} from './utils';

import type { NotificationConfig, ReleaseScheduleWithManga } from './types';
import type { Prisma } from '@prisma/client';

const logger = createLogger('PatternChangeProcessor');

/**
 * Send notifications for pattern changes
 *
 * Handles sending notifications when release patterns are detected to have changed.
 * Uses batch processing to avoid await-in-loop violations and improve performance.
 *
 * @param config - Notification configuration
 * @param notificationService - Service for sending notifications
 * @returns AsyncResult with count of sent and failed notifications
 */
export async function sendPatternChangeNotifications(
  config: NotificationConfig,
  notificationService: NotificationService
): Promise<AsyncResult<{ sent: number; failed: number }, Error>> {
  try {
    // Get recently updated schedules
    const scheduleFindOptions: Record<string, unknown> = {
      where: {
        lastUpdated: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Updated in last 24 hours
        },
        manga: {
          monitoringConfig: {
            path: ['notificationsEnabled'],
            equals: true
          }
        }
      },
      include: {
        manga: true
      }
    };

    if (config.batchSize !== undefined) {
      scheduleFindOptions['take'] = config.batchSize;
    }

    const updatedSchedules = await prisma.releaseSchedule.findMany(
      scheduleFindOptions as Prisma.ReleaseScheduleFindManyArgs
    ) as ReleaseScheduleWithManga[];

    logger.info(`Found ${updatedSchedules.length} updated schedules`);

    // Process notifications in batch (FIXES await-in-loop violations)
    const results = await processNotificationsInBatch(
      updatedSchedules,
      async (schedule) => {
        try {
          const alreadySent = await isNotificationSent(schedule.id, 'pattern_changed', 'schedule');
          if (alreadySent) {
            return { skipped: true };
          }

          const message = getPatternChangeMessage(schedule);
          const mangaTitle = schedule.manga?.mangaTitle ?? schedule.manga?.title ?? 'Unknown';

          const result = await notificationService.send({
            type: 'PATTERN_CHANGED',
            title: `Release Pattern Updated: ${mangaTitle}`,
            message,
            priority: 'low',
            metadata: {
              mangaId: schedule.mangaId,
              scheduleId: schedule.id,
              releaseType: schedule.releaseType,
              confidence: schedule.confidence
            }
          });

          if (isSuccess(result)) {
            await markNotificationSent(schedule.id, 'pattern_changed', 'schedule');
            return { sent: true };
          }

          return { failed: true };
        } catch (error: unknown) {
          logger.error(`Error sending pattern notification for schedule ${schedule.id}`, { error });
          return { failed: true };
        }
      }
    );

    return createSuccessResult({ sent: results.sent, failed: results.failed });
  } catch (error: unknown) {
    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
}
