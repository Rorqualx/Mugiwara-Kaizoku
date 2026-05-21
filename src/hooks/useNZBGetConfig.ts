/**
 * NZBGet Configuration Hook
 *
 * Reads/writes NZBGet download-client config keys via `useConfigValue`, so
 * the React-Query cache for each key is shared across every consumer on the
 * page. Public API ({ config, isLoading, saving, error, updateSetting,
 * updateConfig, refresh }) is unchanged for backward compatibility.
 */

import React, { useCallback } from 'react';

import { notifications } from '@mantine/notifications';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

import { useConfigValue } from './useConfigValue';

export interface NzbgetConfig {
  enabled: boolean;
  baseURL: string;
  username: string;
  password: string;
  category?: string;
}

export interface UseNzbgetConfigResult {
  config: NzbgetConfig;
  isLoading: boolean;
  saving: string | null;
  error: Error | null;
  updateSetting: <K extends keyof NzbgetConfig>(key: K, value: NzbgetConfig[K]) => Promise<void>;
  updateConfig: (config: Partial<NzbgetConfig>) => Promise<void>;
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

export function useNzbgetConfig(): UseNzbgetConfigResult {
  const enabled = useConfigValue<boolean>('download.nzbget.enabled', false);
  const baseURL = useConfigValue<string>('download.nzbget.baseURL', 'http://localhost:6789');
  const username = useConfigValue<string>('download.nzbget.username', '');
  const password = useConfigValue<string>('download.nzbget.password', '');
  const category = useConfigValue<string>('download.nzbget.category', 'manga');

  const config: NzbgetConfig = {
    enabled: enabled.value,
    baseURL: baseURL.value,
    username: username.value,
    password: password.value,
    category: category.value,
  };

  const isLoading =
    enabled.isLoading ||
    baseURL.isLoading ||
    username.isLoading ||
    password.isLoading ||
    category.isLoading;

  const saving: string | null = (() => {
    if (enabled.saving) return 'enabled';
    if (baseURL.saving) return 'baseURL';
    if (username.saving) return 'username';
    if (password.saving) return 'password';
    if (category.saving) return 'category';
    return null;
  })();

  const error =
    enabled.error ?? baseURL.error ?? username.error ?? password.error ?? category.error;

  const updateSetting = useCallback(
    async <K extends keyof NzbgetConfig>(key: K, value: NzbgetConfig[K]): Promise<void> => {
      try {
        if (key === 'enabled') {
          await enabled.setValue(value as boolean);
        } else if (key === 'baseURL') {
          await baseURL.setValue(value as string);
        } else if (key === 'username') {
          await username.setValue(value as string);
        } else if (key === 'password') {
          await password.setValue(value as string);
        } else if (key === 'category') {
          await category.setValue((value as string | undefined) ?? '');
        }
        showSuccess('NZBGet setting updated successfully');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to update setting: ${message}`);
        throw err;
      }
    },
    [enabled, baseURL, username, password, category],
  );

  const updateConfig = useCallback(
    async (partial: Partial<NzbgetConfig>): Promise<void> => {
      try {
        const writes: Promise<void>[] = [];
        if (partial.enabled !== undefined) writes.push(enabled.setValue(partial.enabled));
        if (partial.baseURL !== undefined) writes.push(baseURL.setValue(partial.baseURL));
        if (partial.username !== undefined) writes.push(username.setValue(partial.username));
        if (partial.password !== undefined) writes.push(password.setValue(partial.password));
        if (partial.category !== undefined) writes.push(category.setValue(partial.category));
        await Promise.all(writes);
        showSuccess('NZBGet configuration updated successfully');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to update configuration: ${message}`);
        throw err;
      }
    },
    [enabled, baseURL, username, password, category],
  );

  const refresh = useCallback(async (): Promise<void> => {
    await Promise.all([
      enabled.refetch(),
      baseURL.refetch(),
      username.refetch(),
      password.refetch(),
      category.refetch(),
    ]);
  }, [enabled, baseURL, username, password, category]);

  return { config, isLoading, saving, error, updateSetting, updateConfig, refresh };
}
