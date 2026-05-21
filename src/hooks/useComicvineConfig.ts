/**
 * ComicVine Configuration Hook
 *
 * Reads/writes ComicVine config keys via `useConfigValue`, so the React-Query
 * cache for each key is shared across every component on the page. Toggling
 * `enabled` (or `comicbookTrackingEnabled`) in one place updates the settings
 * header, the providers grid, and any other consumer immediately — no manual
 * page refresh required.
 *
 * Public API (config object, updateSetting, updateConfig, refresh) is unchanged
 * for backward compatibility with existing callers (ComicVineSettings form,
 * GetComicsButton, AddComicWizard, useComicIssuePopulation, etc.).
 */

import React, { useCallback } from 'react';

import { notifications } from '@mantine/notifications';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

import { useConfigValue } from './useConfigValue';

export interface ComicvineConfig {
  enabled: boolean;
  apiKey: string;
  priority: number;
  /** Preferred language for filtering variants (default: 'en' for English) */
  preferredLanguage: string;
  /**
   * Whether the Western comicbook tracking feature is enabled.
   * When false, the /add-comic page, the library Comics filter, and the
   * server-side `addSeries` mutation are all gated. Existing comicbook
   * Manga rows remain readable — this controls the *feature surface*, not
   * the data.
   */
  comicbookTrackingEnabled: boolean;
}

export interface UseComicvineConfigResult {
  config: ComicvineConfig;
  isLoading: boolean;
  saving: string | null;
  error: Error | null;
  updateSetting: <K extends keyof ComicvineConfig>(key: K, value: ComicvineConfig[K]) => Promise<void>;
  updateConfig: (config: Partial<ComicvineConfig>) => Promise<void>;
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

export function useComicvineConfig(): UseComicvineConfigResult {
  const enabled = useConfigValue<boolean>('comicvine.enabled', false);
  const apiKey = useConfigValue<string>('comicvine.apiKey', '');
  const priority = useConfigValue<number>('comicvine.priority', 3);
  const preferredLanguage = useConfigValue<string>('comicvine.preferredLanguage', 'en');
  const comicbookTrackingEnabled = useConfigValue<boolean>(
    'comicvine.comicbookTrackingEnabled',
    false,
  );

  const config: ComicvineConfig = {
    enabled: enabled.value,
    apiKey: apiKey.value,
    priority: priority.value,
    preferredLanguage: preferredLanguage.value,
    comicbookTrackingEnabled: comicbookTrackingEnabled.value,
  };

  const isLoading =
    enabled.isLoading ||
    apiKey.isLoading ||
    priority.isLoading ||
    preferredLanguage.isLoading ||
    comicbookTrackingEnabled.isLoading;

  const saving: string | null = (() => {
    if (enabled.saving) return 'enabled';
    if (apiKey.saving) return 'apiKey';
    if (priority.saving) return 'priority';
    if (preferredLanguage.saving) return 'preferredLanguage';
    if (comicbookTrackingEnabled.saving) return 'comicbookTrackingEnabled';
    return null;
  })();

  const error =
    enabled.error ??
    apiKey.error ??
    priority.error ??
    preferredLanguage.error ??
    comicbookTrackingEnabled.error;

  const updateSetting = useCallback(
    async <K extends keyof ComicvineConfig>(key: K, value: ComicvineConfig[K]): Promise<void> => {
      try {
        if (key === 'enabled') {
          await enabled.setValue(value as boolean);
        } else if (key === 'apiKey') {
          await apiKey.setValue(value as string);
        } else if (key === 'priority') {
          await priority.setValue(value as number);
        } else if (key === 'preferredLanguage') {
          await preferredLanguage.setValue(value as string);
        } else if (key === 'comicbookTrackingEnabled') {
          await comicbookTrackingEnabled.setValue(value as boolean);
        }
        showSuccess(`ComicVine ${key} updated successfully`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to update ${key}: ${message}`);
        throw err;
      }
    },
    [enabled, apiKey, priority, preferredLanguage, comicbookTrackingEnabled],
  );

  const updateConfig = useCallback(
    async (partial: Partial<ComicvineConfig>): Promise<void> => {
      try {
        const writes: Promise<void>[] = [];
        if (partial.enabled !== undefined) writes.push(enabled.setValue(partial.enabled));
        if (partial.apiKey !== undefined) writes.push(apiKey.setValue(partial.apiKey));
        if (partial.priority !== undefined) writes.push(priority.setValue(partial.priority));
        if (partial.preferredLanguage !== undefined) {
          writes.push(preferredLanguage.setValue(partial.preferredLanguage));
        }
        if (partial.comicbookTrackingEnabled !== undefined) {
          writes.push(comicbookTrackingEnabled.setValue(partial.comicbookTrackingEnabled));
        }
        await Promise.all(writes);
        showSuccess('ComicVine configuration updated successfully');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to update configuration: ${message}`);
        throw err;
      }
    },
    [enabled, apiKey, priority, preferredLanguage, comicbookTrackingEnabled],
  );

  const refresh = useCallback(async (): Promise<void> => {
    await Promise.all([
      enabled.refetch(),
      apiKey.refetch(),
      priority.refetch(),
      preferredLanguage.refetch(),
      comicbookTrackingEnabled.refetch(),
    ]);
  }, [enabled, apiKey, priority, preferredLanguage, comicbookTrackingEnabled]);

  return { config, isLoading, saving, error, updateSetting, updateConfig, refresh };
}
