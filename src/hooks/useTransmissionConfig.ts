/**
 * Transmission Configuration Hook
 *
 * Reads/writes Transmission download-client config keys via `useConfigValue`,
 * so the React-Query cache for each key is shared across every consumer on the
 * page. Toggling `enabled` (or any other field) in one place updates every
 * other component reading the same key — no manual refresh, no stale siblings.
 *
 * Transmission's RPC path in this codebase does not authenticate requests —
 * `directRequest` only sets `Content-Type` and the auto-negotiated
 * `X-Transmission-Session-Id` header. Username/password/API-key fields were
 * removed because they were never read at runtime.
 */

import React, { useCallback } from 'react';

import { notifications } from '@mantine/notifications';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

import { useConfigValue } from './useConfigValue';

export interface TransmissionConfig {
  enabled: boolean;
  baseURL: string;
  label?: string;
}

export interface UseTransmissionConfigResult {
  config: TransmissionConfig;
  isLoading: boolean;
  saving: string | null;
  error: Error | null;
  updateSetting: <K extends keyof TransmissionConfig>(key: K, value: TransmissionConfig[K]) => Promise<void>;
  updateConfig: (config: Partial<TransmissionConfig>) => Promise<void>;
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

export function useTransmissionConfig(): UseTransmissionConfigResult {
  const enabled = useConfigValue<boolean>('download.transmission.enabled', false);
  const baseURL = useConfigValue<string>('download.transmission.baseURL', 'http://localhost:9091');
  const label = useConfigValue<string>('download.transmission.label', 'manga');

  const config: TransmissionConfig = {
    enabled: enabled.value,
    baseURL: baseURL.value,
    label: label.value,
  };

  const isLoading = enabled.isLoading || baseURL.isLoading || label.isLoading;

  const saving: string | null = (() => {
    if (enabled.saving) return 'enabled';
    if (baseURL.saving) return 'baseURL';
    if (label.saving) return 'label';
    return null;
  })();

  const error = enabled.error ?? baseURL.error ?? label.error;

  const updateSetting = useCallback(
    async <K extends keyof TransmissionConfig>(key: K, value: TransmissionConfig[K]): Promise<void> => {
      try {
        if (key === 'enabled') {
          await enabled.setValue(value as boolean);
        } else if (key === 'baseURL') {
          await baseURL.setValue(value as string);
        } else if (key === 'label') {
          await label.setValue((value as string | undefined) ?? '');
        }
        showSuccess('Transmission setting updated successfully');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to update setting: ${message}`);
        throw err;
      }
    },
    [enabled, baseURL, label],
  );

  const updateConfig = useCallback(
    async (partial: Partial<TransmissionConfig>): Promise<void> => {
      try {
        const writes: Promise<void>[] = [];
        if (partial.enabled !== undefined) writes.push(enabled.setValue(partial.enabled));
        if (partial.baseURL !== undefined) writes.push(baseURL.setValue(partial.baseURL));
        if (partial.label !== undefined) writes.push(label.setValue(partial.label));
        await Promise.all(writes);
        showSuccess('Transmission configuration updated successfully');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to update configuration: ${message}`);
        throw err;
      }
    },
    [enabled, baseURL, label],
  );

  const refresh = useCallback(async (): Promise<void> => {
    await Promise.all([enabled.refetch(), baseURL.refetch(), label.refetch()]);
  }, [enabled, baseURL, label]);

  return { config, isLoading, saving, error, updateSetting, updateConfig, refresh };
}
