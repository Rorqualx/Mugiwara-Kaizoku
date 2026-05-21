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
 * @param data - Raw query data
 * @param isSuccessFn - Success check function (accepts unknown data)
 * @returns Extracted settings data or undefined
 */
export function extractSettingsData(
  data: unknown,
  isSuccessFn: <T>(data: unknown) => data is T
): SettingsResponseData | undefined {
  if (!data || !isSuccessFn(data)) {
    return undefined;
  }
  return (data as { data?: SettingsResponseData }).data;
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
