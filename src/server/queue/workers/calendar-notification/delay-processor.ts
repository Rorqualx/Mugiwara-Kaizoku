/**
 * Delay Notification Processor
 *
 * Sends notifications for delayed chapter releases.
 * Uses batch processing to avoid await-in-loop violations.
 *
 * Extracted from: calendarNotificationWorker.ts (lines 241-311)
 */



import { EventStatus, CalendarEventType } from '@prisma/client';

import { prisma } from '@/server/db';
import { NotificationService } from '@/server/services/notifications/NotificationService';
import { createSuccessResult, createErrorResult, isSuccess } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { createLogger } from '@/utils/logger';


import { isNotificationSent, markNotificationSent, processNotificationsInBatch } from './utils';

import type { NotificationConfig, CalendarEventWithManga, NotificationMetadata } from './types';
import type { Prisma } from '@prisma/client';

const logger = createLogger('DelayProcessor');

/**
 * Send notifications for delayed releases
 *
 * Processes all delayed calendar events and sends notifications to users.
 * Uses batch processing with Promise.allSettled to avoid await-in-loop violations.
 *
 * @param config - Notification configuration
 * @param notificationService - Service for sending notifications
 * @returns Promise with sent and failed count
 */
export async function sendDelayNotifications(
  config: NotificationConfig,
  notificationService: NotificationService
): Promise<AsyncResult<{ sent: number; failed: number }, Error>> {
  try {
    const delayedFindOptions: Record<string, unknown> = {
      where: {
        eventType: CalendarEventType.CHAPTER_RELEASE,
        status: EventStatus.DELAYED,
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
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
      delayedFindOptions['take'] = config.batchSize;
    }

    const delayedEvents = (await prisma.calendarEvent.findMany(
      delayedFindOptions as Prisma.CalendarEventFindManyArgs
    )) as CalendarEventWithManga[];

    logger.info(`Found ${delayedEvents.length} delayed releases`);

    // Process notifications in batch (FIXES await-in-loop violations)
    const results = await processNotificationsInBatch(delayedEvents, async (event) => {
      try {
        const alreadySent = await isNotificationSent(event.id, 'release_delayed');
        if (alreadySent) {
          return { skipped: true };
        }

        const metadata = (event.metadata ?? {}) as NotificationMetadata;
        const delayDays =
          metadata.daysPastDue ??
          Math.floor(
            (Date.now() - event.scheduledDate.getTime()) / (1000 * 60 * 60 * 24)
          );
        const mangaTitle =
          event.manga?.mangaTitle ?? event.manga?.title ?? 'Unknown';

        const result = await notificationService.send({
          type: 'RELEASE_DELAYED',
          title: `Release Delayed: ${mangaTitle}`,
          message: `Expected release is ${delayDays} days late`,
          priority: 'low',
          metadata: {
            ['mangaId']: event['mangaId'],
            ['eventId']: event.id,
            ['originalDate']: event.scheduledDate.toISOString(),
            ['delayDays']: delayDays
          }
        });

        if (isSuccess(result)) {
          await markNotificationSent(event.id, 'release_delayed');
          return { sent: true };
        }
        return { failed: true };
      } catch (error: unknown) {
        logger.error(
          `Error sending delay notification for event ${event.id}`,
          error instanceof Error ? error.message : String(error)
        );
        return { failed: true };
      }
    });

    return createSuccessResult({ sent: results.sent, failed: results.failed });
  } catch (error: unknown) {
    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  }
}
