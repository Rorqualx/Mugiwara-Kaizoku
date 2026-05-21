/**
 * SABnzbd Configuration Hook
 *
 * Reads/writes SABnzbd download-client config keys via `useConfigValue`, so
 * the React-Query cache for each key is shared across every consumer on the
 * page. Public API ({ config, isLoading, saving, error, updateSetting,
 * updateConfig, refresh }) is unchanged for backward compatibility.
 */

import React, { useCallback } from 'react';

import { notifications } from '@mantine/notifications';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

import { useConfigValue } from './useConfigValue';

export interface SabnzbdConfig {
  enabled: boolean;
  baseURL: string;
  apiKey: string;
  category?: string;
}

export interface UseSabnzbdConfigResult {
  config: SabnzbdConfig;
  isLoading: boolean;
  saving: string | null;
  error: Error | null;
  updateSetting: <K extends keyof SabnzbdConfig>(key: K, value: SabnzbdConfig[K]) => Promise<void>;
  updateConfig: (config: Partial<SabnzbdConfig>) => Promise<void>;
  refresh: () => Promise<void>;
}

function showSuccess(message: string): void {
  notifications.show({
    title: 'Success',
    message,
    color: 'green',
    icon: React.createElement(IconCheck, { size: 16 }),
  });
}

function showError(message: string): void {
  notifications.show({
    title: 'Error',
    message,
    color: 'red',
    icon: React.createElement(IconAlertCircle, { size: 16 }),
  });
}

export function useSabnzbdConfig(): UseSabnzbdConfigResult {
  const enabled = useConfigValue<boolean>('download.sabnzbd.enabled', false);
  const baseURL = useConfigValue<string>('download.sabnzbd.baseURL', 'http://localhost:8080');
  const apiKey = useConfigValue<string>('download.sabnzbd.apiKey', '');
  const category = useConfigValue<string>('download.sabnzbd.category', 'manga');

  const config: SabnzbdConfig = {
    enabled: enabled.value,
    baseURL: baseURL.value,
    apiKey: apiKey.value,
    category: category.value,
  };

  const isLoading =
    enabled.isLoading || baseURL.isLoading || apiKey.isLoading || category.isLoading;

  const saving: string | null = (() => {
    if (enabled.saving) return 'enabled';
    if (baseURL.saving) return 'baseURL';
    if (apiKey.saving) return 'apiKey';
    if (category.saving) return 'category';
    return null;
  })();

  const error = enabled.error ?? baseURL.error ?? apiKey.error ?? category.error;

  const updateSetting = useCallback(
    async <K extends keyof SabnzbdConfig>(key: K, value: SabnzbdConfig[K]): Promise<void> => {
      try {
        if (key === 'enabled') {
          await enabled.setValue(value as boolean);
        } else if (key === 'baseURL') {
          await baseURL.setValue(value as string);
        } else if (key === 'apiKey') {
          await apiKey.setValue(value as string);
        } else if (key === 'category') {
          await category.setValue((value as string | undefined) ?? '');
        }
        showSuccess('SABnzbd setting updated successfully');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to update setting: ${message}`);
        throw err;
      }
    },
    [enabled, baseURL, apiKey, category],
  );

  const updateConfig = useCallback(
    async (partial: Partial<SabnzbdConfig>): Promise<void> => {
      try {
        const writes: Promise<void>[] = [];
        if (partial.enabled !== undefined) writes.push(enabled.setValue(partial.enabled));
        if (partial.baseURL !== undefined) writes.push(baseURL.setValue(partial.baseURL));
        if (partial.apiKey !== undefined) writes.push(apiKey.setValue(partial.apiKey));
        if (partial.category !== undefined) writes.push(category.setValue(partial.category));
        await Promise.all(writes);
        showSuccess('SABnzbd configuration updated successfully');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to update configuration: ${message}`);
        throw err;
      }
    },
    [enabled, baseURL, apiKey, category],
  );

  const refresh = useCallback(async (): Promise<void> => {
    await Promise.all([
      enabled.refetch(),
      baseURL.refetch(),
      apiKey.refetch(),
      category.refetch(),
    ]);
  }, [enabled, baseURL, apiKey, category]);

  return { config, isLoading, saving, error, updateSetting, updateConfig, refresh };
}
