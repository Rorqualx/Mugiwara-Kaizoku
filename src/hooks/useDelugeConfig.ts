/**
 * Deluge Configuration Hook
 *
 * Reads/writes Deluge download-client config keys via `useConfigValue`, so
 * the React-Query cache for each key is shared across every consumer on the
 * page. Public API ({ config, isLoading, saving, error, updateSetting,
 * updateConfig, refresh }) is unchanged for backward compatibility.
 *
 * Note: the field is persisted as `download.deluge.label` (matches Deluge's
 * own terminology and the runtime builder in `config-builders.ts`). A one-shot
 * migration moves any legacy `download.deluge.category` value into `.label`.
 */

import React, { useCallback } from 'react';

import { notifications } from '@mantine/notifications';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

import { useConfigValue } from './useConfigValue';

export interface DelugeConfig {
  enabled: boolean;
  baseURL: string;
  password: string;
  label?: string;
}

export interface UseDelugeConfigResult {
  config: DelugeConfig;
  isLoading: boolean;
  saving: string | null;
  error: Error | null;
  updateSetting: <K extends keyof DelugeConfig>(key: K, value: DelugeConfig[K]) => Promise<void>;
  updateConfig: (config: Partial<DelugeConfig>) => Promise<void>;
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

export function useDelugeConfig(): UseDelugeConfigResult {
  const enabled = useConfigValue<boolean>('download.deluge.enabled', false);
  const baseURL = useConfigValue<string>('download.deluge.baseURL', 'http://localhost:8112');
  const password = useConfigValue<string>('download.deluge.password', '');
  const label = useConfigValue<string>('download.deluge.label', 'manga');

  const config: DelugeConfig = {
    enabled: enabled.value,
    baseURL: baseURL.value,
    password: password.value,
    label: label.value,
  };

  const isLoading =
    enabled.isLoading || baseURL.isLoading || password.isLoading || label.isLoading;

  const saving: string | null = (() => {
    if (enabled.saving) return 'enabled';
    if (baseURL.saving) return 'baseURL';
    if (password.saving) return 'password';
    if (label.saving) return 'label';
    return null;
  })();

  const error = enabled.error ?? baseURL.error ?? password.error ?? label.error;

  const updateSetting = useCallback(
    async <K extends keyof DelugeConfig>(key: K, value: DelugeConfig[K]): Promise<void> => {
      try {
        if (key === 'enabled') {
          await enabled.setValue(value as boolean);
        } else if (key === 'baseURL') {
          await baseURL.setValue(value as string);
        } else if (key === 'password') {
          await password.setValue(value as string);
        } else if (key === 'label') {
          await label.setValue((value as string | undefined) ?? '');
        }
        showSuccess('Deluge setting updated successfully');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to update setting: ${message}`);
        throw err;
      }
    },
    [enabled, baseURL, password, label],
  );

  const updateConfig = useCallback(
    async (partial: Partial<DelugeConfig>): Promise<void> => {
      try {
        const writes: Promise<void>[] = [];
        if (partial.enabled !== undefined) writes.push(enabled.setValue(partial.enabled));
        if (partial.baseURL !== undefined) writes.push(baseURL.setValue(partial.baseURL));
        if (partial.password !== undefined) writes.push(password.setValue(partial.password));
        if (partial.label !== undefined) writes.push(label.setValue(partial.label));
        await Promise.all(writes);
        showSuccess('Deluge configuration updated successfully');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to update configuration: ${message}`);
        throw err;
      }
    },
    [enabled, baseURL, password, label],
  );

  const refresh = useCallback(async (): Promise<void> => {
    await Promise.all([
      enabled.refetch(),
      baseURL.refetch(),
      password.refetch(),
      label.refetch(),
    ]);
  }, [enabled, baseURL, password, label]);

  return { config, isLoading, saving, error, updateSetting, updateConfig, refresh };
}
