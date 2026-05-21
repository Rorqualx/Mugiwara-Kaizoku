/**
 * Notification Base Types
 * 
 * This module exports all base types and interfaces for the notification system.
 * It serves as a central location for shared types used across notification adapters.
 * 
 * @module notifications/base/types
 */

export type { 
  NotificationPayload, 
  NotificationAdapter,
} from './BaseNotificationAdapter';

export { BaseNotificationAdapter } from './BaseNotificationAdapter';

export type { NotificationEvent, NotificationTestResult, NotificationConfig, BaseNotificationSettings, EmailSettings, DiscordSettings, SlackSettings, WebhookSettings, TelegramSettings } from '@/types/search.types';
