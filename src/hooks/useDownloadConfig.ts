/**
 * Download Configuration Hook
 *
 * Reads/writes general download settings via `useConfigValue`, so the
 * React-Query cache for each key is shared across every consumer on the
 * page. Public API ({ config, isLoading, saving, error, updateSetting,
 * updateConfig, refresh }) is unchanged.
 *
 * The previous implementation wrapped local `setState` calls in
 * `startTransition` to avoid hydration jank. With useConfigValue the data
 * lives in TanStack Query's cache (not component state), so the transition
 * dance is unnecessary — TanStack Query already integrates with React's
 * scheduler.
 */

import React, { useCallback } from 'react';

import { notifications } from '@mantine/notifications';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

import { useConfigValue } from './useConfigValue';

export type DownloadModePreference = 'mix' | 'prefer-volume' | 'prefer-chapter';

export interface DownloadConfig {
  autoDownload: boolean;
  interval: 'never' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
  customCron?: string;
  downloadPath?: string;
  retryAttempts: number;
  /**
   * Bias the dispatcher toward volume packs, individual chapters, or the
   * emergent mix. Persisted under `download.mode`. Defaults to `'mix'`.
   */
  mode: DownloadModePreference;
}

export interface UseDownloadConfigResult {
  config: DownloadConfig;
  isLoading: boolean;
  saving: string | null;
  error: Error | null;
  updateSetting: <K extends keyof DownloadConfig>(key: K, value: DownloadConfig[K]) => Promise<void>;
  updateConfig: (config: Partial<DownloadConfig>) => Promise<void>;
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

export function useDownloadConfig(): UseDownloadConfigResult {
  const autoDownload = useConfigValue<boolean>('download.autoDownload', true);
  const interval = useConfigValue<DownloadConfig['interval']>('download.interval', 'daily');
  const customCron = useConfigValue<string>('download.customCron', '');
  const downloadPath = useConfigValue<string>('download.downloadPath', '');
  const retryAttempts = useConfigValue<number>('download.retryAttempts', 3);
  const mode = useConfigValue<DownloadModePreference>('download.mode', 'mix');

  const config: DownloadConfig = {
    autoDownload: autoDownload.value,
    interval: interval.value,
    customCron: customCron.value,
    downloadPath: downloadPath.value,
    retryAttempts: retryAttempts.value,
    mode: mode.value,
  };

  const isLoading =
    autoDownload.isLoading ||
    interval.isLoading ||
    customCron.isLoading ||
    downloadPath.isLoading ||
    retryAttempts.isLoading ||
    mode.isLoading;

  const saving: string | null = (() => {
    if (autoDownload.saving) return 'autoDownload';
    if (interval.saving) return 'interval';
    if (customCron.saving) return 'customCron';
    if (downloadPath.saving) return 'downloadPath';
    if (retryAttempts.saving) return 'retryAttempts';
    if (mode.saving) return 'mode';
    return null;
  })();

  const error =
    autoDownload.error ??
    interval.error ??
    customCron.error ??
    downloadPath.error ??
    retryAttempts.error ??
    mode.error;

  const updateSetting = useCallback(
    async <K extends keyof DownloadConfig>(key: K, value: DownloadConfig[K]): Promise<void> => {
      try {
        if (key === 'autoDownload') {
          await autoDownload.setValue(value as boolean);
        } else if (key === 'interval') {
          await interval.setValue(value as DownloadConfig['interval']);
        } else if (key === 'customCron') {
          await customCron.setValue((value as string | undefined) ?? '');
        } else if (key === 'downloadPath') {
          await downloadPath.setValue((value as string | undefined) ?? '');
        } else if (key === 'retryAttempts') {
          await retryAttempts.setValue(value as number);
        } else if (key === 'mode') {
          await mode.setValue(value as DownloadModePreference);
        }
        showSuccess('Download setting updated successfully');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to update setting: ${message}`);
        throw err;
      }
    },
    [autoDownload, interval, customCron, downloadPath, retryAttempts, mode],
  );

  const updateConfig = useCallback(
    async (partial: Partial<DownloadConfig>): Promise<void> => {
      try {
        const writes: Promise<void>[] = [];
        if (partial.autoDownload !== undefined) {
          writes.push(autoDownload.setValue(partial.autoDownload));
        }
        if (partial.interval !== undefined) {
          writes.push(interval.setValue(partial.interval));
        }
        if (partial.customCron !== undefined) {
          writes.push(customCron.setValue(partial.customCron));
        }
        if (partial.downloadPath !== undefined) {
          writes.push(downloadPath.setValue(partial.downloadPath));
        }
        if (partial.retryAttempts !== undefined) {
          writes.push(retryAttempts.setValue(partial.retryAttempts));
        }
        if (partial.mode !== undefined) {
          writes.push(mode.setValue(partial.mode));
        }
        await Promise.all(writes);
        showSuccess('Download configuration updated successfully');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to update configuration: ${message}`);
        throw err;
      }
    },
    [autoDownload, interval, customCron, downloadPath, retryAttempts, mode],
  );

  const refresh = useCallback(async (): Promise<void> => {
    await Promise.all([
      autoDownload.refetch(),
      interval.refetch(),
      customCron.refetch(),
      downloadPath.refetch(),
      retryAttempts.refetch(),
      mode.refetch(),
    ]);
  }, [autoDownload, interval, customCron, downloadPath, retryAttempts, mode]);

  return { config, isLoading, saving, error, updateSetting, updateConfig, refresh };
}
