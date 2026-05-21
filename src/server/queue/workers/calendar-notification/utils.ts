/**
 * Calendar Notification Utilities Module
 *
 * Shared helper functions for calendar notification processing.
 * Used across all notification processor modules.
 *
 * Extracted from: calendarNotificationWorker.ts (lines 385-490)
 */

import { prisma } from '@/server/db';
import { createLogger } from '@/utils/logger';

import type { NotificationMetadata, ReleaseScheduleWithManga } from './types';
import type { Prisma } from '@prisma/client';

const logger = createLogger('CalendarNotificationUtils');

// ============================================================================
// Pattern Message Generation
// ============================================================================

/**
 * Get pattern change message based on schedule type
 */
export function getPatternChangeMessage(schedule: ReleaseScheduleWithManga): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  switch (schedule.releaseType) {
    case 'WEEKLY':
      return `Now releasing weekly on ${days[schedule.dayOfWeek ?? 0]}s (${Math.round(schedule.confidence * 100)}% confidence)`;
    case 'BIWEEKLY':
      return `Now releasing bi-weekly on ${days[schedule.dayOfWeek ?? 0]}s (${Math.round(schedule.confidence * 100)}% confidence)`;
    case 'MONTHLY':
      return `Now releasing monthly around day ${schedule.dayOfMonth} (${Math.round(schedule.confidence * 100)}% confidence)`;
    case 'HIATUS':
      return 'Series is now on hiatus';
    case 'IRREGULAR':
      return 'Release pattern is now irregular';
    default:
      return 'Release pattern has changed';
  }
}

// ============================================================================
// Notification Status Management
// ============================================================================

/**
 * Check if notification was already sent for an entity
 */
export async function isNotificationSent(
  entityId: number,
  notificationType: string,
  entityType: 'event' | 'schedule' = 'event'
): Promise<boolean> {
  try {
    if (entityType === 'event') {
      const event = await prisma.calendarEvent.findUnique({
        where: { id: entityId },
        select: { metadata: true }
      });
      const metadata = (event?.metadata ?? {}) as NotificationMetadata;
      const sentNotifications = metadata.sentNotifications ?? [];
      return sentNotifications.includes(notificationType);
    } else {
      // entityType is 'schedule'
      const schedule = await prisma.releaseSchedule.findUnique({
        where: { id: entityId },
        select: { metadata: true }
      });
      const metadata = (schedule?.metadata ?? {}) as NotificationMetadata;
      const sentNotifications = metadata.sentNotifications ?? [];
      return sentNotifications.includes(notificationType);
    }
  } catch (error: unknown) {
    logger.error('Error checking notification status', { entityId, entityType, error });
    return false;
  }
}

/**
 * Mark notification as sent for an entity
 */
export async function markNotificationSent(
  entityId: number,
  notificationType: string,
  entityType: 'event' | 'schedule' = 'event'
): Promise<void> {
  try {
    if (entityType === 'event') {
      const event = await prisma.calendarEvent.findUnique({
        where: { id: entityId },
        select: { metadata: true }
      });
      const metadata = (event?.metadata ?? {}) as NotificationMetadata;
      const sentNotifications = metadata.sentNotifications ?? [];
      if (!sentNotifications.includes(notificationType)) {
        sentNotifications.push(notificationType);
        await prisma.calendarEvent.update({
          where: { id: entityId },
          data: {
            metadata: {
              ...metadata,
              sentNotifications,
              lastNotificationSent: new Date().toISOString()
            } as Prisma.InputJsonValue
          }
        });
      }
    } else {
      // entityType is 'schedule'
      const schedule = await prisma.releaseSchedule.findUnique({
        where: { id: entityId },
        select: { metadata: true }
      });
      const metadata = (schedule?.metadata ?? {}) as NotificationMetadata;
      const sentNotifications = metadata.sentNotifications ?? [];
      if (!sentNotifications.includes(notificationType)) {
        sentNotifications.push(notificationType);
        await prisma.releaseSchedule.update({
          where: { id: entityId },
          data: {
            metadata: {
              ...metadata,
              sentNotifications,
              lastNotificationSent: new Date().toISOString()
            } as Prisma.InputJsonValue
          }
        });
      }
    }
  } catch (error: unknown) {
    logger.error('Error marking notification as sent', { entityId, entityType, error });
  }
}

// ============================================================================
// User Preferences
// ============================================================================

/**
 * Get notification preferences for a user
 */
export async function getNotificationPreferences(_userId?: string): Promise<{
  enabled: boolean;
  types: string[];
  leadTime: number;
}> {
  // This would fetch from user preferences
  // For now, returning defaults
  return Promise.resolve({
    enabled: true,
    types: ['UPCOMING_RELEASE', 'RELEASE_DELAYED', 'PATTERN_CHANGED'],
    leadTime: 24
  });
}

// ============================================================================
// Batch Processing (NEW - Fixes await-in-loop violations)
// ============================================================================

/**
 * Result of processing a single notification
 */
export interface ProcessResult {
  sent?: boolean;
  failed?: boolean;
  skipped?: boolean;
  error?: Error;
}

/**
 * Process notifications in batch to avoid await-in-loop violations.
 * Uses Promise.allSettled for parallel processing.
 */
export async function processNotificationsInBatch<T>(
  items: T[],
  processor: (item: T) => Promise<ProcessResult>
): Promise<{ sent: number; failed: number; skipped: number }> {
  const results = await Promise.allSettled(items.map(processor));

  return results.reduce(
    (acc, result) => {
      if (result.status === 'fulfilled') {
        if (result.value.sent) return { ...acc, sent: acc.sent + 1 };
        if (result.value.failed) return { ...acc, failed: acc.failed + 1 };
        if (result.value.skipped) return { ...acc, skipped: acc.skipped + 1 };
      } else {
        logger.error('Notification processing failed', { error: result.reason as Error });
        return { ...acc, failed: acc.failed + 1 };
      }
      return acc;
    },
    { sent: 0, failed: 0, skipped: 0 }
  );
}
