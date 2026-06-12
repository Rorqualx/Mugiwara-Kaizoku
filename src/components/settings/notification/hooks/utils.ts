/**
 * Notification Config Utilities
 *
 * Pure functions for building and extracting notification configuration
 *
 * @module components/settings/notification/hooks/utils
 */
import type { NotificationAppConfig } from '../types';

/**
 * Settings data structure from API response
 */
interface SettingsResponseData {
  appConfig?: Partial<NotificationAppConfig>;
}

/**
 * Extracts settings data from query response
 *
 * `settings.get` now returns the bare payload over the wire (no AsyncResult
 * envelope), so this just narrows the unknown payload to the expected shape.
 *
 * @param data - Raw query data (the bare settings payload)
 * @returns Extracted settings data or undefined
 */
export function extractSettingsData(
  data: unknown
): SettingsResponseData | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  return data as SettingsResponseData;
}

/**
 * Builds notification config with defaults
 *
 * @param appConfig - Partial app config from settings
 * @param defaults - Default configuration values
 * @returns Complete notification configuration
 */
export function buildNotificationConfig(
  appConfig: Partial<NotificationAppConfig> | undefined,
  defaults: NotificationAppConfig
): NotificationAppConfig {
  return {
    telegramEnabled: appConfig?.telegramEnabled ?? defaults.telegramEnabled,
    telegramToken: appConfig?.telegramToken ?? defaults.telegramToken,
    telegramChatId: appConfig?.telegramChatId ?? defaults.telegramChatId,
    telegramSendSilently: appConfig?.telegramSendSilently ?? defaults.telegramSendSilently,
    appriseEnabled: appConfig?.appriseEnabled ?? defaults.appriseEnabled,
    appriseHost: appConfig?.appriseHost ?? defaults.appriseHost,
    appriseUrls: appConfig?.appriseUrls ?? defaults.appriseUrls,
  };
}
