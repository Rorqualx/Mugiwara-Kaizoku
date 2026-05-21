/**
 * Notification Settings Migration
 *
 * Migrates Telegram and Apprise notification service configuration
 * from legacy Settings table to new Configuration system.
 *
 * Extracted from: configMigration.ts (lines 143-189)
 *
 * @module config-migration/notification-migration
 */

import { ConfigScope } from '@prisma/client';

import { logger } from '@/utils/logger';



import { configService } from '../configService';

import type { LegacySettings } from './types';

/**
 * Migrate notification service settings from legacy format
 *
 * Processes Telegram and Apprise notification configurations,
 * migrating them to the new configuration system with proper scoping.
 * Also initializes default notification feature flags.
 *
 * @param settings - Legacy settings containing notification service configs
 * @throws May throw if configService operations fail
 */
export async function migrateNotificationSettings(settings: LegacySettings): Promise<void> {
  // Telegram
  await configService.set('notification.services.telegram.enabled', settings.telegramEnabled, {
    scope: ConfigScope.INTEGRATION
  });
  if (settings.telegramToken) {
    await configService.set('notification.services.telegram.token', settings.telegramToken, {
      scope: ConfigScope.INTEGRATION
    });
  }
  if (settings.telegramChatId) {
    await configService.set('notification.services.telegram.chatId', settings.telegramChatId, {
      scope: ConfigScope.INTEGRATION
    });
  }
  await configService.set('notification.services.telegram.sendSilently', settings.telegramSendSilently, {
    scope: ConfigScope.INTEGRATION
  });
  // Apprise
  await configService.set('notification.services.apprise.enabled', settings.appriseEnabled, {
    scope: ConfigScope.INTEGRATION
  });
  if (settings.appriseHost) {
    await configService.set('notification.services.apprise.host', settings.appriseHost, {
      scope: ConfigScope.INTEGRATION
    });
  }
  await configService.set('notification.services.apprise.urls', settings.appriseUrls, {
    scope: ConfigScope.INTEGRATION
  });
  // Default notification settings
  await configService.set('notification.onDownloadComplete', true, {
    scope: ConfigScope.FEATURE
  });
  await configService.set('notification.onDownloadFailed', true, {
    scope: ConfigScope.FEATURE
  });
  await configService.set('notification.onNewChaptersAvailable', true, {
    scope: ConfigScope.FEATURE
  });
  await configService.set('notification.onMetadataUpdated', false, {
    scope: ConfigScope.FEATURE
  });
  await configService.set('notification.onErrorsDetected', true, {
    scope: ConfigScope.FEATURE
  });
  logger.info('Migrated notification settings');
}
