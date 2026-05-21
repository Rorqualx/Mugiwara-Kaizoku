/**
 * MyAnimeList (Jikan) Configuration Hook
 *
 * Minimal config surface — the Jikan API is read-only and credential-free,
 * so the only user-facing toggle is whether to filter adult content (hentai /
 * erotica flagged by MAL's explicit_genres). Mirrors AniList's
 * `filterAdultContent` setting for consistency.
 *
 * Backed by `useConfigValue` so toggles propagate across every consumer on the
 * page without a refresh (settings header, providers grid, etc.).
 */

import { useCallback } from 'react';

import { notify } from '@/utils/notify';

import { useConfigValue } from './useConfigValue';

export interface MalConfig {
  /** Whether the MAL provider participates in metadata enrichment */
  enabled: boolean;
  /** Filter out manga that MAL flags as hentai/erotica/adult */
  filterAdultContent: boolean;
}

export interface UseMalConfigResult {
  config: MalConfig;
  isLoading: boolean;
  saving: string | null;
  error: Error | null;
  updateSetting: <K extends keyof MalConfig>(key: K, value: MalConfig[K]) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useMalConfig(): UseMalConfigResult {
  const enabled = useConfigValue<boolean>('mal.enabled', false);
  const filterAdultContent = useConfigValue<boolean>('mal.filterAdultContent', true);

  const config: MalConfig = {
    enabled: enabled.value,
    filterAdultContent: filterAdultContent.value,
  };

  const isLoading = enabled.isLoading || filterAdultContent.isLoading;
  const saving: string | null = (() => {
    if (enabled.saving) return 'enabled';
    if (filterAdultContent.saving) return 'filterAdultContent';
    return null;
  })();
  const error = enabled.error ?? filterAdultContent.error;

  const updateSetting = useCallback(
    async <K extends keyof MalConfig>(key: K, value: MalConfig[K]): Promise<void> => {
      try {
        if (key === 'enabled') {
          await enabled.setValue(value as boolean);
        } else {
          await filterAdultContent.setValue(value as boolean);
        }
        notify({ severity: 'SUCCESS', title: 'Success', message: `MAL ${key} updated` });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        notify({ severity: 'ERROR', title: 'Error', message: `Failed to update ${key}: ${message}` });
        throw err;
      }
    },
    [enabled, filterAdultContent],
  );

  const refresh = useCallback(async (): Promise<void> => {
    await Promise.all([enabled.refetch(), filterAdultContent.refetch()]);
  }, [enabled, filterAdultContent]);

  return { config, isLoading, saving, error, updateSetting, refresh };
}
