/**
 * Download Client Settings Updater
 *
 * Factory-based client setting update functions.
 * Eliminates duplication across 4 client update functions.
 *
 * Extracted and optimized from: useDownloadClientConfig.ts
 */

import React from 'react';

import { notifications } from '@mantine/notifications';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

import { logger } from '@/utils/logger';

/**
 * Interface for Transmission client configuration
 */
export interface TransmissionConfig {
  enabled: boolean;
  baseURL: string;
  apiKey: string;
}

/**
 * Interface for Deluge client configuration
 */
export interface DelugeConfig {
  enabled: boolean;
  baseURL: string;
  password: string;
}

/**
 * Interface for SABnzbd client configuration
 */
export interface SabnzbdConfig {
  enabled: boolean;
  baseURL: string;
  apiKey: string;
}

/**
 * Interface for NZBGet client configuration
 */
export interface NzbgetConfig {
  enabled: boolean;
  baseURL: string;
  username: string;
  password: string;
}

/**
 * Interface for download client preferences
 */
export interface DownloadClientPreferences {
  preferredTorrentClient: 'transmission' | 'deluge' | null;
  preferredUsenetClient: 'sabnzbd' | 'nzbget' | null;
  autoSelectClient: boolean;
}

/**
 * Interface for all download client settings
 */
export interface DownloadClientConfig {
  transmission: TransmissionConfig;
  deluge: DelugeConfig;
  sabnzbd: SabnzbdConfig;
  nzbget: NzbgetConfig;
  preferences: DownloadClientPreferences;
}

/**
 * Client config type mapping for factory function
 */
export type ClientConfigMap = {
  transmission: TransmissionConfig;
  deluge: DelugeConfig;
  sabnzbd: SabnzbdConfig;
  nzbget: NzbgetConfig;
};

/**
 * Client names for type safety
 */
export type ClientName = keyof ClientConfigMap;

/**
 * Display names mapping for notifications
 */
const CLIENT_DISPLAY_NAMES: Record<ClientName, string> = {
  transmission: 'Transmission',
  deluge: 'Deluge',
  sabnzbd: 'SABnzbd',
  nzbget: 'NZBGet'
};

/**
 * Format error message from unknown error type
 *
 * @param err - The error to format
 * @returns Formatted error message string
 */
function formatErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Show success notification
 *
 * @param title - Notification title
 * @param message - Notification message
 */
function showSuccessNotification(title: string, message: string): void {
  notifications.show({
    title,
    message,
    color: 'green',
    icon: React.createElement(IconCheck, { size: 16 })
  });
}

/**
 * Show error notification
 *
 * @param title - Notification title
 * @param message - Notification message
 */
function showErrorNotification(title: string, message: string): void {
  notifications.show({
    title,
    message,
    color: 'red',
    icon: React.createElement(IconAlertCircle, { size: 16 })
  });
}

/**
 * Dependencies required for the client setting updater
 */
export interface ClientSettingUpdaterDependencies {
  set: (key: string, value: unknown) => Promise<void>;
  setDownloadClientConfig: React.Dispatch<React.SetStateAction<DownloadClientConfig>>;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  loadDownloadClientConfig: () => Promise<void>;
}

/**
 * Type for client setting updater function
 */
export type ClientSettingUpdater<K extends ClientName> = <P extends keyof ClientConfigMap[K]>(
  key: P,
  value: ClientConfigMap[K][P]
) => Promise<void>;

/**
 * Create a client setting updater function
 *
 * Factory function that creates type-safe update functions for each client.
 * This eliminates the duplication across updateTransmissionSetting,
 * updateDelugeSetting, updateSabnzbdSetting, and updateNzbgetSetting.
 *
 * @param clientName - The name of the client (transmission, deluge, sabnzbd, nzbget)
 * @param deps - Dependencies required for the updater
 * @returns Typed update function for the client
 *
 * @example
 * ```typescript
 * const updateTransmissionSetting = createClientSettingUpdater('transmission', {
 *   set,
 *   setDownloadClientConfig,
 *   setSaving,
 *   setError,
 *   loadDownloadClientConfig
 * });
 *
 * // Usage
 * await updateTransmissionSetting('enabled', true);
 * await updateTransmissionSetting('baseURL', 'http://localhost:9091');
 * ```
 */
export function createClientSettingUpdater<K extends ClientName>(
  clientName: K,
  deps: ClientSettingUpdaterDependencies
): ClientSettingUpdater<K> {
  const { set, setDownloadClientConfig, setSaving, setError, loadDownloadClientConfig } = deps;
  const displayName = CLIENT_DISPLAY_NAMES[clientName];

  return async <P extends keyof ClientConfigMap[K]>(
    key: P,
    value: ClientConfigMap[K][P]
  ): Promise<void> => {
    setSaving(true);
    setError(null);

    try {
      // Update optimistically
      setDownloadClientConfig((prev) => ({
        ...prev,
        [clientName]: {
          ...prev[clientName],
          [key]: value
        }
      }));

      // Update the server configuration
      await set(`download.${clientName}.${String(key)}`, value);

      // Show success notification
      showSuccessNotification(
        'Success',
        `${displayName} setting "${String(key)}" updated successfully`
      );
    } catch (err: unknown) {
      // Revert the optimistic update
      void loadDownloadClientConfig();

      // Show error
      const errorMessage = formatErrorMessage(err);
      setError(`Failed to update ${displayName} setting: ${errorMessage}`);
      logger.error(`Error updating ${displayName} setting "${String(key)}"`, { error: err });

      // Show error notification
      showErrorNotification(
        'Error',
        `Failed to update ${displayName} setting: ${errorMessage}`
      );
    } finally {
      setSaving(false);
    }
  };
}

/**
 * Create all client setting updaters at once
 *
 * Convenience function to create all four client updaters with shared dependencies.
 *
 * @param deps - Dependencies required for the updaters
 * @returns Object containing all client setting updaters
 *
 * @example
 * ```typescript
 * const {
 *   updateTransmissionSetting,
 *   updateDelugeSetting,
 *   updateSabnzbdSetting,
 *   updateNzbgetSetting
 * } = createAllClientSettingUpdaters({
 *   set,
 *   setDownloadClientConfig,
 *   setSaving,
 *   setError,
 *   loadDownloadClientConfig
 * });
 * ```
 */
export function createAllClientSettingUpdaters(
  deps: ClientSettingUpdaterDependencies
): {
  updateTransmissionSetting: ClientSettingUpdater<'transmission'>;
  updateDelugeSetting: ClientSettingUpdater<'deluge'>;
  updateSabnzbdSetting: ClientSettingUpdater<'sabnzbd'>;
  updateNzbgetSetting: ClientSettingUpdater<'nzbget'>;
} {
  return {
    updateTransmissionSetting: createClientSettingUpdater('transmission', deps),
    updateDelugeSetting: createClientSettingUpdater('deluge', deps),
    updateSabnzbdSetting: createClientSettingUpdater('sabnzbd', deps),
    updateNzbgetSetting: createClientSettingUpdater('nzbget', deps)
  };
}
