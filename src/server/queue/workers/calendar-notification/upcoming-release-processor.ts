/**
 * Upcoming Release Notification Processor
 *
 * Sends notifications for upcoming chapter releases.
 * Uses batch processing to avoid await-in-loop violations.
 *
 * Extracted from: calendarNotificationWorker.ts (lines 163-237)
 */

import { EventStatus, CalendarEventType } from '@prisma/client';
import { addHours, formatDistanceToNow } from 'date-fns';


import { prisma } from '@/server/db';
import { NotificationService } from '@/server/services/notifications/NotificationService';
import { createSuccessResult, createErrorResult, isSuccess } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { createLogger } from '@/utils/logger';


import { isNotificationSent, markNotificationSent, processNotificationsInBatch } from './utils';

import type { NotificationConfig, CalendarEventWithManga } from './types';
import type { Prisma } from '@prisma/client';

const logger = createLogger('UpcomingReleaseProcessor');

/**
 * Send notifications for upcoming releases
 *
 * Processes calendar events within the notification window and sends
 * notifications for upcoming chapter releases to subscribed users.
 *
 * CRITICAL: Uses batch processing with Promise.allSettled to avoid
 * await-in-loop violations and improve performance.
 */
export async function sendUpcomingReleaseNotifications(
  config: NotificationConfig,
  notificationService: NotificationService
): Promise<AsyncResult<{ sent: number; failed: number }, Error>> {
  try {
    const notificationWindow = {
      start: new Date(),
      end: addHours(new Date(), config.leadTimeHours)
    };

    // Build query options for finding upcoming events
    const findManyOptions: Record<string, unknown> = {
      where: {
        eventType: CalendarEventType.CHAPTER_RELEASE,
        status: EventStatus.SCHEDULED,
        confidence:
          config.minConfidence !== undefined ? { gte: config.minConfidence } : undefined,
        scheduledDate: {
          gte: notificationWindow.start,
          lte: notificationWindow.end
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
      findManyOptions['take'] = config.batchSize;
    }

    const upcomingEvents = (await prisma.calendarEvent.findMany(
      findManyOptions as Prisma.CalendarEventFindManyArgs
    )) as CalendarEventWithManga[];

    logger.info(`Found ${upcomingEvents.length} upcoming releases`);

    // Process notifications in batch (FIXES await-in-loop violations)
    const results = await processNotificationsInBatch(upcomingEvents, async (event) => {
      try {
        const alreadySent = await isNotificationSent(event.id, 'upcoming_release');
        if (alreadySent) return { skipped: true };

        const mangaTitle = event.manga?.mangaTitle ?? event.manga?.title ?? 'Unknown';
        const result = await notificationService.send({
          type: 'UPCOMING_RELEASE',
          title: `Upcoming Release: ${mangaTitle}`,
          message: `New chapter expected ${formatDistanceToNow(event.scheduledDate, {
            addSuffix: true
          })}`,
          priority: 'normal',
          metadata: {
            mangaId: event.id,
            eventId: event.id,
            scheduledDate: event.scheduledDate.toISOString(),
            confidence: event.id
          }
        });

        if (isSuccess(result)) {
          await markNotificationSent(event.id, 'upcoming_release');
          return { sent: true };
        }
        return { failed: true };
      } catch (error: unknown) {
        logger.error(`Error sending notification for event ${event.id}`, { error });
        return { failed: true };
      }
    });

    return createSuccessResult({ sent: results.sent, failed: results.failed });
  } catch (error: unknown) {
    logger.error('Error in sendUpcomingReleaseNotifications', { error });
    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
}
