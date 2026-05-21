/**
 * Notification Settings Types
 *
 * Type definitions for notification configuration
 *
 * @module components/settings/notification/types
 */

/**
 * Application configuration interface for notification settings
 */
export interface NotificationAppConfig {
  telegramEnabled: boolean;
  telegramToken: string;
  telegramChatId: string;
  telegramSendSilently: boolean;
  appriseEnabled: boolean;
  appriseHost: string;
  appriseUrls: string[];
}

/**
 * Valid configuration keys for notification settings
 */
export type NotificationConfigKey =
  | 'telegramEnabled'
  | 'telegramToken'
  | 'telegramChatId'
  | 'telegramSendSilently'
  | 'appriseEnabled'
  | 'appriseHost'
  | 'appriseUrls';

/**
 * Handler type for updating notification settings
 */
export type NotificationUpdateHandler = (
  configKey: string,
  value: boolean | string | string[]
) => Promise<void>;

/**
 * Default configuration values
 */
export const DEFAULT_NOTIFICATION_CONFIG: NotificationAppConfig = {
  telegramEnabled: false,
  telegramToken: '',
  telegramChatId: '',
  telegramSendSilently: false,
  appriseEnabled: false,
  appriseHost: '',
  appriseUrls: [],
};

/**
 * Type guard for notification configuration keys
 */
export function isNotificationConfigKey(key: string): key is NotificationConfigKey {
  return [
    'telegramEnabled',
    'telegramToken',
    'telegramChatId',
    'telegramSendSilently',
    'appriseEnabled',
    'appriseHost',
    'appriseUrls',
  ].includes(key);
}
