/**
 * Notification Type Adapters
 * 
 * This module provides type adapters to make the enhanced notification system
 * backward compatible with existing code that expects the original 8 events.
 */

// Import the original types that existing code expects
export type { NotificationEvent, BaseNotificationSettings, EmailSettings, WebhookSettings, DiscordSettings, SlackSettings, TelegramSettings, NotificationConfig, NotificationTestResult } from '@/types/search.types';

// Re-export specific legacy event type for adapters
export type LegacyNotificationEvent = 
  | 'manga_added'
  | 'manga_updated'
  | 'chapter_downloaded'
  | 'download_failed'
  | 'task_failed'
  | 'sync_completed'
  | 'backup_completed'
  | 'update_available';

// Create a type that satisfies Record requirements for legacy events
export type LegacyEventRecord<T> = Record<LegacyNotificationEvent, T>;

// Helper function to create legacy event records with defaults
export function createLegacyEventRecord<T>(
  values: LegacyEventRecord<T>,
  defaultValue?: T
): Record<string, T> {
  const record: Record<string, T> = { ...values };
  
  // If a default is provided, use it for any unknown events
  if (defaultValue !== undefined) {
    return new Proxy(record, {
      get(target, prop) {
        if (typeof prop === 'string' && !(prop in target)) {
          return defaultValue;
        }
        return target[prop as string];
      }
    });
  }
  
  return record;
}
