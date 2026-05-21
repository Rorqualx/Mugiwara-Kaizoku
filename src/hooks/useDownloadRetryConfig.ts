/**
 * Download Retry Configuration Hook
 *
 * Reads/writes download-retry settings via `useConfigValue`, so the
 * React-Query cache for each key is shared across every consumer on the
 * page. Public API ({ config, isLoading, saving, error, updateSetting,
 * updateConfig, refresh }) is unchanged.
 *
 * @module hooks/useDownloadRetryConfig
 */

import React, { useCallback } from 'react';

import { notifications } from '@mantine/notifications';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

import { useConfigValue } from './useConfigValue';

export interface DownloadRetryConfig {
  /** Whether automatic retry is enabled */
  enabled: boolean;
  /** Maximum number of retry attempts before giving up */
  maxAttempts: number;
  /** Minutes without progress before considering a download stalled */
  stallTimeoutMinutes: number;
  /** Minimum seeders required, below this triggers retry for torrents */
  minSeeders: number;
  /** Whether to automatically add failed releases to blocklist */
  autoBlockFailed: boolean;
  /** Days until blocked releases can be tried again */
  blockExpiryDays: number;
  /** Delay in seconds between retry attempts */
  delayBetweenRetriesSeconds: number;
}

export interface UseDownloadRetryConfigResult {
  config: DownloadRetryConfig;
  isLoading: boolean;
  saving: string | null;
  error: Error | null;
  updateSetting: <K extends keyof DownloadRetryConfig>(
    key: K,
    value: DownloadRetryConfig[K]
  ) => Promise<void>;
  updateConfig: (config: Partial<DownloadRetryConfig>) => Promise<void>;
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

export function useDownloadRetryConfig(): UseDownloadRetryConfigResult {
  const enabled = useConfigValue<boolean>('download.retry.enabled', true);
  const maxAttempts = useConfigValue<number>('download.retry.maxAttempts', 3);
  const stallTimeoutMinutes = useConfigValue<number>('download.retry.stallTimeoutMinutes', 30);
  const minSeeders = useConfigValue<number>('download.retry.minSeeders', 1);
  const autoBlockFailed = useConfigValue<boolean>('download.retry.autoBlockFailed', true);
  const blockExpiryDays = useConfigValue<number>('download.retry.blockExpiryDays', 30);
  const delayBetweenRetriesSeconds = useConfigValue<number>(
    'download.retry.delayBetweenRetriesSeconds',
    60,
  );

  const config: DownloadRetryConfig = {
    enabled: enabled.value,
    maxAttempts: maxAttempts.value,
    stallTimeoutMinutes: stallTimeoutMinutes.value,
    minSeeders: minSeeders.value,
    autoBlockFailed: autoBlockFailed.value,
    blockExpiryDays: blockExpiryDays.value,
    delayBetweenRetriesSeconds: delayBetweenRetriesSeconds.value,
  };

  const isLoading =
    enabled.isLoading ||
    maxAttempts.isLoading ||
    stallTimeoutMinutes.isLoading ||
    minSeeders.isLoading ||
    autoBlockFailed.isLoading ||
    blockExpiryDays.isLoading ||
    delayBetweenRetriesSeconds.isLoading;

  const saving: string | null = (() => {
    if (enabled.saving) return 'enabled';
    if (maxAttempts.saving) return 'maxAttempts';
    if (stallTimeoutMinutes.saving) return 'stallTimeoutMinutes';
    if (minSeeders.saving) return 'minSeeders';
    if (autoBlockFailed.saving) return 'autoBlockFailed';
    if (blockExpiryDays.saving) return 'blockExpiryDays';
    if (delayBetweenRetriesSeconds.saving) return 'delayBetweenRetriesSeconds';
    return null;
  })();

  const error =
    enabled.error ??
    maxAttempts.error ??
    stallTimeoutMinutes.error ??
    minSeeders.error ??
    autoBlockFailed.error ??
    blockExpiryDays.error ??
    delayBetweenRetriesSeconds.error;

  const updateSetting = useCallback(
    async <K extends keyof DownloadRetryConfig>(
      key: K,
      value: DownloadRetryConfig[K],
    ): Promise<void> => {
      try {
        if (key === 'enabled') {
          await enabled.setValue(value as boolean);
        } else if (key === 'maxAttempts') {
          await maxAttempts.setValue(value as number);
        } else if (key === 'stallTimeoutMinutes') {
          await stallTimeoutMinutes.setValue(value as number);
        } else if (key === 'minSeeders') {
          await minSeeders.setValue(value as number);
        } else if (key === 'autoBlockFailed') {
          await autoBlockFailed.setValue(value as boolean);
        } else if (key === 'blockExpiryDays') {
          await blockExpiryDays.setValue(value as number);
        } else if (key === 'delayBetweenRetriesSeconds') {
          await delayBetweenRetriesSeconds.setValue(value as number);
        }
        showSuccess('Retry setting updated successfully');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to update setting: ${message}`);
        throw err;
      }
    },
    [
      enabled,
      maxAttempts,
      stallTimeoutMinutes,
      minSeeders,
      autoBlockFailed,
      blockExpiryDays,
      delayBetweenRetriesSeconds,
    ],
  );

  const updateConfig = useCallback(
    async (partial: Partial<DownloadRetryConfig>): Promise<void> => {
      try {
        const writes: Promise<void>[] = [];
        if (partial.enabled !== undefined) writes.push(enabled.setValue(partial.enabled));
        if (partial.maxAttempts !== undefined) writes.push(maxAttempts.setValue(partial.maxAttempts));
        if (partial.stallTimeoutMinutes !== undefined) {
          writes.push(stallTimeoutMinutes.setValue(partial.stallTimeoutMinutes));
        }
        if (partial.minSeeders !== undefined) writes.push(minSeeders.setValue(partial.minSeeders));
        if (partial.autoBlockFailed !== undefined) {
          writes.push(autoBlockFailed.setValue(partial.autoBlockFailed));
        }
        if (partial.blockExpiryDays !== undefined) {
          writes.push(blockExpiryDays.setValue(partial.blockExpiryDays));
        }
        if (partial.delayBetweenRetriesSeconds !== undefined) {
          writes.push(delayBetweenRetriesSeconds.setValue(partial.delayBetweenRetriesSeconds));
        }
        await Promise.all(writes);
        showSuccess('Retry configuration updated successfully');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to update configuration: ${message}`);
        throw err;
      }
    },
    [
      enabled,
      maxAttempts,
      stallTimeoutMinutes,
      minSeeders,
      autoBlockFailed,
      blockExpiryDays,
      delayBetweenRetriesSeconds,
    ],
  );

  const refresh = useCallback(async (): Promise<void> => {
    await Promise.all([
      enabled.refetch(),
      maxAttempts.refetch(),
      stallTimeoutMinutes.refetch(),
      minSeeders.refetch(),
      autoBlockFailed.refetch(),
      blockExpiryDays.refetch(),
      delayBetweenRetriesSeconds.refetch(),
    ]);
  }, [
    enabled,
    maxAttempts,
    stallTimeoutMinutes,
    minSeeders,
    autoBlockFailed,
    blockExpiryDays,
    delayBetweenRetriesSeconds,
  ]);

  return { config, isLoading, saving, error, updateSetting, updateConfig, refresh };
}
