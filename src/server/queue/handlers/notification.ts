/**
 * Notification Job Handlers
 *
 * Delegates row persistence + realtime emit + external channel dispatch to the
 * unified `notifyUser` / `notifySystem` helpers in
 * `src/server/services/notifications/notify.ts`. The handler now only deals
 * with payload validation and the per-job logging.
 */

import { jobs, NotificationEventType, NotificationSeverity } from '@prisma/client';
import { z } from 'zod';

import { notifySystem, notifyUser } from '@/server/services/notifications/notify';
import { logger } from '@/utils/logger';

const NotificationSendPayloadSchema = z.object({
  type: z.string(),
  title: z.string().optional(),
  message: z.string(),
  userId: z.string().optional(),
  severity: z.enum(['INFO', 'SUCCESS', 'WARNING', 'ERROR']).optional(),
  metadata: z.record(z.unknown()).optional(),
  relatedMangaId: z.number().optional(),
  relatedChapterId: z.number().optional(),
  relatedJobId: z.union([z.bigint(), z.number()]).optional(),
  actionUrl: z.string().optional(),
});

function isValidNotificationEventType(type: string): type is NotificationEventType {
  return Object.values(NotificationEventType).includes(type as NotificationEventType);
}

export async function handleNotificationSend(job: jobs): Promise<void> {
  const result = NotificationSendPayloadSchema.safeParse(job.payload);

  if (!result.success) {
    logger.error('Invalid notification send payload:', result.error);
    throw new Error(`Invalid job payload: ${result.error.message}`);
  }

  const { type, title, message, userId, severity, metadata, relatedMangaId, relatedChapterId, relatedJobId, actionUrl } = result.data;

  if (!isValidNotificationEventType(type)) {
    logger.error(`Invalid NotificationEventType: ${type}`);
    throw new Error(`Invalid notification type: ${type}`);
  }

  const resolvedTitle = title ?? 'Notification';
  logger.info(`Sending notification: ${resolvedTitle}`, { jobId: job.id, type, userId });

  const baseParams = {
    type,
    title: resolvedTitle,
    message,
    ...(severity !== undefined ? { severity: severity as NotificationSeverity } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
    ...(relatedMangaId !== undefined ? { relatedMangaId } : {}),
    ...(relatedChapterId !== undefined ? { relatedChapterId } : {}),
    ...(relatedJobId !== undefined ? { relatedJobId: BigInt(relatedJobId) } : {}),
    ...(actionUrl !== undefined ? { actionUrl } : {}),
  };

  if (userId !== undefined) {
    await notifyUser({ ...baseParams, userId });
  } else {
    // Legacy system-wide notification path: ephemeral realtime push only.
    // Producers that want durable rows should pass `userId`. Once the
    // event-deriver lands, this branch will go away entirely.
    await notifySystem(baseParams);
  }

  logger.info(`Notification sent successfully`);
}
