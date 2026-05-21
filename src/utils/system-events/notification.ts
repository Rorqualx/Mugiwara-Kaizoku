/**
 * Notification Event Logging Functions
 *
 * Logging functions for notification operations including
 * sending, failures, and maintenance events.
 *
 * Extracted from: systemEvents.ts
 */

import { emitEvent } from '../eventEmitter';

// Notification-specific events

export function logNotificationSent(
  type: string,
  title: string,
  channelCount: number
): void {
  emitEvent(
    'info',
    `Notification sent: ${title} (via ${channelCount} channel${channelCount !== 1 ? 's' : ''})`,
    'Calendar',
    {
      details: {
        type: 'notification_sent',
        notificationType: type,
        title,
        channelCount
      }
    }
  );
}

export function logNotificationFailed(
  type: string,
  title: string,
  error: string
): void {
  emitEvent(
    'error',
    `Failed to send notification: ${title} - ${error}`,
    'Calendar',
    {
      details: {
        type: 'notification_failed',
        notificationType: type,
        title,
        error
      }
    }
  );
}

export function logMaintenanceComplete(
  service: string,
  results: Record<string, unknown>
): void {
  emitEvent(
    'success',
    `${service} maintenance completed`,
    'System',
    {
      details: {
        type: 'maintenance_complete',
        service,
        results
      }
    }
  );
}
