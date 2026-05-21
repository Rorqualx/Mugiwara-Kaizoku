/**
 * Download Client Configuration Updater
 *
 * Functions for updating download client configuration.
 * Provides factory functions to create typed updaters for preferences and config.
 *
 * Extracted from: useDownloadClientConfig.ts
 */

import type { Dispatch, SetStateAction } from 'react';

import { logger } from '@/utils/logger';

import { showSuccessNotification, showErrorNotification, formatErrorMessage } from './utils';

import type { DownloadClientConfig, DownloadClientPreferences } from './types';

/**
 * Create a preference updater function
 *
 * @param set - Config setter function from useConfig hook
 * @param setDownloadClientConfig - State setter for config
 * @param setSaving - State setter for saving
 * @param setError - State setter for error
 * @param loadDownloadClientConfig - Function to reload config on error
 * @returns Typed update function for preferences
 */
export function createPreferenceUpdater(
  set: (key: string, value: unknown) => Promise<void>,
  setDownloadClientConfig: Dispatch<SetStateAction<DownloadClientConfig>>,
  setSaving: Dispatch<SetStateAction<boolean>>,
  setError: Dispatch<SetStateAction<string | null>>,
  loadDownloadClientConfig: () => Promise<void>
): <K extends keyof DownloadClientPreferences>(
  key: K,
  value: DownloadClientPreferences[K]
) => Promise<void> {
  return async <K extends keyof DownloadClientPreferences>(
    key: K,
    value: DownloadClientPreferences[K]
  ): Promise<void> => {
    setSaving(true);
    setError(null);

    try {
      // Update optimistically
      setDownloadClientConfig((prev) => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          [key]: value
        }
      }));

      // For client preference settings, convert null to empty string
      const keyStr = String(key);
      const serverValue = keyStr.includes('preferred') && value === null ? '' : value;

      // Update the server configuration
      await set(`download.preferences.${keyStr}`, serverValue);

      // Show success notification
      showSuccessNotification('Success', `Download preference "${keyStr}" updated successfully`);
    } catch (err: unknown) {
      // Revert the optimistic update
      void loadDownloadClientConfig();

      // Show error
      const errorMessage = formatErrorMessage(err);
      setError(`Failed to update download preference: ${errorMessage}`);
      logger.error(`Error updating download preference "${String(key)}"`, { error: err });

      // Show error notification
      showErrorNotification('Error', `Failed to update download preference: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };
}

/**
 * Helper to update config section
 *
 * @param section - Config section to update
 * @param prefix - Key prefix for the section
 * @param promises - Array to push update promises to
 * @param set - Config setter function
 * @param transformer - Optional value transformer
 */
export function updateConfigSection<T extends Record<string, unknown>>(
  section: T | undefined,
  prefix: string,
  promises: Promise<void>[],
  set: (key: string, value: unknown) => Promise<void>,
  transformer?: (key: string, value: unknown) => unknown
): void {
  if (!section) {
    return;
  }

  const entries = Object.entries(section) as [keyof T, T[keyof T]][];
  for (const [key, value] of entries) {
    if (value !== undefined) {
      const transformedValue = transformer ? transformer(String(key), value) : value;
      promises.push(set(`${prefix}.${String(key)}`, transformedValue));
    }
  }
}

/**
 * Build optimistic update object
 *
 * @param prev - Previous config state
 * @param config - Partial config to merge
 * @returns Updated config object
 */
export function buildOptimisticUpdate(
  prev: DownloadClientConfig,
  config: Partial<DownloadClientConfig>
): DownloadClientConfig {
  return {
    ...prev,
    ...(config.transmission ? { transmission: { ...prev.transmission, ...config.transmission } } : {}),
    ...(config.deluge ? { deluge: { ...prev.deluge, ...config.deluge } } : {}),
    ...(config.sabnzbd ? { sabnzbd: { ...prev.sabnzbd, ...config.sabnzbd } } : {}),
    ...(config.nzbget ? { nzbget: { ...prev.nzbget, ...config.nzbget } } : {}),
    ...(config.preferences ? { preferences: { ...prev.preferences, ...config.preferences } } : {})
  };
}

/**
 * Create a config updater function
 *
 * @param set - Config setter function from useConfig hook
 * @param setDownloadClientConfig - State setter for config
 * @param setSaving - State setter for saving
 * @param setError - State setter for error
 * @param loadDownloadClientConfig - Function to reload config on error
 * @returns Function to update entire config
 */
export function createConfigUpdater(
  set: (key: string, value: unknown) => Promise<void>,
  setDownloadClientConfig: Dispatch<SetStateAction<DownloadClientConfig>>,
  setSaving: Dispatch<SetStateAction<boolean>>,
  setError: Dispatch<SetStateAction<string | null>>,
  loadDownloadClientConfig: () => Promise<void>
): (config: Partial<DownloadClientConfig>) => Promise<void> {
  return async (config: Partial<DownloadClientConfig>): Promise<void> => {
    setSaving(true);
    setError(null);

    try {
      // Update optimistically
      setDownloadClientConfig((prev) => buildOptimisticUpdate(prev, config));

      // Update all provided sections
      const updatePromises: Promise<void>[] = [];

      // Update client configs (cast to satisfy generic constraint)
      updateConfigSection(
        config.transmission as unknown as Record<string, unknown> | undefined,
        'download.transmission',
        updatePromises,
        set
      );
      updateConfigSection(
        config.deluge as unknown as Record<string, unknown> | undefined,
        'download.deluge',
        updatePromises,
        set
      );
      updateConfigSection(
        config.sabnzbd as unknown as Record<string, unknown> | undefined,
        'download.sabnzbd',
        updatePromises,
        set
      );
      updateConfigSection(
        config.nzbget as unknown as Record<string, unknown> | undefined,
        'download.nzbget',
        updatePromises,
        set
      );

      // Update preferences with special handling for null values
      updateConfigSection(
        config.preferences as unknown as Record<string, unknown> | undefined,
        'download.preferences',
        updatePromises,
        set,
        (key, value) => (key.includes('preferred') && value === null ? '' : value)
      );

      // Wait for all updates to complete
      await Promise.all(updatePromises);

      // Show success notification
      showSuccessNotification('Success', 'Download client settings updated successfully');
    } catch (err: unknown) {
      // Revert the optimistic update
      void loadDownloadClientConfig();

      // Show error
      const errorMessage = formatErrorMessage(err);
      setError(`Failed to update download client settings: ${errorMessage}`);
      logger.error('Error updating download client settings', { error: err });

      // Show error notification
      showErrorNotification('Error', `Failed to update download client settings: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };
}
