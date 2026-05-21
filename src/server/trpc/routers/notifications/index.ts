/**
 * Notification Router
 *
 * Combines core notification operations and settings management.
 * Split into submodules to stay under 500 line limit.
 */
import { router } from '@/server/trpc/trpc';

import { notificationCoreRouter } from './core';
import { notificationPreferenceRouter } from './preferences';
import { notificationSettingsRouter } from './settings';

/**
 * Combined notification router
 */
export const notificationRouter = router({
  // Core operations
  create: notificationCoreRouter.create,
  getNotifications: notificationCoreRouter.getNotifications,
  getUnreadCount: notificationCoreRouter.getUnreadCount,
  markAsRead: notificationCoreRouter.markAsRead,
  markAllAsRead: notificationCoreRouter.markAllAsRead,
  deleteNotification: notificationCoreRouter.deleteNotification,
  clearAll: notificationCoreRouter.clearAll,
  getAvailableEvents: notificationCoreRouter.getAvailableEvents,

  // Settings operations
  getConfig: notificationSettingsRouter.getConfig,
  updateEmailSettings: notificationSettingsRouter.updateEmailSettings,
  updateDiscordSettings: notificationSettingsRouter.updateDiscordSettings,
  updateSlackSettings: notificationSettingsRouter.updateSlackSettings,
  updateTelegramSettings: notificationSettingsRouter.updateTelegramSettings,
  updateWebhookSettings: notificationSettingsRouter.updateWebhookSettings,
  testNotification: notificationSettingsRouter.testNotification,

  // Per-user preferences (eventType × channel matrix)
  getPreferenceMatrix: notificationPreferenceRouter.getMatrix,
  setPreference: notificationPreferenceRouter.setPreference,
  resetPreferences: notificationPreferenceRouter.resetAll
});

export type NotificationRouter = typeof notificationRouter;
