/**
 * Notification utility module
 *
 * Thin wrapper around the adapter-based notification system.
 * Provides a simple `sendNotification(message, context)` API
 * for legacy callers.
 */

import { getNotificationService } from '@/server/services/notifications';
import { isSuccess, isError } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { configService } from '../services/config/configService';
import { getNotificationConfigService } from '../services/notification/configService';

import type { NotificationEventType } from '@prisma/client';

interface NotificationMessage {
  title: string;
  body: string;
  url?: string;
}

interface NotificationResponse {
  success: boolean;
  provider: string;
  error?: string;
}

interface AdapterSendResult {
  successCount: number;
  failureCount: number;
  errors: Array<{ adapter: string; error: Error }>;
}

function mapToNotificationEvent(context?: string): NotificationEventType {
  if (!context) return 'UPDATE_AVAILABLE';

  const lc = context.toLowerCase();
  if (lc.includes('manga') && lc.includes('add')) return 'MANGA_ADDED';
  if (lc.includes('manga') && lc.includes('update')) return 'MANGA_UPDATED';
  if (lc.includes('chapter') && lc.includes('download')) return 'CHAPTER_DOWNLOADED';
  if (lc.includes('download') && lc.includes('fail')) return 'DOWNLOAD_FAILED';
  if (lc.includes('task') && lc.includes('fail')) return 'TASK_FAILED';
  if (lc.includes('sync') && lc.includes('complete')) return 'SYNC_COMPLETED';
  if (lc.includes('backup') && lc.includes('complete')) return 'BACKUP_COMPLETED';
  return 'UPDATE_AVAILABLE';
}

function transformConfigToNotificationConfig(
  cfg: { telegram: { enabled: boolean; token: string; chatId: string }; apprise: { enabled: boolean; urls: string[] } }
): {
  telegram?: { enabled: boolean; botToken: string; chatId: string; events: never[] };
  apprise?: { enabled: boolean; urls: string[]; events: never[] };
} {
  const result: {
    telegram?: { enabled: boolean; botToken: string; chatId: string; events: never[] };
    apprise?: { enabled: boolean; urls: string[]; events: never[] };
  } = {};

  if (cfg.telegram.enabled) {
    result.telegram = {
      enabled: true,
      botToken: cfg.telegram.token,
      chatId: cfg.telegram.chatId,
      events: []
    };
  }

  if (cfg.apprise.enabled) {
    result.apprise = {
      enabled: true,
      urls: cfg.apprise.urls,
      events: []
    };
  }

  return result;
}

function processAdapterResult(data: AdapterSendResult): NotificationResponse[] {
  const responses: NotificationResponse[] = [];
  if (data.successCount > 0) {
    responses.push({ success: true, provider: 'notification-adapters' });
  }
  for (const err of data.errors) {
    responses.push({ success: false, provider: err.adapter, error: err.error.message });
  }
  return responses;
}

async function loadNotificationService(): ReturnType<typeof getNotificationService> {
  if (!configService.isInitialized()) {
    await configService.initialize();
  }
  const notificationConfigService = getNotificationConfigService(configService);
  const configServiceConfig = await notificationConfigService.loadConfig();
  const notificationConfig = transformConfigToNotificationConfig(configServiceConfig);
  return getNotificationService(notificationConfig);
}

export async function sendNotification(
  message: NotificationMessage,
  context?: string
): Promise<NotificationResponse[]> {
  try {
    const notificationService = await loadNotificationService();
    const event = mapToNotificationEvent(context);
    const payload = {
      title: message.title,
      body: message.body,
      event,
      metadata: { timestamp: new Date().toISOString(), ...(context ? { context } : {}) }
    };

    const result = await notificationService.send(payload);

    if (isSuccess(result)) {
      return processAdapterResult(result.data);
    }
    if (isError(result)) {
      logger.error('Notification adapter system failed', result.error);
      return [{ success: false, provider: 'unknown', error: result.error.message }];
    }
    return [];
  } catch (error: unknown) {
    logger.error('Failed to send notifications', error);
    return [{ success: false, provider: 'unknown', error: error instanceof Error ? error.message : String(error) }];
  }
}

export async function testNotification(provider?: string): Promise<NotificationResponse[]> {
  const { appConfigService } = await import('../services/config/appConfigService');
  const baseUrl = await appConfigService.getBaseUrl();
  const testMessage: NotificationMessage = {
    title: 'Test Notification',
    body: 'This is a test notification from Mugiwara-Kaizoku',
    url: baseUrl
  };

  if (!provider) {
    return sendNotification(testMessage, 'test notification');
  }

  try {
    const notificationService = await loadNotificationService();
    const result = await notificationService.testProvider(provider);

    if (isSuccess(result)) {
      return [{ success: result.data.success, provider }];
    }
    if (isError(result)) {
      return [{ success: false, provider, error: result.error.message }];
    }
    return [{ success: false, provider, error: 'Unknown result' }];
  } catch (error: unknown) {
    logger.error(`Failed to test ${provider}`, error);
    return [{ success: false, provider, error: error instanceof Error ? error.message : String(error) }];
  }
}
